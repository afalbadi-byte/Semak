import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Repeat, Square } from 'lucide-react';
import { SURAHS } from '../lib/quran';

// ─── مُسمِع الشيخ محمد أيوب: آيةً آية، بتكرار الآية وتكرار المقطع ─────────────
// التلاوة من everyayah.com (ملفّ لكل آية)، فيختار الحافظ مقطعاً من آيةٍ إلى آية
// ويكرّر كل آيةٍ ما شاء ثم يعيد المقطع كلّه ما شاء، والآية المتلوّة تُظلَّل في المصحف.
const SRC = 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps/';
const pad = n => String(n).padStart(3, '0');
const url = k => { const [s, a] = k.split(':'); return SRC + pad(s) + pad(a) + '.mp3'; };
const PREF = 'alwah_rec_v1';
const loadPref = () => { try { return { each: 3, loops: 1, rate: 1, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (e) { return { each: 3, loops: 1, rate: 1 }; } };

export const ayahLabel = k => { const [s, a] = k.split(':'); return (SURAHS[s - 1] ? SURAHS[s - 1][0] : '') + ' ' + a; };

// ayahs: آيات الصفحة بالترتيب «سورة:آية»، range: المقطع المقترح [من، إلى]، pick: آيةٌ لُمست في المصحف
export default function Reciter({ ayahs, range, pick, onAyah }) {
    const [pref, setPref] = useState(loadPref);
    const [from, setFrom] = useState(0);
    const [to, setTo] = useState(0);
    const [st, setSt] = useState({ on: false, i: 0, rep: 1, loop: 1, paused: false });
    const audio = useRef(null);
    const stRef = useRef(st);
    stRef.current = st;

    const key = ayahs.join(',');
    // صفحةٌ جديدة أو مقطعٌ مقترح: يُضبط المقطع ويتوقّف التشغيل
    useEffect(() => {
        const f = range ? Math.max(0, ayahs.indexOf(range[0])) : 0;
        const t = range && ayahs.indexOf(range[1]) >= 0 ? ayahs.indexOf(range[1]) : ayahs.length - 1;
        setFrom(f); setTo(Math.max(f, t)); stop();
    }, [key, range && range.join('-')]); // eslint-disable-line react-hooks/exhaustive-deps

    // لمس رقم آيةٍ في المصحف: أوّل لمسةٍ بدايةُ المقطع، والثانية نهايته
    const tapRef = useRef(0);
    useEffect(() => {
        if (!pick) return;
        const i = ayahs.indexOf(pick.k);
        if (i < 0) return;
        if (tapRef.current % 2 === 0 || i < from) { setFrom(i); setTo(i); } else setTo(i);
        tapRef.current++;
    }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = p => { setPref(p); try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* تجاهل */ } };

    useEffect(() => { onAyah && onAyah(st.on ? ayahs[st.i] : null); }, [st.on, st.i]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => { if (audio.current) audio.current.pause(); onAyah && onAyah(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const playAt = (i, rep, loop) => {
        const a = audio.current || (audio.current = new Audio());
        a.onended = next;
        a.onerror = () => { stop(); };
        a.src = url(ayahs[i]);
        a.playbackRate = pref.rate;
        a.play().catch(() => {});
        setSt({ on: true, i, rep, loop, paused: false });
        // تحميل الآية التالية مسبقاً فلا ينقطع التكرار
        if (i + 1 <= to && ayahs[i + 1]) { const n = new Audio(); n.preload = 'auto'; n.src = url(ayahs[i + 1]); }
    };
    function next() {
        const s = stRef.current, p = loadPref();
        if (s.rep < p.each) return playAt(s.i, s.rep + 1, s.loop);
        if (s.i < toRef.current) return playAt(s.i + 1, 1, s.loop);
        if (p.loops === 0 || s.loop < p.loops) return playAt(fromRef.current, 1, s.loop + 1);
        stop();
    }
    const toRef = useRef(to); toRef.current = to;
    const fromRef = useRef(from); fromRef.current = from;

    function stop() { if (audio.current) audio.current.pause(); setSt({ on: false, i: 0, rep: 1, loop: 1, paused: false }); }
    const toggle = () => {
        if (!st.on) return playAt(from, 1, 1);
        const a = audio.current;
        if (st.paused) { a.play().catch(() => {}); setSt(s => ({ ...s, paused: false })); } else { a.pause(); setSt(s => ({ ...s, paused: true })); }
    };
    const jump = d => { const i = Math.min(to, Math.max(from, st.i + d)); playAt(i, 1, st.loop); };
    useEffect(() => { if (audio.current) audio.current.playbackRate = pref.rate; }, [pref.rate]);

    const opts = useMemo(() => ayahs.map((k, i) => <option key={k} value={i}>{ayahLabel(k)}</option>), [key]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!ayahs.length) return null;
    const count = to - from + 1;

    return (
        <div className="rounded-2xl bg-paper-card border border-paper-2 p-3 space-y-3">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink-3">تلاوة الشيخ محمد أيوب</div>
                    <div className="text-[14px] font-bold text-ink truncate">
                        {st.on ? `${ayahLabel(ayahs[st.i])} · تكرار ${st.rep}/${pref.each}${pref.loops !== 1 ? ` · الدورة ${st.loop}${pref.loops ? '/' + pref.loops : ''}` : ''}`
                            : `المقطع: ${count} ${count === 1 ? 'آية' : count <= 10 ? 'آيات' : 'آية'}`}
                    </div>
                </div>
                {st.on ? <button onClick={() => jump(-1)} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية السابقة"><SkipForward size={17} /></button> : null}
                <button onClick={toggle} className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shadow" aria-label={st.on && !st.paused ? 'إيقاف مؤقت' : 'تشغيل'}>
                    {st.on && !st.paused ? <Pause size={22} /> : <Play size={22} className="-scale-x-100" />}
                </button>
                {st.on ? <button onClick={() => jump(1)} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية التالية"><SkipBack size={17} /></button> : null}
                {st.on ? <button onClick={stop} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-3" aria-label="إيقاف"><Square size={15} /></button> : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-ink-3">من
                    <select className="mt-0.5 w-full h-10 rounded-xl bg-white border border-paper-2 px-2 text-[13px] text-ink" value={from}
                        onChange={e => { const v = +e.target.value; setFrom(v); if (to < v) setTo(v); }}>{opts}</select>
                </label>
                <label className="text-[11px] text-ink-3">إلى
                    <select className="mt-0.5 w-full h-10 rounded-xl bg-white border border-paper-2 px-2 text-[13px] text-ink" value={to}
                        onChange={e => { const v = +e.target.value; setTo(v); if (from > v) setFrom(v); }}>{opts}</select>
                </label>
            </div>

            <div className="space-y-2">
                <Row label="تكرار الآية">
                    {[1, 3, 5, 10, 20].map(n => <Pill key={n} on={pref.each === n} onClick={() => save({ ...pref, each: n })}>{n === 1 ? 'مرة' : n}</Pill>)}
                </Row>
                <Row label="تكرار المقطع" icon>
                    {[[1, 'مرة'], [3, '٣'], [5, '٥'], [10, '١٠'], [0, '∞']].map(([n, t]) => <Pill key={n} on={pref.loops === n} onClick={() => save({ ...pref, loops: n })}>{t}</Pill>)}
                </Row>
                <Row label="السرعة">
                    {[[0.75, 'بطيئة'], [1, 'عادية'], [1.25, 'أسرع']].map(([n, t]) => <Pill key={n} on={pref.rate === n} onClick={() => save({ ...pref, rate: n })}>{t}</Pill>)}
                </Row>
            </div>
            <p className="text-[11px] text-ink-3 leading-5">المس رقم الآية في المصحف لتبدأ المقطع منها، ثم المس رقم آخر آية لتنهيه.</p>
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
