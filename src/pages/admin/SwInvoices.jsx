import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, Plus, Search, Edit2, Loader2, X, CheckCircle2, Clock, AlertCircle, FileText, Send } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const STATUS_OPTS = [
    { value: 'draft',     label: 'مسودة',    cls: 'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300' },
    { value: 'sent',      label: 'مُرسَلة',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    { value: 'paid',      label: 'مدفوعة',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value: 'overdue',   label: 'متأخرة',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
    { value: 'cancelled', label: 'ملغاة',    cls: 'bg-slate-100 text-slate-400 dark:bg-brand-800 dark:text-brand-500' },
];
const statusCls   = (s) => STATUS_OPTS.find(x => x.value === s)?.cls || '';
const statusLabel = (s) => STATUS_OPTS.find(x => x.value === s)?.label || s;

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { client_id: '', product_id: '', amount: '', status: 'draft', issue_date: today(), due_date: '', notes: '' };

const fmt     = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtSAR  = (n) => fmt(n) + ' ﷼';

export default function SwInvoices({ showToast }) {
    const [rows,     setRows]     = useState([]);
    const [clients,  setClients]  = useState([]);
    const [products, setProducts] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [q,        setQ]        = useState('');
    const [statusF,  setStatusF]  = useState('');
    const [modal,    setModal]    = useState(false);
    const [form,     setForm]     = useState(EMPTY);
    const [saving,   setSaving]   = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([apiGet('sw_invoices_list'), apiGet('sw_clients_list'), apiGet('sw_products_list')])
            .then(([id, cd, pd]) => {
                if (id.success) setRows(id.invoices || []);
                if (cd.success) setClients(cd.clients || []);
                if (pd.success) setProducts(pd.products || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew = () => { setForm(EMPTY); setModal(true); };
    const openEdit = (r) => { setForm({ ...r, amount: r.amount?.toString() || '' }); setModal(true); };
    const closeModal = () => { setModal(false); setForm(EMPTY); };

    const handleSave = async () => {
        if (!form.amount || isNaN(+form.amount)) { showToast('خطأ', 'المبلغ مطلوب'); return; }
        setSaving(true);
        const d = await apiPost('sw_invoice_save', { ...form, amount: parseFloat(form.amount) || 0 });
        if (d.success) { showToast('تم الحفظ'); closeModal(); load(); }
        else showToast('خطأ', d.message);
        setSaving(false);
    };

    const updateStatus = async (id, status) => {
        const d = await apiPost('sw_invoice_save', { id, status, paid_date: status === 'paid' ? today() : null });
        if (d.success) setRows(r => r.map(x => x.id === id ? { ...x, status } : x));
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // إذا تم اختيار منتج، اقتراح سعره تلقائياً
    const onProductChange = (pid) => {
        set('product_id', pid);
        if (pid) {
            const p = products.find(x => String(x.id) === String(pid));
            if (p) set('amount', p.price?.toString() || '');
        }
    };

    const filtered = rows.filter(r => {
        const qm = !q || [r.invoice_no, r.client_name, r.product_name].some(v => v?.toLowerCase().includes(q.toLowerCase()));
        const sm = !statusF || r.status === statusF;
        return qm && sm;
    });

    // ملخص
    const totalPaid    = rows.filter(r => r.status === 'paid').reduce((a, r) => a + +r.amount, 0);
    const totalOverdue = rows.filter(r => r.status === 'overdue').reduce((a, r) => a + +r.amount, 0);
    const totalPending = rows.filter(r => r.status === 'sent').reduce((a, r) => a + +r.amount, 0);

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto space-y-6">

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2"><Receipt size={22} className="text-amber-500" /> الفواتير والإيرادات</h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.length} فاتورة</p>
                </div>
                <button onClick={openNew} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-amber-500/20">
                    <Plus size={16} /> فاتورة جديدة
                </button>
            </div>

            {/* ملخص مالي */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'مقبوضة', value: fmtSAR(totalPaid), icon: CheckCircle2, color: 'emerald' },
                    { label: 'قيد الانتظار', value: fmtSAR(totalPending), icon: Clock, color: 'blue' },
                    { label: 'متأخرة', value: fmtSAR(totalOverdue), icon: AlertCircle, color: 'red' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-4 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Icon size={14} className={`text-${color}-500`} />
                            <span className="text-[11px] font-bold text-slate-500 dark:text-brand-400">{label}</span>
                        </div>
                        <p className={`text-xl font-black text-${color}-600 dark:text-${color}-400`} dir="ltr">{value}</p>
                    </div>
                ))}
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برقم الفاتورة أو العميل..." className={`${inp} pr-9`} />
                </div>
                <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع الحالات</option>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* الجدول */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Receipt size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">لا توجد فواتير</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                    {['رقم الفاتورة', 'العميل', 'المنتج', 'المبلغ', 'تاريخ الاستحقاق', 'الحالة', ''].map(h => (
                                        <th key={h} className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                {filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition">
                                        <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100 font-mono text-[12px]">{r.invoice_no || `INV-${String(r.id).padStart(4,'0')}`}</td>
                                        <td className="px-4 py-3 text-[13px] text-brand-700 dark:text-brand-200">{r.client_name || '—'}</td>
                                        <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">{r.product_name || '—'}</td>
                                        <td className="px-4 py-3 font-black text-brand-800 dark:text-brand-100" dir="ltr">{fmtSAR(r.amount)}</td>
                                        <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-brand-400">{r.due_date || '—'}</td>
                                        <td className="px-4 py-3">
                                            <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                                                className={`text-[11px] font-black rounded-full px-2.5 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-amber-400 ${statusCls(r.status)}`}>
                                                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition"><Edit2 size={14} /></button>
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
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-lg border border-brand-100/70 dark:border-brand-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{form.id ? 'تعديل الفاتورة' : 'فاتورة جديدة'}</h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">العميل</label>
                                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inp}>
                                    <option value="">اختر العميل</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` - ${c.company}` : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">المنتج / الخدمة</label>
                                <select value={form.product_id} onChange={e => onProductChange(e.target.value)} className={inp}>
                                    <option value="">اختر المنتج (اختياري)</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - {fmt(p.price)} ﷼</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ (ريال) *</label>
                                    <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الإصدار</label>
                                    <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الاستحقاق</label>
                                    <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inp} dir="ltr" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="ملاحظات..." className={`${inp} resize-none`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                            <button onClick={closeModal} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm transition">إلغاء</button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin" />} حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
