import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingDown, Plus, Search, Edit2, Loader2, X, Trash2,
    CheckCircle2, Receipt, Calendar, DollarSign, Filter,
    Building, CreditCard, Banknote, RotateCcw
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const CATEGORIES = [
    { value:'contractors', label:'مقاولون',          color:'amber'   },
    { value:'materials',   label:'مواد ومشتريات',    color:'blue'    },
    { value:'labor',       label:'أيدي عاملة',        color:'purple'  },
    { value:'equipment',   label:'معدات وإيجار',      color:'cyan'    },
    { value:'utilities',   label:'مرافق وخدمات',      color:'teal'    },
    { value:'permits',     label:'تصاريح ورسوم',      color:'rose'    },
    { value:'consulting',  label:'استشارات وهندسة',   color:'indigo'  },
    { value:'marketing',   label:'تسويق ومبيعات',     color:'pink'    },
    { value:'admin',       label:'إدارية وتشغيلية',   color:'slate'   },
    { value:'other',       label:'أخرى',              color:'gray'    },
];

const PAYMENT_METHODS = [
    { value:'cash',   label:'نقداً'      },
    { value:'bank',   label:'تحويل بنكي' },
    { value:'credit', label:'آجل'        },
    { value:'cheque', label:'شيك'        },
];

const catOf  = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[CATEGORIES.length-1];
const pmOf   = (v) => PAYMENT_METHODS.find(p => p.value === v)?.label || v;

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400';

const today  = () => new Date().toISOString().slice(0,10);
const fmtNum = (n) => Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:0});
const EMPTY  = { description:'', category:'other', amount:'', vat_amount:'', expense_date:today(), payment_method:'cash', supplier_name:'', project_id:'', ref_no:'', notes:'' };

const CAT_COLORS = {
    amber:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    blue:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    purple:'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    cyan:'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    teal:'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    rose:'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    indigo:'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    pink:'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    slate:'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300',
    gray:'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300',
};

export default function ExpensesTracker({ showToast }) {
    const [rows,     setRows]     = useState([]);
    const [projects, setProjects] = useState([]);
    const [summary,  setSummary]  = useState({});
    const [loading,  setLoading]  = useState(true);
    const [q,        setQ]        = useState('');
    const [catF,     setCatF]     = useState('');
    const [projectF, setProjectF] = useState('');
    const [modal,    setModal]    = useState(false);
    const [form,     setForm]     = useState(EMPTY);
    const [saving,   setSaving]   = useState(false);
    const [deleting, setDeleting] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            apiPost('re_expenses_list', {}),
            fetch('/api.php?action=get_projects_data').then(r=>r.json()),
        ])
            .then(([ed, pd]) => {
                if (ed.success) { setRows(ed.expenses||[]); setSummary(ed.summary||{}); }
                if (pd.success) setProjects(pd.data||[]);
            })
            .catch(()=>{})
            .finally(()=>setLoading(false));
    }, []);

    useEffect(()=>{ load(); },[load]);

    const openNew  = () => { setForm(EMPTY); setModal(true); };
    const openEdit = (r) => { setForm({...r, amount:r.amount?.toString()||'', vat_amount:r.vat_amount?.toString()||''}); setModal(true); };
    const close    = () => { setModal(false); setForm(EMPTY); };
    const set      = (k,v) => setForm(f=>({...f,[k]:v}));

    const vatAmt = () => {
        const a = parseFloat(form.amount)||0;
        if (form.vat_amount !== '') return parseFloat(form.vat_amount)||0;
        return Math.round(a*0.15*100)/100;
    };
    const totalAmt = () => (parseFloat(form.amount)||0) + vatAmt();

    const handleSave = async () => {
        if (!form.description.trim()) { showToast?.('خطأ','الوصف مطلوب'); return; }
        if (!parseFloat(form.amount)) { showToast?.('خطأ','المبلغ مطلوب'); return; }
        setSaving(true);
        const d = await apiPost('re_expense_save', {
            ...form,
            amount:     parseFloat(form.amount)||0,
            vat_amount: vatAmt(),
            total_amount: totalAmt(),
        });
        if (d.success) { showToast?.('تم حفظ المصروف'); close(); load(); }
        else showToast?.('خطأ', d.message||'فشل الحفظ');
        setSaving(false);
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        const d = await apiPost('re_expense_delete', { id });
        if (d.success) { showToast?.('تم الحذف'); load(); }
        else showToast?.('خطأ','فشل الحذف');
        setDeleting(null);
    };

    const filtered = rows.filter(r => {
        const qm = !q || [r.description, r.supplier_name, r.project_name, r.ref_no].some(v=>v?.toLowerCase().includes(q.toLowerCase()));
        const cm = !catF    || r.category === catF;
        const pm = !projectF|| String(r.project_id) === projectF;
        return qm && cm && pm;
    });

    const filteredTotal = filtered.reduce((s,r)=>s+(+r.total_amount),0);

    return (
        <div className="animate-fadeIn p-5 md:p-8 max-w-7xl mx-auto space-y-6">

            {/* رأس */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                        <TrendingDown size={22} className="text-red-500"/> المصروفات والتكاليف
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.length} قيد مصروف</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-red-500/20">
                    <Plus size={16}/> مصروف جديد
                </button>
            </div>

            {/* ملخص */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label:'إجمالي المصروفات',  value:`${fmtNum(summary.grand_total)} ﷼`, color:'red'     },
                    { label:'مصروفات هذا الشهر', value:`${fmtNum(summary.month_total)} ﷼`, color:'amber'   },
                    { label:'ضريبة القيمة المضافة',value:`${fmtNum(summary.total_vat)} ﷼`, color:'purple'  },
                    { label:'المعروض حالياً',     value:`${fmtNum(filteredTotal)} ﷼`,       color:'slate'   },
                ].map(({label,value,color})=>(
                    <div key={label} className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-4 shadow-sm">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-brand-400 mb-1">{label}</p>
                        <p className={`text-lg font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400"/>
                    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالوصف أو المورد أو المشروع..."
                        className={`${inp} pr-9`}/>
                </div>
                <select value={catF} onChange={e=>setCatF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع التصنيفات</option>
                    {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={projectF} onChange={e=>setProjectF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع المشاريع</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {(q||catF||projectF) && (
                    <button onClick={()=>{setQ('');setCatF('');setProjectF('');}}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-500 px-3 py-2 rounded-xl border border-brand-100 dark:border-brand-700 bg-white dark:bg-brand-900 transition">
                        <RotateCcw size={13}/> مسح
                    </button>
                )}
            </div>

            {/* الجدول */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-red-400" size={32}/></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <TrendingDown size={40} className="mx-auto mb-3 opacity-20"/>
                        <p className="font-bold">لا توجد مصروفات</p>
                        <button onClick={openNew} className="mt-3 text-sm text-red-500 font-bold hover:underline">+ أضف أول مصروف</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                    {['التاريخ','الوصف','التصنيف','المشروع','المورد','المبلغ','الضريبة','الإجمالي','طريقة الدفع',''].map(h=>(
                                        <th key={h} className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                {filtered.map(r=>{
                                    const cat = catOf(r.category);
                                    return (
                                        <tr key={r.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition group">
                                            <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400 whitespace-nowrap">{r.expense_date}</td>
                                            <td className="px-4 py-3 max-w-[200px]">
                                                <p className="font-bold text-[13px] text-brand-800 dark:text-brand-100 truncate">{r.description}</p>
                                                {r.ref_no && <p className="text-[10px] text-slate-400 font-mono">{r.ref_no}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[cat.color]||CAT_COLORS.gray}`}>{cat.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[12px] text-brand-600 dark:text-brand-300">{r.project_name||'—'}</td>
                                            <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">{r.supplier_name||'—'}</td>
                                            <td className="px-4 py-3 font-bold text-[13px] text-brand-800 dark:text-brand-100" dir="ltr">{fmtNum(r.amount)} ﷼</td>
                                            <td className="px-4 py-3 text-[12px] text-purple-600 dark:text-purple-400" dir="ltr">{fmtNum(r.vat_amount)} ﷼</td>
                                            <td className="px-4 py-3 font-black text-[13px] text-red-600 dark:text-red-400" dir="ltr">{fmtNum(r.total_amount)} ﷼</td>
                                            <td className="px-4 py-3 text-[12px] text-slate-400">{pmOf(r.payment_method)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={()=>openEdit(r)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 transition">
                                                        <Edit2 size={13}/>
                                                    </button>
                                                    <button onClick={()=>handleDelete(r.id)} disabled={deleting===r.id}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition">
                                                        {deleting===r.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-red-50/50 dark:bg-red-500/5 border-t-2 border-red-100 dark:border-red-500/20">
                                    <td colSpan={5} className="px-4 py-3 text-xs font-black text-slate-500 dark:text-brand-400">المجموع ({filtered.length} قيد)</td>
                                    <td className="px-4 py-3 font-black text-[13px] text-brand-800 dark:text-brand-100" dir="ltr">
                                        {fmtNum(filtered.reduce((s,r)=>s+(+r.amount),0))} ﷼
                                    </td>
                                    <td className="px-4 py-3 font-black text-[13px] text-purple-600" dir="ltr">
                                        {fmtNum(filtered.reduce((s,r)=>s+(+r.vat_amount),0))} ﷼
                                    </td>
                                    <td className="px-4 py-3 font-black text-[13px] text-red-600" dir="ltr">
                                        {fmtNum(filteredTotal)} ﷼
                                    </td>
                                    <td colSpan={2}/>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={close}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-xl border border-brand-100/70 dark:border-brand-700 max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700 shrink-0">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{form.id ? 'تعديل المصروف' : 'مصروف جديد'}</h3>
                            <button onClick={close} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18}/></button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto">

                            {/* الوصف */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">الوصف / البيان *</label>
                                <input value={form.description} onChange={e=>set('description',e.target.value)}
                                    placeholder="وصف المصروف..." className={inp} autoFocus/>
                            </div>

                            {/* التصنيف + المشروع */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">التصنيف</label>
                                    <select value={form.category} onChange={e=>set('category',e.target.value)} className={inp}>
                                        {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المشروع</label>
                                    <select value={form.project_id} onChange={e=>set('project_id',e.target.value)} className={inp}>
                                        <option value="">— بدون مشروع</option>
                                        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* المبالغ */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ (قبل الضريبة) *</label>
                                    <input type="number" value={form.amount} onChange={e=>set('amount',e.target.value)}
                                        placeholder="0.00" className={inp} dir="ltr" min="0" step="0.01"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ضريبة 15%</label>
                                    <input type="number" value={form.vat_amount !== '' ? form.vat_amount : Math.round((parseFloat(form.amount)||0)*0.15*100)/100}
                                        onChange={e=>set('vat_amount',e.target.value)}
                                        placeholder="تلقائي" className={`${inp} bg-purple-50/50 dark:bg-purple-500/5`} dir="ltr" min="0" step="0.01"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الإجمالي</label>
                                    <div className={`${inp} bg-red-50/50 dark:bg-red-500/5 font-black text-red-600 dark:text-red-400`} dir="ltr">
                                        {fmtNum(totalAmt())} ﷼
                                    </div>
                                </div>
                            </div>

                            {/* التاريخ + طريقة الدفع */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ المصروف *</label>
                                    <input type="date" value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} className={inp} dir="ltr"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">طريقة الدفع</label>
                                    <select value={form.payment_method} onChange={e=>set('payment_method',e.target.value)} className={inp}>
                                        {PAYMENT_METHODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* المورد + المرجع */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المورد / الجهة</label>
                                    <input value={form.supplier_name} onChange={e=>set('supplier_name',e.target.value)}
                                        placeholder="اسم المورد..." className={inp}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الفاتورة / المرجع</label>
                                    <input value={form.ref_no} onChange={e=>set('ref_no',e.target.value)}
                                        placeholder="INV-001..." className={inp} dir="ltr"/>
                                </div>
                            </div>

                            {/* ملاحظات */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                                <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
                                    rows={2} placeholder="ملاحظات..." className={`${inp} resize-none`}/>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 pb-5 pt-2 shrink-0 border-t border-brand-100/70 dark:border-brand-700">
                            <button onClick={close} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm">إلغاء</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin"/>} حفظ المصروف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
