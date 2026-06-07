import React, { useEffect, useState } from 'react';
import { Users, Ticket, Package, Receipt, TrendingUp, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { apiGet } from '../../lib/api/client';

const fmt = (n) => n != null ? Number(n).toLocaleString('ar-SA') : '—';
const fmtSAR = (n) => (n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—') + ' ﷼';

const PRIORITY_BADGE = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    high:     'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    medium:   'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    low:      'bg-slate-100 text-slate-600 dark:bg-brand-800 dark:text-brand-300',
};
const PRIORITY_LABEL = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const STATUS_BADGE = {
    open:        'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    closed:      'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400',
};
const STATUS_LABEL = { open: 'مفتوحة', in_progress: 'جارية', resolved: 'محلولة', closed: 'مغلقة' };

function KpiCard({ icon: Icon, label, value, sub, color }) {
    const colors = {
        indigo:  'from-indigo-600 to-indigo-500',
        violet:  'from-violet-600 to-violet-500',
        emerald: 'from-emerald-600 to-emerald-500',
        amber:   'from-amber-500 to-amber-400',
    };
    return (
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-bl ${colors[color] || colors.indigo} p-5 shadow-lg text-white`}>
            <div className="absolute -left-6 -bottom-8 opacity-10">
                <Icon size={110} strokeWidth={1.5} />
            </div>
            <div className="relative">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Icon size={18} /></div>
                    <span className="text-xs font-bold text-white/80">{label}</span>
                </div>
                <div className="text-3xl font-black tracking-tight">{value}</div>
                {sub && <p className="text-[11px] font-bold mt-1.5 text-white/70">{sub}</p>}
            </div>
        </div>
    );
}

export default function SwOverview({ onNavigate }) {
    const [stats, setStats]   = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        apiGet('sw_overview')
            .then(d => { if (d.success) setStats(d); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const s = stats || {};

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto space-y-8">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Users}   label="إجمالي العملاء"    value={loading ? '…' : fmt(s.clients_total)}   sub={`${s.clients_active ?? 0} نشط`}           color="indigo" />
                <KpiCard icon={Ticket}  label="تذاكر مفتوحة"      value={loading ? '…' : fmt(s.tickets_open)}    sub={`${s.tickets_critical ?? 0} حرجة`}         color="violet" />
                <KpiCard icon={Receipt} label="إيرادات هذا الشهر" value={loading ? '…' : fmtSAR(s.revenue_mtd)} sub="فواتير مدفوعة"                              color="emerald" />
                <KpiCard icon={AlertCircle} label="فواتير متأخرة" value={loading ? '…' : fmt(s.invoices_overdue)} sub={fmtSAR(s.overdue_amount)}                 color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── أحدث التذاكر ── */}
                <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100/70 dark:border-brand-700">
                        <h3 className="font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                            <Ticket size={16} className="text-violet-500" /> أحدث التذاكر
                        </h3>
                        <button onClick={() => onNavigate('sw_tickets')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">عرض الكل</button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-400" /></div>
                    ) : (s.recent_tickets || []).length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">لا توجد تذاكر بعد</div>
                    ) : (
                        <div className="divide-y divide-brand-100/70 dark:divide-brand-700">
                            {(s.recent_tickets || []).map(t => (
                                <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-brand-50/50 dark:hover:bg-brand-800/40 transition cursor-pointer" onClick={() => onNavigate('sw_tickets')}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-brand-800 dark:text-brand-100 truncate">{t.subject}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-brand-400 mt-0.5">{t.client_name || '—'} · {t.created_at?.slice(0,10)}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority] || ''}`}>{PRIORITY_LABEL[t.priority] || t.priority}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status] || ''}`}>{STATUS_LABEL[t.status] || t.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── أحدث العملاء ── */}
                <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100/70 dark:border-brand-700">
                        <h3 className="font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                            <Users size={16} className="text-indigo-500" /> أحدث العملاء
                        </h3>
                        <button onClick={() => onNavigate('sw_clients')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">عرض الكل</button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-400" /></div>
                    ) : (s.recent_clients || []).length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">لا يوجد عملاء بعد</div>
                    ) : (
                        <div className="divide-y divide-brand-100/70 dark:divide-brand-700">
                            {(s.recent_clients || []).map(c => (
                                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-brand-50/50 dark:hover:bg-brand-800/40 transition cursor-pointer" onClick={() => onNavigate('sw_clients')}>
                                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0">
                                        {(c.name || '?').charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-brand-800 dark:text-brand-100 truncate">{c.name}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-brand-400 truncate">{c.company || c.email || '—'}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                        c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
                                        c.status === 'prospect' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' :
                                        'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400'
                                    }`}>{c.status === 'active' ? 'نشط' : c.status === 'prospect' ? 'محتمل' : 'غير نشط'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
