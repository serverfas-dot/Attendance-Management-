import { useState, useEffect } from 'react';
import { supabase, AdminSettings, changeAdminCredentials } from '../../lib/supabase';
import { Save, ToggleLeft, ToggleRight, Eye, KeyRound, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  settings: AdminSettings | null;
  onUpdate: () => void;
}

export default function FormSettings({ settings, onUpdate }: Props) {
  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');
  const [formOpen, setFormOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setHeading(settings.form_heading);
      setSubheading(settings.form_subheading);
      setFormOpen(settings.form_open);
      setAdminUsername(settings.admin_username);
    }
  }, [settings]);

  async function saveFormSettings() {
    setSaving(true);
    await supabase.from('admin_settings').update({
      form_heading: heading,
      form_subheading: subheading,
      form_open: formOpen,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  }

  async function saveCredentials() {
    setCredsMsg(null);

    if (!adminUsername.trim()) {
      setCredsMsg({ type: 'error', text: 'Username cannot be empty.' });
      return;
    }
    if (!currentPassword) {
      setCredsMsg({ type: 'error', text: 'Please enter your current password to confirm changes.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setCredsMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setCredsMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSavingCreds(true);

    try {
      const ok = await changeAdminCredentials(currentPassword, adminUsername.trim(), newPassword);
      setSavingCreds(false);
      if (!ok) {
        setCredsMsg({ type: 'error', text: 'Current password is incorrect.' });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCredsMsg({ type: 'success', text: newPassword ? 'Username and password updated successfully.' : 'Username updated successfully.' });
      setTimeout(() => setCredsMsg(null), 4000);
      onUpdate();
    } catch {
      setSavingCreds(false);
      setCredsMsg({ type: 'error', text: 'Could not update credentials. Please try again.' });
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      {/* Form appearance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Form Appearance</h3>
          <p className="text-xs text-slate-500 mt-0.5">Customize the public form heading and description</p>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Form Heading</label>
            <input
              type="text"
              value={heading}
              onChange={e => setHeading(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Attendance Record"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sub Heading</label>
            <input
              type="text"
              value={subheading}
              onChange={e => setSubheading(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Please sign in your attendance below"
            />
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">Form Status</p>
              <p className="text-xs text-slate-500 mt-0.5">Allow or block new submissions</p>
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

          <button
            onClick={saveFormSettings}
            disabled={saving}
            className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
            } disabled:opacity-60`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800">Form Preview</h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-5 py-5 text-center">
            <h1 className="text-base sm:text-lg font-bold text-white">{heading || 'Attendance Record'}</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">{subheading || 'Please sign in your attendance below'}</p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${formOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="text-xs text-slate-400">{formOpen ? 'Form is accepting submissions' : 'Form is closed'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin credentials */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-800">Change Login Credentials</h3>
            <p className="text-xs text-slate-500 mt-0.5">Current password is required to make any changes</p>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              value={adminUsername}
              onChange={e => setAdminUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Current password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Enter current password to confirm"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">New Password (optional)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="Min. 6 characters"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength indicator */}
                {newPassword.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${
                          newPassword.length >= n * 3
                            ? newPassword.length >= 12 ? 'bg-emerald-500'
                              : newPassword.length >= 9 ? 'bg-blue-500'
                              : newPassword.length >= 6 ? 'bg-amber-400'
                              : 'bg-rose-400'
                            : 'bg-slate-200'
                        }`} />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">
                      {newPassword.length < 6 ? 'Too short' : newPassword.length < 9 ? 'Weak' : newPassword.length < 12 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 transition-all ${
                      confirmPassword && newPassword !== confirmPassword
                        ? 'border-rose-300 focus:ring-rose-200'
                        : confirmPassword && newPassword === confirmPassword
                        ? 'border-emerald-300 focus:ring-emerald-200'
                        : 'border-slate-200 focus:ring-slate-300'
                    }`}
                    placeholder="Re-enter new password"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1">Passwords do not match</p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>
            </div>
          </div>

          {credsMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
              credsMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              {credsMsg.type === 'success'
                ? <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              }
              {credsMsg.text}
            </div>
          )}

          <button
            onClick={saveCredentials}
            disabled={savingCreds}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-60"
          >
            <KeyRound className="w-4 h-4" />
            {savingCreds ? 'Verifying...' : 'Update Credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}
