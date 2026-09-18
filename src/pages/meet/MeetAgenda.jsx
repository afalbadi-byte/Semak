import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, Check, Play, Pause, Trash2, ChevronLeft, ChevronRight,
    RefreshCw, Sparkles, Target, Flag, Megaphone, ListChecks, AlertTriangle, X,
} from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  الاجتماع على الجوّال — الأجندة نفسها التي في اللوحة، بلوحة كانبان تعمل باللمس
//  الأقسام والتوقيت والبنود كلّها من الخادم ذاته، فما يُكتب هنا يظهر هناك فوراً.
// ════════════════════════════════════════════════════════════════════════════

const AGENDA = [
    { key: 'segue',     name: 'المقدمة',     min: 5,  icon: Sparkles,   hint: 'خبر طيب من كل حاضر' },
    { key: 'scorecard', name: 'لوحة الأرقام', min: 5,  icon: Target,     hint: 'على المسار أو خارجه — بلا نقاش' },
    { key: 'rocks',     name: 'أولويات ٩٠ يوماً', min: 5, icon: Flag,   hint: 'حالة كل أولوية فقط' },
    { key: 'headlines', name: 'مستجدات',     min: 5,  icon: Megaphone,  hint: 'خبر العميل والمورّد بجملة' },
    { key: 'todos',     name: 'اللوحة',      min: 65, icon: ListChecks, hint: 'ناقش حتى الحل، ولكل بطاقة مالك وموعد' },
    { key: 'conclude',  name: 'الختام',      min: 5,  icon: Check,      hint: 'ما يُبلَّغ للفريق وتقييم الاجتماع' },
];
const COLS = [
    { key: 'open',  name: 'للتنفيذ',     dot: 'bg-slate-400',   ring: 'border-slate-500/40' },
    { key: 'doing', name: 'قيد التنفيذ', dot: 'bg-amber-500',   ring: 'border-amber-500/40' },
    { key: 'done',  name: 'منجزة',       dot: 'bg-emerald-500', ring: 'border-emerald-500/40' },
];
const DOMAINS = [
    { key: 'projects', name: 'المشاريع' }, { key: 'gov', name: 'الحكومية' },
    { key: 'purchases', name: 'المشتريات' }, { key: 'cash', name: 'السيولة' },
    { key: 'sales', name: 'المبيعات' }, { key: 'other', name: 'عام' },
];
const domName = k => (DOMAINS.find(d => d.key === k) || { name: 'عام' }).name;
const DOM_CHIP = {
    projects: 'bg-blue-500/20 text-blue-300', gov: 'bg-teal-500/20 text-teal-300',
    purchases: 'bg-indigo-500/20 text-indigo-300', cash: 'bg-emerald-500/20 text-emerald-300',
    sales: 'bg-fuchsia-500/20 text-fuchsia-300', other: 'bg-slate-500/20 text-slate-300',
};
const today = () => new Date().toISOString().slice(0, 10);
const dayWord = n => (n === 1 ? 'يوماً' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوماً');
const mmss = s => Math.floor(s / 60) + ':' + String(Math.abs(s % 60)).padStart(2, '0');

export default function MeetAgenda({ userName, onMeeting }) {
    const [meeting, setMeeting] = useState(null);
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
    const [idx, setIdx] = useState(0);
    const [col, setCol] = useState('open');
    const [fDom, setFDom] = useState('all');
    const [kind, setKind] = useState('todo');
    const [draft, setDraft] = useState('');
    const [open, setOpen] = useState(null);       // البطاقة المفتوحة في الورقة السفلية
    const [left, setLeft] = useState(AGENDA[0].min * 60);
    const [run, setRun] = useState(false);
    const tick = useRef(null);

    const hdr = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + getAdminToken() });
    const post = (action, body) => fetch(`${API_URL}?action=${action}`,
        { method: 'POST', headers: hdr(), body: JSON.stringify(body) }).then(r => r.json());

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const m = await fetch(`${API_URL}?action=mtg_get`, { headers: { Authorization: 'Bearer ' + getAdminToken() } }).then(x => x.json());
            if (m.success) {
                setMeeting(m.meeting); setItems(m.items || []);
                if (onMeeting) onMeeting(m.meeting);
            }
        } catch (e) {}
        setBusy(false);
    }, [onMeeting]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!run) { clearInterval(tick.current); return; }
        tick.current = setInterval(() => setLeft(v => v - 1), 1000);
        return () => clearInterval(tick.current);
    }, [run]);

    const goSection = i => { setIdx(i); setLeft(AGENDA[i].min * 60); setRun(false); };
    const patchMeeting = async patch => { await post('mtg_save', { ...meeting, ...patch }); load(); };
    const newMeeting = async () => {
        const r = await post('mtg_save', { title: 'اجتماع سماك الدوري ' + today() });
        if (r.success) load();
    };
    const add = async () => {
        if (!meeting || !draft.trim()) return;
        await post('mtg_item_save', { meeting_id: meeting.id, kind, title: draft.trim(),
            section: fDom === 'all' ? 'other' : fDom, status: col });
        setDraft(''); load();
    };
    const patch = async (it, p) => {
        setItems(list => list.map(x => (x.id === it.id ? { ...x, ...p } : x)));   // استجابة فورية ثم حفظ
        await post('mtg_item_save', { ...it, ...p });
        load();
    };
    const del = async id => { if (!window.confirm('حذف البند؟')) return; await post('mtg_item_delete', { id }); setOpen(null); load(); };

    const live = items.filter(i => i.status !== 'cancelled');
    const shown = live.filter(i => (fDom === 'all' || (i.section || 'other') === fDom));
    const inCol = k => shown.filter(i => (i.status || 'open') === k);
    const done = live.filter(i => i.status === 'done').length;
    const pct = live.length ? Math.round((done / live.length) * 100) : 0;
    const A = AGENDA[idx];
    const Icon = A.icon;

    if (!meeting) return (
        <div dir="rtl" className="p-6 flex flex-col items-center justify-center gap-4 text-center min-h-[60vh]">
            <ListChecks size={34} className="text-slate-600" />
            <p className="font-black">لا يوجد اجتماع مفتوح</p>
            <p className="text-[12px] text-slate-400">ابدأ اجتماعاً جديداً، وستُرحَّل إليه البنود غير المنجزة من السابق</p>
            <button onClick={newMeeting} className="px-5 h-11 rounded-2xl bg-gold-500 text-slate-900 font-black">اجتماع جديد</button>
        </div>
    );

    return (
        <div dir="rtl" className="p-3 space-y-3">
            {/* ترويسة القسم والمؤقّت */}
            <div className="rounded-3xl bg-gradient-to-l from-[#1a365d] to-[#2d5299] border border-white/10 p-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center"><Icon size={18} /></div>
                    <div className="flex-1 min-w-0">
                        <div className="font-black truncate">{A.name}</div>
                        <div className="text-[11px] text-white/70 font-bold truncate">{A.hint}</div>
                    </div>
                    <button onClick={() => setRun(v => !v)}
                        className={'px-3 h-10 rounded-2xl font-black tabular-nums flex items-center gap-1.5 ' +
                            (left < 0 ? 'bg-red-600' : 'bg-white/15')}>
                        {run ? <Pause size={14} /> : <Play size={14} />}{mmss(left)}
                    </button>
                </div>
                <div className="mt-3 flex items-center gap-1">
                    <button onClick={() => goSection(Math.max(0, idx - 1))} disabled={idx === 0}
                        className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center disabled:opacity-30"><ChevronRight size={16} /></button>
                    <div className="flex-1 flex gap-1">
                        {AGENDA.map((s, i) => (
                            <button key={s.key} onClick={() => goSection(i)}
                                className={'flex-1 h-1.5 rounded-full transition ' + (i === idx ? 'bg-gold-500' : i < idx ? 'bg-white/50' : 'bg-white/15')} />
                        ))}
                    </div>
                    <button onClick={() => goSection(Math.min(AGENDA.length - 1, idx + 1))} disabled={idx === AGENDA.length - 1}
                        className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center disabled:opacity-30"><ChevronLeft size={16} /></button>
                </div>
            </div>

            {/* أقسام نصّية */}
            {A.key === 'segue' || A.key === 'headlines' || A.key === 'conclude' ? (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                    <textarea rows={5} defaultValue={meeting[A.key === 'conclude' ? 'cascading' : A.key] || ''}
                        placeholder={A.hint}
                        onBlur={e => patchMeeting({ [A.key === 'conclude' ? 'cascading' : A.key]: e.target.value })}
                        className="w-full bg-transparent text-sm leading-7 outline-none resize-none placeholder-slate-500" />
                </div>
            ) : null}

            {/* اللوحة */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-400">أُنجز {done} من {live.length}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: pct + '%' }} />
                    </div>
                    <button onClick={load} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                    <button onClick={() => setFDom('all')}
                        className={'px-3 h-8 rounded-full text-[11px] font-bold shrink-0 ' + (fDom === 'all' ? 'bg-gold-500 text-slate-900' : 'bg-white/10 text-slate-300')}>
                        الكل
                    </button>
                    {DOMAINS.map(d => (
                        <button key={d.key} onClick={() => setFDom(d.key)}
                            className={'px-3 h-8 rounded-full text-[11px] font-bold shrink-0 ' + (fDom === d.key ? 'bg-gold-500 text-slate-900' : 'bg-white/10 text-slate-300')}>
                            {d.name}
                        </button>
                    ))}
                </div>

                {/* الأعمدة كتبويبات — أنسب لعرض الجوّال من ثلاثة أعمدة متجاورة */}
                <div className="grid grid-cols-3 gap-1.5">
                    {COLS.map(c => (
                        <button key={c.key} onClick={() => setCol(c.key)}
                            className={'h-11 rounded-2xl text-[12px] font-black flex flex-col items-center justify-center gap-0.5 border ' +
                                (col === c.key ? 'bg-white/10 border-white/25' : 'bg-transparent border-white/10 text-slate-400')}>
                            <span className="flex items-center gap-1.5"><span className={'w-1.5 h-1.5 rounded-full ' + c.dot} />{c.name}</span>
                            <span className="text-[10px] opacity-60">{inCol(c.key).length}</span>
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    {inCol(col).map(it => {
                        const isIssue = it.kind !== 'todo';
                        const late = it.due_date && it.status !== 'done' && it.due_date < today();
                        const ci = COLS.findIndex(c => c.key === (it.status || 'open'));
                        return (
                            <div key={it.id} className={'rounded-2xl bg-white/[0.05] border p-3 ' + COLS[Math.max(0, ci)].ring}>
                                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                    <span className={'text-[10px] font-black px-1.5 py-0.5 rounded-md ' +
                                        (isIssue ? 'bg-rose-500/20 text-rose-300' : 'bg-violet-500/20 text-violet-300')}>
                                        {isIssue ? 'قضية' : 'مهمة'}
                                    </span>
                                    <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-md ' + (DOM_CHIP[it.section] || DOM_CHIP.other)}>
                                        {domName(it.section)}
                                    </span>
                                    {it.carried_from ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300">مُرحّل</span> : null}
                                    {late ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-300 flex items-center gap-1">
                                        <AlertTriangle size={10} />متأخر</span> : null}
                                </div>
                                <button onClick={() => setOpen(it)} className="block w-full text-right">
                                    <span className={'text-sm font-bold leading-6 ' + (it.status === 'done' ? 'line-through opacity-60' : '')}>{it.title}</span>
                                </button>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <button disabled={ci <= 0} onClick={() => patch(it, { status: COLS[ci - 1].key })}
                                        className="w-9 h-8 rounded-xl bg-white/10 font-black disabled:opacity-25">→</button>
                                    <button disabled={ci >= COLS.length - 1} onClick={() => patch(it, { status: COLS[ci + 1].key })}
                                        className="w-9 h-8 rounded-xl bg-white/10 font-black disabled:opacity-25">←</button>
                                    {it.owner ? <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-slate-300">{it.owner}</span> : null}
                                    {it.due_date ? <span className={'text-[10px] font-bold px-2 py-1 rounded-lg ' + (late ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-400')}>{it.due_date}</span> : null}
                                    <button onClick={() => setOpen(it)} className="ms-auto text-[11px] font-bold text-gold-500">تفاصيل</button>
                                </div>
                            </div>
                        );
                    })}
                    {!inCol(col).length ? <p className="text-center text-[12px] text-slate-500 py-6">لا بنود في هذا العمود</p> : null}
                </div>

                {/* إضافة */}
                <div className="flex items-center gap-1.5 pt-1">
                    <button onClick={() => setKind(k => (k === 'todo' ? 'issue' : 'todo'))}
                        className={'px-2.5 h-11 rounded-2xl text-[11px] font-black shrink-0 ' +
                            (kind === 'todo' ? 'bg-violet-600' : 'bg-rose-600')}>
                        {kind === 'todo' ? 'مهمة' : 'قضية'}
                    </button>
                    <input value={draft} onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && add()}
                        placeholder={'أضف إلى «' + (COLS.find(c => c.key === col) || {}).name + '»'}
                        className="flex-1 h-11 px-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm outline-none placeholder-slate-500" />
                    <button onClick={add} disabled={!draft.trim()}
                        className="w-11 h-11 rounded-2xl bg-gold-500 text-slate-900 flex items-center justify-center disabled:opacity-30"><Plus size={18} /></button>
                </div>
            </div>

            {/* ورقة التفاصيل */}
            {open ? (
                <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setOpen(null)}>
                    <div onClick={e => e.stopPropagation()}
                        className="w-full bg-[#101b2f] border-t border-white/10 rounded-t-3xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
                        <div className="flex items-center gap-2">
                            <span className="font-black">تفاصيل البند</span>
                            <button onClick={() => del(open.id)} className="ms-auto w-9 h-9 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center"><Trash2 size={15} /></button>
                            <button onClick={() => setOpen(null)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><X size={15} /></button>
                        </div>
                        <textarea rows={2} defaultValue={open.title}
                            onBlur={e => e.target.value.trim() !== open.title && patch(open, { title: e.target.value.trim() })}
                            className="w-full px-3 py-2 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-bold outline-none resize-none" />
                        <div className="grid grid-cols-2 gap-2">
                            <input defaultValue={open.owner || ''} placeholder="المسؤول"
                                onBlur={e => e.target.value !== (open.owner || '') && patch(open, { owner: e.target.value })}
                                className="h-11 px-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm outline-none" />
                            <input type="date" defaultValue={open.due_date || ''}
                                onBlur={e => e.target.value !== (open.due_date || '') && patch(open, { due_date: e.target.value })}
                                className="h-11 px-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm outline-none" />
                        </div>
                        <textarea rows={4} defaultValue={open.decision || ''}
                            placeholder={open.kind === 'todo' ? 'ملاحظات المهمة…' : 'الحل المتفق عليه…'}
                            onBlur={e => e.target.value !== (open.decision || '') && patch(open, { decision: e.target.value })}
                            className="w-full px-3 py-2 rounded-2xl bg-white/[0.06] border border-white/10 text-sm outline-none resize-none" />
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <select defaultValue={open.section || 'other'} onChange={e => patch(open, { section: e.target.value })}
                                className="h-10 px-2 rounded-xl bg-white/[0.06] border border-white/10 text-[12px] outline-none">
                                {DOMAINS.map(d => <option key={d.key} value={d.key} className="bg-slate-800">{d.name}</option>)}
                            </select>
                            <button onClick={() => patch(open, { kind: open.kind === 'todo' ? 'issue' : 'todo' })}
                                className={'px-3 h-10 rounded-xl text-[11px] font-black ' + (open.kind === 'todo' ? 'bg-rose-600' : 'bg-violet-600')}>
                                {open.kind === 'todo' ? 'حوّلها قضية' : 'حوّلها مهمة'}
                            </button>
                            <button onClick={() => { patch(open, { status: 'cancelled' }); setOpen(null); }}
                                className="px-3 h-10 rounded-xl bg-white/10 text-[11px] font-black text-slate-300">إلغاء البند</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
