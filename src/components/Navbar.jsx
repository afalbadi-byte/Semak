import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from './ui';


export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  const currentPage = location.pathname.substring(1) || "home";
  
  const hideNavPaths = ["login", "customer-login", "portal", "maintenance", "dashboard", "tech-dashboard", "letter-generator", "admin"];
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

  if (shouldHideNav) return null;

  return (
    <nav className={`bg-white/95 dark:bg-brand-950/90 backdrop-blur-md shadow-sm dark:shadow-black/30 border-b border-transparent dark:border-brand-800 fixed w-full z-50 transition-transform duration-300 ease-in-out no-print ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center cursor-pointer" onClick={() => handleNav("/")}>
            <img src="/images/logo-main.png" alt="سماك العقارية" className="h-20 md:h-28 w-auto object-contain logo-blend-light dark:mix-blend-normal" />
          </div>
          <div className="h-10 w-[2px] bg-gold-500/30 hidden md:block" />
          <p className="hidden md:block text-xs text-slate-400 dark:text-brand-400 font-medium">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
        </div>

        <div className="hidden lg:flex items-center space-x-6 space-x-reverse xl:space-x-8 xl:space-x-reverse">
          <button onClick={() => handleNav("/")} className={`font-semibold transition ${currentPage === "home" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>الرئيسية</button>
          <button onClick={() => handleNav("/about")} className={`font-semibold transition ${currentPage === "about" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>من نحن</button>
          <button onClick={() => handleNav("/services")} className={`font-semibold transition ${currentPage === "services" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>خدماتنا</button>
          <button onClick={() => handleNav("/projects")} className={`font-semibold transition ${currentPage === "projects" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>مشاريعنا</button>
          <button onClick={handleScrollToPartners} className="font-semibold transition text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400">شركاؤنا</button>
          <button onClick={() => handleNav("/contact")} className={`font-semibold transition ${currentPage === "contact" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>تواصل معنا</button>
          <button onClick={() => handleNav("/customer-login")} className={`font-semibold transition ${currentPage === "customer-login" || currentPage === "maintenance" ? "text-gold-500" : "text-slate-600 dark:text-brand-200 hover:text-gold-500 dark:hover:text-gold-400"}`}>طلب صيانة</button>
          <button onClick={() => handleNav("/contact")} className="bg-brand-800 dark:bg-gold-500 text-white dark:text-brand-950 px-6 py-2.5 rounded-full hover:bg-brand-950 dark:hover:bg-gold-400 transition-all transform hover:scale-105 shadow-lg font-bold">احجز وحدتك</button>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-brand-800 dark:text-brand-100 text-2xl">
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white dark:bg-brand-950 border-t border-slate-100 dark:border-brand-800 px-6 py-8 flex flex-col space-y-6 shadow-xl no-print">
          <button onClick={() => handleNav("/")} className={`text-xl font-bold text-right transition ${currentPage === "home" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>الرئيسية</button>
          <button onClick={() => handleNav("/about")} className={`text-xl font-bold text-right transition ${currentPage === "about" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>من نحن</button>
          <button onClick={() => handleNav("/services")} className={`text-xl font-bold text-right transition ${currentPage === "services" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>خدماتنا</button>
          <button onClick={() => handleNav("/projects")} className={`text-xl font-bold text-right transition ${currentPage === "projects" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>مشاريعنا</button>
          <button onClick={() => handleNav("/contact")} className={`text-xl font-bold text-right transition ${currentPage === "contact" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>تواصل معنا</button>
          <button onClick={handleScrollToPartners} className="text-xl font-bold text-right transition text-brand-800 dark:text-brand-100 hover:text-gold-500">شركاؤنا</button>
          <button onClick={() => handleNav("/customer-login")} className={`text-xl font-bold text-right transition ${currentPage === "customer-login" || currentPage === "maintenance" ? "text-gold-500" : "text-brand-800 dark:text-brand-100 hover:text-gold-500"}`}>طلب صيانة</button>
          <button onClick={() => handleNav("/contact")} className="bg-gold-500 text-white dark:text-brand-950 py-4 rounded-xl text-center font-bold hover:bg-gold-600 transition shadow-md">احجز وحدتك الآن</button>
        </div>
      )}
    </nav>
  );
}