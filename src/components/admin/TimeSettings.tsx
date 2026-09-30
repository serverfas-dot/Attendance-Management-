import { useState, useEffect } from 'react';
import { supabase, AdminSettings } from '../../lib/supabase';
import { Save, Clock, ToggleLeft, ToggleRight, Info } from 'lucide-react';

interface Props {
  settings: AdminSettings | null;
  onUpdate: () => void;
}

function formatTo12(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function TimeSettings({ settings, onUpdate }: Props) {
  const [useRestriction, setUseRestriction] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [formOpen, setFormOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setUseRestriction(settings.use_time_restriction);
      setStartTime(settings.form_start_time || '08:00');
      setEndTime(settings.form_end_time || '17:00');
      setFormOpen(settings.form_open);
    }
  }, [settings]);

  async function save() {
    setSaving(true);
    await supabase.from('admin_settings').update({
      use_time_restriction: useRestriction,
      form_start_time: startTime || null,
      form_end_time: endTime || null,
      form_open: formOpen,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      {/* Global open/close */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Form Access Control</h3>
          <p className="text-xs text-slate-500 mt-0.5">Manually open or close the attendance form</p>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">Form is currently</p>
              <p className="text-xs text-slate-500">Override all time restrictions</p>
            </div>
            <button
              onClick={() => setFormOpen(!formOpen)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex-shrink-0 ${
                formOpen
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
              }`}
            >
              {formOpen ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {formOpen ? 'Open' : 'Closed'}
            </button>
          </div>
        </div>
      </div>

      {/* Time restriction */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800">Time Restriction</h3>
            <p className="text-xs text-slate-500 mt-0.5">Only allow submissions during specific hours</p>
          </div>
          <button
            onClick={() => setUseRestriction(!useRestriction)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex-shrink-0 ${
              useRestriction
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {useRestriction ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {useRestriction ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className={`px-4 sm:px-6 py-4 sm:py-5 space-y-4 ${!useRestriction ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Open Time</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {startTime && <p className="text-xs text-slate-400 mt-1">{formatTo12(startTime)}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Close Time</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {endTime && <p className="text-xs text-slate-400 mt-1">{formatTo12(endTime)}</p>}
            </div>
          </div>

          {useRestriction && startTime && endTime && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 sm:px-4 py-3">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-blue-700">
                The form will only accept submissions between <strong>{formatTo12(startTime)}</strong> and <strong>{formatTo12(endTime)}</strong> each day.
              </p>
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
