import React, { useState, useEffect, useCallback } from 'react';
import {
    Layers, RefreshCw, ChevronLeft, Building2, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
    ShoppingCart, Search, Calendar, FileText, Receipt
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const statusMap = {
    '1': { label: 'مفتوحة',      cls: 'bg-emerald-100 text-emerald-700' },
    '2': { label: 'قيد التنفيذ', cls: 'bg-blue-100    text-blue-700'    },
    '3': { label: 'مكتملة',      cls: 'bg-slate-200   text-slate-700'   },
    '4': { label: 'ملغاة',       cls: 'bg-red-100     text-red-700'     },
};

export default function WorkCycles() {
    const [workOrders, setWorkOrders] = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [selected,   setSelected]   = useState(null);
    const [search,     setSearch]     = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}?action=daftra_work_orders_all`).then(r => r.json());
            if (res.success) {
                setWorkOrders(res.data || []);
            } else {
                setError(res.message || 'فشل الاتصال بدفترة');
            }
        } catch {
            setError('خطأ في الاتصال بالسيرفر');
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = workOrders.filter(wo =>
        !search || (wo.title || '').toLowerCase().includes(search.toLowerCase())
    );

    if (selected) {
        return <CycleDetail wo={selected} onBack={() => setSelected(null)} />;
    }

    return (
        <div className="space-y-6 p-4 md:p-6">

            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <Layers size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">دورات العمل</h1>
                            <p className="text-sm text-slate-300 mt-1">دورات العمل من دفترة</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/work_orders" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> دفترة
                    </a>
                </div>
            </div>

            {/* شريط البحث */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                        type="text" placeholder="بحث باسم دورة العمل..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl outline-none focus:border-emerald-500"
                    />
                </div>
                <button onClick={load} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition" title="تحديث">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                </button>
                <span className="text-sm font-bold text-slate-500">{filtered.length} دورة</span>
            </div>

            {/* حالات التحميل / الخطأ / الفراغ */}
            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                    <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/>
                    جاري التحميل من دفترة...
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">
                    <AlertTriangle size={32} className="mx-auto mb-2"/>
                    <p className="font-bold">{error}</p>
                    <button onClick={load} className="mt-3 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-xl text-sm font-bold transition">
                        إعادة المحاولة
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-bold">لا توجد دورات عمل</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((wo, i) => (
                        <WOCard key={wo.id ?? i} wo={wo} onOpen={() => setSelected(wo)}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────── بطاقة دورة العمل ────────────────────────────────────────────

function WOCard({ wo, onOpen }) {
    const st = statusMap[String(wo.status)] || { label: wo.status || '—', cls: 'bg-slate-100 text-slate-600' };

    return (
        <div
            className="bg-white rounded-2xl shadow border border-slate-100 p-5 hover:shadow-md transition cursor-pointer"
            onClick={onOpen}
        >
            {/* رأس البطاقة */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 bg-[#1a365d] rounded-xl flex items-center justify-center">
                        <Building2 size={22} className="text-[#c5a059]"/>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-[#1a365d] truncate">
                            {wo.title || `دورة #${wo.number}`}
                        </h3>
                        {wo.number && <p className="text-xs text-slate-400 font-mono">#{wo.number}</p>}
                    </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${st.cls}`}>
                    {st.label}
                </span>
            </div>

            {/* التواريخ */}
            {(wo.start_date || wo.delivery_date) && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                    <Calendar size={11}/>
                    {wo.start_date && <span>بدء: {wo.start_date}</span>}
                    {wo.start_date && wo.delivery_date && <span className="mx-1">—</span>}
                    {wo.delivery_date && <span>تسليم: {wo.delivery_date}</span>}
                </div>
            )}

            {/* الميزانية إن وجدت */}
            {Number(wo.budget) > 0 && (
                <div className="text-xs text-slate-500 mb-3">
                    💰 الميزانية: <span className="font-bold text-[#1a365d]">{Number(wo.budget).toLocaleString('en-US')} ريال</span>
                </div>
            )}

            <div className="text-xs font-bold text-emerald-600 pt-3 border-t border-slate-100">
                عرض الملخص المالي ←
            </div>
        </div>
    );
}

// ─────────────── صفحة التفاصيل ───────────────────────────────────────────────

function CycleDetail({ wo, onBack }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    useEffect(() => {
        if (!wo?.id) { setLoading(false); return; }
        fetch(`${API_URL}?action=daftra_work_order_summary&id=${wo.id}`)
            .then(r => r.json())
            .then(j => {
                if (j.success && j.summary) {
                    // دمج القوائم داخل summary لسهولة الوصول
                    setSummary({
                        ...j.summary,
                        invoices:  j.invoices  || [],
                        purchases: j.purchases || [],
                        expenses:  j.expenses  || [],
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [wo?.id]);

    const st = statusMap[String(wo.status)] || { label: wo.status || '—', cls: 'bg-slate-100 text-slate-600' };

    return (
        <div className="space-y-6 p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-emerald-600 transition">
                <ChevronLeft size={18}/> رجوع لدورات العمل
            </button>

            {/* رأس الدورة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        {wo.number && <div className="text-xs font-mono text-slate-400 mb-1">دورة عمل #{wo.number}</div>}
                        <h2 className="text-2xl font-black mb-1">{wo.title || `دورة #${wo.number}`}</h2>
                        {wo.description && <p className="text-slate-300 text-sm mb-2">{wo.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                            {wo.start_date    && <span>📅 بدء: {wo.start_date}</span>}
                            {wo.delivery_date && <span>🏁 تسليم: {wo.delivery_date}</span>}
                        </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${st.cls}`}>{st.label}</span>
                </div>
            </div>

            {/* تحميل */}
            {loading && (
                <div className="bg-white rounded-2xl p-8 text-center">
                    <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/>
                    جاري جلب البيانات المالية من دفترة...
                </div>
            )}

            {/* الملخص المالي */}
            {!loading && summary && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <BigStat label="الإيرادات"  value={fmt(summary.total_revenue)}   icon={TrendingUp}   color="emerald"/>
                        <BigStat label="المشتريات"  value={fmt(summary.total_purchases)} icon={ShoppingCart} color="purple"/>
                        <BigStat label="المصروفات"  value={fmt(summary.total_expenses)}  icon={TrendingDown} color="red"/>
                        <BigStat label="صافي الربح" value={fmt(summary.net_profit)}      icon={DollarSign}
                            color={Number(summary.net_profit) >= 0 ? 'emerald' : 'red'}/>
                    </div>

                    {Number(summary.budget) > 0 && <BudgetBar summary={summary} fmt={fmt}/>}

                    {/* قائمة الفواتير */}
                    {summary.invoices?.length > 0 && (
                        <TransactionTable
                            title={`الفواتير (${summary.invoices.length})`}
                            icon={Receipt}
                            rows={summary.invoices}
                            cols={[
                                { key: 'no',     label: 'رقم' },
                                { key: 'date',   label: 'التاريخ' },
                                { key: 'client', label: 'العميل' },
                                { key: 'total',  label: 'الإجمالي', fmt },
                                { key: 'paid',   label: 'المدفوع',  fmt },
                            ]}
                        />
                    )}

                    {/* قائمة المشتريات */}
                    {summary.purchases?.length > 0 && (
                        <TransactionTable
                            title={`المشتريات (${summary.purchases.length})`}
                            icon={ShoppingCart}
                            rows={summary.purchases}
                            cols={[
                                { key: 'no',       label: 'رقم' },
                                { key: 'date',     label: 'التاريخ' },
                                { key: 'supplier', label: 'المورد' },
                                { key: 'total',    label: 'الإجمالي', fmt },
                            ]}
                        />
                    )}
                </>
            )}

            {/* لا يوجد بيانات */}
            {!loading && !summary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40"/>
                    <p className="font-bold">لا توجد معاملات مالية لهذه الدورة في دفترة بعد</p>
                </div>
            )}
        </div>
    );
}

// ─────────────── مكوّنات مساعدة ──────────────────────────────────────────────

function BigStat({ label, value, icon: Icon, color }) {
    const c = {
        slate:   'bg-slate-50   text-slate-700   border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue:    'bg-blue-50    text-blue-700    border-blue-200',
        purple:  'bg-purple-50  text-purple-700  border-purple-200',
        red:     'bg-red-50     text-red-700     border-red-200',
        gold:    'bg-amber-50   text-amber-700   border-amber-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${c[color] || c.slate}`}>
            {Icon && <Icon size={18} className="mb-1 opacity-70"/>}
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
}

function BudgetBar({ summary, fmt }) {
    const over = summary.budget_used_pct > 100;
    return (
        <div className={`rounded-2xl p-5 border ${over ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {over ? <AlertTriangle className="text-red-600"/> : <CheckCircle2 className="text-emerald-600"/>}
                    <h3 className={`font-black ${over ? 'text-red-900' : 'text-[#1a365d]'}`}>استهلاك الميزانية</h3>
                </div>
                <div className={`text-2xl font-black ${over ? 'text-red-700' : 'text-emerald-700'}`}>{summary.budget_used_pct}%</div>
            </div>
            <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                <div
                    className={`h-full transition-all ${over ? 'bg-gradient-to-l from-red-500 to-orange-500' : 'bg-gradient-to-l from-emerald-500 to-teal-500'}`}
                    style={{ width: `${Math.min(100, summary.budget_used_pct)}%` }}
                />
            </div>
            <div className="flex justify-between text-xs mt-2 font-bold">
                <span className="text-slate-600">استُهلك: {fmt(summary.total_cost)} ريال</span>
                <span className={summary.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {summary.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(summary.budget_left))} ريال
                </span>
            </div>
        </div>
    );
}

function TransactionTable({ title, icon: Icon, rows, cols }) {
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
                {Icon && <Icon size={16} className="text-slate-600"/>}
                <h3 className="font-black text-[#1a365d] text-sm">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                            {cols.map(c => <th key={c.key} className="px-3 py-2 font-bold">{c.label}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                {cols.map(c => (
                                    <td key={c.key} className="px-3 py-2 text-slate-700">
                                        {c.fmt ? c.fmt(row[c.key]) : (row[c.key] || '—')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
