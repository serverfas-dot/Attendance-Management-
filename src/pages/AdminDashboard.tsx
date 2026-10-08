import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, List, Settings, Clock, Database, History,
  LogOut, Calendar, ChevronRight, Menu, X, MapPin
} from 'lucide-react';
import { supabase, AdminSettings, logoSrc } from '../lib/supabase';
import RecordsView from '../components/admin/RecordsView';
import FormSettings from '../components/admin/FormSettings';
import TeachersManager from '../components/admin/TeachersManager';
import SessionsManager from '../components/admin/SessionsManager';
import TimeSettings from '../components/admin/TimeSettings';
import LocationSettings from '../components/admin/LocationSettings';
import BackupRestore from '../components/admin/BackupRestore';
import StaffHistory from '../components/admin/StaffHistory';

type Tab = 'records' | 'staff-history' | 'form' | 'teachers' | 'sessions' | 'time' | 'location' | 'backup';

interface Props {
  onLogout: () => void;
}

const navItems: { id: Tab; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: 'records', label: 'Records', icon: <BarChart3 className="w-4 h-4" />, sub: 'Daily, Monthly, Yearly' },
  { id: 'staff-history', label: 'Staff History', icon: <History className="w-4 h-4" />, sub: 'Individual attendance reports' },
  { id: 'form', label: 'Form Settings', icon: <Settings className="w-4 h-4" />, sub: 'Heading, fields, open/close' },
  { id: 'teachers', label: 'Teachers', icon: <Users className="w-4 h-4" />, sub: 'Manage teacher names' },
  { id: 'sessions', label: 'Sessions', icon: <List className="w-4 h-4" />, sub: 'Manage session types' },
  { id: 'time', label: 'Time Restriction', icon: <Clock className="w-4 h-4" />, sub: 'Set form open/close time' },
  { id: 'location', label: 'Location Restriction', icon: <MapPin className="w-4 h-4" />, sub: 'GPS radius for submission' },
  { id: 'backup', label: 'Backup & Restore', icon: <Database className="w-4 h-4" />, sub: 'Export and import data' },
];

export default function AdminDashboard({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('id, form_heading, form_subheading, form_open, form_start_time, form_end_time, use_time_restriction, location_enabled, location_lat, location_lng, location_radius_meters, location_name, admin_username, updated_at')
      .eq('id', 1)
      .single();
    if (data) setSettings(data);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function handleLogout() {
    sessionStorage.removeItem('admin_auth');
    onLogout();
  }

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  const activeNav = navItems.find(n => n.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col
        h-screen lg:h-screen transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar header */}
        <div className="px-5 py-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="School logo" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Attendance</p>
              <p className="text-slate-400 text-xs">Admin Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form status */}
        {settings && (
          <div className="px-4 py-3 border-b border-slate-700">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
              settings.form_open ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${settings.form_open ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              Form is {settings.form_open ? 'Open' : 'Closed'}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => selectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeTab === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className="text-xs text-slate-500 leading-tight truncate">{item.sub}</p>
              </div>
              {activeTab === item.id && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-rose-400 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">{activeNav?.label}</h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">{activeNav?.sub}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <span className="sm:hidden">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {activeTab === 'records' && <RecordsView />}
          {activeTab === 'staff-history' && <StaffHistory />}
          {activeTab === 'form' && <FormSettings settings={settings} onUpdate={loadSettings} />}
          {activeTab === 'teachers' && <TeachersManager />}
          {activeTab === 'sessions' && <SessionsManager />}
          {activeTab === 'time' && <TimeSettings settings={settings} onUpdate={loadSettings} />}
          {activeTab === 'location' && <LocationSettings settings={settings} onUpdate={loadSettings} />}
          {activeTab === 'backup' && <BackupRestore />}
        </main>
      </div>
    </div>
  );
}
