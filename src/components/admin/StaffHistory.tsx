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

type Period = 'monthly' | 'yearly' | 'custom';
type ReportMode = 'all' | 'staff';

type DateSummary = {
  present: number;
  absent: number;
  total: number;
};

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRange(
  period: Period,
  selectedMonth: string,
  selectedYear: string,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  if (period === 'monthly') {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${selectedMonth}-01`,
      end: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (period === 'yearly') {
    return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
  }

  return { start: customStart, end: customEnd };
}

function uniqueNames(records: AttendanceRecord[]): Set<string> {
  return new Set(records.map(record => record.teacher_name));
}

export default function StaffHistory() {
  const today = localDateValue(new Date());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [latestSessionDates, setLatestSessionDates] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState('');
  const [reportMode, setReportMode] = useState<ReportMode>('all');
  const [staffId, setStaffId] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [customStart, setCustomStart] = useState(`${today.slice(0, 4)}-01-01`);
  const [customEnd, setCustomEnd] = useState(today);
  const [selectedDate, setSelectedDate] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState('');

  const range = useMemo(
    () => getRange(period, selectedMonth, selectedYear, customStart, customEnd),
    [period, selectedMonth, selectedYear, customStart, customEnd],
  );

  useEffect(() => {
    Promise.all([
      supabase.from('teachers').select('*').order('sort_order'),
      supabase.from('sessions').select('*').order('sort_order'),
      supabase.from('attendance').select('session_name, submitted_at').order('submitted_at', { ascending: false }),
    ]).then(([teacherResult, sessionResult, attendanceResult]) => {
      if (teacherResult.error || sessionResult.error || attendanceResult.error) {
        setError('Unable to load staff and session choices.');
      } else {
        const loadedTeachers = teacherResult.data ?? [];
        const loadedSessions = sessionResult.data ?? [];
        const activity = attendanceResult.data ?? [];
        const latestDates: Record<string, string> = {};
        activity.forEach(record => {
          if (!latestDates[record.session_name]) latestDates[record.session_name] = record.submitted_at;
        });
        const knownNames = new Set(loadedSessions.map(session => session.name));
        const historicalSessions: Session[] = Object.keys(latestDates)
          .filter(name => !knownNames.has(name))
          .map((name, index) => ({
            id: `historical-${index}-${name}`,
            name,
            active: false,
            sort_order: loadedSessions.length + index,
            created_at: latestDates[name],
          }));
        const allSessions = [...loadedSessions, ...historicalSessions];
        const initialSession = allSessions[0];
        setTeachers(loadedTeachers);
        setSessions(allSessions);
        setLatestSessionDates(latestDates);
        setSessionId(initialSession?.id ?? '');
        setStaffId(loadedTeachers[0]?.id ?? '');
        const latestDate = initialSession ? latestDates[initialSession.name] : undefined;
        if (latestDate) {
          setSelectedMonth(latestDate.slice(0, 7));
          setSelectedYear(latestDate.slice(0, 4));
        }
      }
      setLoadingOptions(false);
    });
  }, []);

  const selectedSession = sessions.find(session => session.id === sessionId);
  const selectedTeacher = teachers.find(teacher => teacher.id === staffId);

  function chooseSession(nextSessionId: string) {
    setSessionId(nextSessionId);
    setSelectedDate('');
    const nextSession = sessions.find(session => session.id === nextSessionId);
    const latestDate = nextSession ? latestSessionDates[nextSession.name] : undefined;
    if (latestDate) {
      setSelectedMonth(latestDate.slice(0, 7));
      setSelectedYear(latestDate.slice(0, 4));
    }
  }

  useEffect(() => {
    if (!selectedSession || range.start > range.end) {
      setRecords([]);
      setSelectedDate('');
      return;
    }

    let cancelled = false;
    setLoadingRecords(true);
    setError('');
    supabase
      .from('attendance')
      .select('*')
      .eq('session_name', selectedSession.name)
      .gte('submitted_at', `${range.start}T00:00:00`)
      .lte('submitted_at', `${range.end}T23:59:59`)
      .order('submitted_at', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError('Unable to load this session history.');
          setRecords([]);
        } else {
          setRecords(data ?? []);
        }
        setLoadingRecords(false);
      });

    return () => { cancelled = true; };
  }, [range, selectedSession]);

  const meetingDates = useMemo(
    () => Array.from(new Set(records.map(record => record.submitted_at.slice(0, 10)))).sort(),
    [records],
  );

  useEffect(() => {
    if (meetingDates.length === 0) {
      setSelectedDate('');
    } else if (!meetingDates.includes(selectedDate)) {
      setSelectedDate(meetingDates[0]);
    }
  }, [meetingDates, selectedDate]);

  const staffRecords = useMemo(
    () => reportMode === 'staff' && selectedTeacher
      ? records.filter(record => record.teacher_name === selectedTeacher.name)
      : records,
    [records, reportMode, selectedTeacher],
  );

  const rangeSummary = useMemo<DateSummary>(() => {
    if (reportMode === 'staff') {
      const present = new Set(
        staffRecords.map(record => record.submitted_at.slice(0, 10)),
      ).size;
      return { present, absent: Math.max(meetingDates.length - present, 0), total: meetingDates.length };
    }

    const present = new Set(
      records.map(record => `${record.teacher_name}|${record.submitted_at.slice(0, 10)}`),
    ).size;
    const total = teachers.length * meetingDates.length;
    return { present, absent: Math.max(total - present, 0), total };
  }, [meetingDates, records, reportMode, staffRecords, teachers.length]);

  const selectedDateSummary = useMemo<DateSummary>(() => {
    if (!selectedDate) return { present: 0, absent: 0, total: 0 };

    if (reportMode === 'staff') {
      const present = staffRecords.some(record => record.submitted_at.slice(0, 10) === selectedDate) ? 1 : 0;
      return { present, absent: 1 - present, total: 1 };
    }

    const present = uniqueNames(
      records.filter(record => record.submitted_at.slice(0, 10) === selectedDate),
    ).size;
    return { present, absent: Math.max(teachers.length - present, 0), total: teachers.length };
  }, [records, reportMode, selectedDate, staffRecords, teachers.length]);

  const visibleRecords = useMemo(
    () => staffRecords.filter(record => !selectedDate || record.submitted_at.slice(0, 10) === selectedDate),
    [selectedDate, staffRecords],
  );

  function setPeriodAndReset(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setSelectedDate('');
    if (nextPeriod === 'custom' && customStart > customEnd) setCustomEnd(customStart);
  }

  const summary = selectedDate ? selectedDateSummary : rangeSummary;
  const summaryLabel = selectedDate
    ? `Selected date · ${formatDate(selectedDate)}`
    : `${period === 'monthly' ? 'Month' : period === 'yearly' ? 'Year' : 'Custom range'} summary`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <History className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Staff Attendance History</h2>
          <p className="text-sm text-slate-500 mt-1">Choose a session first, then review meeting dates and attendance summaries.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"><Users className="w-3.5 h-3.5" /> Session</span>
            <select value={sessionId} onChange={event => chooseSession(event.target.value)} disabled={loadingOptions} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
            </select>
            {selectedSession && <p className="text-xs text-slate-400 mt-1.5">{latestSessionDates[selectedSession.name] ? `Latest attendance: ${formatDate(latestSessionDates[selectedSession.name].slice(0, 10))}` : 'No attendance records yet'}</p>}
          </label>
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"><UserRound className="w-3.5 h-3.5" /> Report for</span>
            <select value={reportMode} onChange={event => setReportMode(event.target.value as ReportMode)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All staff summary</option>
              <option value="staff">Separate staff history</option>
            </select>
          </label>
        </div>

        {reportMode === 'staff' && (
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"><UserCheck className="w-3.5 h-3.5" /> Staff member</span>
            <select value={staffId} onChange={event => setStaffId(event.target.value)} disabled={loadingOptions} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">View by</span>
          {([['monthly', 'Month'], ['yearly', 'Year'], ['custom', 'Custom range']] as const).map(([value, label]) => (
            <button key={value} onClick={() => setPeriodAndReset(value)} className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${period === value ? 'bg-blue-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {period === 'monthly' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4 text-blue-600" /><input type="month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setSelectedDate(''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>}
          {period === 'yearly' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Calendar className="w-4 h-4 text-blue-600" /><input type="number" min="2000" max="2099" value={selectedYear} onChange={event => { setSelectedYear(event.target.value); setSelectedDate(''); }} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>}
          {period === 'custom' && <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarRange className="w-4 h-4 text-blue-600" /><input type="date" value={customStart} max={customEnd} onChange={event => { setCustomStart(event.target.value); setSelectedDate(''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label><span className="text-slate-400">to</span><input type="date" value={customEnd} min={customStart} onChange={event => { setCustomEnd(event.target.value); setSelectedDate(''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
          <span className="text-xs text-slate-400">{range.start} – {range.end}</span>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><h3 className="font-bold text-slate-800">Meeting dates</h3><p className="text-xs text-slate-500 mt-1">Only dates with attendance activity for this session are shown.</p></div>
          <Clock3 className="w-5 h-5 text-blue-600" />
        </div>
        {loadingRecords ? <div className="h-16 flex items-center justify-center"><div className="w-7 h-7 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" /></div> : meetingDates.length === 0 ? <p className="text-sm text-slate-400 py-4">No meetings found in this period.</p> : <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">{meetingDates.map(date => <button key={date} onClick={() => setSelectedDate(date)} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${selectedDate === date ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>{formatDate(date)}</button>)}</div>}
      </div>

      {!selectedSession ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">Select a session to generate the report.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold">{reportMode === 'staff' && selectedTeacher ? selectedTeacher.name.split(' ').map(part => part[0]).slice(0, 2).join('') : 'ALL'}</div>
            <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{reportMode === 'staff' && selectedTeacher ? selectedTeacher.name : 'All staff'}</p><p className="text-xs text-blue-700 truncate">{selectedSession.name} · {summaryLabel}</p></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Present</p><p className="text-2xl font-bold text-emerald-800 mt-1">{summary.present}</p><p className="text-xs text-emerald-600 mt-1">{selectedDate ? 'on this date' : 'across meeting dates'}</p></div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-rose-700">Absent</p><p className="text-2xl font-bold text-rose-800 mt-1">{summary.absent}</p><p className="text-xs text-rose-600 mt-1">{selectedDate ? 'on this date' : 'across meeting dates'}</p></div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Attendance</p><p className="text-2xl font-bold text-blue-800 mt-1">{summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0}%</p><p className="text-xs text-blue-600 mt-1">of expected attendance</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Meeting dates</p><p className="text-2xl font-bold text-slate-800 mt-1">{meetingDates.length}</p><p className="text-xs text-slate-500 mt-1">found in this range</p></div>
          </div>

          {selectedDate && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-800">Attendance on {formatDate(selectedDate)}</h3><p className="text-xs text-slate-500 mt-1">Present and absent staff for the selected meeting date.</p></div><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="bg-slate-50"><tr><th className="text-left px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Staff member</th><th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th><th className="text-right px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Submitted time</th></tr></thead><tbody className="divide-y divide-slate-100">{(reportMode === 'staff' && selectedTeacher ? [selectedTeacher] : teachers).map(teacher => { const record = records.find(item => item.teacher_name === teacher.name && item.submitted_at.slice(0, 10) === selectedDate); return <tr key={teacher.id} className="hover:bg-slate-50"><td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-slate-800">{teacher.name}</td><td className="px-4 py-3.5">{record ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Present</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600"><XCircle className="w-3.5 h-3.5" /> Absent</span>}</td><td className="px-4 sm:px-6 py-3.5 text-right text-sm text-slate-500">{record ? formatTime(record.submitted_at) : '—'}</td></tr>; })}</tbody></table></div>
            </div>
          )}

          {!selectedDate && <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Select a meeting date above to see the full attendance summary for that date.</div>}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-4 sm:px-6 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-800">Attendance records in this range</h3><p className="text-xs text-slate-500 mt-1">{visibleRecords.length} submission{visibleRecords.length === 1 ? '' : 's'} found for the selected view.</p></div>{visibleRecords.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No attendance records found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="bg-slate-50"><tr><th className="text-left px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Staff member</th><th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th><th className="text-right px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Submitted time</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRecords.map(record => <tr key={record.id} className="hover:bg-slate-50"><td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-slate-800">{record.teacher_name}</td><td className="px-4 py-3.5 text-sm text-slate-600">{formatDate(record.submitted_at.slice(0, 10))}</td><td className="px-4 sm:px-6 py-3.5 text-right text-sm text-slate-500">{formatTime(record.submitted_at)}</td></tr>)}</tbody></table></div>}</div>
        </>
      )}
    </div>
  );
}
