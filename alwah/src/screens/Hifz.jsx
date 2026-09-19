import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, EyeOff, Eye, ChevronDown, Plus, RotateCcw, Mic } from 'lucide-react';
import { call } from '../lib/api';
import { go, replace } from '../lib/router';
import { useData } from '../App';
import { useToast, todayStr, Empty, Seg } from '../ui';
import Mushaf from '../components/Mushaf';
import WordActions from '../components/WordActions';
import Reciter from '../components/Reciter';
import PassBar from '../components/PassBar';
import { loadPage } from '../lib/mushaf';
import { surahsOn, juzOf, rangeLabel, SURAHS, JUZ_START, LPP } from '../lib/quran';
import { BookOpen } from 'lucide-react';

// ─── صفحة الحفظ: مصحف الفرد نفسه مع أدوات الحفظ ─────────────────────────────
// ورد اليوم (الجديد والألواح والمراجعة) على مصحفه بعلاماته، وتلاوة الشيخ محمد أيوب
// بتكرار الآية والمقطع، وإخفاء الأسطر للتسميع الذاتي، وعدّاد للتكرار.
// الرابط يحمل الفرد والقسم والصفحة: التحديث يُبقيك مكانك.
const TABS = [['new', 'حفظ اليوم'], ['alwah', 'الألواح'], ['rev', 'المراجعة'], ['all', 'المصحف']];

export default function Hifz({ q }) {
    const { me, sup, members } = useData();
    const toast = useToast();
    const mid = +q.m || me.member_id || (members[0] && members[0].id) || 0;
    const m = members.find(x => x.id === mid);
    // ورد اليوم نفسه (قبل تسميعه): يبقى ثابتاً بعد الإجازة، ولا ينتقل إلى ورد الغد
    const [day, setDay] = useState(null);
    const loadDay = useCallback(async () => { if (!mid) return; const r = await call('member', { params: { id: mid } }); if (r.success) setDay({ id: mid, plan: r.plan, today: r.stats.today }); }, [mid]);
    useEffect(() => { loadDay(); }, [loadDay]);
    const plan = day && day.id === mid ? day.plan : (m && m.plan);
    const today = day && day.id === mid ? day.today : (m && m.today);
    const tab = TABS.some(t => t[0] === q.t) ? q.t : 'new';

    // صفحات القسم
    const set = !plan ? [] : tab === 'new' ? (plan.new ? [plan.new.page] : [])
        : tab === 'alwah' ? [...plan.alwah].sort((a, b) => a - b) : tab === 'rev' ? plan.review : [];
    const page = Math.min(604, Math.max(1, +q.p || set[0] || (plan && plan.current) || 1));
    const at = (patch, push) => { const n = { m: mid, t: tab, p: page, ...patch }; (push ? go : replace)('/hifz', n); };

    const [marks, setMarks] = useState({});
    const [sel, setSel] = useState(null);
    const [busy, setBusy] = useState(false);
    const [hide, setHide] = useState(null);        // Set للأسطر المخفية، أو null
    const [data, setData] = useState(null);
    const [hl, setHl] = useState(null);
    const [pick, setPick] = useState(null);
    const [tools, setTools] = useState(true);

    const load = useCallback(async () => {
        if (!mid) return;
        const r = await call('marks_page', { params: { member_id: mid, page } });
        if (r.success) { const o = {}; r.marks.forEach(x => { o[x.word_key] = x; }); setMarks(o); }
    }, [mid, page]);
    useEffect(() => { setSel(null); setHide(null); setData(null); load(); loadPage(page).then(setData).catch(() => {}); }, [load, page]);

    // أسطر حفظ اليوم في صفحته
    const focus = tab === 'new' && plan && plan.new && plan.new.page === page
        ? [plan.new.from_line, Math.min(LPP, plan.new.from_line + plan.new.lines - 1)] : null;

    // آيات الصفحة بالترتيب، والمقطع المقترح: آيات أسطر حفظ اليوم
    const { ayahs, range, lines } = useMemo(() => {
        if (!data) return { ayahs: [], range: null, lines: [] };
        const out = [], seen = new Set(), ls = [];
        let r0 = null, r1 = null;
        for (let i = 1; i <= 15; i++) {
            const ws = data.lines[i];
            if (!ws) continue;
            ls.push(i);
            ws.forEach(w => {
                const k = w.k.slice(0, w.k.lastIndexOf(':'));
                if (!seen.has(k)) { seen.add(k); out.push(k); }
                if (focus && i >= focus[0] && i <= focus[1]) { if (!r0) r0 = k; r1 = k; }
            });
        }
        return { ayahs: out, range: r0 ? [r0, r1] : null, lines: ls };
    }, [data, focus && focus.join('-')]); // eslint-disable-line react-hooks/exhaustive-deps

    // عدّاد التكرار: لكل صفحةٍ في اليوم، محفوظ على الجهاز
    const ck = `alwah_rep_${mid}_${page}_${todayStr()}`;
    const [reps, setReps] = useState(0);
    useEffect(() => { try { setReps(+localStorage.getItem(ck) || 0); } catch (e) { setReps(0); } }, [ck]);
    const bump = v => { setReps(v); try { localStorage.setItem(ck, String(v)); } catch (e) { /* تجاهل */ } };

    const op = async o => {
        if (!sel) return;
        setBusy(true);
        const r = await call('mark', { body: { member_id: mid, word_key: sel.k, page, op: o, d: todayStr() } });
        setBusy(false);
        if (!r.success) { toast(r.message, 'err'); return; }
        setMarks(x => { const n = { ...x }; if (r.mark && (r.mark.err || r.mark.warn)) n[sel.k] = r.mark; else delete n[sel.k]; return n; });
        if (o === 'err' || o === 'warn') { toast(o === 'err' ? 'سُجّل خطأ' : 'سُجّل تنبيه'); setSel(null); }
    };

    if (!members.length) return <Empty icon={BookOpen} title="لا أفراد بعد" text="أضف فرداً من الإعدادات ليكون له مصحفه." />;
    if (!m) return <p className="text-center text-ink-3 py-16">غير موجود</p>;

    // الإخفاء: كل الأسطر (أو أسطر حفظ اليوم) تُخفى، ولمس السطر يكشفه
    const hideAll = () => setHide(new Set(focus ? lines.filter(i => i >= focus[0] && i <= focus[1]) : lines));
    const reveal = i => setHide(h => { if (!h) return h; const n = new Set(h); n.delete(i); return n; });
    const revealNext = () => setHide(h => { if (!h || !h.size) return h; const n = new Set(h); n.delete(Math.min(...n)); return n; });
    const idx = set.indexOf(page);
    const flip = d => {
        if (tab !== 'all' && set.length > 1 && idx >= 0) { const j = idx + d; if (j >= 0 && j < set.length) at({ p: set[j] }); return; }
        at({ p: Math.min(604, Math.max(1, page + d)) });
    };
    const count = Object.values(marks).filter(x => !x.resolved).length;

    return (
        <div className="space-y-3 pb-28">
            {/* ── الفرد ── */}
            {sup && members.length > 1 ? (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
                    {members.map(x => (
                        <button key={x.id} onClick={() => go('/hifz', { m: x.id, t: tab })}
                            className={'shrink-0 h-9 px-3 rounded-full text-[13px] font-bold border inline-flex items-center gap-1.5 ' + (x.id === mid ? 'text-white border-transparent' : 'bg-paper-card border-paper-2 text-ink-2')}
                            style={x.id === mid ? { background: x.color } : undefined}>
                            {x.id !== mid ? <span className="w-2 h-2 rounded-full" style={{ background: x.color }} /> : null}{x.name}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    <h1 className="font-bold text-ink">مصحف {m.name}</h1>
                </div>
            )}

            <Seg value={tab} onChange={t => go('/hifz', { m: mid, t })} options={TABS.map(([v, t]) => ({ v, t }))} />

            {/* ── صفحات القسم ── */}
            {tab !== 'all' && set.length > 1 ? (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
                    {set.map(p => (
                        <button key={p} onClick={() => at({ p })} className={'shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border tabular-nums ' + (p === page ? 'bg-brand text-white border-brand' : 'bg-paper-card border-paper-2 text-ink-2')}>ص {p}</button>
                    ))}
                </div>
            ) : null}
            {tab !== 'all' && !set.length ? <p className="text-[13px] text-ink-3 text-center py-2">{tab === 'new' ? 'أتمّ الحفظ، ما شاء الله' : 'لا صفحات في هذا القسم بعد'}</p> : null}

            {/* ── التقليب ── */}
            <div className="flex items-center gap-2">
                <button onClick={() => flip(-1)} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center" aria-label="السابقة"><ChevronRight size={20} /></button>
                <div className="flex-1 text-center leading-tight">
                    <div className="font-bold text-ink">{surahsOn(page).join('، ')}</div>
                    <div className="text-[11px] text-ink-3">صفحة {page} · الجزء {juzOf(page)}{focus ? ` · الأسطر ${focus[0]}–${focus[1]}` : ''}{count ? ` · ${count} علامة` : ''}</div>
                </div>
                <button onClick={() => flip(1)} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center" aria-label="التالية"><ChevronLeft size={20} /></button>
            </div>

            {/* ── أدوات الحفظ ── */}
            <div className="flex items-center gap-2">
                <button onClick={() => (hide ? setHide(null) : hideAll())}
                    className={'h-10 px-3 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 border ' + (hide ? 'bg-ink text-white border-ink' : 'bg-paper-card border-paper-2 text-ink-2')}>
                    {hide ? <Eye size={16} /> : <EyeOff size={16} />}{hide ? 'أظهر النص' : 'سمّع لنفسك'}
                </button>
                {hide && hide.size ? <button onClick={revealNext} className="h-10 px-3 rounded-xl bg-paper-card border border-paper-2 text-[13px] font-semibold text-ink-2 inline-flex items-center gap-1"><ChevronDown size={15} />اكشف سطراً</button> : null}
                <div className="ms-auto flex items-center gap-1 bg-paper-card border border-paper-2 rounded-xl h-10 ps-1 pe-3">
                    <button onClick={() => bump(reps + 1)} className="h-8 px-2.5 rounded-lg bg-brand text-white text-[13px] font-bold inline-flex items-center gap-1" aria-label="كرّرت"><Plus size={14} />كرّرت</button>
                    <span className="text-[15px] font-bold text-ink tabular-nums min-w-[2ch] text-center">{reps}</span>
                    {reps ? <button onClick={() => bump(0)} className="w-7 h-7 rounded-lg text-ink-3 flex items-center justify-center" aria-label="تصفير"><RotateCcw size={13} /></button> : null}
                </div>
            </div>
            {hide ? <p className="text-[12px] text-ink-3 text-center">اقرأ من حفظك، ثم المس السطر لتتأكّد منه</p> : null}

            <Mushaf page={page} marks={marks} onWord={w => setSel(w)} selected={sel && sel.k}
                hide={hide} onLine={reveal} focus={hide ? null : focus} hl={hl} onAyah={k => setPick({ k, t: Date.now() })} />

            <button onClick={() => setTools(v => !v)} className="text-[12px] font-semibold text-ink-3 mx-auto block">{tools ? 'أخفِ المُسمِع' : 'أظهر المُسمِع'}</button>
            {tools ? <Reciter ayahs={ayahs} range={range} pick={pick} onAyah={setHl} /> : null}

            {tab === 'all' ? (
                <div className="grid grid-cols-2 gap-2">
                    <select className="h-10 rounded-xl bg-paper-card border border-paper-2 px-2 text-[13px]" value="" onChange={e => e.target.value && at({ p: +e.target.value }, true)}>
                        <option value="">انتقل إلى سورة…</option>
                        {SURAHS.map(([n, p], i) => <option key={i} value={p}>{i + 1}. {n}</option>)}
                    </select>
                    <select className="h-10 rounded-xl bg-paper-card border border-paper-2 px-2 text-[13px]" value="" onChange={e => e.target.value && at({ p: +e.target.value }, true)}>
                        <option value="">انتقل إلى جزء…</option>
                        {JUZ_START.map((p, i) => <option key={i} value={p}>الجزء {i + 1}</option>)}
                    </select>
                </div>
            ) : null}

            {tab !== 'all' && set.length ? <PassBar member={m} part={tab} today={today} onDone={loadDay} /> : null}

            {sup ? (
                <a href={'#/m/' + mid + '/log'} className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-brand text-white font-bold"><Mic size={17} />التسميع المفصّل (الأخطاء والملاحظة)</a>
            ) : null}
            {tab !== 'all' && set.length > 1 ? <p className="text-[11px] text-ink-3 text-center">{TABS.find(t => t[0] === tab)[1]}: صفحات {rangeLabel(set)}</p> : null}

            <WordActions word={sel} mark={sel ? marks[sel.k] : null} onOp={op} onClose={() => setSel(null)} busy={busy} />
        </div>
    );
}
