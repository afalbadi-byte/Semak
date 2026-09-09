import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Users, FileWarning, Receipt, RotateCcw, Ticket,
    RefreshCw, Search, AlertTriangle, CheckCircle2, ChevronLeft,
} from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import ExportButton from '../../components/ExportButton';
import { EntityProvider } from '../buy/entityStack';
import { useEntity } from '../buy/entityCtx';

// ─── مركز المشتريات على الشاشة الكبيرة ──────────────────────────────────────
// نفس نقاط تطبيق الجوال حرفياً — الفواتير والموردون وكشف الحساب وإثباتات
// السداد وفجوات التوثيق والمرتجعات والتذاكر — بجداول عريضة وتصدير وطباعة.
// البطاقة التي تُفتح من أي صف هي بطاقة التطبيق نفسها (BuyEntity)، فما يراه
// الموظف على جواله هو ما يراه على مكتبه، لا نسختان تفترقان.

const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const get = (a, q = '') => fetch(`${API_URL}?action=${a}${q}`, { headers: auth() }).then(r => r.json());

const TABS = [
    { k: 'invoices',  t: 'الفواتير',        i: ShoppingCart },
    { k: 'suppliers', t: 'الموردون',        i: Users },
    { k: 'proofs',    t: 'إثباتات السداد',  i: Receipt },
    { k: 'gaps',      t: 'فجوات التوثيق',   i: FileWarning },
    { k: 'refunds',   t: 'المرتجعات',       i: RotateCcw },
    { k: 'tickets',   t: 'تذاكر المستندات', i: Ticket },
];

// ─── عناصر مشتركة ───────────────────────────────────────────────────────────
function Card({ t, v, sub, warn }) {
    return (
        <div className={`rounded-2xl border p-4 bg-white dark:bg-brand-800 ${warn ? 'border-amber-300' : 'border-slate-100 dark:border-brand-700'}`}>
            <div className="text-[11px] font-bold text-slate-400 dark:text-brand-400">{t}</div>
            <div className={`text-lg font-black ${warn ? 'text-amber-600 dark:text-amber-300' : 'text-[#1a365d] dark:text-brand-100'}`}>{v}</div>
            {sub && <div className="text-[10px] text-slate-400 dark:text-brand-400 mt-0.5">{sub}</div>}
        </div>
    );
}

function Table({ cols, rows, onRow, empty = 'لا صفوف' }) {
    if (!rows?.length) return <div className="py-10 text-center text-sm text-slate-400">{empty}</div>;
    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-brand-700">
            <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 dark:bg-brand-800">
                    <tr>{cols.map(c => (
                        <th key={c.k} className="px-3 py-2.5 text-[11px] font-black text-slate-500 dark:text-brand-300 whitespace-nowrap">{c.t}</th>
                    ))}</tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.__key || r.id || i}
                            onClick={onRow ? () => onRow(r) : undefined}
                            className={`border-t border-slate-50 dark:border-brand-700 ${onRow ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-brand-800' : ''}`}>
                            {cols.map(c => (
                                <td key={c.k} className="px-3 py-2.5 text-xs text-slate-700 dark:text-brand-200 whitespace-nowrap">
                                    {c.r ? c.r(r) : (r[c.k] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── الفواتير ───────────────────────────────────────────────────────────────
function Invoices() {
    const { openEntity } = useEntity();
    const [q, setQ] = useState('');
    const [flt, setFlt] = useState('');
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState(true);

    const load = useCallback(() => {
        setBusy(true);
        let s = `&limit=100&q=${encodeURIComponent(q)}`;
        if (flt) s += `&${flt}=1`;
        get('buy_list', `&kind=invoices${s}`).then(r => { setD(r); setBusy(false); });
    }, [q, flt]);
    useEffect(() => { load(); }, [load]);

    const s = d?.summary || {};
    const cols = [
        { k: 'no', t: 'الرقم', r: r => <span className="font-black">{r.no || '—'}</span> },
        { k: 'date', t: 'التاريخ' },
        { k: 'supplier', t: 'المورد', r: r => <span className="font-bold">{r.supplier}</span> },
        { k: 'gross', t: 'الإجمالي', r: r => money(r.gross) },
        { k: 'paid', t: 'المسدد', r: r => money(r.paid) },
        { k: 'remaining', t: 'المتبقي', r: r => <span className={Number(r.remaining) > 0.5 ? 'text-amber-600 dark:text-amber-300 font-bold' : ''}>{money(r.remaining)}</span> },
        { k: 'project', t: 'المشروع', r: r => r.project || <span className="text-slate-300">بلا</span> },
        { k: 'docs', t: 'المستندات', r: r => <span className={Number(r.orig_docs) ? '' : 'text-amber-600'}>{r.docs}</span> },
        { k: 'origin', t: 'المصدر', r: r => r.origin === 'local' ? 'التطبيق' : 'دفترة' },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card t="الفواتير" v={s.n ?? '—'} />
                <Card t="الإجمالي" v={money(s.gross)} />
                <Card t="المستحق" v={money(s.outstanding)} warn={Number(s.outstanding) > 0} sub={`${s.unpaid_n || 0} فاتورة`} />
                <Card t="زيادة سداد" v={money(s.overpaid)} warn={Number(s.overpaid) > 0.5} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="مورد أو رقم فاتورة"
                        className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-800 text-sm" />
                </div>
                {[['', 'الكل'], ['unpaid', 'غير مسددة'], ['no_docs', 'بلا مستند'], ['daftra_doc', 'لها مرفق دفترة']].map(([k, t]) => (
                    <button key={k} onClick={() => setFlt(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${flt === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{t}</button>
                ))}
                <ExportButton rows={d?.data || []} filename="فواتير-الشراء"
                    columns={[{ key: 'no', label: 'الرقم' }, { key: 'date', label: 'التاريخ' }, { key: 'supplier', label: 'المورد' },
                              { key: 'gross', label: 'الإجمالي' }, { key: 'paid', label: 'المسدد' }, { key: 'remaining', label: 'المتبقي' },
                              { key: 'project', label: 'المشروع' }]} />
                <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 dark:border-brand-700"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button>
            </div>
            <Table cols={cols} rows={d?.data} onRow={r => openEntity('purchase', r.id)} empty={busy ? 'جارٍ التحميل…' : 'لا فواتير'} />
        </div>
    );
}

// ─── الموردون وكشف الحساب ───────────────────────────────────────────────────
function Suppliers() {
    const { openEntity } = useEntity();
    const [q, setQ] = useState('');
    const [rows, setRows] = useState(null);
    const [sup, setSup] = useState('');
    const load = useCallback(() => {
        get('buy_list', `&kind=suppliers&limit=100&q=${encodeURIComponent(q)}`).then(r => setRows(r.data || []));
    }, [q]);
    useEffect(() => { load(); }, [load]);

    if (sup) return <Statement supplier={sup} onBack={() => setSup('')} onOpen={openEntity} />;

    const cols = [
        { k: 'name', t: 'المورد', r: r => <span className="font-bold">{r.name}</span> },
        { k: 'invoices', t: 'الفواتير' },
        { k: 'gross', t: 'الإجمالي', r: r => money(r.gross) },
        { k: 'refunds_net', t: 'مرتجع غير مسترَدّ', r: r => Number(r.refunds_net) > 0.5 ? <span className="text-amber-600">{money(r.refunds_net)}</span> : '—' },
        { k: 'outstanding', t: 'المستحق', r: r => <span className={Number(r.outstanding) > 0.5 ? 'font-bold text-amber-600 dark:text-amber-300' : ''}>{money(r.outstanding)}</span> },
        { k: 'last_date', t: 'آخر تعامل' },
        { k: 'x', t: '', r: () => <span className="text-[11px] text-[#1a365d] dark:text-brand-300 font-bold">كشف الحساب ←</span> },
    ];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="اسم المورد"
                        className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-800 text-sm" />
                </div>
                <ExportButton rows={rows || []} filename="الموردون"
                    columns={[{ key: 'name', label: 'المورد' }, { key: 'invoices', label: 'الفواتير' },
                              { key: 'gross', label: 'الإجمالي' }, { key: 'outstanding', label: 'المستحق' },
                              { key: 'last_date', label: 'آخر تعامل' }]} />
            </div>
            <Table cols={cols} rows={rows?.map(r => ({ ...r, __key: r.name }))} onRow={r => setSup(r.name)} empty="لا موردين" />
        </div>
    );
}

const KIND_COLOR = {
    'فاتورة': 'text-slate-700 dark:text-brand-200',
    'دفعة': 'text-emerald-600 dark:text-emerald-300',
    'استرداد': 'text-amber-600 dark:text-amber-300',
    'مرتجع': 'text-sky-600 dark:text-sky-300',
};

function Statement({ supplier, onBack, onOpen }) {
    const [d, setD] = useState(null);
    const [kind, setKind] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    useEffect(() => {
        let s = `&supplier=${encodeURIComponent(supplier)}`;
        if (from) s += `&from=${from}`;
        if (to) s += `&to=${to}`;
        get('sup_statement', s).then(setD);
    }, [supplier, from, to]);

    const kinds = useMemo(() => Array.from(new Set((d?.rows || []).map(r => r.kind))), [d]);
    const shown = (d?.rows || []).filter(r => !kind || r.kind === kind);

    const cols = [
        { k: 'date', t: 'التاريخ' },
        { k: 'kind', t: 'الحركة', r: r => <span className={`font-bold ${KIND_COLOR[r.kind] || ''}`}>{r.kind}</span> },
        { k: 'ref', t: 'المرجع' },
        { k: 'debit', t: 'عليه', r: r => Number(r.debit) ? money(r.debit) : '—' },
        { k: 'credit', t: 'له', r: r => Number(r.credit) ? money(r.credit) : '—' },
        { k: 'balance', t: 'الرصيد', r: r => <span className="font-black">{money(r.balance)}</span> },
        { k: 'x', t: '', r: r => r.open ? <span className="text-[11px] text-[#1a365d] dark:text-brand-300 font-bold">افتح</span> : '' },
    ];
    return (
        <div className="space-y-4">
            <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500"><ChevronLeft size={14} /> الموردون</button>
            <h3 className="text-lg font-black text-[#1a365d] dark:text-brand-100">كشف حساب — {supplier}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card t="رصيد أول المدة" v={money(d?.opening)} />
                <Card t="عليه" v={money(d?.total_debit)} />
                <Card t="له" v={money(d?.total_credit)} />
                <Card t="الرصيد الختامي" v={money(d?.closing)} warn={Number(d?.closing) > 0.5} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-800 text-xs" />
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-800 text-xs" />
                {['', ...kinds].map(k => (
                    <button key={k || 'all'} onClick={() => setKind(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${kind === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{k || 'الكل'}</button>
                ))}
                <ExportButton rows={shown} filename={`كشف-${supplier}`}
                    columns={[{ key: 'date', label: 'التاريخ' }, { key: 'kind', label: 'الحركة' }, { key: 'ref', label: 'المرجع' },
                              { key: 'debit', label: 'عليه' }, { key: 'credit', label: 'له' }, { key: 'balance', label: 'الرصيد' }]} />
                <button onClick={() => window.print()} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-brand-700">طباعة</button>
            </div>
            <Table cols={cols} rows={shown.map((r, i) => ({ ...r, __key: `${r.kind}-${r.id}-${i}` }))}
                onRow={r => r.open && onOpen(r.open.type, r.open.value)} empty="لا حركات" />
        </div>
    );
}

// ─── إثباتات السداد ─────────────────────────────────────────────────────────
function Proofs() {
    const { openEntity } = useEntity();
    const [d, setD] = useState(null);
    const [only, setOnly] = useState('missing');
    useEffect(() => { get('pay_proofs', only ? `&only=${only}` : '').then(setD); }, [only]);

    const pct = d?.payments ? Math.round((d.amount_with_proof / (d.amount || 1)) * 100) : 0;
    const cols = [
        { k: 'pay_date', t: 'التاريخ' },
        { k: 'invoice_no', t: 'الفاتورة', r: r => r.invoice_no || `#${r.purchase_id}` },
        { k: 'supplier', t: 'المورد', r: r => <span className="font-bold">{r.supplier || '—'}</span> },
        { k: 'amount', t: 'المبلغ', r: r => money(r.amount) },
        { k: 'method', t: 'الطريقة', r: r => r.method || '—' },
        { k: 'source', t: 'المصدر' },
        { k: 'has_proof', t: 'الإثبات', r: r => Number(r.has_proof)
            ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} />موجود</span>
            : Number(r.unchecked)
                ? <span className="text-slate-400">لم يُفحص</span>
                : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={13} />بلا إثبات</span> },
    ];
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card t="الدفعات" v={d?.payments ?? '—'} sub={money(d?.amount)} />
                <Card t="لها إثبات" v={d?.with_proof ?? '—'} sub={`${money(d?.amount_with_proof)} · ${pct}%`} />
                <Card t="بلا إثبات" v={d?.without_proof ?? '—'} sub={money(d?.amount_without_proof)} warn={Number(d?.without_proof) > 0} />
                <Card t="لم تُفحص" v={d?.unchecked ?? '—'} sub={money(d?.amount_unchecked)} />
            </div>
            <div className="flex items-center gap-2">
                {[['missing', 'بلا إثبات'], ['', 'كل الدفعات']].map(([k, t]) => (
                    <button key={k || 'all'} onClick={() => setOnly(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${only === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{t}</button>
                ))}
                <ExportButton rows={d?.rows || []} filename="إثباتات-السداد"
                    columns={[{ key: 'pay_date', label: 'التاريخ' }, { key: 'invoice_no', label: 'الفاتورة' },
                              { key: 'supplier', label: 'المورد' }, { key: 'amount', label: 'المبلغ' },
                              { key: 'source', label: 'المصدر' }, { key: 'has_proof', label: 'له إثبات' }]} />
            </div>
            <Table cols={cols} rows={(d?.rows || []).map(r => ({ ...r, __key: `${r.source}-${r.id}` }))}
                onRow={r => openEntity('purchase', r.purchase_id)} empty="لا دفعات" />
        </div>
    );
}

// ─── فجوات التوثيق ──────────────────────────────────────────────────────────
function Gaps() {
    const { openEntity } = useEntity();
    const [d, setD] = useState(null);
    const [k, setK] = useState('neither');
    useEffect(() => { get('buy_gaps').then(setD); }, []);
    const t = d?.totals || {};
    const cols = [
        { k: 'no', t: 'الرقم', r: r => <span className="font-black">{r.no || '—'}</span> },
        { k: 'date', t: 'التاريخ' },
        { k: 'supplier', t: 'المورد', r: r => <span className="font-bold">{r.supplier}</span> },
        { k: 'gross', t: 'الإجمالي', r: r => money(r.gross) },
        { k: 'project', t: 'المشروع', r: r => r.project || <span className="text-slate-300">بلا</span> },
        { k: 'orig_docs', t: 'فاتورة مورد', r: r => Number(r.orig_docs) ? '✓' : <span className="text-amber-600">ناقصة</span> },
        { k: 'receipts', t: 'إيصال', r: r => Number(r.receipts) ? '✓' : <span className="text-amber-600">ناقص</span> },
    ];
    const rows = d?.[k] || [];
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card t="كل الفواتير" v={t.invoices ?? '—'} />
                <Card t="بلا فاتورة مورد" v={t.no_invoice?.n ?? '—'} sub={money(t.no_invoice?.amount)} warn />
                <Card t="بلا إيصال" v={t.no_receipt?.n ?? '—'} sub={money(t.no_receipt?.amount)} warn />
                <Card t="بلا الاثنين" v={t.neither?.n ?? '—'} sub={money(t.neither?.amount)} warn />
            </div>
            <div className="flex items-center gap-2">
                {[['neither', 'بلا الاثنين'], ['no_invoice', 'بلا فاتورة مورد'], ['no_receipt', 'بلا إيصال']].map(([kk, tt]) => (
                    <button key={kk} onClick={() => setK(kk)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${k === kk ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{tt}</button>
                ))}
                <ExportButton rows={rows} filename={`نواقص-${k}`}
                    columns={[{ key: 'no', label: 'الرقم' }, { key: 'date', label: 'التاريخ' }, { key: 'supplier', label: 'المورد' },
                              { key: 'gross', label: 'الإجمالي' }, { key: 'project', label: 'المشروع' }]} />
            </div>
            <Table cols={cols} rows={rows} onRow={r => openEntity('purchase', r.id)} empty="لا نواقص" />
        </div>
    );
}

// ─── المرتجعات ──────────────────────────────────────────────────────────────
function Refunds() {
    const { openEntity } = useEntity();
    const [d, setD] = useState(null);
    const [f, setF] = useState('');
    useEffect(() => { get('refund_list', `&limit=100${f ? `&${f}=1` : ''}`).then(setD); }, [f]);
    const s = d?.summary || {};
    const cols = [
        { k: 'no', t: 'الرقم', r: r => <span className="font-black">{r.no || '—'}</span> },
        { k: 'date', t: 'التاريخ' },
        { k: 'supplier', t: 'المورد', r: r => <span className="font-bold">{r.supplier}</span> },
        { k: 'gross', t: 'قيمة المرتجع', r: r => money(r.gross) },
        { k: 'settled', t: 'المسترَدّ', r: r => money(r.settled) },
        { k: 'left', t: 'غير مسترَدّ', r: r => {
            const v = Number(r.gross) - Number(r.settled);
            return v > 0.5 ? <span className="font-bold text-amber-600">{money(v)}</span> : <span className="text-emerald-600">—</span>;
        } },
        { k: 'docs', t: 'المستندات', r: r => Number(r.docs) || <span className="text-amber-600">بلا</span> },
    ];
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card t="المرتجعات" v={s.n ?? '—'} />
                <Card t="القيمة" v={money(s.gross)} />
                <Card t="المسترَدّ" v={money(s.settled)} />
                <Card t="غير مسترَدّ" v={money(Number(s.gross || 0) - Number(s.settled || 0))}
                      warn={Number(s.gross || 0) - Number(s.settled || 0) > 0.5} />
            </div>
            <div className="flex items-center gap-2">
                {[['', 'الكل'], ['unsettled', 'غير مسترَدّ'], ['no_docs', 'بلا مستند']].map(([k, t]) => (
                    <button key={k || 'all'} onClick={() => setF(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${f === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{t}</button>
                ))}
                <ExportButton rows={d?.data || []} filename="مرتجعات-الشراء"
                    columns={[{ key: 'no', label: 'الرقم' }, { key: 'date', label: 'التاريخ' }, { key: 'supplier', label: 'المورد' },
                              { key: 'gross', label: 'القيمة' }, { key: 'settled', label: 'المسترَدّ' }]} />
            </div>
            {/* لا بطاقة للمرتجع نفسه؛ الصفّ يفتح ما يُفهم منه: فاتورته الأصل إن رُبطت، وإلا المورّد */}
            <Table cols={cols} rows={d?.data}
                onRow={r => r.purchase_id ? openEntity('purchase', r.purchase_id) : openEntity('supplier', r.supplier)}
                empty="لا مرتجعات" />
        </div>
    );
}

// ─── تذاكر المستندات ────────────────────────────────────────────────────────
const T_KIND = { add: 'إضافة مستند', delete: 'حذف مستند' };
const T_STATE = { pending: 'بانتظار القرار', approved: 'موافَق', rejected: 'مرفوض' };

function Tickets() {
    const { openEntity } = useEntity();
    const [d, setD] = useState(null);
    const [st, setSt] = useState('pending');
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => get('doc_tickets', `&status=${st}`).then(setD), [st]);
    useEffect(() => { load(); }, [load]);

    const decide = async (id, ok) => {
        setBusy(true);
        const r = await fetch(`${API_URL}?action=doc_ticket_decide`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
            body: JSON.stringify({ id, approve: ok }),
        }).then(x => x.json()).catch(() => ({ success: false }));
        setBusy(false);
        if (!r.success) alert(r.message || 'تعذر الحسم');
        load();
    };

    const cols = [
        { k: 'id', t: '#' },
        { k: 'kind', t: 'الطلب', r: r => T_KIND[r.kind] || r.kind },
        { k: 'invoice_no', t: 'الفاتورة', r: r => r.invoice_no || `#${r.purchase_id}` },
        { k: 'supplier', t: 'المورد' },
        { k: 'requested_by', t: 'الطالب', r: r => r.requested_by || '—' },
        { k: 'reason', t: 'السبب', r: r => <span className="max-w-[240px] truncate inline-block align-bottom">{r.reason || '—'}</span> },
        { k: 'status', t: 'الحالة', r: r => T_STATE[r.status] || r.status },
        { k: 'act', t: '', r: r => r.status === 'pending' && d?.is_manager ? (
            <span className="flex gap-1">
                <button disabled={busy} onClick={e => { e.stopPropagation(); decide(r.id, true); }}
                    className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">موافقة</button>
                <button disabled={busy} onClick={e => { e.stopPropagation(); decide(r.id, false); }}
                    className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold">رفض</button>
            </span>
        ) : '' },
    ];
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                {[['pending', 'بانتظار القرار'], ['approved', 'موافَق'], ['rejected', 'مرفوض'], ['all', 'الكل']].map(([k, t]) => (
                    <button key={k} onClick={() => setSt(k)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${st === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'border-slate-200 dark:border-brand-700'}`}>{t}</button>
                ))}
                {d?.pending > 0 && <span className="text-xs font-bold text-amber-600">{d.pending} بانتظارك</span>}
            </div>
            <Table cols={cols} rows={d?.data} onRow={r => openEntity('purchase', r.purchase_id)} empty="لا تذاكر" />
        </div>
    );
}

// ─── الشاشة ─────────────────────────────────────────────────────────────────
export default function PurchaseHub() {
    const [tab, setTab] = useState('invoices');
    return (
        <EntityProvider>
            <div dir="rtl" className="font-cairo p-4 md:p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
                        <ShoppingCart size={20} className="text-gold-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[#1a365d] dark:text-brand-100">مركز المشتريات</h2>
                        <p className="text-[11px] text-slate-400 dark:text-brand-400">
                            نفس بيانات تطبيق المشتريات على الجوال — من قاعدتنا لا من دفترة
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-brand-700 pb-3">
                    {TABS.map(({ k, t, i: I }) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition
                                ${tab === k ? 'bg-[#1a365d] text-white shadow' : 'text-slate-500 dark:text-brand-300 hover:bg-slate-50 dark:hover:bg-brand-800'}`}>
                            <I size={15} /> {t}
                        </button>
                    ))}
                </div>
                {tab === 'invoices'  && <Invoices />}
                {tab === 'suppliers' && <Suppliers />}
                {tab === 'proofs'    && <Proofs />}
                {tab === 'gaps'      && <Gaps />}
                {tab === 'refunds'   && <Refunds />}
                {tab === 'tickets'   && <Tickets />}
            </div>
        </EntityProvider>
    );
}

