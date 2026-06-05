import React, { useState, useEffect, useMemo } from 'react';
import {
    Database, RefreshCw, Search, Eye, X, ExternalLink, Receipt, FileText,
    ShoppingCart, Users, Truck, Package, FolderTree, Building, Wallet,
    TrendingDown, UserCog, Percent, Filter, ArrowRight, Calendar, DollarSign, Layers
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

const MODULES = [
    { id: 'invoices',           label: 'الفواتير الصادرة',  icon: Receipt,      color: 'blue' },
    { id: 'estimates',          label: 'عروض الأسعار',      icon: FileText,     color: 'indigo' },
    { id: 'purchase_invoices',  label: 'فواتير الشراء',     icon: ShoppingCart, color: 'purple' },
    { id: 'clients',            label: 'العملاء',           icon: Users,        color: 'teal' },
    { id: 'suppliers',          label: 'الموردين',          icon: Truck,        color: 'amber' },
    { id: 'products',           label: 'المنتجات',          icon: Package,      color: 'cyan' },
    { id: 'product_categories', label: 'تصنيفات المنتجات',  icon: FolderTree,   color: 'sky' },
    { id: 'stores',             label: 'المخازن',           icon: Building,     color: 'slate' },
    { id: 'treasuries',         label: 'الخزائن',           icon: Wallet,       color: 'emerald' },
    { id: 'expenses',           label: 'المصروفات',         icon: TrendingDown, color: 'red' },
    { id: 'staff',              label: 'الموظفين',          icon: UserCog,      color: 'rose' },
    { id: 'taxes',              label: 'الضرائب',           icon: Percent,      color: 'orange' },
    { id: 'work_orders',        label: 'دورات العمل',       icon: Layers,       color: 'indigo' },
];

const KEY_FIELDS = {
    invoices: ['no', 'date', 'client_business_name', 'summary_total', 'summary_paid', 'summary_unpaid', 'payment_status'],
    estimates: ['no', 'date', 'client_business_name', 'summary_total'],
    purchase_invoices: ['no', 'date', 'supplier_business_name', 'summary_total', 'summary_paid', 'summary_unpaid'],
    clients: ['client_number', 'business_name', 'first_name', 'last_name', 'email', 'phone1', 'phone2', 'city'],
    suppliers: ['supplier_number', 'business_name', 'first_name', 'last_name', 'email', 'phone1', 'phone2'],
    products: ['name', 'unit_price', 'default_quantity', 'brand', 'category', 'description'],
    product_categories: ['name', 'description', 'category_type', 'display_order'],
    stores: ['name', 'shipping_address', 'primary', 'active'],
    treasuries: ['name', 'type_name', 'currency_code', 'balance', 'is_primary', 'active'],
    expenses: ['date', 'amount', 'currency_code', 'category', 'vendor', 'note'],
    staff: ['code', 'name', 'last_name', 'mobile', 'business_Phone', 'type'],
    taxes: ['name', 'value', 'description', 'is_active'],
    work_orders: ['number', 'title', 'start_date', 'delivery_date', 'budget', 'budget_currency', 'status'],
};

// أي الوحدات تدعم التنقل لتفاصيل المورد/العميل
const DRILL_LINKS = {
    suppliers: { target: 'purchase_invoices', filterField: 'supplier_id', matchField: 'id', label: 'فواتير الشراء' },
    clients:   { target: 'invoices',          filterField: 'client_id',   matchField: 'id', label: 'الفواتير الصادرة' },
};

export default function DaftraExplorer() {
    const [activeModule, setActiveModule] = useState('invoices');
    const [data, setData] = useState({});
    const [loading, setLoading] = useState({});
    const [search, setSearch] = useState('');
    const [selectedRow, setSelectedRow] = useState(null);
    const [detail, setDetail] = useState(null);     // بيانات السجل المفصّلة من API
    const [detailLoading, setDetailLoading] = useState(false);

    // فلاتر متقدّمة
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo,   setFilterDateTo]   = useState('');
    const [filterMinAmount, setFilterMinAmount] = useState('');
    const [filterMaxAmount, setFilterMaxAmount] = useState('');
    const [filterRef, setFilterRef] = useState(null);   // {field, value, label} للتصفية بالـ supplier_id/client_id من drill-down

    const loadModule = async (mod) => {
        if (data[mod]) return;
        setLoading(prev => ({ ...prev, [mod]: true }));
        try {
            const res = await fetch(`${API_URL}?action=daftra_list&module=${mod}`);
            const json = await res.json();
            if (json.success) setData(prev => ({ ...prev, [mod]: json }));
        } finally {
            setLoading(prev => ({ ...prev, [mod]: false }));
        }
    };
    useEffect(() => { loadModule(activeModule); }, [activeModule]);

    const reload = () => {
        setData(prev => { const n={...prev}; delete n[activeModule]; return n; });
        loadModule(activeModule);
    };

    const clearFilters = () => {
        setSearch('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterMinAmount('');
        setFilterMaxAmount('');
        setFilterRef(null);
    };

    // الانتقال لتفاصيل سجل (drill down)
    const drillToRelated = (sourceRow, link) => {
        const value = sourceRow[link.matchField];
        const label = sourceRow.business_name || sourceRow.name || `#${value}`;
        setActiveModule(link.target);
        clearFilters();
        setFilterRef({ field: link.filterField, value: String(value), label, sourceLabel: link.label });
    };

    // فتح نافذة التفاصيل
    const openDetails = async (row, module) => {
        setSelectedRow(row);
        setDetail(null);
        // الوحدات اللي عندها تفاصيل (فواتير → أصناف)
        const detailable = ['invoices','estimates','purchase_invoices'];
        if (detailable.includes(module) && row.id) {
            setDetailLoading(true);
            try {
                const res = await fetch(`${API_URL}?action=daftra_view&module=${module}&id=${row.id}`);
                const json = await res.json();
                setDetail(json);
            } finally {
                setDetailLoading(false);
            }
        }
    };

    const fmt = (v) => {
        if (v === null || v === undefined || v === '') return '—';
        if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
        if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 100) {
            return parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
        }
        if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
        return String(v);
    };

    const moduleConfig = MODULES.find(m => m.id === activeModule);
    const moduleData = data[activeModule];
    const rows = moduleData?.data || [];
    const fields = KEY_FIELDS[activeModule] || (rows[0] ? Object.keys(rows[0]).slice(0, 6) : []);

    // الفلترة المركّبة
    const filtered = useMemo(() => {
        return rows.filter(r => {
            // بحث نصي
            if (search && !Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) return false;
            // مرجع (drill-down)
            if (filterRef && String(r[filterRef.field]) !== filterRef.value) return false;
            // فترة تاريخ
            const dateField = r.date || r.created;
            if (filterDateFrom && dateField && dateField < filterDateFrom) return false;
            if (filterDateTo   && dateField && dateField > filterDateTo)   return false;
            // قيمة
            const amountField = parseFloat(r.summary_total || r.amount || r.unit_price || r.balance || 0);
            if (filterMinAmount && amountField < parseFloat(filterMinAmount)) return false;
            if (filterMaxAmount && amountField > parseFloat(filterMaxAmount)) return false;
            return true;
        });
    }, [rows, search, filterRef, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount]);

    // المجاميع للقيم المالية
    const totals = useMemo(() => {
        let total = 0, paid = 0, unpaid = 0;
        filtered.forEach(r => {
            total  += parseFloat(r.summary_total  || r.amount || 0);
            paid   += parseFloat(r.summary_paid   || 0);
            unpaid += parseFloat(r.summary_unpaid || 0);
        });
        return { total, paid, unpaid };
    }, [filtered]);

    const drillLink = DRILL_LINKS[activeModule];
    const showFinanceFilters = ['invoices','estimates','purchase_invoices','expenses'].includes(activeModule);

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gold-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Database size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">مستكشف دفترة الشامل</h1>
                            <p className="text-sm text-slate-300 mt-1">كل البيانات من سماك الخير في مكان واحد</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> فتح دفترة
                    </a>
                </div>
            </div>

            {/* شبكة الوحدات */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 md:gap-3">
                {MODULES.map(m => (
                    <ModuleCard key={m.id}
                        active={activeModule === m.id}
                        count={data[m.id]?.count}
                        loading={loading[m.id]}
                        module={m}
                        onClick={() => { setActiveModule(m.id); clearFilters(); }}
                        onPrefetch={() => loadModule(m.id)}
                    />
                ))}
            </div>

            {/* شريط الفلاتر */}
            {filterRef && (
                <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 flex items-center gap-2 flex-wrap text-sm">
                    <Filter size={14} className="text-amber-700 dark:text-amber-300"/>
                    <span className="font-bold text-amber-900 dark:text-amber-300">يعرض: {filterRef.sourceLabel} لـ <span className="bg-white dark:bg-brand-900 px-2 py-0.5 rounded font-mono dark:text-brand-300">{filterRef.label}</span></span>
                    <button onClick={() => setFilterRef(null)} className="bg-white text-amber-700 hover:bg-amber-100 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                        <X size={12}/> إزالة
                    </button>
                </div>
            )}

            {/* البطاقات الإجمالية للوحدات المالية */}
            {showFinanceFilters && filtered.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SumCard label="عدد السجلات" value={filtered.length} color="slate"/>
                    <SumCard label="الإجمالي" value={fmt(totals.total)} color="blue" suffix="ريال"/>
                    {(activeModule === 'invoices' || activeModule === 'purchase_invoices') && (
                        <>
                            <SumCard label="المسدد" value={fmt(totals.paid)} color="emerald" suffix="ريال"/>
                            <SumCard label="المستحق" value={fmt(totals.unpaid)} color="red" suffix="ريال"/>
                        </>
                    )}
                </div>
            )}

            {/* محتوى الوحدة */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 dark:border-brand-700">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <div className="flex items-center gap-3">
                            {moduleConfig && <moduleConfig.icon size={24} className={`text-${moduleConfig.color}-600`}/>}
                            <h3 className="text-lg md:text-xl font-black text-brand-800 dark:text-brand-100">
                                {moduleConfig?.label}
                                {moduleData && <span className="text-sm font-bold text-slate-500 dark:text-brand-400 mr-2">({filtered.length} / {moduleData.count})</span>}
                            </h3>
                        </div>
                        <button onClick={reload} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 p-2 rounded-xl transition" title="تحديث">
                            <RefreshCw size={16} className={loading[activeModule] ? 'animate-spin' : ''}/>
                        </button>
                    </div>

                    {/* الفلاتر */}
                    <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[180px]">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-brand-400 block mb-1">بحث في كل الحقول</label>
                            <div className="relative">
                                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"/>
                                <input type="text" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 dark:text-brand-50 dark:placeholder-brand-500"/>
                            </div>
                        </div>
                        {showFinanceFilters && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-brand-400 block mb-1">من تاريخ</label>
                                    <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}
                                        className="bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-3 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 dark:text-brand-50"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-brand-400 block mb-1">إلى تاريخ</label>
                                    <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}
                                        className="bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-3 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 dark:text-brand-50"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-brand-400 block mb-1">أقل قيمة</label>
                                    <input type="number" placeholder="0" value={filterMinAmount} onChange={e=>setFilterMinAmount(e.target.value)}
                                        className="w-24 bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-3 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 dark:text-brand-50"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-brand-400 block mb-1">أعلى قيمة</label>
                                    <input type="number" placeholder="∞" value={filterMaxAmount} onChange={e=>setFilterMaxAmount(e.target.value)}
                                        className="w-24 bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-3 py-2 rounded-xl text-sm outline-none focus:border-emerald-500 dark:text-brand-50"/>
                                </div>
                            </>
                        )}
                        {(search || filterRef || filterDateFrom || filterDateTo || filterMinAmount || filterMaxAmount) && (
                            <button onClick={clearFilters} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1">
                                <X size={14}/> مسح الفلاتر
                            </button>
                        )}
                    </div>
                </div>

                {loading[activeModule] ? (
                    <div className="p-12 text-center text-slate-400 dark:text-brand-400">
                        <RefreshCw className="animate-spin inline mr-2"/> جاري التحميل من دفترة...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-brand-400">لا توجد سجلات مطابقة</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs uppercase">
                                <tr>
                                    {fields.map(f => (<th key={f} className="px-3 py-2 font-bold whitespace-nowrap">{translateField(f)}</th>))}
                                    {drillLink && <th className="px-3 py-2 text-center">{drillLink.label}</th>}
                                    <th className="px-3 py-2 text-center w-16">تفاصيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-brand-700">
                                {filtered.slice(0, 300).map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-brand-800">
                                        {fields.map(f => (
                                            <td key={f} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-brand-300">{fmt(row[f])}</td>
                                        ))}
                                        {drillLink && (
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={()=>drillToRelated(row, drillLink)}
                                                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1 mx-auto">
                                                    عرض <ArrowRight size={12}/>
                                                </button>
                                            </td>
                                        )}
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={()=>openDetails(row, activeModule)} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg">
                                                <Eye size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length > 300 && (
                            <div className="p-3 text-center text-xs text-slate-500 dark:text-brand-400 bg-slate-50 dark:bg-brand-800/40 border-t dark:border-brand-700">
                                عرض أول 300 من {filtered.length} سجل — ضيّق بالفلاتر
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* نافذة التفاصيل */}
            {selectedRow && (
                <DetailModal
                    row={selectedRow}
                    detail={detail}
                    detailLoading={detailLoading}
                    module={activeModule}
                    onClose={() => { setSelectedRow(null); setDetail(null); }}
                />
            )}
        </div>
    );
}

function DetailModal({ row, detail, detailLoading, module, onClose }) {
    const isInvoice = ['invoices','estimates','purchase_invoices'].includes(module);
    const items = detail?.data?.[0]?.InvoiceItem
        || detail?.data?.[0]?.PurchaseOrderItem
        || detail?.data?.[0]?.EstimateItem
        || detail?.InvoiceItem
        || detail?.PurchaseOrderItem
        || detail?.EstimateItem
        || [];
    const itemsArray = Array.isArray(items) ? items : (items ? [items] : []);

    const fmt = (v) => v === null || v === undefined || v === '' ? '—' :
        typeof v === 'number' || /^\d+(\.\d+)?$/.test(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-brand-900 border-b border-slate-200 dark:border-brand-700 p-4 flex justify-between items-center z-10">
                    <h3 className="font-black text-brand-800 dark:text-brand-100">
                        {isInvoice ? `تفاصيل ${row.no ? '#' + row.no : 'الفاتورة'}` : 'تفاصيل السجل'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 dark:text-brand-400 hover:text-red-500"><X size={20}/></button>
                </div>

                {/* ملخص رأس الفاتورة */}
                {isInvoice && (
                    <div className="p-4 bg-gradient-to-l from-slate-50 dark:from-brand-800/40 to-blue-50 dark:to-blue-500/10 border-b border-slate-200 dark:border-brand-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div><div className="text-[10px] font-bold text-slate-500 dark:text-brand-400">رقم</div><div className="font-black text-brand-800 dark:text-brand-100">{row.no || '—'}</div></div>
                            <div><div className="text-[10px] font-bold text-slate-500 dark:text-brand-400">التاريخ</div><div className="font-bold dark:text-brand-100">{row.date || '—'}</div></div>
                            <div><div className="text-[10px] font-bold text-slate-500 dark:text-brand-400">{module === 'purchase_invoices' ? 'المورد' : 'العميل'}</div>
                                <div className="font-bold dark:text-brand-100">{row.supplier_business_name || row.client_business_name || '—'}</div></div>
                            <div><div className="text-[10px] font-bold text-slate-500 dark:text-brand-400">الإجمالي</div>
                                <div className="font-black text-emerald-700 dark:text-emerald-300">{fmt(row.summary_total)} <span className="text-xs">ريال</span></div></div>
                        </div>
                    </div>
                )}

                {/* الأصناف */}
                {isInvoice && (
                    <div className="p-4 border-b border-slate-100 dark:border-brand-700">
                        <h4 className="font-bold text-brand-800 dark:text-brand-100 mb-2 flex items-center gap-2"><Package size={16}/> الأصناف</h4>
                        {detailLoading ? (
                            <div className="py-6 text-center text-slate-400 dark:text-brand-400"><RefreshCw className="animate-spin inline mr-2"/> جاري جلب الأصناف...</div>
                        ) : itemsArray.length === 0 ? (
                            <p className="text-slate-400 dark:text-brand-400 text-sm py-3">لا توجد أصناف</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-2">الصنف</th>
                                            <th className="px-3 py-2">الوصف</th>
                                            <th className="px-3 py-2 text-center">الكمية</th>
                                            <th className="px-3 py-2 text-center">سعر الوحدة</th>
                                            <th className="px-3 py-2 text-center">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-brand-700">
                                        {itemsArray.map((it, idx) => {
                                            const item = it.InvoiceItem || it.PurchaseOrderItem || it.EstimateItem || it;
                                            const qty   = parseFloat(item.quantity || 0);
                                            const price = parseFloat(item.unit_price || 0);
                                            const total = parseFloat(item.subtotal || item.summary_subtotal || (qty * price));
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-brand-800">
                                                    <td className="px-3 py-2 font-bold dark:text-brand-100">{item.name || '—'}</td>
                                                    <td className="px-3 py-2 text-slate-600 dark:text-brand-300 text-xs">{item.description || '—'}</td>
                                                    <td className="px-3 py-2 text-center font-bold dark:text-brand-300">{fmt(qty)}</td>
                                                    <td className="px-3 py-2 text-center dark:text-brand-300">{fmt(price)}</td>
                                                    <td className="px-3 py-2 text-center font-black text-emerald-700 dark:text-emerald-300">{fmt(total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* كل الحقول */}
                <details className="border-b border-slate-100 dark:border-brand-700">
                    <summary className="p-4 cursor-pointer font-bold text-slate-700 dark:text-brand-300 hover:bg-slate-50 dark:hover:bg-brand-800/40 select-none">
                        كل الحقول الخام
                    </summary>
                    <div className="p-4 bg-slate-50 dark:bg-brand-800/40 space-y-1">
                        {Object.entries(row).map(([k, v]) => (
                            <div key={k} className="flex flex-col md:flex-row md:items-center gap-1 py-1 border-b border-slate-200 dark:border-brand-700 last:border-0">
                                <div className="md:w-1/3 text-xs font-bold text-slate-500 dark:text-brand-400 font-mono">{k}</div>
                                <div className="md:w-2/3 text-sm text-slate-800 dark:text-brand-300 break-all">
                                    {v === null ? <em className="text-slate-300 dark:text-brand-500">null</em>
                                     : typeof v === 'object' ? <pre className="text-xs bg-white dark:bg-brand-900 dark:text-brand-300 p-2 rounded">{JSON.stringify(v, null, 2)}</pre>
                                     : String(v) || <em className="text-slate-300 dark:text-brand-500">فارغ</em>}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            </div>
        </div>
    );
}

function SumCard({ label, value, color, suffix }) {
    const colors = {
        slate: 'bg-slate-50 dark:bg-brand-800/40 text-slate-700 dark:text-brand-300 border-slate-200 dark:border-brand-700',
        blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        red: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
    };
    return (
        <div className={`border rounded-xl p-3 ${colors[color]}`}>
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-xl font-black">{value} {suffix && <span className="text-xs">{suffix}</span>}</div>
        </div>
    );
}

function ModuleCard({ active, count, loading, module: m, onClick, onPrefetch }) {
    const Icon = m.icon;
    const colors = {
        blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        indigo: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
        purple: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        teal: 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
        amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        cyan: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
        sky: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
        slate: 'bg-slate-100 dark:bg-brand-800 text-slate-700 dark:text-brand-300 border-slate-200 dark:border-brand-700',
        emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        red: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
        rose: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
        orange: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    };
    const activeColors = {
        blue: 'bg-blue-600', indigo: 'bg-indigo-600', purple: 'bg-purple-600',
        teal: 'bg-teal-600', amber: 'bg-amber-600', cyan: 'bg-cyan-600',
        sky: 'bg-sky-600', slate: 'bg-slate-700', emerald: 'bg-emerald-600',
        red: 'bg-red-600', rose: 'bg-rose-600', orange: 'bg-orange-600',
    };
    return (
        <button onClick={onClick} onMouseEnter={onPrefetch}
            className={`relative rounded-2xl border p-2 md:p-3 flex flex-col items-center text-center transition shadow-sm hover:shadow-md ${active ? `${activeColors[m.color]} text-white border-transparent` : colors[m.color]}`}>
            {count > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center shadow-md ring-2 ring-white ${active ? 'bg-white text-slate-800' : `${activeColors[m.color]} text-white`}`}>
                    {count}
                </span>
            )}
            {loading && <span className="absolute top-1 left-1"><RefreshCw size={10} className="animate-spin"/></span>}
            <Icon size={20} className="mb-1"/>
            <span className="text-[10px] md:text-xs font-bold leading-tight">{m.label}</span>
        </button>
    );
}

function translateField(f) {
    const map = {
        no: 'الرقم', date: 'التاريخ', name: 'الاسم', amount: 'المبلغ', currency_code: 'العملة',
        category: 'التصنيف', vendor: 'البائع', note: 'ملاحظات', email: 'الإيميل', mobile: 'الجوال',
        phone1: 'جوال 1', phone2: 'جوال 2', city: 'المدينة', first_name: 'الاسم الأول', last_name: 'العائلة',
        business_name: 'اسم المنشأة', supplier_number: 'رقم المورد', client_number: 'رقم العميل',
        client_business_name: 'اسم العميل', supplier_business_name: 'اسم المورد',
        summary_total: 'الإجمالي', summary_paid: 'المسدد', summary_unpaid: 'المستحق',
        payment_status: 'حالة الدفع', unit_price: 'سعر الوحدة', default_quantity: 'الكمية',
        brand: 'الماركة', description: 'الوصف', display_order: 'الترتيب',
        shipping_address: 'العنوان', primary: 'رئيسي', active: 'نشط', balance: 'الرصيد',
        type_name: 'النوع', is_primary: 'رئيسية', is_active: 'نشط', value: 'القيمة',
        code: 'الكود', business_Phone: 'هاتف العمل', type: 'النوع', category_type: 'نوع التصنيف',
    };
    return map[f] || f;
}
