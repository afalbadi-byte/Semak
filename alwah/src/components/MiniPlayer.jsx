import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, BookOpenText } from 'lucide-react';
import { ayahName } from '../lib/ayah';

// ─── شريط التلاوة العائم: يظهر في كل الشاشات ما دام الشيخ يقرأ ────────────────
export default function MiniPlayer({ rec }) {
    const k = rec.current;
    return (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-paper/95 backdrop-blur border-t border-paper-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-3xl mx-auto h-16 px-3 flex items-center gap-1.5">
                <a href="#/hifz" className="w-10 h-10 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center text-ink-2" aria-label="افتح المصحف"><BookOpenText size={18} /></a>
                <div className="flex-1 min-w-0 text-center leading-tight">
                    <div className="text-[13px] font-bold text-ink truncate">{k ? ayahName(k) : 'تلاوة'}</div>
                    <div className="text-[11px] text-ink-3">الشيخ محمد أيوب</div>
                </div>
                <button onClick={() => rec.jump(-1)} className="w-9 h-9 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية السابقة"><SkipForward size={15} /></button>
                <button onClick={rec.toggle} className="w-11 h-11 rounded-2xl bg-brand text-white flex items-center justify-center" aria-label={rec.st.paused ? 'تشغيل' : 'إيقاف مؤقت'}>
                    {rec.st.paused ? <Play size={19} className="-scale-x-100" /> : <Pause size={19} />}
                </button>
                <button onClick={() => rec.jump(1)} className="w-9 h-9 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية التالية"><SkipBack size={15} /></button>
                <button onClick={rec.stop} className="w-9 h-9 rounded-xl bg-paper-2 flex items-center justify-center text-ink-3" aria-label="إيقاف"><Square size={13} /></button>
            </div>
        </div>
    );
}
