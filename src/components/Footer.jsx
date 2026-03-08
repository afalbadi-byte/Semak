import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // إخفاء الفوتر في صفحات لوحة التحكم
  const hideOn = ["/login", "/customer-login", "/admin/dashboard", "/admin/letter-generator", "/admin/tech-dashboard"];
  if (hideOn.includes(location.pathname)) return null;

  return (
    <footer className="bg-[#0f172a] text-white pt-24 pb-12 no-print">
      <div className="container mx-auto px-6 text-center">
        <div className="mb-12 flex flex-col items-center">
          <img src={getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")} alt="شعار تذييل" className="max-h-32 md:max-h-48 w-auto object-contain logo-footer-gold" />
          <p className="text-slate-400 mt-1 tracking-widest font-bold text-xl uppercase">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
        </div>
        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center text-slate-100 text-sm gap-6">
          <p>© 2026 سماك العقـــارية. جميع الحقوق محفوظة.</p>
          <div className="flex flex-wrap justify-center gap-6 font-medium">
            <button onClick={() => { navigate("/privacy"); window.scrollTo(0,0); }} className="hover:text-white transition">سياسة الخصوصية</button>
            <button onClick={() => { navigate("/terms"); window.scrollTo(0,0); }} className="hover:text-white transition">الشروط والأحكام</button>
            <button onClick={() => { navigate("/login"); window.scrollTo(0,0); }} className="hover:text-[#c5a059] transition flex items-center gap-2">
              <Lock size={14} /> بوابـة الموظفين
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}