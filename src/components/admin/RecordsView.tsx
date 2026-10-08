import { useState, useEffect } from 'react';
import { supabase, AttendanceRecord, Session, Teacher } from '../../lib/supabase';
import {
  Calendar, CalendarDays, BarChart3, Trash2, Download, Search,
  ChevronLeft, ChevronRight, Filter, UserCheck, UserX, Users,
  CheckSquare, Square, AlertTriangle, X
} from 'lucide-react';

type ViewMode = 'daily' | 'monthly' | 'yearly';
type DisplayMode = 'status' | 'records';

interface ConfirmModal {
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function RecordsView() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('status');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('*').order('sort_order'),
      supabase.from('teachers').select('*').order('sort_order'),
    ]).then(([{ data: s }, { data: t }]) => {
      if (s) setSessions(s);
      if (t) setTeachers(t);
    });
  }, []);

  useEffect(() => { loadRecords(); }, [viewMode, selectedDate, selectedMonth, selectedYear]);

  // Clear selection when filtered list changes
  useEffect(() => { setSelectedIds(new Set()); }, [viewMode, selectedDate, selectedMonth, selectedYear, sessionFilter, search]);

  async function loadRecords() {
    setLoading(true);
    let query = supabase.from('attendance').select('*').order('submitted_at', { ascending: false });
    if (viewMode === 'daily') {
      query = query
        .gte('submitted_at', `${selectedDate}T00:00:00`)
        .lte('submitted_at', `${selectedDate}T23:59:59`);
    } else if (viewMode === 'monthly') {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      query = query
        .gte('submitted_at', `${selectedMonth}-01T00:00:00`)
        .lte('submitted_at', `${selectedMonth}-${lastDay}T23:59:59`);
    } else {
      query = query
        .gte('submitted_at', `${selectedYear}-01-01T00:00:00`)
        .lte('submitted_at', `${selectedYear}-12-31T23:59:59`);
    }
    const { data } = await query;
    setRecords(data || []);
    setLoading(false);
  }

  function confirm(modal: ConfirmModal) {
    setConfirmModal(modal);
  }

  async function deleteRecord(id: string) {
    confirm({
      title: 'Delete Record',
      message: 'Delete this attendance record? This cannot be undone.',
      onConfirm: async () => {
        setDeleting(true);
        await supabase.from('attendance').delete().eq('id', id);
        setRecords(prev => prev.filter(r => r.id !== id));
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        setDeleting(false);
      },
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    confirm({
      title: `Delete ${ids.length} Record${ids.length > 1 ? 's' : ''}`,
      message: `Permanently delete ${ids.length} selected record${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        await supabase.from('attendance').delete().in('id', ids);
        setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
        setDeleting(false);
      },
    });
  }

  async function deleteAllSession(sessionName: string) {
    const count = records.filter(r => r.session_name === sessionName).length;
    confirm({
      title: `Delete All "${sessionName}" Records`,
      message: `Permanently delete all ${count} record${count !== 1 ? 's' : ''} for "${sessionName}" in this period? This cannot be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        const ids = records.filter(r => r.session_name === sessionName).map(r => r.id);
        await supabase.from('attendance').delete().in('id', ids);
        setRecords(prev => prev.filter(r => r.session_name !== sessionName));
        setSelectedIds(prev => {
          const n = new Set(prev);
          ids.forEach(id => n.delete(id));
          return n;
        });
        setDeleting(false);
      },
    });
  }

  async function deleteAllVisible() {
    const ids = filteredRecords.map(r => r.id);
    confirm({
      title: `Delete All ${ids.length} Records`,
      message: `Permanently delete all ${ids.length} visible records${sessionFilter ? ` for "${sessionFilter}"` : ''} in this period? This cannot be undone.`,
      onConfirm: async () => {
        setDeleting(true);
        await supabase.from('attendance').delete().in('id', ids);
        setRecords(prev => prev.filter(r => !ids.includes(r.id)));
        setSelectedIds(new Set());
        setDeleting(false);
      },
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  }

  function exportCSV() {
    const headers = ['Name', 'Session', 'Date', 'Time'];
    const rows = filteredRecords.map(r => {
      const dt = new Date(r.submitted_at);
      return [r.teacher_name, r.session_name, dt.toLocaleDateString(), dt.toLocaleTimeString()];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${viewMode}-${sessionFilter || 'all'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportStatusCSV() {
    const targetSessions = sessionFilter ? sessions.filter(s => s.name === sessionFilter) : sessions;
    const rows: string[][] = [];
    rows.push(['Name', ...targetSessions.map(s => s.name), 'Total Present']);
    for (const t of teachers) {
      const row: string[] = [t.name];
      let presentCount = 0;
      for (const s of targetSessions) {
        const present = records.some(r => r.teacher_name === t.name && r.session_name === s.name);
        row.push(present ? 'Present' : 'Absent');
        if (present) presentCount++;
      }
      row.push(String(presentCount));
      rows.push(row);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-status-${selectedDate || selectedMonth || selectedYear}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredRecords = records.filter(r => {
    const matchSession = !sessionFilter || r.session_name === sessionFilter;
    const matchSearch =
      r.teacher_name.toLowerCase().includes(search.toLowerCase()) ||
      r.session_name.toLowerCase().includes(search.toLowerCase());
    return matchSession && matchSearch;
  });

  const sessionCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.name] = records.filter(r => r.session_name === s.name).length;
    return acc;
  }, {});

  const allSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function navigateDate(dir: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  }

  function navigateMonth(dir: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const targetSessions = sessionFilter ? sessions.filter(s => s.name === sessionFilter) : sessions;
  const searchedTeachers = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{confirmModal.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top controls row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-200">
          {([['daily', 'Daily', Calendar], ['monthly', 'Monthly', CalendarDays], ['yearly', 'Yearly', BarChart3]] as const).map(([mode, label, Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                viewMode === mode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-200 ml-auto">
          <button
            onClick={() => setDisplayMode('status')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              displayMode === 'status' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Status
          </button>
          <button
            onClick={() => setDisplayMode('records')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              displayMode === 'records' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Log
          </button>
        </div>
      </div>

      {/* Session filter pills */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSessionFilter('')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !sessionFilter
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            <Filter className="w-3 h-3" />
            All Sessions
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${!sessionFilter ? 'bg-white/20' : 'bg-slate-100'}`}>
              {records.length}
            </span>
          </button>
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSessionFilter(sessionFilter === s.name ? '' : s.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                sessionFilter === s.name
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {s.name}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${sessionFilter === s.name ? 'bg-white/20' : 'bg-slate-100'}`}>
                {sessionCounts[s.name] ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Controls bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
        {viewMode === 'daily' && (
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-36 sm:w-auto"
            />
            <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
        {viewMode === 'monthly' && (
          <div className="flex items-center gap-1">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-slate-200 rounded-xl px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
        {viewMode === 'yearly' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setSelectedYear(y => String(Number(y) - 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="border border-slate-200 rounded-xl px-2 sm:px-3 py-2 text-xs sm:text-sm w-20 sm:w-24 focus:outline-none focus:ring-2 focus:ring-slate-300"
              min="2000" max="2099"
            />
            <button onClick={() => setSelectedYear(y => String(Number(y) + 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-32 sm:w-44"
            />
          </div>
          <button
            onClick={displayMode === 'status' ? exportStatusCSV : exportCSV}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>

      {/* ── STATUS VIEW ── */}
      {displayMode === 'status' && (
        <>
          {targetSessions.length > 0 && (
            <div className={`grid gap-3 ${targetSessions.length === 1 ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {targetSessions.map(s => {
                const presentNames = new Set(records.filter(r => r.session_name === s.name).map(r => r.teacher_name));
                const presentCount = presentNames.size;
                const absentCount = teachers.length - presentCount;
                const sessionRecordCount = records.filter(r => r.session_name === s.name).length;
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{s.name}</p>
                      {sessionRecordCount > 0 && (
                        <button
                          onClick={() => deleteAllSession(s.name)}
                          disabled={deleting}
                          title={`Delete all ${s.name} records`}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete All
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-bold text-emerald-700">{presentCount}</p>
                        <p className="text-xs text-emerald-600 font-medium">Present</p>
                      </div>
                      <div className="flex-1 bg-rose-50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-bold text-rose-600">{absentCount}</p>
                        <p className="text-xs text-rose-500 font-medium">Absent</p>
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-bold text-slate-700">{teachers.length}</p>
                        <p className="text-xs text-slate-500 font-medium">Total</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800">
                  Attendance Status
                  {sessionFilter && <span className="ml-2 text-sm font-normal text-blue-600">— {sessionFilter}</span>}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{searchedTeachers.length} staff members</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-slate-700" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50">#</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-6 bg-slate-50 min-w-[140px]">Name</th>
                      {targetSessions.map(s => (
                        <th key={s.id} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[110px]">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchedTeachers.map((t, i) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-sm text-slate-400 sticky left-0 bg-white">{i + 1}</td>
                        <td className="px-4 sm:px-6 py-3 text-sm font-semibold text-slate-800 sticky left-6 bg-white">{t.name}</td>
                        {targetSessions.map(s => {
                          const rec = records.find(r => r.teacher_name === t.name && r.session_name === s.name);
                          return (
                            <td key={s.id} className="px-3 py-3 text-center">
                              {rec ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                                  <UserCheck className="w-3 h-3" />
                                  Present
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-semibold rounded-full">
                                  <UserX className="w-3 h-3" />
                                  Absent
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {searchedTeachers.length === 0 && (
                  <div className="text-center py-14 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No staff found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── LOG VIEW ── */}
      {displayMode === 'records' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                {sessionFilter ? `${sessionFilter} Records` : 'Total Records'}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{filteredRecords.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Unique Staff</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">
                {new Set(filteredRecords.map(r => r.teacher_name)).size}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-slate-800">
                  Attendance Log
                  {sessionFilter && <span className="ml-2 text-sm font-normal text-blue-600">— {sessionFilter}</span>}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{filteredRecords.length} {filteredRecords.length === 1 ? 'entry' : 'entries'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {filteredRecords.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 bg-white transition-all"
                  >
                    {allSelected
                      ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      : someSelected
                        ? <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        : <Square className="w-3.5 h-3.5" />
                    }
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {selectedIds.size} Selected
                  </button>
                )}
                {filteredRecords.length > 0 && selectedIds.size === 0 && (
                  <button
                    onClick={deleteAllVisible}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </button>
                )}
              </div>
            </div>

            {/* Selection banner */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-blue-50 border-b border-blue-100">
                <CheckSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-blue-700 font-medium flex-1">
                  {selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded-lg hover:bg-blue-100 transition-colors">
                  <X className="w-3.5 h-3.5 text-blue-500" />
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-14">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-slate-700" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-14 text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No records found{sessionFilter ? ` for "${sessionFilter}"` : ''} in this period.</p>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <ul className="sm:hidden divide-y divide-slate-100">
                  {filteredRecords.map((r, i) => {
                    const dt = new Date(r.submitted_at);
                    const checked = selectedIds.has(r.id);
                    return (
                      <li
                        key={r.id}
                        className={`px-4 py-3 flex items-start gap-3 transition-colors ${checked ? 'bg-blue-50' : ''}`}
                      >
                        <button
                          onClick={() => toggleSelect(r.id)}
                          className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-blue-500 transition-colors"
                        >
                          {checked
                            ? <CheckSquare className="w-4 h-4 text-blue-500" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                        <span className="text-xs text-slate-400 mt-0.5 w-5 flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{r.teacher_name}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">{r.session_name}</span>
                          <p className="text-xs text-slate-400 mt-1">
                            {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}{dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteRecord(r.id)}
                          disabled={deleting}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-500 transition-colors">
                            {allSelected
                              ? <CheckSquare className="w-4 h-4 text-blue-500" />
                              : someSelected
                                ? <CheckSquare className="w-4 h-4 text-slate-400" />
                                : <Square className="w-4 h-4" />
                            }
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Session</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.map((r, i) => {
                        const dt = new Date(r.submitted_at);
                        const checked = selectedIds.has(r.id);
                        return (
                          <tr key={r.id} className={`transition-colors ${checked ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3.5 w-10">
                              <button onClick={() => toggleSelect(r.id)} className="text-slate-300 hover:text-blue-500 transition-colors">
                                {checked
                                  ? <CheckSquare className="w-4 h-4 text-blue-500" />
                                  : <Square className="w-4 h-4" />
                                }
                              </button>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-400">{i + 1}</td>
                            <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{r.teacher_name}</td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                                {r.session_name}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">
                              {dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-slate-600">
                              {dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => deleteRecord(r.id)}
                                disabled={deleting}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
