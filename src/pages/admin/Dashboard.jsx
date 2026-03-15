import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ClipboardCheck, Wrench, Users, LogOut, Menu, X, Building, UserCircle, Bell, FileWarning, Loader2 } from 'lucide-react';

// استدعاء الأدوات (Components)
import UnitInspection from './UnitInspection'; 
import SnagList from './SnagList'; 
import UsersManage from './UsersManage';

const API_URL = "https://semak.sa/api.php";

export default function Dashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // 🔥 حالات التحقق من السيرفر (حارس البوابة)
    const [dbUser, setDbUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const verifyUser = async () => {
            // أخذ المعرف المبدئي من الذاكرة للبحث عنه في السيرفر
            const localUser = JSON.parse(localStorage.getItem('semak_current_user') || 'null');
            
            if (!localUser || !localUser.id) {
                handleForceLogout();
                return;
            }

            try {
                const res = await fetch(`${API_URL}?action=get_users`);
                const users = await res.json();
                const freshUser = users.find(u => u.id === localUser.id);
                
                if (freshUser) {
                    setDbUser(freshUser); // اعتماد بيانات السيرفر كمرجع وحيد
                    // تحديث الذاكرة المحلية بالبيانات الجديدة لضمان التزامن
                    localStorage.setItem('semak_current_user', JSON.stringify(freshUser));
                } else {
                    // إذا لم يتم العثور عليه (تم حذفه من قبل الإدارة) يطرد فوراً
                    handleForceLogout(); 
                }
            } catch (error) {
                console.error("فشل الاتصال بقاعدة البيانات للتحقق من الصلاحيات");
            } finally {
                setAuthLoading(false);
            }
        };

        verifyUser();
    }, []);

    // 🔥 دالة التحقق من الصلاحيات (تعمل على بيانات السيرفر الحية)
    const hasPermission = (permKey) => {
        if (!dbUser) return false;
        if (dbUser.role === 'admin') return true; // المدير يرى كل شيء
        if (permKey === 'all') return true; // الصفحات العامة مثل الرئيسية
        
        try {
            const perms = JSON.parse(dbUser.permissions || "[]");
            return perms.includes(permKey);
        } catch {
            return false;
        }
    };

    // القائمة الجانبية (نربط كل أداة بمفتاح الصلاحية الخاص بها في قاعدة البيانات)
    const ALL_MENU_ITEMS = [
        { id: 'overview', title: 'الرئيسية والإحصائيات', icon: LayoutDashboard, permKey: 'all' },
        { id: 'inspection', title: 'فحص وتسليم الوحدات', icon: ClipboardCheck, permKey: 'inspection' },
        { id: 'snaglist', title: 'تقارير الملاحظات', icon: FileWarning, permKey: 'inspection' }, 
        { id: 'maintenance', title: 'إدارة الصيانة', icon: Wrench, permKey: 'maintenance' },
        { id: 'users', title: 'إدارة الموظفين', icon: Users, permKey: 'users_manage' },
    ];

    // 🔥 تصفية القائمة وعرض المسموح به فقط للموظف
    const authorizedMenuItems = ALL_MENU_ITEMS.filter(item => hasPermission(item.permKey));

    const handleForceLogout = () => {
        localStorage.removeItem('semak_admin_email');
        localStorage.removeItem('semak_admin_password');
        localStorage.removeItem('semak_current_user');
        if (typeof onLogout === 'function') onLogout();
        window.location.replace('/');
    };

    // 🛡️ شاشة التحميل الآمنة (لا يظهر أي شيء حتى يعطي السيرفر الموافقة)
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
            
            {/* الشريط الجانبي الديناميكي */}
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
                            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold transition-all ${isActive ? 'bg-[#c5a059] text-white shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                                <Icon size={20} /> {item.title}
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

            {/* خلفية الجوال */}
            {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}

            {/* منطقة المحتوى */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* الشريط العلوي */}
                <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-30 absolute top-0 w-full">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Menu size={24} /></button>
                        <h1 className="text-xl font-black text-[#1a365d] hidden sm:block">{authorizedMenuItems.find(m => m.id === activeTab)?.title}</h1>
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

                {/* المحتوى المتغير داخل الشاشة مع حماية إضافية للتابات */}
                <main className="flex-1 overflow-y-auto bg-slate-50 pt-24 relative custom-scrollbar">
                    
                    {activeTab === 'overview' && (
                        <div className="p-6 md:p-8 animate-fadeIn max-w-6xl mx-auto">
                            <h2 className="text-2xl font-black text-[#1a365d] mb-6">مرحباً بك، {dbUser.name.split(' ')[0]} 👋</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {hasPermission('inspection') && (
                                    <>
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('inspection')}>
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4"><ClipboardCheck size={24}/></div>
                                            <h3 className="text-slate-500 font-bold text-sm">مهام الفحص</h3>
                                            <p className="text-3xl font-black text-[#1a365d] mt-2">إدارة</p>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('snaglist')}>
                                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4"><FileWarning size={24}/></div>
                                            <h3 className="text-slate-500 font-bold text-sm">تقارير الملاحظات</h3>
                                            <p className="text-3xl font-black text-[#1a365d] mt-2">نشط</p>
                                        </div>
                                    </>
                                )}
                                
                                {hasPermission('users_manage') && (
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('users')}>
                                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4"><Users size={24}/></div>
                                        <h3 className="text-slate-500 font-bold text-sm">إجمالي الموظفين</h3>
                                        <p className="text-3xl font-black text-[#1a365d] mt-2">مراجعة</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {activeTab === 'inspection' && hasPermission('inspection') && (
                        <div className="animate-fadeIn -mt-24"> 
                            {/* نمرر dbUser الموثوق من السيرفر كـ Prop */}
                            <UnitInspection user={dbUser} navigateTo={() => setActiveTab('overview')} showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}
                    
                    {activeTab === 'snaglist' && hasPermission('inspection') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <SnagList />
                        </div>
                    )}

                    {activeTab === 'maintenance' && hasPermission('maintenance') && (
                        <div className="p-10 text-center font-bold text-slate-400">قسم إدارة الصيانـة (جاري ربطه)</div>
                    )}

                    {activeTab === 'users' && hasPermission('users_manage') && (
                        <div className="animate-fadeIn p-6 md:p-8"> 
                            <UsersManage showToast={(title, msg, type) => alert(`${title}: ${msg}`)} />
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}