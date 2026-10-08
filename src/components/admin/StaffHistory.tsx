import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  CheckCircle2,
  Clock3,
  History,
  UserCheck,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { supabase, AttendanceRecord, Session, Teacher } from '../../lib/supabase';

type Period = 'daily' | 'monthly' | 'yearly' | 'custom';
type HistoryPoint = {
  key: string;
  label: string;
  dateLabel: string;
  present: boolean;
  submittedAt: string | null;
};

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateValue(date);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRange(
  period: Period,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: string,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  if (period === 'daily') return { start: selectedDate, end: selectedDate };
  if (period === 'monthly') {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return { start: `${selectedMonth}-01`, end: `${selectedMonth}-${String(lastDay).padStart(2, '0')}` };
  }
  if (period === 'yearly') return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
  return { start: customStart, end: customEnd };
}

function makePoints(range: { start: string; end: string }, period: Period, records: AttendanceRecord[]): HistoryPoint[] {
  const start = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const useMonths = period === 'yearly' || (period === 'custom' && days > 62);
  const points: HistoryPoint[] = [];

  if (useMonths) {
    const cursor = new Date(start);
    cursor.setDate(1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const monthRecords = records.filter(record => record.submitted_at.slice(0, 7) === key);
      points.push({
        key,
        label: cursor.toLocaleDateString('en-US', { month: 'short' }),
        dateLabel: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        present: monthRecords.length > 0,
        submittedAt: monthRecords[0]?.submitted_at ?? null,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }

  let cursor = new Date(start);
  while (cursor <= end) {
    const key = localDateValue(cursor);
    const dayRecord = records.find(record => record.submitted_at.slice(0, 10) === key);
    points.push({
      key,
      label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateLabel: formatDate(key),
      present: Boolean(dayRecord),
      submittedAt: dayRecord?.submitted_at ?? null,
    });
    cursor = new Date(`${addDays(key, 1)}T12:00:00`);
  }
  return points;
}

export default function StaffHistory() {
  const today = localDateValue(new Date());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [staffId, setStaffId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [customStart, setCustomStart] = useState(`${today.slice(0, 4)}-01-01`);
  const [customEnd, setCustomEnd] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('teachers').select('*').order('sort_order'),
      supabase.from('sessions').select('*').order('sort_order'),
    ]).then(([teacherResult, sessionResult]) => {
      if (teacherResult.error || sessionResult.error) {
        setError('Unable to load staff and session choices.');
      } else {
        const loadedTeachers = teacherResult.data ?? [];
        const loadedSessions = sessionResult.data ?? [];
        setTeachers(loadedTeachers);
        setSessions(loadedSessions);
        setStaffId(loadedTeachers[0]?.id ?? '');
        setSessionId(loadedSessions[0]?.id ?? '');
      }
      setLoadingOptions(false);
    });
  }, []);

  const selectedTeacher = teachers.find(teacher => teacher.id === staffId);
  const selectedSession = sessions.find(session => session.id === sessionId);
  const range = useMemo(
    () => getRange(period, selectedDate, selectedMonth, selectedYear, customStart, customEnd),
    [period, selectedDate, selectedMonth, selectedYear, customStart, customEnd],
  );

  useEffect(() => {
    if (!selectedTeacher || !selectedSession || range.start > range.end) {
      setRecords([]);
      return;
    }

    let cancelled = false;
    setLoadingRecords(true);
    setError('');
    supabase
      .from('attendance')
      .select('*')
      .eq('teacher_name', selectedTeacher.name)
      .eq('session_name', selectedSession.name)
      .gte('submitted_at', `${range.start}T00:00:00`)
      .lte('submitted_at', `${range.end}T23:59:59`)
      .order('submitted_at', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError('Unable to load this attendance history.');
        else setRecords(data ?? []);
        setLoadingRecords(false);
      });

    return () => { cancelled = true; };
  }, [range, selectedSession, selectedTeacher]);

  const points = useMemo(() => makePoints(range, period, records), [range, period, records]);
  const presentDays = points.filter(point => point.present).length;
  const absentDays = Math.max(points.length - presentDays, 0);
  const attendanceRate = points.length > 0 ? Math.round((presentDays / points.length) * 100) : 0;
  const periodTitle = period === 'yearly' || (period === 'custom' && points.length <= 14) ? 'Attendance trend' : 'Attendance history';

  function setPeriodAndReset(nextPeriod: Period) {
    setPeriod(nextPeriod);
    if (nextPeriod === 'custom' && customStart > customEnd) setCustomEnd(customStart);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <History className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Staff Attendance History</h2>
          <p className="text-sm text-slate-500 mt-1">Choose one staff member and session to review attendance over time.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"><UserRound className="w-3.5 h-3.5" /> Staff member</span>
            <select value={staffId} onChange={event => setStaffId(event.target.value)} disabled={loadingOptions} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"><Users className="w-3.5 h-3.5" /> Session</span>
            <select value={sessionId} onChange={event => setSessionId(event.target.value)} disabled={loadingOptions} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">View by</span>
          {([['daily', 'Daily'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['custom', 'Custom range']] as const).map(([value, label]) => (
            <button key={value} onClick={() => setPeriodAndReset(value)} className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${period === value ? 'bg-blue-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {period === 'daily' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4 text-blue-600" /><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>}
          {period === 'monthly' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4 text-blue-600" /><input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>}
          {period === 'yearly' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4 text-blue-600" /><input type="number" min="2000" max="2099" value={selectedYear} onChange={event => setSelectedYear(event.target.value)} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>}
          {period === 'custom' && <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarRange className="w-4 h-4 text-blue-600" /><input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label><span className="text-slate-400">to</span><input type="date" value={customEnd} min={customStart} onChange={event => setCustomEnd(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
          <span className="text-xs text-slate-400">{range.start} – {range.end}</span>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      {!selectedTeacher || !selectedSession ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">Select a staff member and session to generate the report.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold">{selectedTeacher.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div>
            <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{selectedTeacher.name}</p><p className="text-xs text-blue-700 truncate">{selectedSession.name} · {formatDate(range.start)}{range.start !== range.end ? ` to ${formatDate(range.end)}` : ''}</p></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Present</p><p className="text-2xl font-bold text-emerald-800 mt-1">{presentDays}</p><p className="text-xs text-emerald-600 mt-1">recorded periods</p></div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-rose-700">Absent</p><p className="text-2xl font-bold text-rose-800 mt-1">{absentDays}</p><p className="text-xs text-rose-600 mt-1">no attendance record</p></div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Attendance</p><p className="text-2xl font-bold text-blue-800 mt-1">{attendanceRate}%</p><p className="text-xs text-blue-600 mt-1">of selected periods</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Total periods</p><p className="text-2xl font-bold text-slate-800 mt-1">{points.length}</p><p className="text-xs text-slate-500 mt-1">in this range</p></div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-5"><div><h3 className="font-bold text-slate-800">{periodTitle}</h3><p className="text-xs text-slate-500 mt-1">{loadingRecords ? 'Updating report…' : `${presentDays} present of ${points.length} selected periods`}</p></div><Clock3 className="w-5 h-5 text-blue-600" /></div>
              {loadingRecords ? <div className="h-52 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" /></div> : points.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-slate-400">No dates in this range.</div> : <div className="overflow-x-auto"><div className="min-w-[560px]"><div className="relative h-52 border-l border-b border-slate-200 bg-gradient-to-b from-blue-50/60 to-white"><div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" /><div className="absolute left-2 top-1 text-[10px] font-semibold text-slate-400">100%</div><div className="absolute left-2 top-[48%] text-[10px] font-semibold text-slate-400">50%</div><div className="absolute left-2 bottom-1 text-[10px] font-semibold text-slate-400">0%</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pl-10 pr-2 py-4"><polyline fill="rgba(37,99,235,0.12)" stroke="none" points={`0,100 ${points.map((point, index) => `${points.length === 1 ? 50 : (index / (points.length - 1)) * 100},${point.present ? 4 : 96}`).join(' ')} 100,100`} /><polyline fill="none" stroke="#2563eb" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={points.map((point, index) => `${points.length === 1 ? 50 : (index / (points.length - 1)) * 100},${point.present ? 4 : 96}`).join(' ')} /></svg>{points.map((point, index) => <span key={point.key} className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 ${point.present ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ left: `${points.length === 1 ? 50 : 8 + (index / (points.length - 1)) * 88}%`, top: point.present ? '8%' : '92%' }} title={`${point.dateLabel}: ${point.present ? 'Present' : 'Absent'}`} />)}</div><div className="flex justify-between gap-2 pl-10 pr-2 pt-2 text-[10px] font-semibold text-slate-500">{points.filter((_, index) => points.length <= 8 || index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0).map(point => <span key={point.key} className="whitespace-nowrap">{point.label}</span>)}</div></div></div>}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-slate-800">Attendance by period</h3><p className="text-xs text-slate-500 mt-1">Present and absent status</p></div><UserCheck className="w-5 h-5 text-emerald-600" /></div><div className="space-y-3 max-h-64 overflow-y-auto pr-1">{points.map(point => <div key={point.key}><div className="flex justify-between gap-2 text-xs mb-1"><span className="font-semibold text-slate-600 truncate">{point.dateLabel}</span><span className={point.present ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>{point.present ? 'Present' : 'Absent'}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full transition-all ${point.present ? 'bg-emerald-500 w-full' : 'bg-rose-400 w-1/4'}`} /></div></div>)}</div></div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-800">Detailed attendance</h3><p className="text-xs text-slate-500 mt-1">One status for each selected date or reporting period.</p></div><span className="text-xs font-semibold text-slate-400">{points.length} rows</span></div>{points.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No attendance dates found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="bg-slate-50"><tr><th className="text-left px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Period</th><th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th><th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Submitted time</th><th className="text-right px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Result</th></tr></thead><tbody className="divide-y divide-slate-100">{points.map(point => <tr key={point.key} className="hover:bg-slate-50"><td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-slate-800">{point.dateLabel}</td><td className="px-4 py-3.5">{point.present ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Present</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600"><XCircle className="w-3.5 h-3.5" /> Absent</span>}</td><td className="px-4 py-3.5 text-sm text-slate-500">{point.submittedAt ? new Date(point.submittedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td className="px-4 sm:px-6 py-3.5 text-right text-xs font-semibold text-slate-400">{point.present ? 'Attendance found' : 'No record found'}</td></tr>)}</tbody></table></div>}</div>
        </>
      )}
    </div>
  );
}
