import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, X, Lightbulb, RotateCcw, CheckCircle2 } from 'lucide-react';
import { asrSupported, loadAsr, asrReady, listen } from '../lib/asr';
import { tracker } from '../lib/match';
import { ayahName } from '../lib/ayah';
import { call } from '../lib/api';

// ─── التسميع الذاتي ─────────────────────────────────────────────────────────
// الصفحة مخفيّة، فإذا قرأ الحافظ آيةً صحيحةً انكشفت. وإن أخطأ ومض الإطار أحمر
// واهتزّ الجوال ووقف عند الكلمة حتى يصيبها، وله أن يطلب التلقين.
// كل ما يُسمع يُعالج على الجهاز، ولا يُرفع صوتٌ إلى أيّ خادم.
export default function SelfRecite({ page, data, lines, focus, member, onReveal, onHideAll, onClose }) {
    const [stage, setStage] = useState('idle');     // idle | loading | live | done
    const [pct, setPct] = useState(0);
    const [err, setErr] = useState('');
    const [flash, setFlash] = useState(0);
    const [hint, setHint] = useState(null);
    const [level, setLevel] = useState(0);
    const [stat, setStat] = useState({ ok: 0, bad: 0 });
    const [heard, setHeard] = useState('');        // آخر ما سمعه المتعرّف — يُري القارئ سبب التوقّف
    const trk = useRef(null);
    const mic = useRef(null);
    const mistakes = useRef([]);                     // مواضع الخطأ لتُعلَّم على المصحف

    // النصّ المنتظر: كلمات الصفحة بترتيبها، مقصورةً على أسطر الحفظ إن وُجدت
    useEffect(() => {
        if (!data) return;
        const want = [];
        for (const i of lines) {
            if (focus && (i < focus[0] || i > focus[1])) continue;
            for (const w of (data.lines[i] || [])) {
                if (w.end || !w.t) continue;
                const k = w.k.split(':').slice(0, 2).join(':');
                const it = { t: w.t, wk: w.k, line: i };
                const last = want[want.length - 1];
                if (last && last.k === k) last.items.push(it); else want.push({ k, items: [it] });
            }
        }
        trk.current = tracker(want);
        setStat({ ok: 0, bad: 0 });
        mistakes.current = [];
    }, [data, page, focus && focus.join('-')]);      // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => { if (mic.current) mic.current.stop(); }, []);

    const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* غير مدعوم */ } };

    const wrong = (expected, heard) => {
        setFlash(f => f + 1);
        buzz([90, 60, 90]);
        setHint(expected);
        mistakes.current.push({ k: expected.k, raw: expected.raw, wk: expected.wk, heard });
        setStat(s => ({ ...s, bad: s.bad + 1 }));
    };

    const onChunk = (text, ms) => {
        const t = trk.current;
        setHeard(text ? text + (ms ? '  · ' + (ms / 1000).toFixed(1) + 'ث' : '') : '');
        if (!t || !text) return;
        const before = t.pos;
        const r = t.feed(text);
        if (r.advanced) {
            setHint(null);
            setStat(s => ({ ...s, ok: s.ok + r.advanced }));
            // كل سطرٍ اكتملت كلماته ينكشف
            for (let i = before; i < t.pos; i++) {
                const w = t.at(i);
                const next = t.at(i + 1);
                if (w && (!next || next.line !== w.line)) onReveal(w.line);
            }
        }
        // لا نومض لكل خلاف: ضجيجٌ أو كلمةٌ مبتورة تمرّ، والخطأ يُثبت بمقطعٍ
        // فيه كلامٌ كافٍ أو بتكرّر التعثّر مرّتين
        if (r.error) wrong(r.error.expected, r.error.heard);
        if (t.done) finish();
    };

    const start = async () => {
        setErr('');
        if (!asrSupported()) { setErr('هذا الجهاز لا يدعم الاستماع من المتصفّح. جرّب كروم على أندرويد.'); return; }
        try {
            if (!asrReady()) { setStage('loading'); await loadAsr(setPct); }
            onHideAll();
            setStage('live');
            mic.current = await listen({ onChunk, onLevel: setLevel, onError: () => {} });
        } catch (e) {
            setStage('idle');
            setErr(e && e.message ? e.message : 'تعذّر تشغيل الاستماع');
        }
    };

    const finish = () => {
        if (mic.current) { mic.current.stop(); mic.current = null; }
        setStage('done');
        setLevel(0);
    };

    // الأخطاء تُعلَّم على مصحف الحافظ نفسه، فيراها في مراجعته القادمة
    const saveMarks = async () => {
        const seen = new Set();
        for (const m of mistakes.current) {
            if (!m.wk || seen.has(m.wk)) continue;
            seen.add(m.wk);
            await call('mark', { body: { member_id: member.id, word_key: m.wk, page, op: 'err', d: new Date().toISOString().slice(0, 10) } });
        }
        onClose();
    };

    const t = trk.current;
    const pos = t ? t.pos : 0, total = t ? t.total : 0;
    const cur = t && t.current();

    return (
        <>
            {flash ? <Flash key={flash} /> : null}
            <div className="rounded-2xl border border-paper-2 bg-paper-card p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                    <span className={'w-9 h-9 rounded-xl flex items-center justify-center ' + (stage === 'live' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand')}>
                        {stage === 'loading' ? <Loader2 size={17} className="animate-spin" /> : stage === 'live' ? <Mic size={17} /> : <MicOff size={17} />}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-[14px] text-ink">التسميع الذاتي</div>
                        <div className="text-[11.5px] text-ink-3">
                            {stage === 'loading' ? 'يُحمّل نموذج التلاوة مرّةً واحدة… ' + Math.round(pct * 100) + '٪'
                                : stage === 'live' ? (cur ? 'اقرأ من ' + ayahName(cur) : 'اقرأ…')
                                    : stage === 'done' ? 'انتهت الجلسة' : 'يستمع لتلاوتك على جهازك، ولا يُرفع صوتك'}
                        </div>
                    </div>
                    <button onClick={() => { finish(); onClose(); }} className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-3"><X size={17} /></button>
                </div>

                {stage === 'loading' ? <div className="h-1.5 rounded-full bg-paper-2 overflow-hidden"><div className="h-full bg-brand" style={{ width: (pct * 100) + '%' }} /></div> : null}

                {stage === 'live' ? (
                    <>
                        <div className="h-1.5 rounded-full bg-paper-2 overflow-hidden">
                            <div className="h-full bg-brand transition-all" style={{ width: (total ? (pos / total) * 100 : 0) + '%' }} />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-8 rounded-xl bg-paper-2/60 overflow-hidden flex items-center px-1">
                                <div className="h-2 rounded-full bg-brand/70 transition-all" style={{ width: Math.min(100, level * 600) + '%' }} />
                            </div>
                            <button onClick={() => setHint(h => h || (t && t.at(pos)))}
                                className="h-9 px-3 rounded-xl bg-paper-card border border-paper-2 text-[12.5px] font-semibold text-ink-2 inline-flex items-center gap-1">
                                <Lightbulb size={15} />لقّني
                            </button>
                            <button onClick={finish} className="h-9 px-3 rounded-xl bg-ink text-white text-[12.5px] font-bold">أنهِ</button>
                        </div>
                        {hint ? <p className="text-center font-quran text-[20px] text-brand-800">{hint.raw}</p> : null}
                        {heard ? <p className="text-[11.5px] text-ink-3 text-center leading-6 truncate">سمعتُ: {heard}</p> : null}
                        <p className="text-[11px] text-ink-3 text-center">{stat.ok} كلمة صحيحة · {stat.bad} توقّف</p>
                    </>
                ) : null}

                {stage === 'idle' ? (
                    <button onClick={start} className="w-full h-11 rounded-xl bg-brand text-white font-bold text-[14px] inline-flex items-center justify-center gap-2">
                        <Mic size={17} />ابدأ التسميع
                    </button>
                ) : null}

                {stage === 'done' ? (
                    <div className="space-y-2">
                        <div className="rounded-xl bg-brand-50 p-3 text-[13px] text-brand-800 leading-6 flex items-start gap-2">
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                            <span>سمّعت {stat.ok} كلمة، وتوقّفت في {stat.bad} موضعاً.</span>
                        </div>
                        <div className="flex gap-2">
                            {mistakes.current.length ? <button onClick={saveMarks} className="flex-1 h-10 rounded-xl bg-ink text-white text-[13px] font-bold">علّم مواضع التوقّف في مصحفه</button> : null}
                            <button onClick={() => { setStage('idle'); trk.current && trk.current.reset(0); setStat({ ok: 0, bad: 0 }); mistakes.current = []; }}
                                className="h-10 px-3 rounded-xl bg-paper-card border border-paper-2 text-[13px] font-semibold text-ink-2 inline-flex items-center gap-1">
                                <RotateCcw size={15} />أعد
                            </button>
                        </div>
                    </div>
                ) : null}

                {err ? <p className="text-[12.5px] text-red-700 leading-6">{err}</p> : null}
            </div>
        </>
    );
}

// ومضةٌ حمراء على حوافّ الشاشة: تُرى ولا تحجب المصحف
function Flash() {
    const [on, setOn] = useState(true);
    useEffect(() => { const t = setTimeout(() => setOn(false), 420); return () => clearTimeout(t); }, []);
    if (!on) return null;
    return <div className="fixed inset-0 z-[60] pointer-events-none al-flash" style={{ boxShadow: 'inset 0 0 0 6px rgba(220,38,38,.85), inset 0 0 90px rgba(220,38,38,.35)' }} />;
}
