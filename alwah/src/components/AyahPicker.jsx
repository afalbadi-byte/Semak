import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { SURAHS } from '../lib/quran';
import { AYAT, parse, key, chapter } from '../lib/ayah';

// ─── اختيار آية: بالسورة ورقم الآية، مع بحثٍ بالاسم أو الرقم أو أوّل الكلمات ───
// القوائم الطويلة (١١٤ سورة و٢٨٦ آية) يصعب تصفّحها، فلكلٍّ نافذةُ بحث.
const norm = s => String(s).replace(/[ً-ْٰـء]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const digits = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

export default function AyahPicker({ label, value, onChange, min }) {
    const { s, a } = parse(value || '1:1');
    const [ch, setCh] = useState(null);
    const [open, setOpen] = useState(null);      // 'sura' | 'ayah'
    useEffect(() => {
        let dead = false; setCh(null);
        chapter(s).then(c => { if (!dead) setCh(c); }).catch(() => {});
        return () => { dead = true; };
    }, [s]);
    const info = ch ? ch[a - 1] : null;
    const lo = min ? parse(min) : null;
    const btn = 'h-10 rounded-xl bg-white border border-paper-2 px-2.5 text-[13px] text-ink w-full flex items-center gap-1 justify-between';

    return (
        <div className="space-y-1">
            {label ? <div className="text-[11px] text-ink-3">{label}</div> : null}
            <div className="grid grid-cols-[112px_1fr] gap-1.5">
                <button type="button" className={btn} onClick={() => setOpen('sura')}>
                    <span className="truncate">{s}. {SURAHS[s - 1][0]}</span><ChevronDown size={14} className="text-ink-3 shrink-0" />
                </button>
                <button type="button" className={btn} onClick={() => setOpen('ayah')}>
                    <span className="truncate tabular-nums">{a}{info ? ' · ' + info.t : ''}</span><ChevronDown size={14} className="text-ink-3 shrink-0" />
                </button>
            </div>
            <div className="font-quran text-[17px] leading-8 text-ink truncate min-h-[32px]">
                {info ? <>«{info.t}…» <span className="font-sans text-[11px] text-ink-3">ص {info.p}</span></> : <span className="font-sans text-[11px] text-ink-3">…</span>}
            </div>

            {open === 'sura' ? (
                <Picker title="اختر السورة" hint="اكتب اسم السورة أو رقمها"
                    rows={SURAHS.map(([n], i) => ({ id: i + 1, t: (i + 1) + '. ' + n, find: norm(n) + ' ' + (i + 1) }))
                        .filter(r => !lo || r.id >= lo.s)}
                    onPick={id => { onChange(key(id, id === (lo && lo.s) ? lo.a : 1)); setOpen(null); }}
                    onClose={() => setOpen(null)} active={s} />
            ) : null}

            {open === 'ayah' ? (
                <Picker title={'آيات سورة ' + SURAHS[s - 1][0]} hint="اكتب رقم الآية أو أوّل كلماتها"
                    rows={Array.from({ length: AYAT[s - 1] }, (_, i) => i + 1)
                        .filter(n => !(lo && s === lo.s && n < lo.a))
                        .map(n => ({ id: n, t: n + (ch && ch[n - 1] ? ' · ' + ch[n - 1].t : ''), find: n + ' ' + (ch && ch[n - 1] ? norm(ch[n - 1].t) : '') }))}
                    onPick={n => { onChange(key(s, n)); setOpen(null); }}
                    onClose={() => setOpen(null)} active={a} quran />
            ) : null}
        </div>
    );
}

// نافذة اختيارٍ ببحث: تُرشِّح بالاسم أو الرقم أو أوّل الكلمات
export function Picker({ title, hint, rows, onPick, onClose, active, quran }) {
    const [q, setQ] = useState('');
    const inp = useRef(null);
    const box = useRef(null);
    useEffect(() => { const t = setTimeout(() => inp.current && inp.current.focus(), 60); return () => clearTimeout(t); }, []);
    useEffect(() => {
        const el = box.current && box.current.querySelector('[data-active="1"]');
        if (el) el.scrollIntoView({ block: 'center' });
    }, []);
    const list = useMemo(() => {
        const t = norm(digits(q));
        if (!t) return rows;
        return rows.filter(r => r.find.includes(t));
    }, [q, rows]);

    return (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md bg-paper rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col">
                <div className="p-3 border-b border-paper-2 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="font-bold text-ink flex-1">{title}</div>
                        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-3" aria-label="إغلاق"><X size={18} /></button>
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-3" />
                        <input ref={inp} value={q} onChange={e => setQ(e.target.value)} placeholder={hint} inputMode="search"
                            className="w-full h-11 ps-9 pe-3 rounded-xl bg-white border border-paper-2 text-[14px] outline-none focus:border-brand" />
                    </div>
                </div>
                <div ref={box} className="flex-1 overflow-y-auto p-2">
                    {list.length ? list.map(r => (
                        <button key={r.id} data-active={r.id === active ? '1' : undefined} onClick={() => onPick(r.id)}
                            className={'w-full text-start px-3 py-2.5 rounded-xl flex items-center gap-2 ' + (r.id === active ? 'bg-brand-50 text-brand-800 font-bold' : 'hover:bg-paper-2')}>
                            <span className="text-[12px] text-ink-3 tabular-nums w-8 shrink-0">{r.id}</span>
                            <span className={'flex-1 min-w-0 truncate ' + (quran ? 'font-quran text-[16px]' : 'text-[14px]')}>{r.t.replace(/^\d+\.?\s*/, '')}</span>
                            {r.note ? <span className="text-[11px] text-ink-3 shrink-0 tabular-nums">{r.note}</span> : null}
                        </button>
                    )) : <p className="text-center text-[13px] text-ink-3 py-8">لا نتيجة</p>}
                </div>
            </div>
        </div>
    );
}

// من آية إلى آية
export function AyahRange({ from, to, onChange, labels = ['من', 'إلى'] }) {
    return (
        <div className="grid grid-cols-1 gap-2">
            <AyahPicker label={labels[0]} value={from} onChange={f => onChange([f, cmpLE(f, to) ? to : f])} />
            <AyahPicker label={labels[1]} value={to} min={from} onChange={t => onChange([from, t])} />
        </div>
    );
}
const cmpLE = (x, y) => { const p = parse(x), q = parse(y); return p.s < q.s || (p.s === q.s && p.a <= q.a); };
