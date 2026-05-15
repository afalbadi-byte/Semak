import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw, Search, User, Phone, CheckCircle2, Circle, Wrench, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const STATUS_STYLES = {
    'مباعة':   { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'متاح':    { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
    'محجوز':   { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    'default': { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.default;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {status}
        </span>
    );
}

export default function UnitsOverview({ showToast }) {
    const [projects, setProjects]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [filterStatus, setFilter] = useState('الكل');
    const [expanded, setExpanded]   = useState({});

    const load = async () => {
        setLoading(true);
        try {
            const res  = await fetch(`${API_URL}?action=get_projects_data`);
            const data = await res.json();
            if (data.success) {
                setProjects(data.data);
                // افتح أول مشروع تلقائياً
                if (data.data.length > 0) {
                    setExpanded({ [data.data[0].id]: true });
                }
            }
        } catch (e) {
            if (showToast) showToast('خطأ', 'فشل تحميل البيانات', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // إحصائيات سريعة
    const allUnits = projects.flatMap(p => p.units_details || []);
    const stats = {
        total:   allUnits.length,
        sold:    allUnits.filter(u => u.status === 'مباعة').length,
        avail:   allUnits.filter(u => u.status === 'متاح').length,
        reserved:allUnits.filter(u => u.status === 'محجوز').length,
    };

    // فلترة
    const q = search.trim().toLowerCase();
    const filteredProjects = projects.map(p => ({
        ...p,
        units_details: (p.units_details || []).filter(u => {
            const matchSearch = !q ||
                u.unit_code?.toLowerCase().includes(q) ||
                u.owner_name?.toLowerCase().includes(q) ||
                u.owner_phone?.includes(q);
            const matchStatus = filterStatus === 'الكل' || u.status === filterStatus;
            return matchSearch && matchStatus;
        })
    })).filter(p => p.units_details.length > 0);

    const toggleProject = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="p-6 md:p-8 animate-fadeIn max-w-6xl mx-auto">

            {/* ─── إحصائيات ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'إجمالي الوحدات', value: stats.total,    color: 'text-[#1a365d]', bg: 'bg-[#1a365d]/5',  icon: Building2 },
                    { label: 'مباعة',           value: stats.sold,     color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
                    { label: 'متاحة',           value: stats.avail,    color: 'text-blue-600',    bg: 'bg-blue-50',    icon: Circle },
                    { label: 'محجوزة',          value: stats.reserved, color: 'text-amber-600',   bg: 'bg-amber-50',   icon: Wrench },
                ].map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`${s.bg} rounded-2xl p-5 flex items-center gap-4`}>
                            <Icon className={s.color} size={28} />
                            <div>
                                <p className="text-xs text-slate-500 font-bold">{s.label}</p>
                                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── شريط البحث والفلتر ────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث برقم الوحدة أو اسم المالك أو الجوال..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm font-bold outline-none focus:border-[#1a365d] transition"
                    />
                </div>
                <div className="flex gap-2">
                    {['الكل', 'متاح', 'مباعة', 'محجوز'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition ${filterStatus === f ? 'bg-[#1a365d] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#1a365d]'}`}
                        >
                            {f}
                        </button>
                    ))}
                    <button onClick={load} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#1a365d] transition">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ─── قائمة المشاريع ──────────────────────────── */}
            {loading ? (
                <div className="text-center py-24 text-slate-400">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-[#1a365d]" size={36} />
                    <p className="font-bold">جاري تحميل بيانات الوحدات...</p>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-24 text-slate-400 font-bold">لا توجد نتائج</div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map(project => {
                        const isOpen    = !!expanded[project.id];
                        const soldCount = project.units_details.filter(u => u.status === 'مباعة').length;
                        const total     = project.units_details.length;
                        const pct       = total > 0 ? Math.round((soldCount / total) * 100) : 0;

                        return (
                            <div key={project.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

                                {/* رأس المشروع */}
                                <button
                                    onClick={() => toggleProject(project.id)}
                                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition text-right"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#1a365d]/10 text-[#1a365d] rounded-2xl flex items-center justify-center">
                                            <Building2 size={22} />
                                        </div>
                                        <div>
                                            <p className="font-black text-[#1a365d] text-lg">{project.name}</p>
                                            <p className="text-xs text-slate-400 font-bold mt-0.5">
                                                {total} وحدة — {soldCount} مباعة — {total - soldCount} متاحة
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* شريط التقدم */}
                                        <div className="hidden sm:block w-32">
                                            <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1">
                                                <span>المبيعات</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                    </div>
                                </button>

                                {/* جدول الوحدات */}
                                {isOpen && (
                                    <div className="border-t border-slate-100 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 text-xs text-slate-500 font-black">
                                                    <th className="text-right px-5 py-3">رقم الوحدة</th>
                                                    <th className="text-right px-5 py-3">الحالة</th>
                                                    <th className="text-right px-5 py-3">المالك</th>
                                                    <th className="text-right px-5 py-3">الجوال</th>
                                                    <th className="text-right px-5 py-3">المساحات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {project.units_details.map(unit => (
                                                    <tr key={unit.id} className="hover:bg-slate-50/50 transition">
                                                        <td className="px-5 py-3.5">
                                                            <span className="font-black text-[#1a365d] bg-[#1a365d]/5 px-3 py-1 rounded-lg text-xs">
                                                                {unit.unit_code}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <StatusBadge status={unit.status || 'متاح'} />
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {unit.owner_name ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-full bg-[#c5a059]/10 text-[#c5a059] flex items-center justify-center text-xs font-black shrink-0">
                                                                        {unit.owner_name.charAt(0)}
                                                                    </div>
                                                                    <span className="font-bold text-slate-700">{unit.owner_name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-bold">— غير مسجل</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {unit.owner_phone ? (
                                                                <a href={`tel:${unit.owner_phone}`} className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline text-xs" dir="ltr">
                                                                    <Phone size={12} /> {unit.owner_phone}
                                                                </a>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-bold">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {Array.isArray(unit.spaces) && unit.spaces.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {unit.spaces.slice(0, 3).map((sp, i) => (
                                                                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                            {sp.label}: {sp.value}م²
                                                                        </span>
                                                                    ))}
                                                                    {unit.spaces.length > 3 && (
                                                                        <span className="text-slate-400 text-[10px] font-bold">+{unit.spaces.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-bold">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
