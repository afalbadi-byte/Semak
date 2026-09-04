import React, { useState, useEffect, useCallback } from 'react';
import {
    Presentation, ChevronRight, ChevronLeft, Plus, Check, Clock, Printer,
    Building2, Landmark, ShoppingCart, Wallet, TrendingUp, RefreshCw, X, Maximize2
} from 'lucide-react';
import { API_URL } from '../../lib/api/client';

const SECTIONS = [
    { key: 'projects',  name: 'المشاريع',            icon: Building2,    color: 'from-blue-600 to-blue-800' },
    { key: 'gov',       name: 'المتعلقات الحكومية',  icon: Landmark,     color: 'from-emerald-600 to-emerald-800' },
    { key: 'purchases', name: 'المشتريات',           icon: ShoppingCart, color: 'from-amber-600 to-amber-800' },
    { key: 'cash',      name: 'السيولة',             icon: Wallet,       color: 'from-rose-600 to-rose-800' },
    { key: 'sales',     name: 'المبيعات',            icon: TrendingUp,   color: 'from-violet-600 to-violet-800' },
];

const PROJECT_NAMES = { 3: 'سماك البوابة', 5: 'سماك (2) الزايدي', 6: 'فيلا د. ليلى', 7: 'التطوير والإدارة', 0: 'بلا مشروع' };

const SUGGESTIONS = {
    projects: [
        'نسبة الإنجاز الفعلية مقابل البرنامج الزمني لكل مشروع',
        'العوائق الحالية في الموقع ومن المسؤول عن حلها',
        'المستخلصات المستحقة للمقاولين هذا الشهر',
        'جودة التنفيذ وملاحظات الاستلام المفتوحة',
    ],
    gov: [
        'قيد المطور العقاري ومتطلباته المتبقية',
        'الإقرار الضريبي للفترة وموعد التقديم',
        'رخص البناء والتمديدات وشهادات الإشغال',
        'اشتراكات الكهرباء والمياه والعدادات',
        'التأمينات والاشتراكات والغرامات إن وجدت',
    ],
    purchases: [
        'أكبر خمسة موردين خلال تسعين يوما ومبرر الصرف',
        'الفواتير بلا مستندات وخطة استكمالها',
        'الالتزامات المدفوعة بلا فواتير',
        'أسعار المواد ومقارنتها بالمعدلات السابقة',
    ],
    cash: [
        'المستحق للموردين ومواعيد السداد',
        'الذمم المتأخرة أكثر من تسعين يوما',
        'التدفق المتوقع للثلاثين يوما القادمة',
        'أولويات الصرف عند شح السيولة',
    ],
    sales: [
        'الوحدات المتاحة والمعروضة والأسعار الحالية',
        'العملاء المهتمون والعروض المرسلة ونسبة التحويل',
        'العروض المعلقة والقرارات المطلوبة',
        'حملات التسويق ونتائجها',
    ],
};

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function MeetingRoom() {
    const [kpis, setKpis]       = useState(null);
    const [meeting, setMeeting] = useState(null);
    const [items, setItems]     = useState([]);
    const [prev, setPrev]       = useState(null);
    const [prevItems, setPrevItems] = useState([]);
    const [idx, setIdx]         = useState(0);
    const [present, setPresent] = useState(false);
    const [busy, setBusy]       = useState(false);
    const [draft, setDraft]     = useState('');

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const [k, m] = await Promise.all([
                fetch(`${API_URL}?action=mtg_kpis`).then(r => r.json()),
                fetch(`${API_URL}?action=mtg_get`).then(r => r.json()),
            ]);
            if (k.success) setKpis(k);
            if (m.success) {
                setMeeting(m.meeting); setItems(m.items || []);
                setPrev(m.previous); setPrevItems(m.previous_items || []);
            }
        } catch (e) {}
        setBusy(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const newMeeting = async () => {
        const r = await fetch(`${API_URL}?action=mtg_save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'اجتماع سماك الدوري ' + new Date().toISOString().slice(0, 10) }),
        }).then(x => x.json());
        if (r.success) load();
    };

    const addItem = async (section, title) => {
        if (!meeting || !title.trim()) return;
        await fetch(`${API_URL}?action=mtg_item_save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meeting_id: meeting.id, section, title: title.trim() }),
        });
        setDraft(''); load();
    };

    const patchItem = async (it, patch) => {
        await fetch(`${API_URL}?action=mtg_item_save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...it, ...patch }),
        });
        load();
    };

    const closeMeeting = async () => {
        if (!meeting || !window.confirm('إغلاق الاجتماع وإصدار المحضر؟')) return;
        await fetch(`${API_URL}?action=mtg_close`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: meeting.id, kpis }),
        });
        load();
    };

    const sec = SECTIONS[idx];
    const secItems = items.filter(i => i.section === sec.key);
    const prevSecItems = prevItems.filter(i => i.section === sec.key);

    const stats = (() => {
        if (!kpis) return [];
        if (sec.key === 'projects') {
            const rows = (kpis.projects.by_project || []);
            return rows.slice(0, 4).map(r => ({ label: PROJECT_NAMES[r.pid] || ('مشروع ' + r.pid),
                value: money(r.spent), sub: r.invoices + ' فاتورة · مسدد ' + money(r.paid) }));
        }
        if (sec.key === 'gov') return [
            { label: 'ضريبة الشهر (مدخلات)', value: money(kpis.gov.vat_month), sub: 'قابلة للاسترداد' },
            { label: 'قيد المطور العقاري', value: kpis.gov.rega ? 'مسجّل' : 'يتابَع', sub: 'الهيئة العامة للعقار' },
        ];
        if (sec.key === 'purchases') return [
            { label: 'مشتريات الشهر', value: money(kpis.purchases.month_total), sub: kpis.purchases.month_count + ' فاتورة' },
            { label: 'إجمالي المشتريات', value: money(kpis.purchases.total), sub: 'منذ بداية المشروع' },
            { label: 'المستحق للموردين', value: money(kpis.purchases.unpaid), sub: 'غير مسدد' },
            { label: 'فواتير بلا مستند', value: kpis.purchases.docs_missing, sub: 'تحتاج استكمال' },
        ];
        if (sec.key === 'cash') return [
            { label: 'المستحق علينا', value: money(kpis.cash.payables), sub: 'ذمم الموردين' },
            { label: 'متأخر أكثر من 90 يوم', value: money(kpis.cash.overdue90), sub: 'أولوية سداد' },
            { label: 'مدفوع بلا فاتورة', value: money(kpis.cash.awaiting_inv), sub: 'التزامات معلقة' },
            { label: 'المدفوع آخر 30 يوم', value: money(kpis.cash.paid_30d), sub: 'تدفق خارج' },
        ];
        return [
            { label: 'وحدات متاحة', value: kpis.sales.units_available, sub: 'للبيع' },
            { label: 'عملاء جدد (30 يوم)', value: kpis.sales.leads_30d, sub: 'اهتمامات' },
            { label: 'عروض مرسلة (30 يوم)', value: kpis.sales.quotes_30d, sub: 'عروض أسعار' },
        ];
    })();

    if (!meeting) {
        return (
            <div className="text-center py-16">
                <Presentation size={44} className="mx-auto text-slate-300 mb-3" />
                <h2 className="text-xl font-black text-brand-900">لا يوجد اجتماع مفتوح</h2>
                <p className="text-sm text-slate-500 mt-1 mb-5">ابدأ اجتماعا جديدا وستُرحَّل إليه البنود المفتوحة من الاجتماع السابق</p>
                <button onClick={newMeeting} className="px-5 py-2.5 rounded-xl bg-brand-900 text-white font-bold text-sm">
                    بدء اجتماع جديد
                </button>
            </div>
        );
    }

    const Wrap = present ? 'div' : React.Fragment;
    const wrapProps = present ? { className: 'fixed inset-0 z-50 bg-slate-900 overflow-auto p-6' } : {};

    return (
        <Wrap {...wrapProps}>
        <div className={present ? 'max-w-6xl mx-auto text-white' : 'space-y-4'}>
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
                <div>
                    <h2 className={'text-2xl font-black flex items-center gap-2 ' + (present ? 'text-white' : 'text-brand-900')}>
                        <Presentation size={24} className="text-gold-500" /> {meeting.title}
                    </h2>
                    <p className={'text-sm mt-1 ' + (present ? 'text-slate-300' : 'text-slate-500')}>
                        {meeting.meet_date} · {meeting.status === 'closed' ? 'مقفل' : 'مفتوح'}
                        {prev ? ' · السابق: ' + prev.meet_date : ''}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setPresent(!present)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500 text-white text-sm font-bold">
                        {present ? <X size={15} /> : <Maximize2 size={15} />} {present ? 'إنهاء العرض' : 'وضع العرض'}
                    </button>
                    <button onClick={load} disabled={busy}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold">
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                    </button>
                    {meeting.status !== 'closed' && (
                        <button onClick={closeMeeting} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">
                            إنهاء وإصدار المحضر
                        </button>
                    )}
                    <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold">
                        <Printer size={15} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap no-print">
                {SECTIONS.map((s, i) => {
                    const Icon = s.icon;
                    const n = items.filter(x => x.section === s.key).length;
                    return (
                        <button key={s.key} onClick={() => setIdx(i)}
                            className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ' +
                                (i === idx ? 'bg-gradient-to-l ' + s.color + ' text-white shadow-lg'
                                           : present ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                            <Icon size={16} /> {s.name} {n > 0 && <span className="text-[11px] opacity-80">({n})</span>}
                        </button>
                    );
                })}
            </div>

            <div className={'rounded-2xl p-5 bg-gradient-to-l ' + sec.color + ' text-white'}>
                <div className="flex items-center gap-2 mb-4">
                    <sec.icon size={22} />
                    <h3 className="text-xl font-black">{sec.name}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {stats.map((s, i) => (
                        <div key={i} className="bg-white/15 rounded-xl p-3">
                            <div className="text-[11px] opacity-80 font-bold">{s.label}</div>
                            <div className="text-2xl font-black mt-0.5">{s.value}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                <div className={'md:col-span-2 rounded-2xl p-4 ' + (present ? 'bg-white/10' : 'bg-white border border-slate-200')}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className={'font-black ' + (present ? 'text-white' : 'text-brand-900')}>بنود النقاش والقرارات</h4>
                        <span className="text-xs text-slate-400">{secItems.length} بند</span>
                    </div>
                    <div className="space-y-2">
                        {secItems.map(it => (
                            <div key={it.id} className={'rounded-xl p-3 ' + (present ? 'bg-white/10' : 'bg-slate-50')}>
                                <div className="flex items-start gap-2">
                                    <button onClick={() => patchItem(it, { status: it.status === 'done' ? 'open' : 'done' })}
                                        className={'mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ' +
                                            (it.status === 'done' ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300')}>
                                        {it.status === 'done' && <Check size={13} />}
                                    </button>
                                    <div className="flex-1">
                                        <div className={'text-sm font-bold ' + (it.status === 'done' ? 'line-through opacity-60' : '') + (present ? ' text-white' : ' text-brand-900')}>
                                            {it.title}
                                            {it.carried_from ? <span className="mr-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">مرحل</span> : null}
                                        </div>
                                        <textarea defaultValue={it.decision || ''} placeholder="القرار المتخذ..."
                                            onBlur={e => e.target.value !== (it.decision || '') && patchItem(it, { decision: e.target.value })}
                                            className={'w-full mt-1.5 px-2 py-1.5 rounded-lg text-xs resize-none ' +
                                                (present ? 'bg-white/10 text-white border-white/20' : 'bg-white border border-slate-200')}
                                            rows={2} />
                                        <div className="flex gap-2 mt-1.5">
                                            <input defaultValue={it.owner || ''} placeholder="المسؤول"
                                                onBlur={e => e.target.value !== (it.owner || '') && patchItem(it, { owner: e.target.value })}
                                                className={'px-2 py-1 rounded-lg text-[11px] w-28 ' + (present ? 'bg-white/10 text-white' : 'bg-white border border-slate-200')} />
                                            <input type="date" defaultValue={it.due_date || ''}
                                                onBlur={e => e.target.value !== (it.due_date || '') && patchItem(it, { due_date: e.target.value })}
                                                className={'px-2 py-1 rounded-lg text-[11px] ' + (present ? 'bg-white/10 text-white' : 'bg-white border border-slate-200')} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!secItems.length && <div className="text-center text-sm text-slate-400 py-6">لا توجد بنود — أضف من المقترحات</div>}
                    </div>
                    {meeting.status !== 'closed' && (
                        <div className="flex gap-2 mt-3">
                            <input value={draft} onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addItem(sec.key, draft)}
                                placeholder="أضف بندا للنقاش..."
                                className={'flex-1 px-3 py-2 rounded-xl text-sm ' + (present ? 'bg-white/10 text-white' : 'border border-slate-200')} />
                            <button onClick={() => addItem(sec.key, draft)}
                                className="px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold"><Plus size={16} /></button>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className={'rounded-2xl p-4 ' + (present ? 'bg-white/10' : 'bg-white border border-slate-200')}>
                        <h4 className={'font-black text-sm mb-2 ' + (present ? 'text-white' : 'text-brand-900')}>مقترحات للنقاش</h4>
                        <div className="space-y-1.5">
                            {(SUGGESTIONS[sec.key] || []).map((s, i) => (
                                <button key={i} onClick={() => addItem(sec.key, s)}
                                    className={'w-full text-right text-xs px-3 py-2 rounded-lg transition ' +
                                        (present ? 'bg-white/5 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 text-slate-600')}>
                                    + {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={'rounded-2xl p-4 ' + (present ? 'bg-white/10' : 'bg-white border border-slate-200')}>
                        <h4 className={'font-black text-sm mb-2 flex items-center gap-1.5 ' + (present ? 'text-white' : 'text-brand-900')}>
                            <Clock size={14} /> الاجتماع السابق {prev ? '· ' + prev.meet_date : ''}
                        </h4>
                        {prevSecItems.length ? (
                            <div className="space-y-1.5">
                                {prevSecItems.map(p => (
                                    <div key={p.id} className={'text-xs p-2 rounded-lg ' + (present ? 'bg-white/5' : 'bg-slate-50')}>
                                        <div className={'font-bold ' + (present ? 'text-slate-200' : 'text-slate-700')}>
                                            {p.status === 'done' ? '✔ ' : '• '}{p.title}
                                        </div>
                                        {p.decision && <div className="text-[11px] text-slate-400 mt-0.5">{p.decision}</div>}
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-xs text-slate-400">لا توجد بنود سابقة في هذا القسم</div>}
                    </div>
                </div>
            </div>
        </div>
        </Wrap>
    );
}
