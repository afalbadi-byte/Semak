import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Building,
    UserCircle, FileWarning, Loader2, FilePenLine, QrCode, Calculator,
    Printer, RefreshCw, TrendingUp, Building2, Edit2, MessageCircle, Bot,
    AlertTriangle, DollarSign, ArrowLeft, CheckCircle2, Coins, ShieldCheck,
    BarChart3, Briefcase, HardHat, Landmark, Cpu, ChevronRight,
    Receipt, ShoppingCart, FileText, Tag, Truck, Package, CreditCard,
    Home, Key, UserCheck, ArrowRightLeft, BookOpen, Layers, Link2
} from 'lucide-react';

import UnitInspection   from './UnitInspection';
import SnagList         from './SnagList';
import UsersManage      from './UsersManage';
import MaintenanceManage from './MaintenanceManage';
import LeadsManage      from './LeadsManage';
import BotSettings      from './BotSettings';
import Finance          from './Finance';
import DaftraExplorer   from './DaftraExplorer';
import WorkCycles       from './WorkCycles';
import FeasibilityCalc  from './FeasibilityCalc';
import UnitsOverview    from './UnitsOverview';
import ProjectsManage   from './ProjectsManage';
import UnitsEdit        from './UnitsEdit';
import WhatsAppInbox    from './WhatsAppInbox';
import InvoicesManage   from './InvoicesManage';
import PurchasesManage  from './PurchasesManage';
import TreasuryManage   from './TreasuryManage';
import ReportsHub       from './ReportsHub';
import QuotationsManage from './QuotationsManage';
import ExpensesManage   from './ExpensesManage';
import ClientsManage    from './ClientsManage';
import SuppliersManage  from './SuppliersManage';
import ProductsManage   from './ProductsManage';
import ChequesManage    from './ChequesManage';
import RentalsManage    from './RentalsManage';
import PaymentsManage   from './PaymentsManage';
import AccountingHub    from './AccountingHub';
import LedgerHub        from './LedgerHub';
import NotesReturns     from './NotesReturns';
import DaftraLink       from './DaftraLink';

import { API_URL } from '../../lib/api/client';
import { ToastProvider, useToast } from '../../components/ui';

// ─── ألوان الأقسام (ثابتة لدعم Tailwind purge) ─────────────────────────────
const DEPT_PALETTE = {
    teal:    { wrap:'border-teal-200 bg-teal-50/30',    strip:'bg-teal-500', icon:'bg-teal-100 text-teal-700', title:'text-teal-800' },
    blue:    { wrap:'border-blue-200 bg-blue-50/30',    strip:'bg-blue-500', icon:'bg-blue-100 text-blue-700', title:'text-blue-800' },
    amber:   { wrap:'border-amber-200 bg-amber-50/30',  strip:'bg-amber-500', icon:'bg-amber-100 text-amber-700', title:'text-amber-800' },
    emerald: { wrap:'border-emerald-200 bg-emerald-50/30', strip:'bg-emerald-600', icon:'bg-emerald-100 text-emerald-700', title:'text-emerald-800' },
    indigo:  { wrap:'border-indigo-200 bg-indigo-50/30', strip:'bg-indigo-500', icon:'bg-indigo-100 text-indigo-700', title:'text-indigo-800' },
    purple:  { wrap:'border-purple-200 bg-purple-50/30', strip:'bg-purple-500', icon:'bg-purple-100 text-purple-700', title:'text-purple-800' },
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
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mb-12">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><QrCode className="text-slate-800" /> رموز الوحدات للعملاء</h3>
                        <p className="text-slate-500 text-sm mt-1">طباعة هذه الرموز ولصقها داخل كل وحدة لتسهيل طلب الصيانة.</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition flex items-center gap-2 shadow-md">
                        <Printer size={18} /> طباعة
                    </button>
                </div>
                <div className="p-8">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400"><RefreshCw className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {units.map(unit => {
                                const url   = `${window.location.origin}/maintenance?unit=${encodeURIComponent(unit)}`;
                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&margin=10`;
                                return (
                                    <div key={unit} className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm flex flex-col items-center">
                                        <h4 className="font-black text-[#1a365d] text-xl mb-1">{unit}</h4>
                                        <p className="text-xs text-slate-400 mb-4">مسح لطلب الصيانة</p>
                                        <img src={qrUrl} alt={`QR ${unit}`} className="w-full max-w-[150px] mb-4 border-2 border-slate-100 rounded-xl" crossOrigin="anonymous" />
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
            className={`group bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200 transition-all p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[100px] md:min-h-[120px] relative ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {hasBadge && (
                <span className={`absolute -top-1.5 -right-1.5 ${c.bdg} text-white text-[10px] font-black rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-md ring-2 ring-white`}>
                    {badge}
                </span>
            )}
            {badgeLabel && (
                <span className="absolute top-1 left-1 text-[9px] font-bold text-slate-400">{badgeLabel}</span>
            )}
            <div className={`w-11 h-11 md:w-13 md:h-13 ${c.bg} ${c.text} ${disabled ? '' : c.hbg} group-hover:text-white rounded-2xl flex items-center justify-center mb-2 transition-colors`}>
                <Icon size={20}/>
            </div>
            <div className="text-[11px] md:text-xs font-black text-[#1a365d] leading-tight">{label}</div>
        </button>
    );
}

// ─── شريحة إحصائية صغيرة ────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, color = 'slate', loading }) {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        teal:    'bg-teal-50 text-teal-700 border-teal-200',
        red:     'bg-red-50 text-red-700 border-red-200',
        amber:   'bg-amber-50 text-amber-700 border-amber-200',
        blue:    'bg-blue-50 text-blue-700 border-blue-200',
        slate:   'bg-slate-50 text-slate-600 border-slate-200',
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
                        <div className="w-full bg-slate-100 rounded-t-lg animate-pulse" style={{ height: `${30 + (i*11)%50}%` }}/>
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
                            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 mt-2">{r.label}</span>
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
                <div className="flex-1 h-px bg-slate-200/70"/>
                <span className="text-[11px] font-bold text-slate-400">{tools.length} أدوات</span>
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

// ─── الداشبورد الرئيسي ───────────────────────────────────────────────────────
function DashboardInner({ onLogout }) {
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

    const [dbUser, setDbUser]       = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [leads, setLeads]         = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [dashCounts,  setDashCounts]  = useState({});
    const [dashTasks,   setDashTasks]   = useState([]);
    const [deptStats,   setDeptStats]   = useState(null);
    const [statsLoading,setStatsLoading]= useState(false);
    const [trend,       setTrend]       = useState(null);
    const [trendLoading,setTrendLoading]= useState(false);

    const loadDashboardCounts = async () => {
        try {
            const res  = await fetch(`${API_URL}?action=dashboard_counts`);
            const data = await res.json();
            if (data.success) { setDashCounts(data.counts || {}); setDashTasks(data.tasks || []); }
        } catch {}
    };

    const loadDeptStats = async () => {
        setStatsLoading(true);
        try {
            const res  = await fetch(`${API_URL}?action=dept_stats`);
            const data = await res.json();
            if (data.success) setDeptStats(data);
        } catch {}
        finally { setStatsLoading(false); }
    };

    const loadTrend = async () => {
        setTrendLoading(true);
        try {
            const res  = await fetch(`${API_URL}?action=dashboard_trend`);
            const data = await res.json();
            if (data.success) setTrend(data.trend || []);
        } catch {}
        finally { setTrendLoading(false); }
    };

    useEffect(() => {
        if (activeTab === 'overview') {
            loadDashboardCounts();
            loadDeptStats();
            loadTrend();
        }
    }, [activeTab]);

    useEffect(() => {
        const verify = async () => {
            const local = JSON.parse(localStorage.getItem('semak_current_user') || 'null');
            if (!local?.id) { handleForceLogout(); return; }
            try {
                const res  = await fetch(`${API_URL}?action=get_users`);
                const resp = await res.json();
                const arr  = resp.success ? resp.data : resp;
                const fresh = arr.find(u => String(u.id) === String(local.id));
                if (fresh) { setDbUser(fresh); localStorage.setItem('semak_current_user', JSON.stringify(fresh)); }
                else handleForceLogout();
            } catch { handleForceLogout(); }
            finally  { setAuthLoading(false); }
        };
        verify();
    }, []);

    const hasPermission = (key) => {
        if (!dbUser) return false;
        if (dbUser.role === 'admin' || key === 'all') return true;
        try { return JSON.parse(dbUser.permissions || '[]').includes(key); } catch { return false; }
    };

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
                { id:'accounting', tabId:'accounting', label:'دفتر المحاسبة (دفترة)', icon:FileText, permKey:'finance', color:'slate'  },
                { id:'notes',      tabId:'notes',      label:'الإشعارات والمرتجعات', icon:FileText, permKey:'finance', color:'rose'   },
            ],
        },
        {
            id:'it', color:'indigo', icon:Cpu,
            label:'تقنية المعلومات',
            desc:'الأنظمة الرقمية · الذكاء الاصطناعي · البنية التقنية',
            tools:[
                { id:'daftra_link', tabId:'daftra_link', label:'ربط دفترة', icon:Link2, permKey:'finance', color:'indigo' },
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
    };

    if (authLoading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-5 font-cairo">
            <Loader2 className="animate-spin text-[#1a365d]" size={48}/>
            <p className="text-xl font-bold text-[#1a365d]">جاري التحقق من الهوية...</p>
        </div>
    );
    if (!dbUser) return null;

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-cairo overflow-hidden" dir="rtl">

            {/* ─── الهيدر ─────────────────────────────────────────────────── */}
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 shadow-sm">
                <button onClick={() => setActiveTab('overview')} className="flex items-center gap-3 hover:opacity-80 transition">
                    <img src="/images/logo-main.png" alt="سماك" className="h-12 md:h-14 w-auto object-contain"/>
                    <div className="hidden sm:block border-r border-slate-200 pr-3 text-right">
                        <div className="text-[11px] font-bold text-slate-500">لوحة الإدارة</div>
                        <div className="text-sm font-black text-[#1a365d]">{TAB_LABELS[activeTab] || 'لوحة التحكم'}</div>
                    </div>
                </button>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 md:pl-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                            <UserCircle size={22}/>
                        </div>
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-black text-[#1a365d] leading-tight">{dbUser.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{dbUser.role === 'admin' ? 'مدير النظام' : dbUser.job || 'موظف'}</p>
                        </div>
                    </div>
                    <button onClick={handleForceLogout} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 md:px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 text-sm">
                        <LogOut size={16}/><span className="hidden md:inline">خروج</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">

                {/* ─── شريط التنقل ───────────────────────────────────────── */}
                {activeTab !== 'overview' && (
                    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur px-4 md:px-8 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className="flex items-center gap-2 text-sm font-bold text-[#1a365d] hover:text-teal-600 transition bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-500 px-3 md:px-4 py-2 rounded-xl"
                        >
                            <ArrowLeft size={16}/>
                            <span className="hidden sm:inline">الرئيسية</span>
                            <span className="sm:hidden">رجوع</span>
                        </button>
                        <h2 className="text-sm md:text-base font-black text-[#1a365d] truncate">{TAB_LABELS[activeTab]}</h2>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════════
                    الصفحة الرئيسية — تصميم موحّد نظيف
                ════════════════════════════════════════════════════════════ */}
                {activeTab === 'overview' && (() => {
                    const fin = deptStats?.finance || {};
                    const fmtSAR = (n) => (n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—') + ' ﷼';
                    const net = fin.net ?? 0;
                    return (
                    <div className="p-4 md:p-8 animate-fadeIn max-w-7xl mx-auto space-y-8">

                        {/* الترحيب */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-[#1a365d]">مرحباً، {dbUser.name.split(' ')[0]}</h2>
                                <p className="text-slate-500 text-sm mt-1">نظرة شاملة على أداء المنشأة</p>
                            </div>
                            <button onClick={() => { loadDashboardCounts(); loadDeptStats(); loadTrend(); }}
                                className="bg-white border border-slate-200 hover:border-teal-500 text-slate-600 hover:text-teal-600 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm">
                                <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''}/> تحديث
                            </button>
                        </div>

                        {/* ─── المؤشرات المالية الكبيرة ───────────────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard icon={TrendingUp} tone="emerald" label="إيرادات الشهر"
                                value={fmtSAR(fin.revenue_month)} sub="إجمالي فواتير هذا الشهر" loading={statsLoading}/>
                            <KpiCard icon={DollarSign} tone="red" label="مصروفات الشهر"
                                value={fmtSAR(fin.expenses_month)} sub="إجمالي مصروفات هذا الشهر" loading={statsLoading}/>
                            <KpiCard icon={BarChart3} tone={net >= 0 ? 'navy' : 'red'} label="صافي الربح الكلي"
                                value={fmtSAR(net)} sub={`إيرادات ${fmtSAR(fin.revenue_all)}`} loading={statsLoading}/>
                            <KpiCard icon={Receipt} tone="gold" label="فواتير الشهر"
                                value={String(deptStats?.sales?.invoices_month ?? '—')} sub={`${deptStats?.sales?.clients ?? 0} عميل مسجّل`} loading={statsLoading}/>
                        </div>

                        {/* ─── الرسم البياني + المهام ───────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* الرسم البياني */}
                            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-base font-black text-[#1a365d] flex items-center gap-2">
                                        <BarChart3 size={18} className="text-[#c5a059]"/> الإيرادات والمصروفات — آخر 6 أشهر
                                    </h3>
                                </div>
                                <TrendChart data={trend} loading={trendLoading}/>
                            </div>

                            {/* المهام المعلّقة */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6 flex flex-col">
                                <h3 className="text-base font-black text-[#1a365d] flex items-center gap-2 mb-4">
                                    <AlertTriangle size={18} className="text-amber-500"/> مهام تحتاج إنجاز
                                </h3>
                                {dashTasks.length > 0 ? (
                                    <ul className="space-y-1.5 flex-1">
                                        {dashTasks.map((t, i) => (
                                            <li key={i}
                                                onClick={() => { setActiveTab(t.tab); if (t.tab === 'leads') loadLeads(); }}
                                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition border border-transparent hover:border-slate-200"
                                            >
                                                <span className={`w-2 h-2 rounded-full bg-${t.color}-500 shrink-0`}/>
                                                <span className="text-[13px] text-slate-700 font-bold flex-1 leading-tight">{t.text}</span>
                                                <ChevronRight size={14} className="text-slate-300 shrink-0"/>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3">
                                            <CheckCircle2 size={24} className="text-emerald-600"/>
                                        </div>
                                        <h4 className="text-sm font-black text-emerald-900">كل شيء تحت السيطرة</h4>
                                        <p className="text-xs text-slate-400 mt-1">لا توجد مهام معلّقة حالياً</p>
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

            </main>
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
