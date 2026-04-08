import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Menu, X, Building, 
    UserCircle, Bell, FileWarning, Loader2, FilePenLine, QrCode, Calculator, 
    ExternalLink, Search, Printer, RefreshCw, TrendingUp 
} from 'lucide-react';

// استدعاء الأدوات والمكونات الخارجية
import UnitInspection from './UnitInspection'; 
import SnagList from './SnagList'; 
import UsersManage from './UsersManage';
import MaintenanceManage from './MaintenanceManage';
import LeadsManage from './LeadsManage';
import FeasibilityCalc from './FeasibilityCalc'; // 🔥 استدعاء الحاسبة الجديدة

const API_URL = "https://semak.sa/api.php";

export default function Dashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // حالات التحقق من السيرفر (حارس البوابة)
    const [dbUser, setDbUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // حالات خاصة بسجل المهتمين (Leads)
    const [leads, setLeads] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [dataLoading, setDataLoading] = useState(false);

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
        { id: 'overview', title: 'الرئيسية والإحصائيات', icon: LayoutDashboard, permKey: 'all' },
        { id: 'feasibility', title: 'حاسبة الجدوى والعروض', icon: TrendingUp, permKey: 'admin' }, // 🔥 الزر الجديد
        { id: 'inspection', title: 'فحص وتسليم الوحدات', icon: ClipboardCheck, permKey: 'inspection' },
        { id: 'snaglist', title: 'تقارير الملاحظات', icon: FileWarning, permKey: 'inspection' }, 
        { id: 'maintenance', title: 'إدارة الصيانة', icon: Wrench, permKey: 'maintenance' },
        { id: 'leads', title: 'سجل المهتمين', icon: Users, permKey: 'leads' },
        { id: 'qr', title: 'رموز الوحدات (QR)', icon: QrCode, permKey: 'qr' },
        { id: 'letters', title: 'منشئ الخطابات', icon: FilePenLine, permKey: 'letters', isLink: true, path: '/admin/letter-generator' },
        { id: 'accounting', title: 'النظام المحاسبي', icon: Calculator, permKey: 'accounting', isExternal: true, path: 'https://semak.daftra.com/' },
        { id: 'users', title: 'إدارة الموظفين', icon: UserCircle, permKey: 'users_manage' },
    ];

    const authorizedMenuItems = ALL_MENU_ITEMS.filter(item => hasPermission(item.permKey));

    const handleMenuClick = (item) => {
        if (item.isExternal) {
            window.open(item.path, '_blank');
        } else if (item.isLink) {
            window.location.href = item.path;
        } else {
            setActiveTab(item.id);
            setIsMobileMenuOpen(false);
            if (item.id === 'leads') loadLeads();
        }
    };

    const handleForceLogout = () => {
        localStorage.removeItem('semak_admin_email');
        localStorage.removeItem('semak_admin_password');
        localStorage.removeItem('semak_current_user');
        if (typeof onLogout === 'function') onLogout();
        window.location.replace('/');
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

    return (
        <div className="flex h-screen bg-slate-50 font-cairo overflow-hidden" dir="rtl">
            
            <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-72 bg-[#1a365d] text-white transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} flex flex-col shadow-2xl`}>
                <div className="h-24 flex items-center justify-between px-6 border-b border-white/10">
                    <div className="text-2xl font-black flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#c5a059] to-yellow-600 rounded-xl flex items-center justify-center shadow-lg"><Building size={20} className="text-white"/></div>
                        سماك العقارية
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-300 hover:text-white"><X size={24}/></button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {authorizedMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => handleMenuClick(item)} 
                                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold transition-all ${isActive ? 'bg-[#c5a059] text-white shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                            >
                                <Icon size={20} /> {item.title}
                                {(item.isExternal || item.isLink) && <ExternalLink size={14} className="mr-auto opacity-50" />}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={handleForceLogout} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl font-bold transition-all">
                        <LogOut size={20} /> تسجيل الخروج
                    </button>
                </div>
            </aside>

            {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-30 absolute top-0 w-full">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Menu size={24} /></button>
                        <h1 className="text-xl font-black text-[#1a365d] hidden sm:block">{authorizedMenuItems.find(m => m.id === activeTab)?.title || 'لوحة التحكم'}</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative text-slate-400 hover:text-indigo-600"><Bell size={24} /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></button>
                        <div className="flex items-center gap-3 border-r border-slate-200 pr-6">
                            <div className="text-left hidden md:block">
                                <p className="text-sm font-black text-[#1a365d]">{dbUser.name}</p>
                                <p className="text-xs font-bold text-slate-400">
                                  {dbUser.role === 'admin' ? 'مدير نظام (صلاحيات كاملة)' : dbUser.job || 'موظف'}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><UserCircle size={28} /></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-slate-50 pt-24 relative custom-scrollbar">
                    
                    {/* --- الصفحة الرئيسية (Overview) --- */}
                    {activeTab === 'overview' && (
                        <div className="p-6 md:p-8 animate-fadeIn max-w-6xl mx-auto">
                            <h2 className="text-2xl font-black text-[#1a365d] mb-6">مرحباً بك، {dbUser.name.split(' ')[0]} 👋</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                
                                {/* 🔥 الكارت الجديد الخاص بالحاسبة يظهر للمدير فقط */}
                                {hasPermission('admin') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('feasibility')}>
                                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><TrendingUp size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">حاسبة الجدوى</h3>
                                        <p className="text-2xl font-black text-[#1a365d] mt-2">دراسة وعروض</p>
                                    </div>
                                )}

                                {hasPermission('inspection') && (
                                    <>
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('inspection')}>
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><ClipboardCheck size={24}/></div>
                                            <h3 className="text-slate-500 font-bold text-sm">فحص وتسليم الوحدات</h3>
                                            <p className="text-2xl font-black text-[#1a365d] mt-2">إدارة المهام</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('snaglist')}>
                                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors"><FileWarning size={24}/></div>
                                            <h3 className="text-slate-500 font-bold text-sm">تقارير الملاحظات</h3>
                                            <p className="text-2xl font-black text-[#1a365d] mt-2">مراجعة</p>
                                        </div>
                                    </>
                                )}

                                {hasPermission('maintenance') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('maintenance')}>
                                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Wrench size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">طلبات الصيانة</h3>
                                        <p className="text-2xl font-black text-[#1a365d] mt-2">إدارة التذاكر</p>
                                    </div>
                                )}

                                {hasPermission('leads') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => { setActiveTab('leads'); loadLeads(); }}>
                                        <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors"><Users size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">سجل المهتمين</h3>
                                        <p className="text-2xl font-black text-[#1a365d] mt-2">متابعة العملاء</p>
                                    </div>
                                )}

                                {hasPermission('qr') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('qr')}>
                                        <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-slate-800 group-hover:text-white transition-colors"><QrCode size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">رموز الوحدات (QR)</h3>
                                        <p className="text-2xl font-black text-[#1a365d] mt-2">توليد للطباعة</p>
                                    </div>
                                )}
                                
                                {hasPermission('users_manage') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition group" onClick={() => setActiveTab('users')}>
                                        <div className="w-12 h-12 bg-blue-50 text-[#1a365d] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1a365d] group-hover:text-white transition-colors"><UserCircle size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">إدارة الموظفين</h3>
                                        <p className="text-2xl font-black text-[#1a365d] mt-2">تعديل الصلاحيات</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {/* 🔥 قسم الحاسبة الجديد */}
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
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {["SM-A01", "SM-A02", "SM-A03", "SM-A04", "SM-A05", "SM-A06", "SM-A07"].map(unit => {
                                            const url = `${window.location.origin}/maintenance?unit=${unit}`;
                                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&margin=10`;
                                            return (
                                                <div key={unit} className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm flex flex-col items-center justify-between">
                                                    <div>
                                                        <h4 className="font-black text-[#1a365d] text-xl mb-1">{unit}</h4>
                                                        <p className="text-xs text-slate-400 mb-4">مسح لطلب الصيانة</p>
                                                    </div>
                                                    <img src={qrUrl} alt={`QR Code ${unit}`} className="w-full max-w-[150px] mb-4 border-2 border-slate-100 rounded-xl" crossOrigin="anonymous" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- قسم سجل المهتمين (Leads) --- */}
                    {activeTab === 'leads' && hasPermission('leads') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <LeadsManage showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}