import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Building,
    UserCircle, FileWarning, Loader2, FilePenLine, QrCode, Calculator,
    Printer, RefreshCw, TrendingUp, Building2, Edit2, MessageCircle, Bot,
    AlertTriangle, DollarSign, ArrowLeft, CheckCircle2, Coins, ShieldCheck,
    BarChart3, Briefcase, HardHat, Landmark, Cpu, ChevronRight,
    Receipt, ShoppingCart
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
import InvoicesManage  from './InvoicesManage';
import PurchasesManage from './PurchasesManage';
import TreasuryManage  from './TreasuryManage';
import ReportsHub      from './ReportsHub';

const API_URL = "https://semak.sa/api.php";

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

// ─── الداشبورد الرئيسي ───────────────────────────────────────────────────────
export default function Dashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [dbUser, setDbUser]       = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [leads, setLeads]         = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [dashCounts,  setDashCounts]  = useState({});
    const [dashTasks,   setDashTasks]   = useState([]);
    const [deptStats,   setDeptStats]   = useState(null);
    const [statsLoading,setStatsLoading]= useState(false);

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

    useEffect(() => {
        if (activeTab === 'overview') {
            loadDashboardCounts();
            loadDeptStats();
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
            desc:'أوامر العمل · الموردون · متابعة مراحل التنفيذ',
            tools:[
                { id:'work_cycles', tabId:'work_cycles', label:'أوامر ومراحل العمل', icon:ClipboardCheck, permKey:'finance', color:'amber' },
            ],
            statsChips: (s, fmt) => [
                { icon:Briefcase,   label:'الموردون',          value: fmt(s?.suppliers),  color:'amber' },
                { icon:ClipboardCheck, label:'أوامر العمل',    value: fmt(s?.work_orders), color:'blue'  },
                s?.open > 0 ? { icon:AlertTriangle, label:'مفتوحة', value: s?.open, color:'red' } : null,
            ],
        },
        {
            id:'finance', color:'emerald', icon:Landmark, statsKey:'finance',
            label:'الشؤون المالية والإدارية',
            desc:'الفواتير · الخزاين · التقارير · الوثائق',
            tools:[
                { id:'invoices',   tabId:'invoices',   label:'الفواتير',              icon:Receipt,     permKey:'finance',    color:'emerald' },
                { id:'purchases',  tabId:'purchases',  label:'فواتير الشراء',         icon:ShoppingCart,permKey:'finance',    color:'amber'   },
                { id:'treasury',   tabId:'treasury',   label:'الخزاين',               icon:Coins,       permKey:'finance',    color:'teal'    },
                { id:'reports',    tabId:'reports',    label:'التقارير المالية',       icon:BarChart3,   permKey:'finance',    color:'indigo'  },
                { id:'finance',    tabId:'finance',    label:'الإيرادات والمصروفات',  icon:DollarSign,  permKey:'finance',    color:'slate'   },
                { id:'letters',    tabId:'letters',    label:'الوثائق الرسمية',       icon:FilePenLine, permKey:'letters',    color:'rose',   isLink:true, path:'/admin/letter-generator' },
            ],
            statsChips: (s, fmt) => [
                { icon:TrendingUp, label:'إيرادات الشهر',  value: fmt(s?.revenue_month)  + ' ﷼', color:'emerald' },
                { icon:DollarSign, label:'مصروفات الشهر', value: fmt(s?.expenses_month) + ' ﷼', color:'red'     },
                { icon:BarChart3,  label:'صافي الكل',      value: fmt(s?.net)            + ' ﷼', color: (s?.net ?? 0) >= 0 ? 'teal' : 'red' },
            ],
        },
        {
            id:'it', color:'indigo', icon:Cpu,
            label:'تقنية المعلومات',
            desc:'الأنظمة الرقمية · الذكاء الاصطناعي · البنية التقنية',
            tools:[], // قيد التطوير
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
        work_cycles:'المشاريع', users:'إدارة الفريق',
        invoices:'الفواتير', purchases:'فواتير الشراء', treasury:'الخزاين', reports:'التقارير المالية',
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
                    الصفحة الرئيسية — مقسّمة حسب الأقسام
                ════════════════════════════════════════════════════════════ */}
                {activeTab === 'overview' && (
                    <div className="p-4 md:p-8 animate-fadeIn max-w-7xl mx-auto space-y-6">

                        {/* الترحيب */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-[#1a365d]">مرحباً، {dbUser.name.split(' ')[0]}</h2>
                                <p className="text-slate-500 text-sm mt-1">إليك ملخص النظام حسب الأقسام</p>
                            </div>
                            <button onClick={() => { loadDashboardCounts(); loadDeptStats(); }}
                            className="bg-white border border-slate-200 hover:border-teal-500 text-slate-600 hover:text-teal-600 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm">
                            <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''}/> تحديث
                        </button>
                        </div>

                        {/* المهام المعلّقة */}
                        {dashTasks.length > 0 ? (
                            <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-sm font-black text-amber-900 mb-3 flex items-center gap-2">
                                    <AlertTriangle size={16}/> مهام تحتاج إنجاز
                                </h3>
                                <ul className="space-y-2">
                                    {dashTasks.map((t, i) => (
                                        <li key={i}
                                            onClick={() => { setActiveTab(t.tab); if (t.tab === 'leads') loadLeads(); }}
                                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 cursor-pointer transition"
                                        >
                                            <span className={`w-2 h-2 rounded-full bg-${t.color}-500 shrink-0`}/>
                                            <span className="text-sm text-slate-700 font-bold flex-1">{t.text}</span>
                                            <ChevronRight size={14} className="text-slate-400"/>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                                <CheckCircle2 size={20} className="text-emerald-600 shrink-0"/>
                                <div>
                                    <h3 className="text-sm font-black text-emerald-900">كل شيء تحت السيطرة</h3>
                                    <p className="text-xs text-emerald-700 mt-0.5">لا توجد مهام معلّقة</p>
                                </div>
                            </div>
                        )}

                        {/* ─── الأقسام ──────────────────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {DEPARTMENTS.map(dept => {
                                const visible = dept.tools.filter(t => hasPermission(t.permKey));
                                const hasStats = !!dept.statsChips;
                                if (visible.length === 0 && dept.tools.length > 0 && !hasStats) return null;
                                return (
                                    <DeptSection
                                        key={dept.id}
                                        dept={dept}
                                        hasPermission={hasPermission}
                                        dashCounts={dashCounts}
                                        deptStats={deptStats}
                                        statsLoading={statsLoading}
                                        setActiveTab={setActiveTab}
                                        loadLeads={loadLeads}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ════ محتوى التبويبات ════ */}
                {activeTab === 'projects'    && hasPermission('projects')    && <ProjectsManage />}
                {activeTab === 'units'       && hasPermission('units')       && <UnitsOverview showToast={(t,m)=>alert(`${t}: ${m}`)} />}
                {activeTab === 'units_edit'  && hasPermission('units_edit')  && <div className="animate-fadeIn p-6 md:p-8"><UnitsEdit showToast={(t,m)=>alert(`${t}: ${m}`)} /></div>}
                {activeTab === 'feasibility' && hasPermission('feasibility') && <div className="animate-fadeIn"><FeasibilityCalc showToast={(t,m)=>alert(`${t}: ${m}`)} /></div>}
                {activeTab === 'inspection'  && hasPermission('inspection')  && <div className="animate-fadeIn -mt-24"><UnitInspection user={dbUser} navigateTo={()=>setActiveTab('overview')} showToast={(t,m)=>alert(`${t}: ${m}`)} /></div>}
                {activeTab === 'snaglist'    && hasPermission('snaglist')    && <div className="animate-fadeIn p-6 md:p-8"><SnagList /></div>}
                {activeTab === 'maintenance' && hasPermission('maintenance') && <div className="animate-fadeIn p-6 md:p-8"><MaintenanceManage showToast={(t,m)=>alert(`${t}: ${m}`)} activeUser={dbUser} /></div>}
                {activeTab === 'users'       && hasPermission('users_manage')&& <div className="animate-fadeIn p-6 md:p-8"><UsersManage showToast={(t,m)=>alert(`${t}: ${m}`)} /></div>}
                {activeTab === 'qr'          && hasPermission('qr')          && <QrSection />}
                {activeTab === 'bot'         && hasPermission('bot')         && <div className="animate-fadeIn"><BotSettings /></div>}
                {activeTab === 'finance'     && hasPermission('finance')     && <div className="animate-fadeIn"><Finance /></div>}
                {activeTab === 'daftra_explorer' && hasPermission('finance') && <div className="animate-fadeIn"><DaftraExplorer /></div>}
                {activeTab === 'work_cycles' && hasPermission('finance')     && <div className="animate-fadeIn"><WorkCycles /></div>}
                {activeTab === 'invoices'    && hasPermission('finance')     && <div className="animate-fadeIn"><InvoicesManage /></div>}
                {activeTab === 'purchases'   && hasPermission('finance')     && <div className="animate-fadeIn"><PurchasesManage /></div>}
                {activeTab === 'treasury'    && hasPermission('finance')     && <div className="animate-fadeIn"><TreasuryManage /></div>}
                {activeTab === 'reports'     && hasPermission('finance')     && <div className="animate-fadeIn"><ReportsHub /></div>}
                {activeTab === 'leads'       && hasPermission('leads')       && <div className="animate-fadeIn p-6 md:p-8"><LeadsManage showToast={(t,m)=>alert(`${t}: ${m}`)} /></div>}
                {activeTab === 'whatsapp'    && hasPermission('whatsapp')    && <div className="animate-fadeIn"><WhatsAppInbox /></div>}

            </main>
        </div>
    );
}
