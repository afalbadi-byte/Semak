import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, LogIn, Loader2, RefreshCw, Users, Building2, TrendingUp,
    DollarSign, AlertTriangle, CheckCircle2, XCircle, Clock, Edit2, Send,
    Package, Plus, X, ChevronDown, BarChart3, Globe, Layers
} from 'lucide-react';
import { API_URL } from '../../lib/api/client';

const SESS_KEY = 'platform_token';
const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400';
const PLAN_COLORS = { trial:'slate', starter:'blue', pro:'indigo', enterprise:'violet' };
const STATUS_COLORS = { active:'emerald', suspended:'amber', cancelled:'red' };
const planCls = (p) => `bg-${PLAN_COLORS[p]||'slate'}-100 text-${PLAN_COLORS[p]||'slate'}-700 dark:bg-${PLAN_COLORS[p]||'slate'}-500/15 dark:text-${PLAN_COLORS[p]||'slate'}-300`;
const stsCls  = (s) => `bg-${STATUS_COLORS[s]||'slate'}-100 text-${STATUS_COLORS[s]||'slate'}-700 dark:bg-${STATUS_COLORS[s]||'slate'}-500/15 dark:text-${STATUS_COLORS[s]||'slate'}-300`;
const fmt = (n) => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
const PLAN_LABELS = { trial:'تجريبي', starter:'أساسي', pro:'احترافي', enterprise:'مؤسسي' };
const STATUS_LABELS = { active:'نشط', suspended:'موقوف', cancelled:'ملغى' };

// ── Platform API helpers ──────────────────────────────────────────────────────
const platApi = (tok, action, body) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` };
    if (body) return fetch(`${API_URL}?action=${action}`, { method:'POST', headers, body: JSON.stringify(body) }).then(r=>r.json());
    return fetch(`${API_URL}?action=${action}`, { headers }).then(r=>r.json());
};

// ═══════════════════════════════════════════════════════════════════════════════
// شاشة تسجيل دخول المنصة
// ═══════════════════════════════════════════════════════════════════════════════
function PlatformLogin({ onLogin, showToast }) {
    const [form, setForm] = useState({ email:'', password:'' });
    const [loading, setLoading] = useState(false);

    const login = async () => {
        if (!form.email || !form.password) return;
        setLoading(true);
        try {
            const d = await fetch(`${API_URL}?action=platform_login`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify(form)
            }).then(r=>r.json());
            if (d.success && d.token) { onLogin(d.token); }
            else showToast('خطأ', d.message || 'بيانات خاطئة');
        } catch { showToast('خطأ', 'تعذّر الاتصال بالخادم'); }
        finally { setLoading(false); }
    };

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
            <div className="w-full max-w-sm bg-white dark:bg-brand-900 rounded-3xl border border-brand-100/70 dark:border-brand-700 shadow-2xl p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={32} className="text-violet-500" />
                    </div>
                    <h2 className="text-xl font-black text-brand-800 dark:text-brand-50">لوحة المنصة</h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">الوصول مقيّد لمدير المنصة</p>
                </div>
                <div className="space-y-4">
                    <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                        placeholder="البريد الإلكتروني" className={inp} dir="ltr"
                        onKeyDown={e=>e.key==='Enter'&&login()} />
                    <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                        placeholder="كلمة المرور" className={inp} dir="ltr"
                        onKeyDown={e=>e.key==='Enter'&&login()} />
                    <button onClick={login} disabled={loading}
                        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black transition text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} دخول المنصة
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// بطاقة إحصائية
// ═══════════════════════════════════════════════════════════════════════════════
function StatCard({ label, value, icon: Icon, color = 'violet', sub }) {
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={`text-${color}-500`} />
                <span className="text-[11px] font-bold text-slate-500 dark:text-brand-400">{label}</span>
            </div>
            <p className={`text-2xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// نافذة تعديل المستأجر
// ═══════════════════════════════════════════════════════════════════════════════
function TenantEditModal({ tenant, plans, tok, onClose, onSave, showToast }) {
    const [form, setForm] = useState({
        id: tenant.id,
        status: tenant.status || 'active',
        plan_code: tenant.plan || 'trial',
        max_users: tenant.max_users || 5,
        notes: tenant.notes || '',
        trial_ends: tenant.trial_ends || '',
    });
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        // 1) تحديث بيانات المستأجر
        const d1 = await platApi(tok, 'platform_tenant_update', {
            id: form.id, status: form.status, max_users: form.max_users,
            notes: form.notes, trial_ends: form.trial_ends,
        });
        // 2) تحديث الخطة
        const d2 = await platApi(tok, 'platform_subscription_update', {
            tenant_id: form.id, plan_code: form.plan_code,
        });
        if (d1.success && d2.success) { showToast('تم الحفظ'); onSave(); onClose(); }
        else showToast('خطأ', d1.message || d2.message || 'فشل الحفظ');
        setSaving(false);
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md border border-brand-100/70 dark:border-brand-700" onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">{tenant.name}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">الخطة</label>
                            <select value={form.plan_code} onChange={e=>set('plan_code',e.target.value)} className={inp}>
                                {plans.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
                                {/* fallback إن لم تُحمَّل */}
                                {plans.length===0&&['trial','starter','pro','enterprise'].map(c=><option key={c} value={c}>{PLAN_LABELS[c]||c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                            <select value={form.status} onChange={e=>set('status',e.target.value)} className={inp}>
                                <option value="active">نشط</option>
                                <option value="suspended">موقوف</option>
                                <option value="cancelled">ملغى</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">حد الموظفين</label>
                            <input type="number" value={form.max_users} onChange={e=>set('max_users',+e.target.value)} min={1} className={inp} dir="ltr" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">انتهاء التجربة</label>
                            <input type="date" value={form.trial_ends} onChange={e=>set('trial_ends',e.target.value)} className={inp} dir="ltr" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات</label>
                        <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="ملاحظات داخلية..." />
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm">إلغاء</button>
                    <button onClick={save} disabled={saving}
                        className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-60">
                        {saving&&<Loader2 size={14} className="animate-spin"/>} حفظ
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// اللوحة الرئيسية
// ═══════════════════════════════════════════════════════════════════════════════
export default function PlatformAdmin({ showToast }) {
    const [tok, setTok] = useState(() => sessionStorage.getItem(SESS_KEY) || '');

    if (!tok) {
        return <PlatformLogin showToast={showToast} onLogin={t => { setTok(t); sessionStorage.setItem(SESS_KEY, t); }} />;
    }

    return <PlatformDashboard tok={tok} showToast={showToast} onLogout={() => { sessionStorage.removeItem(SESS_KEY); setTok(''); }} />;
}

function PlatformDashboard({ tok, showToast, onLogout }) {
    const [tab, setTab] = useState('tenants'); // tenants | plans | stats
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editTenant, setEditTenant] = useState(null);
    const [sendingInvite, setSendingInvite] = useState(null);
    const [q, setQ] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sd, td, pd] = await Promise.all([
                platApi(tok, 'platform_stats'),
                platApi(tok, 'platform_tenant_list'),
                platApi(tok, 'platform_plan_list'),
            ]);
            if (sd.success) setStats(sd.stats);
            else if (sd.message === 'غير مصرح') { onLogout(); return; }
            if (td.success) setTenants(td.tenants || []);
            if (pd.success) setPlans(pd.plans || []);
        } catch { showToast('خطأ', 'تعذّر التحميل'); }
        finally { setLoading(false); }
    }, [tok]);

    useEffect(() => { load(); }, [load]);

    const sendInvite = async (id) => {
        setSendingInvite(id);
        const d = await platApi(tok, 'platform_resend_invite', { id });
        showToast(d.success ? 'تم الإرسال' : 'خطأ', d.message);
        setSendingInvite(null);
    };

    const filtered = tenants.filter(t =>
        !q || [t.name, t.slug, t.owner_email, t.owner_name].some(v => v?.toLowerCase().includes(q.toLowerCase()))
    );

    const TABS = [
        { id:'tenants', label:'المستأجرون', icon:Building2 },
        { id:'plans',   label:'الخطط',      icon:Layers },
        { id:'stats',   label:'إحصائيات',   icon:BarChart3 },
    ];

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2">
                        <ShieldCheck size={22} className="text-violet-500" /> لوحة المنصة
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">سماك SaaS — إدارة المستأجرين والخطط</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="p-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-slate-500 hover:text-violet-600 transition">
                        <RefreshCw size={15} />
                    </button>
                    <button onClick={onLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 font-bold text-sm hover:bg-red-50 hover:text-red-600 transition">
                        <LogIn size={14} className="rotate-180" /> خروج
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-brand-100/60 dark:bg-brand-800 rounded-xl p-1 w-fit">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${tab === id ? 'bg-white dark:bg-brand-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100'}`}>
                        <Icon size={14} />{label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-400" size={32} /></div>
            ) : (
                <>
                    {/* ── إحصائيات سريعة دائمة ── */}
                    {stats && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <StatCard label="إجمالي المستأجرين" value={stats.total}         icon={Building2}  color="violet" />
                            <StatCard label="نشطون"            value={stats.active}         icon={CheckCircle2} color="emerald" />
                            <StatCard label="تجريبي"           value={stats.trial}          icon={Clock}      color="blue" />
                            <StatCard label="مدفوعون"          value={stats.paid}           icon={DollarSign} color="amber" />
                            <StatCard label="تجارب منتهية"    value={stats.expiredTrials}  icon={AlertTriangle} color="red" />
                            <StatCard label="MRR تقديري"       value={`${fmt(stats.mrr)} ﷼`} icon={TrendingUp} color="violet" />
                        </div>
                    )}

                    {/* ── تبويب المستأجرين ── */}
                    {tab === 'tenants' && (
                        <div className="space-y-4">
                            <input value={q} onChange={e=>setQ(e.target.value)}
                                placeholder="بحث بالاسم أو البريد أو الـ slug..."
                                className={`${inp} max-w-sm`} />
                            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                                {['المستأجر','الخطة','الحالة','موظفون','فواتير','المالك','إجراء'].map(h=>(
                                                    <th key={h} className="text-right px-4 py-3 font-black text-[11px] text-slate-500 dark:text-brand-400 uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-100/70 dark:divide-brand-700">
                                            {filtered.map(t => (
                                                <tr key={t.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-800/30 transition">
                                                    <td className="px-4 py-3">
                                                        <p className="font-black text-brand-800 dark:text-brand-100 text-[13px]">{t.name}</p>
                                                        <p className="text-[11px] text-slate-400 font-mono">{t.slug}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${planCls(t.plan)}`}>
                                                            {t.plan_name || PLAN_LABELS[t.plan] || t.plan}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stsCls(t.status)}`}>
                                                            {STATUS_LABELS[t.status] || t.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">
                                                        {t.user_count} / {t.max_users || t.plan_max_users || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">{t.invoice_count}</td>
                                                    <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-brand-400">
                                                        <p>{t.owner_name}</p>
                                                        <p className="font-mono text-[10px]">{t.owner_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => setEditTenant(t)}
                                                                className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition">
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button onClick={() => sendInvite(t.id)} disabled={sendingInvite === t.id}
                                                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 transition">
                                                                {sendingInvite === t.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── تبويب الخطط ── */}
                    {tab === 'plans' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {plans.map(p => (
                                <div key={p.id} className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${planCls(p.code)}`}>{p.code}</span>
                                        {!p.is_active && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">معطّل</span>}
                                    </div>
                                    <h3 className="font-black text-brand-800 dark:text-brand-50 text-lg mb-1">{p.name}</h3>
                                    <div className="space-y-1.5 text-[12px] text-slate-500 dark:text-brand-400">
                                        <div className="flex justify-between">
                                            <span>شهري</span>
                                            <span className="font-bold">{p.price_monthly > 0 ? `${fmt(p.price_monthly)} ﷼` : 'مجاني'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>سنوي</span>
                                            <span className="font-bold">{p.price_yearly > 0 ? `${fmt(p.price_yearly)} ﷼` : 'مجاني'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>حد الموظفين</span>
                                            <span className="font-bold">{p.max_users >= 999 ? 'غير محدود' : p.max_users}</span>
                                        </div>
                                    </div>
                                    {p.feature_flags && (() => {
                                        try {
                                            const fl = typeof p.feature_flags === 'string' ? JSON.parse(p.feature_flags) : p.feature_flags;
                                            return (
                                                <div className="mt-3 pt-3 border-t border-brand-100/70 dark:border-brand-700 flex flex-wrap gap-1">
                                                    {Object.entries(fl).filter(([,v])=>v===true).map(([k])=>(
                                                        <span key={k} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{k}</span>
                                                    ))}
                                                </div>
                                            );
                                        } catch { return null; }
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── تبويب الإحصائيات التفصيلية ── */}
                    {tab === 'stats' && stats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-5 shadow-sm">
                                <h3 className="font-black text-brand-800 dark:text-brand-50 mb-4 text-sm">توزيع المستأجرين</h3>
                                <div className="space-y-3">
                                    {[['نشطون',stats.active,'emerald'],['موقوفون',stats.suspended,'amber'],['ملغون',stats.cancelled,'red']].map(([l,v,c])=>(
                                        <div key={l} className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600 dark:text-brand-300">{l}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 rounded-full bg-brand-100 dark:bg-brand-700 w-24 overflow-hidden">
                                                    <div className={`h-full bg-${c}-500 rounded-full`} style={{width:`${stats.total>0?(v/stats.total)*100:0}%`}} />
                                                </div>
                                                <span className={`font-black text-${c}-600 dark:text-${c}-400 text-sm w-6 text-right`}>{v}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 p-5 shadow-sm">
                                <h3 className="font-black text-brand-800 dark:text-brand-50 mb-4 text-sm">أرقام المنصة</h3>
                                <div className="space-y-3">
                                    {[
                                        ['إجمالي الموظفين', stats.users, Users],
                                        ['إجمالي الفواتير', stats.invs, DollarSign],
                                        ['جدد هذا الشهر', stats.newMonth, TrendingUp],
                                        ['تجارب منتهية', stats.expiredTrials, AlertTriangle],
                                    ].map(([l,v,Icon])=>(
                                        <div key={l} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-brand-300">
                                                <Icon size={13} className="text-violet-400" />{l}
                                            </div>
                                            <span className="font-black text-brand-800 dark:text-brand-100">{fmt(v)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal تعديل المستأجر */}
            {editTenant && (
                <TenantEditModal
                    tenant={editTenant} plans={plans} tok={tok}
                    onClose={() => setEditTenant(null)}
                    onSave={() => { load(); setEditTenant(null); }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
