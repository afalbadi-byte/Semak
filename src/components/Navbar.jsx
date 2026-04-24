import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  const currentPage = location.pathname.substring(1) || "home";
  
  // 🔥 التعديل السحري: أي رابط يحتوي كلمة (admin أو dashboard أو login) يختفي النافبار فوراً
  const hideNavPaths = ["login", "customer-login", "dashboard", "tech-dashboard", "letter-generator", "admin"];
  const shouldHideNav = hideNavPaths.some(path => location.pathname.toLowerCase().includes(path));

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

  const handleNav = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const handleScrollToPartners = () => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/' && location.pathname !== '/about') {
        navigate('/');
        setTimeout(() => {
            document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" });
        }, 500);
    } else {
        document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // إخفاء الشريط العلوي إذا كان المتغير true
  if (shouldHideNav) return null;

  return (
    <nav className={`bg-white/95 backdrop-blur-md shadow-sm fixed w-full z-50 transition-transform duration-300 ease-in-out no-print ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center cursor-pointer" onClick={() => handleNav("/")}>
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="سماك العقارية" className="h-20 md:h-28 w-auto object-contain logo-blend-light" />
          </div>
          <div className="h-10 w-[2px] bg-[#c5a059]/30 hidden md:block" />
          <p className="hidden md:block text-xs text-slate-400 font-medium">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
        </div>
        
        <div className="hidden md:flex items-center space-x-8 space-x-reverse">
          <button onClick={() => handleNav("/")} className={`font-semibold transition ${currentPage === "home" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>الرئيسية</button>
          <button onClick={() => handleNav("/about")} className={`font-semibold transition ${currentPage === "about" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>من نحن</button>
          <button onClick={() => handleNav("/about")} className={`font-semibold transition ${currentPage === "about" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>من نحن</button>
          <button onClick={() => handleNav("/services")} className={`font-semibold transition ${currentPage === "services" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>خدماتنا</button> {/* 🔥 إضافة */}
          <button onClick={() => handleNav("/projects")} className={`font-semibold transition ${currentPage === "projects" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>مشاريعنا</button>
          <button onClick={handleScrollToPartners} className="font-semibold transition text-slate-600 hover:text-[#c5a059]">شركاؤنا</button>
          <button onClick={() => handleNav("/customer-login")} className={`font-semibold transition ${currentPage === "customer-login" || currentPage === "maintenance" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>طلب صيانة</button>
          <button onClick={() => handleNav("/contact")} className="bg-[#1a365d] text-white px-8 py-3 rounded-full hover:bg-[#0f172a] transition-all transform hover:scale-105 shadow-lg font-bold">احجز الآن</button>
        </div>
        
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-[#1a365d] text-2xl">
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* 🔥 القائمة المنسدلة للجوال 🔥 */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-slate-100 px-6 py-8 flex flex-col space-y-6 shadow-xl no-print">
          <button onClick={() => handleNav("/")} className={`text-xl font-bold text-right transition ${currentPage === "home" ? "text-[#c5a059]" : "text-[#1a365d] hover:text-[#c5a059]"}`}>الرئيسية</button>
          <button onClick={() => handleNav("/about")} className={`text-xl font-bold text-right transition ${currentPage === "about" ? "text-[#c5a059]" : "text-[#1a365d] hover:text-[#c5a059]"}`}>من نحن</button>
          <button onClick={() => handleNav("/projects")} className={`text-xl font-bold text-right transition ${currentPage === "projects" ? "text-[#c5a059]" : "text-[#1a365d] hover:text-[#c5a059]"}`}>مشاريعنا</button>
          <button onClick={handleScrollToPartners} className="text-xl font-bold text-right transition text-[#1a365d] hover:text-[#c5a059]">شركاؤنا</button>
          <button onClick={() => handleNav("/services")} className={`text-xl font-bold text-right transition ${currentPage === "services" ? "text-[#c5a059]" : "text-[#1a365d] hover:text-[#c5a059]"}`}>خدماتنا</button>
          <button onClick={() => handleNav("/customer-login")} className={`text-xl font-bold text-right transition ${currentPage === "customer-login" || currentPage === "maintenance" ? "text-[#c5a059]" : "text-[#1a365d] hover:text-[#c5a059]"}`}>طلب صيانة</button>
          <button onClick={() => handleNav("/contact")} className="bg-[#c5a059] text-white py-4 rounded-xl text-center font-bold hover:bg-yellow-600 transition shadow-md">احجز الآن</button>
        </div>
      )}
    </nav>
  );
}