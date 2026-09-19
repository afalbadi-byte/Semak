import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Video, Mic, ChevronRight, ChevronLeft, Minimize2, Maximize2, Radio, BookOpen } from 'lucide-react';
import { call } from '../lib/api';
import { useData } from '../App';
import { Card, Btn, useToast, todayStr } from '../ui';
import useRtc from '../lib/useRtc';
import CallRoom from '../components/CallRoom';
import Mushaf from '../components/Mushaf';
import WordActions from '../components/WordActions';
import { surahsOn, juzOf, rangeLabel } from '../lib/quran';

// ════════════════════════════════════════════════════════════════════════════
//  جلسة الذكر — مجلس الأسرة للتسميع، ولو تفرّقت بهم الأماكن
//  ─────────────────────────────────────────────────────────────────────────
//  مكالمةٌ بالصوت والصورة لأفراد الأسرة وحدهم، ومصحفٌ مشترك: المشرف يختار من
//  يُسمِّع وأيّ صفحة، فتتبعه شاشات الجميع، ويعلّم الأخطاء والتنبيهات بلمسة فتُحفظ
//  في مصحف القارئ نفسه ويراها الحاضرون فوراً.
// ════════════════════════════════════════════════════════════════════════════
export default function Session() {
    const { sup, members, family } = useData();
    const toast = useToast();
    const rtc = useRtc({});
    const inCall = ['joining', 'in'].includes(rtc.status);
    const [small, setSmall] = useState(false);
    const [s, setS] = useState({ member_id: null, page: null, rev: -1 });
    const [marks, setMarks] = useState({});
    const [live, setLive] = useState([]);
    const [sel, setSel] = useState(null);
    const [busy, setBusy] = useState(false);
    const lock = useRef(0);          // بعد تغييرٍ محلّي: لا نطغى عليه بنبضةٍ أقدم منه

    // نبضة الجلسة: من يُسمِّع وأيّ صفحة وعلاماتها
    const pull = useCallback(async () => {
        const r = await call('session_get');
        if (!r.success) return;
        setLive(r.live || []);
        if (Date.now() < lock.current) return;
        const x = r.session || { member_id: null, page: null, rev: 0 };
        setS(x);
        const o = {}; (r.marks || []).forEach(m => { o[m.word_key] = m; }); setMarks(o);
    }, []);
    useEffect(() => { pull(); const t = setInterval(pull, 1500); return () => clearInterval(t); }, [pull]);

    const m = members.find(x => x.id === s.member_id) || null;
    const page = s.page || (m && m.plan.current) || null;

    const setSession = async (mid, p) => {
        lock.current = Date.now() + 2500;
        setS(x => ({ ...x, member_id: mid, page: p })); setMarks({}); setSel(null);
        const r = await call('session_set', { body: { member_id: mid, page: p } });
        if (!r.success) toast(r.message, 'err');
        lock.current = 0; pull();
    };
    const pick = mm => setSession(mm.id, mm.plan.current || 604);
    const turn = d => page && setSession(s.member_id, Math.min(604, Math.max(1, page + d)));

    const op = async o => {
        if (!sel || !m) return;
        setBusy(true);
        const r = await call('mark', { body: { member_id: m.id, word_key: sel.k, page, op: o, d: todayStr() } });
        setBusy(false);
        if (!r.success) { toast(r.message, 'err'); return; }
        setMarks(x => { const n = { ...x }; if (r.mark && (r.mark.err || r.mark.warn)) n[sel.k] = r.mark; else delete n[sel.k]; return n; });
        if (o === 'err' || o === 'warn') setSel(null);
    };

    const plan = m ? m.plan : null;
    const chips = plan ? [
        plan.new ? { t: 'حفظ اليوم', p: plan.new.page } : null,
        plan.alwah.length ? { t: 'الألواح ' + rangeLabel(plan.alwah), p: Math.min(...plan.alwah) } : null,
        plan.review.length ? { t: 'المراجعة ' + rangeLabel(plan.review), p: plan.review[0] } : null,
    ].filter(Boolean) : [];

    return (
        <div className="space-y-4 pb-28">
            {/* ── الترويسة ── */}
            <div className="al-hero relative overflow-hidden rounded-3xl text-white p-5">
                <div className="absolute inset-0 al-pattern" />
                <div className="relative flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center"><Radio size={22} /></div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[20px] font-bold">جلسة الذكر</h1>
                        <p className="text-[12px] text-white/80 truncate">{family ? family.name : ''} · {live.length ? 'في الجلسة الآن: ' + live.join('، ') : 'لا أحد في الجلسة بعد'}</p>
                    </div>
                </div>
            </div>

            {/* ── المكالمة ── */}
            {inCall ? (
                <div className="relative">
                    <CallRoom rtc={rtc} isGuest title="جلسة الذكر" height={small ? '150px' : '46vh'} />
                    <button onClick={() => setSmall(v => !v)} className="absolute top-2 left-2 z-30 w-9 h-9 rounded-xl bg-black/50 text-white flex items-center justify-center" aria-label={small ? 'تكبير' : 'تصغير'}>
                        {small ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                    </button>
                </div>
            ) : (
                <Card className="p-4 flex items-center gap-3">
                    <div className="flex-1 text-[13px] text-ink-2 leading-6">
                        {rtc.status === 'ended' ? 'غادرت المكالمة، والمصحف باقٍ معك.' : 'ادخل بالصوت والصورة ليسمعك أهلك وتسمعهم، أو تابع المصحف وحده.'}
                        {rtc.error ? <span className="block text-red-700 text-[12px]">{rtc.error}</span> : null}
                    </div>
                    <Btn onClick={() => rtc.join({})}><Video size={17} />ادخل</Btn>
                    <Btn kind="soft" onClick={async () => { const st = await rtc.openMedia({ cam: false }); if (st) rtc.join({}); }} aria-label="بالصوت فقط"><Mic size={17} /></Btn>
                </Card>
            )}

            {/* ── من يُسمِّع ── */}
            {sup ? (
                <div>
                    <div className="text-[12px] font-bold text-ink-2 mb-2 px-1">من يُسمِّع الآن؟</div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                        {members.map(x => (
                            <button key={x.id} onClick={() => pick(x)}
                                className={'shrink-0 h-10 px-4 rounded-full text-[13px] font-bold border inline-flex items-center gap-2 ' + (s.member_id === x.id ? 'text-white border-transparent' : 'bg-paper-card border-paper-2 text-ink-2')}
                                style={s.member_id === x.id ? { background: x.color } : undefined}>
                                <span className="w-2 h-2 rounded-full" style={{ background: s.member_id === x.id ? '#fff' : x.color }} />{x.name}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {page && (m || s.page) ? (
                <>
                    <div className="flex items-center gap-2">
                        {sup ? <button onClick={() => turn(-1)} disabled={page <= 1} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center disabled:opacity-30" aria-label="السابقة"><ChevronRight size={20} /></button> : null}
                        <div className="flex-1 text-center leading-tight">
                            <div className="font-bold text-ink">{m ? <span style={{ color: m.color }}>{m.name}</span> : 'أحد أفراد الأسرة'} يُسمِّع · {surahsOn(page).join('، ')}</div>
                            <div className="text-[11px] text-ink-3">صفحة {page} · الجزء {juzOf(page)}{sup ? ' · المس الكلمة لتعليمها' : ''}</div>
                        </div>
                        {sup ? <button onClick={() => turn(1)} disabled={page >= 604} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center disabled:opacity-30" aria-label="التالية"><ChevronLeft size={20} /></button> : null}
                    </div>
                    {sup && m && chips.length ? (
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
                            {chips.map(c => (
                                <button key={c.t} onClick={() => setSession(m.id, c.p)} className={'shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border ' + (page === c.p ? 'bg-brand text-white border-brand' : 'bg-paper-card border-paper-2 text-ink-2')}>{c.t}</button>
                            ))}
                        </div>
                    ) : null}
                    <Mushaf page={page} marks={marks} onWord={sup ? w => setSel(w) : undefined} readOnly={!sup} selected={sel && sel.k} />
                </>
            ) : (
                <Card className="p-8 text-center text-[13px] text-ink-3">
                    <BookOpen className="mx-auto mb-2 text-ink-3" size={24} />
                    {sup ? 'اختر من يُسمِّع، فيفتح المصحف على ورده للجميع.' : 'ينتظر المشرف أن يختار من يُسمِّع.'}
                </Card>
            )}

            <WordActions word={sel} mark={sel ? marks[sel.k] : null} onOp={op} onClose={() => setSel(null)} busy={busy} />
        </div>
    );
}
