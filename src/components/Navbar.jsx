import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  
  // دوال التوجيه الجديدة
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname; // لمعرفة الصفحة الحالية

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) setNavVisible(false);
      else setNavVisible(true);
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navigateTo = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  // إخفاء الشريط في صفحات لوحة التحكم والدخول
  const hideNavOn = ["/login", "/customer-login", "/admin/dashboard", "/admin/letter-generator", "/admin/tech-dashboard"];
  if (hideNavOn.includes(currentPage)) return null;

  return (
    <nav className={`bg-white/95 backdrop-blur-md shadow-sm fixed w-full z-50 transition-transform duration-300 ease-in-out no-print ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center cursor-pointer" onClick={() => navigateTo("/")}>
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="سماك العقارية" className="h-20 md:h-28 w-auto object-contain logo-blend-light" />
          </div>
          <div className="h-10 w-[2px] bg-[#c5a059]/30 hidden md:block" />
          <p className="hidden md:block text-xs text-slate-400 font-medium">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
        </div>
        
        <div className="hidden md:flex items-center space-x-8 space-x-reverse">
          <button onClick={() => navigateTo("/")} className={`font-semibold transition ${currentPage === "/" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>الرئيسية</button>
          <button onClick={() => navigateTo("/about")} className={`font-semibold transition ${currentPage === "/about" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>من نحن</button>
          <button onClick={() => navigateTo("/projects")} className={`font-semibold transition ${currentPage === "/projects" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>مشاريعنا</button>
          <button onClick={() => document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" })} className="font-semibold transition text-slate-600 hover:text-[#c5a059]">شركاؤنا</button>
          <button onClick={() => navigateTo("/maintenance")} className={`font-semibold transition ${currentPage === "/maintenance" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>طلب صيانة</button>
          <button onClick={() => navigateTo("/contact")} className="bg-[#1a365d] text-white px-8 py-3 rounded-full hover:bg-[#0f172a] transition-all transform hover:scale-105 shadow-lg font-bold">احجز الآن</button>
        </div>
        
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-[#1a365d] text-2xl">
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-6 py-8 flex flex-col space-y-6 shadow-xl no-print">
          <button onClick={() => navigateTo("/")} className="text-xl font-bold text-[#1a365d] text-right">الرئيسية</button>
          <button onClick={() => navigateTo("/about")} className="text-xl font-bold text-[#1a365d] text-right">من نحن</button>
          <button onClick={() => navigateTo("/projects")} className="text-xl font-bold text-[#1a365d] text-right">مشاريعنا</button>
          <button onClick={() => { document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }} className="text-xl font-bold text-[#1a365d] text-right">شركاؤنا</button>
          <button onClick={() => navigateTo("/maintenance")} className="text-xl font-bold text-[#1a365d] text-right">طلب صيانة</button>
          <button onClick={() => navigateTo("/contact")} className="bg-[#c5a059] text-white py-4 rounded-xl text-center font-bold">احجز وحدتك</button>
        </div>
      )}
    </nav>
  );
}