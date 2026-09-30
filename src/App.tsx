import { useState, useEffect } from 'react';
import PublicForm from './pages/PublicForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

type View = 'form' | 'admin-login' | 'admin-dashboard';

export default function App() {
  const [view, setView] = useState<View>('form');

  useEffect(() => {
    const path = window.location.pathname;
    const isAuth = sessionStorage.getItem('admin_auth') === 'true';
    if (path.startsWith('/admin')) {
      setView(isAuth ? 'admin-dashboard' : 'admin-login');
    } else {
      setView('form');
    }
  }, []);

  // Listen for hash/path changes
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (href === '/admin') {
        e.preventDefault();
        const isAuth = sessionStorage.getItem('admin_auth') === 'true';
        setView(isAuth ? 'admin-dashboard' : 'admin-login');
        window.history.pushState({}, '', '/admin');
      } else if (href === '/') {
        e.preventDefault();
        setView('form');
        window.history.pushState({}, '', '/');
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <>
      {view === 'form' && <PublicForm />}
      {view === 'admin-login' && (
        <AdminLogin
          onLogin={() => { setView('admin-dashboard'); window.history.pushState({}, '', '/admin'); }}
          onBack={() => { setView('form'); window.history.pushState({}, '', '/'); }}
        />
      )}
      {view === 'admin-dashboard' && (
        <AdminDashboard onLogout={() => { setView('admin-login'); window.history.pushState({}, '', '/admin'); }} />
      )}

      {/* Admin access link - subtle footer on public form */}
      {view === 'form' && (
        <div className="fixed bottom-4 right-4">
          <a
            href="/admin"
            className="text-xs text-white/30 hover:text-white/60 transition-colors select-none"
          >
            Admin
          </a>
        </div>
      )}
    </>
  );
}
