import React, { useState, useEffect, useCallback } from 'react';
import {
    Home, Calendar, DollarSign, FileText, Package,
    RefreshCw, ChevronLeft, ChevronRight, AlertTriangle,
    Building, Key, User, CheckCircle2, Clock, Search,
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

// ─── ترجمة أسماء الحقول الشائعة ─────────────────────────────────────────────
const FIELD_LABELS = {
    id: 'المعرف', name: 'الاسم', status: 'الحالة', type: 'النوع',
    unit_number: 'رقم الوحدة', unit_id: 'معرف الوحدة', unit_name: 'اسم الوحدة',
    floor: 'الطابق', building: 'المبنى', project: 'المشروع', project_id: 'معرف المشروع',
    area: 'المساحة', price: 'السعر', rent_price: 'سعر الإيجار', monthly_rent: 'الإيجار الشهري',
    annual_rent: 'الإيجار السنوي', total_amount: 'المبلغ الإجمالي', amount: 'المبلغ',
    paid_amount: 'المدفوع', remaining_amount: 'المتبقي', due_amount: 'المستحق',
    client_id: 'معرف العميل', client_name: 'اسم العميل', client: 'العميل',
    tenant_name: 'اسم المستأجر', tenant_id: 'معرف المستأجر',
    contract_id: 'معرف العقد', contract_number: 'رقم العقد',
    start_date: 'تاريخ البداية', end_date: 'تاريخ النهاية',
    due_date: 'تاريخ الاستحقاق', payment_date: 'تاريخ الدفع',
    created_at: 'تاريخ الإنشاء', updated_at: 'آخر تحديث',
    notes: 'ملاحظات', description: 'الوصف',
    installment_number: 'رقم القسط', installment_amount: 'مبلغ القسط',
    delivery_date: 'تاريخ التسليم', handover_date: 'تاريخ الاستلام',
    number: 'الرقم', reference: 'المرجع', currency: 'العملة',
    active: 'نشط', available: 'متاح', occupied: 'مشغول',
    bedrooms: 'غرف النوم', bathrooms: 'دورات المياه', rooms: 'الغرف',
    phone: 'الهاتف', email: 'البريد الإلكتروني',
};

function translateKey(k) {
    return FIELD_LABELS[k] || k;
}

// ─── أداة عرض القيمة ─────────────────────────────────────────────────────────
function FieldDisplay({ fieldKey, value }) {
    // تخطي الحقول الداخلية
    if (
        fieldKey === '__typename' ||
        fieldKey === '__v' ||
        fieldKey === '_id' ||
        (typeof value === 'object' && value !== null && !Array.isArray(value))
    ) {
        if (typeof value === 'object' && value !== null) {
            return (
                <span className="text-slate-400 dark:text-brand-400 italic text-xs">
                    {JSON.stringify(value)}
                </span>
            );
        }
        if (fieldKey === '__typename' || fieldKey === '__v') return null;
    }

    if (value === null || value === undefined || value === '') {
        return <span className="text-slate-300 dark:text-brand-600 italic text-xs">—</span>;
    }

    // كائنات/مصفوفات
    if (Array.isArray(value)) {
        return <span className="text-slate-500 dark:text-brand-400 text-xs">[{value.length} عنصر]</span>;
    }
    if (typeof value === 'object') {
        return (
            <span className="text-slate-500 dark:text-brand-400 text-xs font-mono">
                {JSON.stringify(value).slice(0, 60)}
                {JSON.stringify(value).length > 60 ? '…' : ''}
            </span>
        );
    }

    const str = String(value);

    // تنسيق التواريخ
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        if (!isNaN(d)) {
            return (
                <span className="inline-flex items-center gap-1 text-brand-800 dark:text-brand-100 font-medium text-sm">
                    <Calendar size={12} className="text-gold-500" />
                    {d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            );
        }
    }

    // تنسيق الأرقام الكبيرة كعملة
    const num = parseFloat(str);
    if (!isNaN(num) && num > 100 && /^\d+(\.\d+)?$/.test(str.trim())) {
        return (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <DollarSign size={11} />
                {num.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-500 dark:text-brand-400">ريال</span>
            </span>
        );
    }

    // قص النصوص الطويلة
    if (str.length > 60) {
        return <span title={str} className="text-slate-700 dark:text-brand-300 text-sm">{str.slice(0, 60)}…</span>;
    }

    return <span className="text-slate-700 dark:text-brand-300 text-sm">{str}</span>;
}

// ─── شارة الحالة ─────────────────────────────────────────────────────────────
function StatusBadge({ value }) {
    if (!value) return null;
    const v = String(value).toLowerCase();

    // الإيجار / الوحدات
    if (v === 'available' || v === 'متاح' || v === '1' || v === 'active' || v === 'نشط') {
        return (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} /> {value}
            </span>
        );
    }
    if (v === 'occupied' || v === 'مشغول' || v === 'rented' || v === 'مؤجر') {
        return (
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                <Key size={10} /> {value}
            </span>
        );
    }
    if (v === 'inactive' || v === 'غير نشط' || v === '0' || v === 'false') {
        return (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 dark:bg-brand-800 dark:text-brand-400 dark:border-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
                <Clock size={10} /> {value}
            </span>
        );
    }
    // الأقساط
    if (v === 'paid' || v === 'مدفوع') {
        return (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} /> مدفوع
            </span>
        );
    }
    if (v === 'unpaid' || v === 'غير مدفوع') {
        return (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> غير مدفوع
            </span>
        );
    }
    if (v === 'overdue' || v === 'متأخر') {
        return (
            <span className="inline-flex items-center gap-1 bg-red-900/10 text-red-800 border border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> متأخر
            </span>
        );
    }
    // افتراضي
    return (
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
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
                صفحة <span className="text-brand-800 dark:text-brand-100 font-black">{page}</span> من {totalPages}
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
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-brand-400">
            <Package size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-bold">{message}</p>
            <p className="text-sm mt-1">تحقق من اتصال API أو أضف بيانات في دفترة</p>
        </div>
    );
}

// ─── حالة تحميل ──────────────────────────────────────────────────────────────
function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-brand-800 dark:text-brand-100">
            <RefreshCw size={36} className="animate-spin mb-4 opacity-60" />
            <p className="text-sm font-bold text-slate-500 dark:text-brand-400">جاري التحميل من دفترة…</p>
        </div>
    );
}

// ─── حالة خطأ ────────────────────────────────────────────────────────────────
function ErrorState({ error }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-red-600 dark:text-red-300">
            <AlertTriangle size={40} className="mb-3 opacity-70" />
            <p className="font-bold text-lg">فشل تحميل البيانات</p>
            <p className="text-sm mt-1 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-2 font-mono">{error}</p>
        </div>
    );
}

// ─── استدعاء API مع ترقيم ────────────────────────────────────────────────────
async function fetchPage(action, page = 1, extra = {}) {
    const params = new URLSearchParams({ action, page: String(page), ...extra });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const json = await res.json();
    return json;
}

// ─── استخراج أول 6 مفاتيح شائعة من صفوف البيانات ───────────────────────────
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

// ─── بطاقة وحدة (Tab 1) ──────────────────────────────────────────────────────
function UnitCard({ unit }) {
    const [expanded, setExpanded] = useState(false);
    const entries = Object.entries(unit).filter(([k]) => k !== '__typename' && k !== '__v');
    const preview = entries.slice(0, 6);
    const rest = entries.slice(6);
    const statusVal = unit.status ?? unit.is_available ?? unit.active ?? null;

    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
            {/* رأس البطاقة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center shrink-0">
                    <Building size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm truncate">
                        {unit.unit_number || unit.name || unit.number || `وحدة #${unit.id || '—'}`}
                    </p>
                    <p className="text-slate-300 text-xs truncate">
                        {unit.project || unit.building || unit.type || ''}
                    </p>
                </div>
                {statusVal !== null && <StatusBadge value={statusVal} />}
            </div>

            {/* الحقول */}
            <div className="p-4 flex-1 space-y-2">
                {preview.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 text-xs">
                        <span className="font-bold text-slate-500 dark:text-brand-400 shrink-0 w-28 truncate">{translateKey(k)}</span>
                        <span className="flex-1"><FieldDisplay fieldKey={k} value={v} /></span>
                    </div>
                ))}
                {rest.length > 0 && (
                    <>
                        {expanded && rest.map(([k, v]) => (
                            <div key={k} className="flex items-start gap-2 text-xs">
                                <span className="font-bold text-slate-500 dark:text-brand-400 shrink-0 w-28 truncate">{translateKey(k)}</span>
                                <span className="flex-1"><FieldDisplay fieldKey={k} value={v} /></span>
                            </div>
                        ))}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-[10px] font-bold text-gold-500 hover:underline mt-1"
                        >
                            {expanded ? '▲ إخفاء' : `▼ ${rest.length} حقول إضافية`}
                        </button>
                    </>
                )}
            </div>
        </div>
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
                        {col === 'status' || highlightKeys.includes(col) && /status|حالة/.test(col)
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
                                    <span className="font-bold text-slate-400 dark:text-brand-400 shrink-0 w-32 truncate font-mono">{translateKey(k)}</span>
                                    <span className="flex-1"><FieldDisplay fieldKey={k} value={v} /></span>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
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

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1: الوحدات
// ══════════════════════════════════════════════════════════════════════════════
function TabUnits({ showToast }) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchPage('daftra_rental_units', p);
            if (json.success) {
                setData(json);
            } else {
                setError(json.message || 'فشل استجابة API');
                if (showToast) showToast('خطأ', json.message || 'فشل تحميل الوحدات', 'error');
            }
        } catch (e) {
            setError(e.message);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(page); }, [page]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-sm text-slate-500 dark:text-brand-400">
                        {data ? `${meta.total || rows.length} وحدة إجمالاً` : ''}
                    </p>
                </div>
                <RefreshBtn loading={loading} onClick={() => load(page)} />
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} /> :
             rows.length === 0 ? <EmptyState message="لا توجد وحدات إيجارية" /> : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rows.map((unit, i) => <UnitCard key={unit.id || i} unit={unit} />)}
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => setPage(p => Math.max(1, p - 1))}
                        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2: أوامر الحجز
// ══════════════════════════════════════════════════════════════════════════════
function TabReservations({ showToast }) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const load = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchPage('daftra_reservation_orders', p);
            if (json.success) {
                setData(json);
            } else {
                setError(json.message || 'فشل استجابة API');
                if (showToast) showToast('خطأ', json.message || 'فشل تحميل أوامر الحجز', 'error');
            }
        } catch (e) {
            setError(e.message);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(page); }, [page]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;

    const columns = rows.length > 0 ? getTopKeys(rows, 6) : [];

    const filtered = search
        ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : rows;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" />
                    <input
                        type="text"
                        placeholder="بحث في أوامر الحجز…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} أمر</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد أوامر حجز" /> : (
                <>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-brand-800 text-white text-xs">
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
                                    {filtered.map((row, i) => (
                                        <ExpandableRow
                                            key={row.id || i}
                                            row={row}
                                            columns={columns}
                                            highlightKeys={['status', 'amount', 'total_amount']}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => setPage(p => Math.max(1, p - 1))}
                        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3: عقود الإيجار
// ══════════════════════════════════════════════════════════════════════════════
function TabLeaseContracts({ showToast }) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const load = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchPage('daftra_lease_contracts', p);
            if (json.success) {
                setData(json);
            } else {
                setError(json.message || 'فشل استجابة API');
                if (showToast) showToast('خطأ', json.message || 'فشل تحميل العقود', 'error');
            }
        } catch (e) {
            setError(e.message);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(page); }, [page]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;

    // الحقول المميزة للعقود
    const HIGHLIGHT_KEYS = ['client_name', 'tenant_name', 'start_date', 'end_date', 'total_amount', 'status'];
    const allKeys = rows.length > 0 ? getTopKeys(rows, 6) : [];
    // نحاول نضم الحقول المميزة إن وُجدت في البيانات
    const firstRow = rows[0] || {};
    const columns = Array.from(new Set([
        ...HIGHLIGHT_KEYS.filter(k => k in firstRow),
        ...allKeys,
    ])).slice(0, 7);

    const filtered = search
        ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : rows;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" />
                    <input
                        type="text"
                        placeholder="بحث في العقود…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} عقد</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد عقود إيجار" /> : (
                <>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-brand-800 text-white text-xs">
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
                                    {filtered.map((row, i) => (
                                        <ExpandableRow
                                            key={row.id || i}
                                            row={row}
                                            columns={columns}
                                            highlightKeys={HIGHLIGHT_KEYS}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => setPage(p => Math.max(1, p - 1))}
                        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                    />
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 4: الأقساط
// ══════════════════════════════════════════════════════════════════════════════
const INSTALLMENT_STATUSES = [
    { value: '', label: 'جميع الأقساط' },
    { value: 'paid', label: 'مدفوع' },
    { value: 'unpaid', label: 'غير مدفوع' },
    { value: 'overdue', label: 'متأخر' },
];

function InstallmentStatusBadge({ status }) {
    if (!status) return null;
    const v = String(status).toLowerCase();
    if (v === 'paid' || v === 'مدفوع') {
        return (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                <CheckCircle2 size={11} /> مدفوع
            </span>
        );
    }
    if (v === 'overdue' || v === 'متأخر') {
        return (
            <span className="inline-flex items-center gap-1 bg-red-900/10 text-red-800 border border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                <AlertTriangle size={11} /> متأخر
            </span>
        );
    }
    // unpaid or other
    return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
            <Clock size={11} /> غير مدفوع
        </span>
    );
}

function TabInstallments({ showToast }) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [contractId, setContractId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        setError(null);
        try {
            const extra = {};
            if (contractId.trim()) extra.contract_id = contractId.trim();
            if (statusFilter) extra.status = statusFilter;
            const json = await fetchPage('daftra_contract_installments', p, extra);
            if (json.success) {
                setData(json);
                setPage(p);
            } else {
                setError(json.message || 'فشل استجابة API');
                if (showToast) showToast('خطأ', json.message || 'فشل تحميل الأقساط', 'error');
            }
        } catch (e) {
            setError(e.message);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [contractId, statusFilter]);

    // تحميل تلقائي عند أول فتح
    useEffect(() => { load(1); }, []);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;

    const HIGHLIGHT_KEYS = ['installment_amount', 'amount', 'due_date', 'status', 'contract_id'];
    const allKeys = rows.length > 0 ? getTopKeys(rows, 8) : [];
    const firstRow = rows[0] || {};
    const columns = Array.from(new Set([
        ...HIGHLIGHT_KEYS.filter(k => k in firstRow),
        ...allKeys,
    ])).slice(0, 8);

    const filtered = search
        ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : rows;

    // ملخص مالي
    const totalAmount = filtered.reduce((s, r) => s + parseFloat(r.installment_amount || r.amount || 0), 0);
    const paidAmount = filtered.filter(r => String(r.status || '').toLowerCase().includes('paid') || r.status === 'مدفوع')
        .reduce((s, r) => s + parseFloat(r.installment_amount || r.amount || 0), 0);

    return (
        <div className="space-y-4">
            {/* فلاتر البحث */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">رقم العقد</label>
                    <div className="relative">
                        <Key size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" />
                        <input
                            type="text"
                            placeholder="أدخل رقم العقد…"
                            value={contractId}
                            onChange={e => setContractId(e.target.value)}
                            className="bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500 w-44"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">حالة القسط</label>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500"
                    >
                        {INSTALLMENT_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">بحث</label>
                    <div className="relative">
                        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" />
                        <input
                            type="text"
                            placeholder="بحث في الأقساط…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500"
                        />
                    </div>
                </div>
                <button
                    onClick={() => load(1)}
                    className="flex items-center gap-2 bg-gold-500 text-white hover:bg-[#b08c45] px-4 py-2 rounded-xl text-sm font-bold transition"
                >
                    <Search size={14} /> بحث
                </button>
                <RefreshBtn loading={loading} onClick={() => load(page)} />
            </div>

            {/* بطاقات الملخص */}
            {filtered.length > 0 && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-brand-800/5 dark:bg-brand-800/40 border border-brand-800/20 dark:border-brand-700 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-brand-400">عدد الأقساط</p>
                        <p className="text-xl font-black text-brand-800 dark:text-brand-100">{filtered.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-brand-400">الإجمالي</p>
                        <p className="text-xl font-black text-slate-700 dark:text-brand-300">
                            {totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            <span className="text-xs font-normal mr-1">ريال</span>
                        </p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-brand-400">المدفوع</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                            {paidAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            <span className="text-xs font-normal mr-1">ريال</span>
                        </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-brand-400">المتبقي</p>
                        <p className="text-xl font-black text-red-600 dark:text-red-300">
                            {(totalAmount - paidAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            <span className="text-xs font-normal mr-1">ريال</span>
                        </p>
                    </div>
                </div>
            )}

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد أقساط للعرض" /> : (
                <>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-brand-800 text-white text-xs">
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
                                    {filtered.map((row, i) => (
                                        <InstallmentRow
                                            key={row.id || i}
                                            row={row}
                                            columns={columns}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
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

function InstallmentRow({ row, columns }) {
    const [open, setOpen] = useState(false);
    const allEntries = Object.entries(row).filter(([k]) => k !== '__typename' && k !== '__v');
    const statusVal = row.status;

    return (
        <>
            <tr
                onClick={() => setOpen(!open)}
                className="hover:bg-slate-50/70 dark:hover:bg-brand-800 cursor-pointer border-b border-slate-100 dark:border-brand-700 transition"
            >
                {columns.map(col => {
                    if (col === 'status') {
                        return (
                            <td key={col} className="px-3 py-2.5 text-right">
                                <InstallmentStatusBadge status={row[col]} />
                            </td>
                        );
                    }
                    const isHighlight = ['installment_amount', 'amount', 'due_date'].includes(col);
                    return (
                        <td key={col} className={`px-3 py-2.5 text-right ${isHighlight ? 'font-bold' : ''}`}>
                            <FieldDisplay fieldKey={col} value={row[col]} />
                        </td>
                    );
                })}
                <td className="px-3 py-2.5 text-center">
                    <span className="text-gold-500 text-xs font-bold select-none">{open ? '▲' : '▼'}</span>
                </td>
            </tr>
            {open && (
                <tr className="bg-slate-50/60 dark:bg-brand-800/40">
                    <td colSpan={columns.length + 1} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                            {allEntries.map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2 text-xs border-b border-slate-100 dark:border-brand-700 pb-1">
                                    <span className="font-bold text-slate-400 dark:text-brand-400 shrink-0 w-32 truncate font-mono">{translateKey(k)}</span>
                                    <span className="flex-1">
                                        {k === 'status'
                                            ? <InstallmentStatusBadge status={v} />
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

// ══════════════════════════════════════════════════════════════════════════════
// Tab 5: تسليم الوحدات
// ══════════════════════════════════════════════════════════════════════════════
function TabUnitDelivery({ showToast }) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    const load = useCallback(async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchPage('daftra_unit_delivery', p);
            if (json.success) {
                setData(json);
            } else {
                setError(json.message || 'فشل استجابة API');
                if (showToast) showToast('خطأ', json.message || 'فشل تحميل تسليم الوحدات', 'error');
            }
        } catch (e) {
            setError(e.message);
            if (showToast) showToast('خطأ', e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(page); }, [page]);

    const rows = data?.data || [];
    const meta = data?.meta || {};
    const totalPages = meta.last_page || meta.total_pages || 1;

    const columns = rows.length > 0 ? getTopKeys(rows, 6) : [];

    const filtered = search
        ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : rows;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" />
                        <input
                            type="text"
                            placeholder="بحث في سجلات التسليم…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-gold-500"
                        />
                    </div>
                    {/* تبديل العرض */}
                    <div className="flex items-center bg-slate-100 dark:bg-brand-800 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${viewMode === 'cards' ? 'bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 shadow' : 'text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100'}`}
                        >
                            بطاقات
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${viewMode === 'table' ? 'bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 shadow' : 'text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100'}`}
                        >
                            جدول
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {data && <span className="text-sm text-slate-500 dark:text-brand-400">{meta.total || rows.length} سجل</span>}
                    <RefreshBtn loading={loading} onClick={() => load(page)} />
                </div>
            </div>

            {loading ? <LoadingState /> :
             error ? <ErrorState error={error} /> :
             filtered.length === 0 ? <EmptyState message="لا توجد سجلات تسليم وحدات" /> : (
                <>
                    {viewMode === 'cards' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map((item, i) => (
                                <DeliveryCard key={item.id || i} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-brand-800 text-white text-xs">
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
                                        {filtered.map((row, i) => (
                                            <ExpandableRow
                                                key={row.id || i}
                                                row={row}
                                                columns={columns}
                                                highlightKeys={['status', 'delivery_date', 'handover_date']}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPrev={() => setPage(p => Math.max(1, p - 1))}
                        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                    />
                </>
            )}
        </div>
    );
}

function DeliveryCard({ item }) {
    const [expanded, setExpanded] = useState(false);
    const entries = Object.entries(item).filter(([k]) => k !== '__typename' && k !== '__v');
    const preview = entries.slice(0, 6);
    const rest = entries.slice(6);
    const statusVal = item.status ?? null;

    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
            {/* رأس البطاقة */}
            <div className="bg-gradient-to-l from-[#c5a059] to-[#b08c45] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <Key size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm truncate">
                        {item.unit_name || item.unit_number || item.name || `تسليم #${item.id || '—'}`}
                    </p>
                    <p className="text-white/70 text-xs truncate">
                        {item.tenant_name || item.client_name || item.client || ''}
                    </p>
                </div>
                {statusVal !== null && <StatusBadge value={statusVal} />}
            </div>

            {/* الحقول */}
            <div className="p-4 flex-1 space-y-2">
                {preview.map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 text-xs">
                        <span className="font-bold text-slate-500 dark:text-brand-400 shrink-0 w-28 truncate">{translateKey(k)}</span>
                        <span className="flex-1"><FieldDisplay fieldKey={k} value={v} /></span>
                    </div>
                ))}
                {rest.length > 0 && (
                    <>
                        {expanded && rest.map(([k, v]) => (
                            <div key={k} className="flex items-start gap-2 text-xs">
                                <span className="font-bold text-slate-500 dark:text-brand-400 shrink-0 w-28 truncate">{translateKey(k)}</span>
                                <span className="flex-1"><FieldDisplay fieldKey={k} value={v} /></span>
                            </div>
                        ))}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-[10px] font-bold text-gold-500 hover:underline mt-1"
                        >
                            {expanded ? '▲ إخفاء' : `▼ ${rest.length} حقول إضافية`}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'units',         label: 'الوحدات',           icon: Home,      component: TabUnits },
    { id: 'reservations',  label: 'أوامر الحجز',        icon: Calendar,  component: TabReservations },
    { id: 'contracts',     label: 'عقود الإيجار',       icon: FileText,  component: TabLeaseContracts },
    { id: 'installments',  label: 'الأقساط',            icon: DollarSign,component: TabInstallments },
    { id: 'delivery',      label: 'تسليم الوحدات',      icon: Package,   component: TabUnitDelivery },
];

export default function RentalsManage({ showToast }) {
    const [activeTab, setActiveTab] = useState('units');
    const [initialized, setInitialized] = useState({ units: false });

    const handleTabClick = (id) => {
        setActiveTab(id);
        setInitialized(prev => ({ ...prev, [id]: true }));
    };

    // تعيين التبويب الأول كمُهيأ مسبقاً
    useEffect(() => {
        setInitialized({ units: true });
    }, []);

    const ActiveComponent = TABS.find(t => t.id === activeTab)?.component;

    return (
        <div dir="rtl" className="space-y-6 p-4 md:p-6 font-cairo">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 bg-gold-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                        <Building size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black">إدارة الإيجارات</h1>
                        <p className="text-sm text-slate-300 mt-1">الوحدات · الحجوزات · العقود · الأقساط · التسليم — من دفترة</p>
                    </div>
                </div>
            </div>

            {/* شريط التبويبات */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
                {/* تبويبات الهيدر */}
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
                                        ? 'border-gold-500 text-brand-800 dark:text-brand-100 bg-amber-50/50 dark:bg-brand-800/40'
                                        : 'border-transparent text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 hover:bg-slate-50 dark:hover:bg-brand-800'
                                }`}
                            >
                                <Icon size={16} className={isActive ? 'text-gold-500' : ''} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* محتوى التبويب */}
                <div className="p-4 md:p-6">
                    {initialized[activeTab] && ActiveComponent ? (
                        <ActiveComponent key={activeTab} showToast={showToast} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
