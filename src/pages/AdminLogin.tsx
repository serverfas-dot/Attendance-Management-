import { useState } from 'react';
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { verifyAdminLogin, logoSrc } from '../lib/supabase';

interface Props {
  onLogin: () => void;
  onBack: () => void;
}

export default function AdminLogin({ onLogin, onBack }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await verifyAdminLogin(username, password);
      setLoading(false);
      if (ok) {
        sessionStorage.setItem('admin_auth', 'true');
        onLogin();
      } else {
        setError('Invalid username or password.');
      }
    } catch {
      setLoading(false);
      setError('Unable to connect. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Form
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 sm:px-8 py-8 sm:py-10 text-center">
            <img src={logoSrc} alt="School logo" className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-contain bg-white/10 p-1.5 mb-4 mx-auto" />
            <h1 className="text-lg sm:text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Attendance Record System</p>
          </div>

          <div className="px-6 sm:px-8 py-6 sm:py-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-semibold hover:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
