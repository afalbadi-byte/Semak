import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, RefreshCw, ArrowRight, ShieldCheck, Mail, MessageCircle, KeyRound } from 'lucide-react';

import { API_URL } from '../../lib/api/client';

const DEVICE_KEY = 'semak_device_token';

export default function AdminLogin({ setUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── حالة التحقق بخطوتين ──
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [otp, setOtp] = useState(null);       // { ticket, channel, masked_email, masked_phone, has_email, has_phone }
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem("semak_admin_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => { if (step === 'otp' && codeRef.current) codeRef.current.focus(); }, [step]);

  const toast = (t, m, k) => { if (showToast) showToast(t, m, k); else if (k === 'error') alert(m); };

  // ── إنهاء الدخول وتخزين الجلسة والتحويل ──
  const finalizeLogin = (userData) => {
    if (rememberMe) localStorage.setItem("semak_admin_email", email);
    else localStorage.removeItem("semak_admin_email");

    localStorage.setItem("semak_current_user", JSON.stringify(userData));
    if (setUser) setUser(userData);
    toast("تم تسجيل الدخول", `مرحباً بك، ${userData.name}`);

    if (userData.role === "technician") window.location.href = "/tech-dashboard";
    else window.location.href = "/admin/dashboard";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const device_token = localStorage.getItem(DEVICE_KEY) || undefined;
      const res = await fetch(`${API_URL}?action=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, device_token })
      });
      const data = await res.json();

      if (data.otp_required) {
        setOtp({
          ticket: data.ticket,
          channel: data.channel,
          masked_email: data.masked_email,
          masked_phone: data.masked_phone,
          has_email: data.has_email,
          has_phone: data.has_phone,
        });
        setCode("");
        setStep('otp');
        toast("رمز التحقق", data.sent ? "أرسلنا لك رمز الدخول" : "تعذّر إرسال الرمز، جرّب قناة أخرى", data.sent ? undefined : "error");
      } else if (data.success) {
        finalizeLogin(data.data);
      } else {
        toast("خطأ", data.message, "error");
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=verify_login_otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: otp.ticket, code: code.trim(), remember_device: rememberDevice })
      });
      const data = await res.json();
      if (data.success) {
        if (data.device_token) localStorage.setItem(DEVICE_KEY, data.device_token);
        finalizeLogin(data.data);
      } else {
        toast("خطأ", data.message || "الرمز غير صحيح", "error");
        setCode("");
        if (codeRef.current) codeRef.current.focus();
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── إعادة الإرسال أو تبديل القناة (واتساب ⇄ إيميل) ──
  const sendOtp = async (channel) => {
    if (!otp) return;
    setResending(true);
    try {
      const res = await fetch(`${API_URL}?action=login_send_otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: otp.ticket, channel })
      });
      const data = await res.json();
      if (data.success) {
        setOtp(prev => ({ ...prev, channel, masked_email: data.masked_email ?? prev.masked_email, masked_phone: data.masked_phone ?? prev.masked_phone }));
        toast("تم الإرسال", data.sent
          ? (channel === 'whatsapp' ? `أرسلنا الرمز للواتساب ${data.masked_phone || ''}` : `أرسلنا الرمز للبريد ${data.masked_email || ''}`)
          : "تعذّر الإرسال عبر هذه القناة", data.sent ? undefined : "error");
      } else {
        toast("خطأ", data.message || "تعذّر إعادة الإرسال", "error");
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setResending(false);
    }
  };

  const backToLogin = () => { setStep('login'); setOtp(null); setCode(""); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: "url('/images/admin-login-bg.jpg')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="bg-white dark:bg-brand-900 p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 border border-white/20 dark:border-brand-700">
        <img src="/images/logo-main.png" alt="سماك العقارية" className="h-16 mx-auto mb-4 object-contain dark:hidden" />
        <div
          aria-hidden="true"
          className="hidden dark:block w-44 h-16 mx-auto mb-4 bg-gold-500"
          style={{
            WebkitMaskImage: 'url(/images/logo-main.png)',
            maskImage: 'url(/images/logo-main.png)',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />

        {step === 'login' ? (
          <>
            <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">بوابة الموظفين</h2>
            <p className="text-slate-500 dark:text-brand-400 text-sm mt-2 mb-8">تسجيل الدخول للوصول للأدوات الإدارية والفنية</p>
            <form onSubmit={handleLogin} className="space-y-6 text-right">
              <div>
                <label className="block text-sm font-bold mb-2 text-brand-800 dark:text-brand-100">البريد الإلكتروني</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><User size={16} /></span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 transition" placeholder="Email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-brand-800 dark:text-brand-100">كلمة المرور</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><Lock size={16} /></span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 transition" placeholder="••••••••" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-gold-500 cursor-pointer rounded border-slate-300 dark:border-brand-700"/>
                <label htmlFor="rememberMe" className="text-sm text-slate-600 dark:text-brand-300 font-bold cursor-pointer select-none">تذكر بيانات الدخول</label>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-brand-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-gold-500 transition shadow-lg shadow-brand-800/30 mt-4 flex justify-center items-center gap-2">
                {loading ? <RefreshCw className="animate-spin" size={20} /> : "دخول"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gold-500/15 text-gold-500 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">التحقق بخطوتين</h2>
            <p className="text-slate-500 dark:text-brand-400 text-sm mt-2 mb-1">
              {otp?.channel === 'whatsapp'
                ? <>أدخل الرمز المُرسَل واتساب إلى <span dir="ltr" className="font-bold">{otp?.masked_phone}</span></>
                : <>أدخل الرمز المُرسَل بريديًا إلى <span dir="ltr" className="font-bold">{otp?.masked_email}</span></>}
            </p>
            <p className="text-slate-400 dark:text-brand-500 text-xs mb-6">الرمز صالح لمدة 10 دقائق</p>

            <form onSubmit={handleVerify} className="space-y-5 text-right">
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><KeyRound size={16} /></span>
                <input
                  ref={codeRef}
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 text-center text-2xl font-black tracking-[0.5em] transition"
                  placeholder="● ● ● ● ● ●"
                />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="rememberDevice" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} className="w-4 h-4 accent-gold-500 cursor-pointer rounded border-slate-300 dark:border-brand-700"/>
                <label htmlFor="rememberDevice" className="text-sm text-slate-600 dark:text-brand-300 font-bold cursor-pointer select-none">الوثوق بهذا الجهاز لمدة 30 يومًا</label>
              </div>

              <button type="submit" disabled={otpLoading || code.length < 4} className="w-full bg-brand-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-gold-500 transition shadow-lg shadow-brand-800/30 flex justify-center items-center gap-2 disabled:opacity-50">
                {otpLoading ? <RefreshCw className="animate-spin" size={20} /> : "تأكيد الدخول"}
              </button>
            </form>

            {/* خيارات القنوات وإعادة الإرسال */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-brand-700">
              <p className="text-xs font-bold text-slate-400 dark:text-brand-500 mb-3">لم يصلك الرمز؟ أعد الإرسال أو غيّر القناة</p>
              <div className="flex gap-2">
                {otp?.has_email && (
                  <button type="button" disabled={resending} onClick={() => sendOtp('email')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${otp?.channel === 'email' ? 'bg-brand-800 text-white border-brand-800' : 'bg-white dark:bg-brand-800 text-brand-800 dark:text-brand-100 border-slate-200 dark:border-brand-700 hover:border-gold-500'}`}>
                    <Mail size={15} /> إيميل
                  </button>
                )}
                {otp?.has_phone && (
                  <button type="button" disabled={resending} onClick={() => sendOtp('whatsapp')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${otp?.channel === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-brand-800 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-brand-700 hover:border-emerald-500'}`}>
                    <MessageCircle size={15} /> واتساب
                  </button>
                )}
              </div>
              {resending && <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1"><RefreshCw size={12} className="animate-spin" /> جارٍ الإرسال…</p>}
            </div>

            <button onClick={backToLogin} className="mt-5 text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
              <ArrowRight size={14} /> رجوع لتسجيل الدخول
            </button>
          </>
        )}

        <div className="mt-8 text-center pt-6 border-t border-slate-100 dark:border-brand-700">
          <button onClick={() => window.location.href = "/"} className="text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}
