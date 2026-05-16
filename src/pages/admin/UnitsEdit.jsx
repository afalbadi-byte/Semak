import React, { useState, useEffect } from 'react';
import {
    Building2, RefreshCw, Search, Edit2, Trash2, Plus,
    Save, X, User, Phone, Mail, ChevronDown, ChevronUp, Ruler
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const STATUS_STYLES = {
    'مباعة':  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'متاح':   { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
    'محجوز':  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    'default':{ bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.default;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {status || 'متاح'}
        </span>
    );
}

// ─── مودال تعديل المالك ────────────────────────────────────────
function OwnerModal({ unit, projects, onClose, onSaved, showToast }) {
    const hasOwner = !!unit.owner_name;
    const [form, setForm] = useState({
        id:        unit.owner_id   || '',
        name:      unit.owner_name || '',
        phone:     unit.owner_phone|| '',
        email:     unit.owner_email|| '',
        unit_code: unit.unit_code,
        project_id: unit.project_id,
    });
    const [saving, setSaving] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const action = hasOwner ? 'update_owner' : 'add_owner';
            const res = await fetch(`${API_URL}?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                showToast('تم', hasOwner ? 'تم تحديث بيانات المالك ✅' : 'تم إضافة المالك وتسجيل الوحدة ✅');
                onSaved();
            } else {
                showToast('خطأ', data.message || 'حدث خطأ', 'error');
            }
        } catch { showToast('خطأ', 'فشل الاتصال', 'error'); }
        finally { setSaving(false); }
    };

    const deleteOwner = async () => {
        if (!window.confirm('حذف المالك؟ سيتم تحرير الوحدة وإرجاعها لـ "متاح"')) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}?action=delete_owner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: form.id }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('تم', 'تم حذف المالك وتحرير الوحدة');
                onSaved();
            }
        } catch { showToast('خطأ', 'فشل الاتصال', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-[#1a365d] text-lg flex items-center gap-2">
                        <User size={20} className="text-emerald-500" />
                        {hasOwner ? 'تعديل المالك' : 'إضافة مالك'} — {unit.unit_code}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={save} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1.5">اسم المالك</label>
                        <div className="relative">
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                required
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="الاسم الرباعي"
                                className="w-full pr-9 pl-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a365d]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1.5">رقم الجوال</label>
                        <div className="relative">
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                required
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                placeholder="05XXXXXXXX"
                                dir="ltr"
                                className="w-full pr-9 pl-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a365d] text-left"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1.5">البريد الإلكتروني (اختياري)</label>
                        <div className="relative">
                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                placeholder="email@example.com"
                                dir="ltr"
                                className="w-full pr-9 pl-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a365d] text-left"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={saving}
                            className="flex-1 bg-[#1a365d] text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-[#1a365d]/90 disabled:opacity-50">
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            {hasOwner ? 'حفظ التعديلات' : 'إضافة المالك'}
                        </button>
                        {hasOwner && (
                            <button type="button" onClick={deleteOwner} disabled={saving}
                                className="bg-red-50 text-red-600 px-4 py-3 rounded-xl font-black hover:bg-red-500 hover:text-white transition">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── مودال تعديل المساحات ──────────────────────────────────────
function SpacesModal({ unit, onClose, onSaved, showToast }) {
    const [spaces, setSpaces] = useState(
        Array.isArray(unit.spaces) && unit.spaces.length > 0
            ? unit.spaces.map(s => ({ label: s.label, value: s.value }))
            : [{ label: '', value: '' }]
    );
    const [saving, setSaving] = useState(false);

    const addRow    = () => setSpaces([...spaces, { label: '', value: '' }]);
    const removeRow = (i) => setSpaces(spaces.filter((_, idx) => idx !== i));
    const update    = (i, field, val) => setSpaces(spaces.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

    const save = async () => {
        const filtered = spaces.filter(s => s.label && s.value !== '');
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}?action=update_unit_spaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unit_id: unit.id, spaces: filtered }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('تم', 'تم تحديث المساحات ✅');
                onSaved();
            } else {
                showToast('خطأ', 'فشل الحفظ', 'error');
            }
        } catch { showToast('خطأ', 'فشل الاتصال', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-[#1a365d] text-lg flex items-center gap-2">
                        <Ruler size={20} className="text-blue-500" />
                        تعديل مساحات — {unit.unit_code}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
                </div>

                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {spaces.map((s, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={s.label}
                                onChange={e => update(i, 'label', e.target.value)}
                                placeholder="اسم المساحة (مثال: صالة)"
                                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a365d]"
                            />
                            <input
                                type="number"
                                value={s.value}
                                onChange={e => update(i, 'value', e.target.value)}
                                placeholder="م²"
                                className="w-20 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a365d] text-center"
                            />
                            <button onClick={() => removeRow(i)}
                                className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <button onClick={addRow}
                    className="w-full border-2 border-dashed border-slate-200 text-slate-400 py-2.5 rounded-xl text-sm font-bold hover:border-[#1a365d] hover:text-[#1a365d] transition flex items-center justify-center gap-2 mb-5">
                    <Plus size={16} /> إضافة مساحة
                </button>

                <button onClick={save} disabled={saving}
                    className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-[#1a365d]/90 disabled:opacity-50">
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    حفظ المساحات
                </button>
            </div>
        </div>
    );
}

// ─── الصفحة الرئيسية ───────────────────────────────────────────
export default function UnitsEdit({ showToast }) {
    const [projects, setProjects]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [filterStatus, setFilter]   = useState('الكل');
    const [expanded, setExpanded]     = useState({});
    const [ownerModal, setOwnerModal] = useState(null);
    const [spacesModal, setSpacesModal] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res  = await fetch(`${API_URL}?action=get_projects_data`);
            const data = await res.json();
            if (data.success) {
                setProjects(data.data);
                if (data.data.length > 0) {
                    const exp = {};
                    data.data.forEach(p => { exp[p.id] = true; });
                    setExpanded(exp);
                }
            }
        } catch {
            showToast?.('خطأ', 'فشل تحميل البيانات', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const allUnits = projects.flatMap(p =>
        (p.units_details || []).map(u => ({ ...u, project_id: p.id }))
    );
    const stats = {
        total:    allUnits.length,
        sold:     allUnits.filter(u => u.status === 'مباعة').length,
        avail:    allUnits.filter(u => u.status === 'متاح').length,
        reserved: allUnits.filter(u => u.status === 'محجوز').length,
    };

    const q = search.trim().toLowerCase();
    const filteredProjects = projects.map(p => ({
        ...p,
        units_details: (p.units_details || []).map(u => ({ ...u, project_id: p.id })).filter(u => {
            const matchSearch = !q ||
                u.unit_code?.toLowerCase().includes(q) ||
                u.owner_name?.toLowerCase().includes(q) ||
                u.owner_phone?.includes(q);
            const matchStatus = filterStatus === 'الكل' || u.status === filterStatus;
            return matchSearch && matchStatus;
        }),
    })).filter(p => p.units_details.length > 0);

    const onSaved = () => {
        setOwnerModal(null);
        setSpacesModal(null);
        load();
    };

    return (
        <div className="p-6 md:p-8 animate-fadeIn max-w-6xl mx-auto">

            {/* ── إحصائيات ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'إجمالي الوحدات', value: stats.total,    color: 'text-[#1a365d]',   bg: 'bg-[#1a365d]/5'  },
                    { label: 'مباعة',           value: stats.sold,     color: 'text-emerald-600', bg: 'bg-emerald-50'   },
                    { label: 'متاحة',           value: stats.avail,    color: 'text-blue-600',    bg: 'bg-blue-50'      },
                    { label: 'محجوزة',          value: stats.reserved, color: 'text-amber-600',   bg: 'bg-amber-50'     },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-2xl p-5`}>
                        <p className="text-xs text-slate-500 font-bold">{s.label}</p>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ── بحث وفلاتر ──────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث برقم الوحدة أو اسم المالك أو الجوال..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm font-bold outline-none focus:border-[#1a365d]"
                    />
                </div>
                <div className="flex gap-2">
                    {['الكل', 'متاح', 'مباعة', 'محجوز'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition ${filterStatus === f ? 'bg-[#1a365d] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#1a365d]'}`}>
                            {f}
                        </button>
                    ))}
                    <button onClick={load} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#1a365d]">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── قائمة المشاريع ───────────────────────────────── */}
            {loading ? (
                <div className="text-center py-24 text-slate-400">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-[#1a365d]" size={36} />
                    <p className="font-bold">جاري التحميل...</p>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-24 text-slate-400 font-bold">لا توجد نتائج</div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map(project => {
                        const isOpen = !!expanded[project.id];
                        const soldCount = project.units_details.filter(u => u.status === 'مباعة').length;
                        const total = project.units_details.length;
                        const pct = total > 0 ? Math.round((soldCount / total) * 100) : 0;

                        return (
                            <div key={project.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

                                {/* رأس المشروع */}
                                <button
                                    onClick={() => setExpanded(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition text-right">
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
                                        <div className="hidden sm:block w-32">
                                            <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1">
                                                <span>المبيعات</span><span>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
                                                    <th className="text-right px-5 py-3">المساحات</th>
                                                    <th className="text-center px-5 py-3">تعديل</th>
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
                                                                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">
                                                                        {unit.owner_name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-700 text-xs">{unit.owner_name}</p>
                                                                        <p className="text-[10px] text-blue-500" dir="ltr">{unit.owner_phone}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-bold">— بدون مالك</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {Array.isArray(unit.spaces) && unit.spaces.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {unit.spaces.slice(0, 2).map((sp, i) => (
                                                                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                            {sp.label}: {sp.value}م²
                                                                        </span>
                                                                    ))}
                                                                    {unit.spaces.length > 2 && (
                                                                        <span className="text-slate-400 text-[10px] font-bold">+{unit.spaces.length - 2}</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {/* تعديل المالك */}
                                                                <button
                                                                    onClick={() => setOwnerModal({ ...unit, project_id: project.id })}
                                                                    title={unit.owner_name ? 'تعديل المالك' : 'إضافة مالك'}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                                                                        unit.owner_name
                                                                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                                                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white'
                                                                    }`}>
                                                                    {unit.owner_name ? <Edit2 size={13} /> : <Plus size={13} />}
                                                                    {unit.owner_name ? 'مالك' : 'أضف'}
                                                                </button>
                                                                {/* تعديل المساحات */}
                                                                <button
                                                                    onClick={() => setSpacesModal({ ...unit, project_id: project.id })}
                                                                    title="تعديل المساحات"
                                                                    className="bg-slate-50 text-slate-600 hover:bg-[#1a365d] hover:text-white px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5">
                                                                    <Ruler size={13} /> مساحات
                                                                </button>
                                                            </div>
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

            {/* ── المودالات ─────────────────────────────────────── */}
            {ownerModal && (
                <OwnerModal
                    unit={ownerModal}
                    projects={projects}
                    onClose={() => setOwnerModal(null)}
                    onSaved={onSaved}
                    showToast={showToast}
                />
            )}
            {spacesModal && (
                <SpacesModal
                    unit={spacesModal}
                    onClose={() => setSpacesModal(null)}
                    onSaved={onSaved}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
