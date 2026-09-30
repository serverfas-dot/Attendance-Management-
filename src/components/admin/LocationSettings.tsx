import { useState, useEffect, useRef } from 'react';
import { supabase, AdminSettings } from '../../lib/supabase';
import {
  Save, MapPin, ToggleLeft, ToggleRight, Navigation,
  Info, CheckCircle, Search, X, Loader, Building2
} from 'lucide-react';

interface Props {
  settings: AdminSettings | null;
  onUpdate: () => void;
}

interface PlaceResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    country?: string;
  };
}

const BUILDING_PRESETS = [
  {
    id: 'office',
    name: 'Office',
    description: 'Main Office Building',
    lat: '3.2697643',
    lng: '73.0033368',
    radius: '6',
  },
  {
    id: 'av-room',
    name: 'AV Room',
    description: 'Audio-Visual Room',
    lat: '3.2699987',
    lng: '73.0037083',
    radius: '6',
  },
];

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapSrc(lat: string, lng: string, radius: number) {
  const f = parseFloat;
  const delta = Math.max((radius / 111320) * 2.5, 0.003);
  const bbox = [f(lng) - delta, f(lat) - delta, f(lng) + delta, f(lat) + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default function LocationSettings({ settings, onUpdate }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('200');
  const [locationName, setLocationName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'pass' | 'fail'>('idle');
  const [testDistance, setTestDistance] = useState<number | null>(null);

  // Place search
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.location_enabled);
      setLat(settings.location_lat?.toString() ?? '');
      setLng(settings.location_lng?.toString() ?? '');
      setRadius(settings.location_radius_meters?.toString() ?? '200');
      setLocationName(settings.location_name ?? '');
    }
  }, [settings]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(() => searchPlaces(val), 600);
  }

  async function searchPlaces(q: string) {
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: PlaceResult[] = await res.json();
      setResults(data);
      setShowResults(true);
      if (data.length === 0) setSearchError('No places found. Try a different search term.');
    } catch {
      setSearchError('Search failed. Check your internet connection.');
    }
    setSearching(false);
  }

  function selectPlace(place: PlaceResult) {
    setLat(parseFloat(place.lat).toFixed(7));
    setLng(parseFloat(place.lon).toFixed(7));
    const name = place.display_name.split(',').slice(0, 2).join(', ');
    setLocationName(name);
    setQuery(place.display_name.split(',')[0]);
    setShowResults(false);
    setResults([]);
    setTestResult('idle');
    setTestDistance(null);
  }

  function captureCurrentLocation() {
    setDetecting(true);
    setDetectError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setDetecting(false);
        setTestResult('idle');
        setTestDistance(null);
      },
      err => {
        setDetectError('Could not get location: ' + err.message);
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function testMyLocation() {
    if (!lat || !lng) return;
    setTestResult('testing');
    setTestDistance(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = Math.round(haversineMeters(Number(lat), Number(lng), pos.coords.latitude, pos.coords.longitude));
        setTestDistance(dist);
        setTestResult(dist <= Number(radius) ? 'pass' : 'fail');
      },
      err => {
        setDetectError('Test failed: ' + err.message);
        setTestResult('idle');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save() {
    setSaving(true);
    await supabase.from('admin_settings').update({
      location_enabled: enabled,
      location_lat: lat ? Number(lat) : null,
      location_lng: lng ? Number(lng) : null,
      location_radius_meters: Number(radius) || 200,
      location_name: locationName || null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  }

  const hasCoords = lat && lng;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Location Restriction</h3>
            <p className="text-xs text-slate-500 mt-0.5">Only allow form submission within a set GPS radius</p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex-shrink-0 ${
              enabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className={`px-4 sm:px-6 py-4 sm:py-5 space-y-5 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>

          {/* ── Building selector ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <label className="text-sm font-semibold text-slate-700">Select Meeting Building</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {BUILDING_PRESETS.map(p => {
                const active = lat === p.lat && lng === p.lng;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setLat(p.lat);
                      setLng(p.lng);
                      setLocationName(`F. Atoll School – ${p.name}, Feeali`);
                      setQuery('');
                      setRadius(p.radius);
                      setTestResult('idle');
                      setTestDistance(null);
                    }}
                    className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border-2 text-center transition-all ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2">
                        <CheckCircle className="w-4 h-4 text-blue-200" />
                      </span>
                    )}
                    <MapPin className={`w-6 h-6 ${active ? 'text-blue-200' : 'text-blue-500'}`} />
                    <div>
                      <p className="font-bold text-sm leading-tight">{p.name}</p>
                      <p className={`text-xs mt-0.5 ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                        {p.description}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      active ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {p.radius}m radius
                    </span>
                  </button>
                );
              })}
            </div>
            {lat && lng && (
              <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-emerald-700 font-medium">
                  Active: <strong>{locationName || 'Custom location'}</strong> — {radius}m radius
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or search manually</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ── Place Search ── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Search for a Place
            </label>
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  onFocus={() => results.length > 0 && setShowResults(true)}
                  placeholder="Type school name, address, or place..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                />
                {searching && (
                  <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                )}
                {query && !searching && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results dropdown */}
              {showResults && results.length > 0 && (
                <div className="absolute z-50 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {results.map(place => (
                    <button
                      key={place.place_id}
                      type="button"
                      onClick={() => selectPlace(place)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {place.display_name.split(',')[0]}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {place.display_name.split(',').slice(1, 4).join(', ')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {parseFloat(place.lat).toFixed(5)}, {parseFloat(place.lon).toFixed(5)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchError && !searching && (
                <p className="text-xs text-slate-500 mt-1.5 pl-1">{searchError}</p>
              )}
            </div>
          </div>

          {/* ── OR use GPS ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or use GPS</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div>
            <button
              type="button"
              onClick={captureCurrentLocation}
              disabled={detecting}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              <Navigation className="w-4 h-4" />
              {detecting ? 'Detecting...' : 'Use My Current GPS Location'}
            </button>
            {detectError && <p className="text-xs text-rose-500 mt-1.5">{detectError}</p>}
          </div>

          {/* ── Selected location details ── */}
          {hasCoords && (
            <div className="space-y-4 pt-1">
              {/* Location label */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Location Label <span className="font-normal text-slate-400">(shown on the form)</span>
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                  placeholder="e.g. School Campus"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              {/* Coords read-only display */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-mono">
                    {lat}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-mono">
                    {lng}
                  </div>
                </div>
              </div>

              {/* Map preview */}
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-slate-600">
                    {locationName || 'Selected Location'}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    Radius: {radius}m
                  </span>
                </div>
                <iframe
                  key={`${lat},${lng},${radius}`}
                  src={mapSrc(lat, lng, Number(radius))}
                  width="100%"
                  height="260"
                  style={{ border: 0 }}
                  loading="lazy"
                  title="Location preview"
                />
                <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-center">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open full map
                  </a>
                </div>
              </div>

              {/* Radius slider */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Allowed Radius: <span className="text-blue-600">{radius} meters</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={radius}
                  onChange={e => { setRadius(e.target.value); setTestResult('idle'); }}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>50 m (tight)</span>
                  <span>2000 m (wide)</span>
                </div>
              </div>

              {/* Test location */}
              <div>
                <button
                  type="button"
                  onClick={testMyLocation}
                  disabled={testResult === 'testing'}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-60"
                >
                  <Navigation className="w-4 h-4" />
                  {testResult === 'testing' ? 'Testing...' : 'Test My Current Location'}
                </button>
                {testResult === 'pass' && (
                  <div className="flex items-center gap-2 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Within range — {testDistance}m away (limit: {radius}m)
                  </div>
                )}
                {testResult === 'fail' && (
                  <div className="flex items-center gap-2 mt-2 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-2 rounded-xl text-sm">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    Out of range — {testDistance}m away (limit: {radius}m)
                  </div>
                )}
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Staff must be within <strong>{radius} meters</strong>
                  {locationName ? ` of "${locationName}"` : ''} to submit the form.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          saved ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
        } disabled:opacity-60`}
      >
        <Save className="w-4 h-4" />
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
