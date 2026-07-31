import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import PageMeta from '../components/PageMeta';

const galleryImages = [
  { src: '/images/exterior-front.jpg',         label: 'الواجهة الأمامية',  category: 'exterior' },
  { src: '/images/exterior-side.jpg',          label: 'الواجهة الجانبية',  category: 'exterior' },
  { src: '/images/exterior-corner.jpg',        label: 'زاوية المشروع',     category: 'exterior' },
  { src: '/images/interior-lobby.jpg',         label: 'المدخل الرئيسي',    category: 'interior' },
  { src: '/images/interior-unit-entrance.jpg', label: 'مدخل الشقة',        category: 'interior' },
  { src: '/images/interior-corridor.jpg',      label: 'الممر الداخلي',     category: 'interior' },
  { src: '/images/interior-kitchen.jpg',       label: 'المطبخ',            category: 'interior' },
  { src: '/images/interior-bedroom.jpg',       label: 'غرفة النوم',        category: 'interior' },
  { src: '/images/interior-bathroom.jpg',      label: 'الحمام',            category: 'interior' },
  { src: '/images/interior-living.jpg',        label: 'غرفة المعيشة',      category: 'interior' },
  { src: '/images/interior-elevator.jpg',      label: 'المصعد',            category: 'interior' },
  { src: '/images/interior-staircase.jpg',     label: 'الدرج الداخلي',     category: 'interior' },
  { src: '/images/interior-parking.jpg',       label: 'موقف السيارات',     category: 'interior' },
];

const FILTERS = [
  { id: 'all',      label: 'الكل' },
  { id: 'exterior', label: 'الواجهات الخارجية' },
  { id: 'interior', label: 'التصاميم الداخلية' },
];

export default function Gallery() {
  const [filter, setFilter]       = useState('all');
  const [activeIndex, setActive]  = useState(0);
  const [modal, setModal]         = useState(null);
  const stripRef                  = useRef(null);

  const filtered = filter === 'all' ? galleryImages : galleryImages.filter(g => g.category === filter);
  const current  = filtered[activeIndex] ?? filtered[0];

  useEffect(() => { setActive(0); }, [filter]);

  useEffect(() => {
    const el = stripRef.current?.children[activeIndex];
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    const fn = (e) => {
      if (modal) {
        if (e.key === 'ArrowRight') setModal(m => ({ ...m, i: (m.i - 1 + filtered.length) % filtered.length }));
        if (e.key === 'ArrowLeft')  setModal(m => ({ ...m, i: (m.i + 1) % filtered.length }));
        if (e.key === 'Escape')     setModal(null);
      } else {
        if (e.key === 'ArrowRight') setActive(i => (i - 1 + filtered.length) % filtered.length);
        if (e.key === 'ArrowLeft')  setActive(i => (i + 1) % filtered.length);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [modal, filtered]);

  const prev = (e) => { e.stopPropagation(); setActive(i => (i - 1 + filtered.length) % filtered.length); };
  const next = (e) => { e.stopPropagation(); setActive(i => (i + 1) % filtered.length); };
  const prevM = (e) => { e.stopPropagation(); setModal(m => ({ ...m, i: (m.i - 1 + filtered.length) % filtered.length })); };
  const nextM = (e) => { e.stopPropagation(); setModal(m => ({ ...m, i: (m.i + 1) % filtered.length })); };

  return (
    <>
      <PageMeta title="معرض صور سماك البوابة 1" description="استعرض صور مشروع سماك البوابة 1 — واجهات خارجية وتصاميم داخلية فاخرة في حي البوابة، مكة المكرمة." />

      <div className="min-h-screen bg-slate-50 dark:bg-brand-950 py-8 px-4">

        {/* شعار */}
        <div className="flex justify-center mb-8">
          <a href="https://semak.sa">
            <img src="/images/logo-main.png" alt="سماك العقارية" className="h-14 object-contain" />
          </a>
        </div>

        {/* عنوان */}
        <div className="text-center mb-8">
          <p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-2">استكشف المشروع</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#1a365d] dark:text-brand-100">معرض صور البوابة 1</h1>
        </div>

        {/* فلاتر */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {FILTERS.map(tab => {
            const count  = tab.id === 'all' ? galleryImages.length : galleryImages.filter(g => g.category === tab.id).length;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border-2 transition-all duration-300 ${
                  active
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-lg'
                    : 'text-[#1a365d] dark:text-brand-300 border-[#1a365d]/20 dark:border-brand-700 hover:border-[#1a365d]/60 bg-white dark:bg-brand-900'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-black ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* بطاقة المعرض */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-brand-900 rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 dark:border-brand-700">

          {/* الصورة الرئيسية */}
          <div
            className="relative h-[300px] sm:h-[420px] md:h-[540px] overflow-hidden bg-slate-900 cursor-pointer group"
            onClick={() => setModal({ i: activeIndex })}
          >
            <img
              key={current?.src}
              src={current?.src}
              alt={current?.label}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03] animate-fadeIn"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 right-0 left-0 p-5 flex items-end justify-between pointer-events-none">
              <div>
                <p className="text-white font-black text-lg md:text-2xl drop-shadow-lg">{current?.label}</p>
                <p className="text-white/60 text-sm font-bold mt-1">{activeIndex + 1} / {filtered.length}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 group-hover:bg-white/40 transition pointer-events-auto">
                <ZoomIn size={20} className="text-white" />
              </div>
            </div>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10" onClick={prev}>
              <ChevronRight size={22} />
            </button>
            <button className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10" onClick={next}>
              <ChevronLeft size={22} />
            </button>
          </div>

          {/* شريط مصغرات */}
          <div className="p-4 bg-slate-50 dark:bg-brand-900/60 border-t border-slate-100 dark:border-brand-700">
            <div
              ref={stripRef}
              className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200 dark:[&::-webkit-scrollbar-track]:bg-brand-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-brand-600"
            >
              {filtered.map((img, i) => (
                <div
                  key={img.src}
                  onClick={() => setActive(i)}
                  className={`flex-shrink-0 w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-250 border-2 ${
                    i === activeIndex
                      ? 'border-[#c5a059] shadow-lg shadow-[#c5a059]/30 scale-[1.06]'
                      : 'border-transparent opacity-55 hover:opacity-90 hover:scale-[1.03]'
                  }`}
                >
                  <img src={img.src} alt={img.label} loading="lazy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* رابط الموقع */}
        <p className="text-center mt-8 text-slate-400 dark:text-brand-500 text-sm">
          <a href="https://semak.sa/projects" className="text-[#c5a059] font-bold hover:underline">عرض تفاصيل المشروع الكاملة</a>
        </p>

      </div>

      {/* مودال الحجم الكامل */}
      {modal && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-fadeIn" onClick={() => setModal(null)}>
          <button className="absolute top-5 left-5 bg-white/10 hover:bg-white/25 text-white w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition z-20" onClick={() => setModal(null)}>
            <X size={20} />
          </button>
          <div className="absolute top-5 right-5 text-white/70 text-sm font-bold bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm z-20">
            {modal.i + 1} / {filtered.length}
          </div>
          <img
            src={filtered[modal.i]?.src}
            alt={filtered[modal.i]?.label}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl z-10 select-none"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white font-bold text-sm bg-black/50 px-6 py-2.5 rounded-full backdrop-blur-sm z-20 whitespace-nowrap">
            {filtered[modal.i]?.label}
          </div>
          {filtered.length > 1 && (
            <>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition z-20" onClick={prevM}>
                <ChevronRight size={26} />
              </button>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition z-20" onClick={nextM}>
                <ChevronLeft size={26} />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
