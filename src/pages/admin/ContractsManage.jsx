import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Plus, Search, Edit2, Loader2, X, CheckCircle2,
    Clock, AlertCircle, Building, Phone, Calendar, DollarSign,
    Briefcase, PauseCircle, XCircle
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

// ─── الحالات ─────────────────────────────────────────────────────────────────
const STATUS_OPTS = [
    { value:'draft',     label:'مسودة',      icon:FileText,     cls:'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300' },
    { value:'active',    label:'سارٍ',        icon:CheckCircle2, cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value:'on_hold',   label:'متوقف',       icon:PauseCircle,  cls:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { value:'completed', label:'منجز',        icon:CheckCircle2, cls:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    { value:'cancelled', label:'ملغي',        icon:XCircle,      cls:'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
];
const statusOf  = (v) => STATUS_OPTS.find(s => s.value === v) || STATUS_OPTS[0];

// ─── أنواع الأعمال ───────────────────────────────────────────────────────────
const WORK_TYPES = [
    'أعمال إنشائية',
    'أعمال تشطيبات',
    'كهرباء وإنارة',
    'سباكة وصرف صحي',
    'تكييف وميكانيكا',
    'ألومنيوم وزجاج',
    'حديد وبناء',
    'دهانات وجبس',
    'سيراميك وبلاط',
    'مصاعد',
    'أعمال خارجية',
    'أخرى',
];

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400';

const today = () => new Date().toISOString().slice(0, 10);
const fmt   = (n) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
const EMPTY = { contractor_name:'', contractor_phone:'', project_id:'', work_type:'', contract_value:'', advance_amount:'', start_date:today(), end_date:'', status:'draft', notes:'' };

export default function ContractsManage({ showToast }) {
    const [rows,      setRows]      = useState([]);
    const [projects,  setProjects]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [q,         setQ]         = useState('');
    const [statusF,   setStatusF]   = useState('');
    const [projectF,  setProjectF]  = useState('');
    const [modal,     setModal]     = useState(false);
    const [form,      setForm]      = useState(EMPTY);
    const [saving,    setSaving]    = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            apiGet('re_contracts_list'),
            fetch('/api.php?action=get_projects_data').then(r => r.json()),
        ])
            .then(([cd, pd]) => {
                if (cd.success) setRows(cd.contracts || []);
                if (pd.success) setProjects(pd.data || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew  = () => { setForm(EMPTY); setModal(true); };
    const openEdit = (r) => { setForm({ ...r, contract_value: r.contract_value?.toString() || '', advance_amount: r.advance_amount?.toString() || '' }); setModal(true); };
    const close    = () => { setModal(false); setForm(EMPTY); };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.contractor_name.trim()) { showToast?.('خطأ', 'اسم المقاول مطلوب'); return; }
        setSaving(true);
        const d = await apiPost('re_contract_save', {
            ...form,
            contract_value: parseFloat(form.contract_value) || 0,
            advance_amount: parseFloat(form.advance_amount) || 0,
        });
        if (d.success) { showToast?.('تم الحفظ'); close(); load(); }
        else showToast?.('خطأ', d.message || 'فشل الحفظ');
        setSaving(false);
    };

    const updateStatus = async (id, status) => {
        const d = await apiPost('re_contract_save', { id, status });
        if (d.success) setRows(r => r.map(x => x.id === id ? { ...x, status } : x));
    };

    const filtered = rows.filter(r => {
        const qm = !q || [r.contractor_name, r.contract_no, r.work_type, r.project_name]
            .some(v => v?.toLowerCase().includes(q.toLowerCase()));
        const sm = !statusF  || r.status === statusF;
        const pm = !projectF || String(r.project_id) === projectF;
        return qm && sm && pm;
    });

    // ملخص
    const totalActive    = rows.filter(r => r.status === 'active').reduce((a, r) => a + +r.contract_value, 0);
    const totalCompleted = rows.filter(r => r.status === 'completed').reduce((a, r) => a + +r.contract_value, 0);
    const countActive    = rows.filter(r => r.status === 'active').length;

    return (
        <div className="animate-fadeIn p-5 md:p-8 max-w-7xl mx-auto space-y-6">

            {/* رأس الصفحة */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                        <FileText size={22} className="text-amber-500" /> التعاقدات مع المقاولين
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.length} عقد مسجّل</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-amber-500/20">
                    <Plus size={16} /> عقد جديد
                </button>
            </div>

            {/* ملخص */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label:'سارية', value:`${countActive} عقد`, sub:`${fmt(totalActive)} ﷼`, color:'emerald', icon:CheckCircle2 },
                    { label:'إجمالي العقود', value:`${rows.length}`, sub:'كل العقود', color:'amber', icon:FileText },
                    { label:'منجزة', value:`${fmt(totalCompleted)} ﷼`, sub:'', color:'blue', icon:Briefcase },
                ].map(({ label, value, sub, color, icon:Icon }) => (
                    <div key={label} className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Icon size={14} className={`text-${color}-500`} />
                            <span className="text-[11px] font-bold text-slate-500 dark:text-brand-400">{label}</span>
                        </div>
                        <p className={`text-xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
                        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
                    </div>
                ))}
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        placeholder="بحث بالمقاول أو رقم العقد أو نوع العمل..."
                        className={`${inp} pr-9`} />
                </div>
                <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع الحالات</option>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={projectF} onChange={e => setProjectF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع المشاريع</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {/* الجدول */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">لا توجد عقود</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                    {['رقم العقد','المقاول','نوع العمل','المشروع','القيمة','الدفعة المقدمة','تاريخ الانتهاء','الحالة',''].map(h => (
                                        <th key={h} className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                {filtered.map(r => {
                                    const s = statusOf(r.status);
                                    const Icon = s.icon;
                                    return (
                                        <tr key={r.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition">
                                            <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100 font-mono text-[12px]">{r.contract_no || `—`}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-[13px] text-brand-800 dark:text-brand-100">{r.contractor_name}</p>
                                                {r.contractor_phone && <p className="text-[11px] text-slate-400">{r.contractor_phone}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">{r.work_type || '—'}</td>
                                            <td className="px-4 py-3 text-[12px] text-brand-600 dark:text-brand-300">{r.project_name || '—'}</td>
                                            <td className="px-4 py-3 font-black text-brand-800 dark:text-brand-100 text-[13px]" dir="ltr">{fmt(r.contract_value)} ﷼</td>
                                            <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400" dir="ltr">{fmt(r.advance_amount)} ﷼</td>
                                            <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-brand-400">{r.end_date || '—'}</td>
                                            <td className="px-4 py-3">
                                                <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                                                    className={`text-[11px] font-black rounded-full px-2.5 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-amber-400 ${s.cls}`}>
                                                    {STATUS_OPTS.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => openEdit(r)}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition">
                                                    <Edit2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={close}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-brand-100/70 dark:border-brand-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700 shrink-0">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{form.id ? 'تعديل العقد' : 'عقد جديد'}</h3>
                            <button onClick={close} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto">

                            {/* المقاول */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المقاول / الشركة *</label>
                                    <input value={form.contractor_name} onChange={e => set('contractor_name', e.target.value)}
                                        placeholder="اسم المقاول..." className={inp} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الجوال</label>
                                    <input value={form.contractor_phone} onChange={e => set('contractor_phone', e.target.value)}
                                        placeholder="05xxxxxxxx" className={inp} dir="ltr" />
                                </div>
                            </div>

                            {/* المشروع + نوع العمل */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المشروع</label>
                                    <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className={inp}>
                                        <option value="">— اختر المشروع</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">نوع العمل</label>
                                    <select value={form.work_type} onChange={e => set('work_type', e.target.value)} className={inp}>
                                        <option value="">— اختر النوع</option>
                                        {WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* القيم المالية */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">قيمة العقد (ريال) *</label>
                                    <input type="number" value={form.contract_value} onChange={e => set('contract_value', e.target.value)}
                                        placeholder="0.00" className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الدفعة المقدمة (ريال)</label>
                                    <input type="number" value={form.advance_amount} onChange={e => set('advance_amount', e.target.value)}
                                        placeholder="0.00" className={inp} dir="ltr" />
                                </div>
                            </div>

                            {/* التواريخ */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ البدء</label>
                                    <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الانتهاء</label>
                                    <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* ملاحظات */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                                    rows={2} placeholder="ملاحظات..." className={`${inp} resize-none`} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 pb-5 pt-2 shrink-0 border-t border-brand-100/70 dark:border-brand-700">
                            <button onClick={close}
                                className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm transition">
                                إلغاء
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin" />} حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
