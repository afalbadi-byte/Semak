import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Loader2, Mail, Phone, Building2, X, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const STATUS_OPTS = [
    { value: 'prospect',  label: 'محتمل',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    { value: 'active',    label: 'نشط',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value: 'inactive',  label: 'غير نشط',  cls: 'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400' },
];
const statusCls = (s) => STATUS_OPTS.find(x => x.value === s)?.cls || '';
const statusLabel = (s) => STATUS_OPTS.find(x => x.value === s)?.label || s;

const EMPTY = { name: '', company: '', email: '', phone: '', notes: '', status: 'prospect' };

function Modal({ title, onClose, onSave, saving, children }) {
    return (
        <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-lg border border-brand-100/70 dark:border-brand-700" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">{children}</div>
                <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold hover:bg-brand-200 dark:hover:bg-brand-700 transition text-sm">إلغاء</button>
                    <button onClick={onSave} disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        حفظ
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">{label}</label>
            {children}
        </div>
    );
}

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';

export default function SwClients({ showToast }) {
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [q,       setQ]       = useState('');
    const [filter,  setFilter]  = useState('');
    const [modal,   setModal]   = useState(null);  // null | 'add' | 'edit'
    const [form,    setForm]    = useState(EMPTY);
    const [saving,  setSaving]  = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        apiGet('sw_clients_list')
            .then(d => { if (d.success) setRows(d.clients || []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAdd  = () => { setForm(EMPTY); setModal('add'); };
    const openEdit = (r) => { setForm({ ...r }); setModal('edit'); };
    const closeModal = () => { setModal(null); setForm(EMPTY); };

    const handleSave = async () => {
        if (!form.name.trim()) { showToast('خطأ', 'الاسم مطلوب'); return; }
        setSaving(true);
        try {
            const d = await apiPost('sw_client_save', form);
            if (d.success) { showToast('تم حفظ العميل'); closeModal(); load(); }
            else showToast('خطأ', d.message || 'فشل الحفظ');
        } catch { showToast('خطأ', 'خطأ في الاتصال'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`حذف العميل "${name}"؟`)) return;
        const d = await apiPost('sw_client_del', { id });
        if (d.success) { showToast('تم الحذف'); load(); }
        else showToast('خطأ', d.message);
    };

    const filtered = rows.filter(r => {
        const qMatch = !q || [r.name, r.company, r.email, r.phone].some(v => v?.toLowerCase().includes(q.toLowerCase()));
        const sMatch = !filter || r.status === filter;
        return qMatch && sMatch;
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto">

            {/* رأس الصفحة */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2"><Users size={22} className="text-indigo-500" /> العملاء</h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.length} عميل في النظام</p>
                </div>
                <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-indigo-500/20">
                    <Plus size={16} /> إضافة عميل
                </button>
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الشركة أو الإيميل..." className={`${inp} pr-9`} />
                </div>
                <select value={filter} onChange={e => setFilter(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع الحالات</option>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* الجدول */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Users size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">لا يوجد عملاء</p>
                        <p className="text-sm mt-1">أضف أول عميل بالنقر على الزر أعلاه</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                    <th className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">العميل</th>
                                    <th className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">التواصل</th>
                                    <th className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">الحالة</th>
                                    <th className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">تاريخ الإضافة</th>
                                    <th className="px-4 py-3 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                {filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0">
                                                    {(r.name || '?').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-brand-800 dark:text-brand-100">{r.name}</p>
                                                    {r.company && <p className="text-[11px] text-slate-400 dark:text-brand-400 flex items-center gap-1"><Building2 size={10} /> {r.company}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-1">
                                                {r.email && <p className="text-[12px] text-slate-500 dark:text-brand-300 flex items-center gap-1.5"><Mail size={11} /> {r.email}</p>}
                                                {r.phone && <p className="text-[12px] text-slate-500 dark:text-brand-300 flex items-center gap-1.5"><Phone size={11} /> {r.phone}</p>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${statusCls(r.status)}`}>{statusLabel(r.status)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-brand-400">{r.created_at?.slice(0,10)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-300 transition"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <Modal title={modal === 'add' ? 'إضافة عميل جديد' : 'تعديل العميل'} onClose={closeModal} onSave={handleSave} saving={saving}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Field label="الاسم *">
                                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="اسم العميل" className={inp} />
                            </Field>
                        </div>
                        <Field label="الشركة">
                            <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="اسم الشركة" className={inp} />
                        </Field>
                        <Field label="الحالة">
                            <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </Field>
                        <Field label="البريد الإلكتروني">
                            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" className={inp} dir="ltr" />
                        </Field>
                        <Field label="رقم الجوال">
                            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05XXXXXXXX" className={inp} dir="ltr" />
                        </Field>
                        <div className="col-span-2">
                            <Field label="ملاحظات">
                                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="ملاحظات إضافية..." className={`${inp} resize-none`} />
                            </Field>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
