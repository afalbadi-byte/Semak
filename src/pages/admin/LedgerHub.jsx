import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import {
    BookOpen, FileText, Layers, Plus, Trash2, RefreshCw, Save, X, Search,
    Scale, TrendingUp, Wallet, Users, Edit2, RotateCcw, Eye, Download, Copy,
    AlertTriangle, CheckCircle2, PieChart, FileBarChart2, Banknote, ChevronDown,
    Settings, Printer, Building2,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  محرّك المحاسبة المستقل (Semak Ledger) — قيد مزدوج كامل، صفر دفترة
//  كل البيانات من قاعدتنا عبر إجراءات gl_* في api.php
// ════════════════════════════════════════════════════════════════════════════

import { API_URL } from '../../lib/api/client';
import EntityLink from '../../components/ui/EntityLink';
import { useToast, formatMoney } from '../../components/ui';
const TENANT = 1;

const TYPE_LABELS = {
    asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
    revenue: 'إيرادات', expense: 'مصروفات',
};
const TYPE_COLORS = {
    asset: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    liability: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    equity: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
    revenue: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    expense: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
};

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────
const money = formatMoney; // مشترك من Money.jsx — تنسيق موحّد
const todayISO   = () => new Date().toISOString().slice(0, 10);
const yearStart  = () => new Date().getFullYear() + '-01-01';
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const prevMonth  = () => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0');
    const last = new Date(y, d.getMonth()+1, 0).getDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
};

// فتح نافذة طباعة نظيفة بمحتوى HTML
const printHtml = (title, bodyHtml) => {
    const w = window.open('', '_blank', 'width=840,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<style>*{box-sizing:border-box}body{font-family:'Cairo','Segoe UI',Arial,sans-serif;color:#1a365d;margin:0;padding:28px;font-size:13px}
h1{font-size:18px;font-weight:800;margin:0 0 4px}h2{font-size:13px;font-weight:600;color:#64748b;margin:0 0 20px}
table{width:100%;border-collapse:collapse}th,td{padding:7px 10px}
thead th{background:#1a365d;color:#fff;font-weight:700;text-align:right}
tr:nth-child(even){background:#f8fafc}
.section-header td{background:#f1f5f9;font-weight:700;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.5px}
.total-row td{border-top:2px solid #c5a059;font-weight:800;font-size:14px}
.net-row td{background:#1a365d;color:#fff;font-weight:900;font-size:15px}
.amount{text-align:left;font-family:monospace;dir:ltr}
@media print{@page{size:A4;margin:15mm}}</style>
</head><body>${bodyHtml}<script>setTimeout(()=>{try{print();}catch(e){}},250)</script></body></html>`);
    w.document.close();
};

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


// ─── عناصر واجهة عامة ────────────────────────────────────────────────────────
function Spinner({ label = 'جاري التحميل…' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-brand-800 dark:text-brand-300">
            <RefreshCw size={32} className="animate-spin mb-3 opacity-60" />
            <p className="text-sm font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400">{label}</p>
        </div>
    );
}
function Empty({ msg = 'لا توجد بيانات' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-brand-500 dark:text-brand-400">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-base font-bold">{msg}</p>
        </div>
    );
}
function Btn({ children, onClick, color = 'navy', size = 'md', type = 'button', disabled }) {
    const colors = {
        navy: 'bg-brand-800 hover:bg-brand-900 text-white',
        gold: 'bg-gold-500 hover:bg-[#b08c45] text-white',
        gray: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-brand-300 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-100',
        red: 'bg-red-50 hover:bg-red-600 hover:text-white text-red-600 dark:bg-rose-500/10 dark:text-rose-300',
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
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            {showFrom && (
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400 block mb-1">من تاريخ</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400 block mb-1">{showFrom ? 'إلى تاريخ' : 'حتى تاريخ'}</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
            </div>
            <Btn color="gold" onClick={onApply}><Search size={14} /> تطبيق</Btn>
        </div>
    );
}
function Card({ children, className = '' }) {
    return <div className={`bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden ${className}`}>{children}</div>;
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
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالكود أو الاسم…"
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-brand-400 dark:text-brand-400">{accounts.length} حساب</span>
                    <Btn color="gray" size="sm" onClick={reload}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> حساب جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : filtered.length === 0 ? <Empty msg="لا توجد حسابات" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
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
                                        <tr key={a.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-mono font-bold text-brand-800 dark:text-brand-300">{a.code}</td>
                                            <td className="px-3 py-2.5" style={{ paddingRight: `${0.75 + depth * 0.6}rem` }}>
                                                {isGroup
                                                    ? <span className="font-black text-brand-800 dark:text-brand-100">{a.name}</span>
                                                    : <EntityLink to={`acct/${a.id}`} muted title="دفتر أستاذ الحساب">{a.name}</EntityLink>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">
                                                {isGroup ? '—' : money(a.balance)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button onClick={() => setEditing({ id: a.id, code: a.code, name: a.name, type: a.type, parent_id: a.parent_id || '', is_group: Number(a.is_group) })}
                                                    className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059] transition"><Edit2 size={15} /></button>
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
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل حساب' : 'حساب جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الكود</label>
                                    <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">اسم الحساب</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الحساب الأب (اختياري)</label>
                                <select value={editing.parent_id} onChange={e => setEditing({ ...editing, parent_id: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    <option value="">— بدون —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-brand-300 cursor-pointer">
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
//  AccountCombobox — حقل بحث قابل للكتابة عن الحسابات (كود أو اسم)
// ════════════════════════════════════════════════════════════════════════════
function AccountCombobox({ accounts, value, onChange, placeholder = 'ابحث بالكود أو الاسم…', className = '' }) {
    const [q, setQ]         = useState('');
    const [open, setOpen]   = useState(false);
    const [cursor, setCursor] = useState(0);
    const inputRef = React.useRef(null);
    const listRef  = React.useRef(null);

    // عند تغيير القيمة خارجيًا (مثلاً عند صفّ جديد) نُعيد النص المعروض
    const selected = accounts.find(a => String(a.id) === String(value));
    const displayText = selected ? `${selected.code} · ${selected.name}` : '';

    // الأسلوب: إن كان الحقل يحتوي نفس نص الحساب المختار → لا نفلتر، لكن فتح القائمة
    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return accounts.slice(0, 50); // أول 50 عند فارغ
        return accounts.filter(a =>
            a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
        ).slice(0, 30);
    }, [q, accounts]);

    const pick = (a) => {
        onChange(String(a.id));
        setQ('');
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!open) { if (e.key !== 'Escape') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter' && filtered[cursor]) { e.preventDefault(); pick(filtered[cursor]); }
        else if (e.key === 'Escape') { setOpen(false); setQ(''); }
    };

    // مزامنة scroll الـ cursor
    React.useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[cursor];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    return (
        <div className={`relative ${className}`}>
            {/* حقل الإدخال — يعرض اسم الحساب المختار أو نص البحث */}
            <input
                ref={inputRef}
                type="text"
                value={open ? q : displayText}
                placeholder={placeholder}
                onFocus={() => { setOpen(true); setQ(''); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQ(e.target.value); setCursor(0); if (!open) setOpen(true); }}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059] placeholder-slate-300 dark:placeholder-brand-600"
                dir="rtl"
                autoComplete="off"
            />
            {/* القائمة المنسدلة */}
            {open && filtered.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute z-50 mt-0.5 w-full max-h-56 overflow-y-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-lg text-sm"
                >
                    {filtered.map((a, idx) => (
                        <li key={a.id}
                            onMouseDown={() => pick(a)}
                            className={`px-3 py-1.5 cursor-pointer flex items-baseline gap-2 ${idx === cursor ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}
                        >
                            <span className="font-mono text-xs text-slate-400 dark:text-brand-500 shrink-0">{a.code}</span>
                            <span className="font-bold text-slate-700 dark:text-brand-200 truncate">{a.name}</span>
                            <span className={`text-[10px] mr-auto shrink-0 px-1.5 py-0.5 rounded font-bold
                                ${a.type==='asset'?'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400':
                                  a.type==='liability'?'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400':
                                  a.type==='equity'?'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400':
                                  a.type==='revenue'?'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400':
                                  'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                {a.type==='asset'?'أصول':a.type==='liability'?'خصوم':a.type==='equity'?'ملكية':a.type==='revenue'?'إيرادات':'مصروفات'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  PartyCombobox — حقل بحث للأطراف (عملاء / موردون)
// ════════════════════════════════════════════════════════════════════════════
function PartyCombobox({ parties, value, onChange, placeholder = 'ابحث باسم الطرف…', className = '', rawId = false }) {
    const [q, setQ]         = useState('');
    const [open, setOpen]   = useState(false);
    const [cursor, setCursor] = useState(0);
    const listRef  = React.useRef(null);

    // rawId=true → value is just party id; rawId=false → "type:id"
    const selected = rawId
        ? parties.find(p => String(p.id) === String(value))
        : parties.find(p => `${p.type}:${p.id}` === value);
    const displayText = selected ? `${selected.type === 'customer' ? 'عميل' : 'مورد'}: ${selected.name}` : '';

    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return parties.slice(0, 50);
        return parties.filter(p =>
            p.name.toLowerCase().includes(s) || (p.phone && p.phone.includes(s))
        ).slice(0, 30);
    }, [q, parties]);

    const pick  = (p) => { onChange(rawId ? String(p.id) : `${p.type}:${p.id}`); setQ(''); setOpen(false); };
    const clear = ()  => { onChange(''); setQ(''); setOpen(false); };

    const handleKeyDown = (e) => {
        if (!open) { if (e.key !== 'Escape') setOpen(true); return; }
        // cursor 0 = "بدون طرف", 1..n = filtered entries
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (cursor === 0) clear();
            else if (filtered[cursor - 1]) pick(filtered[cursor - 1]);
        }
        else if (e.key === 'Escape') { setOpen(false); setQ(''); }
    };

    React.useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[cursor];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    return (
        <div className={`relative ${className}`}>
            <input type="text"
                value={open ? q : displayText}
                placeholder={placeholder}
                onFocus={() => { setOpen(true); setQ(''); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQ(e.target.value); setCursor(0); if (!open) setOpen(true); }}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] placeholder-slate-300 dark:placeholder-brand-600"
                dir="rtl" autoComplete="off" />
            {open && (
                <ul ref={listRef} className="absolute z-50 mt-0.5 w-full max-h-48 overflow-y-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-lg text-xs">
                    <li onMouseDown={clear}
                        className={`px-3 py-1.5 cursor-pointer italic text-slate-400 dark:text-brand-500 ${cursor === 0 ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}>
                        — بدون طرف —
                    </li>
                    {filtered.map((p, idx) => (
                        <li key={p.id} onMouseDown={() => pick(p)}
                            className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${idx + 1 === cursor ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold text-[10px]
                                ${p.type === 'customer'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                {p.type === 'customer' ? 'عميل' : 'مورد'}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-brand-200 truncate">{p.name}</span>
                        </li>
                    ))}
                </ul>
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
    const [page, setPage]     = useState(1);
    const [total, setTotal]   = useState(0);
    const [search, setSearch] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo,   setFilterTo]   = useState('');
    const PAGE_SIZE = 30;
    const postable = useMemo(() => accounts.filter(a => Number(a.is_group) === 0), [accounts]);

    const loadPage = useCallback(async (pg, q, fr, to) => {
        setLoading(true);
        try {
            const params = { limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE };
            if (q)  params.search = q;
            if (fr) params.from   = fr;
            if (to) params.to     = to;
            const r = await api('gl_entries', { params });
            setEntries(r.data || []);
            setTotal(r.total || 0);
        }
        catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { loadPage(page, search, filterFrom, filterTo); }, [loadPage, page]); // eslint-disable-line
    // load: يعيد للصفحة الأولى ويحدّث — يُستدعى بعد كل تعديل/حذف/إنشاء
    const load = useCallback(() => { setPage(1); loadPage(1, search, filterFrom, filterTo); }, [loadPage, search, filterFrom, filterTo]);

    // بحث: debounce 400ms
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); loadPage(1, search, filterFrom, filterTo); }, 400);
        return () => clearTimeout(t);
    }, [search, filterFrom, filterTo]); // eslint-disable-line

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

    const duplicateEntry = async (id) => {
        try {
            const r = await api('gl_entry_single', { params: { id } });
            if (!r.success) { toast(r.message || 'تعذّر الجلب', 'error'); return; }
            setForm({
                id: 0, // قيد جديد
                date: todayISO(),
                description: r.entry.description ? `نسخة: ${r.entry.description}` : '',
                lines: r.lines.map(l => ({
                    account_id: l.account_id, debit: Number(l.debit) || '', credit: Number(l.credit) || '',
                    party_type: l.party_type || '', party_id: l.party_id || '', due_date: '',
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
        const setLine = (i, patch) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));

        // توازن تلقائي: يُكمل آخر بند لتوازن القيد
        const autoBalance = () => {
            const diff = Math.round((totals.d - totals.c) * 100) / 100;
            if (Math.abs(diff) < 0.005) return;
            const lastIdx = form.lines.length - 1;
            setLine(lastIdx, diff > 0
                ? { credit: Math.round((parseFloat(form.lines[lastIdx].credit) || 0) + diff, 2).toFixed(2), debit: '' }
                : { debit:  Math.round((parseFloat(form.lines[lastIdx].debit)  || 0) - diff, 2).toFixed(2), credit: '' }
            );
        };
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{form.id ? 'تعديل قيد' : 'قيد يومية جديد'}</h3>
                    <Btn color="gray" onClick={() => setForm(null)}><X size={15} /> رجوع للقائمة</Btn>
                </div>
                <Card className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ</label>
                            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">البيان</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="وصف القيد…"
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm border-collapse">
                            <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
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
                                    <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                        <td className="px-2 py-1.5">
                                            <AccountCombobox
                                                accounts={postable}
                                                value={l.account_id}
                                                onChange={v => setLine(i, { account_id: v })}
                                            />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.debit} onChange={e => setLine(i, { debit: e.target.value, credit: '' })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-emerald-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.credit} onChange={e => setLine(i, { credit: e.target.value, debit: '' })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-rose-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5 space-y-1">
                                            <PartyCombobox
                                                parties={parties}
                                                value={l.party_id ? `${l.party_type}:${l.party_id}` : ''}
                                                onChange={v => {
                                                    if (!v) { setLine(i, { party_type: '', party_id: '' }); return; }
                                                    const [pt, pid] = v.split(':');
                                                    setLine(i, { party_type: pt, party_id: pid });
                                                }}
                                            />
                                            <input type="date" title="تاريخ الاستحقاق" value={l.due_date} onChange={e => setLine(i, { due_date: e.target.value })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={l.description} onChange={e => setLine(i, { description: e.target.value })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059]" />
                                            {costCenters.length > 0 && (
                                                <select value={l.cost_center_id} onChange={e => setLine(i, { cost_center_id: e.target.value })}
                                                    className="w-full mt-1 bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]">
                                                    <option value="">— مركز تكلفة —</option>
                                                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {form.lines.length > 2 && (
                                                <button onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                                                    className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
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
                        <Btn color="gray" size="sm" onClick={() => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }))}><Plus size={14} /> إضافة بند</Btn>
                        {!balanced && Math.abs(totals.d - totals.c) > 0.005 && (
                            <Btn color="gray" size="sm" onClick={autoBalance} title="أكمل آخر بند تلقائياً لتوازن القيد">
                                ⚖ توازن تلقائي ({Math.abs(totals.d - totals.c).toFixed(2)})
                            </Btn>
                        )}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    {/* بحث */}
                    <div className="relative min-w-[160px] flex-1 max-w-xs">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث في القيود…"
                            className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 pr-8 pl-3 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059]"
                            dir="rtl" />
                    </div>
                    {/* فلتر التاريخ */}
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                        title="من تاريخ"
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                        title="إلى تاريخ"
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                    {/* اختصارات زمنية */}
                    {[
                        { label: 'اليوم', f: todayISO(), t: todayISO() },
                        { label: 'هذا الشهر', f: monthStart(), t: todayISO() },
                        { label: 'هذه السنة', f: yearStart(), t: todayISO() },
                        { label: 'الشهر الماضي', ...prevMonth() },
                    ].map(({ label, f, t }) => (
                        <button key={label}
                            onClick={() => { setFilterFrom(f); setFilterTo(t); }}
                            className={`text-xs px-2 py-1 rounded-lg font-bold border transition ${filterFrom===f&&filterTo===t?'bg-brand-800 text-white border-brand-800':'bg-slate-50 border-slate-200 dark:bg-brand-800 dark:border-brand-700 text-slate-500 dark:text-brand-300 hover:border-[#c5a059]'}`}>
                            {label}
                        </button>
                    ))}
                    {(filterFrom || filterTo || search) && (
                        <button onClick={() => { setSearch(''); setFilterFrom(''); setFilterTo(''); }}
                            className="text-xs text-slate-400 hover:text-red-500 font-bold px-1" title="مسح الفلتر">✕ مسح</button>
                    )}
                    <span className="text-sm text-slate-500 dark:text-brand-400 shrink-0">{total.toLocaleString()} قيد</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Btn color="gray" size="sm" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={newEntry}><Plus size={15} /> قيد جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : entries.length === 0 && page === 1 ? <Empty msg="لا توجد قيود بعد" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
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
                                        <tr key={e.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-mono font-bold"><EntityLink to={`entry/${e.id}`} title="تفاصيل القيد">{e.entry_no}</EntityLink></td>
                                            <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300">{e.date}</td>
                                            <td className="px-3 py-2.5 text-slate-700 dark:text-brand-300 max-w-xs truncate" title={e.description}>{e.description || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                {e.ref_type ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:text-brand-400">{e.ref_type}</span> : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">{money(e.total_debit)}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => viewEntry(e.id)} title="عرض" className="text-slate-400 dark:text-brand-500 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-300"><Eye size={15} /></button>
                                                    {!locked && <button onClick={() => editEntry(e.id)} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>}
                                                    <button onClick={() => duplicateEntry(e.id)} title="نسخ كقيد جديد" className="text-slate-400 dark:text-brand-500 hover:text-blue-600"><Copy size={15} /></button>
                                                    <button onClick={() => reverse(e.id)} title="عكس" className="text-slate-400 dark:text-brand-500 hover:text-amber-600"><RotateCcw size={15} /></button>
                                                    {!locked && <button onClick={() => del(e.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>}
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

            {!loading && total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 disabled:opacity-40 hover:border-[#c5a059] transition">
                        ← السابق
                    </button>
                    <span className="text-sm font-bold text-slate-600 dark:text-brand-300">
                        {page} / {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 disabled:opacity-40 hover:border-[#c5a059] transition">
                        التالي →
                    </button>
                </div>
            )}

            {viewing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{viewing.entry.entry_no}</h3>
                                <p className="text-xs text-slate-500 dark:text-brand-400">{viewing.entry.date} · {viewing.entry.description}</p>
                            </div>
                            <button onClick={() => setViewing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                <tr><th className="px-3 py-2 font-bold">الحساب</th><th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th></tr>
                            </thead>
                            <tbody>
                                {viewing.lines.map(l => (
                                    <tr key={l.id} className="border-b border-slate-100 dark:border-brand-700">
                                        <td className="px-3 py-2">
                                            {l.account_id
                                                ? <EntityLink to={`acct/${l.account_id}`} muted title="دفتر أستاذ الحساب"><span className="font-mono text-xs opacity-70">{l.account_code}</span> {l.account_name}</EntityLink>
                                                : <span><span className="font-mono text-xs text-slate-400 dark:text-brand-500">{l.account_code}</span> {l.account_name}</span>}
                                            {l.description ? <span className="block text-xs text-slate-400 dark:text-brand-500">{l.description}</span> : null}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.debit) ? money(l.debit) : ''}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.credit) ? money(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-black text-brand-800 dark:text-brand-100 bg-slate-50 dark:bg-brand-800/60">
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
                        <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                            <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الحساب</th>
                                <th className="px-3 py-3 font-bold text-left">مدين</th><th className="px-3 py-3 font-bold text-left">دائن</th></tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                    <td className="px-3 py-2.5 font-mono text-slate-400 dark:text-brand-500">{r.code}</td>
                                    <td className="px-3 py-2.5"><EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب">{r.name}</EntityLink></td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.debit_balance) ? money(r.debit_balance) : ''}</td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.credit_balance) ? money(r.credit_balance) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
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
                    <div key={r.id} className="flex justify-between text-sm py-1 border-b border-slate-50 dark:border-brand-700">
                        <EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب"><span className="font-mono text-xs opacity-70">{r.code}</span> {r.name}</EntityLink>
                        <span className="tabular-nums font-bold" dir="ltr">{money(r.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
                {data && (
                    <div className="flex gap-2">
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('income_statement.csv',
                            ['النوع', 'الكود', 'الحساب', 'مبلغ'],
                            [
                                ...( data.revenue  || []).map(r => ['إيرادات', r.code, r.name, r.amount]),
                                ...( data.expenses || []).map(r => ['مصروفات', r.code, r.name, r.amount]),
                                ['', '', 'إجمالي الإيرادات', data.totals.revenue],
                                ['', '', 'إجمالي المصروفات', data.totals.expenses],
                                ['', '', 'صافي الدخل', data.totals.net],
                            ])}>
                            <Download size={14} /> تصدير
                        </Btn>
                        <Btn color="gray" size="sm" onClick={() => {
                            const esc = s => String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
                            const r2 = (code,name,amt) => `<tr><td>${esc(code)} · ${esc(name)}</td><td class="amount">${money(amt)} ﷼</td></tr>`;
                            printHtml('قائمة الدخل', `
                                <h1>قائمة الدخل</h1><h2>من ${from} إلى ${to}</h2>
                                <table><thead><tr><th>الحساب</th><th style="text-align:left">المبلغ</th></tr></thead><tbody>
                                <tr class="section-header"><td colspan="2">الإيرادات</td></tr>
                                ${(data.revenue||[]).map(r=>r2(r.code,r.name,r.amount)).join('')}
                                <tr class="total-row"><td>إجمالي الإيرادات</td><td class="amount">${money(data.totals.revenue)} ﷼</td></tr>
                                <tr class="section-header"><td colspan="2">المصروفات</td></tr>
                                ${(data.expenses||[]).map(r=>r2(r.code,r.name,r.amount)).join('')}
                                <tr class="total-row"><td>إجمالي المصروفات</td><td class="amount">${money(data.totals.expenses)} ﷼</td></tr>
                                <tr class="net-row"><td>صافي الدخل</td><td class="amount">${money(data.totals.net)} ﷼</td></tr>
                                </tbody></table>`);
                        }}>
                            <Printer size={14} /> طباعة
                        </Btn>
                    </div>
                )}
            </div>
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <Card className="p-5 md:p-6 space-y-5">
                    {section('الإيرادات', data.revenue || [], 'text-emerald-700')}
                    {section('المصروفات', data.expenses || [], 'text-rose-700')}
                    <div className="border-t-2 border-slate-100 dark:border-brand-700 pt-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="font-bold text-slate-500 dark:text-brand-400">إجمالي الإيرادات</span><span className="tabular-nums font-bold text-emerald-700" dir="ltr">{money(data.totals.revenue)}</span></div>
                        <div className="flex justify-between text-sm"><span className="font-bold text-slate-500 dark:text-brand-400">إجمالي المصروفات</span><span className="tabular-nums font-bold text-rose-700" dir="ltr">{money(data.totals.expenses)}</span></div>
                        <div className="flex justify-between text-lg pt-2 border-t border-slate-100 dark:border-brand-700">
                            <span className="font-black text-brand-800 dark:text-brand-100">صافي الدخل</span>
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
                    <div key={r.id} className="flex justify-between text-sm py-1 border-b border-slate-50 dark:border-brand-700">
                        <EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب"><span className="font-mono text-xs opacity-70">{r.code}</span> {r.name}</EntityLink>
                        <span className="tabular-nums font-bold" dir="ltr">{money(r.amount)}</span>
                    </div>
                ))}
                {extra}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t-2 border-slate-100 dark:border-brand-700 font-black text-brand-800 dark:text-brand-100">
                <span>الإجمالي</span><span className="tabular-nums" dir="ltr">{money(total)} ﷼</span>
            </div>
        </Card>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar to={to} setTo={setTo} onApply={() => load(to)} showFrom={false} />
                <div className="flex items-center gap-2">
                    {data && <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.totals.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {data.totals.balanced ? '✓ الميزانية متوازنة' : '✗ غير متوازنة'}</span>}
                    {data && <>
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('balance_sheet.csv',
                            ['الفئة', 'الكود', 'الحساب', 'المبلغ'],
                            [
                                ...(data.assets      || []).map(r => ['أصول',   r.code, r.name, r.amount]),
                                ['', '', 'إجمالي الأصول', data.totals.assets],
                                ...(data.liabilities || []).map(r => ['خصوم',   r.code, r.name, r.amount]),
                                ['', '', 'إجمالي الخصوم', data.totals.liabilities],
                                ...(data.equity      || []).map(r => ['ملكية',  r.code, r.name, r.amount]),
                                ['صافي دخل الفترة', '', '', data.net_income],
                                ['', '', 'إجمالي حقوق الملكية', data.totals.equity],
                            ])}>
                            <Download size={14} /> تصدير
                        </Btn>
                        <Btn color="gray" size="sm" onClick={() => {
                            const esc = s => String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
                            const r2 = (code,name,amt) => `<tr><td>${esc(code)} · ${esc(name)}</td><td class="amount">${money(amt)} ﷼</td></tr>`;
                            const totR = (label,amt,cls='total-row') => `<tr class="${cls}"><td>${esc(label)}</td><td class="amount">${money(amt)} ﷼</td></tr>`;
                            printHtml('الميزانية العمومية', `
                                <h1>الميزانية العمومية</h1><h2>بتاريخ ${to}</h2>
                                <table><thead><tr><th>الحساب</th><th style="text-align:left">المبلغ</th></tr></thead><tbody>
                                <tr class="section-header"><td colspan="2">الأصول</td></tr>
                                ${(data.assets||[]).map(r=>r2(r.code,r.name,r.amount)).join('')}
                                ${totR('إجمالي الأصول',data.totals.assets)}
                                <tr class="section-header"><td colspan="2">الخصوم</td></tr>
                                ${(data.liabilities||[]).map(r=>r2(r.code,r.name,r.amount)).join('')}
                                ${totR('إجمالي الخصوم',data.totals.liabilities)}
                                <tr class="section-header"><td colspan="2">حقوق الملكية</td></tr>
                                ${(data.equity||[]).map(r=>r2(r.code,r.name,r.amount)).join('')}
                                <tr><td>صافي دخل الفترة</td><td class="amount">${money(data.net_income)} ﷼</td></tr>
                                ${totR('إجمالي حقوق الملكية',data.totals.equity)}
                                ${totR('إجمالي الخصوم + حقوق الملكية',data.totals.liabilities+data.totals.equity,'net-row')}
                                </tbody></table>`);
                        }}>
                            <Printer size={14} /> طباعة
                        </Btn>
                    </>}
                </div>
            </div>
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {col('الأصول', data.assets, data.totals.assets, 'text-blue-700')}
                    <div className="space-y-4">
                        {col('الخصوم', data.liabilities, data.totals.liabilities, 'text-amber-700')}
                        {col('حقوق الملكية', data.equity, data.totals.equity, 'text-purple-700',
                            <div className="flex justify-between text-sm py-1 border-b border-slate-50 dark:border-brand-700 text-slate-500 dark:text-brand-400 italic">
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
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الحساب</label>
                    <AccountCombobox
                        accounts={postable}
                        value={acc}
                        onChange={setAcc}
                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">من</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">إلى</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <Btn color="gold" onClick={load}><Search size={14} /> عرض</Btn>
            </Card>

            {loading ? <Spinner /> : !data ? <Empty msg="اختر حساباً واضغط عرض" /> : (
                <Card>
                    <div className="px-4 py-3 bg-slate-50 dark:bg-brand-800/40 border-b border-slate-100 dark:border-brand-700 flex justify-between items-center gap-3 flex-wrap">
                        <span className="font-black text-brand-800 dark:text-brand-100">{data.account.code} · {data.account.name}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 dark:text-brand-400">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(data.opening)}</span></span>
                            <Btn color="gray" size="sm" onClick={() => downloadCSV(`ledger_${data.account.code}.csv`,
                                ['القيد', 'التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
                                data.data.map(r => [r.entry_no, r.date, r.line_desc || r.ent_desc || '', r.debit || '', r.credit || '', r.balance]))}>
                                <Download size={14} /> تصدير
                            </Btn>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr><th className="px-3 py-3 font-bold">القيد</th><th className="px-3 py-3 font-bold">التاريخ</th>
                                    <th className="px-3 py-3 font-bold">البيان</th><th className="px-3 py-3 font-bold text-left">مدين</th>
                                    <th className="px-3 py-3 font-bold text-left">دائن</th><th className="px-3 py-3 font-bold text-left">الرصيد</th></tr>
                            </thead>
                            <tbody>
                                {data.data.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.entry_id ? <EntityLink to={`entry/${r.entry_id}`} muted title="تفاصيل القيد">{r.entry_no}</EntityLink> : <span className="text-slate-400 dark:text-brand-500">{r.entry_no}</span>}</td>
                                        <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300">{r.date}</td>
                                        <td className="px-3 py-2.5 text-slate-700 dark:text-brand-300">{r.line_desc || r.ent_desc || '—'}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
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
                        <p className="text-sm font-bold text-slate-500 dark:text-brand-400 mb-2">ضريبة المخرجات (المبيعات)</p>
                        <p className="text-2xl font-black text-emerald-700 tabular-nums" dir="ltr">{money(data.output_vat)}</p>
                    </Card>
                    <Card className="p-5 text-center">
                        <p className="text-sm font-bold text-slate-500 dark:text-brand-400 mb-2">ضريبة المدخلات (المشتريات)</p>
                        <p className="text-2xl font-black text-blue-700 tabular-nums" dir="ltr">{money(data.input_vat)}</p>
                    </Card>
                    <Card className="p-5 text-center bg-brand-800 text-white">
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
    const [ledgerFrom, setLedgerFrom] = useState('');
    const [ledgerTo,   setLedgerTo]   = useState('');
    const [ledgerLoading, setLedgerLoading] = useState(false);
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
    const openLedger = async (p, fr, to) => {
        setLedgerLoading(true);
        try {
            const params = { party_id: p ? p.id : (ledger?.party?.id) };
            if (fr) params.from = fr; else if (ledgerFrom) params.from = ledgerFrom;
            if (to) params.to   = to; else if (ledgerTo)   params.to   = ledgerTo;
            const r = await api('gl_party_ledger', { params });
            if (r.success) setLedger(r); else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setLedgerLoading(false); }
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
                    <button onClick={() => setType('customer')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'customer' ? 'bg-brand-800 text-white' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>العملاء</button>
                    <button onClick={() => setType('supplier')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'supplier' ? 'bg-brand-800 text-white' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>الموردون</button>
                    <div className="w-px bg-slate-200 mx-1" />
                    <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'list' ? 'bg-amber-50 text-gold-500 border border-[#c5a059]' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>القائمة</button>
                    <button onClick={() => setTab('aging')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'aging' ? 'bg-amber-50 text-gold-500 border border-[#c5a059]' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>أعمار الذمم</button>
                </div>
                {tab === 'list' && <Btn color="green" onClick={() => setEditing({ ...blank, type })}><Plus size={15} /> طرف جديد</Btn>}
                {tab === 'aging' && aging && aging.data.length > 0 && (
                    <Btn color="gray" size="sm" onClick={() => downloadCSV(`aging_${type}.csv`,
                        ['الطرف', 'جارٍ', '1-30 يوم', '31-60 يوم', '61-90 يوم', '+90 يوم', 'الإجمالي'],
                        [
                            ...aging.data.map(r => [r.name, r.current, r.d30, r.d60, r.d90, r.d90p, r.total]),
                            ['الإجمالي', aging.totals.current, aging.totals.d30, aging.totals.d60, aging.totals.d90, aging.totals.d90p, aging.totals.total],
                        ])}>
                        <Download size={14} /> تصدير
                    </Btn>
                )}
            </div>

            {tab === 'list' ? (
                loading ? <Spinner /> : filtered.length === 0 ? <Empty msg={type === 'customer' ? 'لا يوجد عملاء' : 'لا يوجد موردون'} /> : (
                    <Card>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr><th className="px-3 py-3 font-bold">الاسم</th><th className="px-3 py-3 font-bold">الرقم الضريبي</th>
                                    <th className="px-3 py-3 font-bold">الجوال</th><th className="px-3 py-3 font-bold text-center w-32">إجراءات</th></tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                        <td className="px-3 py-2.5 font-bold"><EntityLink to={`parties/${p.id}`} title="كشف حساب الطرف">{p.name}</EntityLink></td>
                                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-brand-400">{p.vat_number || '—'}</td>
                                        <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300" dir="ltr">{p.phone || '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => openLedger(p)} title="كشف حساب" className="text-slate-400 dark:text-brand-500 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-300"><FileText size={15} /></button>
                                                <button onClick={() => setEditing({ id: p.id, type: p.type, name: p.name, vat_number: p.vat_number || '', cr_number: p.cr_number || '', phone: p.phone || '', email: p.email || '', address: p.address || '' })} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                                <button onClick={() => del(p.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>
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
                                <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                    <tr><th className="px-3 py-3 font-bold">الطرف</th><th className="px-3 py-3 font-bold text-left">جارٍ</th>
                                        <th className="px-3 py-3 font-bold text-left">1-30</th><th className="px-3 py-3 font-bold text-left">31-60</th>
                                        <th className="px-3 py-3 font-bold text-left">61-90</th><th className="px-3 py-3 font-bold text-left">+90</th>
                                        <th className="px-3 py-3 font-bold text-left">الإجمالي</th></tr>
                                </thead>
                                <tbody>
                                    {aging.data.map(r => (
                                        <tr key={r.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-bold"><EntityLink to={`parties/${r.id}`} title="كشف حساب الطرف">{r.name}</EntityLink></td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.current)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d30)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d60)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-amber-700" dir="ltr">{money(r.d90)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-rose-700 font-bold" dir="ltr">{money(r.d90p)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums font-black text-brand-800 dark:text-brand-100" dir="ltr">{money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
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
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل طرف' : 'طرف جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        <option value="customer">عميل</option><option value="supplier">مورد</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الجوال</label>
                                    <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الرقم الضريبي</label>
                                    <input value={editing.vat_number} onChange={e => setEditing({ ...editing, vat_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">السجل التجاري</label>
                                    <input value={editing.cr_number} onChange={e => setEditing({ ...editing, cr_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">البريد الإلكتروني</label>
                                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} dir="ltr"
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
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
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="space-y-3 mb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">كشف حساب: {ledger.party.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-brand-400">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(ledger.opening)}</span></p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {ledger.data.length > 0 && (
                                        <Btn color="gray" size="sm" onClick={() => downloadCSV(
                                            `party_${ledger.party.name}.csv`,
                                            ['القيد', 'التاريخ', 'مدين', 'دائن', 'الرصيد'],
                                            ledger.data.map(r => [r.entry_no, r.date, r.debit || '', r.credit || '', r.balance]))}>
                                            <Download size={13} /> تصدير
                                        </Btn>
                                    )}
                                    <button onClick={() => setLedger(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                                </div>
                            </div>
                            {/* فلتر التاريخ */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] w-32" />
                                <span className="text-xs text-slate-400">—</span>
                                <input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] w-32" />
                                <Btn color="gold" size="sm" onClick={() => openLedger(null, ledgerFrom, ledgerTo)}>
                                    {ledgerLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />} عرض
                                </Btn>
                                {(ledgerFrom || ledgerTo) && (
                                    <button onClick={() => { setLedgerFrom(''); setLedgerTo(''); openLedger(null, '', ''); }}
                                        className="text-xs text-slate-400 hover:text-red-500 font-bold px-1" title="مسح الفلتر">✕ كل التواريخ</button>
                                )}
                            </div>
                        </div>
                        {ledger.data.length === 0 ? <Empty msg="لا توجد حركات" /> : (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                    <tr><th className="px-3 py-2 font-bold">القيد</th><th className="px-3 py-2 font-bold">التاريخ</th>
                                        <th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th>
                                        <th className="px-3 py-2 font-bold text-left">الرصيد</th></tr>
                                </thead>
                                <tbody>
                                    {ledger.data.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                            <td className="px-3 py-2 font-mono text-xs"><EntityLink to={`entry/${r.entry_id}`} muted title="تفاصيل القيد">{r.entry_no}</EntityLink></td>
                                            <td className="px-3 py-2 text-slate-600 dark:text-brand-300">{r.date}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
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
                <span className="text-sm text-slate-500 dark:text-brand-400">{costCenters.length} مركز</span>
                <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> مركز جديد</Btn>
            </div>
            {loading ? <Spinner /> : costCenters.length === 0 ? <Empty msg="لا توجد مراكز تكلفة" /> : (
                <Card>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                            <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الاسم</th><th className="px-3 py-3 font-bold text-center w-16">تعديل</th></tr>
                        </thead>
                        <tbody>
                            {costCenters.map(c => (
                                <tr key={c.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                    <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-brand-400">{c.code || '—'}</td>
                                    <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-brand-300">{c.name}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <button onClick={() => setEditing({ id: c.id, code: c.code || '', name: c.name, parent_id: c.parent_id || '' })} className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل مركز' : 'مركز تكلفة جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الكود (اختياري)</label>
                                <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
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
// ════════════════════════════════════════════════════════════════════════════
//  تبويبات المستندات (Phase 3): فواتير البيع/الشراء + سندات القبض/الصرف
// ════════════════════════════════════════════════════════════════════════════
const INV_STATUS = {
    draft:   { label: 'مسودة',           cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' },
    posted:  { label: 'مُرحّلة',          cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
    partial: { label: 'مدفوعة جزئيًا',    cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
    paid:    { label: 'مدفوعة',           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
    void:    { label: 'ملغاة',            cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30' },
};
function StatusBadge({ status }) {
    const s = INV_STATUS[status] || INV_STATUS.draft;
    return <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold border ${s.cls}`}>{s.label}</span>;
}

function calcTotals(items) {
    let sub = 0, tax = 0;
    (items || []).forEach(it => {
        const net = Math.max(0, (Number(it.qty) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0));
        sub += net;
        tax += net * (Number(it.tax_rate) || 0) / 100;
    });
    const r = (n) => Math.round(n * 100) / 100;
    return { sub: r(sub), tax: r(tax), total: r(sub + tax) };
}

function InvoicesTab({ docType, parties, accounts, company = {}, toast }) {
    const isSales = docType === 'sales';
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');

    const partyOptions = useMemo(
        () => parties.filter(p => p.type === (isSales ? 'customer' : 'supplier')),
        [parties, isSales]);
    const acctOptions = useMemo(
        () => accounts.filter(a => Number(a.is_group) === 0 && (isSales ? a.type === 'revenue' : (a.type === 'expense' || a.type === 'asset'))),
        [accounts, isSales]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api('inv_list', { params: { doc_type: docType, ...(statusFilter ? { status: statusFilter } : {}) } });
            setList(r.data || []);
        } catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [docType, statusFilter, toast]);
    useEffect(() => { load(); }, [load]);

    const blankItem = () => ({ description: '', qty: 1, unit_price: 0, discount: 0, tax_rate: 15 });
    const newInvoice = () => setEditing({
        doc_type: docType, invoice_type: 'standard', party_id: '', party_name: '',
        issue_date: todayISO(), due_date: '', gl_account_id: '', notes: '', items: [blankItem()],
    });

    const editDraft = async (id) => {
        try {
            const r = await api('inv_single', { params: { id } });
            if (!r.success) return toast(r.message, 'error');
            const inv = r.invoice;
            setEditing({
                id: inv.id, doc_type: docType, invoice_type: inv.invoice_type,
                party_id: inv.party_id || '', party_name: inv.party_name || '',
                issue_date: inv.issue_date, due_date: inv.due_date || '', gl_account_id: inv.gl_account_id || '',
                notes: inv.notes || '',
                items: (r.items || []).map(x => ({ description: x.description, qty: x.qty, unit_price: x.unit_price, discount: x.discount, tax_rate: x.tax_rate })),
            });
        } catch (e) { toast(e.message, 'error'); }
    };

    const saveDraft = async () => {
        const f = editing;
        if (!f.items.some(it => it.description && Number(it.qty))) return toast('أضف بندًا صالحًا على الأقل', 'error');
        try {
            const r = await api('inv_save', { method: 'POST', body: {
                id: f.id || 0, doc_type: docType, invoice_type: f.invoice_type,
                party_id: f.party_id || '', party_name: f.party_name || '',
                issue_date: f.issue_date, due_date: f.due_date || '', gl_account_id: f.gl_account_id || '',
                notes: f.notes || '', items: f.items,
            }});
            if (r.success) { toast(r.message || 'تم الحفظ'); setEditing(null); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const act = async (action, id, confirmMsg) => {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        try {
            const r = await api(action, { method: 'POST', body: { id } });
            if (r.success) { toast((r.message || 'تم') + (r.entry_no ? ' — ' + r.entry_no : '')); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const openView = async (id) => {
        try { const r = await api('inv_single', { params: { id } }); if (r.success) setViewing(r); else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    // طباعة فاتورة احترافية (مع رمز QR للزكاة إن وُجد) في نافذة منفصلة
    const printInvoice = () => {
        if (!viewing) return;
        const inv = viewing.invoice, items = viewing.items || [];
        const qrEl = document.querySelector('#zatca-qr-box svg');
        const qrSvg = qrEl ? qrEl.outerHTML : '';
        const w = window.open('', '_blank', 'width=820,height=1000');
        if (!w) { toast('فعّل النوافذ المنبثقة للطباعة', 'error'); return; }
        const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const rows = items.map(it => `<tr><td style="text-align:right">${esc(it.description)}</td><td>${it.qty}</td><td>${money(it.unit_price)}</td><td>${money(it.discount)}</td><td>${money(it.tax_amount)}</td><td style="text-align:left">${money(it.line_total)}</td></tr>`).join('');
        const docTitle = inv.doc_type === 'sales' ? (inv.invoice_type === 'simplified' ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية') : 'فاتورة مشتريات';
        w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(inv.invoice_no)}</title>
<style>
*{box-sizing:border-box} body{font-family:'Cairo','Segoe UI',Arial,sans-serif;color:#1a365d;margin:0;padding:36px;font-size:13px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c5a059;padding-bottom:16px;margin-bottom:18px}
.co{font-size:20px;font-weight:800} .muted{color:#64748b;font-size:12px;margin-top:3px}
.tag{display:inline-block;background:#1a365d;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700}
.meta{display:flex;gap:24px;margin:14px 0;flex-wrap:wrap} .meta div{font-size:12px}
table{width:100%;border-collapse:collapse;margin:14px 0} th,td{border:1px solid #e2e8f0;padding:8px;text-align:center}
th{background:#f8fafc;color:#475569;font-weight:700}
.totals{width:280px;margin-right:auto;margin-top:8px} .totals tr td{border:none;padding:4px 8px;text-align:left}
.grand{font-weight:800;font-size:15px;border-top:2px solid #1a365d!important}
.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px}
.qrbox{text-align:center} .qrbox svg{width:120px;height:120px}
@media print{body{padding:12px}}
</style></head><body>
<div class="head">
  <div><div class="co">${esc(company.company_name || 'سمك')}</div>
    ${company.vat_number ? `<div class="muted">الرقم الضريبي: ${esc(company.vat_number)}</div>` : ''}
    ${company.cr_number ? `<div class="muted">السجل التجاري: ${esc(company.cr_number)}</div>` : ''}
    ${company.city ? `<div class="muted">${esc([company.address, company.district, company.city].filter(Boolean).join('، '))}</div>` : ''}
  </div>
  <div style="text-align:left"><div class="tag">${docTitle}</div><div class="muted">رقم: <b>${esc(inv.invoice_no)}</b></div></div>
</div>
<div class="meta">
  <div><b>الطرف:</b> ${esc(inv.party_label || inv.party_name || '—')}</div>
  ${inv.party_vat ? `<div><b>الرقم الضريبي للطرف:</b> ${esc(inv.party_vat)}</div>` : ''}
  <div><b>التاريخ:</b> ${esc(inv.issue_date)}</div>
  ${inv.due_date ? `<div><b>الاستحقاق:</b> ${esc(inv.due_date)}</div>` : ''}
</div>
<table><thead><tr><th style="text-align:right">الوصف</th><th>كمية</th><th>سعر</th><th>خصم</th><th>ضريبة</th><th style="text-align:left">إجمالي</th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot">
  <div class="qrbox">${qrSvg}${inv.uuid ? `<div class="muted" style="margin-top:6px;font-size:10px">${esc(inv.uuid)}</div>` : ''}</div>
  <table class="totals">
    <tr><td>المجموع قبل الضريبة</td><td style="text-align:left">${money(inv.subtotal)}</td></tr>
    <tr><td>ضريبة القيمة المضافة (15%)</td><td style="text-align:left">${money(inv.tax_total)}</td></tr>
    <tr class="grand"><td>الإجمالي شامل الضريبة</td><td style="text-align:left">${money(inv.total)} ﷼</td></tr>
    <tr><td style="color:#059669">المدفوع</td><td style="text-align:left;color:#059669">${money(inv.paid)}</td></tr>
  </table>
</div>
</body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
    };

    const t = editing ? calcTotals(editing.items) : null;
    const setItem = (i, key, val) => setEditing(e => ({ ...e, items: e.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }));

    return (
        <div className="space-y-4">
            {/* الإجراءات + الفلتر */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Btn color="navy" onClick={newInvoice}><Plus size={15} /> {isSales ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة'}</Btn>
                    <Btn color="gray" size="sm" onClick={load}><RefreshCw size={14} /> تحديث</Btn>
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                    <option value="">كل الحالات</option>
                    {Object.keys(INV_STATUS).map(k => <option key={k} value={k}>{INV_STATUS[k].label}</option>)}
                </select>
            </div>

            {/* قائمة الفواتير */}
            <Card>
                {loading ? <Spinner /> : list.length === 0 ? <Empty msg="لا توجد فواتير" /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                <tr>
                                    <th className="px-3 py-3 text-right font-bold">الرقم</th>
                                    <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                                    <th className="px-3 py-3 text-right font-bold">{isSales ? 'العميل' : 'المورد'}</th>
                                    <th className="px-3 py-3 text-left font-bold">الإجمالي</th>
                                    <th className="px-3 py-3 text-left font-bold">المدفوع</th>
                                    <th className="px-3 py-3 text-center font-bold">الحالة</th>
                                    <th className="px-3 py-3 text-center font-bold">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                {list.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:bg-brand-800/30 dark:hover:bg-brand-800">
                                        <td className="px-3 py-3 font-mono font-bold text-brand-800 dark:text-brand-300">{inv.invoice_no}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-brand-400">{inv.issue_date}</td>
                                        <td className="px-3 py-3">{inv.party_label || inv.party_name || '—'}</td>
                                        <td className="px-3 py-3 text-left font-bold">{money(inv.total)}</td>
                                        <td className="px-3 py-3 text-left text-emerald-600">{money(inv.paid)}</td>
                                        <td className="px-3 py-3 text-center"><StatusBadge status={inv.status} /></td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openView(inv.id)} title="عرض" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><Eye size={15} /></button>
                                                {inv.status === 'draft' && <button onClick={() => editDraft(inv.id)} title="تعديل" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={15} /></button>}
                                                {inv.status === 'draft' && <button onClick={() => act('inv_post', inv.id, `ترحيل ${inv.invoice_no} (${money(inv.total)} ﷼)؟\nبعد الترحيل لا يمكن التعديل — يلزم إلغاء وعكس القيد.`)} title="ترحيل" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><CheckCircle2 size={15} /></button>}
                                                {inv.status === 'draft' && <button onClick={() => act('inv_delete', inv.id, 'حذف المسودة؟')} title="حذف" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>}
                                                {(inv.status === 'posted') && <button onClick={() => act('inv_void', inv.id, 'إلغاء الفاتورة وعكس قيدها؟')} title="إلغاء" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><RotateCcw size={15} /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* محرّر الفاتورة */}
            {editing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-4xl my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل مسودة' : (isSales ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة')}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{isSales ? 'العميل' : 'المورد'}</label>
                                    <PartyCombobox
                                        parties={partyOptions}
                                        value={editing.party_id}
                                        rawId
                                        onChange={v => { const p = partyOptions.find(x => String(x.id) === v); setEditing(ed => ({ ...ed, party_id: v, party_name: p ? p.name : ed.party_name })); }}
                                        placeholder={isSales ? 'ابحث باسم العميل…' : 'ابحث باسم المورد…'}
                                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50 [&_input]:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">تاريخ الإصدار</label>
                                    <input type="date" value={editing.issue_date} onChange={e => setEditing(ed => ({ ...ed, issue_date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">تاريخ الاستحقاق</label>
                                    <input type="date" value={editing.due_date} onChange={e => setEditing(ed => ({ ...ed, due_date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{isSales ? 'حساب الإيراد' : 'حساب المصروف/المخزون'}</label>
                                    <AccountCombobox
                                        accounts={acctOptions}
                                        value={editing.gl_account_id}
                                        onChange={v => setEditing(ed => ({ ...ed, gl_account_id: v }))}
                                        placeholder={isSales ? 'افتراضي (إيرادات المبيعات)' : 'افتراضي (مصروفات تشغيلية)'}
                                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50"
                                    />
                                </div>
                                {isSales && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">نوع الفاتورة (ZATCA)</label>
                                        <select value={editing.invoice_type} onChange={e => setEditing(ed => ({ ...ed, invoice_type: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                            <option value="standard">ضريبية (B2B)</option>
                                            <option value="simplified">مبسطة (B2C)</option>
                                        </select>
                                    </div>
                                )}
                                <div className={isSales ? '' : 'md:col-span-1'}>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظات</label>
                                    <input type="text" value={editing.notes} onChange={e => setEditing(ed => ({ ...ed, notes: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>

                            {/* بنود الفاتورة */}
                            <div className="border border-slate-100 dark:border-brand-700 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                        <tr>
                                            <th className="px-2 py-2 text-right font-bold">الوصف</th>
                                            <th className="px-2 py-2 font-bold w-20">الكمية</th>
                                            <th className="px-2 py-2 font-bold w-28">السعر</th>
                                            <th className="px-2 py-2 font-bold w-24">خصم</th>
                                            <th className="px-2 py-2 font-bold w-20">ضريبة%</th>
                                            <th className="px-2 py-2 font-bold w-28 text-left">الإجمالي</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editing.items.map((it, i) => {
                                            const net = Math.max(0, (Number(it.qty) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0));
                                            const lt = net + net * (Number(it.tax_rate) || 0) / 100;
                                            return (
                                                <tr key={i} className="border-t border-slate-50 dark:border-brand-700">
                                                    <td className="px-2 py-1.5"><input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="وصف البند" className="w-full bg-transparent px-2 py-1.5 outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.discount} onChange={e => setItem(i, 'discount', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.tax_rate} onChange={e => setItem(i, 'tax_rate', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5 text-left font-bold text-brand-800 dark:text-brand-100">{money(lt)}</td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        {editing.items.length > 1 && <button onClick={() => setEditing(e => ({ ...e, items: e.items.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="p-2 border-t border-slate-50 dark:border-brand-700">
                                    <Btn color="gray" size="sm" onClick={() => setEditing(e => ({ ...e, items: [...e.items, blankItem()] }))}><Plus size={14} /> إضافة بند</Btn>
                                </div>
                            </div>

                            {/* الإجماليات */}
                            <div className="flex justify-end">
                                <div className="w-full md:w-72 space-y-1.5 text-sm">
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>الإجمالي قبل الضريبة</span><span className="font-bold">{money(t.sub)}</span></div>
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>ضريبة القيمة المضافة</span><span className="font-bold">{money(t.tax)}</span></div>
                                    <div className="flex justify-between text-brand-800 dark:text-brand-100 text-base border-t border-slate-100 dark:border-brand-700 pt-1.5"><span className="font-black">الإجمالي</span><span className="font-black">{money(t.total)} ﷼</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30">
                            <Btn color="gray" onClick={() => setEditing(null)}><X size={15} /> إلغاء</Btn>
                            <Btn color="navy" onClick={saveDraft}><Save size={15} /> حفظ كمسودة</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* عرض الفاتورة */}
            {viewing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setViewing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-2xl my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{viewing.invoice.invoice_no}</h3>
                            <div className="flex items-center gap-2">
                                <Btn color="navy" size="sm" onClick={printInvoice}><Printer size={14} /> طباعة</Btn>
                                <button onClick={() => setViewing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-brand-300">
                                <div><span className="text-slate-400 dark:text-brand-500">الطرف:</span> <b>{viewing.invoice.party_label || viewing.invoice.party_name || '—'}</b></div>
                                <div><span className="text-slate-400 dark:text-brand-500">الحالة:</span> <StatusBadge status={viewing.invoice.status} /></div>
                                <div><span className="text-slate-400 dark:text-brand-500">التاريخ:</span> {viewing.invoice.issue_date}</div>
                                <div><span className="text-slate-400 dark:text-brand-500">الاستحقاق:</span> {viewing.invoice.due_date || '—'}</div>
                                {viewing.invoice.party_vat && <div><span className="text-slate-400 dark:text-brand-500">الرقم الضريبي:</span> {viewing.invoice.party_vat}</div>}
                            </div>
                            <div className="border border-slate-100 dark:border-brand-700 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400"><tr><th className="px-2 py-2 text-right">الوصف</th><th className="px-2 py-2">كمية</th><th className="px-2 py-2">سعر</th><th className="px-2 py-2">ضريبة</th><th className="px-2 py-2 text-left">إجمالي</th></tr></thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                        {(viewing.items || []).map(it => (
                                            <tr key={it.id}><td className="px-2 py-2">{it.description}</td><td className="px-2 py-2 text-center">{it.qty}</td><td className="px-2 py-2 text-center">{money(it.unit_price)}</td><td className="px-2 py-2 text-center">{money(it.tax_amount)}</td><td className="px-2 py-2 text-left font-bold">{money(it.line_total)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end">
                                <div className="w-64 space-y-1">
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>قبل الضريبة</span><span>{money(viewing.invoice.subtotal)}</span></div>
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>الضريبة</span><span>{money(viewing.invoice.tax_total)}</span></div>
                                    <div className="flex justify-between font-black text-brand-800 dark:text-brand-100"><span>الإجمالي</span><span>{money(viewing.invoice.total)} ﷼</span></div>
                                    <div className="flex justify-between text-emerald-600"><span>المدفوع</span><span>{money(viewing.invoice.paid)}</span></div>
                                </div>
                            </div>
                            {viewing.invoice.entry_id && <p className="text-xs text-slate-400 dark:text-brand-500">القيد المرتبط: #{viewing.invoice.entry_id}</p>}
                            {viewing.invoice.qr_base64 && (
                                <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-brand-700">
                                    <div id="zatca-qr-box" className="bg-white p-2 rounded-lg border border-slate-200">
                                        <QRCode value={viewing.invoice.qr_base64} size={104} />
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-brand-400 leading-relaxed">
                                        <p className="font-bold text-brand-800 dark:text-brand-100">رمز QR — هيئة الزكاة والضريبة</p>
                                        <p>فاتورة ضريبية متوافقة (المرحلة الأولى)</p>
                                        {viewing.invoice.uuid && <p className="text-slate-400 dark:text-brand-500 mt-1" dir="ltr">{viewing.invoice.uuid}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PaymentsTab({ parties, toast }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [typeFilter, setTypeFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('pay_list', { params: { ...(typeFilter ? { pay_type: typeFilter } : {}) } }); setList(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [typeFilter, toast]);
    useEffect(() => { load(); }, [load]);

    const newPay = (pay_type) => setEditing({ pay_type, party_id: '', invoice_id: '', date: todayISO(), amount: '', method: 'cash', notes: '' });
    const partyOptions = useMemo(() => editing ? parties.filter(p => p.type === (editing.pay_type === 'receipt' ? 'customer' : 'supplier')) : [], [parties, editing]);

    const save = async () => {
        const f = editing;
        if (!(Number(f.amount) > 0)) return toast('أدخل مبلغًا صحيحًا', 'error');
        try {
            const r = await api('pay_save', { method: 'POST', body: {
                pay_type: f.pay_type, party_id: f.party_id || '', invoice_id: f.invoice_id || '',
                date: f.date, amount: Number(f.amount), method: f.method, notes: f.notes || '',
            }});
            if (r.success) { toast((r.message || 'تم') + (r.pay_no ? ' — ' + r.pay_no : '')); setEditing(null); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const voidPay = async (id) => {
        if (!window.confirm('إلغاء السند وعكس قيده؟')) return;
        try { const r = await api('pay_void', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); load(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Btn color="green" onClick={() => newPay('receipt')}><Plus size={15} /> سند قبض</Btn>
                    <Btn color="navy" onClick={() => newPay('payment')}><Plus size={15} /> سند صرف</Btn>
                    <Btn color="gray" size="sm" onClick={load}><RefreshCw size={14} /> تحديث</Btn>
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                    <option value="">الكل</option>
                    <option value="receipt">سندات قبض</option>
                    <option value="payment">سندات صرف</option>
                </select>
            </div>

            <Card>
                {loading ? <Spinner /> : list.length === 0 ? <Empty msg="لا توجد سندات" /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                <tr>
                                    <th className="px-3 py-3 text-right font-bold">الرقم</th>
                                    <th className="px-3 py-3 text-right font-bold">النوع</th>
                                    <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                                    <th className="px-3 py-3 text-right font-bold">الطرف</th>
                                    <th className="px-3 py-3 text-right font-bold">الفاتورة</th>
                                    <th className="px-3 py-3 text-left font-bold">المبلغ</th>
                                    <th className="px-3 py-3 text-center font-bold">إجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                {list.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 dark:bg-brand-800/30 dark:hover:bg-brand-800">
                                        <td className="px-3 py-3 font-mono font-bold text-brand-800 dark:text-brand-300">{p.pay_no}</td>
                                        <td className="px-3 py-3">{p.pay_type === 'receipt' ? <span className="text-emerald-600 font-bold">قبض</span> : <span className="text-brand-800 dark:text-brand-300 font-bold">صرف</span>}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-brand-400">{p.date}</td>
                                        <td className="px-3 py-3">{p.party_label || '—'}</td>
                                        <td className="px-3 py-3 font-mono text-slate-400 dark:text-brand-500">{p.invoice_no || '—'}</td>
                                        <td className="px-3 py-3 text-left font-bold">{money(p.amount)}</td>
                                        <td className="px-3 py-3 text-center">
                                            <button onClick={() => voidPay(p.id)} title="إلغاء" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><RotateCcw size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {editing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-md my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.pay_type === 'receipt' ? 'سند قبض' : 'سند صرف'}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{editing.pay_type === 'receipt' ? 'العميل' : 'المورد'}</label>
                                <PartyCombobox
                                    parties={partyOptions}
                                    value={editing.party_id}
                                    rawId
                                    onChange={v => setEditing(ed => ({ ...ed, party_id: v }))}
                                    placeholder={editing.pay_type === 'receipt' ? 'ابحث باسم العميل…' : 'ابحث باسم المورد…'}
                                    className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50 [&_input]:text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ</label>
                                    <input type="date" value={editing.date} onChange={e => setEditing(ed => ({ ...ed, date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">المبلغ</label>
                                    <input type="number" value={editing.amount} onChange={e => setEditing(ed => ({ ...ed, amount: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">طريقة الدفع</label>
                                    <select value={editing.method} onChange={e => setEditing(ed => ({ ...ed, method: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        <option value="cash">نقدًا (الصندوق)</option>
                                        <option value="bank">بنك</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">رقم الفاتورة (اختياري)</label>
                                    <input type="number" value={editing.invoice_id} onChange={e => setEditing(ed => ({ ...ed, invoice_id: e.target.value }))} placeholder="معرّف الفاتورة"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظات</label>
                                <input type="text" value={editing.notes} onChange={e => setEditing(ed => ({ ...ed, notes: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30">
                            <Btn color="gray" onClick={() => setEditing(null)}><X size={15} /> إلغاء</Btn>
                            <Btn color="green" onClick={save}><Save size={15} /> تسجيل وترحيل</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── تبويب: ملف المنشأة (يُستخدم في رمز QR للزكاة وفي الطباعة) ────────────────
const SETTINGS_FIELDS = [
    { k: 'company_name', label: 'الاسم القانوني للمنشأة', ph: 'سمك للمقاولات', req: true, col: 2 },
    { k: 'vat_number', label: 'الرقم الضريبي (15 رقمًا)', ph: '3xxxxxxxxxxxxx3', req: true, dir: 'ltr' },
    { k: 'cr_number', label: 'رقم السجل التجاري', ph: '1010xxxxxx', dir: 'ltr' },
    { k: 'address', label: 'العنوان (الشارع)', ph: 'شارع ...' },
    { k: 'district', label: 'الحي', ph: 'حي ...' },
    { k: 'city', label: 'المدينة', ph: 'الرياض' },
    { k: 'postal_code', label: 'الرمز البريدي', ph: '12345', dir: 'ltr' },
    { k: 'building_no', label: 'رقم المبنى', ph: '0000', dir: 'ltr' },
    { k: 'phone', label: 'الهاتف', ph: '05xxxxxxxx', dir: 'ltr' },
    { k: 'email', label: 'البريد الإلكتروني', ph: 'info@...', dir: 'ltr' },
];
function SettingsTab({ company, reload, toast }) {
    const [form, setForm] = useState(company || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { setForm(company || {}); }, [company]);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const save = async () => {
        if (!form.company_name) return toast('الاسم القانوني مطلوب', 'error');
        const vat = String(form.vat_number || '');
        if (vat && !/^\d{15}$/.test(vat)) return toast('الرقم الضريبي يجب أن يكون 15 رقمًا', 'error');
        setSaving(true);
        try {
            const settings = {};
            SETTINGS_FIELDS.forEach(f => { settings[f.k] = form[f.k] || ''; });
            const r = await api('gl_settings_save', { method: 'POST', body: { settings } });
            if (r.success) { toast(r.message || 'تم الحفظ'); reload && reload(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
    };
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-brand-800 flex items-center justify-center"><Building2 size={20} className="text-gold-500" /></div>
                <div>
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">ملف المنشأة</h3>
                    <p className="text-xs text-slate-500 dark:text-brand-400">يُستخدم في رمز QR للفواتير الضريبية وفي رأس الطباعة — أدخل البيانات الرسمية للمنشأة</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SETTINGS_FIELDS.map(f => (
                    <div key={f.k} className={f.col === 2 ? 'md:col-span-2' : ''}>
                        <label className="block text-xs font-bold text-slate-600 dark:text-brand-300 mb-1">{f.label}{f.req && <span className="text-red-500"> *</span>}</label>
                        <input value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph} dir={f.dir || 'rtl'}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-700 text-sm focus:border-[#c5a059] focus:ring-2 focus:ring-amber-100 outline-none dark:bg-brand-900 dark:text-brand-50 dark:placeholder-brand-500" />
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                <Btn color="green" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ ملف المنشأة'}</Btn>
            </div>
        </div>
    );
}

const TABS = [
    { id: 'chart', label: 'دليل الحسابات', icon: BookOpen },
    { id: 'journal', label: 'القيود اليومية', icon: FileText },
    { id: 'sales', label: 'فواتير البيع', icon: FileText },
    { id: 'purchases', label: 'فواتير الشراء', icon: FileText },
    { id: 'payments', label: 'سندات القبض/الصرف', icon: Wallet },
    { id: 'trial', label: 'ميزان المراجعة', icon: Scale },
    { id: 'income', label: 'قائمة الدخل', icon: TrendingUp },
    { id: 'balance', label: 'الميزانية العمومية', icon: PieChart },
    { id: 'ledger', label: 'كشف حساب', icon: FileBarChart2 },
    { id: 'vat', label: 'إقرار الضريبة', icon: Banknote },
    { id: 'parties', label: 'العملاء والموردون', icon: Users },
    { id: 'costcenters', label: 'مراكز التكلفة', icon: Layers },
    { id: 'settings', label: 'ملف المنشأة', icon: Settings },
];

export default function LedgerHub() {
    const { show: toast } = useToast();
    const [activeTab, setActiveTab] = useState('chart');

    // بيانات مشتركة
    const [accounts, setAccounts] = useState([]);
    const [accLoading, setAccLoading] = useState(false);
    const [parties, setParties] = useState([]);
    const [partyLoading, setPartyLoading] = useState(false);
    const [costCenters, setCostCenters] = useState([]);
    const [ccLoading, setCcLoading] = useState(false);
    const [company, setCompany] = useState({});
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
    const loadCompany = useCallback(async () => {
        try { const r = await api('gl_settings_get'); if (r.success) setCompany(r.settings || {}); }
        catch (e) { /* صامت — لا يعطّل الواجهة */ }
    }, []);

    useEffect(() => { loadAccounts(); loadParties(); loadCostCenters(); loadCompany(); }, [loadAccounts, loadParties, loadCostCenters, loadCompany]);

    // زرع دليل الحسابات إن كان فارغاً
    const seed = async () => {
        try { const r = await api('gl_seed'); if (r.success) { toast(r.message || 'تم'); loadAccounts(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
        setSeeded(true);
    };

    return (
        <div dir="rtl" className="space-y-6 p-4 md:p-6 font-cairo">

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
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 dark:border-brand-700 scrollbar-hide">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const active = activeTab === t.id;
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center gap-2 px-4 md:px-5 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                                    active ? 'border-[#c5a059] text-brand-800 dark:text-brand-100 bg-amber-50/50 dark:bg-brand-800/40' : 'border-transparent text-slate-500 dark:text-brand-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 hover:bg-slate-50 dark:hover:bg-brand-800'
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
                    {activeTab === 'sales' && <InvoicesTab docType="sales" parties={parties} accounts={accounts} company={company} toast={toast} />}
                    {activeTab === 'purchases' && <InvoicesTab docType="purchase" parties={parties} accounts={accounts} company={company} toast={toast} />}
                    {activeTab === 'payments' && <PaymentsTab parties={parties} accounts={accounts} toast={toast} />}
                    {activeTab === 'trial' && <TrialBalanceTab toast={toast} />}
                    {activeTab === 'income' && <IncomeTab toast={toast} />}
                    {activeTab === 'balance' && <BalanceSheetTab toast={toast} />}
                    {activeTab === 'ledger' && <LedgerTab accounts={accounts} toast={toast} />}
                    {activeTab === 'vat' && <VatTab toast={toast} />}
                    {activeTab === 'parties' && <PartiesTab parties={parties} reload={loadParties} loading={partyLoading} toast={toast} />}
                    {activeTab === 'costcenters' && <CostCentersTab costCenters={costCenters} reload={loadCostCenters} loading={ccLoading} toast={toast} />}
                    {activeTab === 'settings' && <SettingsTab company={company} reload={loadCompany} toast={toast} />}
                </div>
            </div>
        </div>
    );
}
