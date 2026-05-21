import React, { useState, useEffect } from 'react';
import {
    Database, RefreshCw, Search, Eye, X, ExternalLink, Receipt, FileText,
    ShoppingCart, Users, Truck, Package, FolderTree, Building, Wallet,
    TrendingDown, UserCog, Percent, Tag
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

// تعريف كل الوحدات المتاحة في دفترة
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
];

// أهم الحقول لعرض جدول مختصر
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
};

export default function DaftraExplorer() {
    const [activeModule, setActiveModule] = useState('invoices');
    const [data, setData] = useState({});  // {module: {count, data}}
    const [loading, setLoading] = useState({});
    const [search, setSearch] = useState('');
    const [selectedRow, setSelectedRow] = useState(null);

    const loadModule = async (mod) => {
        if (data[mod] && data[mod].data) return;  // محمّل مسبقاً
        setLoading(prev => ({ ...prev, [mod]: true }));
        try {
            const res = await fetch(`${API_URL}?action=daftra_list&module=${mod}`);
            const json = await res.json();
            if (json.success) {
                setData(prev => ({ ...prev, [mod]: json }));
            }
        } finally {
            setLoading(prev => ({ ...prev, [mod]: false }));
        }
    };

    useEffect(() => { loadModule(activeModule); }, [activeModule]);

    const reload = () => {
        setData(prev => { const n = {...prev}; delete n[activeModule]; return n; });
        loadModule(activeModule);
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

    const filtered = search
        ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : rows;

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
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
                        onClick={() => setActiveModule(m.id)}
                        onPrefetch={() => loadModule(m.id)}
                    />
                ))}
            </div>

            {/* محتوى الوحدة المختارة */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {moduleConfig && <moduleConfig.icon size={24} className={`text-${moduleConfig.color}-600`}/>}
                        <h3 className="text-lg md:text-xl font-black text-[#1a365d]">
                            {moduleConfig?.label}
                            {moduleData && <span className="text-sm font-bold text-slate-500 mr-2">({moduleData.count} سجل)</span>}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input type="text" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}
                                className="bg-slate-50 border border-slate-200 pr-8 pl-3 py-2 rounded-xl text-sm w-40 md:w-64 outline-none focus:border-emerald-500"/>
                        </div>
                        <button onClick={reload} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 p-2 rounded-xl transition" title="تحديث">
                            <RefreshCw size={16} className={loading[activeModule] ? 'animate-spin' : ''}/>
                        </button>
                    </div>
                </div>

                {loading[activeModule] ? (
                    <div className="p-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin inline mr-2"/> جاري التحميل من دفترة...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">لا توجد سجلات</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                                <tr>
                                    {fields.map(f => (<th key={f} className="px-3 py-2 font-bold whitespace-nowrap">{translateField(f)}</th>))}
                                    <th className="px-3 py-2 text-center w-16">تفاصيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.slice(0, 200).map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        {fields.map(f => (
                                            <td key={f} className="px-3 py-2 whitespace-nowrap text-slate-700">{fmt(row[f])}</td>
                                        ))}
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={()=>setSelectedRow(row)} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg">
                                                <Eye size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length > 200 && (
                            <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t">
                                عرض أول 200 من {filtered.length} سجل — استخدم البحث للتصفية
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* نافذة تفاصيل السجل الكاملة */}
            {selectedRow && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur z-50 flex items-center justify-center p-4" onClick={()=>setSelectedRow(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                            <h3 className="font-black text-[#1a365d]">تفاصيل السجل الكاملة</h3>
                            <button onClick={()=>setSelectedRow(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="p-4 space-y-1">
                            {Object.entries(selectedRow).map(([k, v]) => (
                                <div key={k} className="flex flex-col md:flex-row md:items-center gap-1 py-2 border-b border-slate-50 last:border-0">
                                    <div className="md:w-1/3 text-xs font-bold text-slate-500 font-mono">{k}</div>
                                    <div className="md:w-2/3 text-sm text-slate-800 break-all">
                                        {v === null ? <em className="text-slate-300">null</em>
                                         : typeof v === 'object' ? <pre className="text-xs bg-slate-50 p-2 rounded">{JSON.stringify(v, null, 2)}</pre>
                                         : String(v) || <em className="text-slate-300">فارغ</em>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ModuleCard({ active, count, loading, module: m, onClick, onPrefetch }) {
    const Icon = m.icon;
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        teal: 'bg-teal-50 text-teal-700 border-teal-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        sky: 'bg-sky-50 text-sky-700 border-sky-200',
        slate: 'bg-slate-100 text-slate-700 border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        orange: 'bg-orange-50 text-orange-700 border-orange-200',
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
            {loading && (
                <span className="absolute top-1 left-1"><RefreshCw size={10} className="animate-spin"/></span>
            )}
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
