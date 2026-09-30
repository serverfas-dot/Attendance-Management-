import { useState, useEffect } from 'react';
import PublicForm from './pages/PublicForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

type View = 'form' | 'admin-login' | 'admin-dashboard';

function currentView(): View {
  const hash = window.location.hash.replace(/^#/, '');
  const isAuth = sessionStorage.getItem('admin_auth') === 'true';
  if (hash.startsWith('/admin')) {
    return isAuth ? 'admin-dashboard' : 'admin-login';
  }
  return 'form';
}

function navigate(hash: string) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

export default function App() {
  const [view, setView] = useState<View>(currentView);

  useEffect(() => {
    function onHashChange() { setView(currentView()); }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      {view === 'form' && <PublicForm />}
      {view === 'admin-login' && (
        <AdminLogin
          onLogin={() => { setView('admin-dashboard'); navigate('/admin'); }}
          onBack={() => { setView('form'); navigate('/'); }}
        />
      )}
      {view === 'admin-dashboard' && (
        <AdminDashboard onLogout={() => { setView('admin-login'); navigate('/admin'); }} />
      )}

      {view === 'form' && (
        <div className="fixed bottom-4 right-4">
          <a
            href="#/admin"
            className="text-xs text-white/30 hover:text-white/60 transition-colors select-none"
          >
            Admin
          </a>
        </div>
      )}
    </>
  );
}
