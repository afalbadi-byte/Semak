import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Presentation, Plus, Check, Clock, Printer, Target, ListChecks, Megaphone,
    Sparkles, AlertTriangle, Flag, RefreshCw, X, Maximize2, Trash2, Play, Pause
} from 'lucide-react';
import { API_URL } from '../../lib/api/client';

// أجندة Level 10 — سبعة أقسام بتوقيت ثابت (90 دقيقة)
const AGENDA = [
    { key: 'segue',     name: 'المقدمة',            min: 5,  icon: Sparkles,   color: 'from-sky-600 to-sky-800',         hint: 'خبر طيب من كل حاضر، شخصي أو مهني' },
    { key: 'scorecard', name: 'لوحة الأرقام',       min: 5,  icon: Target,     color: 'from-blue-600 to-blue-800',       hint: 'كل رقم له مالك: على المسار أو خارجه — بلا نقاش هنا' },
    { key: 'rocks',     name: 'أولويات 90 يوماً',   min: 5,  icon: Flag,       color: 'from-emerald-600 to-emerald-800', hint: 'حالة كل أولوية فقط، وما تعثّر يتحول لقضية' },
    { key: 'headlines', name: 'مستجدات',            min: 5,  icon: Megaphone,  color: 'from-amber-600 to-amber-800',     hint: 'أخبار العملاء والموردين والموظفين بجملة واحدة' },
    { key: 'todos',     name: 'مهام الاجتماع السابق', min: 5, icon: ListChecks, color: 'from-violet-600 to-violet-800',   hint: 'منجزة أم لا — وغير المنجز يتحول لقضية' },
    { key: 'ids',       name: 'القضايا: تحديد ونقاش وحل', min: 60, icon: AlertTriangle, color: 'from-rose-600 to-rose-800', hint: 'رتّب الأهم ثلاثاً، وناقش حتى الحل بمالك وموعد' },
    { key: 'conclude',  name: 'الختام',             min: 5,  icon: Check,      color: 'from-slate-600 to-slate-800',     hint: 'ما يُبلَّغ للفريق، وتقييم الاجتماع من عشرة' },
];

const DOMAINS = [
    { key: 'projects',  name: 'المشاريع' },
    { key: 'gov',       name: 'الحكومية' },
    { key: 'purchases', name: 'المشتريات' },
    { key: 'cash',      name: 'السيولة' },
    { key: 'sales',     name: 'المبيعات' },
];

const PROJECT_NAMES = { 3: 'سماك البوابة', 5: 'سماك (2)', 6: 'فيلا د. ليلى', 7: 'التطوير والإدارة', 0: 'بلا مشروع' };
const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const mmss = s => Math.floor(s / 60) + ':' + String(Math.abs(s % 60)).padStart(2, '0');

export default function MeetingRoom() {
    const [kpis, setKpis]       = useState(null);
    const [meeting, setMeeting] = useState(null);
    const [items, setItems]     = useState([]);
    const [prev, setPrev]       = useState(null);
    const [prevItems, setPrevItems] = useState([]);
    const [rocks, setRocks]     = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [editBud, setEditBud] = useState(null);
    const [hiddenAuto, setHiddenAuto] = useState(() => { try { return JSON.parse(localStorage.getItem('mtg_hidden_auto') || '[]'); } catch (e) { return []; } });
    const toggleAuto = name => setHiddenAuto(prev => { const nx = prev.includes(name) ? prev.filter(x => x !== name) : prev.concat(name); try { localStorage.setItem('mtg_hidden_auto', JSON.stringify(nx)); } catch (e) {} return nx; });
    const [showHidden, setShowHidden] = useState(false);
    const [idx, setIdx]         = useState(0);
    const [present, setPresent] = useState(false);
    const [busy, setBusy]       = useState(false);
    const [draft, setDraft]     = useState('');
    const [dom, setDom]         = useState('purchases');
    const [left, setLeft]       = useState(AGENDA[0].min * 60);
    const [running, setRunning] = useState(false);
    const tick = useRef(null);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const [k, m, r, bd] = await Promise.all([
                fetch(`${API_URL}?action=mtg_kpis`).then(x => x.json()),
                fetch(`${API_URL}?action=mtg_get`).then(x => x.json()),
                fetch(`${API_URL}?action=rock_list`).then(x => x.json()),
                fetch(`${API_URL}?action=pbudget_list`).then(x => x.json()),
            ]);
            if (k.success) setKpis(k);
            if (r.success) setRocks(r.data || []);
            if (bd && bd.success) setBudgets(bd.data || []);
            if (m.success) {
                setMeeting(m.meeting); setItems(m.items || []);
                setPrev(m.previous); setPrevItems(m.previous_items || []);
                const sc = await fetch(`${API_URL}?action=score_list&meeting_id=${m.meeting ? m.meeting.id : 0}`).then(x => x.json());
                if (sc.success) setMetrics(sc.data || []);
            }
        } catch (e) {}
        setBusy(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!running) { clearInterval(tick.current); return; }
        tick.current = setInterval(() => setLeft(v => v - 1), 1000);
        return () => clearInterval(tick.current);
    }, [running]);

    const goSection = i => { setIdx(i); setLeft(AGENDA[i].min * 60); setRunning(false); };

    const post = (action, body) => fetch(`${API_URL}?action=${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json());

    const newMeeting = async () => {
        const r = await post('mtg_save', { title: 'اجتماع سماك الدوري ' + new Date().toISOString().slice(0, 10) });
        if (r.success) load();
    };
    const patchMeeting = async patch => { await post('mtg_save', { ...meeting, ...patch }); load(); };
    const addItem = async (kind, title, section) => {
        if (!meeting || !title.trim()) return;
        await post('mtg_item_save', { meeting_id: meeting.id, kind, section: section || dom, title: title.trim() });
        setDraft(''); load();
    };
    const patchItem = async (it, patch) => { await post('mtg_item_save', { ...it, ...patch }); load(); };
    const delItem = async id => { await post('mtg_item_delete', { id }); load(); };
    const saveRock = async r => { await post('rock_save', r); load(); };
    const delRock = async id => { if (window.confirm('حذف هذه الأولوية؟')) { await post('rock_delete', { id }); load(); } };
    const saveBudget = async b => { await post('pbudget_save', b); setEditBud(null); load(); };
    const saveMetric = async m => { await post('score_save', { ...m, meeting_id: meeting ? meeting.id : 0 }); load(); };
    const delMetric = async id => { if (window.confirm('حذف هذا المؤشر؟')) { await post('score_delete', { id }); load(); } };
    const closeMeeting = async rating => {
        if (!window.confirm('إنهاء الاجتماع وإصدار المحضر؟')) return;
        await post('mtg_close', { id: meeting.id, kpis, rating, summary: meeting.summary || '' });
        load();
    };

    const autoMetrics = () => {
        if (!kpis) return [];
        return [
            { name: 'مشتريات الشهر',            val: kpis.purchases.month_total, target: null, dom: 'purchases' },
            { name: 'المستحق للموردين',          val: kpis.purchases.unpaid,      target: null, dom: 'cash' },
            { name: 'متأخر أكثر من 90 يوم',      val: kpis.cash.overdue90,        target: 0,    dom: 'cash', lower: true },
            { name: 'مدفوع بلا فاتورة',          val: kpis.cash.awaiting_inv,     target: 0,    dom: 'cash', lower: true },
            { name: 'فواتير بلا مستند',          val: kpis.purchases.docs_missing, target: 0,   dom: 'purchases', lower: true },
            { name: 'وحدات متاحة للبيع',         val: kpis.sales.units_available, target: null, dom: 'sales' },
            { name: 'عملاء جدد (30 يوم)',        val: kpis.sales.leads_30d,       target: null, dom: 'sales' },
            { name: 'ضريبة الشهر (مدخلات)',      val: kpis.gov.vat_month,         target: null, dom: 'gov' },
            { name: 'ضريبة قابلة للاسترداد (شهر)', val: kpis.gov.vat_month,        target: null, dom: 'gov' },
            { name: 'نسبة تغطية المستندات',      val: kpis.purchases.docs_coverage, target: 90,  dom: 'purchases', unit: '%' },
            { name: 'نسبة السداد للموردين',      val: kpis.purchases.paid_pct,     target: 90,   dom: 'cash', unit: '%' },
            { name: 'متوسط قيمة الفاتورة',       val: kpis.purchases.avg_invoice,  target: null, dom: 'purchases' },
            { name: 'موردون نشطون (90 يوم)',     val: kpis.purchases.active_suppliers, target: null, dom: 'purchases' },
            { name: 'مصروف الفيلا',              val: kpis.projects.villa_spent,   target: null, dom: 'projects' },
            { name: 'وحدات مباعة',               val: kpis.projects.units_sold,    target: null, dom: 'sales' },
            { name: 'قضايا مفتوحة من السابق',    val: prevItems.filter(x => x.status === 'open').length, target: 0, dom: 'projects', lower: true },
            { name: 'أولويات متعثرة',            val: rocks.filter(r => r.status === 'off_track').length, target: 0, dom: 'projects', lower: true },
        ];
    };

    if (!meeting) {
        return (
            <div className="text-center py-16">
                <Presentation size={44} className="mx-auto text-slate-300 mb-3" />
                <h2 className="text-xl font-black text-brand-900">لا يوجد اجتماع مفتوح</h2>
                <p className="text-sm text-slate-500 mt-1 mb-5">
                    الأجندة على منهجية Level 10: سبعة أقسام في تسعين دقيقة، وتُرحَّل البنود المفتوحة تلقائياً
                </p>
                <button onClick={newMeeting} className="px-5 py-2.5 rounded-xl bg-brand-900 text-white font-bold text-sm">بدء اجتماع جديد</button>
            </div>
        );
    }

    const sec = AGENDA[idx];
    const issues = items.filter(i => i.kind !== 'todo');
    const todos  = items.filter(i => i.kind === 'todo');
    const prevTodos = prevItems.filter(i => i.kind === 'todo' || i.status === 'open');
    const box = present ? 'bg-white/10 border-white/10' : 'bg-white border-slate-200';
    const txt = present ? 'text-white' : 'text-brand-900';
    const Wrap = present ? 'div' : React.Fragment;
    const wrapProps = present ? { className: 'fixed inset-0 z-50 bg-slate-900 overflow-auto p-6' } : {};

    return (
        <Wrap {...wrapProps}>
        <div className={present ? 'max-w-6xl mx-auto space-y-4' : 'space-y-4'}>
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
                <div>
                    <h2 className={'text-2xl font-black flex items-center gap-2 ' + txt}>
                        <Presentation size={24} className="text-gold-500" /> {meeting.title}
                    </h2>
                    <p className={'text-sm mt-1 ' + (present ? 'text-slate-300' : 'text-slate-500')}>
                        {meeting.meet_date} · {meeting.status === 'closed' ? 'مقفل' : 'مفتوح'}
                        {prev ? ' · السابق ' + prev.meet_date : ''}
                        {meeting.rating ? ' · التقييم ' + meeting.rating + '/10' : ''}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className={'flex items-center gap-2 px-3 py-2 rounded-xl font-black tabular-nums ' +
                        (left < 0 ? 'bg-red-500 text-white' : present ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700')}>
                        <Clock size={15} /> {mmss(left)}
                        <button onClick={() => setRunning(!running)} className="opacity-80 hover:opacity-100">
                            {running ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                    </div>
                    <button onClick={() => setPresent(!present)} className="px-3 py-2 rounded-xl bg-gold-500 text-white text-sm font-bold">
                        {present ? <X size={15} /> : <Maximize2 size={15} />}
                    </button>
                    <button onClick={load} className="px-3 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold">
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold">
                        <Printer size={15} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap no-print">
                {AGENDA.map((a, i) => {
                    const Icon = a.icon;
                    return (
                        <button key={a.key} onClick={() => goSection(i)}
                            className={'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ' +
                                (i === idx ? 'bg-gradient-to-l ' + a.color + ' text-white shadow-lg'
                                           : present ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                            <Icon size={14} /> {a.name}
                            <span className="opacity-60">{a.min}د</span>
                        </button>
                    );
                })}
            </div>

            <div className={'rounded-2xl p-4 bg-gradient-to-l ' + sec.color + ' text-white'}>
                <div className="flex items-center gap-2">
                    <sec.icon size={20} />
                    <h3 className="text-lg font-black">{sec.name}</h3>
                    <span className="text-xs opacity-80 mr-auto">{sec.hint}</span>
                </div>
            </div>

            {sec.key === 'segue' && (
                <div className={'rounded-2xl border p-4 ' + box}>
                    <textarea defaultValue={meeting.segue || ''} rows={5}
                        onBlur={e => e.target.value !== (meeting.segue || '') && patchMeeting({ segue: e.target.value })}
                        placeholder="أخبار طيبة من كل حاضر — سطر لكل شخص"
                        className={'w-full px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                    <input defaultValue={meeting.attendees || ''} placeholder="الحضور (أسماء مفصولة بفاصلة)"
                        onBlur={e => e.target.value !== (meeting.attendees || '') && patchMeeting({ attendees: e.target.value })}
                        className={'w-full mt-2 px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                </div>
            )}

            {sec.key === 'scorecard' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between no-print">
                        <span className={'text-xs font-black ' + txt}>مؤشرات آلية من بياناتنا</span>
                        {hiddenAuto.length > 0 && (
                            <button onClick={() => setShowHidden(!showHidden)} className="text-[11px] font-bold text-slate-400">
                                {showHidden ? 'إخفاء المخفية' : 'إظهار المخفية (' + hiddenAuto.length + ')'}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {autoMetrics().filter(m => showHidden || !hiddenAuto.includes(m.name)).map((m, i) => {
                            const off = m.target != null && (m.lower ? m.val > m.target : m.val < m.target);
                            return (
                                <div key={i} className={'rounded-xl p-3 border ' + (off ? 'bg-red-50 border-red-200' : present ? 'bg-white/10 border-white/10' : 'bg-emerald-50 border-emerald-100')}>
                                    <div className="flex items-start justify-between gap-1">
                                      <div className={'text-[11px] font-bold ' + (present ? 'text-slate-300' : 'text-slate-500')}>{m.name}</div>
                                      <button onClick={() => toggleAuto(m.name)} title={hiddenAuto.includes(m.name) ? 'إظهار' : 'إخفاء الكرت'}
                                        className="text-slate-300 hover:text-red-500 shrink-0">
                                        {hiddenAuto.includes(m.name) ? <Plus size={12} /> : <X size={12} />}
                                      </button>
                                    </div>
                                    <div className={'text-xl font-black mt-0.5 ' + (off ? 'text-red-700' : present ? 'text-white' : 'text-emerald-800')}>{money(m.val)}{m.unit || ''}</div>
                                    <div className="text-[10px] mt-0.5 opacity-70">{off ? 'خارج المسار' : 'على المسار'} · آلي</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-3 ' + txt}>نسبة استهلاك ميزانية كل مشروع</h4>
                        <div className="grid md:grid-cols-3 gap-3">
                            {budgets.map(b => {
                                const pct = b.pct == null ? null : Number(b.pct);
                                const over = pct != null && pct > 100;
                                const near = pct != null && pct > 85 && pct <= 100;
                                const bar = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
                                return (
                                    <div key={b.project_id} className={'rounded-xl p-3 ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                        <div className="flex items-center justify-between">
                                            <div className={'text-sm font-black ' + txt}>{b.name}</div>
                                            <button onClick={() => setEditBud(b)} className="text-[11px] text-slate-400">تعديل</button>
                                        </div>
                                        <div className={'text-2xl font-black mt-1 ' + (over ? 'text-red-600' : txt)}>{pct == null ? '—' : pct + '%'}</div>
                                        <div className="h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                                            <div className={'h-full ' + bar} style={{ width: Math.min(100, pct || 0) + '%' }} />
                                        </div>
                                        <div className="text-[11px] mt-1.5 opacity-70">مصروف {money(b.spent)} من {money(b.cost_budget)} <span className="opacity-70">({b.basis === 'gross' ? 'شامل الضريبة' : 'قبل الضريبة'})</span></div>
                                        <div className="text-[11px] opacity-60">المتبقي {money(b.remaining)} · {b.invoices} فاتورة · {b.ptype === 'contracting' ? 'مقاولات' : 'تطوير'}</div>
                                        {b.ptype === 'contracting' && (
                                            <div className="text-[11px] opacity-60">قيمة العقد {money(b.budget)} · هامش {Number(b.margin_pct)}% = {money(b.margin_value)}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-2 ' + txt}>مؤشرات يدوية (لها مالك وحد)</h4>
                        <div className="space-y-2">
                            {metrics.map(m => {
                                const v = m.val == null ? null : Number(m.val);
                                const off = v != null && m.target != null && (m.direction === 'lte' ? v > Number(m.target) : v < Number(m.target));
                                return (
                                    <div key={m.id} className={'flex items-center gap-2 p-2 rounded-xl ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                        <div className={'flex-1 text-sm font-bold ' + txt}>{m.name}
                                            <span className="text-[11px] text-slate-400 mr-2">{m.owner || 'بلا مالك'} · الحد {m.target ?? '—'}</span>
                                        </div>
                                        <input type="number" defaultValue={m.val ?? ''} placeholder="القيمة"
                                            onBlur={e => e.target.value !== String(m.val ?? '') && saveMetric({ ...m, val: e.target.value })}
                                            className={'w-24 px-2 py-1 rounded-lg text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                                        <span className={'px-2 py-1 rounded-lg text-[11px] font-bold ' + (v == null ? 'bg-slate-100 text-slate-400' : off ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                                            {v == null ? '—' : off ? 'خارج' : 'على المسار'}
                                        </span>
                                        <button onClick={() => delMetric(m.id)} className="text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                );
                            })}
                        </div>
                        <MetricForm onSave={saveMetric} present={present} />
                    </div>
                </div>
            )}

            {sec.key === 'rocks' && (
                <div className={'rounded-2xl border p-4 ' + box}>
                    <div className="space-y-2">
                        {rocks.map(r => (
                            <div key={r.id} className={'flex items-center gap-2 p-2 rounded-xl ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                <select value={r.status} onChange={e => saveRock({ ...r, status: e.target.value })}
                                    className={'px-2 py-1 rounded-lg text-[11px] font-bold ' +
                                        (r.status === 'done' ? 'bg-emerald-100 text-emerald-700' : r.status === 'off_track' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                    <option value="on_track">على المسار</option>
                                    <option value="off_track">متعثرة</option>
                                    <option value="done">منجزة</option>
                                    <option value="cancelled">ملغاة</option>
                                </select>
                                <div className={'flex-1 text-sm font-bold ' + txt}>{r.title}
                                    <span className="text-[11px] text-slate-400 mr-2">{r.owner || 'بلا مالك'} {r.due_date ? '· ' + r.due_date : ''}</span>
                                </div>
                                {r.status === 'off_track' && (
                                    <button onClick={() => addItem('issue', 'أولوية متعثرة: ' + r.title, r.section || 'projects')}
                                        className="text-[11px] px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">حوّلها لقضية</button>
                                )}
                                <button onClick={() => delRock(r.id)} className="text-red-400"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        {!rocks.length && <div className="text-center text-sm text-slate-400 py-4">لا توجد أولويات — أضف أولويات التسعين يوماً</div>}
                    </div>
                    <RockForm onSave={saveRock} present={present} />
                </div>
            )}

            {sec.key === 'headlines' && (
                <div className={'rounded-2xl border p-4 ' + box}>
                    <textarea defaultValue={meeting.headlines || ''} rows={6}
                        onBlur={e => e.target.value !== (meeting.headlines || '') && patchMeeting({ headlines: e.target.value })}
                        placeholder="أخبار العملاء والموردين والموظفين — سطر لكل خبر"
                        className={'w-full px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                </div>
            )}

            {sec.key === 'todos' && (
                <div className="grid md:grid-cols-2 gap-4">
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-2 ' + txt}>مهام هذا الاجتماع</h4>
                        <div className="space-y-2">
                            {todos.map(it => (
                                <div key={it.id} className={'flex items-start gap-2 p-2 rounded-xl ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                    <button onClick={() => patchItem(it, { status: it.status === 'done' ? 'open' : 'done' })}
                                        className={'mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ' +
                                            (it.status === 'done' ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300')}>
                                        {it.status === 'done' && <Check size={13} />}
                                    </button>
                                    <div className="flex-1">
                                        <div className={'text-sm font-bold ' + (it.status === 'done' ? 'line-through opacity-60 ' : '') + txt}>{it.title}</div>
                                        <div className="flex gap-2 mt-1">
                                            <input defaultValue={it.owner || ''} placeholder="المسؤول"
                                                onBlur={e => e.target.value !== (it.owner || '') && patchItem(it, { owner: e.target.value })}
                                                className={'px-2 py-1 rounded-lg text-[11px] w-24 ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                                            <input type="date" defaultValue={it.due_date || ''}
                                                onBlur={e => e.target.value !== (it.due_date || '') && patchItem(it, { due_date: e.target.value })}
                                                className={'px-2 py-1 rounded-lg text-[11px] ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                                        </div>
                                    </div>
                                    <button onClick={() => delItem(it.id)} className="text-red-400"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            {!todos.length && <div className="text-center text-sm text-slate-400 py-4">لا مهام بعد</div>}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <input value={draft} onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addItem('todo', draft)}
                                placeholder="مهمة جديدة..."
                                className={'flex-1 px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                            <button onClick={() => addItem('todo', draft)} className="px-4 py-2 rounded-xl bg-brand-900 text-white"><Plus size={16} /></button>
                        </div>
                    </div>
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-2 flex items-center gap-1.5 ' + txt}>
                            <Clock size={14} /> من الاجتماع السابق {prev ? '· ' + prev.meet_date : ''}
                        </h4>
                        <div className="space-y-1.5">
                            {prevTodos.map(p => (
                                <div key={p.id} className={'text-xs p-2 rounded-lg ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                    <span className={p.status === 'done' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                        {p.status === 'done' ? 'منجزة: ' : 'معلقة: '}
                                    </span>
                                    <span className={present ? 'text-slate-200' : 'text-slate-700'}>{p.title}</span>
                                    {p.decision && <div className="text-[11px] text-slate-400 mt-0.5">{p.decision}</div>}
                                </div>
                            ))}
                            {!prevTodos.length && <div className="text-xs text-slate-400">لا يوجد سابق</div>}
                        </div>
                    </div>
                </div>
            )}

            {sec.key === 'ids' && (
                <div className="space-y-3">
                    <div className="flex gap-1.5 flex-wrap no-print">
                        {DOMAINS.map(d => (
                            <button key={d.key} onClick={() => setDom(d.key)}
                                className={'px-3 py-1.5 rounded-lg text-xs font-bold ' +
                                    (dom === d.key ? 'bg-rose-600 text-white' : present ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                                {d.name} ({issues.filter(i => i.section === d.key).length})
                            </button>
                        ))}
                    </div>
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <div className="space-y-2">
                            {issues.filter(i => i.section === dom).map(it => (
                                <div key={it.id} className={'rounded-xl p-3 ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                    <div className="flex items-start gap-2">
                                        <button onClick={() => patchItem(it, { status: it.status === 'done' ? 'open' : 'done' })}
                                            className={'mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ' +
                                                (it.status === 'done' ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300')}>
                                            {it.status === 'done' && <Check size={13} />}
                                        </button>
                                        <div className="flex-1">
                                            <div className={'text-sm font-bold ' + (it.status === 'done' ? 'line-through opacity-60 ' : '') + txt}>
                                                {it.title}
                                                {it.carried_from ? <span className="mr-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">مرحل</span> : null}
                                            </div>
                                            <textarea defaultValue={it.decision || ''} rows={2} placeholder="الحل المتفق عليه..."
                                                onBlur={e => e.target.value !== (it.decision || '') && patchItem(it, { decision: e.target.value })}
                                                className={'w-full mt-1.5 px-2 py-1.5 rounded-lg text-xs resize-none ' + (present ? 'bg-white/10 text-white' : 'bg-white border border-slate-200')} />
                                            <div className="flex gap-2 mt-1.5">
                                                <input defaultValue={it.owner || ''} placeholder="المسؤول"
                                                    onBlur={e => e.target.value !== (it.owner || '') && patchItem(it, { owner: e.target.value })}
                                                    className={'px-2 py-1 rounded-lg text-[11px] w-24 ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                                                <input type="date" defaultValue={it.due_date || ''}
                                                    onBlur={e => e.target.value !== (it.due_date || '') && patchItem(it, { due_date: e.target.value })}
                                                    className={'px-2 py-1 rounded-lg text-[11px] ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                                                <button onClick={() => patchItem(it, { kind: 'todo' })}
                                                    className="text-[11px] px-2 py-1 rounded-lg bg-violet-600 text-white font-bold">حوّلها لمهمة</button>
                                            </div>
                                        </div>
                                        <button onClick={() => delItem(it.id)} className="text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {!issues.filter(i => i.section === dom).length && <div className="text-center text-sm text-slate-400 py-6">لا قضايا في هذا المحور</div>}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <input value={draft} onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addItem('issue', draft)}
                                placeholder="أضف قضية..."
                                className={'flex-1 px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                            <button onClick={() => addItem('issue', draft)} className="px-4 py-2 rounded-xl bg-rose-600 text-white"><Plus size={16} /></button>
                        </div>
                    </div>
                </div>
            )}

            {sec.key === 'conclude' && (
                <div className="grid md:grid-cols-2 gap-4">
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-2 ' + txt}>ما يُبلَّغ للفريق</h4>
                        <textarea defaultValue={meeting.cascading || ''} rows={5}
                            onBlur={e => e.target.value !== (meeting.cascading || '') && patchMeeting({ cascading: e.target.value })}
                            placeholder="الرسائل التي تُنقل للموظفين بعد الاجتماع"
                            className={'w-full px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                        <h4 className={'font-black text-sm mt-3 mb-2 ' + txt}>خلاصة الاجتماع</h4>
                        <textarea defaultValue={meeting.summary || ''} rows={3}
                            onBlur={e => e.target.value !== (meeting.summary || '') && patchMeeting({ summary: e.target.value })}
                            placeholder="سطران يلخصان ما تم"
                            className={'w-full px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                    </div>
                    <div className={'rounded-2xl border p-4 ' + box}>
                        <h4 className={'font-black text-sm mb-3 ' + txt}>تقييم الاجتماع</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <button key={n} onClick={() => closeMeeting(n)} disabled={meeting.status === 'closed'}
                                    className={'w-10 h-10 rounded-xl font-black text-sm disabled:opacity-40 ' +
                                        (n >= 8 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-300')}>{n}</button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-3">
                            اضغط الرقم لإنهاء الاجتماع وإصدار المحضر. المستهدف عشرة، وما دون الثمانية يستدعي قضية في الاجتماع القادم.
                        </p>
                        <div className={'mt-4 p-3 rounded-xl text-xs ' + (present ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-600')}>
                            <div className="font-black mb-1">ملخص سريع</div>
                            <div>القضايا: {issues.length} · المحلولة: {issues.filter(i => i.status === 'done').length}</div>
                            <div>المهام: {todos.length} · المنجزة: {todos.filter(i => i.status === 'done').length}</div>
                            <div>الأولويات المتعثرة: {rocks.filter(r => r.status === 'off_track').length} من {rocks.length}</div>
                        </div>
                    </div>
                </div>
            )}
        {editBud && <BudgetForm item={editBud} onCancel={() => setEditBud(null)} onSave={saveBudget} />}
        </div>
        </Wrap>
    );
}

function RockForm({ onSave, present }) {
    const [t, setT] = useState(''); const [o, setO] = useState(''); const [d, setD] = useState('');
    const cls = 'px-2 py-1.5 rounded-lg text-xs ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200');
    return (
        <div className="flex flex-wrap gap-2 mt-3">
            <input value={t} onChange={e => setT(e.target.value)} placeholder="أولوية جديدة لتسعين يوماً" className={cls + ' flex-1 min-w-[180px]'} />
            <input value={o} onChange={e => setO(e.target.value)} placeholder="المالك" className={cls + ' w-24'} />
            <input type="date" value={d} onChange={e => setD(e.target.value)} className={cls} />
            <button disabled={!t.trim()} onClick={() => { onSave({ title: t, owner: o, due_date: d, status: 'on_track' }); setT(''); setO(''); setD(''); }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">إضافة</button>
        </div>
    );
}

function MetricForm({ onSave, present }) {
    const [n, setN] = useState(''); const [o, setO] = useState(''); const [t, setT] = useState(''); const [dir, setDir] = useState('gte');
    const cls = 'px-2 py-1.5 rounded-lg text-xs ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200');
    return (
        <div className="flex flex-wrap gap-2 mt-3">
            <input value={n} onChange={e => setN(e.target.value)} placeholder="مؤشر جديد" className={cls + ' flex-1 min-w-[160px]'} />
            <input value={o} onChange={e => setO(e.target.value)} placeholder="المالك" className={cls + ' w-24'} />
            <input type="number" value={t} onChange={e => setT(e.target.value)} placeholder="الحد" className={cls + ' w-20'} />
            <select value={dir} onChange={e => setDir(e.target.value)} className={cls}>
                <option value="gte">لا يقل عن</option>
                <option value="lte">لا يزيد عن</option>
            </select>
            <button disabled={!n.trim()} onClick={() => { onSave({ name: n, owner: o, target: t, direction: dir }); setN(''); setO(''); setT(''); }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-40">إضافة</button>
        </div>
    );
}

function BudgetForm({ item, onCancel, onSave }) {
    const [b, setB] = useState(String(item.budget || ''));
    const [n, setN] = useState(item.name || '');
    const [k, setK] = useState(item.kind || 'cost');
    const [pt, setPt] = useState(item.ptype || 'dev');
    const [mg, setMg] = useState(String(item.margin_pct ?? (item.ptype === 'contracting' ? 10 : 0)));
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
                <h3 className="font-black text-brand-900">ميزانية المشروع</h3>
                <input value={n} onChange={e => setN(e.target.value)} placeholder="اسم المشروع"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <input type="number" value={b} onChange={e => setB(e.target.value)} placeholder="الميزانية"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <select value={pt} onChange={e => { setPt(e.target.value); setMg(e.target.value === 'contracting' ? '10' : '0'); }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="dev">تطوير — التكلفة قبل الضريبة</option>
                    <option value="contracting">مقاولات — التكلفة شاملة الضريبة</option>
                </select>
                {pt === 'contracting' && (
                    <label className="block text-xs text-slate-500">
                        هامش سماك على التكلفة (%)
                        <input type="number" value={mg} onChange={e => setMg(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                    </label>
                )}
                <select value={k} onChange={e => setK(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="cost">ميزانية تكلفة</option>
                    <option value="contract">قيمة عقد</option>
                </select>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">إلغاء</button>
                    <button onClick={() => onSave({ project_id: item.project_id, name: n, budget: b, kind: k, ptype: pt, margin_pct: mg })}
                        className="px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold">حفظ</button>
                </div>
            </div>
        </div>
    );
}
