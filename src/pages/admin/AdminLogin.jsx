import React, { useState, useEffect, useRef, useContext } from 'react';
import { User, Lock, RefreshCw, ArrowRight, ShieldCheck, Mail, MessageCircle, KeyRound, Smartphone } from 'lucide-react';

import { API_URL, LS_ADMIN_JWT } from '../../lib/api/client';
import InstallApp from '../../components/InstallApp';
import { PasskeyLoginButton } from '../../components/PasskeyButton';
import { AppContext } from '../../context/AppContext';

const DEVICE_KEY = 'semak_device_token';

export default function AdminLogin({ setUser, showToast }) {
  const { setBranding } = useContext(AppContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── الدخول الموحّد بدون كلمة مرور (بريد/جوال) ──
  const [identifier, setIdentifier] = useState("");
  const [idLoading, setIdLoading] = useState(false);
  // مصدر جلسة الرمز الحالية: 'password' (login/verify_login_otp) | 'identifier' (auth_otp_*)
  const [flow, setFlow] = useState('password');

  // ── حالة التحقق بخطوتين ──
  const [step, setStep] = useState('login'); // 'login' | 'identifier' | 'choose' | 'otp'
  const [otp, setOtp] = useState(null);       // { ticket, channel, masked_email, masked_phone, has_email, has_phone, name }
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

  // قادم من تطبيق المشتريات؟ اربط بطاقة تعريفه ليثبّت التطبيق لا الموقع
  const [fromBuy, setFromBuy] = useState(false);
  useEffect(() => {
    let next = '';
    try { next = new URLSearchParams(window.location.search).get('next') || ''; } catch { next = ''; }
    if (!next.startsWith('/buy')) return;
    setFromBuy(true);
    const link = document.querySelector('link[rel="manifest"]');
    const old = link ? link.getAttribute('href') : null;
    if (link) link.setAttribute('href', '/buy.webmanifest');
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    const appleOld = apple ? apple.getAttribute('href') : null;
    if (apple) apple.setAttribute('href', '/images/app-icon-512.png');
    return () => {
      if (link && old) link.setAttribute('href', old);
      if (apple && appleOld) apple.setAttribute('href', appleOld);
    };
  }, []);

  const toast = (t, m, k) => { if (showToast) showToast(t, m, k); else if (k === 'error') alert(m); };

  // ── إنهاء الدخول وتخزين الجلسة والتحويل ──
  const finalizeLogin = (userData, jwt = null) => {
    if (rememberMe && email) localStorage.setItem("semak_admin_email", email);
    else if (!rememberMe) localStorage.removeItem("semak_admin_email");

    if (jwt) localStorage.setItem(LS_ADMIN_JWT, jwt);
    localStorage.setItem("semak_current_user", JSON.stringify(userData));
    if (setUser) setUser(userData);

    // جلب هوية المنشأة (اسم الشركة + الألوان) في الخلفية بعد الدخول
    fetch(`${API_URL}?action=tenant_branding`, {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    }).then(r => r.json()).then(b => { if (b.success) setBranding(b); }).catch(() => {});

    toast("تم تسجيل الدخول", `مرحباً بك، ${userData.name}`);

    // العودة إلى الوجهة التي جاء منها (تطبيق المشتريات مثلا) — داخلية فقط
    let next = null;
    try {
      const q = new URLSearchParams(window.location.search).get('next');
      if (q && /^\/[A-Za-z0-9_\-\/]*$/.test(q)) next = q;
    } catch { next = null; }
    if (next) window.location.href = next;
    else if (userData.role === "technician") window.location.href = "/tech-dashboard";
    else window.location.href = "/admin/dashboard";
  };

  // الانتقال لشاشة الرمز بعد تجهيز كائن otp
  const enterOtpStep = (data, usedFlow) => {
    setFlow(usedFlow);
    setOtp({
      ticket: data.ticket,
      channel: data.channel,
      masked_email: data.masked_email,
      masked_phone: data.masked_phone,
      has_email: data.has_email,
      has_phone: data.has_phone,
      name: data.name,
    });
    setCode("");
    setStep(data.choose ? 'choose' : 'otp');
  };

  // ── المسار 1: بريد + كلمة مرور ──
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
        enterOtpStep(data, 'password');
        toast("رمز التحقق", data.sent ? "أرسلنا لك رمز الدخول" : "تعذّر إرسال الرمز، جرّب قناة أخرى", data.sent ? undefined : "error");
      } else if (data.success) {
        finalizeLogin(data.data, data.jwt);
      } else {
        toast("خطأ", data.message, "error");
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── المسار 2: دخول موحّد برمز (بريد أو جوال) بدون كلمة مرور ──
  const handleIdentifier = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIdLoading(true);
    try {
      const device_token = localStorage.getItem(DEVICE_KEY) || undefined;
      const res = await fetch(`${API_URL}?action=auth_otp_start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), scope: 'staff', device_token })
      });
      const data = await res.json();

      if (data.success && data.data) {
        // جهاز موثوق — دخول مباشر بدون رمز
        finalizeLogin(data.data, data.jwt);
      } else if (data.otp_required) {
        enterOtpStep(data, 'identifier');
        if (!data.choose) {
          toast("رمز التحقق", data.sent
            ? (data.channel === 'whatsapp' ? "أرسلنا الرمز عبر واتساب" : "أرسلنا الرمز لبريدك")
            : "تعذّر إرسال الرمز، جرّب قناة أخرى", data.sent ? undefined : "error");
        }
      } else {
        toast("خطأ", data.message || "تعذّر بدء الدخول", "error");
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setIdLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setOtpLoading(true);
    try {
      const action = flow === 'identifier' ? 'auth_otp_verify' : 'verify_login_otp';
      const res = await fetch(`${API_URL}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: otp.ticket, code: code.trim(), remember_device: rememberDevice })
      });
      const data = await res.json();
      if (data.success) {
        if (data.device_token) localStorage.setItem(DEVICE_KEY, data.device_token);
        finalizeLogin(data.data, data.jwt);
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
      const action = flow === 'identifier' ? 'auth_otp_send' : 'login_send_otp';
      const res = await fetch(`${API_URL}?action=${action}`, {
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
        return true;
      } else {
        toast("خطأ", data.message || "تعذّر إعادة الإرسال", "error");
        return false;
      }
    } catch (error) {
      toast("خطأ", "فشل الاتصال بالسيرفر", "error");
      return false;
    } finally {
      setResending(false);
    }
  };

  // اختيار القناة من شاشة الاختيار ثم الانتقال لإدخال الرمز
  const chooseChannel = async (channel) => {
    await sendOtp(channel);
    setStep('otp');
  };

  const backToLogin = () => { setStep('login'); setOtp(null); setCode(""); setFlow('password'); };

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

            {/* دخول موحّد برمز بدون كلمة مرور */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-brand-700">
              <button type="button" onClick={() => { setIdentifier(email); setStep('identifier'); }}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-brand-700 text-brand-800 dark:text-brand-100 hover:border-gold-500 hover:text-gold-600 transition">
                <Smartphone size={16} /> الدخول برمز عبر الجوال أو البريد
              </button>
            </div>
          </>
        ) : step === 'identifier' ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gold-500/15 text-gold-500 flex items-center justify-center mx-auto mb-3">
              <Smartphone size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">الدخول برمز</h2>
            <p className="text-slate-500 dark:text-brand-400 text-sm mt-2 mb-8">أدخل بريدك أو رقم جوالك وسنرسل لك رمز دخول لمرة واحدة</p>
            <form onSubmit={handleIdentifier} className="space-y-6 text-right">
              <div>
                <label className="block text-sm font-bold mb-2 text-brand-800 dark:text-brand-100">البريد الإلكتروني أو رقم الجوال</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><User size={16} /></span>
                  <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 transition" placeholder="name@semak.sa أو 05xxxxxxxx" />
                </div>
              </div>
              <button type="submit" disabled={idLoading} className="w-full bg-brand-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-gold-500 transition shadow-lg shadow-brand-800/30 flex justify-center items-center gap-2 disabled:opacity-50">
                {idLoading ? <RefreshCw className="animate-spin" size={20} /> : "إرسال الرمز"}
              </button>
            </form>

            <button onClick={backToLogin} className="mt-6 text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
              <ArrowRight size={14} /> الدخول بكلمة المرور بدلاً من ذلك
            </button>
          </>
        ) : step === 'choose' ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gold-500/15 text-gold-500 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">اختر قناة الإرسال</h2>
            <p className="text-slate-500 dark:text-brand-400 text-sm mt-2 mb-8">أين تريد استلام رمز الدخول؟</p>
            <div className="space-y-3">
              {otp?.has_phone && (
                <button type="button" disabled={resending} onClick={() => chooseChannel('whatsapp')}
                  className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 border bg-white dark:bg-brand-800 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-brand-700 hover:border-emerald-500 transition disabled:opacity-50">
                  <MessageCircle size={18} /> واتساب {otp?.masked_phone && <span dir="ltr" className="text-xs opacity-70">{otp.masked_phone}</span>}
                </button>
              )}
              {otp?.has_email && (
                <button type="button" disabled={resending} onClick={() => chooseChannel('email')}
                  className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 border bg-white dark:bg-brand-800 text-brand-800 dark:text-brand-100 border-slate-200 dark:border-brand-700 hover:border-gold-500 transition disabled:opacity-50">
                  <Mail size={18} /> البريد الإلكتروني {otp?.masked_email && <span dir="ltr" className="text-xs opacity-70">{otp.masked_email}</span>}
                </button>
              )}
            </div>
            {resending && <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1"><RefreshCw size={12} className="animate-spin" /> جارٍ الإرسال…</p>}

            <button onClick={backToLogin} className="mt-6 text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
              <ArrowRight size={14} /> رجوع
            </button>
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

        <div className="mt-5">
          <PasskeyLoginButton identifier={email}
            className="!bg-slate-100 dark:!bg-brand-800 !text-brand-900 dark:!text-brand-50"
            onSuccess={data => finalizeLogin(data.data, data.jwt)} />
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-brand-700">
          <InstallApp
            label={fromBuy ? 'ثبّت تطبيق المشتريات' : 'ثبّت التطبيق على جوالك'}
            hint="يُضاف لشاشة جوالك ويفتح بملء الشاشة، ويحدّث نفسه تلقائياً" />
        </div>

        <div className="mt-6 text-center pt-5 border-t border-slate-100 dark:border-brand-700 space-y-3">
          <a
            href="/register"
            className="block text-sm font-bold text-[#c5a059] hover:text-[#b8913f] transition"
          >
            ليس لديك حساب؟ ابدأ تجربتك المجانية لـ 14 يوماً
          </a>
          <button onClick={() => window.location.href = "/"} className="text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}
