import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, LS_ADMIN_JWT } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';
import {
  Building2, Mail, Lock, Phone, User, RefreshCw,
  CheckCircle2, ChevronLeft, Sparkles, Clock, Shield
} from 'lucide-react';

/* ─── بطاقة ميزة ─── */
const FeatureChip = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2 text-slate-400 text-sm">
    <Icon size={15} className="text-[#c5a059] shrink-0" />
    <span>{text}</span>
  </div>
);

export default function AdminRegister() {
  const { setAdminUser } = useContext(AppContext);

  const [company,  setCompany]  = useState('');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [agree,    setAgree]    = useState(false);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (!agree) {
      setError('يرجى الموافقة على الشروط والأحكام للمتابعة');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=platform_register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: company,
          admin_name:   name,
          email,
          phone,
          password,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // حفظ JWT وبيانات المستخدم — نفس منطق AdminLogin
        localStorage.setItem(LS_ADMIN_JWT, data.jwt);
        localStorage.setItem('semak_current_user', JSON.stringify(data.data));
        setAdminUser(data.data);
        setSuccess(true);
        // تأخير بسيط لإظهار شاشة النجاح ثم التوجيه
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      } else {
        setError(data.message || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } catch {
      setError('فشل الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  /* ─── شاشة النجاح ─── */
  if (success) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-[#0f172a] font-cairo"
        style={{ backgroundImage: 'radial-gradient(ellipse at 40% 0%, rgba(197,160,89,0.10) 0%, transparent 60%)' }}
      >
        <div className="text-center px-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 mb-6">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">تمّ إنشاء حسابك! 🎉</h2>
          <p className="text-slate-400 text-lg mb-8">جارٍ تحويلك إلى لوحة التحكم…</p>
          <div className="w-8 h-8 mx-auto rounded-full border-4 border-[#c5a059]/30 border-t-[#c5a059] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex bg-[#0f172a] font-cairo"
      style={{ backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(197,160,89,0.08) 0%, transparent 60%)' }}
    >
      {/* شبكة خلفية خفيفة */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#c5a059 1px, transparent 1px), linear-gradient(90deg, #c5a059 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ─── اللوحة اليمنى — المزايا ─── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 relative border-l border-slate-800/60 p-12">
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-xl bg-[#c5a059]/15 border border-[#c5a059]/20 flex items-center justify-center">
              <Building2 size={20} className="text-[#c5a059]" />
            </div>
            <span className="text-white font-black text-xl tracking-tight">سماك العقارية</span>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-[#c5a059]/10 border border-[#c5a059]/20 rounded-full px-4 py-1.5 mb-5">
              <Sparkles size={13} className="text-[#c5a059]" />
              <span className="text-[#c5a059] text-xs font-bold">14 يوماً مجاناً — بدون بطاقة ائتمانية</span>
            </div>
            <h2 className="text-white text-3xl font-black leading-snug mb-4">
              نظام محاسبة عقارية<br />
              <span className="text-[#c5a059]">احترافي ومتكامل</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              أدر عقاراتك وإيراداتك ومصاريفك وفواتيرك بكفاءة عالية من مكان واحد.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureChip icon={Shield} text="محاسبة متوافقة مع متطلبات هيئة الزكاة والضريبة" />
            <FeatureChip icon={CheckCircle2} text="إصدار فواتير إلكترونية معتمدة (ZATCA)" />
            <FeatureChip icon={Clock} text="تقارير مالية فورية وتحليلات دقيقة" />
            <FeatureChip icon={Building2} text="إدارة الوحدات والعملاء والصيانة" />
            <FeatureChip icon={Sparkles} text="دعم فني متاح على مدار الساعة" />
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} سماك العقارية · جميع الحقوق محفوظة
        </p>
      </div>

      {/* ─── اللوحة اليسرى — النموذج ─── */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-6">
        <div className="w-full max-w-md">
          {/* رابط العودة للدخول */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#c5a059] text-sm mb-8 transition"
          >
            <ChevronLeft size={15} />
            تسجيل الدخول لحساب موجود
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">إنشاء حساب جديد</h1>
            <p className="text-slate-400 text-sm">
              ابدأ تجربتك المجانية لمدة 14 يوماً — لا يلزم بطاقة ائتمانية
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* اسم الشركة */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                اسم الشركة / المنشأة <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition"
                  placeholder="شركة العقارات المتميزة"
                />
              </div>
            </div>

            {/* اسم المدير */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                الاسم الكامل <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition"
                  placeholder="محمد عبدالله"
                />
              </div>
            </div>

            {/* البريد + الجوال — صفٌّ واحد */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  البريد الإلكتروني <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    dir="ltr"
                    className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition text-right"
                    placeholder="info@company.sa"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  رقم الجوال
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition text-right"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>
            </div>

            {/* كلمة المرور + تأكيد — صفٌّ واحد */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  كلمة المرور <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    dir="ltr"
                    className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:border-[#c5a059]/60 focus:ring-1 focus:ring-[#c5a059]/30 transition"
                    placeholder="8 أحرف على الأقل"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  تأكيد كلمة المرور <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    dir="ltr"
                    className={`w-full bg-slate-900 border text-white placeholder-slate-600 rounded-xl pr-9 pl-4 py-3 text-sm outline-none focus:ring-1 transition ${
                      confirm && confirm !== password
                        ? 'border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20'
                        : confirm && confirm === password
                        ? 'border-green-500/60 focus:border-green-500/60 focus:ring-green-500/20'
                        : 'border-slate-700 focus:border-[#c5a059]/60 focus:ring-[#c5a059]/30'
                    }`}
                    placeholder="أعد كتابة كلمة المرور"
                  />
                </div>
              </div>
            </div>

            {/* مربع الموافقة */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    agree ? 'bg-[#c5a059] border-[#c5a059]' : 'bg-slate-900 border-slate-600 group-hover:border-[#c5a059]/50'
                  }`}
                >
                  {agree && <CheckCircle2 size={12} className="text-slate-950" />}
                </div>
              </div>
              <span className="text-slate-400 text-sm leading-relaxed">
                أوافق على{' '}
                <Link to="/terms" className="text-[#c5a059] hover:underline" target="_blank">
                  الشروط والأحكام
                </Link>{' '}
                و{' '}
                <Link to="/privacy" className="text-[#c5a059] hover:underline" target="_blank">
                  سياسة الخصوصية
                </Link>
              </span>
            </label>

            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
                {error}
              </div>
            )}

            {/* زر الإرسال */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-[#c5a059]/20 hover:shadow-[#c5a059]/30 mt-2"
            >
              {loading
                ? <><RefreshCw size={16} className="animate-spin" /> جارٍ إنشاء الحساب…</>
                : <><Sparkles size={16} /> ابدأ تجربتك المجانية</>}
            </button>

            {/* تفاصيل التجربة */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <span className="text-slate-600 text-xs flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" /> 14 يوماً مجاناً
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-600 text-xs flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" /> بدون بطاقة ائتمانية
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-600 text-xs flex items-center gap-1">
                <CheckCircle2 size={11} className="text-green-500" /> إلغاء في أي وقت
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
