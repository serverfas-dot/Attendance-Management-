import { useState, useEffect } from 'react';
import { supabase, Session } from '../../lib/supabase';
import { Plus, Pencil, Trash2, Save, X, GripVertical, CheckCircle, XCircle } from 'lucide-react';

export default function SessionsManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    const { data } = await supabase.from('sessions').select('*').order('sort_order').order('created_at');
    setSessions(data || []);
    setLoading(false);
  }

  async function addSession() {
    if (!newName.trim()) return;
    setSaving(true);
    const maxOrder = sessions.length > 0 ? Math.max(...sessions.map(s => s.sort_order)) + 1 : 1;
    await supabase.from('sessions').insert({ name: newName.trim(), sort_order: maxOrder });
    setNewName('');
    setAdding(false);
    setSaving(false);
    loadSessions();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    await supabase.from('sessions').update({ name: editName.trim() }).eq('id', id);
    setEditingId(null);
    setSaving(false);
    loadSessions();
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('sessions').update({ active: !active }).eq('id', id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, active: !active } : s));
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this session type? Existing attendance records will remain.')) return;
    await supabase.from('sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800">Session Types</h3>
            <p className="text-xs text-slate-500 mt-0.5">{sessions.length} sessions · {sessions.filter(s => s.active).length} active</p>
          </div>
          <button
            onClick={() => { setAdding(true); setNewName(''); }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Add Session
          </button>
        </div>

        {adding && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 sm:gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSession()}
              className="flex-1 bg-white border border-blue-200 rounded-xl px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-0"
              placeholder="Enter session name..."
              autoFocus
            />
            <button onClick={addSession} disabled={saving || !newName.trim()} className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex-shrink-0">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setAdding(false)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-4 border-slate-300 border-t-slate-700" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No sessions added yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 ${!s.active ? 'opacity-50' : ''} hover:bg-slate-50 transition-colors`}>
                <span className="text-slate-400 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 hidden sm:block" />

                {editingId === s.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 min-w-0"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{s.name}</span>
                )}

                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => saveEdit(s.id)} disabled={saving} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => toggleActive(s.id, s.active)} className={`p-1.5 rounded-lg transition-colors ${s.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={s.active ? 'Deactivate' : 'Activate'}>
                        {s.active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteSession(s.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
