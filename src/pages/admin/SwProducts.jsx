import React, { useEffect, useState, useCallback } from 'react';
import { Package, Plus, Edit2, Trash2, Loader2, X, CheckCircle2, XCircle, DollarSign } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const TYPE_OPTS = [
    { value: 'software',     label: 'برنامج' },
    { value: 'subscription', label: 'اشتراك' },
    { value: 'service',      label: 'خدمة' },
    { value: 'one_time',     label: 'دفعة واحدة' },
];
const CYCLE_OPTS = [
    { value: 'monthly',  label: 'شهري' },
    { value: 'quarterly', label: 'ربع سنوي' },
    { value: 'yearly',   label: 'سنوي' },
    { value: 'one_time', label: 'مرة واحدة' },
];
const typeLabel  = (v) => TYPE_OPTS.find(x => x.value === v)?.label || v;
const cycleLabel = (v) => CYCLE_OPTS.find(x => x.value === v)?.label || v;

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';

const EMPTY = { name: '', type: 'subscription', price: '', billing_cycle: 'yearly', description: '', active: 1 };

export default function SwProducts({ showToast }) {
    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal,   setModal]   = useState(null);
    const [form,    setForm]    = useState(EMPTY);
    const [saving,  setSaving]  = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        apiGet('sw_products_list')
            .then(d => { if (d.success) setRows(d.products || []); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAdd  = () => { setForm(EMPTY); setModal(true); };
    const openEdit = (r) => { setForm({ ...r, price: r.price?.toString() || '' }); setModal(true); };
    const closeModal = () => { setModal(false); setForm(EMPTY); };

    const handleSave = async () => {
        if (!form.name.trim()) { showToast('خطأ', 'اسم المنتج مطلوب'); return; }
        setSaving(true);
        const d = await apiPost('sw_product_save', { ...form, price: parseFloat(form.price) || 0 });
        if (d.success) { showToast('تم الحفظ'); closeModal(); load(); }
        else showToast('خطأ', d.message);
        setSaving(false);
    };

    const toggleActive = async (id, active) => {
        await apiPost('sw_product_save', { id, active: active ? 0 : 1 });
        setRows(r => r.map(p => p.id === id ? { ...p, active: active ? 0 : 1 } : p));
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2"><Package size={22} className="text-emerald-500" /> المنتجات والاشتراكات</h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.filter(r => r.active).length} منتج نشط</p>
                </div>
                <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-emerald-500/20">
                    <Plus size={16} /> إضافة منتج
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700">
                    <Package size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold">لا توجد منتجات بعد</p>
                    <p className="text-sm mt-1">أضف منتجاتك وباقاتك الاشتراكية</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rows.map(p => (
                        <div key={p.id} className={`bg-white dark:bg-brand-900 rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${p.active ? 'border-brand-100/70 dark:border-brand-700' : 'border-dashed border-brand-200 dark:border-brand-700 opacity-60'}`}>
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                        <Package size={20} />
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 hover:text-emerald-600 transition"><Edit2 size={13} /></button>
                                        <button onClick={() => toggleActive(p.id, p.active)} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition">
                                            {p.active ? <XCircle size={13} className="text-red-400" /> : <CheckCircle2 size={13} className="text-emerald-500" />}
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-black text-brand-800 dark:text-brand-50 mb-1">{p.name}</h3>
                                {p.description && <p className="text-[12px] text-slate-400 dark:text-brand-400 mb-3 line-clamp-2">{p.description}</p>}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fmt(p.price)}</span>
                                        <span className="text-xs font-bold text-slate-400">﷼ / {cycleLabel(p.billing_cycle)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{typeLabel(p.type)}</span>
                                        {!p.active && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400">معطّل</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md border border-brand-100/70 dark:border-brand-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{form.id ? 'تعديل المنتج' : 'منتج جديد'}</h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المنتج *</label>
                                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="اسم الباقة أو المنتج" className={inp} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">النوع</label>
                                    <select value={form.type} onChange={e => set('type', e.target.value)} className={inp}>
                                        {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">دورة الفوترة</label>
                                    <select value={form.billing_cycle} onChange={e => set('billing_cycle', e.target.value)} className={inp}>
                                        {CYCLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">السعر (ريال)</label>
                                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" className={inp} dir="ltr" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">الوصف</label>
                                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="وصف مختصر..." className={`${inp} resize-none`} />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="active" checked={!!form.active} onChange={e => set('active', e.target.checked ? 1 : 0)} className="rounded" />
                                <label htmlFor="active" className="text-sm font-bold text-brand-700 dark:text-brand-200 cursor-pointer">منتج نشط</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                            <button onClick={closeModal} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm transition">إلغاء</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin" />} حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
