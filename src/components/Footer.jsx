import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, ChevronLeft, MapPin, Phone, Mail } from 'lucide-react';

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);

const quickLinks = [
  { label: 'الرئيسية', path: '/' },
  { label: 'من نحن', path: '/about' },
  { label: 'خدماتنا', path: '/services' },
  { label: 'مشاريعنا', path: '/projects' },
  { label: 'تواصل معنا', path: '/contact' },
];

const portalLinks = [
  { label: 'بوابة الملاك', path: '/customer-login' },
  { label: 'طلب صيانة', path: '/maintenance' },
  { label: 'سياسة الخصوصية', path: '/privacy' },
  { label: 'الشروط والأحكام', path: '/terms' },
];

const HIDE_ON_PATHS = ['login', 'customer-login', 'portal', 'dashboard', 'tech-dashboard', 'letter-generator', 'admin'];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const shouldHide = HIDE_ON_PATHS.some(p => location.pathname.toLowerCase().includes(p));
  if (shouldHide) return null;

  const handleNav = (path) => {
    window.scrollTo(0, 0);
    navigate(path);
  };

  return (
    <footer className="bg-[#080d18] text-white mt-auto no-print" dir="rtl">

      {/* ─── شريط ذهبي علوي ─── */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-[#c5a059] to-transparent" />

      {/* ─── بانر الدعوة للتواصل ─── */}
      <div className="bg-gradient-to-l from-[#0f2044] via-[#1a365d] to-[#0f2044] border-b border-white/5">
        <div className="container mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1">
              هل تبحث عن عقارك المثالي؟
            </h3>
            <p className="text-slate-400 text-sm">تواصل معنا واحصل على استشارة مجانية</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a
              href="https://wa.me/966920032842?text=أهلاً، أود الاستفسار عن خدماتكم العقارية"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1fba5a] text-white font-bold px-5 py-2.5 rounded-xl transition-all duration-200 text-sm shadow-lg hover:shadow-green-900/40 hover:-translate-y-0.5"
            >
              <WhatsAppIcon /> واتساب
            </a>
            <button
              onClick={() => handleNav('/contact')}
              className="flex items-center gap-2 bg-[#c5a059] hover:bg-[#d4b570] text-[#080d18] font-bold px-5 py-2.5 rounded-xl transition-all duration-200 text-sm shadow-lg hover:-translate-y-0.5"
            >
              تواصل معنا
            </button>
          </div>
        </div>
      </div>

      {/* ─── المحتوى الرئيسي ─── */}
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* العمود ١: الهوية والتواصل */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <span className="text-3xl font-black tracking-wide text-white">سماك</span>
              <span className="text-3xl font-black tracking-wide text-[#c5a059]"> العقارية</span>
              <div className="mt-1 h-[2px] w-12 bg-[#c5a059] rounded-full" />
            </div>
            <p className="text-[#c5a059] font-bold text-sm leading-relaxed mb-3">
              سقف يعلو برؤيتك، ومسكن يحكي قصتك
            </p>
            <p className="text-slate-500 text-sm leading-relaxed mb-7">
              شركة رائدة في القطاع العقاري بمكة المكرمة، نقدم حلولاً عقارية متكاملة تجمع بين الجودة والثقة.
            </p>

            {/* أيقونات التواصل */}
            <div className="flex gap-3">
              <a
                href="https://wa.me/966920032842"
                target="_blank"
                rel="noopener noreferrer"
                title="تواصل عبر واتساب"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#25D366] border border-white/10 hover:border-[#25D366] flex items-center justify-center transition-all duration-200 text-slate-400 hover:text-white"
              >
                <WhatsAppIcon />
              </a>
              <a
                href="tel:920032842"
                title="اتصل بنا"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#c5a059] border border-white/10 hover:border-[#c5a059] flex items-center justify-center transition-all duration-200 text-slate-400 hover:text-[#080d18]"
              >
                <Phone size={16} />
              </a>
              <a
                href="mailto:info@semak.sa"
                title="راسلنا"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#c5a059] border border-white/10 hover:border-[#c5a059] flex items-center justify-center transition-all duration-200 text-slate-400 hover:text-[#080d18]"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* العمود ٢: روابط سريعة */}
          <div>
            <h4 className="text-white font-black text-base mb-5 flex items-center gap-2.5 pb-3 border-b border-white/8">
              <span className="w-1 h-4 bg-[#c5a059] rounded-full flex-shrink-0" />
              روابط سريعة
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map(({ label, path }) => (
                <li key={path}>
                  <button
                    onClick={() => handleNav(path)}
                    className="flex items-center gap-2 text-slate-400 hover:text-[#c5a059] transition-colors duration-200 text-sm w-full group"
                  >
                    <ChevronLeft
                      size={13}
                      className="text-[#c5a059]/40 group-hover:text-[#c5a059] transition-colors flex-shrink-0"
                    />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* العمود ٣: خدمات وبوابات */}
          <div>
            <h4 className="text-white font-black text-base mb-5 flex items-center gap-2.5 pb-3 border-b border-white/8">
              <span className="w-1 h-4 bg-[#c5a059] rounded-full flex-shrink-0" />
              خدمات وبوابات
            </h4>
            <ul className="space-y-2.5">
              {portalLinks.map(({ label, path }) => (
                <li key={path}>
                  <button
                    onClick={() => handleNav(path)}
                    className="flex items-center gap-2 text-slate-400 hover:text-[#c5a059] transition-colors duration-200 text-sm w-full group"
                  >
                    <ChevronLeft
                      size={13}
                      className="text-[#c5a059]/40 group-hover:text-[#c5a059] transition-colors flex-shrink-0"
                    />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* العمود ٤: معلومات التواصل */}
          <div>
            <h4 className="text-white font-black text-base mb-5 flex items-center gap-2.5 pb-3 border-b border-white/8">
              <span className="w-1 h-4 bg-[#c5a059] rounded-full flex-shrink-0" />
              معلومات التواصل
            </h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="tel:920032842"
                  className="flex items-start gap-3 text-slate-400 hover:text-[#c5a059] transition-colors duration-200 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#c5a059]/10 group-hover:bg-[#c5a059]/20 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5">
                    <Phone size={15} className="text-[#c5a059]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">الهاتف الموحد</p>
                    <p className="text-sm font-bold text-slate-300" dir="ltr">920032842</p>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@semak.sa"
                  className="flex items-start gap-3 text-slate-400 hover:text-[#c5a059] transition-colors duration-200 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#c5a059]/10 group-hover:bg-[#c5a059]/20 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5">
                    <Mail size={15} className="text-[#c5a059]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">البريد الإلكتروني</p>
                    <p className="text-sm font-bold text-slate-300" dir="ltr">info@semak.sa</p>
                  </div>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-slate-400">
                  <div className="w-9 h-9 rounded-lg bg-[#c5a059]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={15} className="text-[#c5a059]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">الموقع</p>
                    <p className="text-sm font-bold text-slate-300">مكة المكرمة،<br />حي البوابة</p>
                  </div>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* ─── شريط الحقوق ─── */}
      <div className="border-t border-white/5 bg-black/30">
        <div className="container mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()}{' '}
            <span className="text-slate-400 font-bold">سماك العقارية</span>.
            {' '}جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <button
              onClick={() => handleNav('/privacy')}
              className="text-slate-600 hover:text-slate-300 text-xs transition-colors px-2 py-1"
            >
              سياسة الخصوصية
            </button>
            <span className="text-slate-800 text-xs">•</span>
            <button
              onClick={() => handleNav('/terms')}
              className="text-slate-600 hover:text-slate-300 text-xs transition-colors px-2 py-1"
            >
              الشروط والأحكام
            </button>
            <span className="text-slate-800 text-xs">•</span>
            <button
              onClick={() => handleNav('/login')}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-200 bg-white/4 hover:bg-white/8 px-3 py-1.5 rounded-lg transition-all text-xs border border-white/5 hover:border-white/10"
            >
              <Lock size={11} /> بوابة الموظفين
            </button>
          </div>
        </div>
      </div>

    </footer>
  );
}
