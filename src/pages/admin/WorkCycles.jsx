import React, { useState, useEffect } from 'react';
import {
    Layers, RefreshCw, ChevronLeft, Calendar, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Receipt, ShoppingCart, Search
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function WorkCycles() {
    const [workOrders, setWorkOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=daftra_list&module=work_orders`);
            const json = await res.json();
            if (json.success) setWorkOrders(json.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    const filtered = workOrders.filter(w =>
        !search || (w.title || '').toLowerCase().includes(search.toLowerCase())
        || String(w.number || '').includes(search)
        || (w.description || '').toLowerCase().includes(search.toLowerCase())
    );

    if (selected) {
        return <WorkOrderDetail id={selected} onBack={() => setSelected(null)} />;
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
                            <h1 className="text-2xl md:text-3xl font-black">دورات العمل (Work Orders)</h1>
                            <p className="text-sm text-slate-300 mt-1">أوامر العمل من دفترة مع تجميع المشتريات والإيرادات لكل دورة</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/work_orders" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> إدارة في دفترة
                    </a>
                </div>
            </div>

            {/* البحث */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" placeholder="بحث بالعنوان / الرقم / الوصف..." value={search} onChange={e=>setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl outline-none focus:border-emerald-500"/>
                </div>
                <button onClick={load} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition" title="تحديث">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                </button>
                <span className="text-sm font-bold text-slate-500">{filtered.length} دورة</span>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center"><RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري التحميل من دفترة...</div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-bold">لا توجد دورات عمل</p>
                    <p className="text-sm mt-2">أنشئ دورة من دفترة → "دورات العمل" أو "Work Orders"</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(w => <WorkOrderCard key={w.id} wo={w} fmt={fmt} onOpen={() => setSelected(w.id)} />)}
                </div>
            )}
        </div>
    );
}

function WorkOrderCard({ wo, fmt, onOpen }) {
    const statusMap = {
        '1': { label: 'مفتوحة', cls: 'bg-emerald-100 text-emerald-700' },
        '2': { label: 'قيد التنفيذ', cls: 'bg-blue-100 text-blue-700' },
        '3': { label: 'مكتملة', cls: 'bg-slate-200 text-slate-700' },
        '4': { label: 'ملغاة', cls: 'bg-red-100 text-red-700' },
    };
    const st = statusMap[String(wo.status)] || { label: wo.status || '—', cls: 'bg-slate-100 text-slate-600' };

    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={onOpen}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-slate-400 mb-1">#{wo.number}</div>
                    <h3 className="text-lg font-black text-[#1a365d] mb-1 truncate" title={wo.title}>{wo.title || '—'}</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${st.cls}`}>{st.label}</span>
            </div>
            <div className="space-y-1 text-xs text-slate-600 mb-3">
                {wo.start_date && (
                    <div className="flex items-center gap-2"><Calendar size={12}/> بدء: {wo.start_date}</div>
                )}
                {wo.delivery_date && (
                    <div className="flex items-center gap-2"><Calendar size={12}/> تسليم: {wo.delivery_date}</div>
                )}
                {wo.budget > 0 && (
                    <div className="flex items-center gap-2"><DollarSign size={12}/> ميزانية: <strong className="text-[#1a365d]">{fmt(wo.budget)}</strong> {wo.budget_currency || 'SAR'}</div>
                )}
            </div>
            {wo.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{wo.description}</p>}
            <div className="text-xs font-bold text-emerald-600 mt-3 pt-3 border-t border-slate-100">
                عرض التفاصيل المالية ←
            </div>
        </div>
    );
}

function WorkOrderDetail({ id, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}?action=daftra_work_order_summary&id=${id}`)
            .then(r => r.json())
            .then(j => { if (j.success) setData(j); setLoading(false); });
    }, [id]);

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (loading) return <div className="bg-white rounded-2xl p-12 text-center"><RefreshCw className="animate-spin inline mr-2"/> جاري حساب البيانات...</div>;
    if (!data || !data.work_order) return <div className="p-6">لم يتم العثور على بيانات</div>;

    const { work_order: wo, summary, purchases, expenses, invoices } = data;
    const overBudget = summary.budget_used_pct > 100;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-emerald-600 transition">
                <ChevronLeft size={18}/> رجوع لقائمة دورات العمل
            </button>

            {/* رأس الدورة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="text-xs font-mono text-slate-400 mb-1">دورة عمل #{wo.number}</div>
                <h2 className="text-2xl font-black mb-2">{wo.title}</h2>
                {wo.description && <p className="text-slate-300 text-sm mb-3">{wo.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                    {wo.start_date && <span>📅 بدء: {wo.start_date}</span>}
                    {wo.delivery_date && <span>🏁 تسليم: {wo.delivery_date}</span>}
                </div>
            </div>

            {/* المؤشرات الكبيرة */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Big label="الميزانية" value={fmt(summary.budget)} color="slate"/>
                <Big label="الإيرادات" value={fmt(summary.total_revenue)} color="emerald" icon={TrendingUp}/>
                <Big label="المشتريات" value={fmt(summary.total_purchases)} color="purple" icon={ShoppingCart}/>
                <Big label="المصروفات" value={fmt(summary.total_expenses)} color="red" icon={TrendingDown}/>
                <Big label="صافي الربح" value={fmt(summary.net_profit)} color={summary.net_profit >= 0 ? 'emerald' : 'red'}/>
            </div>

            {/* مؤشر الميزانية */}
            {summary.budget > 0 && (
                <div className={`rounded-2xl p-5 border ${overBudget ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {overBudget ? <AlertTriangle className="text-red-600"/> : <CheckCircle2 className="text-emerald-600"/>}
                            <h3 className={`font-black ${overBudget ? 'text-red-900' : 'text-[#1a365d]'}`}>استهلاك الميزانية</h3>
                        </div>
                        <div className={`text-2xl font-black ${overBudget ? 'text-red-700' : 'text-emerald-700'}`}>{summary.budget_used_pct}%</div>
                    </div>
                    <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                        <div className={`h-full transition-all ${overBudget ? 'bg-gradient-to-l from-red-500 to-orange-500' : 'bg-gradient-to-l from-emerald-500 to-teal-500'}`}
                            style={{ width: `${Math.min(100, summary.budget_used_pct)}%` }}/>
                    </div>
                    <div className="flex justify-between text-xs mt-2 font-bold">
                        <span className="text-slate-600">استُهلك: {fmt(summary.total_cost)} ريال</span>
                        <span className={summary.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {summary.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(summary.budget_left))} ريال
                        </span>
                    </div>
                </div>
            )}

            <Section title="المشتريات" icon={ShoppingCart} color="purple" items={purchases} columns={[
                {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'supplier', label:'المورد'},
                {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
            ]}/>
            <Section title="المصروفات" icon={TrendingDown} color="red" items={expenses} columns={[
                {key:'date', label:'التاريخ'}, {key:'category', label:'التصنيف'}, {key:'vendor', label:'البائع'},
                {key:'amount', label:'المبلغ', fmt:true}, {key:'note', label:'ملاحظات'}
            ]}/>
            <Section title="الفواتير الصادرة" icon={Receipt} color="blue" items={invoices} columns={[
                {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'client', label:'العميل'},
                {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
            ]}/>
        </div>
    );
}

function Big({ label, value, color, icon:Icon }) {
    const colors = {
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${colors[color]}`}>
            {Icon && <Icon size={18} className="mb-1 opacity-70"/>}
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
}

function Section({ title, icon:Icon, color, items, columns }) {
    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            <div className={`p-4 border-b border-slate-100 flex items-center gap-2 bg-${color}-50/40`}>
                <Icon size={18} className={`text-${color}-700`}/>
                <h3 className="font-black text-[#1a365d]">{title} ({items.length})</h3>
            </div>
            {items.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">لا توجد سجلات مرتبطة بهذه الدورة</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>{columns.map(c=>(<th key={c.key} className="px-3 py-2">{c.label}</th>))}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((it, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                    {columns.map(c=>(
                                        <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                                            {c.fmt ? fmt(it[c.key]) : (it[c.key] || '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
