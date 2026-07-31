import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, Plus, Search, Edit2, Loader2, X, Trash2,
    CheckCircle2, Receipt, Calendar, DollarSign, Filter,
    Building, Phone, RotateCcw, BadgeCheck, Clock, AlertCircle
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const REV_TYPES = [
    { value:'sale',       label:'بيع وحدة',       color:'emerald' },
    { value:'rental',     label:'إيجار',           color:'blue'    },
    { value:'service',    label:'خدمات وصيانة',    color:'purple'  },
    { value:'commission', label:'عمولة',           color:'amber'   },
    { value:'deposit',    label:'عربون / تأمين',   color:'cyan'    },
    { value:'installment',label:'دفعة أقساط',      color:'teal'    },
    { value:'other',      label:'أخرى',            color:'gray'    },
];

const PAYMENT_METHODS = [
    { value:'bank',   label:'تحويل بنكي' },
    { value:'cash',   label:'نقداً'      },
    { value:'cheque', label:'شيك'        },
    { value:'pos',    label:'POS'        },
];

const STATUS_OPTS = [
    { value:'received', label:'مستلم',   icon:BadgeCheck,   cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value:'expected', label:'متوقع',   icon:Clock,        cls:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'             },
    { value:'partial',  label:'جزئي',    icon:AlertCircle,  cls:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'         },
    { value:'cancelled',label:'ملغي',    icon:X,            cls:'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'                 },
];

const typeOf   = (v) => REV_TYPES.find(t => t.value === v) || REV_TYPES[REV_TYPES.length-1];
const pmOf     = (v) => PAYMENT_METHODS.find(p => p.value === v)?.label || v;
const statusOf = (v) => STATUS_OPTS.find(s => s.value === v) || STATUS_OPTS[0];
const fmt = (n) => Number(n||0).toLocaleString('ar-SA', { minimumFractionDigits:2, maximumFractionDigits:2 });
const today = () => new Date().toISOString().split('T')[0];

const COLOR_MAP = {
    emerald:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    cyan:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    teal:   'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    gray:   'bg-gray-100 text-gray-700 dark:bg-brand-700 dark:text-brand-300',
};

const EMPTY = {
    id:null, type:'sale', description:'', amount:'', vat_amount:'',
    revenue_date:today(), payment_method:'bank', client_name:'',
    client_phone:'', project_id:'', ref_no:'', status:'received', notes:'',
};

export default function RevenuesTracker() {
    const [rows, setRows]         = useState([]);
    const [projects, setProjects] = useState([]);
    const [summary, setSummary]   = useState({});
    const [loading, setLoading]   = useState(true);
    const [modal, setModal]       = useState(false);
    const [form, setForm]         = useState(EMPTY);
    const [saving, setSaving]     = useState(false);
    const [delId, setDelId]       = useState(null);
    const [search, setSearch]     = useState('');
    const [filterType, setFilterType]     = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterProj, setFilterProj]     = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [rRes, pRes] = await Promise.all([
                apiPost('re_revenues_list', {}),
                apiGet('re_projects_list'),
            ]);
            setRows(rRes.rows || []);
            setSummary(rRes.summary || {});
            setProjects(pRes.rows || pRes || []);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAdd  = () => { setForm(EMPTY); setModal(true); };
    const openEdit = (r) => {
        setForm({
            id:r.id, type:r.type||'sale', description:r.description||'',
            amount:r.amount||'', vat_amount:r.vat_amount||'',
            revenue_date:r.revenue_date||today(),
            payment_method:r.payment_method||'bank',
            client_name:r.client_name||'', client_phone:r.client_phone||'',
            project_id:r.project_id||'', ref_no:r.ref_no||'',
            status:r.status||'received', notes:r.notes||'',
        });
        setModal(true);
    };

    const setF = (k, v) => {
        setForm(prev => {
            const next = { ...prev, [k]: v };
            if (k === 'amount') {
                next.vat_amount = v ? (parseFloat(v) * 0.15).toFixed(2) : '';
            }
            return next;
        });
    };

    const save = async () => {
        if (!form.description.trim() || !form.amount || !form.revenue_date) return;
        setSaving(true);
        try {
            await apiPost('re_revenue_save', {
                ...form,
                amount:     parseFloat(form.amount) || 0,
                vat_amount: parseFloat(form.vat_amount) || 0,
                project_id: form.project_id || null,
            });
            setModal(false);
            load();
        } catch(e) { console.error(e); }
        finally { setSaving(false); }
    };

    const del = async (id) => {
        setDelId(id);
        try { await apiPost('re_revenue_delete', { id }); load(); }
        catch(e) { console.error(e); }
        finally { setDelId(null); }
    };

    const filtered = rows.filter(r => {
        if (filterType   && r.type    !== filterType)   return false;
        if (filterStatus && r.status  !== filterStatus) return false;
        if (filterProj   && String(r.project_id) !== filterProj) return false;
        if (search) {
            const q = search.toLowerCase();
            return (r.description||'').toLowerCase().includes(q) ||
                   (r.client_name||'').toLowerCase().includes(q) ||
                   (r.ref_no||'').toLowerCase().includes(q);
        }
        return true;
    });

    const filteredTotal = filtered.reduce((s, r) => s + Number(r.total_amount||0), 0);

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-brand-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-emerald-500" />
                        الإيرادات
                    </h1>
                    <p className="text-sm text-brand-500 mt-0.5">تتبع جميع مصادر الدخل والإيرادات</p>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
                    <Plus className="w-4 h-4" /> إضافة إيراد
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label:'إجمالي الإيرادات', value:summary.grand_total||0, icon:TrendingUp, color:'emerald' },
                    { label:'هذا الشهر',        value:summary.month_total||0,  icon:Calendar,   color:'blue'    },
                    { label:'ضريبة القيمة المضافة', value:summary.total_vat||0, icon:Receipt,  color:'purple'  },
                    { label:'المعروض حالياً',    value:filteredTotal,           icon:Filter,     color:'amber'   },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white dark:bg-brand-800 rounded-xl p-4 border border-brand-200 dark:border-brand-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-brand-500">{label}</span>
                            <Icon className={`w-4 h-4 text-${color}-500`} />
                        </div>
                        <p className="text-xl font-bold text-brand-900 dark:text-white">{fmt(value)} ر.س</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-brand-800 rounded-xl border border-brand-200 dark:border-brand-700 p-4">
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute right-3 top-2.5 w-4 h-4 text-brand-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث بالوصف أو العميل أو المرجع..."
                            className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                    </div>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white px-3 py-2">
                        <option value="">كل الأنواع</option>
                        {REV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white px-3 py-2">
                        <option value="">كل الحالات</option>
                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={filterProj} onChange={e => setFilterProj(e.target.value)}
                        className="text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white px-3 py-2">
                        <option value="">كل المشاريع</option>
                        {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                    {(search || filterType || filterStatus || filterProj) && (
                        <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterProj(''); }}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-brand-500 hover:text-brand-700 border border-brand-200 dark:border-brand-600 rounded-lg">
                            <RotateCcw className="w-3.5 h-3.5" /> إعادة تعيين
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-brand-800 rounded-xl border border-brand-200 dark:border-brand-700 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-brand-400">
                        <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>لا توجد إيرادات مسجلة</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900">
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">التاريخ</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">النوع</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">الوصف</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">العميل</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">المشروع</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">المبلغ</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">الضريبة</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">الإجمالي</th>
                                    <th className="text-right px-4 py-3 font-medium text-brand-500">الحالة</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => {
                                    const typ = typeOf(r.type);
                                    const st  = statusOf(r.status);
                                    return (
                                        <tr key={r.id}
                                            className="border-b border-brand-100 dark:border-brand-700/50 hover:bg-brand-50 dark:hover:bg-brand-700/30 group transition-colors">
                                            <td className="px-4 py-3 text-brand-600 dark:text-brand-300 whitespace-nowrap">{r.revenue_date}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_MAP[typ.color]}`}>
                                                    {typ.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-brand-900 dark:text-white max-w-[180px] truncate">{r.description}</td>
                                            <td className="px-4 py-3 text-brand-600 dark:text-brand-300">
                                                {r.client_name || '—'}
                                                {r.client_phone && <span className="block text-xs text-brand-400">{r.client_phone}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-brand-600 dark:text-brand-300 text-xs">{r.project_name || '—'}</td>
                                            <td className="px-4 py-3 text-brand-900 dark:text-white font-medium whitespace-nowrap">{fmt(r.amount)}</td>
                                            <td className="px-4 py-3 text-purple-600 dark:text-purple-400 whitespace-nowrap">{fmt(r.vat_amount)}</td>
                                            <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">{fmt(r.total_amount)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEdit(r)}
                                                        className="p-1.5 rounded hover:bg-brand-100 dark:hover:bg-brand-600 text-brand-500">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => del(r.id)} disabled={delId === r.id}
                                                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500">
                                                        {delId === r.id
                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-brand-50 dark:bg-brand-900 border-t-2 border-brand-300 dark:border-brand-600">
                                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-brand-600 dark:text-brand-300">
                                        المجموع ({filtered.length} سجل)
                                    </td>
                                    <td className="px-4 py-3 font-bold text-brand-900 dark:text-white whitespace-nowrap">
                                        {fmt(filtered.reduce((s,r) => s+Number(r.amount||0), 0))} ر.س
                                    </td>
                                    <td className="px-4 py-3 font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                        {fmt(filtered.reduce((s,r) => s+Number(r.vat_amount||0), 0))} ر.س
                                    </td>
                                    <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                        {fmt(filteredTotal)} ر.س
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-brand-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-brand-200 dark:border-brand-700">
                            <h2 className="text-lg font-bold text-brand-900 dark:text-white">
                                {form.id ? 'تعديل إيراد' : 'إضافة إيراد جديد'}
                            </h2>
                            <button onClick={() => setModal(false)}
                                className="p-2 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-700 text-brand-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Row 1 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">النوع</label>
                                    <select value={form.type} onChange={e => setF('type', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white">
                                        {REV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">الحالة</label>
                                    <select value={form.status} onChange={e => setF('status', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white">
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">الوصف *</label>
                                <input value={form.description} onChange={e => setF('description', e.target.value)}
                                    placeholder="وصف الإيراد..."
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                            </div>

                            {/* Amounts */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">المبلغ (قبل الضريبة) *</label>
                                    <input type="number" min="0" step="0.01" value={form.amount}
                                        onChange={e => setF('amount', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">ضريبة 15% (ر.س)</label>
                                    <input type="number" min="0" step="0.01" value={form.vat_amount}
                                        onChange={e => setF('vat_amount', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">الإجمالي</label>
                                    <div className="px-3 py-2 text-sm rounded-lg border border-brand-100 dark:border-brand-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold">
                                        {fmt((parseFloat(form.amount)||0) + (parseFloat(form.vat_amount)||0))} ر.س
                                    </div>
                                </div>
                            </div>

                            {/* Date + Payment */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">التاريخ *</label>
                                    <input type="date" value={form.revenue_date} onChange={e => setF('revenue_date', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">طريقة الدفع</label>
                                    <select value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white">
                                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Client */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">اسم العميل</label>
                                    <input value={form.client_name} onChange={e => setF('client_name', e.target.value)}
                                        placeholder="اسم العميل أو الجهة..."
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">رقم الجوال</label>
                                    <input value={form.client_phone} onChange={e => setF('client_phone', e.target.value)}
                                        placeholder="05XXXXXXXX"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                            </div>

                            {/* Project + Ref */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">المشروع</label>
                                    <select value={form.project_id} onChange={e => setF('project_id', e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white">
                                        <option value="">بدون مشروع</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">رقم المرجع</label>
                                    <input value={form.ref_no} onChange={e => setF('ref_no', e.target.value)}
                                        placeholder="رقم الفاتورة / العقد..."
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white" />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-brand-700 dark:text-brand-300 mb-1">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={3}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-white resize-none" />
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-brand-200 dark:border-brand-700 justify-end">
                            <button onClick={() => setModal(false)}
                                className="px-4 py-2 text-sm rounded-lg border border-brand-200 dark:border-brand-600 text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-700">
                                إلغاء
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {form.id ? 'حفظ التعديلات' : 'إضافة الإيراد'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
