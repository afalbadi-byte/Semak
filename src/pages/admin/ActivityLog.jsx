import React, { useState, useEffect, useCallback } from 'react';
import {
    ScrollText, Search, RefreshCw, ChevronRight, ChevronLeft,
    LogIn, ShieldAlert, Plus, Pencil, Trash2, Eye, Filter, X,
    Activity, Download, ChevronDown, ChevronUp, Shield,
    AlertTriangle, AlertCircle, CheckCircle2, Wifi, Monitor,
} from 'lucide-react';
import { apiPost, apiGet, TENANT } from '../../lib/api/client';

// ─── خرائط العرض ─────────────────────────────────────────────────────────────
const ENTITY_LABELS = {
    auth: 'الدخول', maintenance: 'الصيانة', lead: 'العملاء المحتملون',
    invoice: 'الفواتير', payment: 'المدفوعات', entry: 'القيود',
    party: 'الأطراف', user: 'المستخدمون', app: 'النظام',
    gl: 'دفتر الأستاذ', migration: 'الاستيراد', zatca: 'زاتكا',
    settings: 'الإعدادات', reclass: 'إعادة تصنيف',
};

const ACTION_META = {
    login:          { label: 'تسجيل دخول',   icon: LogIn,        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
    login_fail:     { label: 'دخول فاشل',    icon: ShieldAlert,  cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30' },
    otp_sent:       { label: 'رمز OTP',       icon: Shield,       cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    otp_fail:       { label: 'رمز خاطئ',      icon: ShieldAlert,  cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30' },
    create:         { label: 'إنشاء',         icon: Plus,         cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30' },
    update:         { label: 'تعديل',         icon: Pencil,       cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30' },
    delete:         { label: 'حذف',           icon: Trash2,       cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    void:           { label: 'إلغاء',         icon: X,            cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    post:           { label: 'ترحيل',         icon: CheckCircle2, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30' },
    reverse:        { label: 'عكس قيد',       icon: RefreshCw,    cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30' },
    close_year:     { label: 'إقفال سنة',     icon: AlertCircle,  cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30' },
    reopen_year:    { label: 'إعادة فتح سنة', icon: AlertTriangle,cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30' },
    zatca_stamp:    { label: 'ختم ZATCA',     icon: Shield,       cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30' },
    view:           { label: 'عرض',           icon: Eye,          cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' },
    save:           { label: 'حفظ',           icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' },
};
const actionMeta = a => ACTION_META[a] || { label: a || '—', icon: Activity, cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' };

// ─── مستوى الخطورة ───────────────────────────────────────────────────────────
const RISK = {
    4: { label: 'حرج',    cls: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',    dot: 'bg-red-500' },
    3: { label: 'عالي',   cls: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30', dot: 'bg-orange-500' },
    2: { label: 'متوسط',  cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',  dot: 'bg-amber-400' },
    1: { label: 'منخفض',  cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-400 dark:border-brand-700',  dot: 'bg-slate-400' },
};
const riskMeta = r => RISK[r] || RISK[1];

// ─── تنسيق الوقت ─────────────────────────────────────────────────────────────
const fmtAgo = (s) => {
    if (!s) return '—';
    try {
        const d   = new Date(s.replace(' ', 'T'));
        if (isNaN(d)) return s;
        const sec = Math.floor((Date.now() - d) / 1000);
        if (sec < 60)   return 'منذ ثوانٍ';
        if (sec < 3600) return `منذ ${Math.floor(sec / 60)} د`;
        if (sec < 86400)return `منذ ${Math.floor(sec / 3600)} س`;
        return d.toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
};
const fmtFull = (s) => {
    if (!s) return '—';
    try {
        return new Date(s.replace(' ', 'T')).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return s; }
};

// ─── JSON diff بسيط ──────────────────────────────────────────────────────────
function DiffView({ old: oldStr, next: newStr }) {
    if (!oldStr && !newStr) return null;
    const parse = s => { try { return JSON.parse(s); } catch { return s || null; } };
    const o = parse(oldStr), n = parse(newStr);

    if (typeof o !== 'object' && typeof n !== 'object') {
        return (
            <div className="text-xs font-mono space-y-1">
                {o !== null && <div className="px-2 py-1 rounded bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 line-through break-all">— {String(o)}</div>}
                {n !== null && <div className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 break-all">+ {String(n)}</div>}
            </div>
        );
    }
    const keys = [...new Set([...Object.keys(o || {}), ...Object.keys(n || {})])];
    return (
        <div className="text-xs font-mono space-y-0.5">
            {keys.map(k => {
                const ov = o?.[k], nv = n?.[k];
                const changed = JSON.stringify(ov) !== JSON.stringify(nv);
                if (!changed) return null;
                return (
                    <div key={k} className="grid grid-cols-2 gap-1">
                        <div className="truncate"><span className="text-slate-400 dark:text-brand-500 ml-1">{k}:</span>
                            <span className="text-red-600 dark:text-red-400 line-through break-all">{ov !== undefined ? String(ov) : '—'}</span></div>
                        <div className="truncate">
                            <span className="text-emerald-600 dark:text-emerald-400 break-all">→ {nv !== undefined ? String(nv) : '—'}</span></div>
                    </div>
                );
            })}
        </div>
    );
}

const PER = 50;

export default function ActivityLog() {
    const [rows, setRows]         = useState([]);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [loading, setLoading]   = useState(true);
    const [stats, setStats]       = useState(null);
    const [expanded, setExpanded] = useState(null); // row id expanded
    // فلاتر
    const [q, setQ]               = useState('');
    const [entity, setEntity]     = useState('');
    const [action, setAction]     = useState('');
    const [risk, setRisk]         = useState('');
    const [actor, setActor]       = useState('');
    const [from, setFrom]         = useState('');
    const [to, setTo]             = useState('');

    // ── تحميل الإحصاءات ──────────────────────────────────────────────────────
    useEffect(() => {
        apiPost('activity_log', { stats: 1 }, {}, { tenant: TENANT })
            .then(r => { if (r.success) setStats(r.stats); })
            .catch(() => {});
    }, []);

    // ── تحميل الأحداث ────────────────────────────────────────────────────────
    const load = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const res = await apiPost('activity_log', {
                q, entity, action, risk, actor, from, to, page: p, per: PER,
            }, {}, { tenant: TENANT });
            if (res.success) {
                setRows(res.data || []);
                setTotal(res.total || 0);
                setPage(res.page || p);
            }
        } catch { /* صامت */ }
        finally { setLoading(false); }
    }, [q, entity, action, risk, actor, from, to]);

    useEffect(() => { load(1); }, []); // eslint-disable-line

    const apply = () => load(1);
    const reset = () => {
        setQ(''); setEntity(''); setAction(''); setRisk(''); setActor(''); setFrom(''); setTo('');
        setTimeout(() => load(1), 0);
    };

    // ── تصدير CSV ────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const hdrs = ['الوقت', 'المستخدم', 'القسم', 'العملية', 'التفاصيل', 'IP', 'مستوى الخطورة', 'هاش'];
        const data = rows.map(r => [
            fmtFull(r.created_at),
            r.actor || '',
            ENTITY_LABELS[r.entity] || r.entity,
            actionMeta(r.action).label,
            r.detail || '',
            r.ip_address || '',
            riskMeta(r.risk_level).label,
            r.row_hash || '',
        ]);
        const csv  = '﻿' + [hdrs.map(esc).join(','), ...data.map(row => row.map(esc).join(','))].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a'); a.href = url; a.download = `audit_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const pages = Math.max(1, Math.ceil(total / PER));

    return (
        <div className="animate-fadeIn max-w-7xl mx-auto space-y-4">

            {/* ── شريط الإحصاءات ─────────────────────────────────────────── */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        icon={Activity} label="اليوم" value={stats.today}
                        cls="text-indigo-700 dark:text-indigo-300" bg="bg-indigo-50 dark:bg-indigo-500/10" />
                    <StatCard
                        icon={AlertCircle} label="حرج (7 أيام)" value={stats.critical}
                        cls={stats.critical > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-brand-400'}
                        bg={stats.critical > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-slate-50 dark:bg-brand-800/40'} />
                    <StatCard
                        icon={AlertTriangle} label="عالي (7 أيام)" value={stats.high}
                        cls={stats.high > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-slate-500 dark:text-brand-400'}
                        bg={stats.high > 0 ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-slate-50 dark:bg-brand-800/40'} />
                    <StatCard
                        icon={Monitor} label="مستخدمون (30 يوم)" value={stats.actors}
                        cls="text-emerald-700 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10" />
                </div>
            )}

            {/* ── لوحة الفلاتر + الجدول ──────────────────────────────────── */}
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-card border border-brand-100/70 dark:border-brand-700 overflow-hidden">

                {/* رأس */}
                <div className="p-5 md:p-6 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40 flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-3">
                            <ScrollText size={20} className="text-[#c5a059]" /> سجل التدقيق
                        </h3>
                        <p className="text-slate-500 dark:text-brand-300 text-sm mt-0.5">
                            كل حدث محمي بهاش مقاوم للتلاعب — {total.toLocaleString('ar-SA')} حدث إجمالاً
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition">
                            <Download size={14} /> CSV
                        </button>
                        <button onClick={() => load(page)} disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059] transition">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
                        </button>
                    </div>
                </div>

                {/* فلاتر */}
                <div className="p-4 border-b border-brand-100/70 dark:border-brand-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                    {/* بحث نصي */}
                    <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500" />
                        <input value={q} onChange={e => setQ(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            placeholder="بحث في التفاصيل، المستخدم، IP…"
                            className="input w-full pr-8 py-2 text-sm" />
                    </div>
                    {/* القسم */}
                    <select value={entity} onChange={e => setEntity(e.target.value)} className="input py-2 text-sm">
                        <option value="">كل الأقسام</option>
                        {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {/* العملية */}
                    <select value={action} onChange={e => setAction(e.target.value)} className="input py-2 text-sm">
                        <option value="">كل العمليات</option>
                        {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {/* مستوى الخطورة */}
                    <select value={risk} onChange={e => setRisk(e.target.value)} className="input py-2 text-sm">
                        <option value="">كل الخطورة</option>
                        <option value="4">🔴 حرج فأعلى</option>
                        <option value="3">🟠 عالي فأعلى</option>
                        <option value="2">🟡 متوسط فأعلى</option>
                    </select>
                    {/* من */}
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input py-2 text-sm" title="من تاريخ" />
                    {/* إلى */}
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input py-2 text-sm" title="إلى تاريخ" />

                    <div className="flex gap-2 col-span-2 sm:col-span-3 lg:col-span-7 mt-1">
                        <button onClick={apply} className="btn btn-primary px-5 py-2 flex items-center gap-1.5 text-sm">
                            <Filter size={14} /> تطبيق
                        </button>
                        <button onClick={reset} className="btn btn-ghost px-4 py-2 flex items-center gap-1.5 text-sm">
                            <X size={14} /> مسح
                        </button>
                    </div>
                </div>

                {/* الجدول */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400 dark:text-brand-400">
                            <RefreshCw className="animate-spin mx-auto mb-3" size={28} />
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
                                <tr className="bg-brand-50/60 dark:bg-brand-800/40 text-slate-500 dark:text-brand-300 text-[11px] font-black border-b border-brand-100/70 dark:border-brand-700">
                                    <th className="text-right px-4 py-3 whitespace-nowrap">الوقت</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">المستخدم</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">القسم</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">العملية</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap">الخطورة</th>
                                    <th className="text-right px-4 py-3">التفاصيل</th>
                                    <th className="text-right px-4 py-3 whitespace-nowrap hidden md:table-cell">IP</th>
                                    <th className="px-2 py-3 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const m    = actionMeta(r.action);
                                    const rm   = riskMeta(r.risk_level);
                                    const Icon = m.icon;
                                    const open = expanded === r.id;
                                    const hasDiff = r.old_data || r.new_data;
                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr className={`border-b border-slate-50 dark:border-brand-800 transition ${open ? 'bg-slate-50/80 dark:bg-brand-800/50' : 'hover:bg-brand-50/50 dark:hover:bg-brand-800/30'}`}>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs" dir="ltr">
                                                    <span title={fmtFull(r.created_at)} className="text-slate-500 dark:text-brand-300 font-bold">{fmtAgo(r.created_at)}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-brand-800 dark:text-brand-50 text-xs max-w-[120px] truncate">{r.actor || '—'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-brand-200 text-xs font-bold">{ENTITY_LABELS[r.entity] || r.entity}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 border rounded-lg px-2 py-0.5 text-[11px] font-black ${m.cls}`}>
                                                        <Icon size={11} /> {m.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 border rounded-md px-2 py-0.5 text-[10px] font-black ${rm.cls}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${rm.dot} shrink-0`} />
                                                        {rm.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-brand-200 text-xs max-w-[200px] truncate">{r.detail || '—'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-400 dark:text-brand-500 hidden md:table-cell" dir="ltr">{r.ip_address || '—'}</td>
                                                <td className="px-2 py-3">
                                                    <button onClick={() => setExpanded(open ? null : r.id)}
                                                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-700 transition text-slate-400 dark:text-brand-500">
                                                        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr className="border-b border-slate-100 dark:border-brand-700 bg-slate-50/60 dark:bg-brand-800/40">
                                                    <td colSpan={8} className="px-6 py-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                            {/* معلومات الحدث */}
                                                            <div className="space-y-2">
                                                                <div className="font-black text-slate-500 dark:text-brand-400 mb-2">تفاصيل الحدث</div>
                                                                <InfoRow label="الوقت الكامل" val={fmtFull(r.created_at)} mono />
                                                                <InfoRow label="المعرّف" val={`#${r.id}`} mono />
                                                                {r.entity_id && <InfoRow label="كيان" val={`${r.entity} #${r.entity_id}`} mono />}
                                                                <InfoRow label="IP" val={r.ip_address || '—'} mono />
                                                                <InfoRow label="الجهاز" val={r.user_agent ? r.user_agent.slice(0, 80) + (r.user_agent.length > 80 ? '…' : '') : '—'} />
                                                                {r.row_hash && (
                                                                    <div>
                                                                        <span className="text-slate-400 dark:text-brand-500 ml-1">هاش:</span>
                                                                        <span className="font-mono text-[10px] text-slate-400 dark:text-brand-600 break-all" dir="ltr">{r.row_hash}</span>
                                                                        <span className="mr-1 text-emerald-600 dark:text-emerald-500 font-black text-[10px]">✓ سليم</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* قبل / بعد */}
                                                            {hasDiff ? (
                                                                <div>
                                                                    <div className="font-black text-slate-500 dark:text-brand-400 mb-2">التغييرات (قبل ← بعد)</div>
                                                                    <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-100 dark:border-brand-700 p-3">
                                                                        <DiffView old={r.old_data} next={r.new_data} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center text-slate-300 dark:text-brand-700 text-xs font-bold">
                                                                    لا يوجد diff مسجّل
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ترقيم */}
                {!loading && pages > 1 && (
                    <div className="p-4 border-t border-brand-100/70 dark:border-brand-700 flex items-center justify-center gap-3">
                        <button onClick={() => load(page - 1)} disabled={page <= 1}
                            className="btn btn-ghost px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40">
                            <ChevronRight size={15} /> السابق
                        </button>
                        <span className="text-sm font-bold text-brand-800 dark:text-brand-100">
                            {page.toLocaleString('ar-SA')} / {pages.toLocaleString('ar-SA')}
                        </span>
                        <button onClick={() => load(page + 1)} disabled={page >= pages}
                            className="btn btn-ghost px-3 py-2 flex items-center gap-1 text-sm disabled:opacity-40">
                            التالي <ChevronLeft size={15} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── مكوّنات مساعدة ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, cls, bg }) {
    return (
        <div className={`rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex items-center gap-3 ${bg}`}>
            <div className={`p-2.5 rounded-xl bg-white/60 dark:bg-brand-900/50 ${cls}`}>
                <Icon size={18} />
            </div>
            <div>
                <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500">{label}</div>
                <div className={`text-2xl font-black tabular-nums ${cls}`}>{(value ?? 0).toLocaleString('ar-SA')}</div>
            </div>
        </div>
    );
}

function InfoRow({ label, val, mono }) {
    return (
        <div className="flex gap-2">
            <span className="text-slate-400 dark:text-brand-500 shrink-0 w-20">{label}:</span>
            <span className={`text-slate-700 dark:text-brand-200 break-all ${mono ? 'font-mono' : 'font-bold'}`} dir={mono ? 'ltr' : undefined}>{val}</span>
        </div>
    );
}
