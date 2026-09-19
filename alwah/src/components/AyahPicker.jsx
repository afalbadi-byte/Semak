import React, { useEffect, useState } from 'react';
import { SURAHS } from '../lib/quran';
import { AYAT, parse, key, ayahInfo } from '../lib/ayah';

// ─── اختيار آية: السورة ورقم الآية، وتحتهما أوّل أربع كلمات منها وصفحتها ─────
export default function AyahPicker({ label, value, onChange, min }) {
    const { s, a } = parse(value || '1:1');
    const [info, setInfo] = useState(null);
    useEffect(() => {
        let dead = false; setInfo(null);
        ayahInfo(key(s, a)).then(i => { if (!dead) setInfo(i); }).catch(() => {});
        return () => { dead = true; };
    }, [s, a]);
    const lo = min ? parse(min) : null;
    const sel = 'h-10 rounded-xl bg-white border border-paper-2 px-2 text-[13px] text-ink w-full';
    return (
        <div className="space-y-1">
            {label ? <div className="text-[11px] text-ink-3">{label}</div> : null}
            <div className="grid grid-cols-[1fr_84px] gap-1.5">
                <select className={sel} value={s} onChange={e => onChange(key(+e.target.value, 1))}>
                    {SURAHS.map(([n], i) => (lo && i + 1 < lo.s ? null : <option key={i} value={i + 1}>{i + 1}. {n}</option>))}
                </select>
                <select className={sel + ' tabular-nums'} value={a} onChange={e => onChange(key(s, +e.target.value))} aria-label="رقم الآية">
                    {Array.from({ length: AYAT[s - 1] }, (_, i) => i + 1).map(n => (lo && s === lo.s && n < lo.a ? null : <option key={n} value={n}>آية {n}</option>))}
                </select>
            </div>
            <div className="font-quran text-[17px] leading-8 text-ink truncate min-h-[32px]">
                {info ? <>«{info.t}…» <span className="font-sans text-[11px] text-ink-3">ص {info.p}</span></> : <span className="font-sans text-[11px] text-ink-3">…</span>}
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
