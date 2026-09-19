import React, { useEffect, useState } from 'react';
import { Play, Repeat } from 'lucide-react';
import AyahPicker from './AyahPicker';
import { ayahName, cmp } from '../lib/ayah';

// ─── «استمع من هذه الآية»: في نافذة الكلمة نفسها ─────────────────────────────
// تبدأ التلاوة من آية الكلمة الملموسة إلى آيةٍ يختارها (المقترح: آخر الورد أو آخر
// الصفحة)، بطريقة التكرار وعدده وسرعته، ثم تُدار من شريط التقليب أسفل الشاشة.
export default function ListenPanel({ from, defEnd, rec, onStart }) {
    const [to, setTo] = useState(defEnd && cmp(defEnd, from) >= 0 ? defEnd : from);
    useEffect(() => { setTo(defEnd && cmp(defEnd, from) >= 0 ? defEnd : from); }, [from, defEnd]);
    const { pref, setPref } = rec;
    return (
        <div className="mt-3 pt-3 border-t border-paper-2 space-y-2.5">
            <div className="text-[13px] font-bold text-ink">استمع من {ayahName(from)} · الشيخ محمد أيوب</div>
            <AyahPicker label="إلى" value={to} min={from} onChange={setTo} />
            <Row label="التكرار" icon>
                <Pill on={pref.mode === 'seg'} onClick={() => setPref({ ...pref, mode: 'seg' })}>المقطع كاملاً</Pill>
                <Pill on={pref.mode === 'ayah'} onClick={() => setPref({ ...pref, mode: 'ayah', n: pref.n || 3 })}>كل آية ثم التي بعدها</Pill>
            </Row>
            <Row label="عدد المرات">
                {[[1, 'مرة'], [3, '٣'], [5, '٥'], [10, '١٠'], [20, '٢٠']].concat(pref.mode === 'seg' ? [[0, '∞']] : []).map(([n, t]) => <Pill key={n} on={pref.n === n} onClick={() => setPref({ ...pref, n })}>{t}</Pill>)}
            </Row>
            <Row label="السرعة">
                {[[0.75, 'بطيئة'], [1, 'عادية'], [1.25, 'أسرع']].map(([n, t]) => <Pill key={n} on={pref.rate === n} onClick={() => setPref({ ...pref, rate: n })}>{t}</Pill>)}
            </Row>
            <button onClick={() => { rec.play([[from, to]]); onStart && onStart(); }}
                className="w-full h-12 rounded-2xl bg-brand text-white font-bold inline-flex items-center justify-center gap-2">
                <Play size={18} className="-scale-x-100" />ابدأ القراءة
            </button>
        </div>
    );
}

function Row({ label, icon, children }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[12px] text-ink-2 inline-flex items-center gap-1">{icon ? <Repeat size={12} /> : null}{label}</span>
            <div className="flex gap-1.5 flex-wrap">{children}</div>
        </div>
    );
}
const Pill = ({ on, onClick, children }) => (
    <button type="button" onClick={onClick} className={'h-8 min-w-[40px] px-2.5 rounded-lg text-[12px] font-semibold ' + (on ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>{children}</button>
);
