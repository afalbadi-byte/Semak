import React, { useState, useEffect, useCallback } from 'react';
import {
    ScrollText, Search, RefreshCw, ChevronRight, ChevronLeft,
    LogIn, ShieldAlert, Plus, Pencil, Trash2, Eye, Filter, X, Activity
} from 'lucide-react';
import { apiPost, TENANT } from '../../lib/api/client';

// ─── خرائط العرض بالعربي ─────────────────────────────────────────────────────
const ENTITY_LABELS = {
    auth: 'الدخول', maintenance: 'الصيانة', lead: 'العملاء المحتملون',
    invoice: 'الفواتير', payment: 'المدفوعات', entry: 'القيود',
    party: 'الأطراف', user: 'المستخدمون', app: 'النظام',
};
const ACTION_META = {
    login:      { label: 'تسجيل دخول',  icon: LogIn,      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
    login_fail: { label: 'دخول فاشل',   icon: ShieldAlert,cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30' },
    create:     { label: 'إنشاء',       icon: Plus,       cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    update:     { label: 'تعديل',       icon: Pencil,     cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30' },
    delete:     { label: 'حذف',         icon: Trash2,     cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    view:       { label: 'عرض',         icon: Eye,        cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' },
};
const actionMeta = (a) => ACTION_META[a] || { label: a || '—', icon: Activity, cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' };

const fmtDate = (s) => {
    if (!s) return '—';
    try {
        const d = new Date(s.replace(' ', 'T'));
        if (isNaN(d)) return s;
        return d.toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
};

const PER = 50;

export default function ActivityLog() {
    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(true);
    const [q, setQ]             = useState('');
    const [entity, setEntity]   = useState('');
    const [action, setAction]   = useState('');
    const [from, setFrom]       = useState('');
    const [to, setTo]           = useState('');

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const res = await apiPost('activity_log', {
                q, entity, action, from, to, page: p, per: PER,
            }, {}, { tenant: TENANT });
            if (res.success) {
                setRows(res.data || []);
                setTotal(res.total || 0);
                setPage(res.page || p);
            }
        } catch { /* صامت */ }
        finally { setLoading(false); }
    }, [q, entity, action, from, to]);

    useEffect(() => { load(1); }, []); // أول تحميل

    const applyFilters = () => load(1);
    const reset = () => { setQ(''); setEntity(''); setAction(''); setFrom(''); setTo(''); setTimeout(() => load(1), 0); };

    const pages = Math.max(1, Math.ceil(total / PER));

    return (
        <div className="animate-fadeIn max-w-6xl mx-auto">
            {/* رأس الصفحة */}
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-card border border-brand-100/70 dark:border-brand-700 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40 flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-3">
                            <ScrollText className="text-gold-500" /> سجل النشاط
                        </h3>
                        <p className="text-slate-500 dark:text-brand-300 text-sm mt-1">تتبّع كل عمليات الدخول والإنشاء والتعديل والحذف في المنصّة.</p>
                    </div>
                    <button onClick={() => load(page)} className="btn btn-ghost px-4 py-2.5 flex items-center gap-2" disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
                    </button>
                </div>

                {/* المرشحات */}
                <div className="p-4 md:p-6 border-b border-brand-100/70 dark:border-brand-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="relative lg:col-span-2">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={q} onChange={e => setQ(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyFilters()}
                            placeholder="بحث في التفاصيل أو المستخدم…"
                            className="input w-full pr-9 py-2.5 text-sm"
                        />
                    </div>
                    <select value={entity} onChange={e => setEntity(e.target.value)} className="input py-2.5 text-sm">
                        <option value="">كل الأقسام</option>
                        {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={action} onChange={e => setAction(e.target.value)} className="input py-2.5 text-sm">
                        <option value="">كل العمليات</option>
                        {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input py-2.5 text-sm" title="من تاريخ" />
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input py-2.5 text-sm" title="إلى تاريخ" />
                    <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
                        <button onClick={applyFilters} className="btn btn-primary px-5 py-2.5 flex items-center gap-2 text-sm">
                            <Filter size={15} /> تطبيق
                        </button>
                        <button onClick={reset} className="btn btn-ghost px-4 py-2.5 flex items-center gap-2 text-sm">
                            <X size={15} /> مسح
                        </button>
                        <div className="flex-1" />
                        <span className="self-center text-xs font-bold text-slate-400 dark:text-brand-400">{total.toLocaleString('ar-SA')} حدث</span>
                    </div>
                </div>

                {/* الجدول */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400 dark:text-brand-400">
                            <RefreshCw className="animate-spin mx-auto mb-3" size={30} />
                            <p className="text-sm font-bold">جاري التحميل…</p>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 dark:text-brand-400">
                            <ScrollText size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">لا توجد أحداث مطابقة</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-brand-50/60 dark:bg-brand-800/40 text-slate-500 dark:text-brand-300 text-[11px] font-black">
                                    <th className="text-right px-4 py-3 whitespace-nowrap">الوقت</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">المستخدم</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">القسم</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">العملية</th>
                                    <th className="text-right px-4 py-3">التفاصيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-100/70 dark:divide-brand-800">
                                {rows.map(r => {
                                    const m = actionMeta(r.action);
                                    const Icon = m.icon;
                                    return (
                                        <tr key={r.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/30 transition">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-brand-300 text-xs" dir="ltr">{fmtDate(r.created_at)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-brand-800 dark:text-brand-50">{r.actor || '—'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-brand-200 text-xs font-bold">{ENTITY_LABELS[r.entity] || r.entity}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-[11px] font-black ${m.cls}`}>
                                                    <Icon size={12} /> {m.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-brand-200 leading-relaxed">{r.detail || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ترقيم الصفحات */}
                {!loading && pages > 1 && (
                    <div className="p-4 border-t border-brand-100/70 dark:border-brand-700 flex items-center justify-center gap-3">
                        <button
                            onClick={() => load(page - 1)} disabled={page <= 1}
                            className="btn btn-ghost px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40"
                        >
                            <ChevronRight size={16} /> السابق
                        </button>
                        <span className="text-sm font-bold text-brand-800 dark:text-brand-100">صفحة {page.toLocaleString('ar-SA')} من {pages.toLocaleString('ar-SA')}</span>
                        <button
                            onClick={() => load(page + 1)} disabled={page >= pages}
                            className="btn btn-ghost px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40"
                        >
                            التالي <ChevronLeft size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
