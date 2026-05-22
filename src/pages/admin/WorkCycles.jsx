import React, { useState, useEffect } from 'react';
import {
    Layers, RefreshCw, ChevronLeft, Building2, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Receipt,
    ShoppingCart, Search, Link, Users, Home, CheckSquare, Settings, X, Save
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function WorkCycles() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);  // project id
    const [search, setSearch] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_project_cycles`);
            const json = await res.json();
            if (json.success) setProjects(json.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const filtered = projects.filter(p =>
        !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (selected) {
        return <ProjectCycleDetail id={selected} onBack={() => { setSelected(null); load(); }} />;
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
                            <p className="text-sm text-slate-300 mt-1">إحصائيات الوحدات والأداء المالي لكل مشروع</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/work_orders" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> دورات العمل في دفترة
                    </a>
                </div>
            </div>

            {/* شريط البحث */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" placeholder="بحث باسم المشروع..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl outline-none focus:border-emerald-500"/>
                </div>
                <button onClick={load} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition" title="تحديث">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                </button>
                <span className="text-sm font-bold text-slate-500">{filtered.length} مشروع</span>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                    <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري التحميل...
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-bold">لا توجد مشاريع</p>
                    <p className="text-sm mt-2">أضف مشاريع من قسم "إدارة المشاريع والوحدات"</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(p => (
                        <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ProjectCard({ project: p, onOpen }) {
    const total = Number(p.total_units || 0);
    const sold  = Number(p.sold_units  || 0);
    const avail = Number(p.available_units || 0);
    const soldPct = total > 0 ? Math.round((sold / total) * 100) : 0;

    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={onOpen}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-[#1a365d] rounded-xl flex items-center justify-center">
                        <Building2 size={22} className="text-[#c5a059]"/>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-[#1a365d]">{p.name}</h3>
                        {p.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>}
                    </div>
                </div>
                {p.daftra_id
                    ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg flex items-center gap-1"><Link size={10}/>مرتبط</span>
                    : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">غير مرتبط</span>
                }
            </div>

            {/* إحصائيات الوحدات */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <StatChip label="إجمالي" val={total} color="slate"/>
                <StatChip label="مباعة"  val={sold}  color="emerald"/>
                <StatChip label="متاحة"  val={avail} color="blue"/>
            </div>

            {/* شريط المبيعات */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>نسبة المبيعات</span>
                    <span className="font-bold text-[#1a365d]">{soldPct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-l from-[#c5a059] to-[#1a365d] rounded-full transition-all"
                        style={{ width: `${soldPct}%` }}/>
                </div>
            </div>

            <div className="text-xs font-bold text-emerald-600 pt-3 border-t border-slate-100">
                {p.daftra_id ? 'عرض الملخص المالي ←' : 'عرض التفاصيل وربط دفترة ←'}
            </div>
        </div>
    );
}

function StatChip({ label, val, color }) {
    const c = { slate: 'bg-slate-50 text-slate-600', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700' };
    return (
        <div className={`${c[color]} rounded-xl p-2 text-center`}>
            <div className="text-lg font-black">{val}</div>
            <div className="text-[10px] font-bold opacity-80">{label}</div>
        </div>
    );
}

// ─────────────── صفحة التفاصيل ───────────────────────────────────────────────

function ProjectCycleDetail({ id, onBack }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [daftraInput, setDaftraInput] = useState('');
    const [saving, setSaving]   = useState(false);
    const [workOrders, setWorkOrders] = useState([]);
    const [woLoading, setWoLoading] = useState(false);

    const fmt = n => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 });

    const loadData = () => {
        setLoading(true);
        fetch(`${API_URL}?action=project_cycle_summary&id=${id}`)
            .then(r => r.json())
            .then(j => { if (j.success) setData(j); setLoading(false); });
    };

    const loadWorkOrders = () => {
        setWoLoading(true);
        fetch(`${API_URL}?action=daftra_list&module=work_orders`)
            .then(r => r.json())
            .then(j => { if (j.success) setWorkOrders(j.data || []); setWoLoading(false); });
    };

    useEffect(() => { loadData(); }, [id]);

    const saveLink = async () => {
        setSaving(true);
        await fetch(`${API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_project_daftra_id', project_id: id, daftra_id: daftraInput || null }),
        });
        setSaving(false);
        setLinking(false);
        loadData();
    };

    const removeLink = async () => {
        if (!confirm('إزالة الربط مع دفترة؟')) return;
        await fetch(`${API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_project_daftra_id', project_id: id, daftra_id: null }),
        });
        loadData();
    };

    if (loading) return (
        <div className="bg-white rounded-2xl p-12 text-center">
            <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري التحميل...
        </div>
    );
    if (!data || !data.project) return <div className="p-6">لم يتم العثور على المشروع</div>;

    const { project: p, units, daftra, invoices, purchases, expenses } = data;
    const total = Number(p.total_units || 0);
    const sold  = Number(p.sold_units  || 0);
    const avail = Number(p.available_units || 0);

    return (
        <div className="space-y-6 p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-emerald-600 transition">
                <ChevronLeft size={18}/> رجوع لدورات العمل
            </button>

            {/* رأس المشروع */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="text-xs text-slate-400 mb-1">دورة عمل — مشروع</div>
                        <h2 className="text-2xl font-black mb-1">{p.name}</h2>
                        {p.description && <p className="text-slate-300 text-sm">{p.description}</p>}
                    </div>
                    {p.daftra_id ? (
                        <div className="flex gap-2 flex-wrap">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Link size={12}/> مرتبط بدفترة #{p.daftra_id}
                            </span>
                            <button onClick={removeLink} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                                <X size={12}/> إزالة الربط
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => { setLinking(true); loadWorkOrders(); }}
                            className="bg-[#c5a059]/20 hover:bg-[#c5a059]/30 border border-[#c5a059]/30 text-[#c5a059] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                            <Link size={14}/> ربط بدورة عمل في دفترة
                        </button>
                    )}
                </div>
            </div>

            {/* نافذة الربط */}
            {linking && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <h3 className="font-black text-amber-900 mb-3 flex items-center gap-2">
                        <Link size={16}/> ربط المشروع بدورة عمل في دفترة
                    </h3>
                    {woLoading ? (
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                            <RefreshCw size={14} className="animate-spin"/> جاري جلب دورات العمل من دفترة...
                        </div>
                    ) : workOrders.length > 0 ? (
                        <div className="mb-3">
                            <label className="text-sm font-bold text-amber-800 mb-1 block">اختر دورة العمل:</label>
                            <select value={daftraInput} onChange={e => setDaftraInput(e.target.value)}
                                className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 outline-none focus:border-amber-500 text-sm">
                                <option value="">— اختر —</option>
                                {workOrders.map(wo => (
                                    <option key={wo.id} value={wo.id}>#{wo.number} — {wo.title || wo.id}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="mb-3">
                            <label className="text-sm font-bold text-amber-800 mb-1 block">أو أدخل ID دورة العمل يدوياً:</label>
                            <input type="number" placeholder="مثال: 5" value={daftraInput} onChange={e => setDaftraInput(e.target.value)}
                                className="border border-amber-300 rounded-xl px-3 py-2 outline-none focus:border-amber-500 text-sm w-40"/>
                        </div>
                    )}
                    <div className="flex gap-2 mt-3">
                        <button onClick={saveLink} disabled={!daftraInput || saving}
                            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
                            حفظ الربط
                        </button>
                        <button onClick={() => setLinking(false)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition">
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* إحصائيات الوحدات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <BigStat label="إجمالي الوحدات" value={total}  icon={Home}        color="slate"/>
                <BigStat label="وحدات مباعة"     value={sold}   icon={CheckSquare} color="emerald"/>
                <BigStat label="وحدات متاحة"     value={avail}  icon={Building2}   color="blue"/>
                <BigStat label="نسبة الإنجاز"    value={total > 0 ? `${Math.round((sold/total)*100)}%` : '—'} icon={TrendingUp} color="gold"/>
            </div>

            {/* الملخص المالي من دفترة */}
            {daftra ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <BigStat label="الإيرادات"    value={fmt(daftra.total_revenue)}   icon={TrendingUp}   color="emerald"/>
                        <BigStat label="المشتريات"    value={fmt(daftra.total_purchases)} icon={ShoppingCart} color="purple"/>
                        <BigStat label="المصروفات"    value={fmt(daftra.total_expenses)}  icon={TrendingDown} color="red"/>
                        <BigStat label="صافي الربح"   value={fmt(daftra.net_profit)}      icon={DollarSign}   color={daftra.net_profit >= 0 ? 'emerald' : 'red'}/>
                    </div>

                    <Section title="الفواتير الصادرة" icon={Receipt} color="blue" items={invoices} columns={[
                        {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'client', label:'العميل'},
                        {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
                    ]} fmt={fmt}/>
                    <Section title="المشتريات" icon={ShoppingCart} color="purple" items={purchases} columns={[
                        {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'supplier', label:'المورد'},
                        {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
                    ]} fmt={fmt}/>
                    <Section title="المصروفات" icon={TrendingDown} color="red" items={expenses} columns={[
                        {key:'date', label:'التاريخ'}, {key:'category', label:'التصنيف'}, {key:'vendor', label:'البائع'},
                        {key:'amount', label:'المبلغ', fmt:true}, {key:'note', label:'ملاحظات'}
                    ]} fmt={fmt}/>
                </>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                    <Link size={32} className="mx-auto mb-2 text-amber-400 opacity-60"/>
                    <p className="font-bold text-amber-800">لا توجد بيانات مالية</p>
                    <p className="text-sm text-amber-600 mt-1">ارتبط بدورة عمل في دفترة لعرض الإيرادات والمصروفات والمشتريات</p>
                </div>
            )}

            {/* قائمة الوحدات */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
                    <Users size={18} className="text-slate-700"/>
                    <h3 className="font-black text-[#1a365d]">الوحدات ({units.length})</h3>
                </div>
                {units.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">لا توجد وحدات مسجلة في هذا المشروع</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                                <tr>
                                    <th className="px-3 py-2">رمز الوحدة</th>
                                    <th className="px-3 py-2">الحالة</th>
                                    <th className="px-3 py-2">المالك</th>
                                    <th className="px-3 py-2">الجوال</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {units.map((u, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-mono font-bold text-[#1a365d]">{u.unit_code}</td>
                                        <td className="px-3 py-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${u.owner_name ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.owner_name ? 'مباعة' : 'متاحة'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">{u.owner_name || '—'}</td>
                                        <td className="px-3 py-2 font-mono">{u.owner_phone || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function BigStat({ label, value, icon: Icon, color }) {
    const c = {
        slate:   'bg-slate-50  text-slate-700  border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue:    'bg-blue-50    text-blue-700   border-blue-200',
        purple:  'bg-purple-50  text-purple-700 border-purple-200',
        red:     'bg-red-50     text-red-700    border-red-200',
        gold:    'bg-amber-50   text-amber-700  border-amber-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${c[color] || c.slate}`}>
            {Icon && <Icon size={18} className="mb-1 opacity-70"/>}
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
}

function Section({ title, icon: Icon, color, items, columns, fmt }) {
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            <div className={`p-4 border-b border-slate-100 flex items-center gap-2 bg-${color}-50/40`}>
                <Icon size={18} className={`text-${color}-700`}/>
                <h3 className="font-black text-[#1a365d]">{title} ({items.length})</h3>
            </div>
            {items.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">لا توجد سجلات مرتبطة</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>{columns.map(c => <th key={c.key} className="px-3 py-2">{c.label}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((it, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                    {columns.map(c => (
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
