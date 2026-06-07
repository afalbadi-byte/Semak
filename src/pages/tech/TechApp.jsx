import React, { useState, useEffect, useCallback, Suspense, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, ClipboardCheck, Users, LogOut, UserCircle,
    Loader2, RefreshCw, DollarSign, ArrowLeft, CheckCircle2, Coins,
    ShieldCheck, BarChart3, Receipt, ShoppingCart, FileText, Tag,
    Truck, Package, CreditCard, ArrowRightLeft, BookOpen, Link2,
    Menu, X, ChevronDown, ExternalLink, Bell, ScrollText, Zap, Lock,
    Building, AlertTriangle, Clock, TrendingUp, Key,
} from 'lucide-react';

// ── محاسبة (من admin) ─────────────────────────────────────────────────────────
const Finance           = React.lazy(() => import('../admin/Finance'));
const DaftraExplorer    = React.lazy(() => import('../admin/DaftraExplorer'));
const InvoicesManage    = React.lazy(() => import('../admin/InvoicesManage'));
const PurchasesManage   = React.lazy(() => import('../admin/PurchasesManage'));
const TreasuryManage    = React.lazy(() => import('../admin/TreasuryManage'));
const ReportsHub        = React.lazy(() => import('../admin/ReportsHub'));
const QuotationsManage  = React.lazy(() => import('../admin/QuotationsManage'));
const ExpensesManage    = React.lazy(() => import('../admin/ExpensesManage'));
const ClientsManage     = React.lazy(() => import('../admin/ClientsManage'));
const SuppliersManage   = React.lazy(() => import('../admin/SuppliersManage'));
const ProductsManage    = React.lazy(() => import('../admin/ProductsManage'));
const ChequesManage     = React.lazy(() => import('../admin/ChequesManage'));
const PaymentsManage    = React.lazy(() => import('../admin/PaymentsManage'));
const AccountingHub     = React.lazy(() => import('../admin/AccountingHub'));
const LedgerHub         = React.lazy(() => import('../admin/LedgerHub'));
const NotesReturns      = React.lazy(() => import('../admin/NotesReturns'));
const DaftraLink        = React.lazy(() => import('../admin/DaftraLink'));
const PartyDetail       = React.lazy(() => import('../admin/PartyDetail'));
const EntryDetail       = React.lazy(() => import('../admin/EntryDetail'));
const InvoiceDetail     = React.lazy(() => import('../admin/InvoiceDetail'));
const AccountDetail     = React.lazy(() => import('../admin/AccountDetail'));
const ProductMovement   = React.lazy(() => import('../admin/ProductMovement'));
const WorkCycles        = React.lazy(() => import('../admin/WorkCycles'));
const RentalsManage     = React.lazy(() => import('../admin/RentalsManage'));

// ── بوابة التقنية (SW Portal) ─────────────────────────────────────────────────
const SwOverview     = React.lazy(() => import('../admin/SwOverview'));
const SwClients      = React.lazy(() => import('../admin/SwClients'));
const SwTickets      = React.lazy(() => import('../admin/SwTickets'));
const SwProducts     = React.lazy(() => import('../admin/SwProducts'));
const SwInvoices     = React.lazy(() => import('../admin/SwInvoices'));

// ── منصة + مشترك ──────────────────────────────────────────────────────────────
const PlatformAdmin    = React.lazy(() => import('../admin/PlatformAdmin'));
const UsersManage      = React.lazy(() => import('../admin/UsersManage'));
const ActivityLog      = React.lazy(() => import('../admin/ActivityLog'));
const SecuritySettings = React.lazy(() => import('../admin/SecuritySettings'));
const SubscriptionPage = React.lazy(() => import('../admin/SubscriptionPage'));

import { API_URL, apiGet, TENANT } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';
import { ToastProvider, useToast, ThemeToggle } from '../../components/ui';
import ErrorBoundary from '../../components/ErrorBoundary';

// ─── مستويات الخطط ──────────────────────────────────────────────────────────
const PLAN_RANK  = { trial: 0, starter: 1, pro: 2, enterprise: 3 };
const PLAN_NAME  = { trial: 'تجربة مجانية', starter: 'المبتدئ', pro: 'الاحترافي', enterprise: 'المؤسسي' };
const PLAN_PRICE = { starter: 299, pro: 599, enterprise: 1499 };

function PlanGate({ plan = 'trial', required, featureName, onUpgrade, children }) {
    if ((PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[required] ?? 0)) return children;
    const upgradeUrl = `https://wa.me/966920032842?text=${encodeURIComponent(`أود الترقية إلى باقة ${PLAN_NAME[required] || required}`)}`;
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fadeIn" dir="rtl">
            <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <Lock size={34} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-brand-800 dark:text-brand-50 mb-2">
                {featureName || 'هذه الميزة'} — باقة {PLAN_NAME[required] || required}
            </h3>
            <p className="text-slate-500 dark:text-brand-400 text-sm max-w-sm mb-6">
                هذه الميزة متاحة في باقة <strong>{PLAN_NAME[required]}</strong> وما فوق.
                {PLAN_PRICE[required] && ` (${PLAN_PRICE[required].toLocaleString('ar-SA')} ريال/شهر)`}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
                <a href={upgradeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-500/20">
                    <Zap size={15} /> ترقية إلى {PLAN_NAME[required]}
                </a>
                {onUpgrade && (
                    <button onClick={onUpgrade}
                        className="flex items-center gap-2 bg-brand-50 dark:bg-brand-800 text-brand-700 dark:text-brand-200 border border-brand-100 dark:border-brand-700 font-bold px-5 py-3 rounded-xl transition hover:border-indigo-400/40">
                        عرض الباقات
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── شريط حالة الاشتراك ─────────────────────────────────────────────────────
function TrialBanner({ plan, daysLeft, status }) {
    const [dismissed, setDismissed] = useState(false);
    if (plan !== 'trial' || status !== 'active' || dismissed) return null;
    const expired = daysLeft <= 0;
    const urgent  = !expired && daysLeft <= 7;
    const upgradeUrl = 'https://wa.me/966920032842?text=' + encodeURIComponent('أود ترقية اشتراكي في سماك التقنية');
    return (
        <div className={`flex items-center justify-between px-4 md:px-6 py-2.5 text-sm font-bold shrink-0 ${
            expired ? 'bg-red-600 text-white' :
            urgent  ? 'bg-amber-500 text-slate-950' :
                      'bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-300'
        }`}>
            <div className="flex items-center gap-2">
                {(expired || urgent) ? <AlertTriangle size={15} /> : <Clock size={15} />}
                {expired
                    ? 'انتهت فترة التجربة المجانية — يرجى ترقية الاشتراك للاستمرار'
                    : urgent
                    ? `تجربتك تنتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} — بادر بالترقية`
                    : `تجربة مجانية — متبقي ${daysLeft} يوماً`
                }
            </div>
            <div className="flex items-center gap-3">
                <a href={upgradeUrl} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition ${
                        expired ? 'bg-white text-red-600 hover:bg-red-50' :
                        urgent  ? 'bg-slate-950 text-amber-400 hover:bg-slate-800' :
                                  'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}>
                    <Zap size={12} /> ترقية الآن
                </a>
                {!expired && (
                    <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition" aria-label="إغلاق">
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── نافذة تغيير كلمة المرور الإجباري ──────────────────────────────────────
function ForcePasswordChangeModal({ userId, jwt, onDone }) {
    const [oldPw, setOldPw]   = useState('');
    const [newPw, setNewPw]   = useState('');
    const [cfPw,  setCfPw]    = useState('');
    const [loading, setLoading] = useState(false);
    const [err,   setErr]     = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        if (newPw.length < 8) { setErr('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
        if (newPw !== cfPw)   { setErr('كلمتا المرور غير متطابقتين'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=change_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
                body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
            });
            const data = await res.json();
            if (data.success) {
                try {
                    const u = JSON.parse(localStorage.getItem('semak_current_user') || '{}');
                    u.must_change_password = 0;
                    localStorage.setItem('semak_current_user', JSON.stringify(u));
                } catch {}
                onDone();
            } else setErr(data.message || 'حدث خطأ، حاول مرة أخرى');
        } catch { setErr('تعذّر الاتصال بالخادم'); }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-950/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-brand-900 rounded-3xl shadow-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden mx-4">
                <div className="p-6 border-b border-brand-100/70 dark:border-brand-700 bg-indigo-50 dark:bg-indigo-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-brand-900 dark:text-white">تغيير كلمة المرور</h2>
                            <p className="text-sm text-indigo-700 dark:text-indigo-400">كلمة المرور المؤقتة تتطلب التغيير قبل المتابعة</p>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {err && <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-bold">{err}</div>}
                    {[
                        { label: 'كلمة المرور الحالية (المؤقتة)', val: oldPw, set: setOldPw },
                        { label: 'كلمة المرور الجديدة',             val: newPw, set: setNewPw },
                        { label: 'تأكيد كلمة المرور',               val: cfPw,  set: setCfPw  },
                    ].map(f => (
                        <div key={f.label}>
                            <label className="block text-sm font-bold text-brand-700 dark:text-brand-300 mb-1.5">{f.label}</label>
                            <input type="password" value={f.val} onChange={e => f.set(e.target.value)} required
                                className="w-full border border-brand-200 dark:border-brand-600 rounded-xl px-4 py-3 bg-brand-50 dark:bg-brand-800 text-brand-900 dark:text-white placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                        </div>
                    ))}
                    <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl py-3 transition-all disabled:opacity-60 mt-2">
                        {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                        {loading ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── مجموعات التنقل ──────────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        id: 'sw', label: 'بوابة التقنية',
        activeCls: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20',
        sectionCls: 'text-indigo-300',
        items: [
            { tabId: 'sw_overview', icon: LayoutDashboard, label: 'لوحة التحكم' },
            { tabId: 'sw_clients',  icon: Users,           label: 'العملاء' },
            { tabId: 'sw_tickets',  icon: ClipboardCheck,  label: 'تذاكر الدعم' },
            { tabId: 'sw_products', icon: Package,         label: 'المنتجات' },
            { tabId: 'sw_invoices', icon: Receipt,         label: 'فواتير البوابة' },
        ],
    },
    {
        id: 'accounting', label: 'المحاسبة',
        activeCls: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20',
        sectionCls: 'text-emerald-300',
        items: [
            { tabId: 'ledger',     icon: BookOpen,       label: 'الدفترة المستقلة' },
            { tabId: 'parties',    icon: Users,          label: 'كشوف الأطراف' },
            { tabId: 'accounting', icon: FileText,       label: 'دفتر المحاسبة' },
            { tabId: 'notes',      icon: FileText,       label: 'الإشعارات والمرتجعات' },
            { tabId: 'invoices',   icon: Receipt,        label: 'الفواتير' },
            { tabId: 'quotations', icon: FileText,       label: 'عروض الأسعار' },
            { tabId: 'purchases',  icon: ShoppingCart,   label: 'فواتير الشراء' },
            { tabId: 'expenses',   icon: Tag,            label: 'المصروفات' },
            { tabId: 'payments',   icon: ArrowRightLeft, label: 'المدفوعات والتحصيل' },
            { tabId: 'cheques',    icon: CreditCard,     label: 'الشيكات' },
            { tabId: 'treasury',   icon: Coins,          label: 'الخزاين' },
            { tabId: 'reports',    icon: BarChart3,      label: 'التقارير المالية' },
            { tabId: 'finance',    icon: DollarSign,     label: 'الإيرادات والمصروفات' },
        ],
    },
    {
        id: 'contacts', label: 'جهات الاتصال',
        activeCls: 'bg-purple-600 text-white shadow-lg shadow-purple-600/20',
        sectionCls: 'text-purple-300',
        items: [
            { tabId: 'clients',   icon: Users,   label: 'إدارة العملاء' },
            { tabId: 'suppliers', icon: Truck,   label: 'إدارة الموردين' },
            { tabId: 'products',  icon: Package, label: 'المنتجات والخدمات' },
        ],
    },
    {
        id: 'platform', label: 'إدارة المنصة',
        activeCls: 'bg-violet-600 text-white shadow-lg shadow-violet-600/20',
        sectionCls: 'text-violet-300',
        items: [
            { tabId: 'platform_overview', icon: ShieldCheck, label: 'لوحة المنصة' },
        ],
    },
    {
        id: 'settings', label: 'الإعدادات',
        activeCls: 'bg-slate-500 text-white',
        sectionCls: 'text-brand-400',
        items: [
            { tabId: 'users',        icon: UserCircle, label: 'إدارة الفريق' },
            { tabId: 'activity_log', icon: ScrollText, label: 'سجل النشاط' },
            { tabId: 'security',     icon: ShieldCheck,label: 'الأمان والبريد' },
            { tabId: 'subscription', icon: Zap,        label: 'الاشتراك والباقة' },
            { tabId: 'daftra_link',  icon: Link2,      label: 'ربط دفترة' },
        ],
    },
];

// ─── القائمة الجانبية ─────────────────────────────────────────────────────────
function TechSidebar({ activeTab, setActiveTab, dbUser, onLogout, isOpen, onClose }) {
    const { branding } = useContext(AppContext);
    const [openGroups, setOpenGroups] = useState({ sw: true });

    const go = (tabId) => { setActiveTab(tabId); onClose?.(); };

    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 bg-brand-950/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
            )}
            <aside className={`fixed lg:static inset-y-0 right-0 z-50 w-72 shrink-0 bg-brand-800 dark:bg-brand-950 text-brand-50 flex flex-col shadow-2xl border-l border-white/5 dark:border-brand-800 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>

                {/* الشعار */}
                <div className="h-20 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shrink-0">ت</div>
                        <div className="min-w-0">
                            <div className="text-sm font-black text-white leading-tight">سماك التقنية</div>
                            <div className="text-[10px] font-bold text-indigo-300 leading-tight">لوحة الإدارة</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="lg:hidden text-brand-200 hover:text-white p-1" aria-label="إغلاق">
                        <X size={22} />
                    </button>
                </div>

                {/* التنقّل */}
                <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
                    {NAV_GROUPS.map(group => {
                        const groupActive = group.items.some(i => i.tabId === activeTab);
                        const open = openGroups[group.id] !== undefined ? openGroups[group.id] : groupActive;
                        return (
                            <div key={group.id} className="pt-1.5">
                                <button
                                    onClick={() => setOpenGroups(g => ({ ...g, [group.id]: !open }))}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-black tracking-wide transition-colors ${groupActive ? group.sectionCls : 'text-brand-300 hover:text-brand-100'}`}
                                >
                                    <span className="flex-1 text-right truncate">{group.label}</span>
                                    <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                                </button>
                                {open && (
                                    <div className="mt-0.5 space-y-0.5 pr-2.5">
                                        {group.items.map(item => {
                                            const Icon = item.icon;
                                            const isActive = item.tabId === activeTab;
                                            return (
                                                <button
                                                    key={item.tabId}
                                                    onClick={() => go(item.tabId)}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all ${isActive ? group.activeCls : 'text-brand-200 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <Icon size={15} className="shrink-0 opacity-90" />
                                                    <span className="flex-1 text-right truncate">{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* رابط العقارية */}
                <div className="px-3 pb-2 shrink-0">
                    <a
                        href="/admin/dashboard"
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-brand-300 hover:bg-white/10 hover:text-white transition border border-white/10 hover:border-white/20"
                    >
                        <Building size={16} className="shrink-0" />
                        <span className="flex-1 text-right">سماك العقارية</span>
                        <ExternalLink size={13} className="opacity-50 shrink-0" />
                    </a>
                </div>

                {/* المستخدم + خروج */}
                <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="w-9 h-9 bg-indigo-500/15 text-indigo-300 rounded-full flex items-center justify-center shrink-0">
                            <UserCircle size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white leading-tight truncate">{dbUser?.name}</p>
                            <p className="text-[10px] font-bold text-brand-300">{dbUser?.role === 'admin' ? 'مدير النظام' : (dbUser?.job || 'موظف')}</p>
                        </div>
                    </div>
                    {branding?.plan && (
                        <button
                            onClick={() => go('subscription')}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold bg-white/5 text-brand-300 hover:bg-white/10 transition"
                        >
                            <div className="flex items-center gap-1.5">
                                <Zap size={11} className="shrink-0" />
                                <span>
                                    {branding.plan === 'trial'      ? 'تجربة مجانية' :
                                     branding.plan === 'starter'    ? 'المبتدئ' :
                                     branding.plan === 'pro'        ? 'الاحترافي' : 'المؤسسي'}
                                </span>
                            </div>
                            {branding.plan === 'trial' && (branding.days_left ?? null) !== null && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-brand-400">
                                    {branding.days_left} يوم
                                </span>
                            )}
                        </button>
                    )}
                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all text-sm">
                        <LogOut size={16} /> تسجيل الخروج
                    </button>
                </div>
            </aside>
        </>
    );
}

// ─── عناوين التبويبات ────────────────────────────────────────────────────────
const TAB_LABELS = {
    sw_overview: 'لوحة التقنية',      sw_clients: 'عملاء التقنية',
    sw_tickets: 'تذاكر الدعم',         sw_products: 'المنتجات',
    sw_invoices: 'فواتير البوابة',
    ledger: 'الدفترة المستقلة',        parties: 'كشوف الأطراف',
    accounting: 'دفتر المحاسبة',       notes: 'الإشعارات والمرتجعات',
    invoices: 'الفواتير',              quotations: 'عروض الأسعار',
    purchases: 'فواتير الشراء',        expenses: 'المصروفات',
    payments: 'المدفوعات والتحصيل',    cheques: 'الشيكات',
    treasury: 'الخزاين',               reports: 'التقارير المالية',
    finance: 'الإيرادات والمصروفات',   daftra_explorer: 'مستكشف دفترة',
    clients: 'إدارة العملاء',          suppliers: 'إدارة الموردين',
    products: 'المنتجات والخدمات',     platform_overview: 'لوحة المنصة',
    users: 'إدارة الفريق',             activity_log: 'سجل النشاط',
    security: 'الأمان والبريد',         subscription: 'الاشتراك والباقة',
    daftra_link: 'ربط دفترة',          work_cycles: 'أوامر ومراحل العمل',
    rentals: 'الإيجارات والعقود',
};

// ─── اللوحة الداخلية ─────────────────────────────────────────────────────────
function TechInner() {
    const { branding } = useContext(AppContext);
    const navigate = useNavigate();
    const params   = useParams();
    const splat    = params['*'] || '';
    const [seg0, seg1] = splat.split('/');
    const activeTab = seg0 || 'sw_overview';
    const detailId  = seg1 || null;

    const setActiveTab = (tab) => {
        navigate(!tab || tab === 'sw_overview' ? '/tech' : `/tech/${tab}`);
    };

    const toast = useToast();
    const showToast = (titleOrType, msg) => {
        const isErr = /خطأ|فشل|تنبيه|error|fail/i.test(String(titleOrType || ''));
        toast[isErr ? 'error' : 'success'](msg ?? titleOrType);
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [dbUser,        setDbUser]        = useState(null);
    const [authLoading,   setAuthLoading]   = useState(true);

    const plan = branding?.plan || 'trial';

    useEffect(() => {
        document.title = 'سماك التقنية | لوحة الإدارة';
    }, []);

    useEffect(() => {
        const verify = async () => {
            const local = JSON.parse(localStorage.getItem('semak_current_user') || 'null');
            if (!local?.id) { window.location.replace('/login'); return; }
            try {
                const resp = await apiGet('get_current_user', { id: local.id });
                if (resp?.success && resp.user) {
                    setDbUser(resp.user);
                    localStorage.setItem('semak_current_user', JSON.stringify(resp.user));
                } else window.location.replace('/login');
            } catch { window.location.replace('/login'); }
            finally  { setAuthLoading(false); }
        };
        verify();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('semak_admin_email');
        localStorage.removeItem('semak_current_user');
        window.location.replace('/login');
    };

    const hasPermission = useCallback((key) => {
        if (!dbUser) return false;
        if (dbUser.role === 'admin' || key === 'all') return true;
        try { return JSON.parse(dbUser.permissions || '[]').includes(key); }
        catch { return false; }
    }, [dbUser]);

    if (authLoading) return (
        <div className="flex h-screen items-center justify-center bg-brand-950 flex-col gap-5 font-cairo">
            <Loader2 className="animate-spin text-indigo-400" size={48} />
            <p className="text-xl font-bold text-brand-100">جاري التحقق من الهوية...</p>
        </div>
    );
    if (!dbUser) return null;

    const mustChangePw = parseInt(dbUser.must_change_password ?? 0, 10) === 1;
    const adminJwt = (() => { try { return localStorage.getItem('semak_admin_jwt'); } catch { return null; } })();
    const isHome = activeTab === 'sw_overview';

    return (
        <div className="flex h-screen bg-brand-50/40 dark:bg-brand-950 font-cairo overflow-hidden" dir="rtl">
            {mustChangePw && (
                <ForcePasswordChangeModal
                    userId={dbUser.id}
                    jwt={adminJwt}
                    onDone={() => setDbUser(u => ({ ...u, must_change_password: 0 }))}
                />
            )}

            <TechSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                dbUser={dbUser}
                onLogout={handleLogout}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

                {/* ─── هيدر ──────────────────────────────────────────────────── */}
                <header className="h-20 bg-white/90 dark:bg-brand-900/90 backdrop-blur border-b border-brand-100/70 dark:border-brand-700 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-brand-700 dark:text-brand-200 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 -mr-2 transition" aria-label="القائمة">
                            <Menu size={24} />
                        </button>
                        <button onClick={() => setActiveTab('sw_overview')} className="flex items-center gap-3 hover:opacity-80 transition">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl">ت</div>
                            <div className="hidden sm:block border-r border-brand-100 dark:border-brand-700 pr-3 text-right">
                                <div className="text-[11px] font-bold text-slate-500 dark:text-brand-300">سماك التقنية</div>
                                <div className="text-sm font-black text-brand-800 dark:text-brand-50">{TAB_LABELS[activeTab] || 'لوحة التحكم'}</div>
                            </div>
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <div className="flex items-center gap-2 border-l border-brand-100 dark:border-brand-700 pl-3 md:pl-4">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 rounded-full flex items-center justify-center">
                                <UserCircle size={22} />
                            </div>
                            <div className="hidden md:block text-right">
                                <p className="text-sm font-black text-brand-800 dark:text-brand-50 leading-tight">{dbUser.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-brand-400">{dbUser.role === 'admin' ? 'مدير النظام' : dbUser.job || 'موظف'}</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white px-3 md:px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 text-sm">
                            <LogOut size={16} /><span className="hidden md:inline">خروج</span>
                        </button>
                    </div>
                </header>

                {/* شريط الاشتراك */}
                <TrialBanner plan={branding?.plan} daysLeft={branding?.days_left} status={branding?.status} />

                <main className="flex-1 overflow-y-auto bg-transparent custom-scrollbar">

                    {/* شريط التنقل */}
                    {!isHome && (
                        <div className="sticky top-0 z-20 bg-white/95 dark:bg-brand-900/95 backdrop-blur px-4 md:px-8 py-3 border-b border-brand-100/70 dark:border-brand-700 flex items-center justify-between gap-3">
                            <button
                                onClick={() => setActiveTab('sw_overview')}
                                className="flex items-center gap-2 text-sm font-bold transition border px-3 md:px-4 py-2 rounded-xl text-indigo-700 dark:text-indigo-300 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-400"
                            >
                                <ArrowLeft size={16} />
                                <span className="hidden sm:inline">الرئيسية</span>
                                <span className="sm:hidden">رجوع</span>
                            </button>
                            <h2 className="text-sm md:text-base font-black text-brand-800 dark:text-brand-50 truncate">{TAB_LABELS[activeTab]}</h2>
                        </div>
                    )}

                    {/* ════ محتوى التبويبات ════ */}
                    <ErrorBoundary key={activeTab}>
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-24">
                            <Loader2 size={32} className="animate-spin text-indigo-400" />
                        </div>
                    }>

                    {/* ── بوابة التقنية ──────────────────────────────────────── */}
                    {activeTab === 'sw_overview' && <SwOverview onNavigate={setActiveTab} />}
                    {activeTab === 'sw_clients'  && <SwClients  showToast={showToast} />}
                    {activeTab === 'sw_tickets'  && <SwTickets  showToast={showToast} />}
                    {activeTab === 'sw_products' && <SwProducts showToast={showToast} />}
                    {activeTab === 'sw_invoices' && <SwInvoices showToast={showToast} />}

                    {/* ── محاسبة ─────────────────────────────────────────────── */}
                    {activeTab === 'ledger'     && hasPermission('finance') && <div className="animate-fadeIn"><LedgerHub /></div>}
                    {activeTab === 'parties'    && hasPermission('finance') && <PartyDetail partyId={detailId} setActiveTab={setActiveTab} />}
                    {activeTab === 'accounting' && hasPermission('finance') && <div className="animate-fadeIn"><AccountingHub /></div>}
                    {activeTab === 'notes'      && hasPermission('finance') && <div className="animate-fadeIn"><NotesReturns /></div>}
                    {activeTab === 'invoices'   && hasPermission('finance') && <div className="animate-fadeIn"><InvoicesManage /></div>}
                    {activeTab === 'quotations' && hasPermission('finance') && <div className="animate-fadeIn"><QuotationsManage /></div>}
                    {activeTab === 'purchases'  && hasPermission('finance') && <div className="animate-fadeIn"><PurchasesManage /></div>}
                    {activeTab === 'expenses'   && hasPermission('finance') && <div className="animate-fadeIn"><ExpensesManage /></div>}
                    {activeTab === 'payments'   && hasPermission('finance') && <div className="animate-fadeIn"><PaymentsManage /></div>}
                    {activeTab === 'cheques'    && hasPermission('finance') && <div className="animate-fadeIn"><ChequesManage /></div>}
                    {activeTab === 'treasury'   && hasPermission('finance') && <div className="animate-fadeIn"><TreasuryManage /></div>}
                    {activeTab === 'reports'    && hasPermission('finance') && <div className="animate-fadeIn"><ReportsHub /></div>}
                    {activeTab === 'finance'    && hasPermission('finance') && <div className="animate-fadeIn"><Finance /></div>}
                    {activeTab === 'daftra_explorer' && hasPermission('finance') && (
                        <div className="animate-fadeIn">
                            <PlanGate plan={plan} required="enterprise" featureName="مستكشف دفترة" onUpgrade={() => setActiveTab('subscription')}>
                                <DaftraExplorer />
                            </PlanGate>
                        </div>
                    )}

                    {/* ── صفحات التفاصيل ─────────────────────────────────────── */}
                    {activeTab === 'entry' && hasPermission('finance') && <EntryDetail   entryId={detailId}   setActiveTab={setActiveTab} />}
                    {activeTab === 'inv'   && hasPermission('finance') && <InvoiceDetail invoiceId={detailId} setActiveTab={setActiveTab} />}
                    {activeTab === 'acct'  && hasPermission('finance') && <AccountDetail  accountId={detailId} setActiveTab={setActiveTab} />}
                    {activeTab === 'prod'  && hasPermission('finance') && <ProductMovement productId={detailId} setActiveTab={setActiveTab} />}

                    {/* ── جهات الاتصال ────────────────────────────────────────── */}
                    {activeTab === 'clients'   && hasPermission('finance') && <div className="animate-fadeIn"><ClientsManage /></div>}
                    {activeTab === 'suppliers' && hasPermission('finance') && <div className="animate-fadeIn"><SuppliersManage /></div>}
                    {activeTab === 'products'  && hasPermission('finance') && <div className="animate-fadeIn"><ProductsManage /></div>}

                    {/* ── المنصة ──────────────────────────────────────────────── */}
                    {activeTab === 'platform_overview' && <PlatformAdmin showToast={showToast} />}

                    {/* ── الإعدادات ────────────────────────────────────────────── */}
                    {activeTab === 'users'        && hasPermission('users_manage') && <div className="animate-fadeIn p-6 md:p-8"><UsersManage showToast={showToast} /></div>}
                    {activeTab === 'activity_log' && hasPermission('activity_log') && <div className="animate-fadeIn p-6 md:p-8"><ActivityLog /></div>}
                    {activeTab === 'security'     && hasPermission('all')          && <div className="animate-fadeIn p-6 md:p-8"><SecuritySettings showToast={showToast} /></div>}
                    {activeTab === 'subscription' && hasPermission('all')          && <div className="animate-fadeIn p-6 md:p-8"><SubscriptionPage /></div>}
                    {activeTab === 'daftra_link'  && hasPermission('finance')      && (
                        <div className="animate-fadeIn">
                            <PlanGate plan={plan} required="enterprise" featureName="ربط دفترة" onUpgrade={() => setActiveTab('subscription')}>
                                <DaftraLink />
                            </PlanGate>
                        </div>
                    )}
                    {activeTab === 'work_cycles' && hasPermission('finance') && <div className="animate-fadeIn"><WorkCycles /></div>}
                    {activeTab === 'rentals'     && hasPermission('finance') && <div className="animate-fadeIn"><RentalsManage /></div>}

                    </Suspense>
                    </ErrorBoundary>

                </main>
            </div>
        </div>
    );
}

// مغلّف يوفّر نظام الإشعارات الموحّد لكامل اللوحة
export default function TechApp() {
    return (
        <ToastProvider>
            <TechInner />
        </ToastProvider>
    );
}
