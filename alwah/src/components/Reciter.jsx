import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Repeat, Square } from 'lucide-react';
import { ayahName, cmp, segsOf, segsAyahs } from '../lib/ayah';
import { AyahRange } from './AyahPicker';

// ─── مُسمِع الشيخ محمد أيوب ─────────────────────────────────────────────────
// المقطع من أيّ آيةٍ إلى أيّ آية في المصحف كلّه (السورة ورقم الآية وأوّل كلماتها)،
// والتلاوة آيةً آية من everyayah.com. طريقتان للتكرار: «المقطع كاملاً» يتلوه من
// أوّله إلى آخره ثم يعيده، و«كل آية» يكرّرها ثم ينتقل للتي بعدها.
// والآية المتلوّة تُظلَّل في المصحف، والمصحف يتبعها إلى صفحتها.
const SRC = 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps/';
const pad = n => String(n).padStart(3, '0');
const url = k => { const [s, a] = k.split(':'); return SRC + pad(s) + pad(a) + '.mp3'; };
const PREF = 'alwah_rec_v2';
const DEF = { mode: 'seg', n: 3, rate: 1 };
const loadPref = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (e) { return { ...DEF }; } };
const eachOf = p => (p.mode === 'ayah' ? Math.max(1, p.n || 1) : 1);
const loopsOf = p => (p.mode === 'seg' ? p.n : 1);

export const ayahLabel = ayahName;

// defRange: المقطع المقترح: قائمة مقاطع [[من، إلى]، …] (الورد قد يكون من سورٍ مختلفة)، seed: يتغيّر فيُعاد ضبط المقطع، pick: آيةٌ لُمست في المصحف
export default function Reciter({ defRange, seed, pick, onAyah }) {
    const [pref, setPref] = useState(loadPref);
    const [segs, setSegs] = useState(segsOf(defRange) || [['1:1', '1:7']]);
    const seg = [segs[0][0], segs[segs.length - 1][1]];
    const setSeg = v => setSegs([v]);
    const [st, setSt] = useState({ on: false, i: 0, rep: 1, loop: 1, paused: false });
    const audio = useRef(null);
    const stRef = useRef(st); stRef.current = st;
    const list = useMemo(() => segsAyahs(segs), [JSON.stringify(segs)]); // eslint-disable-line react-hooks/exhaustive-deps
    const listRef = useRef(list); listRef.current = list;

    // قسمٌ جديد أو فردٌ آخر: المقطع المقترح، ويتوقّف التشغيل
    useEffect(() => { const d = segsOf(defRange); if (d) { setSegs(d); stop(); } }, [seed, JSON.stringify(defRange)]); // eslint-disable-line react-hooks/exhaustive-deps

    // لمس رقم آيةٍ في المصحف: أوّل لمسةٍ بدايةُ المقطع، والثانية نهايته
    const tapRef = useRef(0);
    useEffect(() => {
        if (!pick) return;
        const k = pick.k;
        if (tapRef.current % 2 === 0 || cmp(k, seg[0]) < 0) setSeg([k, k]); else setSeg([seg[0], k]);
        tapRef.current++;
        stop();
    }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = p => { setPref(p); try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* تجاهل */ } };

    useEffect(() => { onAyah && onAyah(st.on ? list[st.i] : null); }, [st.on, st.i]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => { if (audio.current) audio.current.pause(); onAyah && onAyah(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const playAt = (i, rep, loop) => {
        const L = listRef.current;
        const a = audio.current || (audio.current = new Audio());
        a.onended = next;
        a.onerror = () => stop();
        a.src = url(L[i]);
        a.playbackRate = loadPref().rate;
        a.play().catch(() => {});
        setSt({ on: true, i, rep, loop, paused: false });
        // تحميل الآية التالية مسبقاً فلا ينقطع التكرار
        if (L[i + 1]) { const n = new Audio(); n.preload = 'auto'; n.src = url(L[i + 1]); }
    };
    function next() {
        const s = stRef.current, p = loadPref(), L = listRef.current;
        const each = eachOf(p), loops = loopsOf(p);
        if (s.rep < each) return playAt(s.i, s.rep + 1, s.loop);
        if (s.i < L.length - 1) return playAt(s.i + 1, 1, s.loop);
        if (loops === 0 || s.loop < loops) return playAt(0, 1, s.loop + 1);
        stop();
    }
    function stop() { if (audio.current) audio.current.pause(); setSt({ on: false, i: 0, rep: 1, loop: 1, paused: false }); }
    const toggle = () => {
        if (!st.on) return playAt(0, 1, 1);
        const a = audio.current;
        if (st.paused) { a.play().catch(() => {}); setSt(s => ({ ...s, paused: false })); } else { a.pause(); setSt(s => ({ ...s, paused: true })); }
    };
    const jump = d => playAt(Math.min(list.length - 1, Math.max(0, st.i + d)), 1, st.loop);
    useEffect(() => { if (audio.current) audio.current.playbackRate = pref.rate; }, [pref.rate]);

    const count = list.length;
    return (
        <div className="rounded-2xl bg-paper-card border border-paper-2 p-3 space-y-3">
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink-3">تلاوة الشيخ محمد أيوب</div>
                    <div className="text-[14px] font-bold text-ink truncate">
                        {st.on ? `${ayahName(list[st.i])} · ${pref.mode === 'seg' ? `المقطع ${st.loop}${pref.n ? '/' + pref.n : ''}` : `الآية ${st.rep}/${eachOf(pref)}`}`
                            : `المقطع: ${count} ${count === 1 ? 'آية' : count <= 10 ? 'آيات' : 'آية'}${segs.length > 1 ? ` من ${segs.length} سور` : ''}`}
                    </div>
                </div>
                {st.on ? <button onClick={() => jump(-1)} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية السابقة"><SkipForward size={17} /></button> : null}
                <button onClick={toggle} className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shadow" aria-label={st.on && !st.paused ? 'إيقاف مؤقت' : 'تشغيل'}>
                    {st.on && !st.paused ? <Pause size={22} /> : <Play size={22} className="-scale-x-100" />}
                </button>
                {st.on ? <button onClick={() => jump(1)} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-2" aria-label="الآية التالية"><SkipBack size={17} /></button> : null}
                {st.on ? <button onClick={stop} className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink-3" aria-label="إيقاف"><Square size={15} /></button> : null}
            </div>

            <AyahRange from={seg[0]} to={seg[1]} onChange={v => { stop(); setSeg(v); }} labels={['بداية المقطع', 'نهاية المقطع']} />

            <div className="space-y-2">
                <Row label="التكرار" icon>
                    <Pill on={pref.mode === 'seg'} onClick={() => save({ ...pref, mode: 'seg' })}>المقطع كاملاً</Pill>
                    <Pill on={pref.mode === 'ayah'} onClick={() => save({ ...pref, mode: 'ayah', n: pref.n || 3 })}>كل آية ثم التي بعدها</Pill>
                </Row>
                <Row label="عدد المرات">
                    {[[1, 'مرة'], [3, '٣'], [5, '٥'], [10, '١٠'], [20, '٢٠']].concat(pref.mode === 'seg' ? [[0, '∞']] : []).map(([n, t]) => <Pill key={n} on={pref.n === n} onClick={() => save({ ...pref, n })}>{t}</Pill>)}
                </Row>
                <Row label="السرعة">
                    {[[0.75, 'بطيئة'], [1, 'عادية'], [1.25, 'أسرع']].map(([n, t]) => <Pill key={n} on={pref.rate === n} onClick={() => save({ ...pref, rate: n })}>{t}</Pill>)}
                </Row>
            </div>
            <p className="text-[11px] text-ink-3 leading-5">اختر السورة والآية للبداية والنهاية من أيّ موضعٍ في المصحف، أو المس رقم الآية في المصحف لتبدأ منها ثم المس رقم آخر آية.</p>
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
