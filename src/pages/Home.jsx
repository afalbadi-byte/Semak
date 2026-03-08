import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getImg } from '../utils/helpers';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-cover bg-center py-32" style={{ backgroundImage: `url('${getImg("1P0nERTU6SQiWHLf-53bpp1Jsjf120Kq4")}')` }}>
      <div className="absolute inset-0 hero-gradient" />
      <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center justify-center mt-10">
        <img src={getImg("1-d_n0rD8H8CZf_y6l1suQlcWThhmkBmb")} alt="شعار" className="h-20 md:h-32 mb-8 object-contain brightness-0 invert drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] opacity-95 hover:opacity-100 transition duration-500 hover:scale-105 transform" />
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl p-8 md:p-12 max-w-4xl w-full text-center relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#c5a059]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] font-bold text-xs md:text-sm mb-4 animate-pulse tracking-wide">
            فرصة استثمارية وسكنية حصرية
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">تحفة معمارية.. <span className="text-[#c5a059] text-glow">بـ 7 وحدات فقط</span></h1>
          <p className="text-slate-300 text-sm md:text-base mb-8 max-w-2xl mx-auto leading-relaxed font-light">
            نضع بين أيديكم خبرتنا الطويلة في سماك العقارية لنقدم مسكناً يجمع بين الخصوصية التامة والتقنيات الحديثة في قلب مكة المكرمة.
          </p>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-white/5 mb-10 md:divide-x md:divide-x-reverse">
            <div className="px-2">
              <span className="block text-3xl md:text-4xl font-black text-white mb-1">07</span>
              <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">وحدات سكنية</p>
            </div>
            <div className="px-2">
              <span className="block text-3xl md:text-4xl font-black text-white mb-1">+200</span>
              <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">متر مربع مساحة</p>
            </div>
            <div className="px-2">
              <span className="block text-3xl md:text-4xl font-black text-white mb-1">10</span>
              <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">سنوات ضمان</p>
            </div>
            <div className="px-2 border-none">
              <span className="block text-3xl md:text-4xl font-black text-white mb-1">100%</span>
              <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">تملك حر</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => navigate("/contact")} className="bg-[#c5a059] text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1">احجز معاينتك اليوم</button>
            <button onClick={() => navigate("/projects")} className="bg-white/5 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-white/10 transition">استكشف الفرصة</button>
          </div>
        </div>
      </div>
    </div>
  );
}