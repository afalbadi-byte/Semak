import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { loadPage, loadFont, fontName, surahName, prefetch, pageMarks } from '../lib/mushaf';

// ─── صفحة المصحف ────────────────────────────────────────────────────────────
// كل كلمةٍ زرّ: تُلمس فتُعلَّم خطأً أو تنبيهاً في مصحف صاحبها. والعلامات تتدرّج
// لوناً بعدد مرّاتها، فيرى الحافظ مواضع ضعفه على الصفحة نفسها.
const BASE = 22;

export function markStyle(m) {
    if (!m || (!m.err && !m.warn)) return null;
    if (m.resolved) return { background: 'rgba(22,163,74,.12)', boxShadow: 'inset 0 -2px 0 rgba(22,163,74,.55)' };
    if (m.err) {
        const a = Math.min(0.42, 0.14 + m.err * 0.07);
        return { background: `rgba(220,38,38,${a})`, boxShadow: 'inset 0 -2px 0 rgba(185,28,28,.8)' };
    }
    const a = Math.min(0.4, 0.14 + m.warn * 0.07);
    return { background: `rgba(217,119,6,${a})`, boxShadow: 'inset 0 -2px 0 rgba(180,83,9,.75)' };
}

// hl: الآية المتلوّة الآن «سورة:آية» تُظلَّل، onAyah: لمس رقم الآية يختارها
// hide: أسطرٌ مخفيّة للتسميع الذاتي (تُلمس فتنكشف عبر onLine)، shown: كلماتٌ بعينها
// تنكشف داخل السطر المخفيّ وهو يسمّع، focus: [من، إلى] أسطر حفظ اليوم وما عداها باهت
export default function Mushaf({ page, marks = {}, onWord, selected, readOnly, hide, shown, onLine, focus, hl, onAyah }) {
    const [data, setData] = useState(null);
    const [mk, setMk] = useState(null);          // علامات الصفحة: الأرباع والسجدات
    const [err, setErr] = useState('');
    const [ready, setReady] = useState(false);
    const [size, setSize] = useState(BASE);
    const box = useRef(null);
    const meas = useRef(null);
    const pg = useRef(null);

    useEffect(() => {
        let dead = false;
        setData(null); setErr(''); setReady(false);
        setMk(null);
        pageMarks(page).then(x => { if (!dead) setMk(x); }).catch(() => {});
        Promise.all([loadPage(page), loadFont(page)])
            .then(([d]) => { if (!dead) { setData(d); setReady(true); prefetch(page); } })
            .catch(() => { if (!dead) setErr('تعذّر تحميل الصفحة، تحقق من الإنترنت'); });
        return () => { dead = true; };
    }, [page]);

    // حجم الخطّ: أعرض سطرٍ في الصفحة يملأ عرض الإطار
    useLayoutEffect(() => {
        if (!ready || !box.current || !meas.current) return undefined;
        const fit = () => {
            const w = box.current.clientWidth - 18;
            let max = 1;
            meas.current.querySelectorAll('[data-line]').forEach(el => { max = Math.max(max, el.scrollWidth); });
            // صفحتا الفاتحة وأوّل البقرة: أسطرٌ قصيرة في الوسط بفواصل بين الكلمات، فتُصغَّر لتتّسع
            const s = Math.max(12, Math.min(44, ((BASE * w) / max) * (data && data.short ? 0.74 : 0.97)));
            setSize(Math.floor(s * 10) / 10);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(box.current);
        return () => ro.disconnect();
    }, [ready, data]);

    // حارسٌ بعد الرسم: إن خرج سطرٌ عن الإطار (خطٌّ يُرسم أعرض على جهازٍ ما) صغُر الخطّ حتى يتّسع
    useLayoutEffect(() => {
        if (!ready || !pg.current) return;
        let over = 1;
        pg.current.querySelectorAll('[data-row]').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) over = Math.max(over, el.scrollWidth / el.clientWidth); });
        if (over > 1) setSize(z => Math.max(12, Math.floor((z / over) * 0.99 * 10) / 10));
    }, [size, ready]);

    // التلاوة تنزل إلى آيةٍ خارج الشاشة: تنزل المعاينة معها فتبقى الآية في الوسط
    useEffect(() => {
        if (!hl || !ready || !pg.current) return;
        const el = pg.current.querySelector('[data-ak="' + hl + '"]');
        if (!el) return;
        const r = el.getBoundingClientRect();
        // شريط التقليب يغطّي أسفل الشاشة: ننزل قبل أن تصل الآية إليه
        if (r.top < 80 || r.bottom > window.innerHeight - 150) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [hl, ready, page]);

    if (err) return <div className="py-16 text-center text-ink-3 text-[13px]"><WifiOff className="mx-auto mb-2" size={22} />{err}</div>;
    if (!data || !ready) return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-brand" size={26} /></div>;

    const ff = fontName(page);
    const L = [];
    for (let i = 1; i <= 15; i++) L.push(i);

    return (
        <div ref={box} className="relative w-full">
            {/* قياس خفيّ لأعرض سطر بالحجم الأساس */}
            <div ref={meas} aria-hidden className="invisible pointer-events-none" style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden', fontFamily: ff, fontSize: BASE, whiteSpace: 'nowrap', direction: 'rtl' }}>
                {/* الكلمات بحشوتها نفسها في الصفحة، فيطابق القياسُ العرضَ الفعلي */}
                {L.map(i => data.lines[i] ? <div key={i} data-line style={{ display: 'inline-block' }}>{data.lines[i].map(w => <span key={w.k} style={w.end ? undefined : { padding: '0 .04em' }}>{w.c}</span>)}</div> : null)}
            </div>

            <div ref={pg} className="mushaf-page rounded-2xl bg-[#fffaf0] border border-[#e8dcc0] px-4 py-3 select-none relative" dir="rtl"
                style={{ fontFamily: ff, fontSize: size, lineHeight: 1.95 }}>
                {L.map(i => {
                    const words = data.lines[i];
                    const head = data.heads[i];
                    if (head && head.type === 'name') return (
                        <div key={i} className="flex items-center justify-center" style={{ height: size * 1.95 }}>
                            <div className="px-6 rounded-full border-2 border-[#c9a45b] bg-[#f4e7c6] text-[#6b4f1d] font-quran" style={{ fontSize: size * 0.72, lineHeight: 1.7 }}>
                                سورة {surahName(head.s)}
                            </div>
                        </div>
                    );
                    if (head && head.type === 'bism') return (
                        <div key={i} className="text-center font-quran text-ink" style={{ fontSize: size * 0.8, height: size * 1.95, lineHeight: `${size * 1.95}px` }}>
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                        </div>
                    );
                    if (!words) return data.short ? null : <div key={i} style={{ height: size * 1.95 }} />;
                    const hid = hide && hide.has(i);
                    const rub = mk && mk.m && mk.m.find(x => x.l === i);
                    const saj = mk && mk.s && mk.s.find(x => x.l === i);
                    const dim = focus && (i < focus[0] || i > focus[1]);
                    return (
                        <div key={i} data-row onClick={hid && onLine ? () => onLine(i) : undefined}
                            className={'flex relative transition ' + (data.short ? 'justify-center gap-[0.35em]' : 'justify-between') + (hid ? ' cursor-pointer' : '')}
                            style={{ whiteSpace: 'nowrap', opacity: dim && !hid ? 0.32 : 1 }}>
                            {hid ? <span aria-hidden className="absolute inset-x-1 rounded-lg bg-[#efe3c4]" style={{ top: '22%', bottom: '22%' }} /> : null}
                            {rub ? <span title={'الجزء ' + rub.juz + ' · الحزب ' + rub.hizb} className="absolute text-[#b8893a] select-none" style={{ insetInlineStart: -14, fontSize: Math.min(15, size * 0.6), lineHeight: 1 }}>۞</span> : null}
                            {saj ? <span title={'موضع سجدة'} className="absolute text-[#8a6a2c] select-none" style={{ insetInlineEnd: -14, fontSize: Math.min(15, size * 0.6), lineHeight: 1 }}>۩</span> : null}
                            {words.map((w, wi) => {
                                if (hid) {
                                    // الكلمة التي قرأها تظهر وحدها فوق الشريط، وبقيّة السطر مستورة
                                    // رقم الآية يظهر مع آخر كلمةٍ منها
                                    const prev = w.end && wi > 0 ? words[wi - 1] : null;
                                    const seen = shown && shown.has(prev ? prev.k : w.k);
                                    return <span key={w.k} className={seen ? 'al-word-in' : undefined}
                                        style={seen ? { position: 'relative' } : { visibility: 'hidden' }}>{w.c}</span>;
                                }
                                const ak = w.k.slice(0, w.k.lastIndexOf(':'));
                                const on = hl && ak === hl;
                                if (w.end) return <span key={w.k} onClick={onAyah ? () => onAyah(ak) : undefined} className={'text-[#8a6a2c] rounded-full ' + (onAyah ? 'cursor-pointer ' : '') + (on ? 'bg-[#f4e7c6]' : '')}>{w.c}</span>;
                                const m = marks[w.k];
                                const st = markStyle(m);
                                const sel = selected === w.k;
                                return (
                                    <span key={w.k} data-ak={ak} role={readOnly ? undefined : 'button'} tabIndex={readOnly ? undefined : 0}
                                        onClick={readOnly || !onWord ? undefined : e => onWord(w, e.currentTarget.getBoundingClientRect())}
                                        className={'rounded-[6px] transition ' + (readOnly ? '' : 'cursor-pointer hover:bg-brand-50 ') + (sel ? 'ring-2 ring-brand' : '')}
                                        style={{ ...(on ? { background: 'rgba(31,95,74,.13)' } : {}), ...(st || {}), padding: '0 .04em' }} title={w.t}>
                                        {w.c}
                                    </span>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
