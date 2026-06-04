import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BookOpen, FileText, Layers, Plus, Trash2, RefreshCw, Save, X, Search,
    Scale, TrendingUp, Wallet, Users, Edit2, RotateCcw, Eye, Download,
    AlertTriangle, CheckCircle2, PieChart, FileBarChart2, Banknote, ChevronDown,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  محرّك المحاسبة المستقل (Semak Ledger) — قيد مزدوج كامل، صفر دفترة
//  كل البيانات من قاعدتنا عبر إجراءات gl_* في api.php
// ════════════════════════════════════════════════════════════════════════════

const API_URL = "https://semak.sa/api.php";
const TENANT = 1;

const TYPE_LABELS = {
    asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
    revenue: 'إيرادات', expense: 'مصروفات',
};
const TYPE_COLORS = {
    asset: 'bg-blue-100 text-blue-700 border-blue-200',
    liability: 'bg-amber-100 text-amber-700 border-amber-200',
    equity: 'bg-purple-100 text-purple-700 border-purple-200',
    revenue: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expense: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const yearStart = () => new Date().getFullYear() + '-01-01';

async function api(action, { method = 'GET', params = {}, body = null } = {}) {
    const qs = new URLSearchParams({ action, tenant: TENANT, ...params }).toString();
    const opts = { method };
    if (body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify({ action, tenant_id: TENANT, ...body });
    }
    const res = await fetch(`${API_URL}?${qs}`, opts);
    let json;
    try { json = await res.json(); }
    catch { throw new Error(`HTTP ${res.status}: استجابة غير صالحة`); }
    return json;
}

function downloadCSV(filename, headers, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── إشعار (Toast) ───────────────────────────────────────────────────────────
function useToast() {
    const [toast, setToast] = useState(null);
    const show = useCallback((msg, kind = 'success') => {
        setToast({ msg, kind });
        setTimeout(() => setToast(null), 3500);
    }, []);
    const node = toast ? (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm animate-fadeIn ${
            toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
            {toast.kind === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {toast.msg}
        </div>
    ) : null;
    return { show, node };
}

// ─── عناصر واجهة عامة ────────────────────────────────────────────────────────
function Spinner({ label = 'جاري التحميل…' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-[#1a365d]">
            <RefreshCw size={32} className="animate-spin mb-3 opacity-60" />
            <p className="text-sm font-bold text-slate-500">{label}</p>
        </div>
    );
}
function Empty({ msg = 'لا توجد بيانات' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-base font-bold">{msg}</p>
        </div>
    );
}
function Btn({ children, onClick, color = 'navy', size = 'md', type = 'button', disabled }) {
    const colors = {
        navy: 'bg-[#1a365d] hover:bg-[#0f2543] text-white',
        gold: 'bg-[#c5a059] hover:bg-[#b08c45] text-white',
        gray: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
        red: 'bg-red-50 hover:bg-red-600 hover:text-white text-red-600',
        green: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    };
    const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-xl font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]} ${sizes[size]}`}>
            {children}
        </button>
    );
}
function PeriodBar({ from, to, setFrom, setTo, onApply, showFrom = true }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            {showFrom && (
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">من تاريخ</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44" />
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">{showFrom ? 'إلى تاريخ' : 'حتى تاريخ'}</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44" />
            </div>
            <Btn color="gold" onClick={onApply}><Search size={14} /> تطبيق</Btn>
        </div>
    );
}
function Card({ children, className = '' }) {
    return <div className={`bg-white rounded-2xl border border-slate-100 shadow overflow-hidden ${className}`}>{children}</div>;
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 1: دليل الحسابات
// ════════════════════════════════════════════════════════════════════════════
function ChartTab({ accounts, reload, loading, toast }) {
    const [editing, setEditing] = useState(null); // {id?,code,name,type,parent_id,is_group}
    const [search, setSearch] = useState('');

    const blank = { code: '', name: '', type: 'asset', parent_id: '', is_group: 0 };
    const groups = useMemo(() => accounts.filter(a => Number(a.is_group) === 1), [accounts]);

    const save = async () => {
        if (!editing.code || !editing.name) { toast('الكود والاسم مطلوبان', 'error'); return; }
        try {
            const r = await api('gl_account_save', { method: 'POST', body: {
                id: editing.id || 0, code: editing.code.trim(), name: editing.name.trim(),
                type: editing.type, parent_id: editing.parent_id || '', is_group: editing.is_group ? 1 : 0,
            }});
            if (r.success) { toast(editing.id ? 'تم تحديث الحساب' : 'تمت إضافة الحساب'); setEditing(null); reload(); }
            else toast(r.message || 'فشل الحفظ', 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const filtered = accounts.filter(a =>
        !search || a.code.includes(search) || a.name.includes(search));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالكود أو الاسم…"
                        className="w-full bg-slate-50 border border-slate-200 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{accounts.length} حساب</span>
                    <Btn color="gray" size="sm" onClick={reload}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> حساب جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : filtered.length === 0 ? <Empty msg="لا توجد حسابات" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-[#1a365d] text-white text-xs">
                                <tr>
                                    <th className="px-3 py-3 font-bold">الكود</th>
                                    <th className="px-3 py-3 font-bold">اسم الحساب</th>
                                    <th className="px-3 py-3 font-bold">النوع</th>
                                    <th className="px-3 py-3 font-bold text-left">الرصيد</th>
                                    <th className="px-3 py-3 font-bold text-center w-16">تعديل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(a => {
                                    const depth = Math.max(0, a.code.length - 1);
                                    const isGroup = Number(a.is_group) === 1;
                                    return (
                                        <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                            <td className="px-3 py-2.5 font-mono font-bold text-[#1a365d]">{a.code}</td>
                                            <td className="px-3 py-2.5" style={{ paddingRight: `${0.75 + depth * 0.6}rem` }}>
                                                <span className={isGroup ? 'font-black text-[#1a365d]' : 'text-slate-700'}>{a.name}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">
                                                {isGroup ? '—' : money(a.balance)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button onClick={() => setEditing({ id: a.id, code: a.code, name: a.name, type: a.type, parent_id: a.parent_id || '', is_group: Number(a.is_group) })}
                                                    className="text-slate-400 hover:text-[#c5a059] transition"><Edit2 size={15} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* نموذج الإضافة/التعديل */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-[#1a365d]">{editing.id ? 'تعديل حساب' : 'حساب جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">الكود</label>
                                    <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">اسم الحساب</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الحساب الأب (اختياري)</label>
                                <select value={editing.parent_id} onChange={e => setEditing({ ...editing, parent_id: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    <option value="">— بدون —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!editing.is_group} onChange={e => setEditing({ ...editing, is_group: e.target.checked ? 1 : 0 })} />
                                حساب تجميعي (مجموعة لا تُرحّل عليها قيود)
                            </label>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 2: القيود اليومية + نموذج قيد
// ════════════════════════════════════════════════════════════════════════════
const emptyLine = () => ({ account_id: '', debit: '', credit: '', party_type: '', party_id: '', due_date: '', cost_center_id: '', description: '' });

function JournalTab({ accounts, parties, costCenters, toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(null);  // null = list view
    const [viewing, setViewing] = useState(null);
    const postable = useMemo(() => accounts.filter(a => Number(a.is_group) === 0), [accounts]);

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_entries'); setEntries(r.data || []); }
        catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const newEntry = () => setForm({ id: 0, date: todayISO(), description: '', lines: [emptyLine(), emptyLine()] });

    const editEntry = async (id) => {
        try {
            const r = await api('gl_entry_single', { params: { id } });
            if (!r.success) { toast(r.message || 'تعذّر الجلب', 'error'); return; }
            if (r.entry.ref_type && !['', 'manual', 'proof'].includes(r.entry.ref_type)) {
                toast('قيد مرتبط بمستند — يُعكس ولا يُعدّل', 'error'); return;
            }
            setForm({
                id: Number(r.entry.id), date: r.entry.date, description: r.entry.description || '',
                lines: r.lines.map(l => ({
                    account_id: l.account_id, debit: Number(l.debit) || '', credit: Number(l.credit) || '',
                    party_type: l.party_type || '', party_id: l.party_id || '', due_date: l.due_date || '',
                    cost_center_id: l.cost_center_id || '', description: l.description || '',
                })),
            });
        } catch (e) { toast(e.message, 'error'); }
    };

    const totals = form ? form.lines.reduce((a, l) => ({
        d: a.d + (parseFloat(l.debit) || 0), c: a.c + (parseFloat(l.credit) || 0),
    }), { d: 0, c: 0 }) : { d: 0, c: 0 };
    const balanced = Math.abs(totals.d - totals.c) < 0.005 && totals.d > 0;

    const submit = async () => {
        if (!balanced) { toast('القيد غير متوازن', 'error'); return; }
        const lines = form.lines
            .filter(l => l.account_id && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0))
            .map(l => ({
                account_id: Number(l.account_id), debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
                party_type: l.party_type || undefined, party_id: l.party_id || undefined,
                due_date: l.due_date || undefined, cost_center_id: l.cost_center_id || undefined,
                description: l.description || undefined,
            }));
        if (lines.length < 2) { toast('القيد يحتاج بندين على الأقل', 'error'); return; }
        try {
            const r = await api(form.id ? 'gl_entry_update' : 'gl_entry_create', { method: 'POST', body: {
                id: form.id, date: form.date, description: form.description, ref_type: 'manual', lines,
            }});
            if (r.success) { toast(`${r.message} (${r.entry_no})`); setForm(null); load(); }
            else toast(r.message || 'فشل الترحيل', 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const reverse = async (id) => {
        if (!window.confirm('إنشاء قيد عكسي لهذا القيد؟')) return;
        try {
            const r = await api('gl_entry_reverse', { method: 'POST', body: { id, date: todayISO() } });
            if (r.success) { toast(`تم العكس (${r.entry_no})`); load(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const del = async (id) => {
        if (!window.confirm('حذف هذا القيد نهائياً؟')) return;
        try {
            const r = await api('gl_entry_delete', { method: 'POST', body: { id } });
            if (r.success) { toast('تم الحذف'); load(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const viewEntry = async (id) => {
        try { const r = await api('gl_entry_single', { params: { id } }); if (r.success) setViewing(r); }
        catch (e) { toast(e.message, 'error'); }
    };

    // ── نموذج القيد ──
    if (form) {
        const setLine = (i, patch) => setForm({ ...form, lines: form.lines.map((l, j) => j === i ? { ...l, ...patch } : l) });
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-black text-[#1a365d]">{form.id ? 'تعديل قيد' : 'قيد يومية جديد'}</h3>
                    <Btn color="gray" onClick={() => setForm(null)}><X size={15} /> رجوع للقائمة</Btn>
                </div>
                <Card className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">التاريخ</label>
                            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 block mb-1">البيان</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="وصف القيد…"
                                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm border-collapse">
                            <thead className="bg-slate-100 text-slate-600 text-xs">
                                <tr>
                                    <th className="px-2 py-2 font-bold min-w-[180px]">الحساب</th>
                                    <th className="px-2 py-2 font-bold w-28">مدين</th>
                                    <th className="px-2 py-2 font-bold w-28">دائن</th>
                                    <th className="px-2 py-2 font-bold min-w-[150px]">الطرف / الاستحقاق</th>
                                    <th className="px-2 py-2 font-bold min-w-[120px]">بيان البند</th>
                                    <th className="px-2 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.lines.map((l, i) => (
                                    <tr key={i} className="border-b border-slate-100">
                                        <td className="px-2 py-1.5">
                                            <select value={l.account_id} onChange={e => setLine(i, { account_id: e.target.value })}
                                                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059]">
                                                <option value="">— اختر حساب —</option>
                                                {postable.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.debit} onChange={e => setLine(i, { debit: e.target.value, credit: '' })}
                                                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-emerald-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.credit} onChange={e => setLine(i, { credit: e.target.value, debit: '' })}
                                                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-rose-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5 space-y-1">
                                            <select value={l.party_id ? `${l.party_type}:${l.party_id}` : ''} onChange={e => {
                                                if (!e.target.value) { setLine(i, { party_type: '', party_id: '' }); return; }
                                                const [pt, pid] = e.target.value.split(':'); setLine(i, { party_type: pt, party_id: pid });
                                            }}
                                                className="w-full bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]">
                                                <option value="">— بدون طرف —</option>
                                                {parties.map(p => <option key={p.id} value={`${p.type}:${p.id}`}>{p.type === 'customer' ? 'عميل' : 'مورد'}: {p.name}</option>)}
                                            </select>
                                            <input type="date" title="تاريخ الاستحقاق" value={l.due_date} onChange={e => setLine(i, { due_date: e.target.value })}
                                                className="w-full bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={l.description} onChange={e => setLine(i, { description: e.target.value })}
                                                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059]" />
                                            {costCenters.length > 0 && (
                                                <select value={l.cost_center_id} onChange={e => setLine(i, { cost_center_id: e.target.value })}
                                                    className="w-full mt-1 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]">
                                                    <option value="">— مركز تكلفة —</option>
                                                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {form.lines.length > 2 && (
                                                <button onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}
                                                    className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-black text-[#1a365d]">
                                    <td className="px-2 py-2 text-left">الإجمالي</td>
                                    <td className="px-2 py-2 tabular-nums" dir="ltr">{money(totals.d)}</td>
                                    <td className="px-2 py-2 tabular-nums" dir="ltr">{money(totals.c)}</td>
                                    <td className="px-2 py-2" colSpan={3}>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {balanced ? '✓ متوازن' : `فرق ${money(Math.abs(totals.d - totals.c))}`}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn color="gray" size="sm" onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}><Plus size={14} /> إضافة بند</Btn>
                        <div className="flex-1" />
                        <Btn color="green" onClick={submit} disabled={!balanced}><Save size={15} /> {form.id ? 'حفظ التعديل' : 'ترحيل القيد'}</Btn>
                    </div>
                </Card>
            </div>
        );
    }

    // ── قائمة القيود ──
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="text-sm text-slate-500">{entries.length} قيد</span>
                <div className="flex items-center gap-2">
                    <Btn color="gray" size="sm" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={newEntry}><Plus size={15} /> قيد جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : entries.length === 0 ? <Empty msg="لا توجد قيود بعد" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-[#1a365d] text-white text-xs">
                                <tr>
                                    <th className="px-3 py-3 font-bold">رقم القيد</th>
                                    <th className="px-3 py-3 font-bold">التاريخ</th>
                                    <th className="px-3 py-3 font-bold">البيان</th>
                                    <th className="px-3 py-3 font-bold">المرجع</th>
                                    <th className="px-3 py-3 font-bold text-left">المبلغ</th>
                                    <th className="px-3 py-3 font-bold text-center w-32">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(e => {
                                    const locked = e.ref_type && !['', 'manual', 'proof'].includes(e.ref_type);
                                    return (
                                        <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                            <td className="px-3 py-2.5 font-mono font-bold text-[#1a365d]">{e.entry_no}</td>
                                            <td className="px-3 py-2.5 text-slate-600">{e.date}</td>
                                            <td className="px-3 py-2.5 text-slate-700 max-w-xs truncate" title={e.description}>{e.description || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                {e.ref_type ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{e.ref_type}</span> : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">{money(e.total_debit)}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => viewEntry(e.id)} title="عرض" className="text-slate-400 hover:text-[#1a365d]"><Eye size={15} /></button>
                                                    {!locked && <button onClick={() => editEntry(e.id)} title="تعديل" className="text-slate-400 hover:text-[#c5a059]"><Edit2 size={15} /></button>}
                                                    <button onClick={() => reverse(e.id)} title="عكس" className="text-slate-400 hover:text-amber-600"><RotateCcw size={15} /></button>
                                                    {!locked && <button onClick={() => del(e.id)} title="حذف" className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {viewing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-[#1a365d]">{viewing.entry.entry_no}</h3>
                                <p className="text-xs text-slate-500">{viewing.entry.date} · {viewing.entry.description}</p>
                            </div>
                            <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-100 text-slate-600 text-xs">
                                <tr><th className="px-3 py-2 font-bold">الحساب</th><th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th></tr>
                            </thead>
                            <tbody>
                                {viewing.lines.map(l => (
                                    <tr key={l.id} className="border-b border-slate-100">
                                        <td className="px-3 py-2"><span className="font-mono text-xs text-slate-400">{l.account_code}</span> {l.account_name}
                                            {l.description ? <span className="block text-xs text-slate-400">{l.description}</span> : null}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.debit) ? money(l.debit) : ''}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.credit) ? money(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-black text-[#1a365d] bg-slate-50">
                                    <td className="px-3 py-2 text-left">الإجمالي</td>
                                    <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(viewing.entry.total_debit)}</td>
                                    <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(viewing.entry.total_credit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 3: ميزان المراجعة
// ════════════════════════════════════════════════════════════════════════════
function TrialBalanceTab({ toast }) {
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async (t) => {
        setLoading(true);
        try { const r = await api('gl_trial_balance', { params: t ? { to: t } : {} }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(to); }, []); // eslint-disable-line

    const rows = data?.data || [];
    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar to={to} setTo={setTo} onApply={() => load(to)} showFrom={false} />
                {rows.length > 0 && <Btn color="gray" size="sm" onClick={() => downloadCSV('trial_balance.csv',
                    ['الكود', 'الحساب', 'مدين', 'دائن'], rows.map(r => [r.code, r.name, r.debit_balance, r.credit_balance]))}>
                    <Download size={14} /> تصدير</Btn>}
            </div>
            {loading ? <Spinner /> : rows.length === 0 ? <Empty msg="لا توجد حركات" /> : (
                <Card>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-[#1a365d] text-white text-xs">
                            <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الحساب</th>
                                <th className="px-3 py-3 font-bold text-left">مدين</th><th className="px-3 py-3 font-bold text-left">دائن</th></tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                    <td className="px-3 py-2.5 font-mono text-slate-400">{r.code}</td>
                                    <td className="px-3 py-2.5 text-slate-700">{r.name}</td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.debit_balance) ? money(r.debit_balance) : ''}</td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.credit_balance) ? money(r.credit_balance) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 font-black text-[#1a365d]">
                                <td className="px-3 py-3" colSpan={2}>الإجمالي
                                    {data?.totals && <span className={`mr-2 text-xs px-2 py-0.5 rounded-full ${data.totals.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {data.totals.balanced ? '✓ متوازن' : '✗ غير متوازن'}</span>}</td>
                                <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data?.totals?.debit)}</td>
                                <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data?.totals?.credit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 4: قائمة الدخل
// ════════════════════════════════════════════════════════════════════════════
function IncomeTab({ toast }) {
    const [from, setFrom] = useState(yearStart());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_income_statement', { params: { from, to } }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [from, to, toast]);
    useEffect(() => { load(); }, []); // eslint-disable-line

    const section = (title, items, color) => (
        <div>
            <h4 className={`text-sm font-black mb-2 ${color}`}>{title}</h4>
            <div className="space-y-1">
                {items.map(r => (
                    <div key={r.id} className="flex justify-between text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600"><span className="font-mono text-xs text-slate-400">{r.code}</span> {r.name}</span>
                        <span className="tabular-nums font-bold" dir="ltr">{money(r.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <Card className="p-5 md:p-6 space-y-5">
                    {section('الإيرادات', data.revenue || [], 'text-emerald-700')}
                    {section('المصروفات', data.expenses || [], 'text-rose-700')}
                    <div className="border-t-2 border-slate-100 pt-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">إجمالي الإيرادات</span><span className="tabular-nums font-bold text-emerald-700" dir="ltr">{money(data.totals.revenue)}</span></div>
                        <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">إجمالي المصروفات</span><span className="tabular-nums font-bold text-rose-700" dir="ltr">{money(data.totals.expenses)}</span></div>
                        <div className="flex justify-between text-lg pt-2 border-t border-slate-100">
                            <span className="font-black text-[#1a365d]">صافي الدخل</span>
                            <span className={`tabular-nums font-black ${data.totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">{money(data.totals.net)} ﷼</span>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 5: الميزانية العمومية
// ════════════════════════════════════════════════════════════════════════════
function BalanceSheetTab({ toast }) {
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async (t) => {
        setLoading(true);
        try { const r = await api('gl_balance_sheet', { params: { to: t } }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(to); }, []); // eslint-disable-line

    const col = (title, items, total, color, extra) => (
        <Card className="p-5">
            <h4 className={`text-base font-black mb-3 ${color}`}>{title}</h4>
            <div className="space-y-1">
                {items.map(r => (
                    <div key={r.id} className="flex justify-between text-sm py-1 border-b border-slate-50">
                        <span className="text-slate-600"><span className="font-mono text-xs text-slate-400">{r.code}</span> {r.name}</span>
                        <span className="tabular-nums font-bold" dir="ltr">{money(r.amount)}</span>
                    </div>
                ))}
                {extra}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t-2 border-slate-100 font-black text-[#1a365d]">
                <span>الإجمالي</span><span className="tabular-nums" dir="ltr">{money(total)} ﷼</span>
            </div>
        </Card>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar to={to} setTo={setTo} onApply={() => load(to)} showFrom={false} />
                {data && <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.totals.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {data.totals.balanced ? '✓ الميزانية متوازنة' : '✗ غير متوازنة'}</span>}
            </div>
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {col('الأصول', data.assets, data.totals.assets, 'text-blue-700')}
                    <div className="space-y-4">
                        {col('الخصوم', data.liabilities, data.totals.liabilities, 'text-amber-700')}
                        {col('حقوق الملكية', data.equity, data.totals.equity, 'text-purple-700',
                            <div className="flex justify-between text-sm py-1 border-b border-slate-50 text-slate-500 italic">
                                <span>صافي دخل الفترة</span><span className="tabular-nums" dir="ltr">{money(data.net_income)}</span>
                            </div>)}
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 6: كشف حساب (دفتر الأستاذ)
// ════════════════════════════════════════════════════════════════════════════
function LedgerTab({ accounts, toast }) {
    const postable = useMemo(() => accounts.filter(a => Number(a.is_group) === 0), [accounts]);
    const [acc, setAcc] = useState('');
    const [from, setFrom] = useState(yearStart());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        if (!acc) { toast('اختر حساباً', 'error'); return; }
        setLoading(true);
        try { const r = await api('gl_ledger', { params: { account_id: acc, from, to } }); setData(r.success ? r : null); if (!r.success) toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [acc, from, to, toast]);

    return (
        <div className="space-y-4">
            <Card className="p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                    <label className="text-xs font-bold text-slate-500 block mb-1">الحساب</label>
                    <select value={acc} onChange={e => setAcc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                        <option value="">— اختر حساب —</option>
                        {postable.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">من</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">إلى</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <Btn color="gold" onClick={load}><Search size={14} /> عرض</Btn>
            </Card>

            {loading ? <Spinner /> : !data ? <Empty msg="اختر حساباً واضغط عرض" /> : (
                <Card>
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="font-black text-[#1a365d]">{data.account.code} · {data.account.name}</span>
                        <span className="text-sm text-slate-500">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(data.opening)}</span></span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-[#1a365d] text-white text-xs">
                                <tr><th className="px-3 py-3 font-bold">القيد</th><th className="px-3 py-3 font-bold">التاريخ</th>
                                    <th className="px-3 py-3 font-bold">البيان</th><th className="px-3 py-3 font-bold text-left">مدين</th>
                                    <th className="px-3 py-3 font-bold text-left">دائن</th><th className="px-3 py-3 font-bold text-left">الرصيد</th></tr>
                            </thead>
                            <tbody>
                                {data.data.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/70">
                                        <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.entry_no}</td>
                                        <td className="px-3 py-2.5 text-slate-600">{r.date}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{r.line_desc || r.ent_desc || '—'}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-black text-[#1a365d]">
                                    <td className="px-3 py-3" colSpan={3}>الإجمالي</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.debit)}</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.credit)}</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.closing)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 7: إقرار ضريبة القيمة المضافة
// ════════════════════════════════════════════════════════════════════════════
function VatTab({ toast }) {
    const [from, setFrom] = useState(yearStart());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_vat_report', { params: { from, to } }); setData(r.success ? r : null); if (!r.success) toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [from, to, toast]);
    useEffect(() => { load(); }, []); // eslint-disable-line

    return (
        <div className="space-y-4">
            <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-5 text-center">
                        <p className="text-sm font-bold text-slate-500 mb-2">ضريبة المخرجات (المبيعات)</p>
                        <p className="text-2xl font-black text-emerald-700 tabular-nums" dir="ltr">{money(data.output_vat)}</p>
                    </Card>
                    <Card className="p-5 text-center">
                        <p className="text-sm font-bold text-slate-500 mb-2">ضريبة المدخلات (المشتريات)</p>
                        <p className="text-2xl font-black text-blue-700 tabular-nums" dir="ltr">{money(data.input_vat)}</p>
                    </Card>
                    <Card className="p-5 text-center bg-[#1a365d] text-white">
                        <p className="text-sm font-bold text-white/70 mb-2">صافي الضريبة المستحقة</p>
                        <p className="text-2xl font-black tabular-nums" dir="ltr">{money(data.net_payable)} ﷼</p>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 8: الأطراف (عملاء/موردون) + كشف حساب + أعمار الذمم
// ════════════════════════════════════════════════════════════════════════════
function PartiesTab({ parties, reload, loading, toast }) {
    const [tab, setTab] = useState('list'); // list | aging
    const [type, setType] = useState('customer');
    const [editing, setEditing] = useState(null);
    const [ledger, setLedger] = useState(null);
    const [aging, setAging] = useState(null);
    const [agingLoading, setAgingLoading] = useState(false);

    const blank = { type: 'customer', name: '', vat_number: '', cr_number: '', phone: '', email: '', address: '' };
    const filtered = parties.filter(p => p.type === type);

    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب', 'error'); return; }
        try {
            const r = await api('gl_party_save', { method: 'POST', body: { ...editing, id: editing.id || 0 } });
            if (r.success) { toast('تم الحفظ'); setEditing(null); reload(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const del = async (id) => {
        if (!window.confirm('حذف هذا الطرف؟')) return;
        try { const r = await api('gl_party_delete', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); reload(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };
    const openLedger = async (p) => {
        try { const r = await api('gl_party_ledger', { params: { party_id: p.id } }); if (r.success) setLedger(r); else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };
    const loadAging = async () => {
        setAgingLoading(true);
        try { const r = await api('gl_aging', { params: { party_type: type, as_of: todayISO() } }); setAging(r); }
        catch (e) { toast(e.message, 'error'); } finally { setAgingLoading(false); }
    };
    useEffect(() => { if (tab === 'aging') loadAging(); }, [tab, type]); // eslint-disable-line

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                    <button onClick={() => setType('customer')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'customer' ? 'bg-[#1a365d] text-white' : 'bg-slate-100 text-slate-600'}`}>العملاء</button>
                    <button onClick={() => setType('supplier')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'supplier' ? 'bg-[#1a365d] text-white' : 'bg-slate-100 text-slate-600'}`}>الموردون</button>
                    <div className="w-px bg-slate-200 mx-1" />
                    <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'list' ? 'bg-amber-50 text-[#c5a059] border border-[#c5a059]' : 'bg-slate-100 text-slate-600'}`}>القائمة</button>
                    <button onClick={() => setTab('aging')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'aging' ? 'bg-amber-50 text-[#c5a059] border border-[#c5a059]' : 'bg-slate-100 text-slate-600'}`}>أعمار الذمم</button>
                </div>
                {tab === 'list' && <Btn color="green" onClick={() => setEditing({ ...blank, type })}><Plus size={15} /> طرف جديد</Btn>}
            </div>

            {tab === 'list' ? (
                loading ? <Spinner /> : filtered.length === 0 ? <Empty msg={type === 'customer' ? 'لا يوجد عملاء' : 'لا يوجد موردون'} /> : (
                    <Card>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-[#1a365d] text-white text-xs">
                                <tr><th className="px-3 py-3 font-bold">الاسم</th><th className="px-3 py-3 font-bold">الرقم الضريبي</th>
                                    <th className="px-3 py-3 font-bold">الجوال</th><th className="px-3 py-3 font-bold text-center w-32">إجراءات</th></tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                        <td className="px-3 py-2.5 font-bold text-slate-700">{p.name}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{p.vat_number || '—'}</td>
                                        <td className="px-3 py-2.5 text-slate-600" dir="ltr">{p.phone || '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => openLedger(p)} title="كشف حساب" className="text-slate-400 hover:text-[#1a365d]"><FileText size={15} /></button>
                                                <button onClick={() => setEditing({ id: p.id, type: p.type, name: p.name, vat_number: p.vat_number || '', cr_number: p.cr_number || '', phone: p.phone || '', email: p.email || '', address: p.address || '' })} title="تعديل" className="text-slate-400 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                                <button onClick={() => del(p.id)} title="حذف" className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )
            ) : (
                agingLoading ? <Spinner /> : !aging || aging.data.length === 0 ? <Empty msg="لا توجد أرصدة" /> : (
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-[#1a365d] text-white text-xs">
                                    <tr><th className="px-3 py-3 font-bold">الطرف</th><th className="px-3 py-3 font-bold text-left">جارٍ</th>
                                        <th className="px-3 py-3 font-bold text-left">1-30</th><th className="px-3 py-3 font-bold text-left">31-60</th>
                                        <th className="px-3 py-3 font-bold text-left">61-90</th><th className="px-3 py-3 font-bold text-left">+90</th>
                                        <th className="px-3 py-3 font-bold text-left">الإجمالي</th></tr>
                                </thead>
                                <tbody>
                                    {aging.data.map(r => (
                                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                            <td className="px-3 py-2.5 font-bold text-slate-700">{r.name}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.current)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d30)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d60)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-amber-700" dir="ltr">{money(r.d90)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-rose-700 font-bold" dir="ltr">{money(r.d90p)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums font-black text-[#1a365d]" dir="ltr">{money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-black text-[#1a365d]">
                                        <td className="px-3 py-3">الإجمالي</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.current)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d30)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d60)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d90)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d90p)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.total)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                )
            )}

            {/* نموذج طرف */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-[#1a365d]">{editing.id ? 'تعديل طرف' : 'طرف جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        <option value="customer">عميل</option><option value="supplier">مورد</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">الجوال</label>
                                    <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">الرقم الضريبي</label>
                                    <input value={editing.vat_number} onChange={e => setEditing({ ...editing, vat_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">السجل التجاري</label>
                                    <input value={editing.cr_number} onChange={e => setEditing({ ...editing, cr_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">البريد الإلكتروني</label>
                                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} dir="ltr"
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* كشف حساب طرف */}
            {ledger && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setLedger(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-[#1a365d]">كشف حساب: {ledger.party.name}</h3>
                                <p className="text-xs text-slate-500">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(ledger.opening)}</span></p>
                            </div>
                            <button onClick={() => setLedger(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        {ledger.data.length === 0 ? <Empty msg="لا توجد حركات" /> : (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-100 text-slate-600 text-xs">
                                    <tr><th className="px-3 py-2 font-bold">القيد</th><th className="px-3 py-2 font-bold">التاريخ</th>
                                        <th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th>
                                        <th className="px-3 py-2 font-bold text-left">الرصيد</th></tr>
                                </thead>
                                <tbody>
                                    {ledger.data.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                            <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.entry_no}</td>
                                            <td className="px-3 py-2 text-slate-600">{r.date}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-black text-[#1a365d]">
                                        <td className="px-3 py-2" colSpan={4}>الرصيد الختامي</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(ledger.totals.closing)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 9: مراكز التكلفة
// ════════════════════════════════════════════════════════════════════════════
function CostCentersTab({ costCenters, reload, loading, toast }) {
    const [editing, setEditing] = useState(null);
    const blank = { code: '', name: '', parent_id: '' };
    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب', 'error'); return; }
        try {
            const r = await api('gl_cost_center_save', { method: 'POST', body: { ...editing, id: editing.id || 0 } });
            if (r.success) { toast('تم الحفظ'); setEditing(null); reload(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{costCenters.length} مركز</span>
                <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> مركز جديد</Btn>
            </div>
            {loading ? <Spinner /> : costCenters.length === 0 ? <Empty msg="لا توجد مراكز تكلفة" /> : (
                <Card>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-[#1a365d] text-white text-xs">
                            <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الاسم</th><th className="px-3 py-3 font-bold text-center w-16">تعديل</th></tr>
                        </thead>
                        <tbody>
                            {costCenters.map(c => (
                                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                    <td className="px-3 py-2.5 font-mono text-slate-500">{c.code || '—'}</td>
                                    <td className="px-3 py-2.5 font-bold text-slate-700">{c.name}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <button onClick={() => setEditing({ id: c.id, code: c.code || '', name: c.name, parent_id: c.parent_id || '' })} className="text-slate-400 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-[#1a365d]">{editing.id ? 'تعديل مركز' : 'مركز تكلفة جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الكود (اختياري)</label>
                                <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'chart', label: 'دليل الحسابات', icon: BookOpen },
    { id: 'journal', label: 'القيود اليومية', icon: FileText },
    { id: 'trial', label: 'ميزان المراجعة', icon: Scale },
    { id: 'income', label: 'قائمة الدخل', icon: TrendingUp },
    { id: 'balance', label: 'الميزانية العمومية', icon: PieChart },
    { id: 'ledger', label: 'كشف حساب', icon: FileBarChart2 },
    { id: 'vat', label: 'إقرار الضريبة', icon: Banknote },
    { id: 'parties', label: 'العملاء والموردون', icon: Users },
    { id: 'costcenters', label: 'مراكز التكلفة', icon: Layers },
];

export default function LedgerHub() {
    const { show: toast, node: toastNode } = useToast();
    const [activeTab, setActiveTab] = useState('chart');

    // بيانات مشتركة
    const [accounts, setAccounts] = useState([]);
    const [accLoading, setAccLoading] = useState(false);
    const [parties, setParties] = useState([]);
    const [partyLoading, setPartyLoading] = useState(false);
    const [costCenters, setCostCenters] = useState([]);
    const [ccLoading, setCcLoading] = useState(false);
    const [seeded, setSeeded] = useState(false);

    const loadAccounts = useCallback(async () => {
        setAccLoading(true);
        try { const r = await api('gl_accounts'); setAccounts(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setAccLoading(false); }
    }, [toast]);
    const loadParties = useCallback(async () => {
        setPartyLoading(true);
        try { const r = await api('gl_parties'); setParties(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setPartyLoading(false); }
    }, [toast]);
    const loadCostCenters = useCallback(async () => {
        setCcLoading(true);
        try { const r = await api('gl_cost_centers'); setCostCenters(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setCcLoading(false); }
    }, [toast]);

    useEffect(() => { loadAccounts(); loadParties(); loadCostCenters(); }, [loadAccounts, loadParties, loadCostCenters]);

    // زرع دليل الحسابات إن كان فارغاً
    const seed = async () => {
        try { const r = await api('gl_seed'); if (r.success) { toast(r.message || 'تم'); loadAccounts(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
        setSeeded(true);
    };

    return (
        <div dir="rtl" className="space-y-6 p-4 md:p-6 font-cairo">
            {toastNode}

            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                        <BookOpen size={32} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-black">الدفترة المستقلة</h1>
                        <p className="text-sm text-slate-300 mt-1">محرّك محاسبة بقيد مزدوج كامل — كل البيانات في قاعدتنا · صفر اعتماد على دفترة</p>
                    </div>
                    {accounts.length === 0 && !accLoading && (
                        <Btn color="gold" onClick={seed}><Plus size={15} /> إنشاء دليل الحسابات</Btn>
                    )}
                </div>
            </div>

            {/* شريط التبويبات */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 scrollbar-hide">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const active = activeTab === t.id;
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center gap-2 px-4 md:px-5 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                                    active ? 'border-[#c5a059] text-[#1a365d] bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-[#1a365d] hover:bg-slate-50'
                                }`}>
                                <Icon size={16} className={active ? 'text-[#c5a059]' : ''} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 md:p-6">
                    {activeTab === 'chart' && <ChartTab accounts={accounts} reload={loadAccounts} loading={accLoading} toast={toast} />}
                    {activeTab === 'journal' && <JournalTab accounts={accounts} parties={parties} costCenters={costCenters} toast={toast} />}
                    {activeTab === 'trial' && <TrialBalanceTab toast={toast} />}
                    {activeTab === 'income' && <IncomeTab toast={toast} />}
                    {activeTab === 'balance' && <BalanceSheetTab toast={toast} />}
                    {activeTab === 'ledger' && <LedgerTab accounts={accounts} toast={toast} />}
                    {activeTab === 'vat' && <VatTab toast={toast} />}
                    {activeTab === 'parties' && <PartiesTab parties={parties} reload={loadParties} loading={partyLoading} toast={toast} />}
                    {activeTab === 'costcenters' && <CostCentersTab costCenters={costCenters} reload={loadCostCenters} loading={ccLoading} toast={toast} />}
                </div>
            </div>
        </div>
    );
}
