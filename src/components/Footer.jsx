import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, ChevronLeft, MapPin, Phone, Mail } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const hideOnPaths = ["login", "customer-login", "dashboard", "tech-dashboard", "letter-generator", "admin"];
  const shouldHide = hideOnPaths.some(path => location.pathname.toLowerCase().includes(path));

  if (shouldHide) return null;

  const handleNav = (path) => {
    window.scrollTo(0, 0);
    navigate(path);
  };

  return (
    <footer className="bg-[#0f172a] text-white pt-20 pb-8 mt-auto no-print border-t-4 border-[#c5a059]">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 text-center md:text-right">
          
          {/* العمود الأول: الشعار ونبذة */}
          <div className="flex flex-col items-center md:items-start">
            <img src={getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")} alt="شعار سماك" className="max-h-24 w-auto object-contain logo-footer-gold mb-6" />
            <p className="text-slate-400 font-bold text-lg uppercase tracking-widest leading-relaxed">
              سقف يعلو برؤيتك،<br/> ومسكن يحكي قصتك
            </p>
            <div className="mt-6 space-y-3 text-slate-300 text-sm">
              <p className="flex items-center justify-center md:justify-start gap-2"><MapPin size={16} className="text-[#c5a059]"/> مكة المكرمة، حي البوابة</p>
              <p className="flex items-center justify-center md:justify-start gap-2" dir="ltr"><Phone size={16} className="text-[#c5a059]"/> 920032842</p>
              <p className="flex items-center justify-center md:justify-start gap-2" dir="ltr"><Mail size={16} className="text-[#c5a059]"/> info@semak.sa</p>
            </div>
          </div>
          
          {/* العمود الثاني: الروابط السريعة */}
          <div className="flex flex-col items-center md:items-start">
            <h4 className="text-[#c5a059] font-black text-xl mb-6 relative pb-2 after:content-[''] after:absolute after:bottom-0 after:right-0 md:after:right-0 after:w-12 after:h-1 after:bg-[#c5a059] after:rounded-full">الروابط السريعة</h4>
            <div className="flex flex-col gap-4 text-slate-300 font-bold">
              <button onClick={() => handleNav("/")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> الرئيسية
              </button>
              <button onClick={() => handleNav("/about")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> من نحن
              </button>
              <button onClick={() => handleNav("/services")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> خدماتنا
              </button>
              <button onClick={() => handleNav("/projects")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> مشاريعنا
              </button>
            </div>
          </div>

          {/* العمود الثالث: تواصل ومعلومات قانونية */}
          <div className="flex flex-col items-center md:items-start">
            <h4 className="text-[#c5a059] font-black text-xl mb-6 relative pb-2 after:content-[''] after:absolute after:bottom-0 after:right-0 md:after:right-0 after:w-12 after:h-1 after:bg-[#c5a059] after:rounded-full">تواصل ومعلومات</h4>
            <div className="flex flex-col gap-4 text-slate-300 font-bold">
              <button onClick={() => handleNav("/contact")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> تواصل معنا
              </button>
              <button onClick={() => handleNav("/privacy")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> سياسة الخصوصية
              </button>
              <button onClick={() => handleNav("/terms")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> الشروط والأحكام
              </button>
              <button onClick={() => handleNav("/customer-login")} className="hover:text-[#c5a059] transition w-max flex items-center gap-1 group text-emerald-400">
                <ChevronLeft size={16} className="text-transparent group-hover:text-[#c5a059] transition-colors -ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0" /> بوابة الملاك (طلبات الصيانة)
              </button>
            </div>
          </div>

        </div>
        
        {/* خط الحقوق */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm gap-4 font-bold">
          <p>© {new Date().getFullYear()} سماك العقارية. جميع الحقوق محفوظة.</p>
          <button onClick={() => handleNav("/login")} className="hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition flex items-center gap-2">
            <Lock size={14} /> بوابة الموظفين
          </button>
        </div>
      </div>
    </footer>
  );
}