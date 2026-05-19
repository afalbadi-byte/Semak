import React, { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Home, Phone, ArrowRight, RefreshCw, MessageCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

const WaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);

export default function CustomerLogin() {
  const { setCustomer, showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const [step, setStep]       = useState('input'); // 'input' | 'otp'
  const [loading, setLoading] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const otpRefs      = useRef([]);
  const timerRef     = useRef(null);

  // ─── countdown timer ───────────────────────────────────────────
  const startCountdown = useCallback((seconds = 120) => {
    clearInterval(timerRef.current);
    setCountdown(seconds);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const maskedPhone = phone.replace(/(\d{3})\d{4}(\d+)/, '$1 **** $2');

  // ─── إرسال OTP ─────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!unitCode.trim() || !phone.trim()) {
      showToast("تنبيه", "يرجى إدخال رقم الوحدة ورقم الجوال", "error");
      return false;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}?action=send_otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_code: unitCode.trim().toUpperCase(), phone: phone.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setStep('otp');
        setOtp(['', '', '', '', '', '']);
        startCountdown(120);
        setTimeout(() => otpRefs.current[0]?.focus(), 150);
        return true;
      } else {
        showToast("خطأ", data.message || "رقم الوحدة أو الجوال غير صحيح", "error");
        return false;
      }
    } catch {
      showToast("خطأ", "فشل الاتصال بالخادم، حاول لاحقاً", "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => { e.preventDefault(); await sendOtp(); };

  // ─── التحقق من OTP ──────────────────────────────────────────────
  const verifyOtp = async (code) => {
    if (!code || code.length !== 6) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}?action=verify_otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_code: unitCode.trim().toUpperCase(), otp: code })
      });
      const data = await res.json();
      if (data.success) {
        clearInterval(timerRef.current);
        setCustomer(data.data);
        showToast("تم تسجيل الدخول", `أهلاً بك، ${data.data.name}`);
        navigate("/portal");
      } else {
        showToast("خطأ", data.message || "الرمز غير صحيح أو انتهت صلاحيته", "error");
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } catch {
      showToast("خطأ", "فشل الاتصال بالخادم، حاول لاحقاً", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── مدخلات OTP ────────────────────────────────────────────────
  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (val && i === 5 && next.every(d => d)) verifyOtp(next.join(''));
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
      verifyOtp(pasted);
    }
  };

  // ─── الواجهة ────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative -mt-24"
      style={{ backgroundImage: "url('/images/customer-login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-[#1a365d]/92 backdrop-blur-sm" />

      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full relative z-10 border border-white/10 mx-4 overflow-hidden">

        {/* ─── شريط علوي ذهبي ─── */}
        <div className="h-1.5 bg-gradient-to-r from-[#c5a059] via-[#e8c97a] to-[#c5a059]" />

        <div className="p-8 md:p-10">

          {/* ─── مؤشر الخطوات ─── */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-black transition-all duration-300 ${
              step === 'otp' ? 'bg-green-100 text-green-600' : 'bg-[#c5a059] text-white scale-110 shadow-lg shadow-[#c5a059]/30'
            }`}>
              {step === 'otp' ? <CheckCircle2 size={18} /> : '١'}
            </div>
            <div className={`h-[2px] w-14 rounded-full transition-all duration-500 ${step === 'otp' ? 'bg-[#c5a059]' : 'bg-slate-200'}`} />
            <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-black transition-all duration-300 ${
              step === 'otp' ? 'bg-[#c5a059] text-white scale-110 shadow-lg shadow-[#c5a059]/30' : 'bg-slate-100 text-slate-400'
            }`}>
              {step === 'otp' ? <KeyRound size={16} /> : '٢'}
            </div>
          </div>

          {/* ─── الأيقونة والعنوان ─── */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
              step === 'otp' ? 'bg-green-50 text-green-600' : 'bg-[#c5a059]/10 text-[#c5a059]'
            }`}>
              {step === 'input' ? <ShieldCheck size={32} /> : <MessageCircle size={32} />}
            </div>
            <h2 className="text-2xl font-black text-[#1a365d]">
              {step === 'input' ? 'بوابة الملاك' : 'رمز التحقق'}
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              {step === 'input'
                ? 'أدخل بيانات وحدتك وسيصلك رمز تحقق على واتساب'
                : <>تم الإرسال إلى <span className="font-black text-[#1a365d]" dir="ltr">{maskedPhone}</span></>
              }
            </p>
          </div>

          {/* ══════════════ الخطوة ١ ══════════════ */}
          {step === 'input' && (
            <form onSubmit={handleSendOtp} className="space-y-5 text-right">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">رقم الوحدة</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Home size={16} /></span>
                  <input
                    type="text"
                    value={unitCode}
                    onChange={e => setUnitCode(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-slate-200 px-5 py-3.5 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-[#1a365d] transition font-black tracking-widest placeholder:font-normal placeholder:text-slate-300"
                    placeholder="SM-A01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">رقم الجوال المسجل</label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-200 px-5 py-3.5 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-[#1a365d] transition font-bold placeholder:font-normal placeholder:text-slate-300"
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#25D366] hover:bg-[#1fba5a] text-white py-4 rounded-xl font-bold text-base transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:-translate-y-0.5 flex justify-center items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {loading
                  ? <RefreshCw className="animate-spin" size={20} />
                  : <><WaIcon /> إرسال رمز التحقق على واتساب</>
                }
              </button>
            </form>
          )}

          {/* ══════════════ الخطوة ٢ ══════════════ */}
          {step === 'otp' && (
            <div>
              {/* مربعات OTP */}
              <div
                className="flex justify-center gap-2.5 mb-8"
                dir="ltr"
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all duration-200 caret-transparent
                      ${digit
                        ? 'border-[#c5a059] bg-[#c5a059]/8 text-[#1a365d] scale-105'
                        : 'border-slate-200 bg-slate-50 text-slate-300'
                      }
                      focus:border-[#c5a059] focus:bg-[#c5a059]/5 focus:scale-105`}
                  />
                ))}
              </div>

              {/* زر التحقق */}
              <button
                onClick={() => verifyOtp(otp.join(''))}
                disabled={loading || otp.some(d => !d)}
                className="w-full bg-[#1a365d] hover:bg-[#c5a059] text-white py-4 rounded-xl font-bold text-base transition-all shadow-lg hover:-translate-y-0.5 flex justify-center items-center gap-2 mb-6 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {loading
                  ? <RefreshCw className="animate-spin" size={20} />
                  : <><CheckCircle2 size={18} /> تحقق ودخول</>
                }
              </button>

              {/* مؤقت إعادة الإرسال */}
              <div className="text-center">
                {canResend ? (
                  <button
                    onClick={async () => { await sendOtp(); }}
                    disabled={loading}
                    className="flex items-center gap-2 mx-auto text-[#c5a059] font-bold text-sm hover:text-[#1a365d] transition"
                  >
                    <RefreshCw size={14} /> إعادة إرسال الرمز
                  </button>
                ) : (
                  <p className="text-slate-400 text-sm">
                    إعادة الإرسال بعد{' '}
                    <span className="font-black text-[#1a365d] tabular-nums" dir="ltr">{formatTime(countdown)}</span>
                  </p>
                )}
              </div>

              {/* رجوع لتغيير البيانات */}
              <button
                onClick={() => { setStep('input'); setOtp(['', '', '', '', '', '']); clearInterval(timerRef.current); }}
                className="mt-6 flex items-center gap-1.5 mx-auto text-slate-400 hover:text-[#1a365d] text-xs transition"
              >
                <ArrowRight size={13} /> تغيير رقم الوحدة أو الجوال
              </button>
            </div>
          )}

          {/* ─── رابط الرجوع للموقع (الخطوة ١ فقط) ─── */}
          {step === 'input' && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <button
                onClick={() => navigate("/")}
                className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition"
              >
                <ArrowRight size={14} /> العودة للموقع الرئيسي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
