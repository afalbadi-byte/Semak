import React, { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, FileText, Layers, Package, Wallet,
    RefreshCw, ChevronLeft, ChevronRight, AlertTriangle,
    Search, Calendar, DollarSign, Lock, Unlock, CheckCircle2,
    TrendingUp, TrendingDown, Loader2,
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

// ─── ترجمة أسماء الحقول الشائعة ─────────────────────────────────────────────
const FIELD_LABELS = {
    id: 'المعرف', name: 'الاسم', status: 'الحالة', type: 'النوع',
    code: 'الرمز', account_code: 'رمز الحساب', account_name: 'اسم الحساب',
    account_type: 'نوع الحساب', parent_id: 'الحساب الأب', parent: 'الأب',
    balance: 'الرصيد', debit: 'مدين', credit: 'دائن', currency: 'العملة',
    amount: 'المبلغ', total: 'الإجمالي', total_amount: 'المبلغ الإجمالي',
    journal_number: 'رقم القيد', journal_date: 'تاريخ القيد', reference: 'المرجع',
    description: 'الوصف', notes: 'ملاحظات', memo: 'مذكرة',
    cost_center: 'مركز التكلفة', cost_center_id: 'معرف مركز التكلفة',
    asset_name: 'اسم الأصل', asset_code: 'رمز الأصل', asset_type: 'نوع الأصل',
    purchase_date: 'تاريخ الشراء', purchase_cost: 'تكلفة الشراء',
    depreciation: 'الإهلاك', depreciation_rate: 'نسبة الإهلاك',
    book_value: 'القيمة الدفترية', salvage_value: 'القيمة المتبقية',
    employee_id: 'معرف الموظف', employee_name: 'اسم الموظف',
    custody_amount: 'مبلغ العهدة', custody_date: 'تاريخ العهدة',
    settled_amount: 'المبلغ المسوّى', remaining: 'المتبقي',
    start_date: 'تاريخ البداية', end_date: 'تاريخ النهاية',
    due_date: 'تاريخ الاستحقاق', created_at: 'تاريخ الإنشاء', updated_at: 'آخر تحديث',
    number: 'الرقم', date: 'التاريخ', active: 'نشط',
    phone: 'الهاتف', email: 'البريد الإلكتروني',
};

function translateKey(k) {
    return FIELD_LABELS[k] || k;
}

// ─── أداة عرض القيمة ─────────────────────────────────────────────────────────
function FieldDisplay({ fieldKey, value }) {
    if (fieldKey === '__typename' || fieldKey === '__v') return null;

    if (value === null || value === undefined || value === '') {
        return <span className="text-slate-300 dark:text-brand-600 italic text-xs">—</span>;
    }

    if (Array.isArray(value)) {
        return <span className="text-slate-500 dark:text-brand-400 text-xs">[{value.length} عنصر]</span>;
    }
    if (typeof value === 'object') {
        const s = JSON.stringify(value);
        return (
            <span className="text-slate-500 dark:text-brand-400 text-xs font-mono">
                {s.slice(0, 60)}{s.length > 60 ? '…' : ''}
            </span>
        );
    }

    const str = String(value);

    // تنسيق التواريخ
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        if (!isNaN(d)) {
            return (
                <span className="inline-flex items-center gap-1 text-brand-800 dark:text-brand-300 font-medium text-sm">
                    <Calendar size={12} className="text-gold-500" />
                    {d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            );
        }
    }

    // تنسيق الأرقام الكبيرة كعملة
    const num = parseFloat(str);
    if (!isNaN(num) && num > 100 && /^-?\d+(\.\d+)?$/.test(str.trim())) {
        return (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-sm">
                <DollarSign size={11} />
                {num.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-500 dark:text-brand-400">ريال</span>
            </span>
        );
    }

    if (str.length > 60) {
        return <span title={str} className="text-slate-700 dark:text-brand-300 text-sm">{str.slice(0, 60)}…</span>;
    }

    return <span className="text-slate-700 dark:text-brand-300 text-sm">{str}</span>;
}

// ─── شارة الحالة ─────────────────────────────────────────────────────────────
function StatusBadge({ value }) {
    if (value === null || value === undefined || value === '') return null;
    const v = String(value).toLowerCase();

    if (v === 'active' || v === 'نشط' || v === '1' || v === 'posted' || v === 'مرحّل' || v === 'open' || v === 'مفتوح') {
        return (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                {value}
            </span>
        );
    }
    if (v === 'inactive' || v === 'غير نشط' || v === '0' || v === 'false' || v === 'closed' || v === 'مغلق') {
        return (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 dark:bg-brand-800 dark:text-brand-400 dark:border-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {value}
            </span>
        );
    }
    if (v === 'draft' || v === 'مسودة' || v === 'pending' || v === 'معلّق') {
        return (
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                {value}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
            {value}
        </span>
    );
}

// ─── مكوّن الترقيم ───────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPrev, onNext }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-100 dark:border-brand-700">
            <button
                onClick={onPrev}
                disabled={page <= 1}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 hover:bg-brand-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
                <ChevronRight size={16} /> السابق
            </button>
            <span className="text-sm font-bold text-slate-500 dark:text-brand-400">
                صفحة <span className="text-brand-800 dark:text-brand-300 font-black">{page}</span> من {totalPages}
            </span>
            <button
                onClick={onNext}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 hover:bg-brand-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
                التالي <ChevronLeft size={16} />
            </button>
        </div>
    );
}

// ─── حالة فارغة ──────────────────────────────────────────────────────────────
function EmptyState({ message = 'لا توجد بيانات' }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-brand-500">
            <Package size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-bold">{message}</p>
            <p className="text-sm mt-1">تحقق من اتصال API أو أضف بيانات في دفترة</p>
        </div>
    );
}

// ─── حالة تحميل ──────────────────────────────────────────────────────────────
function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-brand-800 dark:text-brand-300">
            <RefreshCw size={36} className="animate-spin mb-4 opacity-60" />
            <p className="text-sm font-bold text-slate-500 dark:text-brand-400">جاري التحميل من دفترة…</p>
        </div>
    );
}

// ─── حالة خطأ ────────────────────────────────────────────────────────────────
function ErrorState({ error, httpCode }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-red-600">
            <AlertTriangle size={40} className="mb-3 opacity-70" />
            <p className="font-bold text-lg">فشل تحميل البيانات</p>
            <p className="text-sm mt-1 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2 font-mono">{error}</p>
            {httpCode !== null && httpCode !== undefined && (
                <p className="text-xs mt-2 text-slate-500 dark:text-brand-400 font-mono">
                    رمز الاستجابة: <span className="font-bold text-red-700">HTTP {httpCode}</span>
                </p>
            )}
        </div>
    );
}

// ─── استدعاء API العام مع ترقيم ──────────────────────────────────────────────
async function fetchResource(resource, page = 1, extra = {}) {
    const params = new URLSearchParams({
        action: 'daftra_generic_get',
        resource,
        page: String(page),
        ...extra,
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    let json = null;
    try {
        json = await res.json();
    } catch {
        throw new Error(`HTTP ${res.status}: استجابة غير صالحة`);
    }
    return { json, httpStatus: res.status };
}

// ─── استخراج أكثر المفاتيح شيوعاً من صفوف البيانات ──────────────────────────
function getTopKeys(rows, topN = 6) {
    const freq = {};
    rows.slice(0, 50).forEach(row => {
        Object.keys(row).forEach(k => {
            if (k === '__typename' || k === '__v') return;
            freq[k] = (freq[k] || 0) + 1;
        });
    });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([k]) => k);
}

// ─── ترتيب الأعمدة مع تفضيل حقول معيّنة إن وُجدت ────────────────────────────
function buildColumns(rows, highlightKeys = [], topN = 7) {
    if (rows.length === 0) return [];
    const firstRow = rows[0] || {};
    const allKeys = getTopKeys(rows, topN);
    return Array.from(new Set([
        ...highlightKeys.filter(k => k in firstRow),
        ...allKeys,
    ])).slice(0, topN);
}

// ─── زر التحديث ──────────────────────────────────────────────────────────────
function RefreshBtn({ loading, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 bg-brand-800 text-white hover:bg-brand-900 px-4 py-2 rounded-xl text-sm font-bold transition shadow"
            title="تحديث"
        >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
        </button>
    );
}

// ─── صف جدول قابل للتوسيع ───────────────────────────────────────────────────
function ExpandableRow({ row, columns, highlightKeys = [] }) {
    const [open, setOpen] = useState(false);
    const allEntries = Object.entries(row).filter(([k]) => k !== '__typename' && k !== '__v');

    return (
        <>
            <tr
                onClick={() => setOpen(!open)}
                className="hover:bg-slate-50/70 dark:hover:bg-brand-800 cursor-pointer border-b border-slate-100 dark:border-brand-700 transition"
            >
                {columns.map(col => (
                    <td
                        key={col}
                        className={`px-3 py-2.5 text-right text-sm ${highlightKeys.includes(col) ? 'font-bold' : ''}`}
                    >
                        {col === 'status' || /status|حالة/.test(col)
                            ? <StatusBadge value={row[col]} />
                            : <FieldDisplay fieldKey={col} value={row[col]} />
                        }
                    </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                    <span className="text-gold-500 text-xs font-bold select-none">
                        {open ? '▲' : '▼'}
                    </span>
                </td>
            </tr>
            {open && (
                <tr className="bg-slate-50/60 dark:bg-brand-800/40">
                    <td colSpan={columns.length + 1} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                            {allEntries.map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2 text-xs border-b border-slate-100 dark:border-brand-700 pb-1">
                                    <span className="font-bold text-slate-400 dark:text-brand-500 shrink-0 w-32 truncate font-mono">{translateKey(k)}</span>
                                    <span className="flex-1">
                                        {k === 'status'
                                            ? <StatusBadge value={v} />
                                            : <FieldDisplay fieldKey={k} value={v} />
                                        }
                                    </span>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── جدول بيانات عام قابل للتوسيع ───────────────────────────────────────────
function DataTable({ rows, columns, highlightKeys }) {
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                        <tr>
                            {columns.map(col => (
                                <th key={col} className="px-3 py-3 font-bold whitespace-nowrap">
                                    {translateKey(col)}
                                </th>
                            ))}
                            <th className="px-3 py-3 text-center w-12">تفاصيل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <ExpandableRow
                                key={row.id || i}
                                row={row}
                                columns={columns}
                                highlightKeys={highlightKeys}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── خطّاف عام لتحميل المورد مع الترقيم والفلاتر ─────────────────────────────
function useResource(resource, { showToast, extraParams } = {}) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [httpCode, setHttpCode] = useState(null);

    const load = useCallback(async (p = 1, extra = {}) => {
        setLoading(true);
        setError(null);
        try {
            const { json, httpStatus } = await fetchResource(resource, p, { ...(extraParams || {}), ...extra });
            setHttpCode(json?.http_code ?? httpStatus);
            if (json && json.success) {
                setData(json);
                setPage(p);
            } else {
                const msg = (json && json.message) || 'فشل استجابة API';
                setError(msg);
                if (showToast) showToast('خطأ', msg, 'error');
            }
        } catch (e) {
            setError(e.message);
            setHttpCode(null);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [resource, extraParams, showToast]);

    return { page, setPage, data, loading, error, httpCode, load };
}

// ─── شريط فلتر التواريخ ──────────────────────────────────────────────────────
function DateFilterBar({ from, to, setFrom, setTo, onApply }) {
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">من تاريخ</label>
                <div className="relative">
                    <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="date"
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        className="bg-slate-50 border border-slate-200 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">إلى تاريخ</label>
                <div className="relative">
                    <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="date"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        className="bg-slate-50 border border-slate-200 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500"
                    />
                </div>
            </div>
            <button
                onClick={onApply}
                className="flex items-center gap-2 bg-gold-500 text-white hover:bg-[#b08c45] px-4 py-2 rounded-xl text-sm font-bold transition"
            >
                <Search size={14} /> تطبيق
            </button>
        </div>
    );
}

// ─── شريط بحث محلي ───────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }) {
    return (
        <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500"
            />
        </div>
    );
}

function localFilter(rows, search) {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1: دليل الحسابات
// ══════════════════════════════════════════════════════════════════════════════
function TabJournalAccounts({ showToast }) {
    const { page, data, loading, error, httpCode, load } = useResource('journal_accounts', { showToast });
    const [search, setSearch] = useState('');

    useEffect(() => { load(1); }, [load]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;
    const filtered = localFilter(rows, search);

    const HIGHLIGHT = ['code', 'account_code', 'account_name', 'name', 'account_type', 'balance', 'status'];
    const columns = buildColumns(filtered, HIGHLIGHT, 6);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="بحث في دليل الحسابات…" />
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} حساب</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} httpCode={httpCode} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد حسابات" /> : (
                <>
                    <DataTable rows={filtered} columns={columns} highlightKeys={HIGHLIGHT} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => load(Math.max(1, page - 1))}
                        onNext={() => load(Math.min(totalPages, page + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2: القيود اليومية (مع فلتر التواريخ)
// ══════════════════════════════════════════════════════════════════════════════
function TabJournals({ showToast }) {
    const { page, data, loading, error, httpCode, load } = useResource('journals', { showToast });
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const buildExtra = useCallback(() => {
        const extra = {};
        if (from) extra.from = from;
        if (to) extra.to = to;
        return extra;
    }, [from, to]);

    useEffect(() => { load(1); }, [load]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;
    const filtered = localFilter(rows, search);

    const HIGHLIGHT = ['journal_number', 'number', 'journal_date', 'date', 'reference', 'total_amount', 'amount', 'status'];
    const columns = buildColumns(filtered, HIGHLIGHT, 7);

    return (
        <div className="space-y-4">
            <DateFilterBar
                from={from} to={to} setFrom={setFrom} setTo={setTo}
                onApply={() => load(1, buildExtra())}
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="بحث في القيود…" />
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} قيد</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page, buildExtra())} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} httpCode={httpCode} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد قيود يومية" /> : (
                <>
                    <DataTable rows={filtered} columns={columns} highlightKeys={HIGHLIGHT} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => load(Math.max(1, page - 1), buildExtra())}
                        onNext={() => load(Math.min(totalPages, page + 1), buildExtra())}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3: مراكز التكلفة
// ══════════════════════════════════════════════════════════════════════════════
function TabCostCenters({ showToast }) {
    const { page, data, loading, error, httpCode, load } = useResource('cost_centers', { showToast });
    const [search, setSearch] = useState('');

    useEffect(() => { load(1); }, [load]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;
    const filtered = localFilter(rows, search);

    const HIGHLIGHT = ['code', 'name', 'type', 'balance', 'status'];
    const columns = buildColumns(filtered, HIGHLIGHT, 6);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="بحث في مراكز التكلفة…" />
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} مركز</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} httpCode={httpCode} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد مراكز تكلفة" /> : (
                <>
                    <DataTable rows={filtered} columns={columns} highlightKeys={HIGHLIGHT} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => load(Math.max(1, page - 1))}
                        onNext={() => load(Math.min(totalPages, page + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 4: الأصول الثابتة
// ══════════════════════════════════════════════════════════════════════════════
function TabAssets({ showToast }) {
    const { page, data, loading, error, httpCode, load } = useResource('assets', { showToast });
    const [search, setSearch] = useState('');

    useEffect(() => { load(1); }, [load]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;
    const filtered = localFilter(rows, search);

    const HIGHLIGHT = ['asset_code', 'code', 'asset_name', 'name', 'asset_type', 'purchase_cost', 'book_value', 'status'];
    const columns = buildColumns(filtered, HIGHLIGHT, 7);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="بحث في الأصول الثابتة…" />
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} أصل</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} httpCode={httpCode} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد أصول ثابتة" /> : (
                <>
                    <DataTable rows={filtered} columns={columns} highlightKeys={HIGHLIGHT} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => load(Math.max(1, page - 1))}
                        onNext={() => load(Math.min(totalPages, page + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 5: عُهَد الموظفين
// ══════════════════════════════════════════════════════════════════════════════
function TabEmployeeCustody({ showToast }) {
    const { page, data, loading, error, httpCode, load } = useResource('employee_custody', { showToast });
    const [search, setSearch] = useState('');

    useEffect(() => { load(1); }, [load]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;
    const filtered = localFilter(rows, search);

    const HIGHLIGHT = ['employee_name', 'employee_id', 'custody_amount', 'amount', 'custody_date', 'remaining', 'status'];
    const columns = buildColumns(filtered, HIGHLIGHT, 7);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="بحث في العُهَد…" />
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} عهدة</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} httpCode={httpCode} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد عُهَد موظفين" /> : (
                <>
                    <DataTable rows={filtered} columns={columns} highlightKeys={HIGHLIGHT} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => load(Math.max(1, page - 1))}
                        onNext={() => load(Math.min(totalPages, page + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 6: إقفال السنة المالية
// ══════════════════════════════════════════════════════════════════════════════
const SAR = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ﷼';
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i);

function TabFiscalClose() {
    const [fy, setFy]           = useState(THIS_YEAR);
    const [preview, setPreview] = useState(null);
    const [period, setPeriod]   = useState(null);   // { is_closed, closed_at, closed_by }
    const [loading, setLoading] = useState(false);
    const [busy, setBusy]       = useState(false);
    const [msg, setMsg]         = useState(null);   // { text, ok }
    const [confirm, setConfirm] = useState(null);   // 'close' | 'reopen'

    const fetchPreview = useCallback(async (year) => {
        setLoading(true); setPreview(null); setPeriod(null); setMsg(null);
        try {
            const [isRes, perRes] = await Promise.all([
                fetch(`${API_URL}?action=gl_income_statement&tenant=1&from=${year}-01-01&to=${year}-12-31`),
                fetch(`${API_URL}?action=gl_entries&tenant=1&limit=1&from=${year}-01-01&to=${year}-01-01`)
                    .then(() => fetch(`${API_URL}?action=gl_income_statement&tenant=1&from=${year}-01-01&to=${year}-01-01`)),
            ]);
            const isData = await isRes.json();
            if (isData.success) setPreview(isData);

            // استعلام مباشر عن حالة الفترة
            const perData = await fetch(`${API_URL}?action=gl_periods_status&tenant=1&fy=${year}`).then(r => r.json()).catch(() => null);
            if (perData?.success) setPeriod(perData.period);
            else setPeriod(null);
        } catch { /* تجاهل */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchPreview(fy); }, [fy, fetchPreview]);

    const doClose = async () => {
        setBusy(true); setMsg(null); setConfirm(null);
        try {
            const res = await fetch(`${API_URL}?action=gl_close_year`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: 1, fy }),
            });
            const d = await res.json();
            setMsg({ text: d.message, ok: d.success });
            if (d.success) fetchPreview(fy);
        } catch { setMsg({ text: 'خطأ في الاتصال', ok: false }); }
        finally { setBusy(false); }
    };

    const doReopen = async () => {
        setBusy(true); setMsg(null); setConfirm(null);
        try {
            const res = await fetch(`${API_URL}?action=gl_reopen_year`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: 1, fy }),
            });
            const d = await res.json();
            setMsg({ text: d.message, ok: d.success });
            if (d.success) fetchPreview(fy);
        } catch { setMsg({ text: 'خطأ في الاتصال', ok: false }); }
        finally { setBusy(false); }
    };

    const net = preview ? (preview.totals?.net ?? 0) : 0;
    const isClosed = period?.is_closed == 1;

    return (
        <div className="space-y-5 max-w-2xl">
            {/* اختيار السنة */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 p-5 shadow-sm">
                <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-brand-400" /> اختر السنة المالية
                </h3>
                <div className="flex gap-2 flex-wrap">
                    {YEAR_OPTS.map(y => (
                        <button key={y} onClick={() => setFy(y)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${fy === y ? 'bg-brand-800 text-white border-brand-800' : 'border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-brand-500'}`}>
                            {y}
                        </button>
                    ))}
                </div>
            </div>

            {/* معاينة قائمة الدخل */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 p-5 shadow-sm">
                <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-brand-400" /> معاينة قائمة الدخل — {fy}
                </h3>
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 dark:text-brand-500 text-sm py-4">
                        <Loader2 size={16} className="animate-spin" /> جارٍ التحميل…
                    </div>
                ) : preview ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20">
                            <span className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2"><TrendingUp size={15} /> إجمالي الإيرادات</span>
                            <span className="font-black text-green-800 dark:text-green-300">{SAR(preview.totals?.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                            <span className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2"><TrendingDown size={15} /> إجمالي المصروفات</span>
                            <span className="font-black text-red-800 dark:text-red-300">{SAR(preview.totals?.expenses)}</span>
                        </div>
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${net >= 0 ? 'bg-brand-50 dark:bg-brand-800/40 border-brand-200 dark:border-brand-700' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'}`}>
                            <span className={`text-sm font-bold flex items-center gap-2 ${net >= 0 ? 'text-brand-700 dark:text-brand-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                {net >= 0 ? '📈 صافي الربح' : '📉 صافي الخسارة'}
                            </span>
                            <span className={`font-black text-lg ${net >= 0 ? 'text-brand-800 dark:text-brand-100' : 'text-amber-800 dark:text-amber-200'}`}>{SAR(Math.abs(net))}</span>
                        </div>
                        {/* حسابات تفصيلية */}
                        {(preview.revenue?.length > 0 || preview.expenses?.length > 0) && (
                            <details className="text-xs text-slate-500 dark:text-brand-400 mt-1">
                                <summary className="cursor-pointer font-bold hover:text-brand-600 dark:hover:text-brand-300">عرض التفاصيل ({(preview.revenue?.length || 0) + (preview.expenses?.length || 0)} حساب)</summary>
                                <div className="mt-2 space-y-1 pr-2 border-r border-slate-200 dark:border-brand-700">
                                    {preview.revenue?.map(r => <div key={r.id} className="flex justify-between"><span>{r.name}</span><span className="text-green-600">{SAR(r.amount)}</span></div>)}
                                    {preview.expenses?.map(e => <div key={e.id} className="flex justify-between"><span>{e.name}</span><span className="text-red-500">({SAR(e.amount)})</span></div>)}
                                </div>
                            </details>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 dark:text-brand-500">لا توجد حركات مُرحَّلة في {fy}</p>
                )}
            </div>

            {/* حالة الفترة + أزرار الإجراء */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                        {isClosed
                            ? <><Lock size={16} className="text-red-500" /> السنة {fy} مقفلة</>
                            : <><Unlock size={16} className="text-green-500" /> السنة {fy} مفتوحة</>}
                    </h3>
                    {isClosed && period?.closed_at && (
                        <span className="text-xs text-slate-400 dark:text-brand-500">
                            {period.closed_at?.slice(0, 10)} · {period.closed_by || '—'}
                        </span>
                    )}
                </div>

                {/* رسالة النتيجة */}
                {msg && (
                    <div className={`mb-4 flex items-start gap-2 p-3 rounded-xl text-sm font-bold ${msg.ok ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20'}`}>
                        {msg.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                        {msg.text}
                    </div>
                )}

                {/* تأكيد */}
                {confirm === 'close' && (
                    <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3">
                            <AlertTriangle size={14} className="inline ml-1" />
                            سيتم إنشاء قيد إقفال بتاريخ {fy}-12-31 وقفل الفترة. هذا الإجراء يمكن عكسه.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={doClose} disabled={busy}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2">
                                {busy && <Loader2 size={14} className="animate-spin" />} تأكيد الإقفال
                            </button>
                            <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:border-brand-500 transition">إلغاء</button>
                        </div>
                    </div>
                )}
                {confirm === 'reopen' && (
                    <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3">
                            <AlertTriangle size={14} className="inline ml-1" />
                            سيتم حذف قيد الإقفال وإعادة فتح السنة {fy}. هذا الإجراء للتصحيح فقط.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={doReopen} disabled={busy}
                                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition flex items-center gap-2">
                                {busy && <Loader2 size={14} className="animate-spin" />} تأكيد إعادة الفتح
                            </button>
                            <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:border-brand-500 transition">إلغاء</button>
                        </div>
                    </div>
                )}

                {!confirm && (
                    <div className="flex gap-3">
                        {!isClosed && (
                            <button onClick={() => setConfirm('close')} disabled={busy || loading || !preview}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-800 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition">
                                <Lock size={15} /> إقفال السنة {fy}
                            </button>
                        )}
                        {isClosed && (
                            <button onClick={() => setConfirm('reopen')} disabled={busy}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-amber-400 text-amber-700 dark:text-amber-300 text-sm font-bold hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50 transition">
                                <Unlock size={15} /> إعادة فتح السنة {fy}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'journal_accounts', label: 'دليل الحسابات', icon: BookOpen, component: TabJournalAccounts },
    { id: 'journals',         label: 'القيود اليومية', icon: FileText, component: TabJournals },
    { id: 'cost_centers',     label: 'مراكز التكلفة',   icon: Layers,   component: TabCostCenters },
    { id: 'assets',           label: 'الأصول الثابتة',  icon: Package,  component: TabAssets },
    { id: 'employee_custody', label: 'عُهَد الموظفين',  icon: Wallet,   component: TabEmployeeCustody },
    { id: 'fiscal_close',     label: 'إقفال السنة',     icon: Lock,     component: TabFiscalClose },
];

export default function AccountingHub({ showToast }) {
    const [activeTab, setActiveTab] = useState('journal_accounts');
    const [initialized, setInitialized] = useState({ journal_accounts: true });

    const handleTabClick = (id) => {
        setActiveTab(id);
        setInitialized(prev => ({ ...prev, [id]: true }));
    };

    const ActiveComponent = TABS.find(t => t.id === activeTab)?.component;

    return (
        <div dir="rtl" className="space-y-6 p-4 md:p-6 font-cairo">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                        <BookOpen size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black">المحاسبة</h1>
                        <p className="text-sm text-slate-300 mt-1">دليل الحسابات · القيود · مراكز التكلفة · الأصول · العُهَد — من دفترة</p>
                    </div>
                </div>
            </div>

            {/* شريط التبويبات */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 dark:border-brand-700 scrollbar-hide">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={`flex items-center gap-2 px-4 md:px-6 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                                    isActive
                                        ? 'border-[#c5a059] text-brand-800 dark:text-brand-100 bg-amber-50/50 dark:bg-brand-800/40'
                                        : 'border-transparent text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 hover:bg-slate-50 dark:hover:bg-brand-800'
                                }`}
                            >
                                <Icon size={16} className={isActive ? 'text-gold-500' : ''} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 md:p-6">
                    {initialized[activeTab] && ActiveComponent ? (
                        <ActiveComponent key={activeTab} showToast={showToast} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
