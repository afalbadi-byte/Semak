import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Menu, X, Building,
    UserCircle, Bell, FileWarning, Loader2, FilePenLine, QrCode, Calculator,
    ExternalLink, Search, Printer, RefreshCw, TrendingUp, Building2, Edit2, MessageCircle, Bot,
    AlertTriangle, DollarSign, ArrowLeft, CheckCircle2
} from 'lucide-react';

// استدعاء الأدوات والمكونات الخارجية
import UnitInspection from './UnitInspection';
import SnagList from './SnagList';
import UsersManage from './UsersManage';
import MaintenanceManage from './MaintenanceManage';
import LeadsManage from './LeadsManage';
import BotSettings from './BotSettings';
import FeasibilityCalc from './FeasibilityCalc';
import UnitsOverview from './UnitsOverview';
import ProjectsManage from './ProjectsManage';
import UnitsEdit from './UnitsEdit';
import WhatsAppInbox from './WhatsAppInbox';

const API_URL = "https://semak.sa/api.php";

// ─── قسم QR — يجيب الوحدات من DB ──────────────────────────────
function QrSection() {
    const [units, setUnits] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch(`${API_URL}?action=get_projects_data`)
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    // فقط الوحدات التي لها مالك مسجل
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
                        <Printer size={18} /> طباعة الصفحة
                    </button>
                </div>
                <div className="p-8 bg-slate-50/20">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400"><RefreshCw className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {units.map(unit => {
                                const url    = `${window.location.origin}/maintenance?unit=${encodeURIComponent(unit)}`;
                                const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&margin=10`;
                                return (
                                    <div key={unit} className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm flex flex-col items-center justify-between">
                                        <div>
                                            <h4 className="font-black text-[#1a365d] text-xl mb-1">{unit}</h4>
                                            <p className="text-xs text-slate-400 mb-4">مسح لطلب الصيانة</p>
                                        </div>
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

export default function Dashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');

    // حالات التحقق من السيرفر (حارس البوابة)
    const [dbUser, setDbUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // حالات خاصة بسجل المهتمين (Leads)
    const [leads, setLeads] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [dataLoading, setDataLoading] = useState(false);

    // عدادات الإشعارات والمهام للوحة الرئيسية
    const [dashCounts, setDashCounts] = useState({});
    const [dashTasks, setDashTasks] = useState([]);

    const loadDashboardCounts = async () => {
        try {
            const res = await fetch(`${API_URL}?action=dashboard_counts`);
            const data = await res.json();
            if (data.success) {
                setDashCounts(data.counts || {});
                setDashTasks(data.tasks || []);
            }
        } catch (e) {}
    };

    useEffect(() => {
        if (activeTab === 'overview') loadDashboardCounts();
    }, [activeTab]);

    useEffect(() => {
        const verifyUser = async () => {
            const localUser = JSON.parse(localStorage.getItem('semak_current_user') || 'null');
            
            if (!localUser || !localUser.id) {
                handleForceLogout();
                return;
            }

            try {
                const res = await fetch(`${API_URL}?action=get_users`);
                const responseData = await res.json();
                
                const usersArray = responseData.success ? responseData.data : responseData;
                const freshUser = usersArray.find(u => String(u.id) === String(localUser.id));
                
                if (freshUser) {
                    setDbUser(freshUser); 
                    localStorage.setItem('semak_current_user', JSON.stringify(freshUser));
                } else {
                    handleForceLogout(); 
                }
            } catch (error) {
                handleForceLogout(); 
            } finally {
                setAuthLoading(false);
            }
        };

        verifyUser();
    }, []);

    const hasPermission = (permKey) => {
        if (!dbUser) return false;
        if (dbUser.role === 'admin') return true; 
        if (permKey === 'all') return true; 
        
        try {
            const perms = JSON.parse(dbUser.permissions || "[]");
            return perms.includes(permKey);
        } catch {
            return false;
        }
    };

    const loadLeads = async () => {
        setDataLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_leads`);
            const data = await res.json();
            setLeads(data);
        } catch (err) {
            console.error(err);
        } finally {
            setDataLoading(false);
        }
    };

    // القائمة الجانبية الشاملة لجميع أدوات النظام (تم إضافة الحاسبة هنا 🔥)
    const ALL_MENU_ITEMS = [
        { id: 'overview',   title: 'الرئيسية والإحصائيات',  icon: LayoutDashboard, permKey: 'all' },
        { id: 'projects',   title: 'إدارة المشاريع والوحدات', icon: Building,        permKey: 'admin' },
        { id: 'units',      title: 'بيانات الوحدات',         icon: Building2,       permKey: 'admin' },
        { id: 'units_edit', title: 'تعديل الوحدات والملاك',  icon: Edit2,            permKey: 'admin' },
        { id: 'feasibility',title: 'حاسبة الجدوى والعروض',  icon: TrendingUp,      permKey: 'admin' },
        { id: 'inspection', title: 'فحص وتسليم الوحدات', icon: ClipboardCheck, permKey: 'inspection' },
        { id: 'snaglist', title: 'تقارير الملاحظات', icon: FileWarning, permKey: 'inspection' }, 
        { id: 'maintenance', title: 'إدارة الصيانة', icon: Wrench, permKey: 'maintenance' },
        { id: 'leads', title: 'سجل المهتمين', icon: Users, permKey: 'leads' },
        { id: 'bot', title: 'بوت فهد (إعدادات وإحصائيات)', icon: Bot, permKey: 'admin' },
        { id: 'qr', title: 'رموز الوحدات (QR)', icon: QrCode, permKey: 'qr' },
        { id: 'letters', title: 'منشئ الخطابات', icon: FilePenLine, permKey: 'letters', isLink: true, path: '/admin/letter-generator' },
        { id: 'accounting', title: 'النظام المحاسبي', icon: Calculator, permKey: 'accounting', isExternal: true, path: 'https://semak.daftra.com/' },
        { id: 'users', title: 'إدارة الموظفين', icon: UserCircle, permKey: 'users_manage' },
        { id: 'whatsapp', title: 'صندوق واتساب', icon: MessageCircle, permKey: 'admin' },
    ];

    const authorizedMenuItems = ALL_MENU_ITEMS.filter(item => hasPermission(item.permKey));

    const handleMenuClick = (item) => {
        if (item.isExternal) {
            window.open(item.path, '_blank');
        } else if (item.isLink) {
            window.location.href = item.path;
        } else {
            setActiveTab(item.id);
            if (item.id === 'leads') loadLeads();
        }
    };

    const handleForceLogout = () => {
        localStorage.removeItem('semak_admin_email');
        localStorage.removeItem('semak_current_user');
        if (typeof onLogout === 'function') onLogout();
        window.location.replace('/login');
    };

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-5 font-cairo">
                <Loader2 className="animate-spin text-[#1a365d]" size={48} />
                <p className="text-xl font-bold text-[#1a365d]">جاري مصادقة الهوية والاتصال بقاعدة البيانات...</p>
            </div>
        );
    }

    if (!dbUser) return null;

    const currentPageTitle = activeTab === 'overview'
        ? 'لوحة الإدارة'
        : (authorizedMenuItems.find(m => m.id === activeTab)?.title || 'لوحة التحكم');

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-cairo overflow-hidden" dir="rtl">

            {/* الهيدر العلوي بدلاً من القائمة الجانبية */}
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 shadow-sm">
                <button
                    onClick={() => setActiveTab('overview')}
                    className="flex items-center gap-3 hover:opacity-80 transition"
                    title="العودة للرئيسية"
                >
                    <div className="w-10 h-10 bg-gradient-to-br from-[#c5a059] to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                        <Building size={20} className="text-white"/>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-[#1a365d] leading-tight">سماك العقارية</div>
                        <div className="text-[10px] font-bold text-slate-400 leading-tight hidden sm:block">{currentPageTitle}</div>
                    </div>
                </button>

                <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 md:pl-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                            <UserCircle size={22}/>
                        </div>
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-black text-[#1a365d] leading-tight">{dbUser.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 leading-tight">
                                {dbUser.role === 'admin' ? 'مدير نظام' : dbUser.job || 'موظف'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleForceLogout}
                        className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 md:px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 text-sm"
                        title="تسجيل الخروج"
                    >
                        <LogOut size={16}/>
                        <span className="hidden md:inline">خروج</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">

                    {/* زر العودة للرئيسية + اسم الصفحة الحالية */}
                    {activeTab !== 'overview' && (
                        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur px-4 md:px-8 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className="flex items-center gap-2 text-sm font-bold text-[#1a365d] hover:text-teal-600 transition bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-500 px-3 md:px-4 py-2 rounded-xl"
                            >
                                <ArrowLeft size={16}/>
                                <span className="hidden sm:inline">العودة للرئيسية</span>
                                <span className="sm:hidden">رجوع</span>
                            </button>
                            <h2 className="text-sm md:text-base font-black text-[#1a365d] truncate">{currentPageTitle}</h2>
                        </div>
                    )}

                    {/* --- الصفحة الرئيسية (Overview) — تصميم جديد بالإيقونات والشارات --- */}
                    {activeTab === 'overview' && (
                        <div className="p-4 md:p-8 animate-fadeIn max-w-7xl mx-auto">
                            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-black text-[#1a365d]">مرحباً، {dbUser.name.split(' ')[0]}</h2>
                                    <p className="text-slate-500 text-sm mt-1">إليك ما يحتاج اهتمامك اليوم</p>
                                </div>
                                <button onClick={loadDashboardCounts} className="bg-white border border-slate-200 hover:border-teal-500 text-slate-600 hover:text-teal-600 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm">
                                    <RefreshCw size={14} /> تحديث
                                </button>
                            </div>

                            {/* قائمة المهام — رؤوس أقلام لما يحتاج اهتمام */}
                            {dashTasks.length > 0 ? (
                                <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-8 shadow-sm">
                                    <h3 className="text-sm font-black text-amber-900 mb-3 flex items-center gap-2">
                                        <AlertTriangle size={16}/> مهام تحتاج إنجاز
                                    </h3>
                                    <ul className="space-y-2">
                                        {dashTasks.map((t, i) => (
                                            <li key={i} onClick={() => { setActiveTab(t.tab); if (t.tab === 'leads') loadLeads(); }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 cursor-pointer transition">
                                                <span className={`w-2 h-2 rounded-full bg-${t.color}-500 shrink-0`}/>
                                                <span className="text-sm text-slate-700 font-bold flex-1">{t.text}</span>
                                                <ArrowLeft size={14} className="text-slate-400"/>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 shadow-sm flex items-center gap-3">
                                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0"/>
                                    <div>
                                        <h3 className="text-sm font-black text-emerald-900">كل شيء تحت السيطرة</h3>
                                        <p className="text-xs text-emerald-700 mt-0.5">لا توجد مهام معلّقة حالياً</p>
                                    </div>
                                </div>
                            )}

                            {/* شبكة الإيقونات */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                                {hasPermission('leads') && (
                                    <IconCard icon={Users} label="المهتمين" badge={dashCounts.leads_new} color="teal"
                                        onClick={() => { setActiveTab('leads'); loadLeads(); }}/>
                                )}
                                {hasPermission('maintenance') && (
                                    <IconCard icon={Wrench} label="الصيانة" badge={dashCounts.maintenance_open} color="purple"
                                        onClick={() => setActiveTab('maintenance')}/>
                                )}
                                {hasPermission('admin') && (
                                    <IconCard icon={Bot} label="بوت فهد" badge={dashCounts.bot_customers_today} color="amber" badgeLabel="اليوم"
                                        onClick={() => setActiveTab('bot')}/>
                                )}
                                {hasPermission('inspection') && (
                                    <>
                                        <IconCard icon={ClipboardCheck} label="فحص الوحدات" badge={dashCounts.inspections_pending} color="indigo"
                                            onClick={() => setActiveTab('inspection')}/>
                                        <IconCard icon={FileWarning} label="الملاحظات" color="red"
                                            onClick={() => setActiveTab('snaglist')}/>
                                    </>
                                )}
                                {hasPermission('admin') && (
                                    <>
                                        <IconCard icon={Building} label="المشاريع" color="blue"
                                            onClick={() => setActiveTab('projects')}/>
                                        <IconCard icon={Building2} label="الوحدات" color="sky"
                                            onClick={() => setActiveTab('units')}/>
                                        <IconCard icon={Edit2} label="تعديل الوحدات" color="cyan"
                                            onClick={() => setActiveTab('units_edit')}/>
                                        <IconCard icon={TrendingUp} label="حاسبة الجدوى" color="emerald"
                                            onClick={() => setActiveTab('feasibility')}/>
                                        <IconCard icon={MessageCircle} label="صندوق واتساب" color="green"
                                            onClick={() => setActiveTab('whatsapp')}/>
                                    </>
                                )}
                                {hasPermission('qr') && (
                                    <IconCard icon={QrCode} label="رموز QR" color="slate"
                                        onClick={() => setActiveTab('qr')}/>
                                )}
                                {hasPermission('letters') && (
                                    <IconCard icon={FilePenLine} label="الخطابات" color="rose"
                                        onClick={() => window.location.href = '/admin/letter-generator'}/>
                                )}
                                {hasPermission('users_manage') && (
                                    <IconCard icon={UserCircle} label="الموظفين" color="blue"
                                        onClick={() => setActiveTab('users')}/>
                                )}
                                {hasPermission('accounting') && (
                                    <IconCard icon={Calculator} label="المحاسبة" color="slate"
                                        onClick={() => window.open('https://semak.daftra.com/', '_blank')}/>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && hasPermission('admin') && (
                        <ProjectsManage />
                    )}

                    {activeTab === 'units' && hasPermission('admin') && (
                        <UnitsOverview showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                    )}

                    {activeTab === 'units_edit' && hasPermission('admin') && (
                        <div className="animate-fadeIn p-6 md:p-8">
                            <UnitsEdit showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                    {activeTab === 'feasibility' && hasPermission('admin') && (
                        <div className="animate-fadeIn">
                            <FeasibilityCalc showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                    {/* --- قسم الفحص --- */}
                    {activeTab === 'inspection' && hasPermission('inspection') && (
                        <div className="animate-fadeIn -mt-24"> 
                            <UnitInspection user={dbUser} navigateTo={() => setActiveTab('overview')} showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}
                    
                    {/* --- قسم التقارير --- */}
                    {activeTab === 'snaglist' && hasPermission('inspection') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <SnagList />
                        </div>
                    )}

                    {/* --- قسم الصيانة --- */}
                    {activeTab === 'maintenance' && hasPermission('maintenance') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <MaintenanceManage showToast={(title, msg, type) => alert(`${title}: ${msg}`)} activeUser={dbUser} />
                        </div>
                    )}

                    {/* --- قسم المستخدمين --- */}
                    {activeTab === 'users' && hasPermission('users_manage') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <UsersManage showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                    {/* --- قسم رموز الاستجابة السريعة (QR) --- */}
                    {activeTab === 'qr' && hasPermission('qr') && (
                        <QrSection />
                    )}

                    {/* --- قسم بوت فهد --- */}
                    {activeTab === 'bot' && hasPermission('admin') && (
                        <div className="animate-fadeIn">
                            <BotSettings />
                        </div>
                    )}

                    {/* --- قسم سجل المهتمين (Leads) --- */}
                    {activeTab === 'leads' && hasPermission('leads') && (
                        <div className="animate-fadeIn p-6 md:p-8">
                            <LeadsManage showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                    {/* --- صندوق واتساب --- */}
                    {activeTab === 'whatsapp' && hasPermission('admin') && (
                        <div className="animate-fadeIn">
                            <WhatsAppInbox />
                        </div>
                    )}

            </main>
        </div>
    );
}

// بطاقة إيقونة مع شارة إشعار
function IconCard({ icon: Icon, label, badge, badgeLabel, color = 'slate', onClick }) {
    const palette = {
        teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    hover: 'hover:bg-teal-600',    badge: 'bg-teal-600' },
        purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  hover: 'hover:bg-purple-600',  badge: 'bg-purple-600' },
        amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   hover: 'hover:bg-amber-600',   badge: 'bg-amber-600' },
        indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  hover: 'hover:bg-indigo-600',  badge: 'bg-indigo-600' },
        red:     { bg: 'bg-red-50',     text: 'text-red-700',     hover: 'hover:bg-red-600',     badge: 'bg-red-600' },
        blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    hover: 'hover:bg-blue-600',    badge: 'bg-blue-600' },
        sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     hover: 'hover:bg-sky-600',     badge: 'bg-sky-600' },
        cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    hover: 'hover:bg-cyan-600',    badge: 'bg-cyan-600' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', hover: 'hover:bg-emerald-600', badge: 'bg-emerald-600' },
        green:   { bg: 'bg-green-50',   text: 'text-green-700',   hover: 'hover:bg-green-600',   badge: 'bg-green-600' },
        rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    hover: 'hover:bg-rose-600',    badge: 'bg-rose-600' },
        slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',   hover: 'hover:bg-slate-700',   badge: 'bg-slate-700' },
    };
    const c = palette[color] || palette.slate;
    const hasBadge = Number(badge) > 0;
    return (
        <button
            onClick={onClick}
            className="group bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200 transition-all p-3 md:p-4 flex flex-col items-center justify-center text-center min-h-[110px] md:min-h-[130px] relative"
        >
            {hasBadge && (
                <span className={`absolute -top-1.5 -right-1.5 ${c.badge} text-white text-[10px] md:text-xs font-black rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-md ring-2 ring-white`}>
                    {badge}
                </span>
            )}
            {badgeLabel && (
                <span className="absolute top-1 left-1 text-[9px] font-bold text-slate-400">{badgeLabel}</span>
            )}
            <div className={`w-12 h-12 md:w-14 md:h-14 ${c.bg} ${c.text} ${c.hover} group-hover:text-white rounded-2xl flex items-center justify-center mb-2 transition-colors`}>
                <Icon size={22}/>
            </div>
            <div className="text-xs md:text-sm font-black text-[#1a365d] leading-tight">{label}</div>
        </button>
    );
}
