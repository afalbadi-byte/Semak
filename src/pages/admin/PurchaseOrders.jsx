import React, { useState, useEffect, useCallback } from 'react';
import {
    ShoppingCart, Plus, Search, Edit2, Loader2, X,
    Trash2, Package, CheckCircle2, Truck, XCircle
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

// ─── الحالات ─────────────────────────────────────────────────────────────────
const STATUS_OPTS = [
    { value:'draft',     label:'مسودة',         cls:'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300' },
    { value:'ordered',   label:'مُرسَل',          cls:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    { value:'partial',   label:'وصل جزئي',       cls:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { value:'received',  label:'مستلم بالكامل',   cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value:'cancelled', label:'ملغي',            cls:'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
];
const statusCls = (v) => STATUS_OPTS.find(s => s.value === v)?.cls || '';
const statusLbl = (v) => STATUS_OPTS.find(s => s.value === v)?.label || v;

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400';

const today   = () => new Date().toISOString().slice(0, 10);
const fmtNum  = (n) => Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
const emptyItem = () => ({ name:'', qty:1, unit:'', unit_price:0 });
const EMPTY = { supplier_name:'', supplier_phone:'', project_id:'', order_date:today(), delivery_date:'', status:'draft', items:[emptyItem()], notes:'' };

export default function PurchaseOrders({ showToast }) {
    const [rows,     setRows]     = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [q,        setQ]        = useState('');
    const [statusF,  setStatusF]  = useState('');
    const [projectF, setProjectF] = useState('');
    const [modal,    setModal]    = useState(false);
    const [form,     setForm]     = useState(EMPTY);
    const [saving,   setSaving]   = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            apiGet('re_purchases_list'),
            fetch('/api.php?action=get_projects_data').then(r => r.json()),
        ])
            .then(([od, pd]) => {
                if (od.success) setRows(od.orders || []);
                if (pd.success) setProjects(pd.data || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew  = () => { setForm({ ...EMPTY, items:[emptyItem()] }); setModal(true); };
    const openEdit = (r) => { setForm({ ...r, items: r.items?.length ? r.items : [emptyItem()] }); setModal(true); };
    const close    = () => { setModal(false); setForm(EMPTY); };

    const set    = (k, v)    => setForm(f => ({ ...f, [k]: v }));
    const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
    const addItem = ()        => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
    const delItem = (i)       => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

    const total = (items) => (items || []).reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseFloat(it.qty) || 0), 0);

    const handleSave = async () => {
        if (!form.supplier_name.trim()) { showToast?.('خطأ', 'اسم المورد مطلوب'); return; }
        const items = form.items.filter(it => it.name.trim());
        setSaving(true);
        const d = await apiPost('re_purchase_save', {
            ...form,
            items,
            total_amount: total(items),
        });
        if (d.success) { showToast?.('تم الحفظ'); close(); load(); }
        else showToast?.('خطأ', d.message || 'فشل الحفظ');
        setSaving(false);
    };

    const updateStatus = async (id, status) => {
        const d = await apiPost('re_purchase_save', { id, status });
        if (d.success) setRows(r => r.map(x => x.id === id ? { ...x, status } : x));
    };

    const filtered = rows.filter(r => {
        const qm = !q || [r.supplier_name, r.po_no, r.project_name]
            .some(v => v?.toLowerCase().includes(q.toLowerCase()));
        const sm = !statusF  || r.status === statusF;
        const pm = !projectF || String(r.project_id) === projectF;
        return qm && sm && pm;
    });

    const totalOrdered   = rows.filter(r => r.status === 'ordered').reduce((a, r) => a + +r.total_amount, 0);
    const totalReceived  = rows.filter(r => r.status === 'received').reduce((a, r) => a + +r.total_amount, 0);

    return (
        <div className="animate-fadeIn p-5 md:p-8 max-w-7xl mx-auto space-y-6">

            {/* رأس الصفحة */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                        <ShoppingCart size={22} className="text-amber-500" /> طلبات الشراء والمواد
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.length} طلب شراء</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-amber-500/20">
                    <Plus size={16} /> طلب شراء جديد
                </button>
            </div>

            {/* ملخص */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label:'قيد التوريد', value:`${fmtNum(totalOrdered)} ﷼`, icon:Truck, color:'blue' },
                    { label:'إجمالي الطلبات', value:`${rows.length}`, icon:ShoppingCart, color:'amber' },
                    { label:'مستلمة', value:`${fmtNum(totalReceived)} ﷼`, icon:CheckCircle2, color:'emerald' },
                ].map(({ label, value, icon:Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Icon size={14} className={`text-${color}-500`} />
                            <span className="text-[11px] font-bold text-slate-500 dark:text-brand-400">{label}</span>
                        </div>
                        <p className={`text-xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        placeholder="بحث بالمورد أو رقم الطلب..."
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
                        <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">لا توجد طلبات شراء</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                    {['رقم الطلب','المورد','المشروع','تاريخ الطلب','تاريخ التسليم','الإجمالي','الحالة',''].map(h => (
                                        <th key={h} className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                {filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition">
                                        <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100 font-mono text-[12px]">{r.po_no || '—'}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-[13px] text-brand-800 dark:text-brand-100">{r.supplier_name}</p>
                                            {r.supplier_phone && <p className="text-[11px] text-slate-400">{r.supplier_phone}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-brand-600 dark:text-brand-300">{r.project_name || '—'}</td>
                                        <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-brand-400">{r.order_date || '—'}</td>
                                        <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-brand-400">{r.delivery_date || '—'}</td>
                                        <td className="px-4 py-3 font-black text-brand-800 dark:text-brand-100 text-[13px]" dir="ltr">{fmtNum(r.total_amount)} ﷼</td>
                                        <td className="px-4 py-3">
                                            <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                                                className={`text-[11px] font-black rounded-full px-2.5 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-amber-400 ${statusCls(r.status)}`}>
                                                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => openEdit(r)}
                                                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition">
                                                <Edit2 size={14} />
                                            </button>
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
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={close}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-brand-100/70 dark:border-brand-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700 shrink-0">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{form.id ? 'تعديل الطلب' : 'طلب شراء جديد'}</h3>
                            <button onClick={close} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto">

                            {/* المورد + المشروع */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المورد *</label>
                                    <input value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)}
                                        placeholder="اسم المورد أو الشركة..." className={inp} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الجوال</label>
                                    <input value={form.supplier_phone} onChange={e => set('supplier_phone', e.target.value)}
                                        placeholder="05xxxxxxxx" className={inp} dir="ltr" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المشروع</label>
                                    <select value={form.project_id} onChange={e => set('project_id', e.target.value)} className={inp}>
                                        <option value="">— اختر المشروع</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الطلب</label>
                                    <input type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ التسليم</label>
                                    <input type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                            </div>

                            {/* البنود */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-500">البنود والمواد</label>
                                    <button onClick={addItem}
                                        className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                                        <Plus size={13} /> إضافة بند
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {/* رأس الجدول */}
                                    <div className="grid grid-cols-[1fr_80px_80px_100px_32px] gap-2 text-[10px] font-black text-slate-400 px-1">
                                        <span>البند / المادة</span><span>الكمية</span><span>الوحدة</span><span>سعر الوحدة</span><span></span>
                                    </div>
                                    {form.items.map((it, i) => (
                                        <div key={i} className="grid grid-cols-[1fr_80px_80px_100px_32px] gap-2 items-center">
                                            <input value={it.name} onChange={e => setItem(i, 'name', e.target.value)}
                                                placeholder="اسم المادة..." className={`${inp} text-xs`} />
                                            <input type="number" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)}
                                                className={`${inp} text-xs`} dir="ltr" min="1" />
                                            <input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)}
                                                placeholder="م²، طن..." className={`${inp} text-xs`} />
                                            <input type="number" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)}
                                                placeholder="0" className={`${inp} text-xs`} dir="ltr" min="0" />
                                            <button onClick={() => delItem(i)} disabled={form.items.length === 1}
                                                className="p-1 rounded-lg text-slate-300 hover:text-red-400 disabled:opacity-30 transition">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {/* الإجمالي */}
                                    <div className="flex justify-end pt-2 border-t border-brand-100/70 dark:border-brand-700">
                                        <div className="text-sm font-black text-brand-800 dark:text-brand-100">
                                            الإجمالي: <span dir="ltr" className="text-amber-600">{fmtNum(total(form.items))} ﷼</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* الحالة + ملاحظات */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                                    <input value={form.notes} onChange={e => set('notes', e.target.value)}
                                        placeholder="ملاحظات..." className={inp} />
                                </div>
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
