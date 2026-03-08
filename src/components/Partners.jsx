import React from 'react';
import { useLocation } from 'react-router-dom';
import { getImg } from '../utils/helpers';

export default function Partners() {
  const location = useLocation();
  
  // إخفاء هذا القسم في صفحات لوحة التحكم
  const hideOn = ["/login", "/customer-login", "/admin/dashboard", "/admin/letter-generator", "/admin/tech-dashboard"];
  if (hideOn.includes(location.pathname)) return null;

  const partners = [
    "18kk3r0kSgBdkQvCj7KC3fe29SQt4s_Y_", "1CFm4oTf091j04ndhYBhN4-LiirPgsywc", "1Ho4XCxeEQHTt4QRHJQnGbhSNCybY9Kli",
    "1T_LJDA_3XAAHSHl3DLib9foDVsQHjrCE", "10BuljftpVn9MsU2XbFJQ6zkRnM4djnGs", "1DwooJvRW8QrG-pDa1am0JDjbiVNp3AKP",
    "1Tcfv84RKa5YJ7ao-ktt9HLAk9TKQLy4F", "144wMG57xjPdnX1SYoBTzlQu0XEbIWiO3", "1NG-fNtmh8Nm2qxZdTPZs3IYlYgQGxOr8",
    "1H1f5ByalQMYeNi91qq5eEzXIwY1GCpPZ"
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
                <img src={getImg(p, "w500")} className="max-w-full max-h-full object-contain transition duration-300 hover:scale-110" alt="شريك" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}