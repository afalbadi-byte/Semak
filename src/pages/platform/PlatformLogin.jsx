import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../lib/api/client';
import { Lock, Mail, RefreshCw, LayoutDashboard } from 'lucide-react';

export default function PlatformLogin() {
  const { setPlatformUser } = useContext(AppContext);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}?action=platform_login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setPlatformUser(data.token);
        window.location.href = '/platform/dashboard';
      } else {
        setError(data.message || 'بيانات الدخول غير صحيحة');
      }
    } catch {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="ltr"
      className="min-h-screen flex items-center justify-center bg-slate-950"
      style={{ backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(197,160,89,0.08) 0%, transparent 60%)' }}
    >
      {/* شبكة خلفية رقيقة */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#c5a059 1px, transparent 1px), linear-gradient(90deg, #c5a059 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* لوجو */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#c5a059]/10 border border-[#c5a059]/20 mb-4">
            <LayoutDashboard size={28} className="text-[#c5a059]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Semak Platform</h1>
          <p className="text-slate-500 text-sm mt-1">Platform administration · Internal only</p>
        </div>

        {/* بطاقة الدخول */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 rounded-lg pl-9 pr-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition"
                  placeholder="platform@semak.sa"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 rounded-lg pl-9 pr-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm tracking-wide"
            >
              {loading
                ? <><RefreshCw size={15} className="animate-spin" /> Authenticating…</>
                : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Semak Accounting Platform · Restricted access
        </p>
      </div>
    </div>
  );
}
