import React from 'react';
import { useLocation } from 'react-router-dom';


export default function Partners() {
  const location = useLocation();
  
  // 🔴 التعديل هنا: تحديد الصفحات التي سيختفي منها شريط شركاء النجاح
  const hideOnPaths = ["login", "customer-login", "portal", "maintenance", "dashboard", "tech-dashboard", "letter-generator", "admin"];
  const shouldHide = hideOnPaths.some(path => location.pathname.toLowerCase().includes(path));

  // إذا كانت الصفحة الحالية من ضمن القائمة فوق، لا تعرض شيئاً (إخفاء)
  if (shouldHide) return null;

  const partners = [
    "/images/partner-1.png", "/images/partner-2.png", "/images/partner-3.png",
    "/images/partner-4.png", "/images/partner-5.png", "/images/partner-6.png",
    "/images/partner-7.png", "/images/partner-8.png", "/images/partner-9.png",
    "/images/partner-10.png"
  ];
  
  return (
    <div className="py-10 bg-white border-t border-slate-100 overflow-hidden no-print" id="partners-section">
      <div className="container mx-auto text-center mb-8">
        <h2 className="text-[#c5a059] font-black tracking-[0.3em] text-sm mb-2">شركاء النجاح</h2>
        <h3 className="text-2xl md:text-3xl font-black text-[#1a365d]">نختار الأفضل لبناء منزلك</h3>
      </div>
      <div className="marquee-container relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        {[1, 2, 3].map(i => (
          <div key={i} className="marquee-content gap-8 pr-8" aria-hidden={i !== 1}>
            {partners.map((p, j) => (
              <div key={j} className="w-32 h-20 flex items-center justify-center shrink-0">
                <img src={p} className="max-w-full max-h-full object-contain transition duration-300 hover:scale-110" alt="شريك" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}