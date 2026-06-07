import React, { useState, useEffect, useCallback, useMemo, Suspense, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Building,
    UserCircle, FileWarning, Loader2, FilePenLine, QrCode, Calculator,
    Printer, RefreshCw, TrendingUp, Building2, Edit2, MessageCircle, Bot,
    AlertTriangle, DollarSign, ArrowLeft, CheckCircle2, Coins, ShieldCheck,
    BarChart3, Briefcase, HardHat, Landmark, Cpu, ChevronRight,
    Receipt, ShoppingCart, FileText, Tag, Truck, Package, CreditCard,
    Home, Key, UserCheck, ArrowRightLeft, BookOpen, Layers, Link2,
    Menu, X, ChevronDown, ExternalLink, Bell, ScrollText, Clock, Zap
} from 'lucide-react';

// ─── تحميل كسول لكل تبويب — يُقلّص حجم الـ bundle الرئيسي ────────────────
const UnitInspection    = React.lazy(() => import('./UnitInspection'));
const SnagList          = React.lazy(() => import('./SnagList'));
const UsersManage       = React.lazy(() => import('./UsersManage'));
const MaintenanceManage = React.lazy(() => import('./MaintenanceManage'));
const LeadsManage       = React.lazy(() => import('./LeadsManage'));
const BotSettings       = React.lazy(() => import('./BotSettings'));
const Finance           = React.lazy(() => import('./Finance'));
const DaftraExplorer    = React.lazy(() => import('./DaftraExplorer'));
const WorkCycles        = React.lazy(() => import('./WorkCycles'));
const FeasibilityCalc   = React.lazy(() => import('./FeasibilityCalc'));
const UnitsOverview     = React.lazy(() => import('./UnitsOverview'));
const ProjectsManage    = React.lazy(() => import('./ProjectsManage'));
const UnitsEdit         = React.lazy(() => import('./UnitsEdit'));
const WhatsAppInbox     = React.lazy(() => import('./WhatsAppInbox'));
const InvoicesManage    = React.lazy(() => import('./InvoicesManage'));
const PurchasesManage   = React.lazy(() => import('./PurchasesManage'));
const TreasuryManage    = React.lazy(() => import('./TreasuryManage'));
const ReportsHub        = React.lazy(() => import('./ReportsHub'));
const QuotationsManage  = React.lazy(() => import('./QuotationsManage'));
const ExpensesManage    = React.lazy(() => import('./ExpensesManage'));
const ClientsManage     = React.lazy(() => import('./ClientsManage'));
const SuppliersManage   = React.lazy(() => import('./SuppliersManage'));
const ProductsManage    = React.lazy(() => import('./ProductsManage'));
const ChequesManage     = React.lazy(() => import('./ChequesManage'));
const RentalsManage     = React.lazy(() => import('./RentalsManage'));
const PaymentsManage    = React.lazy(() => import('./PaymentsManage'));
const AccountingHub     = React.lazy(() => import('./AccountingHub'));
const LedgerHub         = React.lazy(() => import('./LedgerHub'));
const NotesReturns      = React.lazy(() => import('./NotesReturns'));
const DaftraLink        = React.lazy(() => import('./DaftraLink'));
const PartyDetail       = React.lazy(() => import('./PartyDetail'));
const EntryDetail       = React.lazy(() => import('./EntryDetail'));
const InvoiceDetail     = React.lazy(() => import('./InvoiceDetail'));
const AccountDetail     = React.lazy(() => import('./AccountDetail'));
const ProductMovement   = React.lazy(() => import('./ProductMovement'));
const ActivityLog       = React.lazy(() => import('./ActivityLog'));
const SecuritySettings  = React.lazy(() => import('./SecuritySettings'));
const SubscriptionPage  = React.lazy(() => import('./SubscriptionPage'));

import { API_URL, apiGet, apiPost, TENANT } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';
import { ToastProvider, useToast, ThemeToggle } from '../../components/ui';
import ErrorBoundary from '../../components/ErrorBoundary';

// ─── ألوان الأقسام (ثابتة لدعم Tailwind purge) ─────────────────────────────
const DEPT_PALETTE = {
    teal:    { wrap:'border-teal-200 bg-teal-50/30 dark:border-teal-500/20 dark:bg-teal-500/5',    strip:'bg-teal-500', icon:'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', title:'text-teal-800 dark:text-teal-300' },
    blue:    { wrap:'border-blue-200 bg-blue-50/30 dark:border-blue-500/20 dark:bg-blue-500/5',    strip:'bg-blue-500', icon:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', title:'text-blue-800 dark:text-blue-300' },
    amber:   { wrap:'border-amber-200 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/5',  strip:'bg-amber-500', icon:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', title:'text-amber-800 dark:text-amber-300' },
    emerald: { wrap:'border-emerald-200 bg-emerald-50/30 dark:border-emerald-500/20 dark:bg-emerald-500/5', strip:'bg-emerald-600', icon:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', title:'text-emerald-800 dark:text-emerald-300' },
    indigo:  { wrap:'border-indigo-200 bg-indigo-50/30 dark:border-indigo-500/20 dark:bg-indigo-500/5', strip:'bg-indigo-500', icon:'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', title:'text-indigo-800 dark:text-indigo-300' },
    purple:  { wrap:'border-purple-200 bg-purple-50/30 dark:border-purple-500/20 dark:bg-purple-500/5', strip:'bg-purple-500', icon:'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300', title:'text-purple-800 dark:text-purple-300' },
};

// ─── QR Section ─────────────────────────────────────────────────────────────
function QrSection() {
    const [units, setUnits] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        fetch(`${API_URL}?action=get_projects_data`)
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    const all = d.data.flatMap(p =>
                        (p.units_details || []).filter(u => u.owner_id).map(u => u.unit_code)
                    );
                    setUnits(all);
                }
            })
            .finally(() => setLoading(false));
    }, []);
    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-6xl mx-auto">
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-card border border-brand-100/70 dark:border-brand-700 overflow-hidden mb-12">
                <div className="p-8 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-3"><QrCode className="text-gold-500" /> رموز الوحدات للعملاء</h3>
                        <p className="text-slate-500 dark:text-brand-300 text-sm mt-1">طباعة هذه الرموز ولصقها داخل كل وحدة لتسهيل طلب الصيانة.</p>
                    </div>
                    <button onClick={() => window.print()} className="btn btn-primary px-6 py-3 flex items-center gap-2">
                        <Printer size={18} /> طباعة
                    </button>
                </div>
                <div className="p-8">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400 dark:text-brand-400"><RefreshCw className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {units.map(unit => {
                                const url   = `${window.location.origin}/maintenance?unit=${encodeURIComponent(unit)}`;
                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&margin=10`;
                                return (
                                    <div key={unit} className="bg-white dark:bg-brand-800 p-6 rounded-3xl border border-brand-100/70 dark:border-brand-700 text-center shadow-sm flex flex-col items-center">
                                        <h4 className="font-black text-brand-800 dark:text-brand-50 text-xl mb-1">{unit}</h4>
                                        <p className="text-xs text-slate-400 dark:text-brand-400 mb-4">مسح لطلب الصيانة</p>
                                        <img src={qrUrl} alt={`QR ${unit}`} className="w-full max-w-[150px] mb-4 border-2 border-brand-100 dark:border-brand-700 rounded-xl bg-white p-1" crossOrigin="anonymous" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── بطاقة أداة ─────────────────────────────────────────────────────────────
function ToolCard({ icon: Icon, label, badge, badgeLabel, color = 'slate', onClick, disabled }) {
    const palette = {
        teal:    { bg:'bg-teal-50',    text:'text-teal-700',    hbg:'hover:bg-teal-600',    bdg:'bg-teal-600' },
        purple:  { bg:'bg-purple-50',  text:'text-purple-700',  hbg:'hover:bg-purple-600',  bdg:'bg-purple-600' },
        amber:   { bg:'bg-amber-50',   text:'text-amber-700',   hbg:'hover:bg-amber-600',   bdg:'bg-amber-600' },
        indigo:  { bg:'bg-indigo-50',  text:'text-indigo-700',  hbg:'hover:bg-indigo-600',  bdg:'bg-indigo-600' },
        red:     { bg:'bg-red-50',     text:'text-red-700',     hbg:'hover:bg-red-600',     bdg:'bg-red-600' },
        blue:    { bg:'bg-blue-50',    text:'text-blue-700',    hbg:'hover:bg-blue-600',    bdg:'bg-blue-600' },
        sky:     { bg:'bg-sky-50',     text:'text-sky-700',     hbg:'hover:bg-sky-600',     bdg:'bg-sky-600' },
        cyan:    { bg:'bg-cyan-50',    text:'text-cyan-700',    hbg:'hover:bg-cyan-600',    bdg:'bg-cyan-600' },
        emerald: { bg:'bg-emerald-50', text:'text-emerald-700', hbg:'hover:bg-emerald-600', bdg:'bg-emerald-600' },
        green:   { bg:'bg-green-50',   text:'text-green-700',   hbg:'hover:bg-green-600',   bdg:'bg-green-600' },
        rose:    { bg:'bg-rose-50',    text:'text-rose-700',    hbg:'hover:bg-rose-600',    bdg:'bg-rose-600' },
        slate:   { bg:'bg-slate-100',  text:'text-slate-700',   hbg:'hover:bg-slate-700',   bdg:'bg-slate-700' },
    };
    const c = palette[color] || palette.slate;
    const hasBadge = Number(badge) > 0;
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={`group bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-brand-100/70 dark:border-brand-700 hover:shadow-md hover:-translate-y-0.5 hover:border-gold-300 dark:hover:border-gold-500/50 transition-all p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[100px] md:min-h-[120px] relative ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {hasBadge && (
                <span className={`absolute -top-1.5 -right-1.5 ${c.bdg} text-white text-[10px] font-black rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-brand-900`}>
                    {badge}
                </span>
            )}
            {badgeLabel && (
                <span className="absolute top-1 left-1 text-[9px] font-bold text-slate-400 dark:text-brand-400">{badgeLabel}</span>
            )}
            <div className={`w-11 h-11 md:w-13 md:h-13 ${c.bg} ${c.text} ${disabled ? '' : c.hbg} group-hover:text-white rounded-2xl flex items-center justify-center mb-2 transition-colors`}>
                <Icon size={20}/>
            </div>
            <div className="text-[11px] md:text-xs font-black text-brand-800 dark:text-brand-100 leading-tight">{label}</div>
        </button>
    );
}

// ─── شريحة إحصائية صغيرة ────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, color = 'slate', loading }) {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
        teal:    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',
        red:     'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
        amber:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
        blue:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
        slate:   'bg-slate-50 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700',
    };
    return (
        <div className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${colors[color] || colors.slate}`}>
            <Icon size={11} className="opacity-60 shrink-0"/>
            <span className="opacity-60">{label}</span>
            {loading
                ? <span className="w-8 h-3 bg-current opacity-10 rounded animate-pulse"/>
                : <span className="font-black">{value ?? '—'}</span>
            }
        </div>
    );
}

// ─── بطاقة قسم ──────────────────────────────────────────────────────────────
function DeptSection({ dept, hasPermission, dashCounts, deptStats, statsLoading, setActiveTab, loadLeads }) {
    const p = DEPT_PALETTE[dept.color] || DEPT_PALETTE.indigo;
    const tools = dept.tools.filter(t => hasPermission(t.permKey));
    const stats = dept.statsKey ? (deptStats?.[dept.statsKey] ?? null) : null;

    const fmt = (n) => n != null ? Number(n).toLocaleString('ar-SA') : '—';

    return (
        <div className={`rounded-2xl border ${p.wrap} overflow-hidden`}>
            {/* رأس القسم */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/60">
                <div className={`w-9 h-9 ${p.icon} rounded-xl flex items-center justify-center shrink-0`}>
                    <dept.icon size={18}/>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-black ${p.title} leading-tight`}>{dept.label}</h3>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{dept.desc}</p>
                </div>
                <div className={`w-1.5 h-8 ${p.strip} rounded-full shrink-0`}/>
            </div>

            {/* أدوات القسم */}
            <div className="p-4">
                {tools.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
                        {tools.map(tool => (
                            <ToolCard
                                key={tool.id}
                                icon={tool.icon}
                                label={tool.label}
                                badge={tool.badge ? dashCounts[tool.badge] : undefined}
                                badgeLabel={tool.badgeLabel}
                                color={tool.color}
                                onClick={() => {
                                    if (tool.isExternal) window.open(tool.path, '_blank');
                                    else if (tool.isLink) window.location.href = tool.path;
                                    else { setActiveTab(tool.tabId); if (tool.tabId === 'leads') loadLeads(); }
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-slate-400">
                        <Cpu size={28} className="mx-auto mb-2 opacity-30"/>
                        <p className="text-xs font-bold">قيد التطوير</p>
                    </div>
                )}
            </div>

            {/* ── أرقام دفترة مدمجة ─────────────────────────────────────── */}
            {dept.statsChips && (
                <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-white/80 pt-3">
                    {dept.statsChips(stats, fmt, statsLoading).map((chip, i) =>
                        chip ? <StatChip key={i} {...chip} loading={statsLoading}/> : null
                    )}
                </div>
            )}
        </div>
    );
}

// ─── بطاقة مؤشر مالي كبيرة (KPI) ────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, tone = 'navy', loading }) {
    const tones = {
        navy:    { grad:'from-[#1a365d] to-[#2a4a7d]', ic:'bg-white/15 text-white',       txt:'text-white',       sub:'text-white/60',       lbl:'text-white/70' },
        emerald: { grad:'from-emerald-600 to-emerald-500', ic:'bg-white/20 text-white',   txt:'text-white',       sub:'text-white/70',       lbl:'text-white/80' },
        red:     { grad:'from-rose-600 to-red-500',    ic:'bg-white/20 text-white',       txt:'text-white',       sub:'text-white/70',       lbl:'text-white/80' },
        gold:    { grad:'from-[#c5a059] to-[#d4b675]', ic:'bg-white/20 text-white',       txt:'text-white',       sub:'text-white/70',       lbl:'text-white/80' },
    };
    const c = tones[tone] || tones.navy;
    return (
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-bl ${c.grad} p-5 md:p-6 shadow-lg`}>
            <div className="absolute -left-6 -bottom-8 opacity-10">
                <Icon size={120} strokeWidth={1.5} className="text-white"/>
            </div>
            <div className="relative">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className={`w-9 h-9 ${c.ic} rounded-xl flex items-center justify-center`}><Icon size={18}/></div>
                    <span className={`text-xs font-bold ${c.lbl}`}>{label}</span>
                </div>
                {loading
                    ? <div className="h-9 w-32 bg-white/20 rounded-lg animate-pulse"/>
                    : <div className={`text-2xl md:text-3xl font-black ${c.txt} tracking-tight`} dir="ltr">{value}</div>
                }
                {sub && !loading && <p className={`text-[11px] font-bold mt-1.5 ${c.sub}`}>{sub}</p>}
            </div>
        </div>
    );
}

// ─── رسم بياني — اتجاه 6 أشهر (SVG، بدون مكتبات) ─────────────────────────────
function TrendChart({ data, loading }) {
    const fmtK = (n) => n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : Math.round(n);
    if (loading) {
        return (
            <div className="h-64 flex items-end gap-3 px-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
                        <div className="w-full bg-slate-100 dark:bg-brand-800 rounded-t-lg animate-pulse" style={{ height: `${30 + (i*11)%50}%` }}/>
                    </div>
                ))}
            </div>
        );
    }
    const rows = data || [];
    const max  = Math.max(1, ...rows.map(r => Math.max(r.revenue || 0, r.expenses || 0)));
    return (
        <div>
            <div className="flex items-center gap-4 mb-4 text-[11px] font-bold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#c5a059]"/> إيرادات</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400"/> مصروفات</span>
            </div>
            <div className="h-56 flex items-end gap-2 md:gap-4">
                {rows.map((r, i) => {
                    const rh = Math.max(2, ((r.revenue || 0) / max) * 100);
                    const eh = Math.max(2, ((r.expenses || 0) / max) * 100);
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                            <div className="w-full flex items-end justify-center gap-1 md:gap-1.5 h-full">
                                <div className="relative flex-1 max-w-[26px] bg-[#c5a059] rounded-t-md transition-all hover:opacity-80" style={{ height: `${rh}%` }}>
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-[#c5a059] opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmtK(r.revenue||0)}</span>
                                </div>
                                <div className="relative flex-1 max-w-[26px] bg-rose-400 rounded-t-md transition-all hover:opacity-80" style={{ height: `${eh}%` }}>
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-rose-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmtK(r.expenses||0)}</span>
                                </div>
                            </div>
                            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-brand-400 mt-2">{r.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── عنوان قسم + شبكة أدوات موحّدة (تصميم مسطّح نظيف) ────────────────────────
function SectionTools({ dept, hasPermission, dashCounts, setActiveTab, loadLeads }) {
    const p = DEPT_PALETTE[dept.color] || DEPT_PALETTE.indigo;
    const tools = dept.tools.filter(t => hasPermission(t.permKey));
    if (tools.length === 0) return null;
    return (
        <section>
            <div className="flex items-center gap-2.5 mb-3 px-1">
                <div className={`w-7 h-7 ${p.icon} rounded-lg flex items-center justify-center shrink-0`}>
                    <dept.icon size={15}/>
                </div>
                <h3 className={`text-sm font-black ${p.title}`}>{dept.label}</h3>
                <div className="flex-1 h-px bg-slate-200/70 dark:bg-brand-700"/>
                <span className="text-[11px] font-bold text-slate-400 dark:text-brand-400">{tools.length} أدوات</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 md:gap-3">
                {tools.map(tool => (
                    <ToolCard
                        key={tool.id}
                        icon={tool.icon}
                        label={tool.label}
                        badge={tool.badge ? dashCounts[tool.badge] : undefined}
                        badgeLabel={tool.badgeLabel}
                        color={tool.color}
                        onClick={() => {
                            if (tool.isExternal) window.open(tool.path, '_blank');
                            else if (tool.isLink) window.location.href = tool.path;
                            else { setActiveTab(tool.tabId); if (tool.tabId === 'leads') loadLeads(); }
                        }}
                    />
                ))}
            </div>
        </section>
    );
}

// ─── القائمة الجانبية الثابتة (تنقّل موحّد بنفس هوية سماك) ────────────────────
function Sidebar({ departments, hasPermission, activeTab, setActiveTab, loadLeads, dbUser, onLogout, isOpen, onClose, companyName }) {
    const [openGroups, setOpenGroups] = useState({});
    const go = (tool) => {
        if (tool.isExternal)  window.open(tool.path, '_blank');
        else if (tool.isLink) window.location.href = tool.path;
        else { setActiveTab(tool.tabId); if (tool.tabId === 'leads') loadLeads(); }
        onClose && onClose();
    };
    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 bg-brand-950/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
            )}
            <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-72 shrink-0 bg-brand-800 dark:bg-brand-950 text-brand-50 flex flex-col shadow-2xl border-l border-white/5 dark:border-brand-800 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
                {/* الشعار */}
                <div className="h-20 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
                    <img src="/images/logo-light.png" alt={companyName || 'سماك العقارية'} className="h-11 w-auto object-contain" />
                    <button onClick={onClose} className="lg:hidden text-brand-200 hover:text-white p-1" aria-label="إغلاق"><X size={22} /></button>
                </div>
                {/* التنقّل */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
                    <button
                        onClick={() => { setActiveTab('overview'); onClose && onClose(); }}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/20' : 'text-brand-100 hover:bg-white/5 hover:text-white'}`}
                    >
                        <LayoutDashboard size={18} /> الرئيسية
                    </button>
                    {departments.map(dept => {
                        const tools = dept.tools.filter(t => hasPermission(t.permKey));
                        if (tools.length === 0) return null;
                        const groupActive = tools.some(t => t.tabId === activeTab);
                        const open = dept.id in openGroups ? openGroups[dept.id] : groupActive;
                        const DeptIcon = dept.icon;
                        return (
                            <div key={dept.id} className="pt-1.5">
                                <button
                                    onClick={() => setOpenGroups(g => ({ ...g, [dept.id]: !open }))}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-black tracking-wide transition-colors ${groupActive ? 'text-gold-300' : 'text-brand-300 hover:text-brand-100'}`}
                                >
                                    <DeptIcon size={15} className="shrink-0" />
                                    <span className="flex-1 text-right truncate">{dept.label}</span>
                                    <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                                </button>
                                {open && (
                                    <div className="mt-0.5 space-y-0.5 pr-2.5">
                                        {tools.map(tool => {
                                            const ToolIcon = tool.icon;
                                            const isActive = tool.tabId === activeTab;
                                            return (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => go(tool)}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all ${isActive ? 'bg-gold-500 text-white shadow-md shadow-gold-500/20' : 'text-brand-200 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <ToolIcon size={16} className="shrink-0 opacity-90" />
                                                    <span className="flex-1 text-right truncate">{tool.label}</span>
                                                    {(tool.isExternal || tool.isLink) && <ExternalLink size={12} className="opacity-50 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
                {/* المستخدم + خروج */}
                <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="w-9 h-9 bg-gold-500/15 text-gold-300 rounded-full flex items-center justify-center shrink-0">
                            <UserCircle size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white leading-tight truncate">{dbUser?.name}</p>
                            <p className="text-[10px] font-bold text-brand-300">{dbUser?.role === 'admin' ? 'مدير النظام' : (dbUser?.job || 'موظف')}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all text-sm">
                        <LogOut size={16} /> تسجيل الخروج
                    </button>
                </div>
            </aside>
        </>
    );
}

// ─── نافذة تغيير كلمة المرور الإجباري (المستخدمون الجدد بكلمة مرور مؤقتة) ──────
function ForcePasswordChangeModal({ userId, jwt, onDone }) {
    const [oldPw, setOldPw]   = useState('');
    const [newPw, setNewPw]   = useState('');
    const [cfPw, setCfPw]     = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr]       = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        if (newPw.length < 8) { setErr('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
        if (newPw !== cfPw)    { setErr('كلمتا المرور غير متطابقتين'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=change_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
                body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
            });
            const data = await res.json();
            if (data.success) {
                // تحديث localStorage لإزالة علامة الإجبار
                try {
                    const u = JSON.parse(localStorage.getItem('semak_current_user') || '{}');
                    u.must_change_password = 0;
                    localStorage.setItem('semak_current_user', JSON.stringify(u));
                } catch {}
                onDone();
            } else {
                setErr(data.message || 'حدث خطأ، حاول مرة أخرى');
            }
        } catch {
            setErr('تعذّر الاتصال بالخادم');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-950/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-brand-900 rounded-3xl shadow-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden mx-4">
                <div className="p-6 border-b border-brand-100/70 dark:border-brand-700 bg-amber-50 dark:bg-amber-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-brand-900 dark:text-white">تغيير كلمة المرور</h2>
                            <p className="text-sm text-amber-700 dark:text-amber-400">كلمة المرور المؤقتة تتطلب التغيير قبل المتابعة</p>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {err && (
                        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-bold">
                            {err}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-brand-700 dark:text-brand-300 mb-1.5">كلمة المرور الحالية (المؤقتة)</label>
                        <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} required autoFocus
                            className="w-full border border-brand-200 dark:border-brand-600 rounded-xl px-4 py-3 bg-brand-50 dark:bg-brand-800 text-brand-900 dark:text-white placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-brand-700 dark:text-brand-300 mb-1.5">كلمة المرور الجديدة</label>
                        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8}
                            className="w-full border border-brand-200 dark:border-brand-600 rounded-xl px-4 py-3 bg-brand-50 dark:bg-brand-800 text-brand-900 dark:text-white placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
                        <p className="text-xs text-brand-400 mt-1">8 أحرف على الأقل</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-brand-700 dark:text-brand-300 mb-1.5">تأكيد كلمة المرور</label>
                        <input type="password" value={cfPw} onChange={e => setCfPw(e.target.value)} required
                            className="w-full border border-brand-200 dark:border-brand-600 rounded-xl px-4 py-3 bg-brand-50 dark:bg-brand-800 text-brand-900 dark:text-white placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white font-black rounded-xl py-3 transition-all disabled:opacity-60 mt-2">
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                        {loading ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── جرس التنبيهات ───────────────────────────────────────────────────────────
function NotificationBell({ userId, onNavigate }) {
    const [open, setOpen]       = useState(false);
    const [items, setItems]     = useState([]);
    const [unread, setUnread]   = useState(0);
    const [loading, setLoading] = useState(false);

    const NOTI_ICON = {
        maintenance: { ic: Wrench,        cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
        lead:        { ic: TrendingUp,    cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
        info:        { ic: Bell,          cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    };
    const metaOf = (t) => NOTI_ICON[t] || NOTI_ICON.info;

    const relTime = (s) => {
        if (!s) return '';
        try {
            const d = new Date(s.replace(' ', 'T'));
            const diff = (Date.now() - d.getTime()) / 1000;
            if (diff < 60)    return 'الآن';
            if (diff < 3600)  return `قبل ${Math.floor(diff / 60)} د`;
            if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
            return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
        } catch { return ''; }
    };

    const pollUnread = async () => {
        try {
            const res = await apiPost('notifications_unread', { user_id: userId || '' }, {}, { tenant: TENANT });
            if (res.success) setUnread(res.unread || 0);
        } catch { /* صامت */ }
    };

    const loadList = async () => {
        setLoading(true);
        try {
            const res = await apiPost('notifications_list', { user_id: userId || '', limit: 30 }, {}, { tenant: TENANT });
            if (res.success) { setItems(res.data || []); setUnread(res.unread || 0); }
        } catch { /* صامت */ }
        finally { setLoading(false); }
    };

    useEffect(() => {
        pollUnread();
        const t = setInterval(pollUnread, 45000);
        return () => clearInterval(t);
    }, [userId]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) loadList();
    };

    const markAll = async () => {
        try { await apiPost('notifications_mark_read', { user_id: userId || '', all: 1 }, {}, { tenant: TENANT }); } catch {}
        setItems(items.map(n => ({ ...n, is_read: 1 })));
        setUnread(0);
    };

    const clickItem = async (n) => {
        if (!n.is_read) {
            try { await apiPost('notifications_mark_read', { id: n.id, user_id: userId || '' }, {}, { tenant: TENANT }); } catch {}
            setItems(items.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
            setUnread(u => Math.max(0, u - 1));
        }
        setOpen(false);
        if (n.link && onNavigate) onNavigate(n.link);
    };

    return (
        <div className="relative">
            <button
                onClick={toggle}
                className="relative w-10 h-10 flex items-center justify-center rounded-xl text-brand-700 dark:text-brand-200 hover:bg-brand-50 dark:hover:bg-brand-800 transition"
                aria-label="التنبيهات"
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-white dark:ring-brand-900">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
                    <div className="absolute left-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-brand-900 rounded-2xl shadow-2xl border border-brand-100/70 dark:border-brand-700 z-50 overflow-hidden animate-fadeIn">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                            <h4 className="text-sm font-black text-brand-800 dark:text-brand-50 flex items-center gap-2"><Bell size={15} className="text-gold-500" /> التنبيهات</h4>
                            {unread > 0 && (
                                <button onClick={markAll} className="text-[11px] font-bold text-gold-600 dark:text-gold-400 hover:underline flex items-center gap-1">
                                    <CheckCircle2 size={13} /> تعليم الكل كمقروء
                                </button>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="text-center py-10 text-slate-400 dark:text-brand-400"><RefreshCw className="animate-spin mx-auto" size={22} /></div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 dark:text-brand-400">
                                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold">لا توجد تنبيهات</p>
                                </div>
                            ) : items.map(n => {
                                const m = metaOf(n.type);
                                const Icon = m.ic;
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => clickItem(n)}
                                        className={`w-full text-right flex items-start gap-3 px-4 py-3 border-b border-brand-100/50 dark:border-brand-800 hover:bg-brand-50/60 dark:hover:bg-brand-800/40 transition ${n.is_read ? '' : 'bg-gold-50/40 dark:bg-gold-500/5'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.cls}`}><Icon size={16} /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-black text-brand-800 dark:text-brand-50 leading-tight flex items-center gap-1.5">
                                                {!n.is_read && <span className="w-2 h-2 rounded-full bg-gold-500 shrink-0" />}
                                                {n.title}
                                            </p>
                                            {n.body && <p className="text-[11px] text-slate-500 dark:text-brand-300 mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400 mt-1">{relTime(n.created_at)}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── شريط حالة الاشتراك ─────────────────────────────────────────────────────
function TrialBanner({ plan, daysLeft, status }) {
    const [dismissed, setDismissed] = useState(false);
    if (plan !== 'trial' || status !== 'active' || dismissed) return null;

    const expired = daysLeft <= 0;
    const urgent  = !expired && daysLeft <= 7;
    const upgradeUrl = 'https://wa.me/966920032842?text=' + encodeURIComponent('أود ترقية اشتراكي في نظام سماك العقارية');

    return (
        <div className={`flex items-center justify-between px-4 md:px-6 py-2.5 text-sm font-bold shrink-0 ${
            expired ? 'bg-red-600 text-white' :
            urgent  ? 'bg-amber-500 text-slate-950' :
                      'bg-[#c5a059]/15 border-b border-[#c5a059]/20 text-[#c5a059]'
        }`}>
            <div className="flex items-center gap-2">
                {expired || urgent ? <AlertTriangle size={15} /> : <Clock size={15} />}
                {expired
                    ? 'انتهت فترة التجربة المجانية — يرجى ترقية الاشتراك للاستمرار'
                    : urgent
                    ? `تجربتك المجانية تنتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} — بادر بالترقية`
                    : `تجربة مجانية — متبقي ${daysLeft} يوماً`
                }
            </div>
            <div className="flex items-center gap-3">
                <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition ${
                        expired ? 'bg-white text-red-600 hover:bg-red-50' :
                        urgent  ? 'bg-slate-950 text-amber-400 hover:bg-slate-800' :
                                  'bg-[#c5a059] text-slate-950 hover:bg-[#b8913f]'
                    }`}
                >
                    <Zap size={12} /> ترقية الآن
                </a>
                {!expired && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="opacity-60 hover:opacity-100 transition"
                        aria-label="إغلاق"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── الداشبورد الرئيسي ───────────────────────────────────────────────────────
function DashboardInner({ onLogout }) {
    const { branding } = useContext(AppContext);
    const companyName  = branding?.company_name || 'سماك العقارية';

    // ─── التنقّل عبر الـ URL (كل قسم له رابط مستقل قابل للمشاركة، وزر الرجوع يتنقّل داخل اللوحة) ───
    const navigate = useNavigate();
    const params   = useParams();
    const splat    = params['*'] || '';            // مثال: "invoices" أو "suppliers/123"
    const [seg0, seg1] = splat.split('/');
    const activeTab = seg0 || 'overview';
    const detailId  = seg1 || null;
    const setActiveTab = (tab) => {
        navigate(!tab || tab === 'overview' ? '/admin/dashboard' : `/admin/dashboard/${tab}`);
    };

    // ─── إشعارات احترافية موحّدة (بدل alert) ───
    const toast = useToast();
    const showToast = (titleOrType, msg) => {
        const isErr = /خطأ|فشل|تنبيه|error|fail/i.test(String(titleOrType || ''));
        toast[isErr ? 'error' : 'success'](msg ?? titleOrType);
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [dbUser, setDbUser]       = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [leads, setLeads]         = useState([]);
    const [dataLoading,   setDataLoading]   = useState(false);
    const [dashCounts,    setDashCounts]    = useState({});
    const [dashTasks,     setDashTasks]     = useState([]);
    const [deptStats,     setDeptStats]     = useState(null);
    const [statsLoading,  setStatsLoading]  = useState(false);
    const [trend,         setTrend]         = useState(null);
    const [trendLoading,  setTrendLoading]  = useState(false);
    const [glKpis,        setGlKpis]        = useState(null);
    const [glKpisLoading, setGlKpisLoading] = useState(false);
    const [nativeStats,   setNativeStats]   = useState(null);
    const [nativeLoading, setNativeLoading] = useState(false);

    const loadDashboardCounts = async () => {
        try {
            const data = await apiGet('dashboard_counts');
            if (data.success) { setDashCounts(data.counts || {}); setDashTasks(data.tasks || []); }
        } catch {}
    };

    const loadDeptStats = async () => {
        setStatsLoading(true);
        try {
            const data = await apiGet('dept_stats');
            if (data.success) setDeptStats(data);
        } catch {}
        finally { setStatsLoading(false); }
    };

    const loadTrend = async () => {
        setTrendLoading(true);
        try {
            const data = await apiGet('dashboard_trend');
            if (data.success) setTrend(data.trend || []);
        } catch {}
        finally { setTrendLoading(false); }
    };

    const loadGlKpis = async () => {
        setGlKpisLoading(true);
        try {
            const data = await apiGet('gl_dashboard_kpis');
            if (data.success) setGlKpis(data);
        } catch {}
        finally { setGlKpisLoading(false); }
    };

    const loadNativeStats = async () => {
        setNativeLoading(true);
        try {
            const data = await apiGet('native_dashboard_stats');
            if (data.success) setNativeStats(data);
        } catch {}
        finally { setNativeLoading(false); }
    };

    useEffect(() => {
        document.title = companyName;
    }, [companyName]);

    useEffect(() => {
        if (activeTab === 'overview') {
            loadDashboardCounts();
            loadNativeStats();
            loadGlKpis();
            // Daftra stats — فقط للمستأجر 1 (سماك) الذي يملك مفتاح دفترة
            if (branding?.plan === 'enterprise' || !branding?.plan) {
                loadDeptStats();
                loadTrend();
            }
        }
    }, [activeTab]);

    useEffect(() => {
        const verify = async () => {
            const local = JSON.parse(localStorage.getItem('semak_current_user') || 'null');
            if (!local?.id) { handleForceLogout(); return; }
            try {
                const resp = await apiGet('get_current_user', { id: local.id });
                if (resp?.success && resp.user) {
                    setDbUser(resp.user);
                    localStorage.setItem('semak_current_user', JSON.stringify(resp.user));
                } else handleForceLogout();
            } catch { handleForceLogout(); }
            finally  { setAuthLoading(false); }
        };
        verify();
    }, []);

    const permsArr = useMemo(
        () => { try { return JSON.parse(dbUser?.permissions || '[]'); } catch { return []; } },
        [dbUser?.permissions]
    );
    const hasPermission = useCallback((key) => {
        if (!dbUser) return false;
        if (dbUser.role === 'admin' || key === 'all') return true;
        return permsArr.includes(key);
    }, [dbUser, permsArr]);

    const loadLeads = async () => {
        setDataLoading(true);
        try { const r = await fetch(`${API_URL}?action=get_leads`); setLeads(await r.json()); }
        catch {} finally { setDataLoading(false); }
    };

    const handleForceLogout = () => {
        localStorage.removeItem('semak_admin_email');
        localStorage.removeItem('semak_current_user');
        if (typeof onLogout === 'function') onLogout();
        window.location.replace('/login');
    };

    // ─── تعريف الأقسام ───────────────────────────────────────────────────────
    const DEPARTMENTS = [
        {
            id:'sales', color:'teal', icon:TrendingUp, statsKey:'sales',
            label:'المبيعات والتسويق',
            desc:'العملاء المحتملون · التواصل المباشر · تحليل الجدوى والتسعير',
            tools:[
                { id:'leads',       tabId:'leads',       label:'العملاء المحتملون',   icon:Users,         permKey:'leads',       badge:'leads_new',           color:'teal'   },
                { id:'whatsapp',    tabId:'whatsapp',    label:'صندوق الرسائل',        icon:MessageCircle, permKey:'whatsapp',                                 color:'green'  },
                { id:'bot',         tabId:'bot',         label:'خدمة العملاء الذكية', icon:Bot,           permKey:'bot',         badge:'bot_customers_today', color:'amber', badgeLabel:'اليوم' },
                { id:'feasibility', tabId:'feasibility', label:'الجدوى والتسعير',      icon:BarChart3,     permKey:'feasibility',                              color:'emerald'},
            ],
            statsChips: (s, fmt) => [
                { icon:Users,      label:'إجمالي العملاء',   value: fmt(s?.clients),        color:'teal'    },
                { icon:TrendingUp, label:'فواتير الشهر',     value: s?.invoices_month,      color:'blue'    },
                { icon:DollarSign, label:'إيرادات الشهر',    value: fmt(s?.revenue_month) + ' ﷼', color:'emerald' },
            ],
        },
        {
            id:'projects', color:'blue', icon:HardHat,
            label:'المشاريع والعمليات',
            desc:'الوحدات العقارية · تسجيل الملاك · التسليم والصيانة',
            tools:[
                { id:'projects',   tabId:'projects',   label:'المشاريع والأبراج', icon:Building,       permKey:'projects',                                color:'blue'   },
                { id:'units',      tabId:'units',      label:'الوحدات والمخطط',   icon:Building2,      permKey:'units',                                   color:'sky'    },
                { id:'units_edit', tabId:'units_edit', label:'تسجيل الملاك',      icon:Edit2,          permKey:'units_edit',                              color:'cyan'   },
                { id:'maintenance',tabId:'maintenance',label:'الصيانة',           icon:Wrench,         permKey:'maintenance', badge:'maintenance_open',   color:'purple' },
                { id:'inspection', tabId:'inspection', label:'محاضر التسليم',     icon:ClipboardCheck, permKey:'inspection',  badge:'inspections_pending',color:'indigo' },
                { id:'snaglist',   tabId:'snaglist',   label:'تقارير الملاحظات',  icon:FileWarning,    permKey:'snaglist',                                color:'red'    },
                { id:'qr',         tabId:'qr',         label:'رموز الوحدات',      icon:QrCode,         permKey:'qr',                                      color:'slate'  },
            ],
        },
        {
            id:'procurement', color:'amber', icon:Briefcase, statsKey:'procurement',
            label:'المشتريات والتعاقدات',
            desc:'أوامر العمل · الموردون · المنتجات · متابعة مراحل التنفيذ',
            tools:[
                { id:'work_cycles', tabId:'work_cycles', label:'أوامر ومراحل العمل',  icon:ClipboardCheck, permKey:'finance', color:'amber'  },
                { id:'suppliers',   tabId:'suppliers',   label:'إدارة الموردين',       icon:Truck,          permKey:'finance', color:'amber'  },
                { id:'products',    tabId:'products',    label:'المنتجات والخدمات',    icon:Package,        permKey:'finance', color:'cyan'   },
            ],
            statsChips: (s, fmt) => [
                { icon:Briefcase,      label:'الموردون',    value: fmt(s?.suppliers),   color:'amber' },
                { icon:ClipboardCheck, label:'أوامر العمل', value: fmt(s?.work_orders), color:'blue'  },
                s?.open > 0 ? { icon:AlertTriangle, label:'مفتوحة', value: s?.open, color:'red' } : null,
            ],
        },
        {
            id:'rentals', color:'teal', icon:Home,
            label:'الإيجارات والعقود',
            desc:'الوحدات · الحجوزات · عقود الإيجار · الأقساط · تسليم الوحدات',
            tools:[
                { id:'rentals', tabId:'rentals', label:'إدارة الإيجارات', icon:Home, permKey:'finance', color:'teal' },
            ],
        },
        {
            id:'contacts', color:'purple', icon:UserCheck,
            label:'جهات الاتصال',
            desc:'العملاء · الموردون · بيانات الاتصال',
            tools:[
                { id:'clients',   tabId:'clients',   label:'إدارة العملاء',  icon:Users,     permKey:'finance', color:'purple' },
            ],
        },
        {
            id:'finance', color:'emerald', icon:Landmark, statsKey:'finance',
            label:'الشؤون المالية والمحاسبية',
            desc:'الفواتير · عروض الأسعار · المصروفات · الشيكات · الخزاين · التقارير',
            tools:[
                { id:'invoices',    tabId:'invoices',    label:'الفواتير',            icon:Receipt,      permKey:'finance', color:'emerald' },
                { id:'quotations',  tabId:'quotations',  label:'عروض الأسعار',        icon:FileText,     permKey:'finance', color:'sky'     },
                { id:'purchases',   tabId:'purchases',   label:'فواتير الشراء',       icon:ShoppingCart, permKey:'finance', color:'amber'   },
                { id:'expenses',    tabId:'expenses',    label:'المصروفات',           icon:Tag,          permKey:'finance', color:'red'     },
                { id:'payments',    tabId:'payments',    label:'المدفوعات والتحصيل',  icon:ArrowRightLeft,permKey:'finance', color:'green'   },
                { id:'cheques',     tabId:'cheques',     label:'الشيكات',             icon:CreditCard,   permKey:'finance', color:'indigo'  },
                { id:'treasury',    tabId:'treasury',    label:'الخزاين',             icon:Coins,        permKey:'finance', color:'teal'    },
                { id:'reports',     tabId:'reports',     label:'التقارير المالية',    icon:BarChart3,    permKey:'finance', color:'blue'    },
                { id:'finance',     tabId:'finance',     label:'الإيرادات والمصروفات',icon:DollarSign,   permKey:'finance', color:'slate'   },
                { id:'letters',     tabId:'letters',     label:'الوثائق الرسمية',     icon:FilePenLine,  permKey:'letters', color:'rose',   isLink:true, path:'/admin/letter-generator' },
            ],
            statsChips: (s, fmt) => [
                { icon:TrendingUp, label:'إيرادات الشهر',  value: fmt(s?.revenue_month)  + ' ﷼', color:'emerald' },
                { icon:DollarSign, label:'مصروفات الشهر', value: fmt(s?.expenses_month) + ' ﷼', color:'red'     },
                { icon:BarChart3,  label:'صافي الكل',      value: fmt(s?.net)            + ' ﷼', color: (s?.net ?? 0) >= 0 ? 'teal' : 'red' },
            ],
        },
        {
            id:'accounting', color:'indigo', icon:BookOpen,
            label:'المحاسبة',
            desc:'الدفترة المستقلة · دليل الحسابات · القيود اليومية · التقارير المالية · مراكز التكلفة · الإشعارات والمرتجعات',
            tools:[
                { id:'ledger',     tabId:'ledger',     label:'الدفترة المستقلة',     icon:BookOpen, permKey:'finance', color:'indigo' },
                { id:'parties',    tabId:'parties',    label:'كشوف حسابات الأطراف',  icon:Users,    permKey:'finance', color:'purple' },
                { id:'accounting', tabId:'accounting', label:'دفتر المحاسبة (دفترة)', icon:FileText, permKey:'finance', color:'slate'  },
                { id:'notes',      tabId:'notes',      label:'الإشعارات والمرتجعات', icon:FileText, permKey:'finance', color:'rose'   },
            ],
        },
        {
            id:'it', color:'indigo', icon:Cpu,
            label:'تقنية المعلومات',
            desc:'الأنظمة الرقمية · الذكاء الاصطناعي · البنية التقنية · سجل النشاط',
            tools:[
                { id:'daftra_link',  tabId:'daftra_link',  label:'ربط دفترة',   icon:Link2,      permKey:'finance',       color:'indigo' },
                { id:'activity_log', tabId:'activity_log', label:'سجل النشاط', icon:ScrollText, permKey:'activity_log',  color:'slate'  },
                { id:'security',     tabId:'security',     label:'الأمان والبريد', icon:ShieldCheck, permKey:'all',       color:'emerald'},
                { id:'subscription', tabId:'subscription', label:'الاشتراك والباقة', icon:Zap,    permKey:'all',           color:'amber' },
            ],
        },
        {
            id:'hr', color:'purple', icon:ShieldCheck,
            label:'الموارد البشرية',
            desc:'إدارة الفريق · الصلاحيات · الأدوار الوظيفية',
            tools:[
                { id:'users', tabId:'users', label:'إدارة الفريق', icon:UserCircle, permKey:'users_manage', color:'purple' },
            ],
        },
    ];

    // ─── العناوين ────────────────────────────────────────────────────────────
    const TAB_LABELS = {
        overview:'لوحة الإدارة', projects:'المشاريع والأبراج', units:'الوحدات والمخطط',
        units_edit:'تسجيل الملاك', feasibility:'الجدوى والتسعير', inspection:'محاضر التسليم',
        snaglist:'تقارير الملاحظات', maintenance:'الصيانة', leads:'العملاء المحتملون',
        bot:'خدمة العملاء الذكية', whatsapp:'صندوق الرسائل', qr:'رموز الوحدات',
        letters:'الوثائق الرسمية', finance:'الإيرادات والمصروفات', daftra_explorer:'التقارير المالية',
        work_cycles:'أوامر ومراحل العمل', users:'إدارة الفريق',
        invoices:'الفواتير', purchases:'فواتير الشراء', treasury:'الخزاين', reports:'التقارير المالية',
        quotations:'عروض الأسعار', expenses:'المصروفات', cheques:'الشيكات',
        clients:'إدارة العملاء', suppliers:'إدارة الموردين', products:'المنتجات والخدمات',
        rentals:'الإيجارات والعقود', payments:'المدفوعات والتحصيل',
        ledger:'الدفترة المستقلة', accounting:'دفتر المحاسبة (دفترة)', notes:'الإشعارات والمرتجعات', daftra_link:'ربط دفترة',
        parties:'كشوف حسابات الأطراف', activity_log:'سجل النشاط', security:'الأمان والبريد',
        subscription:'الاشتراك والباقة',
    };

    if (authLoading) return (
        <div className="flex h-screen items-center justify-center bg-brand-50/50 dark:bg-brand-950 flex-col gap-5 font-cairo">
            <Loader2 className="animate-spin text-brand-800 dark:text-gold-400" size={48}/>
            <p className="text-xl font-bold text-brand-800 dark:text-brand-100">جاري التحقق من الهوية...</p>
        </div>
    );
    if (!dbUser) return null;

    const mustChangePw = parseInt(dbUser.must_change_password ?? 0, 10) === 1;
    const adminJwt = (() => { try { return localStorage.getItem('semak_admin_jwt'); } catch { return null; } })();

    return (
        <div className="flex h-screen bg-brand-50/40 dark:bg-brand-950 font-cairo overflow-hidden" dir="rtl">
        {mustChangePw && (
            <ForcePasswordChangeModal
                userId={dbUser.id}
                jwt={adminJwt}
                onDone={() => setDbUser(u => ({ ...u, must_change_password: 0 }))}
            />
        )}

            <Sidebar
                departments={DEPARTMENTS}
                hasPermission={hasPermission}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                loadLeads={loadLeads}
                dbUser={dbUser}
                onLogout={handleForceLogout}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                companyName={companyName}
            />

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* ─── الهيدر ─────────────────────────────────────────────────── */}
            <header className="h-20 bg-white/90 dark:bg-brand-900/90 backdrop-blur border-b border-brand-100/70 dark:border-brand-700 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 shadow-sm">
                <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-brand-700 dark:text-brand-200 hover:text-gold-600 dark:hover:text-gold-400 p-2 -mr-2 transition" aria-label="القائمة">
                    <Menu size={24} />
                </button>
                <button onClick={() => setActiveTab('overview')} className="flex items-center gap-3 hover:opacity-80 transition">
                    <img src="/images/logo-main.png" alt="سماك" className="h-12 md:h-14 w-auto object-contain"/>
                    <div className="hidden sm:block border-r border-brand-100 dark:border-brand-700 pr-3 text-right">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-brand-300">لوحة الإدارة</div>
                        <div className="text-sm font-black text-brand-800 dark:text-brand-50">{TAB_LABELS[activeTab] || 'لوحة التحكم'}</div>
                    </div>
                </button>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell userId={dbUser?.id} onNavigate={(link) => navigate(link)} />
                    <ThemeToggle />
                    <div className="flex items-center gap-2 border-l border-brand-100 dark:border-brand-700 pl-3 md:pl-4">
                        <div className="w-10 h-10 bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300 rounded-full flex items-center justify-center">
                            <UserCircle size={22}/>
                        </div>
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-black text-brand-800 dark:text-brand-50 leading-tight">{dbUser.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400">{dbUser.role === 'admin' ? 'مدير النظام' : dbUser.job || 'موظف'}</p>
                        </div>
                    </div>
                    <button onClick={handleForceLogout} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white px-3 md:px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 text-sm">
                        <LogOut size={16}/><span className="hidden md:inline">خروج</span>
                    </button>
                </div>
            </header>

            {/* ─── شريط حالة الاشتراك ──────────────────────────────────── */}
            <TrialBanner
                plan={branding?.plan}
                daysLeft={branding?.days_left}
                status={branding?.status}
            />

            <main className="flex-1 overflow-y-auto bg-transparent custom-scrollbar">

                {/* ─── شريط التنقل ───────────────────────────────────────── */}
                {activeTab !== 'overview' && (
                    <div className="sticky top-0 z-20 bg-white/95 dark:bg-brand-900/95 backdrop-blur px-4 md:px-8 py-3 border-b border-brand-100/70 dark:border-brand-700 flex items-center justify-between gap-3">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className="flex items-center gap-2 text-sm font-bold text-brand-800 dark:text-brand-100 hover:text-gold-600 dark:hover:text-gold-400 transition bg-brand-50 dark:bg-brand-800 hover:bg-gold-50 dark:hover:bg-brand-700 border border-brand-100 dark:border-brand-700 hover:border-gold-400 px-3 md:px-4 py-2 rounded-xl"
                        >
                            <ArrowLeft size={16}/>
                            <span className="hidden sm:inline">الرئيسية</span>
                            <span className="sm:hidden">رجوع</span>
                        </button>
                        <h2 className="text-sm md:text-base font-black text-brand-800 dark:text-brand-50 truncate">{TAB_LABELS[activeTab]}</h2>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════════
                    الصفحة الرئيسية — تصميم موحّد نظيف
                ════════════════════════════════════════════════════════════ */}
                {activeTab === 'overview' && (() => {
                    // إحصائيات محلية (Native GL) — تعمل لكل المستأجرين
                    const ns  = nativeStats || {};
                    // إحصائيات دفترة (Daftra) — للمستأجر 1 فقط كمرجع إضافي
                    const fin = deptStats?.finance || {};
                    const fmtSAR = (n) => (n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—') + ' ﷼';
                    // صافي GL من glKpis أو نحسبه من native
                    const netYtd  = glKpis?.net_income_ytd ?? 0;
                    const revYtd  = glKpis?.revenue_ytd    ?? 0;
                    // إيرادات ومصروفات الشهر — native > daftra fallback
                    const revMonth = ns.rev_month  ?? fin.revenue_month  ?? 0;
                    const expMonth = ns.exp_month  ?? fin.expenses_month ?? 0;
                    const invMonth = ns.inv_month  ?? deptStats?.sales?.invoices_month ?? 0;
                    const clients  = ns.clients    ?? deptStats?.sales?.clients ?? 0;
                    // اتجاه الرسم البياني — native > daftra fallback
                    const chartTrend = (nativeStats?.trend?.length ? nativeStats.trend : null)
                                    ?? trend ?? [];
                    const anyLoading = nativeLoading || glKpisLoading;
                    return (
                    <div className="p-4 md:p-8 animate-fadeIn max-w-7xl mx-auto space-y-8">

                        {/* الترحيب */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-brand-800 dark:text-brand-50">مرحباً، {dbUser.name.split(' ')[0]}</h2>
                                <p className="text-slate-500 dark:text-brand-300 text-sm mt-1">نظرة شاملة على أداء المنشأة</p>
                            </div>
                            <button onClick={() => { loadDashboardCounts(); loadNativeStats(); loadGlKpis(); if (branding?.plan === 'enterprise' || !branding?.plan) { loadDeptStats(); loadTrend(); } }}
                                className="bg-white dark:bg-brand-800 border border-brand-100 dark:border-brand-700 hover:border-gold-400 text-slate-600 dark:text-brand-200 hover:text-gold-600 dark:hover:text-gold-400 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm">
                                <RefreshCw size={14} className={anyLoading ? 'animate-spin' : ''}/> تحديث
                            </button>
                        </div>

                        {/* ─── المؤشرات المالية الكبيرة (Native GL) ──────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard icon={TrendingUp} tone="emerald" label="إيرادات الشهر"
                                value={fmtSAR(revMonth)} sub="من محرّك المحاسبة" loading={anyLoading}/>
                            <KpiCard icon={DollarSign} tone="red" label="مصروفات الشهر"
                                value={fmtSAR(expMonth)} sub="إجمالي مصروفات هذا الشهر" loading={anyLoading}/>
                            <KpiCard icon={BarChart3} tone={netYtd >= 0 ? 'navy' : 'red'} label="صافي الدخل السنوي"
                                value={fmtSAR(netYtd)} sub={`إيرادات ${fmtSAR(revYtd)} · ${new Date().getFullYear()}`} loading={glKpisLoading}/>
                            <KpiCard icon={Receipt} tone="gold" label="فواتير الشهر"
                                value={String(invMonth || '—')} sub={`${clients} عميل مسجّل`} loading={anyLoading}/>
                        </div>

                        {/* ─── مؤشرات المحاسبة من المحرّك المستقل ──────── */}
                        {(glKpis || glKpisLoading) && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* AR */}
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <ArrowRightLeft size={18} className="text-blue-600 dark:text-blue-400"/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-brand-400">ذمم العملاء (AR)</p>
                                    {glKpisLoading ? <div className="h-5 w-20 bg-slate-100 dark:bg-brand-800 rounded animate-pulse mt-1"/> :
                                    <p className="text-base font-black text-blue-700 dark:text-blue-400 tabular-nums leading-tight" dir="ltr">{fmtSAR(glKpis?.ar)}</p>}
                                </div>
                            </div>
                            {/* AP */}
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <ArrowRightLeft size={18} className="text-amber-600 dark:text-amber-400"/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-brand-400">ذمم الموردين (AP)</p>
                                    {glKpisLoading ? <div className="h-5 w-20 bg-slate-100 dark:bg-brand-800 rounded animate-pulse mt-1"/> :
                                    <p className="text-base font-black text-amber-700 dark:text-amber-400 tabular-nums leading-tight" dir="ltr">{fmtSAR(glKpis?.ap)}</p>}
                                </div>
                            </div>
                            {/* صافي الدخل YTD */}
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(glKpis?.net_income_ytd??0)>=0?'bg-emerald-50 dark:bg-emerald-500/10':'bg-red-50 dark:bg-red-500/10'}`}>
                                    <TrendingUp size={18} className={(glKpis?.net_income_ytd??0)>=0?'text-emerald-600 dark:text-emerald-400':'text-red-500'}/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-brand-400">صافي الدخل {glKpis?.year ?? new Date().getFullYear()}</p>
                                    {glKpisLoading ? <div className="h-5 w-20 bg-slate-100 dark:bg-brand-800 rounded animate-pulse mt-1"/> :
                                    <p className={`text-base font-black tabular-nums leading-tight ${(glKpis?.net_income_ytd??0)>=0?'text-emerald-700 dark:text-emerald-400':'text-red-600'}`} dir="ltr">{fmtSAR(glKpis?.net_income_ytd)}</p>}
                                </div>
                            </div>
                            {/* ذمم متأخرة */}
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(glKpis?.overdue_parties??0)>0?'bg-red-50 dark:bg-red-500/10':'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                                    <AlertTriangle size={18} className={(glKpis?.overdue_parties??0)>0?'text-red-500':'text-emerald-600 dark:text-emerald-400'}/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-brand-400">ذمم متأخرة +30 يوم</p>
                                    {glKpisLoading ? <div className="h-5 w-16 bg-slate-100 dark:bg-brand-800 rounded animate-pulse mt-1"/> :
                                    <p className={`text-base font-black tabular-nums leading-tight ${(glKpis?.overdue_parties??0)>0?'text-red-600':'text-emerald-700 dark:text-emerald-400'}`}>
                                        {glKpis?.overdue_parties ?? 0} طرف
                                    </p>}
                                </div>
                            </div>
                        </div>
                        )}

                        {/* ─── الرسم البياني + بطاقات السرعة + المهام ───── */}
                        {/* بطاقات: مشاريع، وحدات، ملاك */}
                        {nativeStats && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-9 h-9 rounded-xl bg-[#c5a059]/10 flex items-center justify-center shrink-0">
                                    <Building2 size={16} className="text-[#c5a059]"/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400 uppercase tracking-wide">مشاريع</p>
                                    <p className="text-xl font-black text-brand-800 dark:text-brand-50 tabular-nums">{ns.projects ?? 0}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Home size={16} className="text-blue-600 dark:text-blue-400"/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400 uppercase tracking-wide">وحدات</p>
                                    <p className="text-xl font-black text-brand-800 dark:text-brand-50 tabular-nums">{ns.units ?? 0}</p>
                                    {(ns.units_sold ?? 0) > 0 && <p className="text-[10px] text-emerald-600">{ns.units_sold} مباع</p>}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                                    <Key size={16} className="text-purple-600 dark:text-purple-400"/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400 uppercase tracking-wide">ملاك</p>
                                    <p className="text-xl font-black text-brand-800 dark:text-brand-50 tabular-nums">{ns.owners ?? 0}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-900 border border-brand-100/70 dark:border-brand-700 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center shrink-0">
                                    <Users size={16} className="text-teal-600 dark:text-teal-400"/>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400 uppercase tracking-wide">عملاء</p>
                                    <p className="text-xl font-black text-brand-800 dark:text-brand-50 tabular-nums">{ns.clients ?? 0}</p>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* ─── بطاقة الإعداد الأولي (تظهر للمستأجرين الجدد) ── */}
                        {nativeStats?.onboarding && (() => {
                            const ob = nativeStats.onboarding;
                            const steps = [
                                { done: ob.logo,    label: 'رفع شعار الشركة',           tab: 'settings', icon: '🖼️' },
                                { done: ob.vat,     label: 'إدخال الرقم الضريبي',         tab: 'settings', icon: '🏛️' },
                                { done: ob.project, label: 'إنشاء أول مشروع',            tab: 'projects', icon: '🏗️' },
                                { done: ob.team,    label: 'دعوة أحد أعضاء الفريق',      tab: 'users',    icon: '👥' },
                            ];
                            const doneCount = steps.filter(s => s.done).length;
                            if (doneCount === steps.length) return null; // مكتمل — تختفي
                            const pct = Math.round((doneCount / steps.length) * 100);
                            return (
                            <div className="bg-white dark:bg-brand-900 border border-[#c5a059]/30 rounded-3xl shadow-card p-5 md:p-6">
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#c5a059]/10 flex items-center justify-center">
                                            <CheckCircle2 size={20} className="text-[#c5a059]"/>
                                        </div>
                                        <div>
                                            <h3 className="font-black text-brand-800 dark:text-brand-50 text-sm">إعداد منشأتك</h3>
                                            <p className="text-[11px] text-slate-500 dark:text-brand-400">{doneCount} من {steps.length} خطوات مكتملة</p>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-[#c5a059]">{pct}%</div>
                                </div>
                                {/* شريط التقدم */}
                                <div className="w-full h-2 rounded-full bg-brand-100 dark:bg-brand-800 mb-4 overflow-hidden">
                                    <div className="h-full rounded-full bg-[#c5a059] transition-all duration-700" style={{width: `${pct}%`}}/>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {steps.map((s, i) => (
                                        <button key={i} onClick={() => setActiveTab(s.tab)}
                                            className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition border
                                                ${s.done
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-brand-50 dark:bg-brand-800 border-brand-100 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059]/40'}`}>
                                            <span>{s.done ? '✅' : s.icon}</span>
                                            <span className="text-right leading-tight">{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            );
                        })()}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* الرسم البياني */}
                            <div className="lg:col-span-2 bg-white dark:bg-brand-900 rounded-3xl border border-brand-100/70 dark:border-brand-700 shadow-card p-5 md:p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-base font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                                        <BarChart3 size={18} className="text-gold-500"/> الإيرادات والمصروفات — آخر 6 أشهر
                                    </h3>
                                </div>
                                <TrendChart data={chartTrend} loading={nativeLoading && !chartTrend.length}/>
                            </div>

                            {/* المهام المعلّقة */}
                            <div className="bg-white dark:bg-brand-900 rounded-3xl border border-brand-100/70 dark:border-brand-700 shadow-card p-5 md:p-6 flex flex-col">
                                <h3 className="text-base font-black text-brand-800 dark:text-brand-50 flex items-center gap-2 mb-4">
                                    <AlertTriangle size={18} className="text-amber-500"/> مهام تحتاج إنجاز
                                </h3>
                                {dashTasks.length > 0 ? (
                                    <ul className="space-y-1.5 flex-1">
                                        {dashTasks.map((t, i) => (
                                            <li key={i}
                                                onClick={() => { setActiveTab(t.tab); if (t.tab === 'leads') loadLeads(); }}
                                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-800 cursor-pointer transition border border-transparent hover:border-brand-100 dark:hover:border-brand-700"
                                            >
                                                <span className={`w-2 h-2 rounded-full bg-${t.color}-500 shrink-0`}/>
                                                <span className="text-[13px] text-slate-700 dark:text-brand-200 font-bold flex-1 leading-tight">{t.text}</span>
                                                <ChevronRight size={14} className="text-slate-300 dark:text-brand-500 shrink-0"/>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/15 rounded-2xl flex items-center justify-center mb-3">
                                            <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400"/>
                                        </div>
                                        <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-300">كل شيء تحت السيطرة</h4>
                                        <p className="text-xs text-slate-400 dark:text-brand-400 mt-1">لا توجد مهام معلّقة حالياً</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── الأدوات — شبكة موحّدة حسب الأقسام ───────────── */}
                        <div className="space-y-7">
                            {DEPARTMENTS.map(dept => (
                                <SectionTools
                                    key={dept.id}
                                    dept={dept}
                                    hasPermission={hasPermission}
                                    dashCounts={dashCounts}
                                    setActiveTab={setActiveTab}
                                    loadLeads={loadLeads}
                                />
                            ))}
                        </div>
                    </div>
                    );
                })()}

                {/* ════ محتوى التبويبات ════ */}
                <ErrorBoundary key={activeTab}>
                <Suspense fallback={
                    <div className="flex items-center justify-center py-24">
                        <Loader2 size={32} className="animate-spin text-brand-300 dark:text-brand-500" />
                    </div>
                }>
                {activeTab === 'projects'    && hasPermission('projects')    && <ProjectsManage />}
                {activeTab === 'units'       && hasPermission('units')       && <UnitsOverview showToast={showToast} />}
                {activeTab === 'units_edit'  && hasPermission('units_edit')  && <div className="animate-fadeIn p-6 md:p-8"><UnitsEdit showToast={showToast} /></div>}
                {activeTab === 'feasibility' && hasPermission('feasibility') && <div className="animate-fadeIn"><FeasibilityCalc showToast={showToast} /></div>}
                {activeTab === 'inspection'  && hasPermission('inspection')  && <div className="animate-fadeIn -mt-24"><UnitInspection user={dbUser} navigateTo={()=>setActiveTab('overview')} showToast={showToast} /></div>}
                {activeTab === 'snaglist'    && hasPermission('snaglist')    && <div className="animate-fadeIn p-6 md:p-8"><SnagList /></div>}
                {activeTab === 'maintenance' && hasPermission('maintenance') && <div className="animate-fadeIn p-6 md:p-8"><MaintenanceManage showToast={showToast} activeUser={dbUser} /></div>}
                {activeTab === 'users'       && hasPermission('users_manage')&& <div className="animate-fadeIn p-6 md:p-8"><UsersManage showToast={showToast} /></div>}
                {activeTab === 'qr'          && hasPermission('qr')          && <QrSection />}
                {activeTab === 'bot'         && hasPermission('bot')         && <div className="animate-fadeIn"><BotSettings /></div>}
                {activeTab === 'finance'     && hasPermission('finance')     && <div className="animate-fadeIn"><Finance /></div>}
                {activeTab === 'daftra_explorer' && hasPermission('finance') && <div className="animate-fadeIn"><DaftraExplorer /></div>}
                {activeTab === 'work_cycles' && hasPermission('finance')     && <div className="animate-fadeIn"><WorkCycles /></div>}
                {activeTab === 'invoices'    && hasPermission('finance')     && <div className="animate-fadeIn"><InvoicesManage /></div>}
                {activeTab === 'quotations'  && hasPermission('finance')     && <div className="animate-fadeIn"><QuotationsManage /></div>}
                {activeTab === 'purchases'   && hasPermission('finance')     && <div className="animate-fadeIn"><PurchasesManage /></div>}
                {activeTab === 'expenses'    && hasPermission('finance')     && <div className="animate-fadeIn"><ExpensesManage /></div>}
                {activeTab === 'payments'    && hasPermission('finance')     && <div className="animate-fadeIn"><PaymentsManage /></div>}
                {activeTab === 'parties'     && hasPermission('finance')     && <PartyDetail partyId={detailId} setActiveTab={setActiveTab} />}
                {activeTab === 'entry'       && hasPermission('finance')     && <EntryDetail entryId={detailId} setActiveTab={setActiveTab} />}
                {activeTab === 'inv'         && hasPermission('finance')     && <InvoiceDetail invoiceId={detailId} setActiveTab={setActiveTab} />}
                {activeTab === 'acct'        && hasPermission('finance')     && <AccountDetail accountId={detailId} setActiveTab={setActiveTab} />}
                {activeTab === 'prod'        && hasPermission('finance')     && <ProductMovement productId={detailId} setActiveTab={setActiveTab} />}
                {activeTab === 'ledger'      && hasPermission('finance')     && <div className="animate-fadeIn"><LedgerHub /></div>}
                {activeTab === 'accounting'  && hasPermission('finance')     && <div className="animate-fadeIn"><AccountingHub /></div>}
                {activeTab === 'notes'       && hasPermission('finance')     && <div className="animate-fadeIn"><NotesReturns /></div>}
                {activeTab === 'daftra_link' && hasPermission('finance')     && <div className="animate-fadeIn"><DaftraLink /></div>}
                {activeTab === 'cheques'     && hasPermission('finance')     && <div className="animate-fadeIn"><ChequesManage /></div>}
                {activeTab === 'treasury'    && hasPermission('finance')     && <div className="animate-fadeIn"><TreasuryManage /></div>}
                {activeTab === 'reports'     && hasPermission('finance')     && <div className="animate-fadeIn"><ReportsHub /></div>}
                {activeTab === 'clients'     && hasPermission('finance')     && <div className="animate-fadeIn"><ClientsManage /></div>}
                {activeTab === 'suppliers'   && hasPermission('finance')     && <div className="animate-fadeIn"><SuppliersManage /></div>}
                {activeTab === 'products'    && hasPermission('finance')     && <div className="animate-fadeIn"><ProductsManage /></div>}
                {activeTab === 'rentals'     && hasPermission('finance')     && <div className="animate-fadeIn"><RentalsManage /></div>}
                {activeTab === 'leads'       && hasPermission('leads')       && <div className="animate-fadeIn p-6 md:p-8"><LeadsManage showToast={showToast} /></div>}
                {activeTab === 'whatsapp'    && hasPermission('whatsapp')    && <div className="animate-fadeIn"><WhatsAppInbox /></div>}
                {activeTab === 'activity_log'&& hasPermission('activity_log')&& <div className="animate-fadeIn p-6 md:p-8"><ActivityLog /></div>}
                {activeTab === 'security'    && hasPermission('all')         && <div className="animate-fadeIn p-6 md:p-8"><SecuritySettings showToast={showToast} /></div>}
                {activeTab === 'subscription'&& hasPermission('all')         && <div className="animate-fadeIn p-6 md:p-8"><SubscriptionPage /></div>}
                </Suspense>
                </ErrorBoundary>

            </main>
            </div>
        </div>
    );
}

// مغلّف يوفّر نظام الإشعارات الموحّد لكامل اللوحة
export default function Dashboard(props) {
    return (
        <ToastProvider>
            <DashboardInner {...props} />
        </ToastProvider>
    );
}
