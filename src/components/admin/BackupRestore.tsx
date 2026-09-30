import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Upload, AlertTriangle, CheckCircle, Database } from 'lucide-react';

export default function BackupRestore() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function exportBackup() {
    setExporting(true);
    const [att, tea, ses, set] = await Promise.all([
      supabase.from('attendance').select('*').order('submitted_at'),
      supabase.from('teachers').select('*').order('sort_order'),
      supabase.from('sessions').select('*').order('sort_order'),
      supabase.from('admin_settings').select('form_heading, form_subheading, form_open, use_time_restriction, form_start_time, form_end_time').eq('id', 1).single(),
    ]);

    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      data: {
        attendance: att.data || [],
        teachers: tea.data || [],
        sessions: ses.data || [],
        settings: set.data || {},
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    setImporting(true);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.version || !backup.data) throw new Error('Invalid backup file format.');

      const { data: attData, teachers: teachersData, sessions: sessionsData, settings: settingsData } = backup.data;

      if (teachersData?.length > 0) {
        await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('teachers').insert(
          teachersData.map((t: Record<string, unknown>) => ({ id: t.id, name: t.name, active: t.active, sort_order: t.sort_order }))
        );
      }

      if (sessionsData?.length > 0) {
        await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sessions').insert(
          sessionsData.map((s: Record<string, unknown>) => ({ id: s.id, name: s.name, active: s.active, sort_order: s.sort_order }))
        );
      }

      if (attData?.length > 0) {
        const chunks = [];
        for (let i = 0; i < attData.length; i += 100) chunks.push(attData.slice(i, i + 100));
        for (const chunk of chunks) {
          await supabase.from('attendance').upsert(
            chunk.map((r: Record<string, unknown>) => ({ id: r.id, teacher_name: r.teacher_name, session_name: r.session_name, submitted_at: r.submitted_at }))
          );
        }
      }

      if (settingsData) {
        await supabase.from('admin_settings').update({
          form_heading: settingsData.form_heading,
          form_subheading: settingsData.form_subheading,
          form_open: settingsData.form_open,
          use_time_restriction: settingsData.use_time_restriction,
          form_start_time: settingsData.form_start_time,
          form_end_time: settingsData.form_end_time,
        }).eq('id', 1);
      }

      setImportMsg({ type: 'success', text: `Restore successful! Imported ${attData?.length || 0} attendance records, ${teachersData?.length || 0} teachers, ${sessionsData?.length || 0} sessions.` });
    } catch (err) {
      setImportMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to restore backup.' });
    }

    setImporting(false);
    e.target.value = '';
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      {/* Export */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Export Backup</h3>
          <p className="text-xs text-slate-500 mt-0.5">Download all data as a JSON file</p>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <p className="text-sm text-slate-600 mb-4">
            Creates a full backup of all attendance records, teachers, sessions, and form settings.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-5">
            {[
              { icon: Database, label: 'Attendance records', bg: 'bg-blue-50', text: 'text-blue-500' },
              { icon: Database, label: 'Teachers list', bg: 'bg-emerald-50', text: 'text-emerald-500' },
              { icon: Database, label: 'Session types', bg: 'bg-amber-50', text: 'text-amber-500' },
              { icon: Database, label: 'Form settings', bg: 'bg-slate-50', text: 'text-slate-500' },
            ].map(({ icon: Icon, label, bg, text }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-2 ${bg} rounded-xl`}>
                <Icon className={`w-3.5 h-3.5 ${text} flex-shrink-0`} />
                <span className="text-xs text-slate-600 font-medium truncate">{label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={exportBackup}
            disabled={exporting}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Download Backup'}
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Restore Backup</h3>
          <p className="text-xs text-slate-500 mt-0.5">Upload a backup JSON file to restore data</p>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-amber-700">
              Restoring will overwrite existing teachers and sessions. Attendance records will be merged. Export a fresh backup first.
            </p>
          </div>

          {importMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3 sm:px-4 py-3 mb-4 ${
              importMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
            }`}>
              <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${importMsg.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`} />
              <p className={`text-xs sm:text-sm ${importMsg.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {importMsg.text}
              </p>
            </div>
          )}

          <label className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''} w-fit`}>
            <Upload className="w-4 h-4" />
            {importing ? 'Restoring...' : 'Choose Backup File'}
            <input type="file" accept=".json" onChange={importBackup} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>
    </div>
  );
}
