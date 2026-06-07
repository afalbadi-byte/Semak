import React, { useState, useEffect, useContext } from 'react';
import { Bot, MessageSquare, Users, TrendingUp, Zap, DollarSign, Clock, RefreshCw, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

import { API_URL } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';

export default function BotSettings() {
    const { branding } = useContext(AppContext);
    const companyName = branding?.company_name || 'سماك العقارية';
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [showConversations, setShowConversations] = useState(false);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=bot_stats`);
            const data = await res.json();
            if (data.success) setStats(data.stats);
        } finally {
            setLoading(false);
        }
    };

    const loadConversations = async () => {
        try {
            const res = await fetch(`${API_URL}?action=bot_recent_conversations`);
            const data = await res.json();
            if (data.success) setConversations(data.data || []);
        } catch (e) {}
    };

    useEffect(() => { loadStats(); }, []);

    const formatNum = (n) => Number(n || 0).toLocaleString('en-US');
    const formatDate = (s) => s ? new Date(s).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

    if (loading || !stats) {
        return (
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-brand-700 p-12 text-center">
                <RefreshCw className="animate-spin inline mr-2 text-teal-600" /> جاري تحميل بيانات البوت...
            </div>
        );
    }

    const conversionRate = stats.leads_from_bot > 0
        ? ((stats.conversions_from_bot / stats.leads_from_bot) * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <Bot size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">المساعد الذكي — فهد</h1>
                            <p className="text-sm text-slate-300 mt-1">مستشار المبيعات الافتراضي ل{companyName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 rounded-xl">
                        <CheckCircle2 size={18} className="text-emerald-300" />
                        <span className="font-bold text-emerald-200 text-sm">متصل ويعمل</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6">
                    <div className="bg-white/5 backdrop-blur rounded-xl p-3 md:p-4 border border-white/10">
                        <div className="text-xs text-slate-300 mb-1">النموذج المستخدم</div>
                        <div className="font-mono font-bold text-sm md:text-base text-[#c5a059]">{stats.config.model}</div>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-3 md:p-4 border border-white/10">
                        <div className="text-xs text-slate-300 mb-1">اللغة</div>
                        <div className="font-bold text-sm md:text-base">{stats.config.language}</div>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-3 md:p-4 border border-white/10">
                        <div className="text-xs text-slate-300 mb-1">آخر تفاعل</div>
                        <div className="font-bold text-xs md:text-sm">{formatDate(stats.last_interaction)}</div>
                    </div>
                    <div className="bg-white/5 backdrop-blur rounded-xl p-3 md:p-4 border border-white/10">
                        <div className="text-xs text-slate-300 mb-1">قناة التواصل</div>
                        <div className="font-bold text-sm md:text-base">واتساب الأعمال</div>
                    </div>
                </div>
            </div>

            {/* بطاقات الإحصائيات */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                <StatCard icon={MessageSquare} label="رسائل اليوم"     value={formatNum(stats.messages_today)}     color="blue" />
                <StatCard icon={Activity}      label="هذا الأسبوع"     value={formatNum(stats.messages_week)}      color="indigo" />
                <StatCard icon={MessageSquare} label="إجمالي الرسائل"  value={formatNum(stats.messages_total)}     color="purple" />
                <StatCard icon={Users}         label="عملاء فريدون"    value={formatNum(stats.unique_customers)}   color="teal" />
                <StatCard icon={TrendingUp}    label="مهتمون من البوت" value={formatNum(stats.leads_from_bot)}     color="amber" />
                <StatCard icon={CheckCircle2}  label="مبيعات محولة"    value={formatNum(stats.conversions_from_bot)} color="emerald" />
            </div>

            {/* الكلفة والاستهلاك */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-brand-900 rounded-[1.5rem] shadow border border-slate-100 dark:border-brand-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                                <DollarSign size={20} className="text-emerald-600" />
                                الكلفة التقديرية
                            </h3>
                            <p className="text-xs text-slate-400 dark:text-brand-400 mt-1">تقدير محلي بناءً على عدد الرسائل والأحرف</p>
                        </div>
                    </div>
                    <div className="text-4xl font-black text-emerald-600 mb-3">
                        ${stats.estimated_cost_usd}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-brand-400 leading-relaxed space-y-1">
                        <div>عدد استدعاءات Claude: <span className="font-bold text-slate-700 dark:text-brand-300">{formatNum(stats.bot_calls)}</span></div>
                        <div>توكنات الإدخال (تقدير): <span className="font-bold text-slate-700 dark:text-brand-300">{formatNum(stats.estimated_input_tokens)}</span></div>
                        <div>توكنات الإخراج (تقدير): <span className="font-bold text-slate-700 dark:text-brand-300">{formatNum(stats.estimated_output_tokens)}</span></div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-brand-700">
                        <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600 hover:underline">
                            عرض الرصيد الفعلي في حساب Anthropic ←
                        </a>
                    </div>
                </div>

                <div className="bg-white dark:bg-brand-900 rounded-[1.5rem] shadow border border-slate-100 dark:border-brand-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                                <Zap size={20} className="text-amber-600" />
                                معدل التحويل
                            </h3>
                            <p className="text-xs text-slate-400 dark:text-brand-400 mt-1">نسبة المهتمين الذين تحولوا لمشترين</p>
                        </div>
                    </div>
                    <div className="text-4xl font-black text-amber-600 mb-3">
                        {conversionRate}<span className="text-2xl">%</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-brand-800 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-l from-amber-500 to-amber-400 h-full transition-all" style={{ width: `${Math.min(conversionRate, 100)}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-brand-400 mt-3">
                        {formatNum(stats.conversions_from_bot)} مبيعة من {formatNum(stats.leads_from_bot)} مهتم
                    </div>
                </div>
            </div>

            {/* إعدادات الاتصال */}
            <div className="bg-white dark:bg-brand-900 rounded-[1.5rem] shadow border border-slate-100 dark:border-brand-700 p-6">
                <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 flex items-center gap-2 mb-4">
                    <Activity size={20} className="text-teal-600" />
                    إعدادات الاتصال
                </h3>
                <div className="space-y-3 text-sm">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 p-3 bg-slate-50 dark:bg-brand-800/40 rounded-xl">
                        <span className="font-bold text-slate-600 dark:text-brand-300 md:w-40 shrink-0">عنوان الـ Webhook:</span>
                        <code className="text-xs font-mono bg-white dark:bg-brand-900 px-3 py-1 rounded border border-slate-200 dark:border-brand-700 text-slate-700 dark:text-brand-300 break-all">{stats.config.webhook}</code>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 p-3 bg-slate-50 dark:bg-brand-800/40 rounded-xl">
                        <span className="font-bold text-slate-600 dark:text-brand-300 md:w-40 shrink-0">منصة الواتساب:</span>
                        <span className="text-slate-700 dark:text-brand-300 font-bold">Mottasl / Azeer</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 p-3 bg-slate-50 dark:bg-brand-800/40 rounded-xl">
                        <span className="font-bold text-slate-600 dark:text-brand-300 md:w-40 shrink-0">المعالج بالذكاء الاصطناعي:</span>
                        <span className="text-slate-700 dark:text-brand-300 font-bold">Anthropic Claude API</span>
                    </div>
                </div>
            </div>

            {/* المحادثات الأخيرة */}
            <div className="bg-white dark:bg-brand-900 rounded-[1.5rem] shadow border border-slate-100 dark:border-brand-700 p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                        <MessageSquare size={20} className="text-blue-600" />
                        آخر المحادثات
                    </h3>
                    <button
                        onClick={() => { if (!showConversations) loadConversations(); setShowConversations(s => !s); }}
                        className="text-sm font-bold text-teal-600 hover:text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200"
                    >
                        {showConversations ? 'إخفاء' : 'عرض آخر 50 رسالة'}
                    </button>
                </div>
                {showConversations && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">لا توجد محادثات بعد.</p>
                        ) : conversations.map((c, i) => (
                            <div key={i} className={`flex gap-3 p-3 rounded-xl border ${c.role === 'user' ? 'bg-blue-50/50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/30' : 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/30'}`}>
                                <div className="text-[10px] font-bold shrink-0 text-slate-500" style={{ writingMode: 'horizontal-tb' }}>
                                    {c.role === 'user' ? '👤' : '🤖'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-bold text-slate-600 dark:text-brand-300">{c.role === 'user' ? 'العميل' : 'فهد'}</span>
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-brand-400" dir="ltr">{c.phone}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-brand-400">{formatDate(c.created_at)}</span>
                                    </div>
                                    <div className="text-sm text-slate-700 dark:text-brand-300 leading-relaxed whitespace-pre-wrap break-words">{c.message}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* زر التحديث */}
            <div className="flex justify-center">
                <button onClick={loadStats} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition shadow-lg flex items-center gap-2">
                    <RefreshCw size={16} /> تحديث البيانات
                </button>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }) {
    const colors = {
        blue:    'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        indigo:  'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
        purple:  'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        teal:    'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
        amber:   'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    };
    return (
        <div className={`rounded-2xl border p-3 md:p-4 ${colors[color]}`}>
            <Icon size={20} className="mb-2 opacity-70" />
            <div className="text-[11px] md:text-xs font-bold opacity-80">{label}</div>
            <div className="text-xl md:text-2xl font-black mt-1">{value}</div>
        </div>
    );
}
