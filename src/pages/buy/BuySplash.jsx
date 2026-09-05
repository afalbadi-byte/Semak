import React, { useEffect, useState } from 'react';

// ─── شاشة الترحيب المتحركة — نحو ثلاث ثوان ونصف ثم تنسحب ────────────────────
// تعمل أثناء التحقق من الجلسة، فالوقت مستثمر لا مهدور.
const CSS = `
@keyframes semakFadeUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;} }
@keyframes semakPop    { 0% { opacity:0; transform:scale(.82);} 60% { opacity:1; transform:scale(1.04);} 100% { transform:scale(1);} }
@keyframes semakRing   { 0% { transform:scale(.9); opacity:.55;} 70% { transform:scale(1.35); opacity:0;} 100% { opacity:0;} }
@keyframes semakBar    { from { transform:scaleX(0);} to { transform:scaleX(1);} }
@keyframes semakGlow   { 0%,100% { opacity:.10;} 50% { opacity:.22;} }
@keyframes semakOut    { to { opacity:0; transform:scale(1.03);} }
.sp-wrap  { animation: semakOut .5s ease 3.0s forwards; }
.sp-logo  { animation: semakPop .9s cubic-bezier(.2,.8,.2,1) both; }
.sp-ring  { animation: semakRing 2.2s ease-out .5s infinite; }
.sp-name  { animation: semakFadeUp .7s ease .55s both; }
.sp-sub   { animation: semakFadeUp .7s ease .85s both; }
.sp-tag   { animation: semakFadeUp .7s ease 1.15s both; }
.sp-bar   { animation: semakBar 3.0s linear both; transform-origin: right; }
.sp-pat   { animation: semakGlow 3.4s ease-in-out infinite; }
`;

export default function BuySplash({ onDone, userName = '' }) {
    const [gone, setGone] = useState(false);
    useEffect(() => {
        const t1 = setTimeout(() => setGone(true), 3400);
        const t2 = setTimeout(() => onDone && onDone(), 3500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [onDone]);
    if (gone) return null;

    return (
        <div dir="rtl" className="fixed inset-0 z-[200] font-cairo overflow-hidden"
            style={{ background: 'linear-gradient(160deg,#1e3f70 0%,#0b1220 70%)' }}>
            <style>{CSS}</style>
            <img src="/images/pattern-semak.png" alt=""
                className="sp-pat absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'invert(1) brightness(1.7)', mixBlendMode: 'screen' }}
                onError={e => { e.currentTarget.style.display = 'none'; }} />

            <div className="sp-wrap absolute inset-0 flex flex-col items-center justify-center px-8">
                <div className="relative">
                    <span className="sp-ring absolute inset-0 rounded-[28px] border-2 border-[#c5a059]" />
                    <img src="/images/app-icon-512.png" alt="سماك"
                        className="sp-logo w-28 h-28 rounded-[28px] shadow-2xl"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>

                <h1 className="sp-name text-white text-[26px] font-black mt-6">مشتريات سماك</h1>
                <p className="sp-sub text-slate-300 text-[14px] mt-1.5 text-center">
                    {userName ? `يا هلا ${userName}` : 'فاتورة تُصوَّر، وسعر يُعرف، وسداد يُوثَّق'}
                </p>
                <p className="sp-tag text-[#c5a059] text-[12px] font-bold mt-4 tracking-wide">سماك العقارية</p>
            </div>

            <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10">
                <div className="sp-bar h-full bg-[#c5a059]" />
            </div>
        </div>
    );
}
