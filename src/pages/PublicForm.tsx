import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, XCircle, ChevronDown, MapPin, Navigation, Wifi } from 'lucide-react';
import { supabase, AdminSettings, StaffType, Teacher, Session, logoSrc } from '../lib/supabase';

function isFormOpen(settings: AdminSettings): { open: boolean; reason: string } {
  if (!settings.form_open) return { open: false, reason: 'The form is currently closed by the administrator.' };
  if (!settings.use_time_restriction) return { open: true, reason: '' };
  const start = settings.form_start_time;
  const end = settings.form_end_time;
  if (!start || !end) return { open: true, reason: '' };
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (nowMins >= startMins && nowMins <= endMins) return { open: true, reason: '' };
  return { open: false, reason: `Form is only open from ${formatTime(start)} to ${formatTime(end)}.` };
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

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

export default function PublicForm() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedStaffType, setSelectedStaffType] = useState<StaffType>('Academic');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live location state
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [locPermission, setLocPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [locSubmitting, setLocSubmitting] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Start live GPS watch once settings load and location is enabled
  useEffect(() => {
    if (!settings?.location_enabled || !settings?.location_lat || !settings?.location_lng) return;
    if (!navigator.geolocation) { setLocPermission('denied'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setLocPermission('granted');
        const dist = Math.round(
          haversineMeters(settings.location_lat!, settings.location_lng!, pos.coords.latitude, pos.coords.longitude)
        );
        setLiveDistance(dist);
      },
      () => { setLocPermission('denied'); },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [settings]);

  async function loadData() {
    const [s, t, se] = await Promise.all([
      supabase.from('admin_settings').select('id, form_heading, form_subheading, form_open, form_start_time, form_end_time, use_time_restriction, location_enabled, location_lat, location_lng, location_radius_meters, location_name, updated_at, admin_username').eq('id', 1).single(),
      supabase.from('teachers').select('*').eq('active', true).order('sort_order'),
      supabase.from('sessions').select('*').eq('active', true).order('sort_order'),
    ]);
    if (s.data) setSettings(s.data);
    if (t.data) setTeachers(t.data);
    if (se.data) setSessions(se.data);
    setLoading(false);
  }

  // Get a single fresh reading at submit time (maximumAge:0 = no cache)
  function getFreshPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedTeacher || !selectedSession) {
      setError('Please select both your name and session.');
      return;
    }
    if (!settings) return;
    const status = isFormOpen(settings);
    if (!status.open) { setError(status.reason); return; }

    setSubmitting(true);

    // Location check — always get a fresh position at submit time
    if (settings.location_enabled && settings.location_lat && settings.location_lng) {
      if (!navigator.geolocation) {
        setSubmitting(false);
        setError('Your device does not support GPS. Cannot verify location.');
        return;
      }
      setLocSubmitting(true);
      try {
        const pos = await getFreshPosition();
        const dist = Math.round(
          haversineMeters(settings.location_lat, settings.location_lng, pos.coords.latitude, pos.coords.longitude)
        );
        setLiveDistance(dist);
        setLocSubmitting(false);
        if (dist > settings.location_radius_meters) {
          setSubmitting(false);
          const place = settings.location_name ? `"${settings.location_name}"` : 'the required location';
          setError(`You are ${dist}m away from ${place}. You must be within ${settings.location_radius_meters}m to submit.`);
          return;
        }
      } catch {
        setLocSubmitting(false);
        setSubmitting(false);
        setLocPermission('denied');
        setError('Location access denied or timed out. Please allow GPS and try again.');
        return;
      }
    }

    // Duplicate check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('teacher_name', selectedTeacher)
      .eq('session_name', selectedSession)
      .gte('submitted_at', todayStart.toISOString())
      .lte('submitted_at', todayEnd.toISOString())
      .maybeSingle();

    if (existing) {
      setSubmitting(false);
      setError(`${selectedTeacher} has already submitted attendance for "${selectedSession}" today.`);
      return;
    }

    const { error: err } = await supabase.from('attendance').insert({
      teacher_name: selectedTeacher,
      session_name: selectedSession,
    });
    setSubmitting(false);
    if (err) {
      if (err.code === '23505') {
        setError(`${selectedTeacher} has already submitted attendance for "${selectedSession}" today.`);
      } else {
        setError('Failed to submit. Please try again.');
      }
    } else {
      setSubmitted(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  const formStatus = settings ? isFormOpen(settings) : { open: false, reason: 'Loading...' };
  const locationEnabled = !!(settings?.location_enabled && settings?.location_lat && settings?.location_lng);
  const radius = settings?.location_radius_meters ?? 40;
  const isInRange = liveDistance !== null && liveDistance <= radius;

  // Location meter bar: clamp distance to 0–radius*2 for the visual
  const meterPercent = liveDistance !== null
    ? Math.max(0, Math.min(100, (1 - liveDistance / (radius * 2)) * 100))
    : 0;
  const filteredTeachers = teachers.filter(teacher =>
    teacher.staff_type === selectedStaffType || teacher.staff_type === 'Both'
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Attendance Recorded!</h2>
          <p className="text-slate-500 text-sm sm:text-base mb-1">Your attendance has been successfully submitted.</p>
          <p className="text-slate-400 text-xs sm:text-sm mb-6">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between text-sm gap-3">
              <span className="text-slate-500 flex-shrink-0">Name</span>
              <span className="font-semibold text-slate-800 text-right">{selectedTeacher}</span>
            </div>
            <div className="flex justify-between text-sm gap-3">
              <span className="text-slate-500 flex-shrink-0">Session</span>
              <span className="font-semibold text-slate-800 text-right">{selectedSession}</span>
            </div>
          </div>
          <button
            onClick={() => { setSubmitted(false); setSelectedTeacher(''); setSelectedSession(''); setError(''); }}
            className="w-full bg-slate-800 text-white py-3 sm:py-3.5 rounded-xl font-semibold hover:bg-slate-700 transition-colors text-sm sm:text-base"
          >
            Submit Another Person
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 sm:px-8 py-6 sm:py-8 text-center">
          <div className="flex justify-center mb-3">
            <img src={logoSrc} alt="Faafu Atoll School logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {settings?.form_heading || 'Attendance Record'}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm">
            {settings?.form_subheading || 'Please sign in your attendance below'}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {currentTime.toLocaleDateString()} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          {locationEnabled && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-slate-400 text-xs">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span>
                {settings!.location_name
                  ? `Location required: ${settings!.location_name}`
                  : `Must be within ${radius}m to submit`}
              </span>
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-6 sm:py-8">
          {!formStatus.open ? (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">Form Unavailable</h3>
              <p className="text-slate-500 text-sm">{formStatus.reason}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Staff Type</label>
                <div className="relative">
                  <select
                    value={selectedStaffType}
                    onChange={e => { setSelectedStaffType(e.target.value as StaffType); setSelectedTeacher(''); }}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all text-sm"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Academic">Academic</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Session</label>
                <div className="relative">
                  <select
                    value={selectedSession}
                    onChange={e => setSelectedSession(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">-- Select Session --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
                <div className="relative">
                  <select
                    value={selectedTeacher}
                    onChange={e => setSelectedTeacher(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">{filteredTeachers.length > 0 ? '-- Select Your Name --' : 'No staff in this category'}</option>
                    {filteredTeachers.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* ── Live Location Meter ── */}
              {locationEnabled && (
                <div className={`rounded-xl border overflow-hidden transition-colors ${
                  locPermission === 'denied'
                    ? 'border-rose-200 bg-rose-50'
                    : isInRange
                      ? 'border-emerald-200 bg-emerald-50'
                      : liveDistance !== null
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-slate-50'
                }`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    {locPermission === 'denied' ? (
                      <>
                        <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-rose-700">Location access denied</p>
                          <p className="text-xs text-rose-600 mt-0.5">Open browser settings and allow location, then reload.</p>
                        </div>
                      </>
                    ) : liveDistance === null ? (
                      <>
                        <Wifi className="w-5 h-5 text-slate-400 animate-pulse flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-600">Getting your location...</p>
                          <p className="text-xs text-slate-500 mt-0.5">Tap <strong>Allow</strong> and choose <strong>Precise</strong> when prompted.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isInRange ? 'bg-emerald-200' : 'bg-amber-200'
                        }`}>
                          <MapPin className={`w-4 h-4 ${isInRange ? 'text-emerald-700' : 'text-amber-700'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-xs font-bold ${isInRange ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {isInRange ? 'Inside — you can submit' : `${liveDistance}m away — move closer`}
                            </p>
                            <span className={`text-xs font-semibold flex-shrink-0 ${isInRange ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {liveDistance}m
                            </span>
                          </div>
                          {/* Distance bar */}
                          <div className="mt-1.5 h-2 rounded-full bg-white/70 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isInRange ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                              style={{ width: `${meterPercent}%` }}
                            />
                          </div>
                          <p className={`text-xs mt-1 ${isInRange ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {settings!.location_name || 'Required location'} · limit {radius}m
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || locSubmitting}
                className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-semibold hover:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {locSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Navigation className="w-4 h-4 animate-spin" />
                    Checking Location...
                  </span>
                ) : submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Navigation className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : 'Submit Attendance'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
