import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import {
    BookOpen, FileText, Layers, Plus, Trash2, RefreshCw, Save, X, Search,
    Scale, TrendingUp, Wallet, Users, Edit2, RotateCcw, Eye, Download, Copy,
    AlertTriangle, AlertCircle, CheckCircle2, PieChart, FileBarChart2, Banknote, ChevronDown,
    Settings, Printer, Building2, Loader2, Package, Calendar, Lock, Unlock,
    ChevronRight, ChevronUp, Activity, ArrowRightLeft, Shield, MessageCircle,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  محرّك المحاسبة المستقل (Semak Ledger) — قيد مزدوج كامل، صفر دفترة
//  كل البيانات من قاعدتنا عبر إجراءات gl_* في api.php
// ════════════════════════════════════════════════════════════════════════════

import { API_URL } from '../../lib/api/client';
import EntityLink from '../../components/ui/EntityLink';
import { useToast, formatMoney } from '../../components/ui';
const TENANT = 1;

const TYPE_LABELS = {
    asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
    revenue: 'إيرادات', expense: 'مصروفات',
};
const TYPE_COLORS = {
    asset: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    liability: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    equity: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
    revenue: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    expense: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
};

// ─── أدوات مساعدة ────────────────────────────────────────────────────────────
const money = formatMoney; // مشترك من Money.jsx — تنسيق موحّد
const todayISO   = () => new Date().toISOString().slice(0, 10);
const yearStart  = () => new Date().getFullYear() + '-01-01';
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const prevMonth  = () => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0');
    const last = new Date(y, d.getMonth()+1, 0).getDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
};

// فتح نافذة طباعة نظيفة بمحتوى HTML
const printHtml = (title, bodyHtml) => {
    const w = window.open('', '_blank', 'width=840,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<style>*{box-sizing:border-box}body{font-family:'Cairo','Segoe UI',Arial,sans-serif;color:#1a365d;margin:0;padding:28px;font-size:13px}
h1{font-size:18px;font-weight:800;margin:0 0 4px}h2{font-size:13px;font-weight:600;color:#64748b;margin:0 0 20px}
table{width:100%;border-collapse:collapse}th,td{padding:7px 10px}
thead th{background:#1a365d;color:#fff;font-weight:700;text-align:right}
tr:nth-child(even){background:#f8fafc}
.section-header td{background:#f1f5f9;font-weight:700;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.5px}
.total-row td{border-top:2px solid #c5a059;font-weight:800;font-size:14px}
.net-row td{background:#1a365d;color:#fff;font-weight:900;font-size:15px}
.amount{text-align:left;font-family:monospace;dir:ltr}
@media print{@page{size:A4;margin:15mm}}</style>
</head><body>${bodyHtml}<script>setTimeout(()=>{try{print();}catch(e){}},250)</script></body></html>`);
    w.document.close();
};

async function api(action, { method = 'GET', params = {}, body = null } = {}) {
    const qs = new URLSearchParams({ action, tenant: TENANT, ...params }).toString();
    const opts = { method };
    if (body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify({ action, tenant_id: TENANT, ...body });
    }
    const res = await fetch(`${API_URL}?${qs}`, opts);
    let json;
    try { json = await res.json(); }
    catch { throw new Error(`HTTP ${res.status}: استجابة غير صالحة`); }
    return json;
}

function downloadCSV(filename, headers, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}


// ─── عناصر واجهة عامة ────────────────────────────────────────────────────────
function Spinner({ label = 'جاري التحميل…' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-brand-800 dark:text-brand-300">
            <RefreshCw size={32} className="animate-spin mb-3 opacity-60" />
            <p className="text-sm font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400">{label}</p>
        </div>
    );
}
function Empty({ msg = 'لا توجد بيانات' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-brand-500 dark:text-brand-400">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-base font-bold">{msg}</p>
        </div>
    );
}
function Btn({ children, onClick, color = 'navy', size = 'md', type = 'button', disabled }) {
    const colors = {
        navy: 'bg-brand-800 hover:bg-brand-900 text-white',
        gold: 'bg-gold-500 hover:bg-[#b08c45] text-white',
        gray: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-brand-300 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-brand-100',
        red: 'bg-red-50 hover:bg-red-600 hover:text-white text-red-600 dark:bg-rose-500/10 dark:text-rose-300',
        green: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    };
    const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-xl font-bold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]} ${sizes[size]}`}>
            {children}
        </button>
    );
}
function PeriodBar({ from, to, setFrom, setTo, onApply, showFrom = true }) {
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            {showFrom && (
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400 block mb-1">من تاريخ</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 dark:text-brand-400 block mb-1">{showFrom ? 'إلى تاريخ' : 'حتى تاريخ'}</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] w-44 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
            </div>
            <Btn color="gold" onClick={onApply}><Search size={14} /> تطبيق</Btn>
        </div>
    );
}
function Card({ children, className = '' }) {
    return <div className={`bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow overflow-hidden ${className}`}>{children}</div>;
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 0: لوحة القيادة — مؤشرات مالية رئيسية
// ════════════════════════════════════════════════════════════════════════════
const AR_MONTHS_SHORT = ['ين','فب','مار','أبر','ماي','يون','يول','أغس','سبت','أكت','نوف','ديس'];

function MonthlySparkChart({ months, onClick }) {
    if (!months?.length) return null;
    const maxVal = Math.max(...months.map(m => Math.max(Number(m.revenue||0), Number(m.expenses||0))), 1);
    const curMo  = todayISO().slice(0, 7);
    return (
        <div className="flex items-end gap-0.5 h-20 cursor-pointer" onClick={onClick}>
            {months.map((m, i) => {
                const rev  = Number(m.revenue || 0);
                const exp  = Number(m.expenses || 0);
                const net  = Number(m.net || 0);
                const revH = Math.max(2, Math.round((rev / maxVal) * 64));
                const expH = Math.max(2, Math.round((exp / maxVal) * 64));
                const isCur = m.month === curMo;
                return (
                    <div key={i} title={`${AR_MONTHS_SHORT[i]}: إيرادات ${money(rev)} | مصروفات ${money(exp)} | صافي ${net >= 0 ? '+' : ''}${money(net)}`}
                        className={`flex-1 flex flex-col items-center gap-px transition-opacity ${isCur ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}>
                        <div className="flex items-end gap-px w-full justify-center" style={{ height: '68px' }}>
                            <div className={`flex-1 rounded-sm max-w-[5px] ${rev > 0 ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-transparent'}`}
                                style={{ height: `${revH}px` }} />
                            <div className={`flex-1 rounded-sm max-w-[5px] ${exp > 0 ? 'bg-rose-300 dark:bg-rose-500' : 'bg-transparent'}`}
                                style={{ height: `${expH}px` }} />
                        </div>
                        <span className={`text-[8px] font-bold leading-none ${isCur ? 'text-[#c5a059]' : 'text-slate-300 dark:text-brand-600'}`}>{AR_MONTHS_SHORT[i]}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── بطاقة نسبة مالية ─────────────────────────────────────────────────────────
function RatioCard({ label, value, sub, status }) {
    const map = {
        good: { bg:'bg-emerald-50 dark:bg-emerald-500/10', text:'text-emerald-700 dark:text-emerald-400', dot:'bg-emerald-500' },
        warn: { bg:'bg-amber-50 dark:bg-amber-500/10',   text:'text-amber-700 dark:text-amber-400',   dot:'bg-amber-400'   },
        bad:  { bg:'bg-rose-50 dark:bg-rose-500/10',     text:'text-rose-700 dark:text-rose-400',     dot:'bg-rose-500'    },
        n:    { bg:'bg-slate-50 dark:bg-brand-800/40',   text:'text-slate-600 dark:text-brand-300',   dot:'bg-slate-400'   },
    };
    const s = map[status] || map.n;
    return (
        <div className={`rounded-xl p-3.5 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                <span className={`text-[11px] font-black ${s.text}`}>{label}</span>
            </div>
            <div className={`text-xl font-black tabular-nums ${s.text}`}>{value}</div>
            {sub && <div className="text-[10px] font-bold text-slate-400 dark:text-brand-600 mt-1">{sub}</div>}
        </div>
    );
}

function DashboardHomeTab({ setActiveTab, toast }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthly, setMonthly] = useState(null);
    const curYear = new Date().getFullYear().toString();
    const [showRatios, setShowRatios] = useState(false);
    const [ratios,     setRatios]     = useState(null);
    const [ratLoading, setRatLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_dashboard', {}); if (r.success) setData(r); }
        catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [toast]);

    useEffect(() => { load(); }, []); // eslint-disable-line

    useEffect(() => {
        api('gl_income_monthly', { params: { year: curYear } })
            .then(r => { if (r.success) setMonthly(r.months); })
            .catch(() => {});
    }, []); // eslint-disable-line

    // تحميل النسب المالية عند الطلب فقط
    const loadRatios = useCallback(async () => {
        if (ratios || ratLoading) return;
        setRatLoading(true);
        try { const r = await api('gl_ratios', {}); if (r.success) setRatios(r.ratios); }
        catch {} finally { setRatLoading(false); }
    }, [ratios, ratLoading]);

    useEffect(() => { if (showRatios) loadRatios(); }, [showRatios]); // eslint-disable-line

    const KPI = ({ label, value, sub, color, icon: Icon, onClick }) => (
        <button onClick={onClick}
            className={`bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-5 text-right w-full transition ${onClick ? 'hover:border-[#c5a059] cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1.5">{label}</div>
                    <div className={`text-2xl font-black tabular-nums ${color}`} dir="ltr">{value}</div>
                    {sub && <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mt-1">{sub}</div>}
                </div>
                {Icon && <div className={`p-2.5 rounded-xl mt-0.5 ${color.includes('emerald')?'bg-emerald-100 dark:bg-emerald-500/15':color.includes('rose')?'bg-rose-100 dark:bg-rose-500/15':color.includes('indigo')?'bg-indigo-100 dark:bg-indigo-500/15':'bg-slate-100 dark:bg-brand-800'}`}>
                    <Icon size={20} className={color} />
                </div>}
            </div>
        </button>
    );

    if (loading) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={32} /></div>;
    if (!data)   return null;

    const net = data.net_ytd;

    return (
        <div className="space-y-5">
            {/* تنبيه الفواتير المتأخرة */}
            {data.overdue?.count > 0 && (
                <button onClick={() => setActiveTab('sales')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-right hover:border-rose-400 transition">
                    <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                        {data.overdue.count} فاتورة متأخرة بإجمالي {money(data.overdue.total)} ﷼ — انقر للمراجعة
                    </span>
                </button>
            )}
            {data.draft_count > 0 && (
                <button onClick={() => setActiveTab('journal')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-right hover:border-amber-400 transition">
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                        {data.draft_count} قيد غير مرحَّل — انقر للمراجعة
                    </span>
                </button>
            )}

            {/* مؤشرات KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI
                    label="صافي الدخل (السنة)"
                    value={money(net) + ' ﷼'}
                    sub={`هذا الشهر: ${money(data.net_month)} ﷼`}
                    color={net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
                    icon={TrendingUp}
                    onClick={() => setActiveTab('income')}
                />
                <KPI
                    label="النقدية والبنوك"
                    value={money(data.cash) + ' ﷼'}
                    sub="إجمالي الأرصدة النقدية"
                    color="text-indigo-700 dark:text-indigo-300"
                    icon={Wallet}
                    onClick={() => setActiveTab('trial')}
                />
                <KPI
                    label="ذمم العملاء"
                    value={money(data.receivables) + ' ﷼'}
                    sub="إجمالي المستحقات"
                    color={data.receivables > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-brand-400'}
                    icon={Users}
                    onClick={() => setActiveTab('parties')}
                />
                <KPI
                    label="ذمم الموردين"
                    value={money(data.payables) + ' ﷼'}
                    sub="إجمالي الالتزامات"
                    color={data.payables > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-brand-400'}
                    icon={Layers}
                    onClick={() => setActiveTab('parties')}
                />
            </div>

            {/* مخطط الأداء الشهري */}
            {monthly && (
                <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-brand-800 dark:text-brand-100">الأداء الشهري {curYear}</h4>
                        <button onClick={() => setActiveTab('income')} className="text-[12px] font-bold text-[#c5a059] hover:underline">تفاصيل</button>
                    </div>
                    <MonthlySparkChart months={monthly} onClick={() => setActiveTab('income')} />
                    <div className="flex items-center gap-4 mt-2.5">
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-[10px] font-bold text-slate-400 dark:text-brand-500">إيرادات</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-300 inline-block" /><span className="text-[10px] font-bold text-slate-400 dark:text-brand-500">مصروفات</span></div>
                    </div>
                </div>
            )}

            {/* النسب المالية — قابل للطي */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm overflow-hidden">
                <button onClick={() => setShowRatios(s => !s)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-brand-800/40 transition">
                    <div className="flex items-center gap-2.5">
                        <Scale size={16} className="text-[#c5a059]" />
                        <span className="text-sm font-black text-brand-800 dark:text-brand-100">النسب المالية</span>
                    </div>
                    {showRatios ? <ChevronUp size={15} className="text-slate-400 dark:text-brand-500" /> : <ChevronDown size={15} className="text-slate-400 dark:text-brand-500" />}
                </button>
                {showRatios && (
                    <div className="border-t border-slate-100 dark:border-brand-700 p-4">
                        {ratLoading ? (
                            <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-slate-400" size={22} /></div>
                        ) : !ratios ? null : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <RatioCard label="صافي الهامش ٪"
                                    value={ratios.net_margin !== null ? `${ratios.net_margin}%` : '—'}
                                    sub="(إيرادات − مصروفات) ÷ إيرادات"
                                    status={ratios.net_margin === null ? 'n' : ratios.net_margin > 10 ? 'good' : ratios.net_margin > 0 ? 'warn' : 'bad'} />
                                <RatioCard label="أيام التحصيل DSO"
                                    value={ratios.dso !== null ? `${ratios.dso} يوم` : '—'}
                                    sub="ذمم مدينة ÷ (إيرادات ÷ 365)"
                                    status={ratios.dso === null ? 'n' : ratios.dso < 30 ? 'good' : ratios.dso < 60 ? 'warn' : 'bad'} />
                                <RatioCard label="أيام السداد DPO"
                                    value={ratios.dpo !== null ? `${ratios.dpo} يوم` : '—'}
                                    sub="ذمم دائنة ÷ (مصروفات ÷ 365)"
                                    status={ratios.dpo === null ? 'n' : ratios.dpo < 45 ? 'good' : ratios.dpo < 90 ? 'warn' : 'bad'} />
                                <RatioCard label="نسبة الديون"
                                    value={ratios.debt_ratio !== null ? `${ratios.debt_ratio}%` : '—'}
                                    sub="إجمالي الخصوم ÷ إجمالي الأصول"
                                    status={ratios.debt_ratio === null ? 'n' : ratios.debt_ratio < 40 ? 'good' : ratios.debt_ratio < 70 ? 'warn' : 'bad'} />
                                <RatioCard label="مدين ÷ دائن"
                                    value={ratios.ar_ap_ratio !== null ? `${ratios.ar_ap_ratio}×` : '—'}
                                    sub="ذمم مدينة ÷ ذمم دائنة (> 1 جيد)"
                                    status={ratios.ar_ap_ratio === null ? 'n' : ratios.ar_ap_ratio > 1 ? 'good' : ratios.ar_ap_ratio > 0.5 ? 'warn' : 'bad'} />
                                <RatioCard label="تغطية الدائنين"
                                    value={ratios.cash_ap !== null ? `${ratios.cash_ap}×` : '—'}
                                    sub="نقدية ÷ ذمم دائنة (> 1 ممتاز)"
                                    status={ratios.cash_ap === null ? 'n' : ratios.cash_ap > 1 ? 'good' : ratios.cash_ap > 0.3 ? 'warn' : 'bad'} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* آخر القيود */}
                <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h4 className="text-sm font-black text-brand-800 dark:text-brand-100">آخر القيود</h4>
                        <button onClick={() => setActiveTab('journal')} className="text-[12px] font-bold text-[#c5a059] hover:underline">عرض الكل</button>
                    </div>
                    <Card>
                        {data.recent.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 dark:text-brand-500 font-bold">لا توجد قيود بعد</div>
                        ) : (
                            <table className="w-full text-sm">
                                <tbody>
                                    {data.recent.map(r => (
                                        <tr key={r.id} className="border-b border-slate-50 dark:border-brand-700 last:border-0 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-brand-800 dark:text-brand-100 text-[13px] truncate max-w-[200px]">{r.description || '—'}</div>
                                                <div className="text-[11px] font-mono text-slate-400 dark:text-brand-500">{r.entry_no}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-500 dark:text-brand-400 font-bold text-xs whitespace-nowrap" dir="ltr">{r.date}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums font-bold text-sm" dir="ltr">{money(r.total_dr)} ﷼</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.is_posted ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                                                    {r.is_posted ? 'مُرحَّل' : 'مسودة'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </div>

                {/* إجراءات سريعة */}
                <div>
                    <h4 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-2 px-1">إجراءات سريعة</h4>
                    <div className="space-y-2">
                        {[
                            { label: 'قيد محاسبي جديد',   icon: Plus,          tab: 'journal',    color: 'bg-brand-800 hover:bg-brand-900 text-white' },
                            { label: 'فاتورة بيع جديدة',  icon: FileText,      tab: 'sales',      color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                            { label: 'ميزان المراجعة',    icon: Scale,         tab: 'trial',      color: 'bg-white dark:bg-brand-900 hover:bg-slate-50 dark:hover:bg-brand-800 text-brand-800 dark:text-brand-100 border border-slate-200 dark:border-brand-700' },
                            { label: 'قائمة الدخل',       icon: TrendingUp,    tab: 'income',     color: 'bg-white dark:bg-brand-900 hover:bg-slate-50 dark:hover:bg-brand-800 text-brand-800 dark:text-brand-100 border border-slate-200 dark:border-brand-700' },
                            { label: 'الميزانية العمومية', icon: PieChart,     tab: 'balance',    color: 'bg-white dark:bg-brand-900 hover:bg-slate-50 dark:hover:bg-brand-800 text-brand-800 dark:text-brand-100 border border-slate-200 dark:border-brand-700' },
                            { label: 'التدفقات النقدية',  icon: Activity,      tab: 'cashflow',   color: 'bg-white dark:bg-brand-900 hover:bg-slate-50 dark:hover:bg-brand-800 text-brand-800 dark:text-brand-100 border border-slate-200 dark:border-brand-700' },
                        ].map(({ label, icon: Icon, tab, color }) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition ${color}`}>
                                <Icon size={15} /> {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 1: دليل الحسابات
// ════════════════════════════════════════════════════════════════════════════
function ChartTab({ accounts, reload, loading, toast }) {
    const [editing, setEditing] = useState(null); // {id?,code,name,type,parent_id,is_group}
    const [search, setSearch] = useState('');

    const blank = { code: '', name: '', type: 'asset', parent_id: '', is_group: 0 };
    const groups = useMemo(() => accounts.filter(a => Number(a.is_group) === 1), [accounts]);

    const save = async () => {
        if (!editing.code || !editing.name) { toast('الكود والاسم مطلوبان', 'error'); return; }
        try {
            const r = await api('gl_account_save', { method: 'POST', body: {
                id: editing.id || 0, code: editing.code.trim(), name: editing.name.trim(),
                type: editing.type, parent_id: editing.parent_id || '', is_group: editing.is_group ? 1 : 0,
            }});
            if (r.success) { toast(editing.id ? 'تم تحديث الحساب' : 'تمت إضافة الحساب'); setEditing(null); reload(); }
            else toast(r.message || 'فشل الحفظ', 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const filtered = accounts.filter(a =>
        !search || a.code.includes(search) || a.name.includes(search));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالكود أو الاسم…"
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 dark:placeholder-brand-500" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-brand-400 dark:text-brand-400">{accounts.length} حساب</span>
                    <Btn color="gray" size="sm" onClick={reload}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> حساب جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : filtered.length === 0 ? <Empty msg="لا توجد حسابات" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr>
                                    <th className="px-3 py-3 font-bold">الكود</th>
                                    <th className="px-3 py-3 font-bold">اسم الحساب</th>
                                    <th className="px-3 py-3 font-bold">النوع</th>
                                    <th className="px-3 py-3 font-bold text-left">الرصيد</th>
                                    <th className="px-3 py-3 font-bold text-center w-16">تعديل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(a => {
                                    const depth = Math.max(0, a.code.length - 1);
                                    const isGroup = Number(a.is_group) === 1;
                                    return (
                                        <tr key={a.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-mono font-bold text-brand-800 dark:text-brand-300">{a.code}</td>
                                            <td className="px-3 py-2.5" style={{ paddingRight: `${0.75 + depth * 0.6}rem` }}>
                                                {isGroup
                                                    ? <span className="font-black text-brand-800 dark:text-brand-100">{a.name}</span>
                                                    : <EntityLink to={`acct/${a.id}`} muted title="دفتر أستاذ الحساب">{a.name}</EntityLink>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">
                                                {isGroup ? '—' : money(a.balance)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button onClick={() => setEditing({ id: a.id, code: a.code, name: a.name, type: a.type, parent_id: a.parent_id || '', is_group: Number(a.is_group) })}
                                                    className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059] transition"><Edit2 size={15} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* نموذج الإضافة/التعديل */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل حساب' : 'حساب جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الكود</label>
                                    <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">اسم الحساب</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الحساب الأب (اختياري)</label>
                                <select value={editing.parent_id} onChange={e => setEditing({ ...editing, parent_id: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    <option value="">— بدون —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-brand-300 cursor-pointer">
                                <input type="checkbox" checked={!!editing.is_group} onChange={e => setEditing({ ...editing, is_group: e.target.checked ? 1 : 0 })} />
                                حساب تجميعي (مجموعة لا تُرحّل عليها قيود)
                            </label>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  AccountCombobox — حقل بحث قابل للكتابة عن الحسابات (كود أو اسم)
// ════════════════════════════════════════════════════════════════════════════
function AccountCombobox({ accounts, value, onChange, placeholder = 'ابحث بالكود أو الاسم…', className = '', inputProps = {} }) {
    const [q, setQ]         = useState('');
    const [open, setOpen]   = useState(false);
    const [cursor, setCursor] = useState(0);
    const inputRef = React.useRef(null);
    const listRef  = React.useRef(null);

    // عند تغيير القيمة خارجيًا (مثلاً عند صفّ جديد) نُعيد النص المعروض
    const selected = accounts.find(a => String(a.id) === String(value));
    const displayText = selected ? `${selected.code} · ${selected.name}` : '';

    // الأسلوب: إن كان الحقل يحتوي نفس نص الحساب المختار → لا نفلتر، لكن فتح القائمة
    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return accounts.slice(0, 50); // أول 50 عند فارغ
        return accounts.filter(a =>
            a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
        ).slice(0, 30);
    }, [q, accounts]);

    const pick = (a) => {
        onChange(String(a.id));
        setQ('');
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!open) { if (e.key !== 'Escape') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter' && filtered[cursor]) { e.preventDefault(); pick(filtered[cursor]); }
        else if (e.key === 'Escape') { setOpen(false); setQ(''); }
    };

    // مزامنة scroll الـ cursor
    React.useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[cursor];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    return (
        <div className={`relative ${className}`}>
            {/* حقل الإدخال — يعرض اسم الحساب المختار أو نص البحث */}
            <input
                ref={inputRef}
                type="text"
                value={open ? q : displayText}
                placeholder={placeholder}
                onFocus={() => { setOpen(true); setQ(''); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQ(e.target.value); setCursor(0); if (!open) setOpen(true); }}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059] placeholder-slate-300 dark:placeholder-brand-600"
                dir="rtl"
                autoComplete="off"
                {...inputProps}
            />
            {/* القائمة المنسدلة */}
            {open && filtered.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute z-50 mt-0.5 w-full max-h-56 overflow-y-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-lg text-sm"
                >
                    {filtered.map((a, idx) => (
                        <li key={a.id}
                            onMouseDown={() => pick(a)}
                            className={`px-3 py-1.5 cursor-pointer flex items-baseline gap-2 ${idx === cursor ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}
                        >
                            <span className="font-mono text-xs text-slate-400 dark:text-brand-500 shrink-0">{a.code}</span>
                            <span className="font-bold text-slate-700 dark:text-brand-200 truncate">{a.name}</span>
                            <span className={`text-[10px] mr-auto shrink-0 px-1.5 py-0.5 rounded font-bold
                                ${a.type==='asset'?'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400':
                                  a.type==='liability'?'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400':
                                  a.type==='equity'?'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400':
                                  a.type==='revenue'?'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400':
                                  'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                {a.type==='asset'?'أصول':a.type==='liability'?'خصوم':a.type==='equity'?'ملكية':a.type==='revenue'?'إيرادات':'مصروفات'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  PartyCombobox — حقل بحث للأطراف (عملاء / موردون)
// ════════════════════════════════════════════════════════════════════════════
function PartyCombobox({ parties, value, onChange, placeholder = 'ابحث باسم الطرف…', className = '', rawId = false }) {
    const [q, setQ]         = useState('');
    const [open, setOpen]   = useState(false);
    const [cursor, setCursor] = useState(0);
    const listRef  = React.useRef(null);

    // rawId=true → value is just party id; rawId=false → "type:id"
    const selected = rawId
        ? parties.find(p => String(p.id) === String(value))
        : parties.find(p => `${p.type}:${p.id}` === value);
    const displayText = selected ? `${selected.type === 'customer' ? 'عميل' : 'مورد'}: ${selected.name}` : '';

    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return parties.slice(0, 50);
        return parties.filter(p =>
            p.name.toLowerCase().includes(s) || (p.phone && p.phone.includes(s))
        ).slice(0, 30);
    }, [q, parties]);

    const pick  = (p) => { onChange(rawId ? String(p.id) : `${p.type}:${p.id}`); setQ(''); setOpen(false); };
    const clear = ()  => { onChange(''); setQ(''); setOpen(false); };

    const handleKeyDown = (e) => {
        if (!open) { if (e.key !== 'Escape') setOpen(true); return; }
        // cursor 0 = "بدون طرف", 1..n = filtered entries
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (cursor === 0) clear();
            else if (filtered[cursor - 1]) pick(filtered[cursor - 1]);
        }
        else if (e.key === 'Escape') { setOpen(false); setQ(''); }
    };

    React.useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[cursor];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    return (
        <div className={`relative ${className}`}>
            <input type="text"
                value={open ? q : displayText}
                placeholder={placeholder}
                onFocus={() => { setOpen(true); setQ(''); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQ(e.target.value); setCursor(0); if (!open) setOpen(true); }}
                onKeyDown={handleKeyDown}
                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] placeholder-slate-300 dark:placeholder-brand-600"
                dir="rtl" autoComplete="off" />
            {open && (
                <ul ref={listRef} className="absolute z-50 mt-0.5 w-full max-h-48 overflow-y-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-lg text-xs">
                    <li onMouseDown={clear}
                        className={`px-3 py-1.5 cursor-pointer italic text-slate-400 dark:text-brand-500 ${cursor === 0 ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}>
                        — بدون طرف —
                    </li>
                    {filtered.map((p, idx) => (
                        <li key={p.id} onMouseDown={() => pick(p)}
                            className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${idx + 1 === cursor ? 'bg-brand-50 dark:bg-brand-800' : 'hover:bg-slate-50 dark:hover:bg-brand-800/60'}`}>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded font-bold text-[10px]
                                ${p.type === 'customer'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                {p.type === 'customer' ? 'عميل' : 'مورد'}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-brand-200 truncate">{p.name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ─── ProductCombobox ─────────────────────────────────────────────────────────
function ProductCombobox({ products, onSelect, placeholder = 'اختر منتجاً أو خدمة…', className = '' }) {
    const [q, setQ]       = useState('');
    const [open, setOpen] = useState(false);
    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return products.slice(0, 30);
        return products.filter(p =>
            p.name.toLowerCase().includes(s) || (p.code && p.code.toLowerCase().includes(s))
        ).slice(0, 20);
    }, [q, products]);
    const pick = (p) => { onSelect(p); setQ(''); setOpen(false); };
    return (
        <div className={`relative ${className}`}>
            <input type="text" value={q} placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] placeholder-slate-300 dark:placeholder-brand-600"
                dir="rtl" autoComplete="off" />
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 mt-0.5 w-60 max-h-48 overflow-y-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-lg text-xs">
                    {filtered.map(p => (
                        <li key={p.id} onMouseDown={() => pick(p)}
                            className="px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-brand-800/60">
                            <div className="min-w-0">
                                <div className="font-bold truncate text-slate-700 dark:text-brand-200">{p.name}</div>
                                {p.code && <div className="text-[10px] text-slate-400 dark:text-brand-500 font-mono">{p.code}</div>}
                            </div>
                            <span className="shrink-0 tabular-nums font-bold text-brand-800 dark:text-brand-300" dir="ltr">{money(p.unit_price)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 2: القيود اليومية + نموذج قيد
// ════════════════════════════════════════════════════════════════════════════
const emptyLine = () => ({ account_id: '', debit: '', credit: '', party_type: '', party_id: '', due_date: '', cost_center_id: '', description: '' });

// ════════════════════════════════════════════════════════════════════════════
//  معالج الأرصدة الافتتاحية
// ════════════════════════════════════════════════════════════════════════════
function OpeningBalanceWizard({ accounts, toast, onBack }) {
    const [date,     setDate]   = useState(() => todayISO().slice(0, 4) + '-01-01');
    const [lines,    setLines]  = useState([{ account_id: '', debit: '', credit: '' }]);
    const [existing, setExist]  = useState([]);
    const [loadEx,   setLoadEx] = useState(true);
    const [saving,   setSaving] = useState(false);

    useEffect(() => {
        setLoadEx(true);
        api('gl_opening_balance_get')
            .then(r => { if (r.success) setExist(r.data || []); })
            .catch(() => {})
            .finally(() => setLoadEx(false));
    }, []);

    const setLine = (i, patch) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
    const totals = lines.reduce((a, l) => ({ d: a.d + (Number(l.debit) || 0), c: a.c + (Number(l.credit) || 0) }), { d: 0, c: 0 });
    const balanced  = Math.abs(totals.d - totals.c) < 0.005;
    const hasValues = lines.some(l => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);

    const post = async () => {
        const validLines = lines.filter(l => l.account_id && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));
        if (!validLines.length) return toast('لا توجد بنود بمبالغ صالحة', 'error');
        if (!balanced) return toast('القيد غير متوازن', 'error');
        setSaving(true);
        try {
            const r = await api('gl_opening_balance_post', { method: 'POST', body: { tenant_id: 1, date, lines: validLines } });
            if (r.success) {
                toast(r.message, 'success');
                setLines([{ account_id: '', debit: '', credit: '' }]);
                api('gl_opening_balance_get').then(r2 => { if (r2.success) setExist(r2.data || []); });
            } else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <button onClick={onBack} className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-500 dark:text-brand-400 hover:text-[#c5a059] transition">
                    <ArrowLeft size={14} /> رجوع
                </button>
                <span className="text-slate-300 dark:text-brand-700">|</span>
                <h3 className="font-black text-brand-800 dark:text-brand-100">الأرصدة الافتتاحية</h3>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-sm font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                أدخل أرصدة الحسابات عند البدء باستخدام النظام. القيد يجب أن يكون متوازناً (مجموع المدين = مجموع الدائن).
            </div>

            {/* قيود موجودة */}
            {!loadEx && existing.length > 0 && (
                <Card>
                    <h4 className="font-black text-brand-800 dark:text-brand-100 mb-3">قيود الأرصدة الافتتاحية المرحّلة</h4>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[11px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                    <th className="text-right py-2 px-3" dir="ltr">رقم القيد</th>
                                    <th className="text-right py-2 px-3">الحساب</th>
                                    <th className="text-left py-2 px-3">مدين</th>
                                    <th className="text-left py-2 px-3">دائن</th>
                                </tr>
                            </thead>
                            <tbody>
                                {existing.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-brand-700">
                                        <td className="py-2 px-3 font-mono text-xs text-slate-500 dark:text-brand-400" dir="ltr">{r.entry_no}</td>
                                        <td className="py-2 px-3 font-bold text-brand-800 dark:text-brand-100">
                                            <span className="font-mono text-[11px] text-slate-400 dark:text-brand-600 ml-2" dir="ltr">{r.acct_code}</span>{r.acct_name}
                                        </td>
                                        <td className="py-2 px-3 text-left tabular-nums text-emerald-600 dark:text-emerald-400" dir="ltr">{Number(r.debit) > 0 ? money(r.debit) : '—'}</td>
                                        <td className="py-2 px-3 text-left tabular-nums text-rose-600 dark:text-rose-400" dir="ltr">{Number(r.credit) > 0 ? money(r.credit) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* نموذج الإدخال */}
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h4 className="font-black text-brand-800 dark:text-brand-100">إدخال أرصدة جديدة</h4>
                    <div className="flex items-center gap-2">
                        <label className="text-[11px] font-bold text-slate-400 dark:text-brand-500">تاريخ البداية</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[12px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                <th className="text-right py-2 px-2">الحساب</th>
                                <th className="text-left py-2 px-2 w-28">مدين</th>
                                <th className="text-left py-2 px-2 w-28">دائن</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((l, i) => (
                                <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                    <td className="py-1.5 px-2">
                                        <AccountCombobox accounts={accounts} value={l.account_id} onChange={v => setLine(i, { account_id: v })} />
                                    </td>
                                    <td className="py-1.5 px-2">
                                        <input type="number" step="0.01" value={l.debit} onChange={e => setLine(i, { debit: e.target.value, credit: '' })}
                                            className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-emerald-400" dir="ltr" />
                                    </td>
                                    <td className="py-1.5 px-2">
                                        <input type="number" step="0.01" value={l.credit} onChange={e => setLine(i, { credit: e.target.value, debit: '' })}
                                            className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-rose-400" dir="ltr" />
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                        {lines.length > 1 && (
                                            <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                                                className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t border-slate-200 dark:border-brand-700">
                                <td className="py-2.5 px-2">الإجماليات</td>
                                <td className="py-2.5 px-2 tabular-nums" dir="ltr">{money(totals.d)}</td>
                                <td className="py-2.5 px-2 tabular-nums" dir="ltr">{money(totals.c)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Btn color="gray" size="sm" onClick={() => setLines(ls => [...ls, { account_id: '', debit: '', credit: '' }])}>
                        <Plus size={14} /> إضافة حساب
                    </Btn>
                    {hasValues && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${balanced ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                            {balanced ? '✓ متوازن' : `فرق ${money(Math.abs(totals.d - totals.c))} ﷼`}
                        </span>
                    )}
                    <div className="flex-1" />
                    <Btn color="navy" onClick={post} disabled={saving || !balanced || !hasValues}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        ترحيل الأرصدة الافتتاحية
                    </Btn>
                </div>
            </Card>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  إدارة قوالب القيود اليومية
// ════════════════════════════════════════════════════════════════════════════
function TemplatesManager({ templates, reload, accounts, costCenters, onBack, onUse, toast }) {
    const [editing, setEditing] = useState(null);
    const blank = () => ({ id: 0, name: '', description: '', lines: [emptyLine(), emptyLine()] });

    const save = async () => {
        if (!editing.name.trim()) { toast('اسم القالب مطلوب', 'error'); return; }
        const lines = editing.lines
            .filter(l => l.account_id)
            .map((l, seq) => ({ account_id: Number(l.account_id), debit: parseFloat(l.debit)||0, credit: parseFloat(l.credit)||0, description: l.description||'', cost_center_id: l.cost_center_id||null, seq }));
        try {
            const r = await api('gl_template_save', { method: 'POST', body: { id: editing.id||0, name: editing.name.trim(), description: editing.description||'', lines } });
            if (r.success) { toast(r.message); setEditing(null); reload(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const del = async (id) => {
        if (!window.confirm('حذف هذا القالب نهائياً؟')) return;
        try { const r = await api('gl_template_delete', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); reload(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    const setLine = (i, patch) => setEditing(e => ({ ...e, lines: e.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));

    if (editing) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل قالب' : 'قالب جديد'}</h3>
                    <Btn color="gray" onClick={() => setEditing(null)}><X size={15} /> رجوع</Btn>
                </div>
                <Card className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">اسم القالب <span className="text-red-500">*</span></label>
                            <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))} placeholder="مثال: قيد الرواتب الشهرية"
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظة</label>
                            <input value={editing.description} onChange={e => setEditing(ed => ({ ...ed, description: e.target.value }))} placeholder="اختياري"
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm border-collapse">
                            <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                <tr>
                                    <th className="px-2 py-2 font-bold min-w-[180px]">الحساب</th>
                                    <th className="px-2 py-2 font-bold w-28">مدين</th>
                                    <th className="px-2 py-2 font-bold w-28">دائن</th>
                                    <th className="px-2 py-2 font-bold min-w-[140px]">بيان البند</th>
                                    {costCenters.length > 0 && <th className="px-2 py-2 font-bold min-w-[120px]">مركز التكلفة</th>}
                                    <th className="px-2 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editing.lines.map((l, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                        <td className="px-2 py-1.5">
                                            <AccountCombobox accounts={accounts} value={l.account_id} onChange={v => setLine(i, { account_id: v })} />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.debit} onChange={e => setLine(i, { debit: e.target.value, credit: '' })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-emerald-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.credit} onChange={e => setLine(i, { credit: e.target.value, debit: '' })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-rose-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={l.description} onChange={e => setLine(i, { description: e.target.value })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059]" />
                                        </td>
                                        {costCenters.length > 0 && (
                                            <td className="px-2 py-1.5">
                                                <select value={l.cost_center_id} onChange={e => setLine(i, { cost_center_id: e.target.value })}
                                                    className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]">
                                                    <option value="">— مركز —</option>
                                                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </td>
                                        )}
                                        <td className="px-2 py-1.5 text-center">
                                            {editing.lines.length > 2 && (
                                                <button onClick={() => setEditing(ed => ({ ...ed, lines: ed.lines.filter((_, j) => j !== i) }))}
                                                    className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn color="gray" size="sm" onClick={() => setEditing(ed => ({ ...ed, lines: [...ed.lines, emptyLine()] }))}><Plus size={14} /> إضافة بند</Btn>
                        <div className="flex-1" />
                        <Btn color="green" onClick={save}><Save size={15} /> حفظ القالب</Btn>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-400 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-100 transition">
                        <X size={18} />
                    </button>
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">قوالب القيود ({templates.length})</h3>
                </div>
                <Btn color="green" onClick={() => setEditing(blank())}><Plus size={15} /> قالب جديد</Btn>
            </div>
            {templates.length === 0 ? (
                <Empty msg="لا توجد قوالب — أنشئ قالباً لتسريع إدخال القيود المتكررة" />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {templates.map(t => (
                        <div key={t.id} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                <Copy size={16} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-brand-800 dark:text-brand-100 truncate">{t.name}</div>
                                {t.description && <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5 truncate">{t.description}</div>}
                                <div className="text-[11px] text-slate-300 dark:text-brand-600 mt-1">{t.created_at?.slice(0,10)}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => onUse(t.id)} title="استخدام القالب"
                                    className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition">
                                    استخدام
                                </button>
                                <button onClick={() => {
                                    api('gl_template_get', { params: { id: t.id } })
                                        .then(r => { if (r.success) setEditing({ id: Number(t.id), name: r.template.name, description: r.template.description||'', lines: r.lines.map(l => ({ account_id: l.account_id||'', debit: Number(l.debit)||'', credit: Number(l.credit)||'', description: l.description||'', cost_center_id: l.cost_center_id||'' })) }); })
                                        .catch(e => toast(e.message, 'error'));
                                }} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                <button onClick={() => del(t.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  القيود المتكررة / المجدولة
// ════════════════════════════════════════════════════════════════════════════
const FREQ_LABELS = { daily:'يومي', weekly:'أسبوعي', monthly:'شهري', quarterly:'ربع سنوي', annually:'سنوي' };
const FREQ_OPTS   = ['daily','weekly','monthly','quarterly','annually'];

function RecurringManager({ templates, onBack, toast }) {
    const [items,   setItems]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy,    setBusy]    = useState(null);

    const blank = () => ({ id:0, name:'', template_id:'', frequency:'monthly', next_date: todayISO(), end_date:'' });

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_recurring_list'); if (r.success) setItems(r.data||[]); }
        catch (e) { toast(e.message,'error'); } finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب','error'); return; }
        if (!editing.template_id) { toast('اختر قالباً','error'); return; }
        try {
            const r = await api('gl_recurring_save', { method:'POST', body:{ ...editing, id:editing.id||0 }});
            if (r.success) { toast(r.message); setEditing(null); load(); } else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); }
    };

    const toggle = async (id) => {
        try { const r = await api('gl_recurring_toggle', { method:'POST', body:{ id }}); if (r.success) load(); else toast(r.message,'error'); }
        catch (e) { toast(e.message,'error'); }
    };

    const del = async (id) => {
        if (!window.confirm('حذف هذا القيد المتكرر؟')) return;
        try { const r = await api('gl_recurring_delete', { method:'POST', body:{ id }}); if (r.success) { toast(r.message); load(); } else toast(r.message,'error'); }
        catch (e) { toast(e.message,'error'); }
    };

    const run = async (id) => {
        setBusy(id);
        try {
            const r = await api('gl_recurring_run', { method:'POST', body:{ id }});
            if (r.success) { toast(`✓ ${r.message}`); load(); } else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); } finally { setBusy(null); }
    };

    const today = todayISO();
    const dueItems = items.filter(i => i.is_due);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-400 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-100"><X size={18}/></button>
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">
                        القيود المتكررة
                        {dueItems.length > 0 && <span className="mr-2 text-sm px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{dueItems.length} مستحق</span>}
                    </h3>
                </div>
                <div className="flex gap-2">
                    {dueItems.length > 0 && (
                        <Btn color="green" size="sm" disabled={busy === 'all'} onClick={async () => {
                            setBusy('all');
                            try {
                                const r = await api('gl_recurring_run_all', { method:'POST', body:{ tenant_id:1 }});
                                if (r.success || r.posted?.length > 0) {
                                    toast(`✓ ${r.message}`, 'success');
                                    if (r.errors?.length) toast(`${r.errors.length} خطأ في بعض القيود`, 'error');
                                } else toast(r.message || 'لا توجد قيود مستحقة', 'error');
                                load();
                            } catch (e) { toast(e.message,'error'); }
                            finally { setBusy(null); }
                        }}>
                            {busy === 'all' ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                            ترحيل الكل المستحق ({dueItems.length})
                        </Btn>
                    )}
                    <Btn color="green" onClick={() => setEditing(blank())}><Plus size={15}/> قيد متكرر جديد</Btn>
                </div>
            </div>

            {/* تحذير الاستحقاق */}
            {dueItems.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        يوجد {dueItems.length} قيد متكرر مستحق الترحيل — راجع القائمة واضغط «ترحيل» لكل قيد أو «ترحيل الكل».
                    </p>
                </div>
            )}

            {loading ? <Spinner /> : items.length === 0 ? <Empty msg="لا توجد قيود متكررة — أنشئ قيداً مجدولاً بناءً على قالب" /> : (
                <div className="space-y-2">
                    {items.map(it => {
                        const isDue = it.is_due == 1;
                        const isRunning = busy === it.id;
                        return (
                            <div key={it.id} className={`bg-white dark:bg-brand-900 rounded-2xl border shadow-sm p-4 flex flex-wrap items-center gap-4 transition
                                ${isDue ? 'border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-200 dark:ring-amber-500/20' : 'border-slate-100 dark:border-brand-700'}
                                ${!it.is_active ? 'opacity-60' : ''}`}>
                                {/* أيقونة */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                    ${isDue ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                            : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                    <RefreshCw size={18} className={isDue ? 'animate-pulse' : ''}/>
                                </div>
                                {/* معلومات */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-brand-800 dark:text-brand-100">{it.name}</span>
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30">
                                            {FREQ_LABELS[it.frequency]||it.frequency}
                                        </span>
                                        {isDue && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">⚡ مستحق</span>}
                                        {!it.is_active && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400">متوقف</span>}
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5 flex flex-wrap gap-3">
                                        {it.tpl_name && <span>القالب: {it.tpl_name}</span>}
                                        <span dir="ltr">التالي: {it.next_date}</span>
                                        {it.end_date && <span dir="ltr">ينتهي: {it.end_date}</span>}
                                        {it.last_entry_no && <span>آخر ترحيل: {it.last_entry_no}</span>}
                                    </div>
                                </div>
                                {/* أزرار */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {it.is_active && isDue && (
                                        <Btn color="green" size="sm" onClick={() => run(it.id)} disabled={isRunning}>
                                            {isRunning ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                                            ترحيل
                                        </Btn>
                                    )}
                                    <button onClick={() => toggle(it.id)} title={it.is_active?'إيقاف':'تفعيل'}
                                        className={`text-xs font-bold px-2 py-1 rounded-lg border transition
                                            ${it.is_active
                                                ? 'border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-amber-400 hover:text-amber-600'
                                                : 'border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'}`}>
                                        {it.is_active?'إيقاف':'تفعيل'}
                                    </button>
                                    <button onClick={() => setEditing({ id:it.id, name:it.name, template_id:it.template_id||'', frequency:it.frequency, next_date:it.next_date, end_date:it.end_date||'' })}
                                        className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15}/></button>
                                    <button onClick={() => del(it.id)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* مودال التعديل */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-black text-brand-800 dark:text-brand-100">{editing.id?'تعديل':'قيد متكرر جديد'}</h3>
                            <button onClick={()=>setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم <span className="text-red-500">*</span></label>
                                <input value={editing.name} onChange={e=>setEditing(ed=>({...ed,name:e.target.value}))} placeholder="مثال: إهلاك شهري"
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">القالب <span className="text-red-500">*</span></label>
                                <select value={editing.template_id} onChange={e=>setEditing(ed=>({...ed,template_id:e.target.value}))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    <option value="">— اختر قالباً —</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التكرار</label>
                                <select value={editing.frequency} onChange={e=>setEditing(ed=>({...ed,frequency:e.target.value}))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    {FREQ_OPTS.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ التالي</label>
                                    <input type="date" value={editing.next_date} onChange={e=>setEditing(ed=>({...ed,next_date:e.target.value}))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">تاريخ الانتهاء (اختياري)</label>
                                    <input type="date" value={editing.end_date} onChange={e=>setEditing(ed=>({...ed,end_date:e.target.value}))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <Btn color="green" onClick={save}><Save size={14}/> حفظ</Btn>
                            <Btn color="gray" onClick={()=>setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function JournalTab({ accounts, parties, costCenters, toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(null);  // null = list view
    const [viewing, setViewing] = useState(null);
    const [page, setPage]     = useState(1);
    const [total, setTotal]   = useState(0);
    const [search, setSearch] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo,   setFilterTo]   = useState('');
    const PAGE_SIZE = 30;
    const postable = useMemo(() => accounts.filter(a => Number(a.is_group) === 0), [accounts]);

    // ── القوالب ───────────────────────────────────────────────────────────
    const [listSub,     setListSub]     = useState('entries'); // 'entries'|'templates'|'recurring'|'opening'
    const [dueCount,    setDueCount]    = useState(0);

    // ── تحويل سريع ───────────────────────────────────────────────────────────
    const [showXfer,  setShowXfer]  = useState(false);
    const [xfer,      setXfer]      = useState({ from_id:'', to_id:'', amount:'', date: todayISO(), desc:'' });
    const [xferBusy,  setXferBusy]  = useState(false);
    const submitXfer = async () => {
        if (!xfer.from_id || !xfer.to_id) return toast('اختر الحساب المصدر والوجهة', 'error');
        if (xfer.from_id === xfer.to_id) return toast('الحساب المصدر والوجهة متطابقان', 'error');
        const amt = Number(xfer.amount); if (!amt || amt <= 0) return toast('المبلغ غير صالح', 'error');
        setXferBusy(true);
        try {
            const r = await api('gl_entry_create', { method: 'POST', body: {
                tenant_id: 1, date: xfer.date, description: xfer.desc || 'تحويل',
                lines: [
                    { account_id: Number(xfer.from_id), debit: amt,  credit: 0,   description: xfer.desc || 'تحويل' },
                    { account_id: Number(xfer.to_id),   debit: 0,    credit: amt, description: xfer.desc || 'تحويل' },
                ],
            }});
            if (r.success) {
                toast(`تم التحويل — قيد ${r.entry_no}`, 'success');
                setShowXfer(false); setXfer({ from_id:'', to_id:'', amount:'', date: todayISO(), desc:'' });
                load();
            } else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setXferBusy(false); }
    };
    const [templates,   setTemplates]   = useState([]);
    const [tmplPicker,  setTmplPicker]  = useState(false); // modal: pick a template to fill form
    const [tmplSaveDlg, setTmplSaveDlg] = useState(false); // modal: save form lines as template
    const [tmplSaveName,setTmplSaveName]= useState('');
    const [tmplEdit,    setTmplEdit]    = useState(null);   // template being edited in mgmt UI

    const loadTemplates = useCallback(async () => {
        try { const r = await api('gl_templates'); if (r.success) setTemplates(r.data || []); }
        catch { /* صامت */ }
    }, []);
    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    // فحص القيود المتكررة المستحقة عند التحميل
    useEffect(() => {
        api('gl_recurring_list').then(r => { if (r.success) setDueCount(r.due_count||0); }).catch(()=>{});
    }, []);

    const applyTemplate = async (tplId) => {
        try {
            const r = await api('gl_template_get', { params: { id: tplId } });
            if (!r.success) { toast(r.message, 'error'); return; }
            const lines = (r.lines || []).map(l => ({
                account_id: l.account_id || '', debit: Number(l.debit) || '', credit: Number(l.credit) || '',
                party_type: '', party_id: '', due_date: '', cost_center_id: l.cost_center_id || '',
                description: l.description || '',
            }));
            if (lines.length < 2) lines.push(emptyLine());
            setForm(f => ({ ...f, description: f?.description || r.template.name, lines }));
            setTmplPicker(false);
            toast(`تم تحميل قالب: ${r.template.name}`);
        } catch (e) { toast(e.message, 'error'); }
    };

    const saveAsTemplate = async () => {
        if (!tmplSaveName.trim()) { toast('أدخل اسم القالب', 'error'); return; }
        if (!form) return;
        const lines = form.lines
            .filter(l => l.account_id)
            .map((l, seq) => ({ account_id: Number(l.account_id), debit: parseFloat(l.debit)||0, credit: parseFloat(l.credit)||0, description: l.description||'', cost_center_id: l.cost_center_id||null, seq }));
        try {
            const r = await api('gl_template_save', { method: 'POST', body: { id: 0, name: tmplSaveName.trim(), description: '', lines } });
            if (r.success) { toast('تم حفظ القالب'); setTmplSaveDlg(false); setTmplSaveName(''); loadTemplates(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const deleteTpl = async (id) => {
        if (!window.confirm('حذف هذا القالب؟')) return;
        try { const r = await api('gl_template_delete', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); loadTemplates(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    const loadPage = useCallback(async (pg, q, fr, to) => {
        setLoading(true);
        try {
            const params = { limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE };
            if (q)  params.search = q;
            if (fr) params.from   = fr;
            if (to) params.to     = to;
            const r = await api('gl_entries', { params });
            setEntries(r.data || []);
            setTotal(r.total || 0);
        }
        catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { loadPage(page, search, filterFrom, filterTo); }, [loadPage, page]); // eslint-disable-line
    // load: يعيد للصفحة الأولى ويحدّث — يُستدعى بعد كل تعديل/حذف/إنشاء
    const load = useCallback(() => { setPage(1); loadPage(1, search, filterFrom, filterTo); }, [loadPage, search, filterFrom, filterTo]);

    // بحث: debounce 400ms
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); loadPage(1, search, filterFrom, filterTo); }, 400);
        return () => clearTimeout(t);
    }, [search, filterFrom, filterTo]); // eslint-disable-line

    const newEntry = () => setForm({ id: 0, date: todayISO(), description: '', lines: [emptyLine(), emptyLine()] });

    const editEntry = async (id) => {
        try {
            const r = await api('gl_entry_single', { params: { id } });
            if (!r.success) { toast(r.message || 'تعذّر الجلب', 'error'); return; }
            if (r.entry.ref_type && !['', 'manual', 'proof'].includes(r.entry.ref_type)) {
                toast('قيد مرتبط بمستند — يُعكس ولا يُعدّل', 'error'); return;
            }
            setForm({
                id: Number(r.entry.id), date: r.entry.date, description: r.entry.description || '',
                lines: r.lines.map(l => ({
                    account_id: l.account_id, debit: Number(l.debit) || '', credit: Number(l.credit) || '',
                    party_type: l.party_type || '', party_id: l.party_id || '', due_date: l.due_date || '',
                    cost_center_id: l.cost_center_id || '', description: l.description || '',
                })),
            });
        } catch (e) { toast(e.message, 'error'); }
    };

    const duplicateEntry = async (id) => {
        try {
            const r = await api('gl_entry_single', { params: { id } });
            if (!r.success) { toast(r.message || 'تعذّر الجلب', 'error'); return; }
            setForm({
                id: 0, // قيد جديد
                date: todayISO(),
                description: r.entry.description ? `نسخة: ${r.entry.description}` : '',
                lines: r.lines.map(l => ({
                    account_id: l.account_id, debit: Number(l.debit) || '', credit: Number(l.credit) || '',
                    party_type: l.party_type || '', party_id: l.party_id || '', due_date: '',
                    cost_center_id: l.cost_center_id || '', description: l.description || '',
                })),
            });
        } catch (e) { toast(e.message, 'error'); }
    };

    const totals = form ? form.lines.reduce((a, l) => ({
        d: a.d + (parseFloat(l.debit) || 0), c: a.c + (parseFloat(l.credit) || 0),
    }), { d: 0, c: 0 }) : { d: 0, c: 0 };
    const balanced = Math.abs(totals.d - totals.c) < 0.005 && totals.d > 0;

    const submit = async () => {
        if (!balanced) { toast('القيد غير متوازن', 'error'); return; }
        const lines = form.lines
            .filter(l => l.account_id && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0))
            .map(l => ({
                account_id: Number(l.account_id), debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
                party_type: l.party_type || undefined, party_id: l.party_id || undefined,
                due_date: l.due_date || undefined, cost_center_id: l.cost_center_id || undefined,
                description: l.description || undefined,
            }));
        if (lines.length < 2) { toast('القيد يحتاج بندين على الأقل', 'error'); return; }
        try {
            const r = await api(form.id ? 'gl_entry_update' : 'gl_entry_create', { method: 'POST', body: {
                id: form.id, date: form.date, description: form.description, ref_type: 'manual', lines,
            }});
            if (r.success) { toast(`${r.message} (${r.entry_no})`); setForm(null); load(); }
            else toast(r.message || 'فشل الترحيل', 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const reverse = async (id) => {
        if (!window.confirm('إنشاء قيد عكسي لهذا القيد؟')) return;
        try {
            const r = await api('gl_entry_reverse', { method: 'POST', body: { id, date: todayISO() } });
            if (r.success) { toast(`تم العكس (${r.entry_no})`); load(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const del = async (id) => {
        if (!window.confirm('حذف هذا القيد نهائياً؟')) return;
        try {
            const r = await api('gl_entry_delete', { method: 'POST', body: { id } });
            if (r.success) { toast('تم الحذف'); load(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const viewEntry = async (id) => {
        try { const r = await api('gl_entry_single', { params: { id } }); if (r.success) setViewing(r); }
        catch (e) { toast(e.message, 'error'); }
    };

    // ── نموذج القيد ──
    if (form) {
        const setLine = (i, patch) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));

        // ── التنقل بلوحة المفاتيح ─────────────────────────────────
        const focusLineField = (lineIdx, field /* 'account'|'debit'|'credit' */) => {
            setTimeout(() => {
                let el;
                if (field === 'account') el = document.querySelector(`[data-entry-acct="${lineIdx}"]`);
                else if (field === 'debit')  el = document.querySelector(`[data-entry-debit="${lineIdx}"]`);
                else if (field === 'credit') el = document.querySelector(`[data-entry-credit="${lineIdx}"]`);
                if (el) { el.focus(); if (el.type === 'number') el.select(); }
            }, 30);
        };

        const addLineAndFocus = () => {
            setForm(f => {
                const next = f.lines.length;
                setTimeout(() => focusLineField(next, 'account'), 60);
                return { ...f, lines: [...f.lines, emptyLine()] };
            });
        };

        const handleAmountKey = (e, lineIdx, field) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Tab to description or, if last line, add a new line
                if (lineIdx === form.lines.length - 1) addLineAndFocus();
                else focusLineField(lineIdx + 1, 'account');
            }
        };

        // توازن تلقائي: يُكمل آخر بند لتوازن القيد
        const autoBalance = () => {
            const diff = Math.round((totals.d - totals.c) * 100) / 100;
            if (Math.abs(diff) < 0.005) return;
            const lastIdx = form.lines.length - 1;
            setLine(lastIdx, diff > 0
                ? { credit: Math.round((parseFloat(form.lines[lastIdx].credit) || 0) + diff, 2).toFixed(2), debit: '' }
                : { debit:  Math.round((parseFloat(form.lines[lastIdx].debit)  || 0) - diff, 2).toFixed(2), credit: '' }
            );
        };
        return (
            <>
            <div className="space-y-4" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && balanced) { e.preventDefault(); submit(); } }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{form.id ? 'تعديل قيد' : 'قيد يومية جديد'}</h3>
                    <div className="flex items-center gap-2">
                        {templates.length > 0 && (
                            <Btn color="gray" size="sm" onClick={() => setTmplPicker(true)} title="تحميل قالب جاهز">
                                <Copy size={13} /> من قالب
                            </Btn>
                        )}
                        <Btn color="gray" size="sm" onClick={() => { setTmplSaveName(form.description || ''); setTmplSaveDlg(true); }} title="حفظ هذه البنود كقالب">
                            <Save size={13} /> حفظ كقالب
                        </Btn>
                        <Btn color="gray" onClick={() => setForm(null)}><X size={15} /> رجوع للقائمة</Btn>
                    </div>
                </div>
                <Card className="p-4 md:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ</label>
                            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">البيان</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="وصف القيد…"
                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm border-collapse">
                            <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                <tr>
                                    <th className="px-2 py-2 font-bold min-w-[180px]">الحساب</th>
                                    <th className="px-2 py-2 font-bold w-28">مدين</th>
                                    <th className="px-2 py-2 font-bold w-28">دائن</th>
                                    <th className="px-2 py-2 font-bold min-w-[150px]">الطرف / الاستحقاق</th>
                                    <th className="px-2 py-2 font-bold min-w-[120px]">بيان البند</th>
                                    <th className="px-2 py-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.lines.map((l, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                        <td className="px-2 py-1.5">
                                            <AccountCombobox
                                                accounts={postable}
                                                value={l.account_id}
                                                onChange={v => { setLine(i, { account_id: v }); focusLineField(i, 'debit'); }}
                                                inputProps={{ 'data-entry-acct': i }}
                                            />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.debit}
                                                data-entry-debit={i}
                                                onChange={e => setLine(i, { debit: e.target.value, credit: '' })}
                                                onKeyDown={e => handleAmountKey(e, i, 'debit')}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-emerald-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input type="number" step="0.01" value={l.credit}
                                                data-entry-credit={i}
                                                onChange={e => setLine(i, { credit: e.target.value, debit: '' })}
                                                onKeyDown={e => handleAmountKey(e, i, 'credit')}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm tabular-nums outline-none focus:border-rose-400" dir="ltr" />
                                        </td>
                                        <td className="px-2 py-1.5 space-y-1">
                                            <PartyCombobox
                                                parties={parties}
                                                value={l.party_id ? `${l.party_type}:${l.party_id}` : ''}
                                                onChange={v => {
                                                    if (!v) { setLine(i, { party_type: '', party_id: '' }); return; }
                                                    const [pt, pid] = v.split(':');
                                                    setLine(i, { party_type: pt, party_id: pid });
                                                }}
                                            />
                                            <input type="date" title="تاريخ الاستحقاق" value={l.due_date} onChange={e => setLine(i, { due_date: e.target.value })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={l.description} onChange={e => setLine(i, { description: e.target.value })}
                                                className="w-full bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-lg text-sm outline-none focus:border-[#c5a059]" />
                                            {costCenters.length > 0 && (
                                                <select value={l.cost_center_id} onChange={e => setLine(i, { cost_center_id: e.target.value })}
                                                    className="w-full mt-1 bg-white border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]">
                                                    <option value="">— مركز تكلفة —</option>
                                                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {form.lines.length > 2 && (
                                                <button onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                                                    className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
                                    <td className="px-2 py-2 text-left">الإجمالي</td>
                                    <td className="px-2 py-2 tabular-nums" dir="ltr">{money(totals.d)}</td>
                                    <td className="px-2 py-2 tabular-nums" dir="ltr">{money(totals.c)}</td>
                                    <td className="px-2 py-2" colSpan={3}>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {balanced ? '✓ متوازن' : `فرق ${money(Math.abs(totals.d - totals.c))}`}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Btn color="gray" size="sm" onClick={addLineAndFocus}><Plus size={14} /> إضافة بند</Btn>
                        {!balanced && Math.abs(totals.d - totals.c) > 0.005 && (
                            <Btn color="gray" size="sm" onClick={autoBalance} title="أكمل آخر بند تلقائياً لتوازن القيد">
                                ⚖ توازن تلقائي ({Math.abs(totals.d - totals.c).toFixed(2)})
                            </Btn>
                        )}
                        <div className="flex-1" />
                        <Btn color="green" onClick={submit} disabled={!balanced}><Save size={15} /> {form.id ? 'حفظ التعديل' : 'ترحيل القيد'}</Btn>
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-brand-600 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-slate-100 dark:border-brand-700">
                        <span>⌨ <kbd className="bg-slate-100 dark:bg-brand-800 px-1.5 py-0.5 rounded text-[10px]">Ctrl+Enter</kbd> ترحيل</span>
                        <span><kbd className="bg-slate-100 dark:bg-brand-800 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> في المبلغ → بند جديد</span>
                        <span><kbd className="bg-slate-100 dark:bg-brand-800 px-1.5 py-0.5 rounded text-[10px]">⚖</kbd> توازن تلقائي</span>
                    </div>
                </Card>
            </div>

            {/* مودال: اختر قالباً */}
            {tmplPicker && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTmplPicker(false)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-brand-800 dark:text-brand-100">تحميل قالب</h3>
                            <button onClick={() => setTmplPicker(false)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {templates.length === 0
                                ? <p className="text-sm text-slate-400 text-center py-6">لا توجد قوالب محفوظة بعد</p>
                                : templates.map(t => (
                                    <button key={t.id} onClick={() => applyTemplate(t.id)}
                                        className="w-full text-right px-4 py-3 rounded-xl border border-slate-200 dark:border-brand-700 hover:border-[#c5a059] hover:bg-amber-50/40 dark:hover:bg-brand-800 transition">
                                        <div className="font-bold text-sm text-brand-800 dark:text-brand-100">{t.name}</div>
                                        {t.description && <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5">{t.description}</div>}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* مودال: حفظ كقالب */}
            {tmplSaveDlg && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTmplSaveDlg(false)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-brand-800 dark:text-brand-100">حفظ كقالب</h3>
                            <button onClick={() => setTmplSaveDlg(false)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1">اسم القالب</label>
                        <input value={tmplSaveName} onChange={e => setTmplSaveName(e.target.value)}
                            autoFocus onKeyDown={e => e.key === 'Enter' && saveAsTemplate()}
                            placeholder="مثال: قيد الرواتب الشهرية"
                            className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059] mb-4" />
                        <div className="flex gap-2">
                            <Btn color="green" onClick={saveAsTemplate}><Save size={14} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setTmplSaveDlg(false)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
            </>
        );
    }

    // ── قائمة القيود / القوالب ──
    if (listSub === 'recurring') {
        return (
            <RecurringManager
                templates={templates}
                onBack={() => { setListSub('entries'); api('gl_recurring_list').then(r=>{ if(r.success) setDueCount(r.due_count||0); }).catch(()=>{}); }}
                toast={toast}
            />
        );
    }

    if (listSub === 'opening') {
        return (
            <OpeningBalanceWizard accounts={postable} toast={toast} onBack={() => setListSub('entries')} />
        );
    }

    if (listSub === 'templates') {
        return (
            <TemplatesManager
                templates={templates}
                reload={loadTemplates}
                accounts={postable}
                costCenters={costCenters}
                onBack={() => setListSub('entries')}
                onUse={async (tplId) => {
                    // أنشئ نموذج قيد جديد ثم حمّل بنود القالب عليه
                    setForm({ id: 0, date: todayISO(), description: '', lines: [emptyLine(), emptyLine()] });
                    setListSub('entries');
                    // applyTemplate تحتاج form محدّداً — نُحمّل مباشرة
                    try {
                        const r = await api('gl_template_get', { params: { id: tplId } });
                        if (!r.success) { toast(r.message, 'error'); return; }
                        const lines = (r.lines || []).map(l => ({
                            account_id: l.account_id||'', debit: Number(l.debit)||'', credit: Number(l.credit)||'',
                            party_type: '', party_id: '', due_date: '', cost_center_id: l.cost_center_id||'',
                            description: l.description||'',
                        }));
                        if (lines.length < 2) lines.push(emptyLine());
                        setForm({ id: 0, date: todayISO(), description: r.template.name, lines });
                        toast(`تم تحميل قالب: ${r.template.name}`);
                    } catch (e) { toast(e.message, 'error'); }
                }}
                toast={toast}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* تبويبات فرعية */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-brand-700 pb-0">
                {[
                    { id: 'entries',   label: 'القيود اليومية',   icon: <FileText size={14} /> },
                    { id: 'templates', label: `القوالب${templates.length > 0 ? ` (${templates.length})` : ''}`, icon: <Copy size={14} /> },
                    { id: 'recurring', label: `المتكررة${dueCount > 0 ? ` 🔔 ${dueCount}` : ''}`, icon: <RefreshCw size={14} /> },
                    { id: 'opening',   label: 'أرصدة افتتاحية',  icon: <BookOpen size={14} /> },
                ].map(s => (
                    <button key={s.id} onClick={() => setListSub(s.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-t-xl border-b-2 transition
                            ${listSub === s.id
                                ? 'border-[#c5a059] text-[#c5a059]'
                                : 'border-transparent text-slate-500 dark:text-brand-400 hover:text-[#c5a059]'}`}>
                        {s.icon}{s.label}
                    </button>
                ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    {/* بحث */}
                    <div className="relative min-w-[160px] flex-1 max-w-xs">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث في القيود…"
                            className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 pr-8 pl-3 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059]"
                            dir="rtl" />
                    </div>
                    {/* فلتر التاريخ */}
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                        title="من تاريخ"
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                        title="إلى تاريخ"
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                    {/* اختصارات زمنية */}
                    {[
                        { label: 'اليوم', f: todayISO(), t: todayISO() },
                        { label: 'هذا الشهر', f: monthStart(), t: todayISO() },
                        { label: 'هذه السنة', f: yearStart(), t: todayISO() },
                        { label: 'الشهر الماضي', ...prevMonth() },
                    ].map(({ label, f, t }) => (
                        <button key={label}
                            onClick={() => { setFilterFrom(f); setFilterTo(t); }}
                            className={`text-xs px-2 py-1 rounded-lg font-bold border transition ${filterFrom===f&&filterTo===t?'bg-brand-800 text-white border-brand-800':'bg-slate-50 border-slate-200 dark:bg-brand-800 dark:border-brand-700 text-slate-500 dark:text-brand-300 hover:border-[#c5a059]'}`}>
                            {label}
                        </button>
                    ))}
                    {(filterFrom || filterTo || search) && (
                        <button onClick={() => { setSearch(''); setFilterFrom(''); setFilterTo(''); }}
                            className="text-xs text-slate-400 hover:text-red-500 font-bold px-1" title="مسح الفلتر">✕ مسح</button>
                    )}
                    <span className="text-sm text-slate-500 dark:text-brand-400 shrink-0">{total.toLocaleString()} قيد</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Btn color="gray" size="sm" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="gray" size="sm" onClick={() => setShowXfer(true)}><ArrowRightLeft size={13} /> تحويل سريع</Btn>
                    <Btn color="green" onClick={newEntry}><Plus size={15} /> قيد جديد</Btn>
                </div>
            </div>

            {loading ? <Spinner /> : entries.length === 0 && page === 1 ? <Empty msg="لا توجد قيود بعد" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr>
                                    <th className="px-3 py-3 font-bold">رقم القيد</th>
                                    <th className="px-3 py-3 font-bold">التاريخ</th>
                                    <th className="px-3 py-3 font-bold">البيان</th>
                                    <th className="px-3 py-3 font-bold">المرجع</th>
                                    <th className="px-3 py-3 font-bold text-left">المبلغ</th>
                                    <th className="px-3 py-3 font-bold text-center w-32">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(e => {
                                    const locked = e.ref_type && !['', 'manual', 'proof'].includes(e.ref_type);
                                    return (
                                        <tr key={e.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-mono font-bold"><EntityLink to={`entry/${e.id}`} title="تفاصيل القيد">{e.entry_no}</EntityLink></td>
                                            <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300">{e.date}</td>
                                            <td className="px-3 py-2.5 text-slate-700 dark:text-brand-300 max-w-xs truncate" title={e.description}>{e.description || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                {e.ref_type ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:text-brand-400">{e.ref_type}</span> : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-left font-bold tabular-nums" dir="ltr">{money(e.total_debit)}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => viewEntry(e.id)} title="عرض" className="text-slate-400 dark:text-brand-500 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-300"><Eye size={15} /></button>
                                                    {!locked && <button onClick={() => editEntry(e.id)} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>}
                                                    <button onClick={() => duplicateEntry(e.id)} title="نسخ كقيد جديد" className="text-slate-400 dark:text-brand-500 hover:text-blue-600"><Copy size={15} /></button>
                                                    <button onClick={() => reverse(e.id)} title="عكس" className="text-slate-400 dark:text-brand-500 hover:text-amber-600"><RotateCcw size={15} /></button>
                                                    {!locked && <button onClick={() => del(e.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {!loading && total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 disabled:opacity-40 hover:border-[#c5a059] transition">
                        ← السابق
                    </button>
                    <span className="text-sm font-bold text-slate-600 dark:text-brand-300">
                        {page} / {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 disabled:opacity-40 hover:border-[#c5a059] transition">
                        التالي →
                    </button>
                </div>
            )}

            {viewing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{viewing.entry.entry_no}</h3>
                                <p className="text-xs text-slate-500 dark:text-brand-400">{viewing.entry.date} · {viewing.entry.description}</p>
                            </div>
                            <button onClick={() => setViewing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                <tr><th className="px-3 py-2 font-bold">الحساب</th><th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th></tr>
                            </thead>
                            <tbody>
                                {viewing.lines.map(l => (
                                    <tr key={l.id} className="border-b border-slate-100 dark:border-brand-700">
                                        <td className="px-3 py-2">
                                            {l.account_id
                                                ? <EntityLink to={`acct/${l.account_id}`} muted title="دفتر أستاذ الحساب"><span className="font-mono text-xs opacity-70">{l.account_code}</span> {l.account_name}</EntityLink>
                                                : <span><span className="font-mono text-xs text-slate-400 dark:text-brand-500">{l.account_code}</span> {l.account_name}</span>}
                                            {l.description ? <span className="block text-xs text-slate-400 dark:text-brand-500">{l.description}</span> : null}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.debit) ? money(l.debit) : ''}</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(l.credit) ? money(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-black text-brand-800 dark:text-brand-100 bg-slate-50 dark:bg-brand-800/60">
                                    <td className="px-3 py-2 text-left">الإجمالي</td>
                                    <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(viewing.entry.total_debit)}</td>
                                    <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(viewing.entry.total_credit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ── مودال: تحويل سريع ── */}
            {showXfer && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowXfer(false)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                                <ArrowRightLeft size={18} className="text-[#c5a059]" /> تحويل سريع بين حسابين
                            </h3>
                            <button onClick={() => setShowXfer(false)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من حساب (مدين)</label>
                                <AccountCombobox accounts={postable} value={xfer.from_id} onChange={v => setXfer(f=>({...f,from_id:v}))} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى حساب (دائن)</label>
                                <AccountCombobox accounts={postable} value={xfer.to_id} onChange={v => setXfer(f=>({...f,to_id:v}))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">المبلغ</label>
                                    <input type="number" step="0.01" value={xfer.amount} onChange={e => setXfer(f=>({...f,amount:e.target.value}))}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">التاريخ</label>
                                    <input type="date" value={xfer.date} onChange={e => setXfer(f=>({...f,date:e.target.value}))}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">البيان</label>
                                <input value={xfer.desc} onChange={e => setXfer(f=>({...f,desc:e.target.value}))}
                                    placeholder="مثال: إيداع بنكي، سحب نقدي…"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-brand-700">
                            <Btn color="gray" onClick={() => setShowXfer(false)}>إلغاء</Btn>
                            <Btn color="gold" onClick={submitXfer} disabled={xferBusy}>
                                {xferBusy ? <Loader2 size={14} className="animate-spin"/> : <ArrowRightLeft size={14}/>}
                                تأكيد التحويل
                            </Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 3: ميزان المراجعة
// ════════════════════════════════════════════════════════════════════════════
function TrialBalanceTab({ toast }) {
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const load = useCallback(async (t) => {
        setLoading(true);
        try { const r = await api('gl_trial_balance', { params: t ? { to: t } : {} }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(to); }, []); // eslint-disable-line

    const allRows = data?.data || [];
    const rows = typeFilter ? allRows.filter(r => r.type === typeFilter) : allRows;
    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div className="flex items-end gap-2 flex-wrap">
                    <PeriodBar to={to} setTo={setTo} onApply={() => load(to)} showFrom={false} />
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                        <option value="">كل الأنواع</option>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                {allRows.length > 0 && (
                    <div className="flex gap-2">
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('trial_balance.csv',
                            ['الكود', 'الحساب', 'مدين', 'دائن'], rows.map(r => [r.code, r.name, r.debit_balance, r.credit_balance]))}>
                            <Download size={14} /> تصدير
                        </Btn>
                        <Btn color="gray" size="sm" onClick={() => {
                            const rowsHtml = rows.map(r =>
                                `<tr><td style="font-family:monospace;color:#94a3b8">${r.code}</td><td>${r.name}</td>
                                <td class="amount">${Number(r.debit_balance) ? money(r.debit_balance)+' ﷼' : ''}</td>
                                <td class="amount">${Number(r.credit_balance) ? money(r.credit_balance)+' ﷼' : ''}</td></tr>`
                            ).join('');
                            printHtml('ميزان المراجعة', `
                                <h1>ميزان المراجعة</h1><h2>حتى تاريخ ${to}</h2>
                                <table><thead><tr><th>الكود</th><th>الحساب</th><th style="text-align:left">مدين</th><th style="text-align:left">دائن</th></tr></thead>
                                <tbody>${rowsHtml}</tbody>
                                <tfoot><tr class="total-row"><td colspan="2">الإجمالي ${data?.totals?.balanced?'✓ متوازن':'✗ غير متوازن'}</td>
                                <td class="amount">${money(data?.totals?.debit)} ﷼</td><td class="amount">${money(data?.totals?.credit)} ﷼</td></tr></tfoot>
                                </table>`);
                        }}>
                            <Printer size={14} /> طباعة
                        </Btn>
                    </div>
                )}
            </div>
            {loading ? <Spinner /> : rows.length === 0 ? <Empty msg="لا توجد حركات" /> : (
                <Card>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                            <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الحساب</th>
                                <th className="px-3 py-3 font-bold">النوع</th>
                                <th className="px-3 py-3 font-bold text-left">مدين</th><th className="px-3 py-3 font-bold text-left">دائن</th></tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                    <td className="px-3 py-2.5 font-mono text-slate-400 dark:text-brand-500">{r.code}</td>
                                    <td className="px-3 py-2.5"><EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب">{r.name}</EntityLink></td>
                                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[r.type]}`}>{TYPE_LABELS[r.type]}</span></td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.debit_balance) ? money(r.debit_balance) : ''}</td>
                                    <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{Number(r.credit_balance) ? money(r.credit_balance) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
                                <td className="px-3 py-3" colSpan={3}>الإجمالي
                                    {data?.totals && <span className={`mr-2 text-xs px-2 py-0.5 rounded-full ${data.totals.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {data.totals.balanced ? '✓ متوازن' : '✗ غير متوازن'}</span>}</td>
                                <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data?.totals?.debit)}</td>
                                <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data?.totals?.credit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 4: قائمة الدخل
// ════════════════════════════════════════════════════════════════════════════
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function IncomeTab({ toast }) {
    const [sub,     setSub]     = useState('statement'); // 'statement' | 'monthly'
    const [from,    setFrom]    = useState(yearStart());
    const [to,      setTo]      = useState(todayISO());
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(false);
    const [compare, setCompare] = useState(false);
    const [prior,   setPrior]   = useState(null);
    // Monthly trend
    const [year,    setYear]    = useState(new Date().getFullYear().toString());
    const [monthly, setMonthly] = useState(null);
    const [mLoad,   setMLoad]   = useState(false);

    // ─── helpers ────────────────────────────────────────────────────
    const priorRange = useMemo(() => {
        if (!from || !to) return null;
        const f = new Date(from), t = new Date(to);
        const dur = t - f; // ms
        const pTo = new Date(f.getTime() - 86400000);
        const pFrom = new Date(pTo.getTime() - dur);
        return { from: pFrom.toISOString().slice(0,10), to: pTo.toISOString().slice(0,10) };
    }, [from, to]);

    // ─── loaders ────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_income_statement', { params: { from, to } }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [from, to, toast]);

    const loadPrior = useCallback(async () => {
        if (!priorRange) return;
        try { const r = await api('gl_income_statement', { params: { from: priorRange.from, to: priorRange.to } }); setPrior(r); }
        catch { /* silent */ }
    }, [priorRange]);

    const loadMonthly = useCallback(async () => {
        setMLoad(true);
        try { const r = await api('gl_income_monthly', { params: { year } }); setMonthly(r); }
        catch (e) { toast(e.message, 'error'); } finally { setMLoad(false); }
    }, [year, toast]);

    useEffect(() => { load(); }, []); // eslint-disable-line
    useEffect(() => { if (compare) loadPrior(); else setPrior(null); }, [compare, loadPrior]);
    useEffect(() => { if (sub === 'monthly') loadMonthly(); }, [sub, loadMonthly]);

    // ─── rendering helpers ──────────────────────────────────────────
    const pMap = useMemo(() => {
        if (!prior) return {};
        const m = {};
        [...(prior.revenue||[]), ...(prior.expenses||[])].forEach(r => { m[r.id] = r.amount; });
        return m;
    }, [prior]);

    const varBadge = (cur, priorAmt) => {
        if (!compare || prior == null) return null;
        const diff = cur - (priorAmt ?? 0);
        const pct  = priorAmt ? (diff / Math.abs(priorAmt)) * 100 : null;
        const pos  = diff >= 0;
        return (
            <span className={`text-[11px] font-bold tabular-nums mr-2 ${pos ? 'text-emerald-600' : 'text-rose-500'}`} dir="ltr">
                {pos ? '+' : ''}{money(diff)}
                {pct != null && <span className="opacity-70"> ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>}
            </span>
        );
    };

    const section = (title, items, color) => (
        <div>
            <h4 className={`text-sm font-black mb-2 ${color}`}>{title}</h4>
            <div className="space-y-0.5">
                {items.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 dark:border-brand-700">
                        <EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب">
                            <span className="font-mono text-xs opacity-70">{r.code}</span> {r.name}
                        </EntityLink>
                        <div className="flex items-center gap-1">
                            {compare && prior && (
                                <span className="tabular-nums text-xs text-slate-400 dark:text-brand-600 font-bold" dir="ltr">
                                    {money(pMap[r.id] ?? 0)}
                                </span>
                            )}
                            {varBadge(r.amount, pMap[r.id])}
                            <span className="tabular-nums font-bold min-w-[80px] text-left" dir="ltr">{money(r.amount)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* تبويبات فرعية */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'statement', label: 'قائمة الدخل' },
                    { id: 'monthly',   label: 'التحليل الشهري' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSub(s.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition border ${
                            sub === s.id
                                ? 'bg-brand-800 text-white border-brand-800 dark:bg-brand-700 dark:border-brand-600'
                                : 'border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059]'
                        }`}>{s.label}</button>
                ))}
            </div>

            {/* ── قائمة الدخل ── */}
            {sub === 'statement' && (
                <>
                    <div className="flex items-end justify-between flex-wrap gap-3">
                        <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
                        <div className="flex items-center gap-2">
                            {/* مقارنة بالفترة السابقة */}
                            <button onClick={() => setCompare(p => !p)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border transition ${
                                    compare
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-indigo-400'
                                }`}>
                                <ArrowRightLeft size={13} /> مقارنة بالسابق
                            </button>
                            {data && <>
                                <Btn color="gray" size="sm" onClick={() => downloadCSV('income_statement.csv',
                                    ['النوع','الكود','الحساب','الفترة الحالية', ...(compare && prior ? ['الفترة السابقة','التغيير'] : [])],
                                    [
                                        ...(data.revenue||[]).map(r  => ['إيرادات',r.code,r.name,r.amount,...(compare&&prior?[pMap[r.id]??0,r.amount-(pMap[r.id]??0)]:[])]),
                                        ...(data.expenses||[]).map(r => ['مصروفات',r.code,r.name,r.amount,...(compare&&prior?[pMap[r.id]??0,r.amount-(pMap[r.id]??0)]:[])]),
                                        ['','','إجمالي الإيرادات',data.totals.revenue,...(compare&&prior?[prior.totals.revenue,data.totals.revenue-prior.totals.revenue]:[])],
                                        ['','','إجمالي المصروفات',data.totals.expenses,...(compare&&prior?[prior.totals.expenses,data.totals.expenses-prior.totals.expenses]:[])],
                                        ['','','صافي الدخل',data.totals.net,...(compare&&prior?[prior.totals.net,data.totals.net-prior.totals.net]:[])],
                                    ])}>
                                    <Download size={14} /> تصدير
                                </Btn>
                                <Btn color="gray" size="sm" onClick={() => {
                                    const esc = s => String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
                                    const cmpHead = compare && prior ? `<th style="text-align:left">السابق</th><th style="text-align:left">التغيير</th>` : '';
                                    const r2 = (code,name,amt,pid) => {
                                        const pa = compare&&prior ? pMap[pid]??0 : null;
                                        const cmpCols = compare&&prior ? `<td class="amount">${money(pa)} ﷼</td><td class="amount ${amt-pa>=0?'':'neg'}">${amt-pa>=0?'+':''}${money(amt-pa)} ﷼</td>` : '';
                                        return `<tr><td>${esc(code)} · ${esc(name)}</td><td class="amount">${money(amt)} ﷼</td>${cmpCols}</tr>`;
                                    };
                                    printHtml('قائمة الدخل', `
                                        <style>.neg{color:#b91c1c}</style>
                                        <h1>قائمة الدخل</h1><h2>من ${from} إلى ${to}${compare&&prior?` (مقارنة: ${priorRange?.from} → ${priorRange?.to})`:''}</h2>
                                        <table><thead><tr><th>الحساب</th><th style="text-align:left">الحالي</th>${cmpHead}</tr></thead><tbody>
                                        <tr class="section-header"><td colspan="4">الإيرادات</td></tr>
                                        ${(data.revenue||[]).map(r=>r2(r.code,r.name,r.amount,r.id)).join('')}
                                        <tr class="total-row"><td>إجمالي الإيرادات</td><td class="amount">${money(data.totals.revenue)} ﷼</td>${compare&&prior?`<td class="amount">${money(prior.totals.revenue)} ﷼</td><td class="amount">${money(data.totals.revenue-prior.totals.revenue)} ﷼</td>`:''}</tr>
                                        <tr class="section-header"><td colspan="4">المصروفات</td></tr>
                                        ${(data.expenses||[]).map(r=>r2(r.code,r.name,r.amount,r.id)).join('')}
                                        <tr class="total-row"><td>إجمالي المصروفات</td><td class="amount">${money(data.totals.expenses)} ﷼</td>${compare&&prior?`<td class="amount">${money(prior.totals.expenses)} ﷼</td><td class="amount">${money(data.totals.expenses-prior.totals.expenses)} ﷼</td>`:''}</tr>
                                        <tr class="net-row"><td>صافي الدخل</td><td class="amount">${money(data.totals.net)} ﷼</td>${compare&&prior?`<td class="amount">${money(prior.totals.net)} ﷼</td><td class="amount">${money(data.totals.net-prior.totals.net)} ﷼</td>`:''}</tr>
                                        </tbody></table>`);
                                }}>
                                    <Printer size={14} /> طباعة
                                </Btn>
                            </>}
                        </div>
                    </div>
                    {/* رأس المقارنة */}
                    {compare && prior && (
                        <div className="flex justify-end gap-4 text-[11px] font-bold text-slate-400 dark:text-brand-500 px-1">
                            <span>السابق ({priorRange?.from} → {priorRange?.to})</span>
                            <span>التغيير</span>
                            <span className="min-w-[80px] text-left">الحالي</span>
                        </div>
                    )}
                    {loading ? <Spinner /> : !data ? <Empty /> : (
                        <Card className="p-5 md:p-6 space-y-5">
                            {section('الإيرادات', data.revenue || [], 'text-emerald-700 dark:text-emerald-400')}
                            {section('المصروفات', data.expenses || [], 'text-rose-700 dark:text-rose-400')}
                            <div className="border-t-2 border-slate-100 dark:border-brand-700 pt-4 space-y-2">
                                {[
                                    { label: 'إجمالي الإيرادات', cur: data.totals.revenue, prev: prior?.totals.revenue, cls: 'text-emerald-700 dark:text-emerald-400' },
                                    { label: 'إجمالي المصروفات', cur: data.totals.expenses, prev: prior?.totals.expenses, cls: 'text-rose-700 dark:text-rose-400' },
                                ].map(({label,cur,prev,cls}) => (
                                    <div key={label} className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-slate-500 dark:text-brand-400">{label}</span>
                                        <div className="flex items-center gap-1">
                                            {compare && prior && <span className="tabular-nums text-xs text-slate-400 dark:text-brand-600 font-bold" dir="ltr">{money(prev??0)}</span>}
                                            {varBadge(cur, prev)}
                                            <span className={`tabular-nums font-bold min-w-[80px] text-left ${cls}`} dir="ltr">{money(cur)}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between text-lg pt-2 border-t border-slate-100 dark:border-brand-700">
                                    <span className="font-black text-brand-800 dark:text-brand-100">صافي الدخل</span>
                                    <div className="flex items-center gap-1">
                                        {compare && prior && <span className="tabular-nums text-sm text-slate-400 dark:text-brand-600 font-bold" dir="ltr">{money(prior.totals.net)}</span>}
                                        {varBadge(data.totals.net, prior?.totals.net)}
                                        <span className={`tabular-nums font-black min-w-[80px] text-left ${data.totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">{money(data.totals.net)} ﷼</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* ── التحليل الشهري ── */}
            {sub === 'monthly' && (
                <div className="space-y-4">
                    <div className="flex items-end gap-3 flex-wrap">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">السنة</label>
                            <select value={year} onChange={e => setYear(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]">
                                {Array.from({length:5},(_,i)=> new Date().getFullYear()-i).map(y=>(
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <Btn color="navy" size="sm" onClick={loadMonthly} disabled={mLoad}>
                            {mLoad ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} تحديث
                        </Btn>
                        {monthly && (
                            <>
                                <Btn color="gray" size="sm" onClick={() => downloadCSV(`income_monthly_${year}.csv`,
                                    ['الشهر','الإيرادات','المصروفات','صافي الدخل'],
                                    monthly.months.map(m=>[AR_MONTHS[parseInt(m.month.slice(5))-1]+' '+year,m.revenue,m.expenses,m.net])
                                )}><Download size={14} /> CSV</Btn>
                                <Btn color="gray" size="sm" onClick={() => {
                                    const maxVal = Math.max(...monthly.months.map(m=>Math.max(m.revenue,m.expenses)),1);
                                    const bar = (v,cls) => `<div style="display:inline-block;width:${Math.max(2,(v/maxVal*160)).toFixed(0)}px;height:12px;border-radius:3px;${cls}"></div>`;
                                    const rows = monthly.months.map((m,i)=>`<tr>
                                        <td>${AR_MONTHS[i]}</td>
                                        <td class="amount">${money(m.revenue)} ﷼ ${bar(m.revenue,'background:#16a34a30;border:1px solid #16a34a')}</td>
                                        <td class="amount">${money(m.expenses)} ﷼ ${bar(m.expenses,'background:#dc262630;border:1px solid #dc2626')}</td>
                                        <td class="amount ${m.net<0?'neg':''}">${m.net<0?'('+money(-m.net)+')':money(m.net)} ﷼</td>
                                    </tr>`).join('');
                                    printHtml(`التحليل الشهري ${year}`,`
                                        <style>.neg{color:#b91c1c}</style>
                                        <h1>التحليل الشهري لقائمة الدخل — ${year}</h1>
                                        <table><thead><tr><th>الشهر</th><th style="text-align:left">الإيرادات</th><th style="text-align:left">المصروفات</th><th style="text-align:left">صافي الدخل</th></tr></thead>
                                        <tbody>${rows}</tbody>
                                        <tfoot><tr class="total-row"><td>الإجمالي</td><td class="amount">${money(monthly.totals.revenue)} ﷼</td><td class="amount">${money(monthly.totals.expenses)} ﷼</td><td class="amount">${money(monthly.totals.net)} ﷼</td></tr></tfoot>
                                        </table>`);
                                }}><Printer size={14} /> طباعة</Btn>
                            </>
                        )}
                    </div>

                    {mLoad ? <Spinner /> : !monthly ? null : (() => {
                        const maxVal = Math.max(...monthly.months.map(m => Math.max(m.revenue, m.expenses)), 1);
                        return (
                            <Card>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[12px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                                <th className="text-right py-3 px-3">الشهر</th>
                                                <th className="text-left py-3 px-3">الإيرادات</th>
                                                <th className="text-left py-3 px-3">المصروفات</th>
                                                <th className="text-left py-3 px-3">صافي الدخل</th>
                                                <th className="py-3 px-3 min-w-[140px]">الإيرادات مقابل المصروفات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthly.months.map((m, i) => {
                                                const revW = (m.revenue / maxVal * 100).toFixed(1);
                                                const expW = (m.expenses / maxVal * 100).toFixed(1);
                                                const net = m.net;
                                                return (
                                                    <tr key={m.month} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                                        <td className="py-2.5 px-3 font-bold text-brand-800 dark:text-brand-100 whitespace-nowrap">
                                                            {AR_MONTHS[i]}
                                                        </td>
                                                        <td className="py-2.5 px-3 tabular-nums font-bold text-emerald-700 dark:text-emerald-400 text-left" dir="ltr">
                                                            {m.revenue > 0 ? money(m.revenue) : <span className="text-slate-300 dark:text-brand-700">—</span>}
                                                        </td>
                                                        <td className="py-2.5 px-3 tabular-nums font-bold text-rose-600 dark:text-rose-400 text-left" dir="ltr">
                                                            {m.expenses > 0 ? money(m.expenses) : <span className="text-slate-300 dark:text-brand-700">—</span>}
                                                        </td>
                                                        <td className={`py-2.5 px-3 tabular-nums font-black text-left ${net > 0 ? 'text-emerald-700 dark:text-emerald-400' : net < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-brand-600'}`} dir="ltr">
                                                            {net !== 0 ? money(net) : '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex flex-col gap-0.5 min-w-[120px]">
                                                                {m.revenue > 0 && <div className="h-2 rounded-full bg-emerald-500/70" style={{width:`${revW}%`,minWidth:'3px'}} title={`إيرادات: ${money(m.revenue)}`} />}
                                                                {m.expenses > 0 && <div className="h-2 rounded-full bg-rose-500/70" style={{width:`${expW}%`,minWidth:'3px'}} title={`مصروفات: ${money(m.expenses)}`} />}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-slate-200 dark:border-brand-700">
                                                <td className="py-3 px-3">الإجمالي</td>
                                                <td className="py-3 px-3 tabular-nums text-emerald-700 dark:text-emerald-400 text-left" dir="ltr">{money(monthly.totals.revenue)}</td>
                                                <td className="py-3 px-3 tabular-nums text-rose-600 dark:text-rose-400 text-left" dir="ltr">{money(monthly.totals.expenses)}</td>
                                                <td className={`py-3 px-3 tabular-nums text-left ${monthly.totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">{money(monthly.totals.net)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </Card>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 5: الميزانية العمومية
// ════════════════════════════════════════════════════════════════════════════
function BalanceSheetTab({ toast }) {
    const [to,       setTo]       = useState(todayISO());
    const [data,     setData]     = useState(null);
    const [loading,  setLoading]  = useState(false);
    const [compare,  setCompare]  = useState(false);
    const [priorTo,  setPriorTo]  = useState(() => { const y = new Date().getFullYear()-1; return `${y}-12-31`; });
    const [prior,    setPrior]    = useState(null);

    const load = useCallback(async (t) => {
        setLoading(true);
        try { const r = await api('gl_balance_sheet', { params: { to: t } }); setData(r); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [toast]);

    const loadPrior = useCallback(async (pt) => {
        try { const r = await api('gl_balance_sheet', { params: { to: pt } }); if (r.success) setPrior(r); }
        catch { /* silent */ }
    }, []);

    useEffect(() => { load(to); }, []); // eslint-disable-line
    useEffect(() => { if (compare) loadPrior(priorTo); else setPrior(null); }, [compare, priorTo, loadPrior]);

    // خريطة أرصدة الفترة المقارنة
    const priorMap = useMemo(() => {
        if (!prior) return {};
        const m = {};
        [...(prior.assets||[]), ...(prior.liabilities||[]), ...(prior.equity||[])].forEach(r => { m[r.id] = r.amount; });
        return m;
    }, [prior]);

    const varCell = (cur, priorAmt) => {
        if (!compare || !prior) return null;
        const diff = cur - (priorAmt ?? 0);
        const pos = diff >= 0;
        return <td className={`py-2 px-3 text-left tabular-nums text-[12px] font-bold ${pos?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`} dir="ltr">
            {pos?'+':''}{money(diff)}
        </td>;
    };

    const section = (title, items, total, secColor, extraRow) => (
        <div>
            <tr className={`bg-slate-50/80 dark:bg-brand-800/50 border-y border-slate-100 dark:border-brand-700`}>
                <td className={`py-2 px-3 font-black text-sm ${secColor}`} colSpan={compare&&prior?4:2}>{title}</td>
            </tr>
            {items.map(r => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                    <td className="py-2 px-3 text-sm">
                        <EntityLink to={`acct/${r.id}`} muted title="دفتر أستاذ الحساب">
                            <span className="font-mono text-[11px] opacity-60 ml-2">{r.code}</span>{r.name}
                        </EntityLink>
                    </td>
                    {compare && prior && <td className="py-2 px-3 text-left tabular-nums text-sm text-slate-400 dark:text-brand-600 font-bold" dir="ltr">{money(priorMap[r.id]??0)}</td>}
                    <td className="py-2 px-3 text-left tabular-nums font-bold text-sm" dir="ltr">{money(r.amount)}</td>
                    {varCell(r.amount, priorMap[r.id])}
                </tr>
            ))}
            {extraRow}
            <tr className="border-b-2 border-slate-200 dark:border-brand-600 bg-slate-50/50 dark:bg-brand-800/30 font-black">
                <td className="py-2.5 px-3 text-sm text-brand-800 dark:text-brand-100">الإجمالي</td>
                {compare && prior && <td className="py-2.5 px-3 text-left tabular-nums text-sm text-slate-400 dark:text-brand-500 font-bold" dir="ltr">
                    {money((prior?.totals?.[title==='الأصول'?'assets':title==='الخصوم'?'liabilities':'equity'])??0)}
                </td>}
                <td className="py-2.5 px-3 text-left tabular-nums font-black text-brand-800 dark:text-brand-100" dir="ltr">{money(total)} ﷼</td>
                {compare && prior && varCell(total, prior?.totals?.[title==='الأصول'?'assets':title==='الخصوم'?'liabilities':'equity'])}
            </tr>
        </div>
    );

    const printBS = () => {
        if (!data) return;
        const esc = s => String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
        const cmpHead = compare&&prior?`<th style="text-align:left">${priorTo}</th><th style="text-align:left">التغيير</th>`:'';
        const r2 = (code,name,cur,pid) => {
            const pa = compare&&prior ? (priorMap[pid]??0) : null;
            const cmpCols = compare&&prior?`<td class="amount">${money(pa)} ﷼</td><td class="amount ${cur-pa>=0?'':'neg'}">${cur-pa>=0?'+':''}${money(cur-pa)} ﷼</td>`:'';
            return `<tr><td>${esc(code)} · ${esc(name)}</td><td class="amount">${money(cur)} ﷼</td>${cmpCols}</tr>`;
        };
        const totR = (lbl,cur,prior_v,cls='total-row') => {
            const cmpCols = compare&&prior?`<td class="amount">${money(prior_v??0)} ﷼</td><td class="amount">${money(cur-(prior_v??0))} ﷼</td>`:'';
            return `<tr class="${cls}"><td>${lbl}</td><td class="amount">${money(cur)} ﷼</td>${cmpCols}</tr>`;
        };
        printHtml('الميزانية العمومية', `
            <style>.neg{color:#b91c1c}</style>
            <h1>الميزانية العمومية</h1><h2>بتاريخ ${to}${compare&&prior?` (مقارنة: ${priorTo})`:''}</h2>
            <table><thead><tr><th>الحساب</th><th style="text-align:left">${to}</th>${cmpHead}</tr></thead><tbody>
            <tr class="section-header"><td colspan="4">الأصول</td></tr>
            ${(data.assets||[]).map(r=>r2(r.code,r.name,r.amount,r.id)).join('')}
            ${totR('إجمالي الأصول',data.totals.assets,prior?.totals?.assets)}
            <tr class="section-header"><td colspan="4">الخصوم</td></tr>
            ${(data.liabilities||[]).map(r=>r2(r.code,r.name,r.amount,r.id)).join('')}
            ${totR('إجمالي الخصوم',data.totals.liabilities,prior?.totals?.liabilities)}
            <tr class="section-header"><td colspan="4">حقوق الملكية</td></tr>
            ${(data.equity||[]).map(r=>r2(r.code,r.name,r.amount,r.id)).join('')}
            <tr><td>صافي دخل الفترة</td><td class="amount">${money(data.net_income)} ﷼</td>${compare&&prior?`<td class="amount">${money(prior?.net_income??0)} ﷼</td><td class="amount">${money(data.net_income-(prior?.net_income??0))} ﷼</td>`:''}</tr>
            ${totR('إجمالي حقوق الملكية',data.totals.equity,prior?.totals?.equity)}
            ${totR('إجمالي الخصوم + حقوق الملكية',data.totals.liabilities+data.totals.equity,(prior?.totals?.liabilities??0)+(prior?.totals?.equity??0),'net-row')}
            </tbody></table>`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar to={to} setTo={setTo} onApply={() => load(to)} showFrom={false} />
                <div className="flex items-center gap-2 flex-wrap">
                    {/* مقارنة */}
                    <button onClick={() => setCompare(p => !p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border transition ${
                            compare ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-indigo-400'
                        }`}>
                        <ArrowRightLeft size={13} /> مقارنة
                    </button>
                    {compare && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400 dark:text-brand-500">بتاريخ</span>
                            <input type="date" value={priorTo} onChange={e => setPriorTo(e.target.value)}
                                className="px-2 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-[13px] font-bold dark:bg-brand-900 dark:text-brand-100 outline-none focus:border-indigo-400" />
                        </div>
                    )}
                    {data && <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.totals.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {data.totals.balanced ? '✓ متوازنة' : '✗ غير متوازنة'}</span>}
                    {data && <>
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('balance_sheet.csv',
                            ['الفئة','الكود','الحساب', to, ...(compare&&prior?[priorTo,'التغيير']:[])],
                            [
                                ...(data.assets||[]).map(r=>['أصول',r.code,r.name,r.amount,...(compare&&prior?[priorMap[r.id]??0,r.amount-(priorMap[r.id]??0)]:[])]),
                                ['','','إجمالي الأصول',data.totals.assets,...(compare&&prior?[prior.totals.assets,data.totals.assets-prior.totals.assets]:[])],
                                ...(data.liabilities||[]).map(r=>['خصوم',r.code,r.name,r.amount,...(compare&&prior?[priorMap[r.id]??0,r.amount-(priorMap[r.id]??0)]:[])]),
                                ['','','إجمالي الخصوم',data.totals.liabilities,...(compare&&prior?[prior.totals.liabilities,data.totals.liabilities-prior.totals.liabilities]:[])],
                                ...(data.equity||[]).map(r=>['ملكية',r.code,r.name,r.amount,...(compare&&prior?[priorMap[r.id]??0,r.amount-(priorMap[r.id]??0)]:[])]),
                                ['صافي دخل','','',data.net_income,...(compare&&prior?[prior.net_income,data.net_income-prior.net_income]:[])],
                            ])}>
                            <Download size={14} /> تصدير
                        </Btn>
                        <Btn color="gray" size="sm" onClick={printBS}><Printer size={14} /> طباعة</Btn>
                    </>}
                </div>
            </div>

            {/* رأس المقارنة */}
            {compare && prior && (
                <div className="flex justify-end gap-4 text-[11px] font-bold text-slate-400 dark:text-brand-500 px-1">
                    <span>{priorTo}</span>
                    <span>التغيير</span>
                    <span className="min-w-[80px] text-left">{to}</span>
                </div>
            )}

            {loading ? <Spinner /> : !data ? <Empty /> : (
                <Card>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700 bg-slate-50/70 dark:bg-brand-800/40">
                                    <th className="text-right py-2.5 px-3">الحساب</th>
                                    {compare && prior && <th className="text-left py-2.5 px-3">{priorTo}</th>}
                                    <th className="text-left py-2.5 px-3">{to}</th>
                                    {compare && prior && <th className="text-left py-2.5 px-3">التغيير</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {section('الأصول', data.assets||[], data.totals.assets, 'text-blue-700 dark:text-blue-400')}
                                {section('الخصوم', data.liabilities||[], data.totals.liabilities, 'text-amber-700 dark:text-amber-400')}
                                {section('حقوق الملكية', data.equity||[], data.totals.equity, 'text-purple-700 dark:text-purple-400',
                                    <tr className="border-b border-slate-50 dark:border-brand-700 italic">
                                        <td className="py-2 px-3 text-sm text-slate-500 dark:text-brand-400">صافي دخل الفترة</td>
                                        {compare && prior && <td className="py-2 px-3 text-left tabular-nums text-sm text-slate-400 dark:text-brand-600" dir="ltr">{money(prior.net_income??0)}</td>}
                                        <td className="py-2 px-3 text-left tabular-nums text-sm font-bold" dir="ltr">{money(data.net_income)}</td>
                                        {varCell(data.net_income, prior?.net_income)}
                                    </tr>
                                )}
                                {/* الإجمالي العام */}
                                <tr className="bg-brand-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-brand-200 dark:border-brand-600">
                                    <td className="py-3 px-3">إجمالي الخصوم + حقوق الملكية</td>
                                    {compare && prior && <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{money((prior.totals.liabilities||0)+(prior.totals.equity||0))}</td>}
                                    <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{money(data.totals.liabilities+data.totals.equity)} ﷼</td>
                                    {varCell(data.totals.liabilities+data.totals.equity, (prior?.totals?.liabilities||0)+(prior?.totals?.equity||0))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 6: كشف حساب (دفتر الأستاذ)
// ════════════════════════════════════════════════════════════════════════════
function LedgerTab({ accounts, toast }) {
    const postable = useMemo(() => accounts.filter(a => Number(a.is_group) === 0), [accounts]);
    const [acc, setAcc] = useState('');
    const [from, setFrom] = useState(yearStart());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        if (!acc) { toast('اختر حساباً', 'error'); return; }
        setLoading(true);
        try { const r = await api('gl_ledger', { params: { account_id: acc, from, to } }); setData(r.success ? r : null); if (!r.success) toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [acc, from, to, toast]);

    return (
        <div className="space-y-4">
            <Card className="p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الحساب</label>
                    <AccountCombobox
                        accounts={postable}
                        value={acc}
                        onChange={setAcc}
                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">من</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">إلى</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm w-40 outline-none focus:border-[#c5a059]" />
                </div>
                <Btn color="gold" onClick={load}><Search size={14} /> عرض</Btn>
            </Card>

            {loading ? <Spinner /> : !data ? <Empty msg="اختر حساباً واضغط عرض" /> : (
                <Card>
                    <div className="px-4 py-3 bg-slate-50 dark:bg-brand-800/40 border-b border-slate-100 dark:border-brand-700 flex justify-between items-center gap-3 flex-wrap">
                        <span className="font-black text-brand-800 dark:text-brand-100">{data.account.code} · {data.account.name}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 dark:text-brand-400">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(data.opening)}</span></span>
                            <Btn color="gray" size="sm" onClick={() => {
                                const rows = data.data.map(r =>
                                    `<tr><td dir="ltr">${r.entry_no}</td><td>${r.date}</td><td>${r.line_desc || r.ent_desc || '—'}</td><td class="amount">${r.debit ? money(r.debit) : ''}</td><td class="amount">${r.credit ? money(r.credit) : ''}</td><td class="amount" style="font-weight:800">${money(r.balance)}</td></tr>`
                                ).join('');
                                const tot = `<tr class="total-row"><td colspan="3">الإجمالي</td><td class="amount">${money(data.totals.debit)}</td><td class="amount">${money(data.totals.credit)}</td><td class="amount">${money(data.totals.closing)}</td></tr>`;
                                printHtml(`كشف حساب: ${data.account.code} · ${data.account.name}`,
                                    `<h1>كشف حساب: ${data.account.name}</h1><h2>الفترة: ${from} — ${to} | رصيد افتتاحي: ${money(data.opening)} ﷼</h2><table><thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th style="text-align:left">مدين</th><th style="text-align:left">دائن</th><th style="text-align:left">الرصيد</th></tr></thead><tbody>${rows}${tot}</tbody></table>`
                                );
                            }}>
                                <Printer size={14} /> طباعة
                            </Btn>
                            <Btn color="gray" size="sm" onClick={() => downloadCSV(`ledger_${data.account.code}.csv`,
                                ['القيد', 'التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
                                data.data.map(r => [r.entry_no, r.date, r.line_desc || r.ent_desc || '', r.debit || '', r.credit || '', r.balance]))}>
                                <Download size={14} /> تصدير
                            </Btn>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr><th className="px-3 py-3 font-bold">القيد</th><th className="px-3 py-3 font-bold">التاريخ</th>
                                    <th className="px-3 py-3 font-bold">البيان</th><th className="px-3 py-3 font-bold text-left">مدين</th>
                                    <th className="px-3 py-3 font-bold text-left">دائن</th><th className="px-3 py-3 font-bold text-left">الرصيد</th></tr>
                            </thead>
                            <tbody>
                                {data.data.map((r, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                        <td className="px-3 py-2.5 font-mono text-xs">{r.entry_id ? <EntityLink to={`entry/${r.entry_id}`} muted title="تفاصيل القيد">{r.entry_no}</EntityLink> : <span className="text-slate-400 dark:text-brand-500">{r.entry_no}</span>}</td>
                                        <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300">{r.date}</td>
                                        <td className="px-3 py-2.5 text-slate-700 dark:text-brand-300">{r.line_desc || r.ent_desc || '—'}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
                                    <td className="px-3 py-3" colSpan={3}>الإجمالي</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.debit)}</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.credit)}</td>
                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(data.totals.closing)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 7: إقرار ضريبة القيمة المضافة
// ════════════════════════════════════════════════════════════════════════════
function VatTab({ toast }) {
    const [from, setFrom] = useState(yearStart());
    const [to, setTo] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_vat_report', { params: { from, to } }); setData(r.success ? r : null); if (!r.success) toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [from, to, toast]);
    useEffect(() => { load(); }, []); // eslint-disable-line

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <PeriodBar from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
                {data && (
                    <div className="flex gap-2">
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('vat_return.csv',
                            ['البيان', 'المبلغ'],
                            [
                                ['ضريبة المخرجات (المبيعات) — ح/ 2102', data.output_vat],
                                ['ضريبة المدخلات (المشتريات) — ح/ 1401', data.input_vat],
                                ['صافي الضريبة المستحقة', data.net_payable],
                            ])}>
                            <Download size={14} /> تصدير
                        </Btn>
                        <Btn color="gray" size="sm" onClick={() => printHtml('إقرار ضريبة القيمة المضافة',`
                            <h1>إقرار ضريبة القيمة المضافة</h1><h2>من ${from} إلى ${to}</h2>
                            <table><thead><tr><th>البيان</th><th style="text-align:left">المبلغ</th></tr></thead><tbody>
                            <tr><td>ضريبة المخرجات (المبيعات) — ح/ 2102</td><td class="amount">${money(data.output_vat)} ﷼</td></tr>
                            <tr><td>ضريبة المدخلات (المشتريات) — ح/ 1401</td><td class="amount">${money(data.input_vat)} ﷼</td></tr>
                            <tr class="total-row"><td>الفرق (ضريبة قابلة للاسترداد)</td><td class="amount">${money(data.input_vat)} ﷼</td></tr>
                            <tr class="net-row"><td>صافي الضريبة المستحقة للهيئة</td><td class="amount">${money(data.net_payable)} ﷼</td></tr>
                            </tbody></table>`)}>
                            <Printer size={14} /> طباعة
                        </Btn>
                    </div>
                )}
            </div>
            {loading ? <Spinner /> : !data ? <Empty /> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-5 text-center">
                        <p className="text-sm font-bold text-slate-500 dark:text-brand-400 mb-2">ضريبة المخرجات (المبيعات)</p>
                        <p className="text-2xl font-black text-emerald-700 tabular-nums" dir="ltr">{money(data.output_vat)}</p>
                        <p className="text-xs text-slate-400 dark:text-brand-500 mt-1">ح/ {data.accounts?.output?.code || '2102'}</p>
                    </Card>
                    <Card className="p-5 text-center">
                        <p className="text-sm font-bold text-slate-500 dark:text-brand-400 mb-2">ضريبة المدخلات (المشتريات)</p>
                        <p className="text-2xl font-black text-blue-700 tabular-nums" dir="ltr">{money(data.input_vat)}</p>
                        <p className="text-xs text-slate-400 dark:text-brand-500 mt-1">ح/ {data.accounts?.input?.code || '1401'}</p>
                    </Card>
                    <Card className="p-5 text-center bg-brand-800 text-white">
                        <p className="text-sm font-bold text-white/70 mb-2">صافي الضريبة المستحقة</p>
                        <p className="text-2xl font-black tabular-nums" dir="ltr">{money(data.net_payable)} ﷼</p>
                        <p className="text-xs text-white/50 mt-1">{data.net_payable < 0 ? 'قابلة للاسترداد' : 'مستحقة للهيئة'}</p>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 8: الأطراف (عملاء/موردون) + كشف حساب + أعمار الذمم
// ════════════════════════════════════════════════════════════════════════════
function PartiesTab({ parties, reload, loading, toast }) {
    const [tab, setTab] = useState('list'); // list | aging
    const [type, setType] = useState('customer');
    const [editing, setEditing] = useState(null);
    const [ledger, setLedger] = useState(null);
    const [ledgerFrom, setLedgerFrom] = useState('');
    const [ledgerTo,   setLedgerTo]   = useState('');
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [aging, setAging] = useState(null);
    const [agingLoading, setAgingLoading] = useState(false);

    const blank = { type: 'customer', name: '', vat_number: '', cr_number: '', phone: '', email: '', address: '' };
    const filtered = parties.filter(p => p.type === type);

    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب', 'error'); return; }
        try {
            const r = await api('gl_party_save', { method: 'POST', body: { ...editing, id: editing.id || 0 } });
            if (r.success) { toast('تم الحفظ'); setEditing(null); reload(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const del = async (id) => {
        if (!window.confirm('حذف هذا الطرف؟')) return;
        try { const r = await api('gl_party_delete', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); reload(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };
    const openLedger = async (p, fr, to) => {
        setLedgerLoading(true);
        try {
            const params = { party_id: p ? p.id : (ledger?.party?.id) };
            if (fr) params.from = fr; else if (ledgerFrom) params.from = ledgerFrom;
            if (to) params.to   = to; else if (ledgerTo)   params.to   = ledgerTo;
            const r = await api('gl_party_ledger', { params });
            if (r.success) setLedger(r); else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setLedgerLoading(false); }
    };
    const loadAging = async () => {
        setAgingLoading(true);
        try { const r = await api('gl_aging', { params: { party_type: type, as_of: todayISO() } }); setAging(r); }
        catch (e) { toast(e.message, 'error'); } finally { setAgingLoading(false); }
    };
    useEffect(() => { if (tab === 'aging') loadAging(); }, [tab, type]); // eslint-disable-line

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                    <button onClick={() => setType('customer')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'customer' ? 'bg-brand-800 text-white' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>العملاء</button>
                    <button onClick={() => setType('supplier')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${type === 'supplier' ? 'bg-brand-800 text-white' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>الموردون</button>
                    <div className="w-px bg-slate-200 mx-1" />
                    <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'list' ? 'bg-amber-50 text-gold-500 border border-[#c5a059]' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>القائمة</button>
                    <button onClick={() => setTab('aging')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === 'aging' ? 'bg-amber-50 text-gold-500 border border-[#c5a059]' : 'bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 dark:text-brand-300'}`}>أعمار الذمم</button>
                </div>
                {tab === 'list' && <Btn color="green" onClick={() => setEditing({ ...blank, type })}><Plus size={15} /> طرف جديد</Btn>}
                {tab === 'aging' && aging && aging.data.length > 0 && (
                    <div className="flex gap-2">
                        <Btn color="gray" size="sm" onClick={() => {
                            const label = type === 'customer' ? 'ذمم العملاء' : 'ذمم الموردين';
                            const rows = aging.data.map(r =>
                                `<tr><td>${r.name}</td><td class="amount">${r.current}</td><td class="amount">${r.d30}</td><td class="amount">${r.d60}</td><td class="amount" style="color:#b45309">${r.d90}</td><td class="amount" style="color:#e11d48;font-weight:700">${r.d90p}</td><td class="amount" style="font-weight:900">${r.total}</td></tr>`
                            ).join('');
                            const totRow = `<tr class="total-row"><td>الإجمالي</td><td class="amount">${money(aging.totals.current)}</td><td class="amount">${money(aging.totals.d30)}</td><td class="amount">${money(aging.totals.d60)}</td><td class="amount">${money(aging.totals.d90)}</td><td class="amount">${money(aging.totals.d90p)}</td><td class="amount">${money(aging.totals.total)}</td></tr>`;
                            printHtml(label, `<h1>${label}</h1><h2>تاريخ التقرير: ${todayISO()}</h2><table><thead><tr><th>الطرف</th><th style="text-align:left">جارٍ</th><th style="text-align:left">1-30 يوم</th><th style="text-align:left">31-60</th><th style="text-align:left">61-90</th><th style="text-align:left">+90</th><th style="text-align:left">الإجمالي</th></tr></thead><tbody>${rows}${totRow}</tbody></table>`);
                        }}>
                            <Printer size={14} /> طباعة
                        </Btn>
                        <Btn color="gray" size="sm" onClick={() => downloadCSV(`aging_${type}.csv`,
                            ['الطرف', 'جارٍ', '1-30 يوم', '31-60 يوم', '61-90 يوم', '+90 يوم', 'الإجمالي'],
                            [
                                ...aging.data.map(r => [r.name, r.current, r.d30, r.d60, r.d90, r.d90p, r.total]),
                                ['الإجمالي', aging.totals.current, aging.totals.d30, aging.totals.d60, aging.totals.d90, aging.totals.d90p, aging.totals.total],
                            ])}>
                            <Download size={14} /> تصدير
                        </Btn>
                    </div>
                )}
            </div>

            {tab === 'list' ? (
                loading ? <Spinner /> : filtered.length === 0 ? <Empty msg={type === 'customer' ? 'لا يوجد عملاء' : 'لا يوجد موردون'} /> : (
                    <Card>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr>
                                    <th className="px-3 py-3 font-bold">الاسم</th>
                                    <th className="px-3 py-3 font-bold">الرقم الضريبي</th>
                                    <th className="px-3 py-3 font-bold">الجوال</th>
                                    <th className="px-3 py-3 font-bold text-left">{type === 'customer' ? 'الذمم المستحقة' : 'المستحق للمورد'}</th>
                                    <th className="px-3 py-3 font-bold text-center w-32">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => {
                                    const bal = Number(p.open_balance || 0);
                                    const cnt = Number(p.open_invoices || 0);
                                    return (
                                        <tr key={p.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-bold"><EntityLink to={`parties/${p.id}`} title="كشف حساب الطرف">{p.name}</EntityLink></td>
                                            <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-brand-400">{p.vat_number || '—'}</td>
                                            <td className="px-3 py-2.5 text-slate-600 dark:text-brand-300" dir="ltr">{p.phone || '—'}</td>
                                            <td className="px-3 py-2.5 text-left">
                                                {bal > 0.01
                                                    ? <span className="inline-flex items-center gap-1.5">
                                                        <span className="font-black tabular-nums text-amber-700 dark:text-amber-400" dir="ltr">{money(bal)} ﷼</span>
                                                        {cnt > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">{cnt} فاتورة</span>}
                                                      </span>
                                                    : <span className="text-slate-300 dark:text-brand-700 text-xs font-bold">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => openLedger(p)} title="كشف حساب" className="text-slate-400 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-300"><FileText size={15} /></button>
                                                    <button onClick={() => setEditing({ id: p.id, type: p.type, name: p.name, vat_number: p.vat_number || '', cr_number: p.cr_number || '', phone: p.phone || '', email: p.email || '', address: p.address || '' })} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                                    <button onClick={() => del(p.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </Card>
                )
            ) : (
                agingLoading ? <Spinner /> : !aging || aging.data.length === 0 ? <Empty msg="لا توجد أرصدة" /> : (<>
                    {/* شريط الملخص */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'الإجمالي', val: aging.totals.total, cls: 'text-brand-800 dark:text-brand-100' },
                            { label: 'جارٍ (غير متأخر)', val: aging.totals.current, cls: 'text-emerald-700 dark:text-emerald-400' },
                            { label: 'متأخر 1-60 يوم', val: (aging.totals.d30||0)+(aging.totals.d60||0), cls: 'text-amber-600 dark:text-amber-400' },
                            { label: 'متأخر +60 يوم', val: (aging.totals.d90||0)+(aging.totals.d90p||0), cls: 'text-rose-600 dark:text-rose-400 font-black' },
                        ].map(({ label, val, cls }) => (
                            <div key={label} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 px-4 py-3 shadow-sm">
                                <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{label}</div>
                                <div className={`text-lg font-black tabular-nums ${cls}`} dir="ltr">{money(val)}</div>
                            </div>
                        ))}
                    </div>
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                    <tr><th className="px-3 py-3 font-bold">الطرف</th><th className="px-3 py-3 font-bold text-left">جارٍ</th>
                                        <th className="px-3 py-3 font-bold text-left">1-30</th><th className="px-3 py-3 font-bold text-left">31-60</th>
                                        <th className="px-3 py-3 font-bold text-left">61-90</th><th className="px-3 py-3 font-bold text-left">+90</th>
                                        <th className="px-3 py-3 font-bold text-left">الإجمالي</th></tr>
                                </thead>
                                <tbody>
                                    {aging.data.map(r => (
                                        <tr key={r.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                            <td className="px-3 py-2.5 font-bold"><EntityLink to={`parties/${r.id}`} title="كشف حساب الطرف">{r.name}</EntityLink></td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.current)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d30)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums" dir="ltr">{money(r.d60)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-amber-700" dir="ltr">{money(r.d90)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums text-rose-700 font-bold" dir="ltr">{money(r.d90p)}</td>
                                            <td className="px-3 py-2.5 text-left tabular-nums font-black text-brand-800 dark:text-brand-100" dir="ltr">{money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
                                        <td className="px-3 py-3">الإجمالي</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.current)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d30)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d60)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d90)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.d90p)}</td>
                                        <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(aging.totals.total)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                </>)
            )}

            {/* نموذج طرف */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل طرف' : 'طرف جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">النوع</label>
                                    <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        <option value="customer">عميل</option><option value="supplier">مورد</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الجوال</label>
                                    <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الرقم الضريبي</label>
                                    <input value={editing.vat_number} onChange={e => setEditing({ ...editing, vat_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">السجل التجاري</label>
                                    <input value={editing.cr_number} onChange={e => setEditing({ ...editing, cr_number: e.target.value })} dir="ltr"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">البريد الإلكتروني</label>
                                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} dir="ltr"
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* كشف حساب طرف */}
            {ledger && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setLedger(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="space-y-3 mb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">كشف حساب: {ledger.party.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-brand-400">رصيد افتتاحي: <span className="font-bold tabular-nums" dir="ltr">{money(ledger.opening)}</span></p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {ledger.data.length > 0 && (<>
                                        <Btn color="gray" size="sm" onClick={() => {
                                            const rows = ledger.data.map(r =>
                                                `<tr><td dir="ltr">${r.entry_no}</td><td>${r.date}</td><td>${r.line_desc || r.ent_desc || '—'}</td><td class="amount">${r.debit ? money(r.debit) : ''}</td><td class="amount">${r.credit ? money(r.credit) : ''}</td><td class="amount" style="font-weight:800">${money(r.balance)}</td></tr>`
                                            ).join('');
                                            const totRow = `<tr class="total-row"><td colspan="5">الرصيد الختامي</td><td class="amount">${money(ledger.totals.closing)}</td></tr>`;
                                            printHtml(`كشف حساب: ${ledger.party.name}`,`<h1>كشف حساب: ${ledger.party.name}</h1><h2>رصيد افتتاحي: ${money(ledger.opening)} ﷼</h2><table><thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th style="text-align:left">مدين</th><th style="text-align:left">دائن</th><th style="text-align:left">الرصيد</th></tr></thead><tbody>${rows}${totRow}</tbody></table>`);
                                        }}>
                                            <Printer size={13} /> طباعة
                                        </Btn>
                                        <Btn color="gray" size="sm" onClick={() => downloadCSV(
                                            `party_${ledger.party.name}.csv`,
                                            ['القيد', 'التاريخ', 'البيان', 'مدين', 'دائن', 'الرصيد'],
                                            ledger.data.map(r => [r.entry_no, r.date, r.line_desc || r.ent_desc || '', r.debit || '', r.credit || '', r.balance]))}>
                                            <Download size={13} /> تصدير
                                        </Btn>
                                    </>)}
                                    <button onClick={() => setLedger(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                                </div>
                            </div>
                            {/* فلتر التاريخ */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] w-32" />
                                <span className="text-xs text-slate-400">—</span>
                                <input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059] w-32" />
                                <Btn color="gold" size="sm" onClick={() => openLedger(null, ledgerFrom, ledgerTo)}>
                                    {ledgerLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />} عرض
                                </Btn>
                                {(ledgerFrom || ledgerTo) && (
                                    <button onClick={() => { setLedgerFrom(''); setLedgerTo(''); openLedger(null, '', ''); }}
                                        className="text-xs text-slate-400 hover:text-red-500 font-bold px-1" title="مسح الفلتر">✕ كل التواريخ</button>
                                )}
                            </div>
                        </div>
                        {ledger.data.length === 0 ? <Empty msg="لا توجد حركات" /> : (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-100 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs">
                                    <tr><th className="px-3 py-2 font-bold">القيد</th><th className="px-3 py-2 font-bold">التاريخ</th>
                                        <th className="px-3 py-2 font-bold">البيان</th>
                                        <th className="px-3 py-2 font-bold text-left">مدين</th><th className="px-3 py-2 font-bold text-left">دائن</th>
                                        <th className="px-3 py-2 font-bold text-left">الرصيد</th></tr>
                                </thead>
                                <tbody>
                                    {ledger.data.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-brand-700">
                                            <td className="px-3 py-2 font-mono text-xs"><EntityLink to={`entry/${r.entry_id}`} muted title="تفاصيل القيد">{r.entry_no}</EntityLink></td>
                                            <td className="px-3 py-2 text-slate-600 dark:text-brand-300 whitespace-nowrap" dir="ltr">{r.date}</td>
                                            <td className="px-3 py-2 text-slate-500 dark:text-brand-400 text-xs max-w-[180px] truncate">{r.line_desc || r.ent_desc || '—'}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.debit) ? money(r.debit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{Number(r.credit) ? money(r.credit) : ''}</td>
                                            <td className="px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{money(r.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100">
                                        <td className="px-3 py-2" colSpan={5}>الرصيد الختامي</td>
                                        <td className="px-3 py-2 text-left tabular-nums" dir="ltr">{money(ledger.totals.closing)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب 9: مراكز التكلفة
// ════════════════════════════════════════════════════════════════════════════
function CostCentersTab({ costCenters, reload, loading, toast }) {
    const [sub, setSub]         = useState('list');   // 'list' | 'report'
    const [editing, setEditing] = useState(null);

    // ── تقرير الأرباح والخسائر بمركز التكلفة ──
    const [rpFrom,    setRpFrom]    = useState(yearStart());
    const [rpTo,      setRpTo]      = useState(todayISO());
    const [rpData,    setRpData]    = useState(null);
    const [rpLoading, setRpLoading] = useState(false);

    const loadReport = useCallback(async () => {
        setRpLoading(true);
        try {
            const r = await api('gl_cc_report', { params: { from: rpFrom, to: rpTo } });
            if (r.success) setRpData(r); else toast(r.message || 'تعذّر جلب التقرير', 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setRpLoading(false); }
    }, [rpFrom, rpTo]);

    const exportRpCSV = () => {
        if (!rpData) return;
        downloadCSV(
            `cc_report_${rpFrom}_${rpTo}.csv`,
            ['مركز التكلفة', 'الكود', 'الإيرادات', 'المصروفات', 'الصافي'],
            [
                ...rpData.data.map(r => [r.name, r.code || '', r.revenue, r.expense, r.net]),
                ['الإجمالي', '', rpData.totals.revenue, rpData.totals.expense, rpData.totals.net],
            ]
        );
    };

    const printReport = () => {
        if (!rpData) return;
        const rows = rpData.data.map(r => `
            <tr>
                <td>${r.code || '—'}</td><td>${r.name}</td>
                <td class="amount">${money(r.revenue)}</td>
                <td class="amount">${money(r.expense)}</td>
                <td class="amount ${r.net >= 0 ? '' : 'text-rose-700'}">${money(r.net)}</td>
            </tr>`).join('');
        const t = rpData.totals;
        printHtml(`تقرير مراكز التكلفة — ${rpFrom} : ${rpTo}`,
            `<h1>تقرير الأرباح والخسائر — مراكز التكلفة</h1>
            <h2>الفترة: ${rpFrom} – ${rpTo}</h2>
            <table>
                <thead><tr><th>الكود</th><th>مركز التكلفة</th><th>الإيرادات</th><th>المصروفات</th><th>الصافي</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2">الإجمالي</td>
                        <td class="amount">${money(t.revenue)}</td>
                        <td class="amount">${money(t.expense)}</td>
                        <td class="amount">${money(t.net)}</td>
                    </tr>
                </tfoot>
            </table>`
        );
    };

    const blank = { code: '', name: '', parent_id: '' };
    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب', 'error'); return; }
        try {
            const r = await api('gl_cost_center_save', { method: 'POST', body: { ...editing, id: editing.id || 0 } });
            if (r.success) { toast('تم الحفظ'); setEditing(null); reload(); } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    return (
        <div className="space-y-4">
            {/* تبويبات فرعية */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-brand-700 pb-0">
                {[
                    { id: 'list',   label: 'المراكز',       icon: <Layers size={14} /> },
                    { id: 'report', label: 'قائمة الأرباح', icon: <TrendingUp size={14} /> },
                ].map(s => (
                    <button key={s.id} onClick={() => setSub(s.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-t-xl border-b-2 transition
                            ${sub === s.id
                                ? 'border-[#c5a059] text-[#c5a059]'
                                : 'border-transparent text-slate-500 dark:text-brand-400 hover:text-[#c5a059]'}`}>
                        {s.icon}{s.label}
                    </button>
                ))}
            </div>

            {/* ── قائمة المراكز ── */}
            {sub === 'list' && (<>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-brand-400">{costCenters.length} مركز</span>
                    <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> مركز جديد</Btn>
                </div>
                {loading ? <Spinner /> : costCenters.length === 0 ? <Empty msg="لا توجد مراكز تكلفة" /> : (
                    <Card>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr><th className="px-3 py-3 font-bold">الكود</th><th className="px-3 py-3 font-bold">الاسم</th><th className="px-3 py-3 font-bold text-center w-16">تعديل</th></tr>
                            </thead>
                            <tbody>
                                {costCenters.map(c => (
                                    <tr key={c.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                        <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-brand-400">{c.code || '—'}</td>
                                        <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-brand-300">{c.name}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <button onClick={() => setEditing({ id: c.id, code: c.code || '', name: c.name, parent_id: c.parent_id || '' })}
                                                className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}
            </>)}

            {/* ── تقرير الأرباح والخسائر ── */}
            {sub === 'report' && (
                <div className="space-y-4">
                    {/* شريط الفلتر */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من تاريخ</label>
                            <input type="date" value={rpFrom} onChange={e => setRpFrom(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى تاريخ</label>
                            <input type="date" value={rpTo} onChange={e => setRpTo(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <Btn color="navy" onClick={loadReport} disabled={rpLoading}>
                            {rpLoading ? <Loader2 size={14} className="animate-spin" /> : <FileBarChart2 size={14} />}
                            {rpLoading ? 'جارٍ التحميل…' : 'توليد التقرير'}
                        </Btn>
                        {rpData && (<>
                            <Btn color="gray" size="sm" onClick={exportRpCSV}><Download size={13} /> CSV</Btn>
                            <Btn color="gray" size="sm" onClick={printReport}><Printer size={13} /> طباعة</Btn>
                        </>)}
                    </div>

                    {rpLoading ? <Spinner /> : !rpData ? (
                        <div className="text-center py-16 text-slate-300 dark:text-brand-600 font-bold text-sm">
                            اختر الفترة ثم اضغط «توليد التقرير»
                        </div>
                    ) : rpData.data.length === 0 ? <Empty msg="لا توجد حركات في هذه الفترة" /> : (<>
                        {/* بطاقات ملخص */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'إجمالي الإيرادات', val: rpData.totals.revenue, cls: 'text-emerald-700 dark:text-emerald-400' },
                                { label: 'إجمالي المصروفات', val: rpData.totals.expense, cls: 'text-rose-600 dark:text-rose-400' },
                                { label: 'صافي الربح / الخسارة', val: rpData.totals.net,
                                  cls: rpData.totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 font-black' },
                            ].map(c => (
                                <div key={c.label} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 px-4 py-3 shadow-sm">
                                    <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                    <div className={`text-xl font-black tabular-nums ${c.cls}`} dir="ltr">{money(c.val)}</div>
                                </div>
                            ))}
                        </div>

                        {/* جدول التفاصيل */}
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                        <tr>
                                            <th className="px-3 py-3 font-bold text-right">مركز التكلفة</th>
                                            <th className="px-3 py-3 font-bold text-left">الإيرادات</th>
                                            <th className="px-3 py-3 font-bold text-left">المصروفات</th>
                                            <th className="px-3 py-3 font-bold text-left">الصافي</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rpData.data.map(r => (
                                            <tr key={r.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                                <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-brand-300">
                                                    {r.name}
                                                    {r.code && <span className="mr-2 text-[11px] font-mono text-slate-400 dark:text-brand-500">{r.code}</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-left tabular-nums text-emerald-700 dark:text-emerald-400 font-bold" dir="ltr">
                                                    {r.revenue > 0 ? money(r.revenue) : <span className="text-slate-300 dark:text-brand-600">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-left tabular-nums text-rose-600 dark:text-rose-400 font-bold" dir="ltr">
                                                    {r.expense > 0 ? money(r.expense) : <span className="text-slate-300 dark:text-brand-600">—</span>}
                                                </td>
                                                <td className={`px-3 py-2.5 text-left tabular-nums font-black ${r.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                                                    {money(r.net)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 dark:bg-brand-800/60 font-black border-t-2 border-slate-200 dark:border-brand-700">
                                            <td className="px-3 py-3 text-brand-800 dark:text-brand-100">الإجمالي</td>
                                            <td className="px-3 py-3 text-left tabular-nums text-emerald-700 dark:text-emerald-400" dir="ltr">{money(rpData.totals.revenue)}</td>
                                            <td className="px-3 py-3 text-left tabular-nums text-rose-600 dark:text-rose-400" dir="ltr">{money(rpData.totals.expense)}</td>
                                            <td className={`px-3 py-3 text-left tabular-nums ${rpData.totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">{money(rpData.totals.net)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>
                    </>)}
                </div>
            )}

            {/* مودال التعديل */}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل مركز' : 'مركز تكلفة جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 dark:text-brand-500 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الكود (اختياري)</label>
                                <input value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم</label>
                                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  كتالوج المنتجات والخدمات
// ════════════════════════════════════════════════════════════════════════════
function ProductsTab({ products, reload, loading, toast }) {
    const [editing, setEditing] = useState(null);
    const [search, setSearch]   = useState('');
    const [plProduct, setPlProduct]   = useState(null);    // product being viewed in ledger
    const [plData,    setPlData]      = useState(null);
    const [plLoading, setPlLoading]   = useState(false);
    const [plFrom,    setPlFrom]      = useState('');
    const [plTo,      setPlTo]        = useState('');

    const blank = { code: '', name: '', unit: 'قطعة', unit_price: 0, buy_price: 0, tax_rate: 15, description: '' };

    const openProductLedger = async (prod, fr, to) => {
        setPlProduct(prod); setPlData(null); setPlLoading(true);
        try {
            const params = { product_id: prod.id };
            if (fr !== undefined ? fr : plFrom) params.from = fr !== undefined ? fr : plFrom;
            if (to !== undefined ? to : plTo) params.to = to !== undefined ? to : plTo;
            const r = await api('gl_product_ledger', { params });
            if (r.success) setPlData(r); else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setPlLoading(false); }
    };

    if (plProduct) {
        const rows    = plData?.data || [];
        const totals  = plData?.totals || {};
        const opening = plData?.opening ?? 0;
        return (
            <div className="space-y-4 animate-fadeIn">
                {/* شريط التنقل */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setPlProduct(null); setPlData(null); }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059] transition">
                            <ArrowLeft size={15} /> قائمة الأصناف
                        </button>
                        <div>
                            <h3 className="text-base font-black text-brand-800 dark:text-brand-100">{plProduct.name}</h3>
                            <p className="text-xs text-slate-400 dark:text-brand-500 font-bold">{plProduct.code || 'بدون كود'} · {plProduct.unit || 'قطعة'}</p>
                        </div>
                    </div>
                    {plData && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
                                const header = ['التاريخ','الفاتورة','الطرف','وارد','منصرف','الرصيد'].map(esc).join(',');
                                const dataRows = rows.map(r => [esc(r.issue_date),esc(r.invoice_no),esc(r.party_label||''),esc(r.qty_in||''),esc(r.qty_out||''),esc(r.balance)].join(','));
                                const csv = '﻿' + [header,...dataRows].join('\r\n');
                                const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href=url; a.download=`stock_${plProduct.code||plProduct.name}.csv`;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                            }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition">
                                <Download size={15} /> CSV
                            </button>
                            <button onClick={() => {
                                const rowsHtml = rows.map(r =>
                                    `<tr><td>${r.issue_date}</td><td style="font-family:monospace">${r.invoice_no}</td><td>${r.party_label||'—'}</td>
                                    <td style="text-align:left;color:#059669">${r.qty_in||''}</td>
                                    <td style="text-align:left;color:#e11d48">${r.qty_out||''}</td>
                                    <td style="text-align:left;font-weight:700">${r.balance}</td></tr>`
                                ).join('');
                                printHtml(`حركة صنف: ${plProduct.name}`,
                                    `<h1>حركة صنف: ${plProduct.name}</h1><h2>الكود: ${plProduct.code||'—'} · الوحدة: ${plProduct.unit||'قطعة'}</h2>
                                    <table><thead><tr><th>التاريخ</th><th>الفاتورة</th><th>الطرف</th><th style="text-align:left">وارد</th><th style="text-align:left">منصرف</th><th style="text-align:left">الرصيد</th></tr></thead>
                                    <tbody>
                                    <tr><td colspan="3">رصيد افتتاحي</td><td></td><td></td><td style="text-align:left;font-weight:700">${opening}</td></tr>
                                    ${rowsHtml}
                                    </tbody>
                                    <tfoot><tr class="total-row"><td colspan="3">الإجمالي</td><td style="text-align:left;color:#059669">${totals.in||0}</td><td style="text-align:left;color:#e11d48">${totals.out||0}</td><td style="text-align:left">${totals.closing||0}</td></tr></tfoot>
                                    </table>`
                                );
                            }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-brand-800 text-white hover:bg-brand-900 transition">
                                <Printer size={15} /> طباعة
                            </button>
                        </div>
                    )}
                </div>

                {/* KPI حركة المخزون */}
                {plData && (() => {
                    const salesRev  = rows.filter(r => r.doc_type==='sales')   .reduce((s,r) => s+Number(r.line_total||0), 0);
                    const costOfGds = rows.filter(r => r.doc_type==='purchase').reduce((s,r) => s+Number(r.line_total||0), 0);
                    const margin    = salesRev - costOfGds;
                    const marginPct = salesRev > 0 ? (margin / salesRev * 100).toFixed(1) : null;
                    return (
                        <>
                            {/* صف المخزون */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'رصيد افتتاحي', val: opening, sub: plProduct.unit||'قطعة', cls: 'text-slate-600 dark:text-brand-300' },
                                    { label: 'إجمالي الوارد', val: totals.in??0, sub: plProduct.unit||'قطعة', cls: 'text-emerald-700 dark:text-emerald-400' },
                                    { label: 'إجمالي المنصرف', val: totals.out??0, sub: plProduct.unit||'قطعة', cls: 'text-rose-600 dark:text-rose-400' },
                                    { label: 'الرصيد الحالي', val: totals.closing??0, sub: plProduct.unit||'قطعة', cls: 'text-brand-800 dark:text-brand-100' },
                                ].map(c => (
                                    <div key={c.label} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm px-4 py-3">
                                        <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                        <div className={`text-xl font-black tabular-nums ${c.cls}`} dir="ltr">{c.val}</div>
                                        <div className="text-[11px] text-slate-400 dark:text-brand-600 mt-0.5">{c.sub}</div>
                                    </div>
                                ))}
                            </div>
                            {/* صف الربحية — يظهر فقط إذا وُجدت مبيعات */}
                            {salesRev > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'إجمالي المبيعات', val: salesRev,  cls: 'text-emerald-700 dark:text-emerald-400' },
                                        { label: 'تكلفة المشتريات', val: costOfGds, cls: 'text-rose-600 dark:text-rose-400' },
                                        { label: 'هامش الربح الإجمالي', val: margin, cls: margin >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400' },
                                        { label: '% هامش الربح', val: marginPct !== null ? `${marginPct}%` : '—', cls: Number(marginPct) >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400' },
                                    ].map((c, i) => (
                                        <div key={c.label} className={`rounded-2xl border shadow-sm px-4 py-3 ${i === 2 || i === 3 ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20' : 'bg-white dark:bg-brand-900 border-slate-100 dark:border-brand-700'}`}>
                                            <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                            <div className={`text-xl font-black tabular-nums ${c.cls}`} dir="ltr">{typeof c.val === 'number' ? `${money(c.val)} ﷼` : c.val}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* فلتر التاريخ */}
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من تاريخ</label>
                        <input type="date" value={plFrom} onChange={e => setPlFrom(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى تاريخ</label>
                        <input type="date" value={plTo} onChange={e => setPlTo(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <Btn color="navy" size="sm" onClick={() => openProductLedger(plProduct)}>
                        {plLoading ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} عرض
                    </Btn>
                    {(plFrom || plTo) && (
                        <button onClick={() => { setPlFrom(''); setPlTo(''); openProductLedger(plProduct, '', ''); }}
                            className="px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-rose-400 hover:text-rose-500 transition">مسح</button>
                    )}
                </div>

                {/* جدول الحركة */}
                {plLoading ? <Spinner /> : (
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-slate-400 dark:text-brand-500 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-3 px-3">التاريخ</th>
                                        <th className="text-right py-3 px-3">الفاتورة</th>
                                        <th className="text-right py-3 px-3">الطرف</th>
                                        <th className="text-left py-3 px-3 text-emerald-600 dark:text-emerald-400">وارد</th>
                                        <th className="text-left py-3 px-3 text-rose-600 dark:text-rose-400">منصرف</th>
                                        <th className="text-left py-3 px-3">الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-50 dark:border-brand-700 bg-amber-50/30 dark:bg-amber-500/10">
                                        <td className="py-2.5 px-3 text-slate-400 dark:text-brand-500 font-bold" colSpan={3}>رصيد افتتاحي</td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3 text-left font-black tabular-nums" dir="ltr">{opening}</td>
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-300 dark:text-brand-700 font-bold">لا توجد حركات{(plFrom||plTo)?' في هذه الفترة':''}</td></tr>
                                    ) : rows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold" dir="ltr">{r.issue_date}</td>
                                            <td className="py-2.5 px-3 font-mono text-[12px]">
                                                {r.invoice_id
                                                    ? <EntityLink to={`entry/${r.invoice_id}`} muted>{r.invoice_no}</EntityLink>
                                                    : <span className="text-slate-400 dark:text-brand-500">{r.invoice_no}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-brand-300 font-bold">
                                                {r.party_id
                                                    ? <EntityLink to={`parties/${r.party_id}`} muted>{r.party_label||'—'}</EntityLink>
                                                    : (r.party_label||'—')}
                                            </td>
                                            <td className="py-2.5 px-3 text-left font-bold text-emerald-700 dark:text-emerald-400 tabular-nums" dir="ltr">{r.qty_in ? r.qty_in : ''}</td>
                                            <td className="py-2.5 px-3 text-left font-bold text-rose-600 dark:text-rose-400 tabular-nums" dir="ltr">{r.qty_out ? r.qty_out : ''}</td>
                                            <td className="py-2.5 px-3 text-left font-black tabular-nums" dir="ltr">{r.balance}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {plData && rows.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-slate-200 dark:border-brand-700">
                                            <td className="py-3 px-3" colSpan={3}>الإجماليات</td>
                                            <td className="py-3 px-3 text-left text-emerald-700 dark:text-emerald-400 tabular-nums" dir="ltr">{totals.in??0}</td>
                                            <td className="py-3 px-3 text-left text-rose-600 dark:text-rose-400 tabular-nums" dir="ltr">{totals.out??0}</td>
                                            <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{totals.closing??0}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const save = async () => {
        if (!editing.name) { toast('الاسم مطلوب', 'error'); return; }
        try {
            const r = await api('acc_product_save', { method: 'POST', body: { ...editing, id: editing.id || 0 } });
            if (r.success) { toast(editing.id ? 'تم التحديث' : 'تمت الإضافة'); setEditing(null); reload(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const del = async (id) => {
        if (!window.confirm('حذف هذا الصنف؟')) return;
        try { const r = await api('acc_product_delete', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); reload(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    const filtered = products.filter(p => !search || p.name.includes(search) || (p.code||'').includes(search));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود…"
                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 pr-8 pl-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-brand-400">{products.length} صنف</span>
                    <Btn color="gray" size="sm" onClick={reload}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
                    <Btn color="green" onClick={() => setEditing({ ...blank })}><Plus size={15} /> صنف جديد</Btn>
                </div>
            </div>
            {loading ? <Spinner /> : filtered.length === 0 ? <Empty msg="لا توجد منتجات" /> : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                <tr>
                                    <th className="px-3 py-3 font-bold">الكود</th>
                                    <th className="px-3 py-3 font-bold">الاسم</th>
                                    <th className="px-3 py-3 font-bold">الوحدة</th>
                                    <th className="px-3 py-3 font-bold text-left">سعر البيع</th>
                                    <th className="px-3 py-3 font-bold text-left">سعر الشراء</th>
                                    <th className="px-3 py-3 font-bold text-center">ض.ق.م %</th>
                                    <th className="px-3 py-3 font-bold text-center w-20">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} className="border-b border-slate-100 dark:border-brand-700 hover:bg-slate-50/70 dark:hover:bg-brand-800">
                                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-brand-400">{p.code || '—'}</td>
                                        <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-brand-300">{p.name}</td>
                                        <td className="px-3 py-2.5 text-slate-600 dark:text-brand-400">{p.unit || '—'}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">{money(p.unit_price)}</td>
                                        <td className="px-3 py-2.5 text-left tabular-nums text-slate-500 dark:text-brand-400" dir="ltr">{money(p.buy_price)}</td>
                                        <td className="px-3 py-2.5 text-center">{p.tax_rate}%</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => openProductLedger(p)} title="حركة الصنف" className="text-slate-400 dark:text-brand-500 hover:text-indigo-600 dark:hover:text-indigo-400"><Eye size={15} /></button>
                                                <button onClick={() => setEditing({ id: p.id, code: p.code||'', name: p.name, unit: p.unit||'قطعة', unit_price: p.unit_price||0, buy_price: p.buy_price||0, tax_rate: p.tax_rate||15, description: p.description||'' })} title="تعديل" className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059]"><Edit2 size={15} /></button>
                                                <button onClick={() => del(p.id)} title="حذف" className="text-slate-400 dark:text-brand-500 hover:text-red-500"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
            {editing && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل صنف' : 'صنف جديد'}</h3>
                            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الكود (اختياري)</label>
                                    <input value={editing.code} onChange={e => setEditing({...editing,code:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm font-mono outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الوحدة</label>
                                    <input value={editing.unit} onChange={e => setEditing({...editing,unit:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الاسم <span className="text-rose-500">*</span></label>
                                <input value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">سعر البيع</label>
                                    <input type="number" step="0.01" value={editing.unit_price} onChange={e => setEditing({...editing,unit_price:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" dir="ltr" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">سعر الشراء</label>
                                    <input type="number" step="0.01" value={editing.buy_price} onChange={e => setEditing({...editing,buy_price:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" dir="ltr" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ض.ق.م %</label>
                                    <input type="number" step="0.001" value={editing.tax_rate} onChange={e => setEditing({...editing,tax_rate:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" dir="ltr" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">الوصف (اختياري)</label>
                                <input value={editing.description} onChange={e => setEditing({...editing,description:e.target.value})} className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Btn color="green" onClick={save}><Save size={15} /> حفظ</Btn>
                            <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
//  تبويبات المستندات (Phase 3): فواتير البيع/الشراء + سندات القبض/الصرف
// ════════════════════════════════════════════════════════════════════════════
const INV_STATUS = {
    draft:   { label: 'مسودة',           cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700' },
    posted:  { label: 'مُرحّلة',          cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
    partial: { label: 'مدفوعة جزئيًا',    cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
    paid:    { label: 'مدفوعة',           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
    void:    { label: 'ملغاة',            cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30' },
};
function StatusBadge({ status }) {
    const s = INV_STATUS[status] || INV_STATUS.draft;
    return <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold border ${s.cls}`}>{s.label}</span>;
}

function calcTotals(items) {
    let sub = 0, tax = 0;
    (items || []).forEach(it => {
        const net = Math.max(0, (Number(it.qty) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0));
        sub += net;
        tax += net * (Number(it.tax_rate) || 0) / 100;
    });
    const r = (n) => Math.round(n * 100) / 100;
    return { sub: r(sub), tax: r(tax), total: r(sub + tax) };
}

function InvoicesTab({ docType, parties, accounts, products = [], company = {}, toast }) {
    const isSales = docType === 'sales';
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [filterFrom,   setFilterFrom]   = useState('');
    const [filterTo,     setFilterTo]     = useState('');
    const [filterParty,  setFilterParty]  = useState('');
    const [quickPay,  setQuickPay]  = useState(null); // { id, invoice_no, party_id, party_label, balance_due }
    const [qpBusy,    setQpBusy]    = useState(false);
    const [qpForm,    setQpForm]    = useState({ amount: '', date: todayISO(), method: 'cash', notes: '' });
    const [waSending, setWaSending] = useState(null); // invoice id being sent via WhatsApp

    const partyOptions = useMemo(
        () => parties.filter(p => p.type === (isSales ? 'customer' : 'supplier')),
        [parties, isSales]);
    const acctOptions = useMemo(
        () => accounts.filter(a => Number(a.is_group) === 0 && (isSales ? a.type === 'revenue' : (a.type === 'expense' || a.type === 'asset'))),
        [accounts, isSales]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { doc_type: docType };
            if (statusFilter) params.status    = statusFilter;
            if (filterFrom)  params.from       = filterFrom;
            if (filterTo)    params.to         = filterTo;
            if (filterParty) params.party_id   = filterParty;
            const r = await api('inv_list', { params });
            setList(r.data || []);
        } catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [docType, statusFilter, filterFrom, filterTo, filterParty, toast]);
    useEffect(() => { load(); }, [load]);

    const blankItem = () => ({ description: '', qty: 1, unit_price: 0, discount: 0, tax_rate: 15 });
    const newInvoice = () => setEditing({
        doc_type: docType, invoice_type: 'standard', party_id: '', party_name: '',
        issue_date: todayISO(), due_date: '', gl_account_id: '', notes: '', items: [blankItem()],
    });

    const editDraft = async (id) => {
        try {
            const r = await api('inv_single', { params: { id } });
            if (!r.success) return toast(r.message, 'error');
            const inv = r.invoice;
            setEditing({
                id: inv.id, doc_type: docType, invoice_type: inv.invoice_type,
                party_id: inv.party_id || '', party_name: inv.party_name || '',
                issue_date: inv.issue_date, due_date: inv.due_date || '', gl_account_id: inv.gl_account_id || '',
                notes: inv.notes || '',
                items: (r.items || []).map(x => ({ description: x.description, qty: x.qty, unit_price: x.unit_price, discount: x.discount, tax_rate: x.tax_rate })),
            });
        } catch (e) { toast(e.message, 'error'); }
    };

    const saveDraft = async () => {
        const f = editing;
        if (!f.items.some(it => it.description && Number(it.qty))) return toast('أضف بندًا صالحًا على الأقل', 'error');
        try {
            const r = await api('inv_save', { method: 'POST', body: {
                id: f.id || 0, doc_type: docType, invoice_type: f.invoice_type,
                party_id: f.party_id || '', party_name: f.party_name || '',
                issue_date: f.issue_date, due_date: f.due_date || '', gl_account_id: f.gl_account_id || '',
                notes: f.notes || '', items: f.items,
            }});
            if (r.success) { toast(r.message || 'تم الحفظ'); setEditing(null); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };

    const act = async (action, id, confirmMsg) => {
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        try {
            const r = await api(action, { method: 'POST', body: { id } });
            if (r.success) { toast((r.message || 'تم') + (r.entry_no ? ' — ' + r.entry_no : '')); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const openView = async (id) => {
        try { const r = await api('inv_single', { params: { id } }); if (r.success) setViewing(r); else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    const sendWhatsApp = async (inv) => {
        setWaSending(inv.id);
        try {
            const r = await api('inv_whatsapp', { method: 'POST', body: { id: inv.id } });
            toast(r.message || (r.success ? 'تم الإرسال' : 'فشل الإرسال'), r.success ? 'success' : 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setWaSending(null); }
    };

    const submitQuickPay = async () => {
        if (!(Number(qpForm.amount) > 0)) return toast('أدخل مبلغًا صحيحًا', 'error');
        setQpBusy(true);
        try {
            const r = await api('pay_save', { method: 'POST', body: {
                pay_type: isSales ? 'receipt' : 'payment',
                party_id: quickPay.party_id || '',
                invoice_id: quickPay.id,
                date: qpForm.date,
                amount: Number(qpForm.amount),
                method: qpForm.method,
                notes: qpForm.notes || '',
            }});
            if (r.success) {
                toast((r.message || 'تم تسجيل الدفعة') + (r.pay_no ? ` — ${r.pay_no}` : ''), 'success');
                setQuickPay(null);
                load();
            } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setQpBusy(false); }
    };

    // طباعة فاتورة احترافية (مع رمز QR للزكاة إن وُجد) في نافذة منفصلة
    const printInvoice = () => {
        if (!viewing) return;
        const inv = viewing.invoice, items = viewing.items || [];
        const qrEl = document.querySelector('#zatca-qr-box svg');
        const qrSvg = qrEl ? qrEl.outerHTML : '';
        const w = window.open('', '_blank', 'width=820,height=1000');
        if (!w) { toast('فعّل النوافذ المنبثقة للطباعة', 'error'); return; }
        const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const rows = items.map(it => `<tr><td style="text-align:right">${esc(it.description)}</td><td>${it.qty}</td><td>${money(it.unit_price)}</td><td>${money(it.discount)}</td><td>${money(it.tax_amount)}</td><td style="text-align:left">${money(it.line_total)}</td></tr>`).join('');
        const docTitle = inv.doc_type === 'sales' ? (inv.invoice_type === 'simplified' ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية') : 'فاتورة مشتريات';
        w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(inv.invoice_no)}</title>
<style>
*{box-sizing:border-box} body{font-family:'Cairo','Segoe UI',Arial,sans-serif;color:#1a365d;margin:0;padding:36px;font-size:13px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c5a059;padding-bottom:16px;margin-bottom:18px}
.co{font-size:20px;font-weight:800} .muted{color:#64748b;font-size:12px;margin-top:3px}
.tag{display:inline-block;background:#1a365d;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700}
.meta{display:flex;gap:24px;margin:14px 0;flex-wrap:wrap} .meta div{font-size:12px}
table{width:100%;border-collapse:collapse;margin:14px 0} th,td{border:1px solid #e2e8f0;padding:8px;text-align:center}
th{background:#f8fafc;color:#475569;font-weight:700}
.totals{width:280px;margin-right:auto;margin-top:8px} .totals tr td{border:none;padding:4px 8px;text-align:left}
.grand{font-weight:800;font-size:15px;border-top:2px solid #1a365d!important}
.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px}
.qrbox{text-align:center} .qrbox svg{width:120px;height:120px}
@media print{body{padding:12px}}
</style></head><body>
<div class="head">
  <div><div class="co">${esc(company.company_name || 'سمك')}</div>
    ${company.vat_number ? `<div class="muted">الرقم الضريبي: ${esc(company.vat_number)}</div>` : ''}
    ${company.cr_number ? `<div class="muted">السجل التجاري: ${esc(company.cr_number)}</div>` : ''}
    ${company.city ? `<div class="muted">${esc([company.address, company.district, company.city].filter(Boolean).join('، '))}</div>` : ''}
  </div>
  <div style="text-align:left"><div class="tag">${docTitle}</div><div class="muted">رقم: <b>${esc(inv.invoice_no)}</b></div></div>
</div>
<div class="meta">
  <div><b>الطرف:</b> ${esc(inv.party_label || inv.party_name || '—')}</div>
  ${inv.party_vat ? `<div><b>الرقم الضريبي للطرف:</b> ${esc(inv.party_vat)}</div>` : ''}
  <div><b>التاريخ:</b> ${esc(inv.issue_date)}</div>
  ${inv.due_date ? `<div><b>الاستحقاق:</b> ${esc(inv.due_date)}</div>` : ''}
</div>
<table><thead><tr><th style="text-align:right">الوصف</th><th>كمية</th><th>سعر</th><th>خصم</th><th>ضريبة</th><th style="text-align:left">إجمالي</th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot">
  <div class="qrbox">${qrSvg}${inv.uuid ? `<div class="muted" style="margin-top:6px;font-size:10px">${esc(inv.uuid)}</div>` : ''}</div>
  <table class="totals">
    <tr><td>المجموع قبل الضريبة</td><td style="text-align:left">${money(inv.subtotal)}</td></tr>
    <tr><td>ضريبة القيمة المضافة (15%)</td><td style="text-align:left">${money(inv.tax_total)}</td></tr>
    <tr class="grand"><td>الإجمالي شامل الضريبة</td><td style="text-align:left">${money(inv.total)} ﷼</td></tr>
    <tr><td style="color:#059669">المدفوع</td><td style="text-align:left;color:#059669">${money(inv.paid)}</td></tr>
  </table>
</div>
</body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { try { w.print(); } catch (e) {} }, 350);
    };

    const t = editing ? calcTotals(editing.items) : null;
    const setItem = (i, key, val) => setEditing(e => ({ ...e, items: e.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }));

    return (
        <div className="space-y-4">
            {/* الإجراءات + الفلتر */}
            <div className="flex flex-wrap items-center gap-2">
                <Btn color="navy" onClick={newInvoice}><Plus size={15} /> {isSales ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة'}</Btn>
                <Btn color="gray" size="sm" onClick={load}><RefreshCw size={14} /> تحديث</Btn>
                <div className="w-px bg-slate-200 dark:bg-brand-700 h-7 mx-1" />
                {/* فلتر الطرف */}
                <div className="w-52">
                    <PartyCombobox
                        parties={partyOptions}
                        value={filterParty}
                        rawId
                        onChange={setFilterParty}
                        placeholder={isSales ? 'كل العملاء…' : 'كل الموردين…'}
                        className="[&_input]:py-1.5 [&_input]:text-xs"
                    />
                </div>
                {/* فلتر التاريخ */}
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="من تاريخ"
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="إلى تاريخ"
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                {/* فلتر الحالة */}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                    <option value="">كل الحالات</option>
                    {Object.keys(INV_STATUS).map(k => <option key={k} value={k}>{INV_STATUS[k].label}</option>)}
                </select>
                {(filterFrom || filterTo || filterParty || statusFilter) && (
                    <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterParty(''); setStatusFilter(''); }}
                        className="text-xs text-slate-400 dark:text-brand-500 hover:text-red-500 font-bold px-1" title="مسح الفلاتر">✕ مسح</button>
                )}
            </div>

            {/* قائمة الفواتير */}
            <Card>
                {!loading && list.length > 0 && (
                    <div className="px-4 pt-3 pb-1 flex items-center gap-3 border-b border-slate-100 dark:border-brand-700">
                        <span className="text-xs text-slate-400 dark:text-brand-500 font-bold">{list.length} فاتورة | الإجمالي: <span className="text-brand-800 dark:text-brand-200 tabular-nums" dir="ltr">{money(list.reduce((s,i)=>s+Number(i.total||0),0))}</span> ﷼</span>
                        <div className="flex-1" />
                        <Btn color="gray" size="sm" onClick={() => downloadCSV(`invoices_${docType}.csv`,
                            [isSales ? 'رقم الفاتورة' : 'رقم مستند الشراء', 'التاريخ', 'الاستحقاق', 'الطرف', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'المدفوع', 'الحالة'],
                            list.map(inv => [inv.invoice_no, inv.issue_date, inv.due_date||'', inv.party_label||inv.party_name||'', inv.subtotal||0, inv.tax_total||0, inv.total||0, inv.paid||0, INV_STATUS[inv.status]?.label||inv.status]))}>
                            <Download size={13} /> تصدير
                        </Btn>
                    </div>
                )}
                {loading ? <Spinner /> : list.length === 0 ? <Empty msg="لا توجد فواتير" /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                <tr>
                                    <th className="px-3 py-3 text-right font-bold">الرقم</th>
                                    <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                                    <th className="px-3 py-3 text-right font-bold">{isSales ? 'العميل' : 'المورد'}</th>
                                    <th className="px-3 py-3 text-left font-bold">الإجمالي</th>
                                    <th className="px-3 py-3 text-left font-bold">المدفوع</th>
                                    <th className="px-3 py-3 text-center font-bold">الحالة</th>
                                    <th className="px-3 py-3 text-center font-bold">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                {list.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:bg-brand-800/30 dark:hover:bg-brand-800">
                                        <td className="px-3 py-3 font-mono font-bold text-brand-800 dark:text-brand-300">{inv.invoice_no}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-brand-400">{inv.issue_date}</td>
                                        <td className="px-3 py-3">{inv.party_label || inv.party_name || '—'}</td>
                                        <td className="px-3 py-3 text-left font-bold">{money(inv.total)}</td>
                                        <td className="px-3 py-3 text-left text-emerald-600">{money(inv.paid)}</td>
                                        <td className="px-3 py-3 text-center"><StatusBadge status={inv.status} /></td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openView(inv.id)} title="عرض" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><Eye size={15} /></button>
                                                {inv.status === 'draft' && <button onClick={() => editDraft(inv.id)} title="تعديل" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={15} /></button>}
                                                {inv.status === 'draft' && <button onClick={() => act('inv_post', inv.id, `ترحيل ${inv.invoice_no} (${money(inv.total)} ﷼)؟\nبعد الترحيل لا يمكن التعديل — يلزم إلغاء وعكس القيد.`)} title="ترحيل" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><CheckCircle2 size={15} /></button>}
                                                {inv.status === 'draft' && <button onClick={() => act('inv_delete', inv.id, 'حذف المسودة؟')} title="حذف" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>}
                                                {(inv.status === 'posted' || inv.status === 'partial') && Number(inv.total) - Number(inv.paid) > 0.01 && (
                                                    <button onClick={() => {
                                                        const bal = Number(inv.total) - Number(inv.paid);
                                                        setQuickPay({ id: inv.id, invoice_no: inv.invoice_no, party_id: inv.party_id, party_label: inv.party_label || inv.party_name || '', balance_due: bal });
                                                        setQpForm({ amount: bal.toFixed(2), date: todayISO(), method: 'cash', notes: '' });
                                                    }} title={isSales ? 'تسجيل دفعة' : 'تسجيل سداد'}
                                                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                        <Wallet size={15} />
                                                    </button>
                                                )}
                                                {isSales && inv.party_phone && (inv.status === 'posted' || inv.status === 'partial') && (
                                                    <button onClick={() => sendWhatsApp(inv)} disabled={waSending === inv.id}
                                                        title="إرسال إشعار واتساب للعميل"
                                                        className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 text-green-600 dark:text-green-400 disabled:opacity-40">
                                                        {waSending === inv.id ? <RefreshCw size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                                                    </button>
                                                )}
                                                {(inv.status === 'posted') && <button onClick={() => act('inv_void', inv.id, 'إلغاء الفاتورة وعكس قيدها؟')} title="إلغاء" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><RotateCcw size={15} /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* محرّر الفاتورة */}
            {editing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-4xl my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.id ? 'تعديل مسودة' : (isSales ? 'فاتورة بيع جديدة' : 'فاتورة شراء جديدة')}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{isSales ? 'العميل' : 'المورد'}</label>
                                    <PartyCombobox
                                        parties={partyOptions}
                                        value={editing.party_id}
                                        rawId
                                        onChange={v => { const p = partyOptions.find(x => String(x.id) === v); setEditing(ed => ({ ...ed, party_id: v, party_name: p ? p.name : ed.party_name })); }}
                                        placeholder={isSales ? 'ابحث باسم العميل…' : 'ابحث باسم المورد…'}
                                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50 [&_input]:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">تاريخ الإصدار</label>
                                    <input type="date" value={editing.issue_date} onChange={e => setEditing(ed => ({ ...ed, issue_date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">تاريخ الاستحقاق</label>
                                    <input type="date" value={editing.due_date} onChange={e => setEditing(ed => ({ ...ed, due_date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{isSales ? 'حساب الإيراد' : 'حساب المصروف/المخزون'}</label>
                                    <AccountCombobox
                                        accounts={acctOptions}
                                        value={editing.gl_account_id}
                                        onChange={v => setEditing(ed => ({ ...ed, gl_account_id: v }))}
                                        placeholder={isSales ? 'افتراضي (إيرادات المبيعات)' : 'افتراضي (مصروفات تشغيلية)'}
                                        className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50"
                                    />
                                </div>
                                {isSales && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">نوع الفاتورة (ZATCA)</label>
                                        <select value={editing.invoice_type} onChange={e => setEditing(ed => ({ ...ed, invoice_type: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                            <option value="standard">ضريبية (B2B)</option>
                                            <option value="simplified">مبسطة (B2C)</option>
                                        </select>
                                    </div>
                                )}
                                <div className={isSales ? '' : 'md:col-span-1'}>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظات</label>
                                    <input type="text" value={editing.notes} onChange={e => setEditing(ed => ({ ...ed, notes: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>

                            {/* بنود الفاتورة */}
                            <div className="border border-slate-100 dark:border-brand-700 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                        <tr>
                                            {products.length > 0 && <th className="px-2 py-2 font-bold w-44">صنف سريع</th>}
                                            <th className="px-2 py-2 text-right font-bold">الوصف</th>
                                            <th className="px-2 py-2 font-bold w-20">الكمية</th>
                                            <th className="px-2 py-2 font-bold w-28">السعر</th>
                                            <th className="px-2 py-2 font-bold w-24">خصم</th>
                                            <th className="px-2 py-2 font-bold w-20">ضريبة%</th>
                                            <th className="px-2 py-2 font-bold w-28 text-left">الإجمالي</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editing.items.map((it, i) => {
                                            const net = Math.max(0, (Number(it.qty) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0));
                                            const lt = net + net * (Number(it.tax_rate) || 0) / 100;
                                            return (
                                                <tr key={i} className="border-t border-slate-50 dark:border-brand-700">
                                                    {products.length > 0 && (
                                                        <td className="px-2 py-1.5">
                                                            <ProductCombobox products={products} onSelect={p => {
                                                                setEditing(e => ({ ...e, items: e.items.map((it2, idx) => idx !== i ? it2 : {
                                                                    ...it2, description: p.name, unit_price: Number(p.unit_price)||0, tax_rate: Number(p.tax_rate)||15,
                                                                })}));
                                                            }} />
                                                        </td>
                                                    )}
                                                    <td className="px-2 py-1.5"><input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="وصف البند" className="w-full bg-transparent px-2 py-1.5 outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.discount} onChange={e => setItem(i, 'discount', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5"><input type="number" value={it.tax_rate} onChange={e => setItem(i, 'tax_rate', e.target.value)} className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-center outline-none" /></td>
                                                    <td className="px-2 py-1.5 text-left font-bold text-brand-800 dark:text-brand-100">{money(lt)}</td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        {editing.items.length > 1 && <button onClick={() => setEditing(e => ({ ...e, items: e.items.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="p-2 border-t border-slate-50 dark:border-brand-700">
                                    <Btn color="gray" size="sm" onClick={() => setEditing(e => ({ ...e, items: [...e.items, blankItem()] }))}><Plus size={14} /> إضافة بند</Btn>
                                </div>
                            </div>

                            {/* الإجماليات */}
                            <div className="flex justify-end">
                                <div className="w-full md:w-72 space-y-1.5 text-sm">
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>الإجمالي قبل الضريبة</span><span className="font-bold">{money(t.sub)}</span></div>
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>ضريبة القيمة المضافة</span><span className="font-bold">{money(t.tax)}</span></div>
                                    <div className="flex justify-between text-brand-800 dark:text-brand-100 text-base border-t border-slate-100 dark:border-brand-700 pt-1.5"><span className="font-black">الإجمالي</span><span className="font-black">{money(t.total)} ﷼</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30">
                            <Btn color="gray" onClick={() => setEditing(null)}><X size={15} /> إلغاء</Btn>
                            <Btn color="navy" onClick={saveDraft}><Save size={15} /> حفظ كمسودة</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* نافذة تسجيل دفعة سريعة */}
            {quickPay && (
                <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!qpBusy) setQuickPay(null); }}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <div>
                                <h3 className="text-base font-black text-brand-800 dark:text-brand-100">{isSales ? 'تسجيل دفعة مستلمة' : 'تسجيل سداد لمورد'}</h3>
                                <p className="text-xs font-bold text-slate-400 dark:text-brand-500 mt-0.5" dir="ltr">{quickPay.invoice_no} — {quickPay.party_label}</p>
                            </div>
                            <button onClick={() => setQuickPay(null)} disabled={qpBusy} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-800 text-slate-500 dark:text-brand-400 disabled:opacity-40"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-4 py-3 flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{isSales ? 'الرصيد المستحق التحصيل' : 'الرصيد المستحق السداد'}</span>
                                <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums" dir="ltr">{money(quickPay.balance_due)} ﷼</span>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">المبلغ</label>
                                <input type="number" step="0.01" min="0.01" value={qpForm.amount}
                                    onChange={e => setQpForm(f => ({ ...f, amount: e.target.value }))}
                                    autoFocus
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-3 py-2.5 rounded-xl text-sm outline-none focus:border-[#c5a059] tabular-nums" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ</label>
                                <input type="date" value={qpForm.date}
                                    onChange={e => setQpForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-3 py-2.5 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">وسيلة السداد</label>
                                <select value={qpForm.method} onChange={e => setQpForm(f => ({ ...f, method: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-3 py-2.5 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                    <option value="cash">نقداً — صندوق (1101)</option>
                                    <option value="bank">تحويل بنكي — بنك (1102)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظات (اختياري)</label>
                                <input type="text" value={qpForm.notes}
                                    onChange={e => setQpForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="تفاصيل إضافية…"
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-800 dark:border-brand-700 dark:text-brand-50 px-3 py-2.5 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30 rounded-b-2xl">
                            <Btn color="gray" onClick={() => setQuickPay(null)} disabled={qpBusy}><X size={15} /> إلغاء</Btn>
                            <Btn color="green" onClick={submitQuickPay} disabled={qpBusy || !(Number(qpForm.amount) > 0)}>
                                {qpBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                {isSales ? 'تأكيد الاستلام' : 'تأكيد السداد'}
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* عرض الفاتورة */}
            {viewing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setViewing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-2xl my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{viewing.invoice.invoice_no}</h3>
                            <div className="flex items-center gap-2">
                                <Btn color="navy" size="sm" onClick={printInvoice}><Printer size={14} /> طباعة</Btn>
                                <button onClick={() => setViewing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-brand-300">
                                <div><span className="text-slate-400 dark:text-brand-500">الطرف:</span> <b>{viewing.invoice.party_label || viewing.invoice.party_name || '—'}</b></div>
                                <div><span className="text-slate-400 dark:text-brand-500">الحالة:</span> <StatusBadge status={viewing.invoice.status} /></div>
                                <div><span className="text-slate-400 dark:text-brand-500">التاريخ:</span> {viewing.invoice.issue_date}</div>
                                <div><span className="text-slate-400 dark:text-brand-500">الاستحقاق:</span> {viewing.invoice.due_date || '—'}</div>
                                {viewing.invoice.party_vat && <div><span className="text-slate-400 dark:text-brand-500">الرقم الضريبي:</span> {viewing.invoice.party_vat}</div>}
                            </div>
                            <div className="border border-slate-100 dark:border-brand-700 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400"><tr><th className="px-2 py-2 text-right">الوصف</th><th className="px-2 py-2">كمية</th><th className="px-2 py-2">سعر</th><th className="px-2 py-2">ضريبة</th><th className="px-2 py-2 text-left">إجمالي</th></tr></thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                        {(viewing.items || []).map(it => (
                                            <tr key={it.id}><td className="px-2 py-2">{it.description}</td><td className="px-2 py-2 text-center">{it.qty}</td><td className="px-2 py-2 text-center">{money(it.unit_price)}</td><td className="px-2 py-2 text-center">{money(it.tax_amount)}</td><td className="px-2 py-2 text-left font-bold">{money(it.line_total)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end">
                                <div className="w-64 space-y-1">
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>قبل الضريبة</span><span>{money(viewing.invoice.subtotal)}</span></div>
                                    <div className="flex justify-between text-slate-500 dark:text-brand-400"><span>الضريبة</span><span>{money(viewing.invoice.tax_total)}</span></div>
                                    <div className="flex justify-between font-black text-brand-800 dark:text-brand-100"><span>الإجمالي</span><span>{money(viewing.invoice.total)} ﷼</span></div>
                                    <div className="flex justify-between text-emerald-600"><span>المدفوع</span><span>{money(viewing.invoice.paid)}</span></div>
                                    {Number(viewing.invoice.total) - Number(viewing.invoice.paid) > 0.01 && (
                                        <div className="flex justify-between font-black text-amber-600 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-brand-700">
                                            <span>الرصيد المستحق</span>
                                            <span dir="ltr">{money(Number(viewing.invoice.total) - Number(viewing.invoice.paid))} ﷼</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* سجل الدفعات */}
                            {viewing.payments?.length > 0 && (
                                <div className="border border-slate-100 dark:border-brand-700 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 dark:bg-brand-800/50 text-xs font-black text-slate-500 dark:text-brand-400 border-b border-slate-100 dark:border-brand-700">
                                        سجل الدفعات
                                    </div>
                                    <table className="w-full text-xs">
                                        <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                            {viewing.payments.map((p, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-brand-800/30">
                                                    <td className="px-3 py-2 font-mono font-bold text-slate-500 dark:text-brand-400" dir="ltr">{p.pay_no}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-brand-400" dir="ltr">{p.date}</td>
                                                    <td className="px-3 py-2 text-slate-500 dark:text-brand-400">{p.method === 'bank' ? 'بنك' : 'نقداً'}</td>
                                                    <td className="px-3 py-2 text-left font-black text-emerald-700 dark:text-emerald-400 tabular-nums" dir="ltr">{money(p.amount)} ﷼</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {viewing.invoice.entry_id && <p className="text-xs text-slate-400 dark:text-brand-500">القيد المرتبط: #{viewing.invoice.entry_id}</p>}
                            {viewing.invoice.qr_base64 && (
                                <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-brand-700">
                                    <div id="zatca-qr-box" className="bg-white p-2 rounded-lg border border-slate-200">
                                        <QRCode value={viewing.invoice.qr_base64} size={104} />
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-brand-400 leading-relaxed">
                                        <p className="font-bold text-brand-800 dark:text-brand-100">رمز QR — هيئة الزكاة والضريبة</p>
                                        <p>فاتورة ضريبية متوافقة (المرحلة الأولى)</p>
                                        {viewing.invoice.uuid && <p className="text-slate-400 dark:text-brand-500 mt-1" dir="ltr">{viewing.invoice.uuid}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PaymentsTab({ parties, toast }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [typeFilter,  setTypeFilter]  = useState('');
    const [filterFrom,  setFilterFrom]  = useState('');
    const [filterTo,    setFilterTo]    = useState('');
    const [filterParty, setFilterParty] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (typeFilter)  params.pay_type  = typeFilter;
            if (filterFrom)  params.from      = filterFrom;
            if (filterTo)    params.to        = filterTo;
            if (filterParty) params.party_id  = filterParty;
            const r = await api('pay_list', { params });
            setList(r.data || []);
        } catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
    }, [typeFilter, filterFrom, filterTo, filterParty, toast]);
    useEffect(() => { load(); }, [load]);

    const newPay = (pay_type) => setEditing({ pay_type, party_id: '', invoice_id: '', date: todayISO(), amount: '', method: 'cash', notes: '' });
    const partyOptions = useMemo(() => editing ? parties.filter(p => p.type === (editing.pay_type === 'receipt' ? 'customer' : 'supplier')) : [], [parties, editing]);

    const save = async () => {
        const f = editing;
        if (!(Number(f.amount) > 0)) return toast('أدخل مبلغًا صحيحًا', 'error');
        try {
            const r = await api('pay_save', { method: 'POST', body: {
                pay_type: f.pay_type, party_id: f.party_id || '', invoice_id: f.invoice_id || '',
                date: f.date, amount: Number(f.amount), method: f.method, notes: f.notes || '',
            }});
            if (r.success) { toast((r.message || 'تم') + (r.pay_no ? ' — ' + r.pay_no : '')); setEditing(null); load(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const voidPay = async (id) => {
        if (!window.confirm('إلغاء السند وعكس قيده؟')) return;
        try { const r = await api('pay_void', { method: 'POST', body: { id } }); if (r.success) { toast(r.message); load(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Btn color="green" onClick={() => newPay('receipt')}><Plus size={15} /> سند قبض</Btn>
                <Btn color="navy" onClick={() => newPay('payment')}><Plus size={15} /> سند صرف</Btn>
                <Btn color="gray" size="sm" onClick={load}><RefreshCw size={14} /> تحديث</Btn>
                <div className="w-px bg-slate-200 dark:bg-brand-700 h-7 mx-1" />
                <div className="w-52">
                    <PartyCombobox
                        parties={parties}
                        value={filterParty}
                        rawId
                        onChange={setFilterParty}
                        placeholder="كل الأطراف…"
                        className="[&_input]:py-1.5 [&_input]:text-xs"
                    />
                </div>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="من تاريخ"
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="إلى تاريخ"
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-2 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059] w-36" />
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-1.5 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                    <option value="">الكل</option>
                    <option value="receipt">سندات قبض</option>
                    <option value="payment">سندات صرف</option>
                </select>
                {(filterFrom || filterTo || filterParty || typeFilter) && (
                    <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterParty(''); setTypeFilter(''); }}
                        className="text-xs text-slate-400 dark:text-brand-500 hover:text-red-500 font-bold px-1" title="مسح الفلاتر">✕ مسح</button>
                )}
            </div>

            <Card>
                {!loading && list.length > 0 && (
                    <div className="px-4 pt-3 pb-1 flex items-center gap-3 border-b border-slate-100 dark:border-brand-700">
                        <span className="text-xs text-slate-400 dark:text-brand-500 font-bold">{list.length} سند | الإجمالي: <span className="text-brand-800 dark:text-brand-200 tabular-nums" dir="ltr">{money(list.reduce((s,p)=>s+Number(p.amount||0),0))}</span> ﷼</span>
                        <div className="flex-1" />
                        <Btn color="gray" size="sm" onClick={() => downloadCSV('payments.csv',
                            ['الرقم', 'النوع', 'التاريخ', 'الطرف', 'الفاتورة', 'المبلغ', 'وسيلة السداد'],
                            list.map(p => [p.pay_no, p.pay_type === 'receipt' ? 'قبض' : 'صرف', p.date, p.party_label||'', p.invoice_no||'', p.amount||0, p.method||'']))}>
                            <Download size={13} /> تصدير
                        </Btn>
                    </div>
                )}
                {loading ? <Spinner /> : list.length === 0 ? <Empty msg="لا توجد سندات" /> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-500 dark:text-brand-400 text-xs">
                                <tr>
                                    <th className="px-3 py-3 text-right font-bold">الرقم</th>
                                    <th className="px-3 py-3 text-right font-bold">النوع</th>
                                    <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                                    <th className="px-3 py-3 text-right font-bold">الطرف</th>
                                    <th className="px-3 py-3 text-right font-bold">الفاتورة</th>
                                    <th className="px-3 py-3 text-left font-bold">المبلغ</th>
                                    <th className="px-3 py-3 text-center font-bold">إجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                                {list.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 dark:bg-brand-800/30 dark:hover:bg-brand-800">
                                        <td className="px-3 py-3 font-mono font-bold text-brand-800 dark:text-brand-300">{p.pay_no}</td>
                                        <td className="px-3 py-3">{p.pay_type === 'receipt' ? <span className="text-emerald-600 font-bold">قبض</span> : <span className="text-brand-800 dark:text-brand-300 font-bold">صرف</span>}</td>
                                        <td className="px-3 py-3 text-slate-500 dark:text-brand-400">{p.date}</td>
                                        <td className="px-3 py-3">{p.party_label || '—'}</td>
                                        <td className="px-3 py-3 font-mono text-slate-400 dark:text-brand-500">{p.invoice_no || '—'}</td>
                                        <td className="px-3 py-3 text-left font-bold">{money(p.amount)}</td>
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button title="طباعة السند" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"
                                                    onClick={() => {
                                                        const label = p.pay_type === 'receipt' ? 'سند قبض' : 'سند صرف';
                                                        const method = { cash: 'نقداً', bank: 'بنك', cheque: 'شيك' }[p.method] || p.method || '—';
                                                        printHtml(`${label} — ${p.pay_no}`,
                                                            `<h1>${label}</h1><h2>رقم: ${p.pay_no} | التاريخ: ${p.date}</h2>
                                                            <table><thead><tr><th>الطرف</th><th>الفاتورة</th><th>طريقة السداد</th><th style="text-align:left">المبلغ</th></tr></thead>
                                                            <tbody><tr><td>${p.party_label||'—'}</td><td>${p.invoice_no||'—'}</td><td>${method}</td><td class="amount" style="font-size:20px;font-weight:900">${money(p.amount)} ﷼</td></tr></tbody></table>
                                                            ${p.notes?`<p style="margin-top:16px;color:#64748b">ملاحظات: ${p.notes}</p>`:''}
                                                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px">
                                                                <div style="text-align:center;border-top:1px solid #cbd5e1;padding-top:8px">توقيع المستلم</div>
                                                                <div style="text-align:center;border-top:1px solid #cbd5e1;padding-top:8px">توقيع المحاسب</div>
                                                            </div>`
                                                        );
                                                    }}><Printer size={15} /></button>
                                                <button onClick={() => voidPay(p.id)} title="إلغاء" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><RotateCcw size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {editing && (
                <div className="fixed inset-0 z-[90] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setEditing(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-2xl w-full max-w-md my-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">{editing.pay_type === 'receipt' ? 'سند قبض' : 'سند صرف'}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:text-brand-400"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{editing.pay_type === 'receipt' ? 'العميل' : 'المورد'}</label>
                                <PartyCombobox
                                    parties={partyOptions}
                                    value={editing.party_id}
                                    rawId
                                    onChange={v => setEditing(ed => ({ ...ed, party_id: v }))}
                                    placeholder={editing.pay_type === 'receipt' ? 'ابحث باسم العميل…' : 'ابحث باسم المورد…'}
                                    className="[&_input]:py-2 [&_input]:rounded-xl [&_input]:bg-slate-50 [&_input]:text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">التاريخ</label>
                                    <input type="date" value={editing.date} onChange={e => setEditing(ed => ({ ...ed, date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">المبلغ</label>
                                    <input type="number" value={editing.amount} onChange={e => setEditing(ed => ({ ...ed, amount: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">طريقة الدفع</label>
                                    <select value={editing.method} onChange={e => setEditing(ed => ({ ...ed, method: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]">
                                        <option value="cash">نقدًا (الصندوق)</option>
                                        <option value="bank">بنك</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">رقم الفاتورة (اختياري)</label>
                                    <input type="number" value={editing.invoice_id} onChange={e => setEditing(ed => ({ ...ed, invoice_id: e.target.value }))} placeholder="معرّف الفاتورة"
                                        className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">ملاحظات</label>
                                <input type="text" value={editing.notes} onChange={e => setEditing(ed => ({ ...ed, notes: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30">
                            <Btn color="gray" onClick={() => setEditing(null)}><X size={15} /> إلغاء</Btn>
                            <Btn color="green" onClick={save}><Save size={15} /> تسجيل وترحيل</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── تبويب: ملف المنشأة (يُستخدم في رمز QR للزكاة وفي الطباعة) ────────────────
const SETTINGS_FIELDS = [
    { k: 'company_name', label: 'الاسم القانوني للمنشأة', ph: 'سمك للمقاولات', req: true, col: 2 },
    { k: 'vat_number', label: 'الرقم الضريبي (15 رقمًا)', ph: '3xxxxxxxxxxxxx3', req: true, dir: 'ltr' },
    { k: 'cr_number', label: 'رقم السجل التجاري', ph: '1010xxxxxx', dir: 'ltr' },
    { k: 'address', label: 'العنوان (الشارع)', ph: 'شارع ...' },
    { k: 'district', label: 'الحي', ph: 'حي ...' },
    { k: 'city', label: 'المدينة', ph: 'الرياض' },
    { k: 'postal_code', label: 'الرمز البريدي', ph: '12345', dir: 'ltr' },
    { k: 'building_no', label: 'رقم المبنى', ph: '0000', dir: 'ltr' },
    { k: 'phone', label: 'الهاتف', ph: '05xxxxxxxx', dir: 'ltr' },
    { k: 'email', label: 'البريد الإلكتروني', ph: 'info@...', dir: 'ltr' },
];
// ════════════════════════════════════════════════════════════════════════════
//  السنوات المالية — إقفال وإعادة فتح
// ════════════════════════════════════════════════════════════════════════════
function FiscalPeriodsTab({ toast }) {
    const [years,   setYears]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [busy,    setBusy]    = useState(null);   // fy currently being processed
    const [confirm, setConfirm] = useState(null);   // { fy, action: 'close'|'reopen' }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api('gl_fiscal_years');
            if (r.success) setYears(r.data || []);
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const closeYear = async (fy) => {
        setBusy(fy);
        try {
            const r = await api('gl_close_year', { method: 'POST', body: { fy, actor: 'admin' } });
            if (r.success) {
                toast(`✓ ${r.message}`);
                load();
            } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setBusy(null); setConfirm(null); }
    };

    const reopenYear = async (fy) => {
        setBusy(fy);
        try {
            const r = await api('gl_reopen_year', { method: 'POST', body: { fy, actor: 'admin' } });
            if (r.success) {
                toast(`✓ ${r.message}`);
                load();
            } else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setBusy(null); setConfirm(null); }
    };

    const curY = new Date().getFullYear();

    return (
        <div className="space-y-5">
            {/* رأس */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">السنوات المالية</h3>
                        <p className="text-xs text-slate-500 dark:text-brand-400">إقفال السنة يُولّد قيد إقفال ويُصفّر الإيرادات والمصروفات · الفتح يحذف قيد الإقفال</p>
                    </div>
                </div>
                <Btn color="gray" size="sm" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث</Btn>
            </div>

            {/* تحذير إقفال */}
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    إقفال السنة المالية لا رجعة فيه إلا بإعادة الفتح الصريحة. تأكّد من اكتمال جميع القيود قبل الإقفال.
                    يمكن إعادة الفتح في أي وقت لتصحيح الأخطاء.
                </p>
            </div>

            {/* قائمة السنوات */}
            {loading ? <Spinner /> : years.length === 0 ? <Empty msg="لا توجد سنوات مالية" /> : (
                <div className="space-y-3">
                    {years.map(y => {
                        const fy       = Number(y.fy);
                        const closed   = Number(y.is_closed) === 1;
                        const isCur    = fy === curY;
                        const isBusy   = busy === fy;
                        return (
                            <div key={fy}
                                className={`bg-white dark:bg-brand-900 rounded-2xl border shadow-sm p-4 flex flex-wrap items-center gap-4 transition
                                    ${closed
                                        ? 'border-slate-200 dark:border-brand-700 opacity-80'
                                        : isCur
                                            ? 'border-emerald-300 dark:border-emerald-500/40 ring-1 ring-emerald-200 dark:ring-emerald-500/20'
                                            : 'border-slate-200 dark:border-brand-700'}`}>

                                {/* أيقونة الحالة */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                    ${closed ? 'bg-slate-100 dark:bg-brand-800 text-slate-400 dark:text-brand-500'
                                             : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}`}>
                                    {closed ? <Lock size={18} /> : <Unlock size={18} />}
                                </div>

                                {/* معلومات السنة */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-lg font-black text-brand-800 dark:text-brand-100">{fy}</span>
                                        {isCur && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                                السنة الحالية
                                            </span>
                                        )}
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border
                                            ${closed
                                                ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-400 dark:border-brand-700'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'}`}>
                                            {closed ? '🔒 مقفلة' : '🟢 مفتوحة'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5 flex items-center gap-3 flex-wrap">
                                        <span dir="ltr">{y.start_date || `${fy}-01-01`} → {y.end_date || `${fy}-12-31`}</span>
                                        {y.entry_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <ChevronRight size={11} />
                                                {y.entry_count.toLocaleString()} قيد مرحَّل
                                            </span>
                                        )}
                                        {closed && y.closed_at && (
                                            <span>أُقفلت {y.closed_at.slice(0, 10)}{y.closed_by ? ` · ${y.closed_by}` : ''}</span>
                                        )}
                                    </div>
                                </div>

                                {/* أزرار الإجراء */}
                                <div className="shrink-0">
                                    {closed ? (
                                        <Btn color="gray" size="sm" disabled={isBusy}
                                            onClick={() => setConfirm({ fy, action: 'reopen' })}>
                                            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                                            إعادة الفتح
                                        </Btn>
                                    ) : (
                                        <Btn color="red" size="sm" disabled={isBusy}
                                            onClick={() => setConfirm({ fy, action: 'close' })}>
                                            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                                            إقفال {fy}
                                        </Btn>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* مودال التأكيد */}
            {confirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center
                                ${confirm.action === 'close'
                                    ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                                {confirm.action === 'close' ? <Lock size={22} /> : <Unlock size={22} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">
                                    {confirm.action === 'close' ? `إقفال ${confirm.fy}` : `إعادة فتح ${confirm.fy}`}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-brand-400">هذا الإجراء يؤثر على جميع التقارير</p>
                            </div>
                        </div>

                        {confirm.action === 'close' ? (
                            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 mb-5 text-xs font-bold text-rose-700 dark:text-rose-300">
                                سيُنشئ النظام قيد إقفال بتاريخ 31/12/{confirm.fy} يُصفّر حسابات الإيرادات والمصروفات ويرحّل الصافي إلى حساب الأرباح المحتجزة.
                            </div>
                        ) : (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 mb-5 text-xs font-bold text-amber-700 dark:text-amber-300">
                                سيُحذف قيد الإقفال لسنة {confirm.fy} وستُعاد الفترة مفتوحة. القيود الأخرى لن تتأثر.
                            </div>
                        )}

                        <div className="flex gap-2">
                            {confirm.action === 'close'
                                ? <Btn color="red" onClick={() => closeYear(confirm.fy)} disabled={busy === confirm.fy}>
                                    {busy === confirm.fy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                    تأكيد الإقفال
                                  </Btn>
                                : <Btn color="green" onClick={() => reopenYear(confirm.fy)} disabled={busy === confirm.fy}>
                                    {busy === confirm.fy ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                                    تأكيد الفتح
                                  </Btn>}
                            <Btn color="gray" onClick={() => setConfirm(null)}>إلغاء</Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingsTab({ company, reload, toast }) {
    const [form, setForm] = useState(company || {});
    const [saving, setSaving] = useState(false);
    useEffect(() => { setForm(company || {}); }, [company]);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const save = async () => {
        if (!form.company_name) return toast('الاسم القانوني مطلوب', 'error');
        const vat = String(form.vat_number || '');
        if (vat && !/^\d{15}$/.test(vat)) return toast('الرقم الضريبي يجب أن يكون 15 رقمًا', 'error');
        setSaving(true);
        try {
            const settings = {};
            SETTINGS_FIELDS.forEach(f => { settings[f.k] = form[f.k] || ''; });
            const r = await api('gl_settings_save', { method: 'POST', body: { settings } });
            if (r.success) { toast(r.message || 'تم الحفظ'); reload && reload(); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
    };
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-brand-800 flex items-center justify-center"><Building2 size={20} className="text-gold-500" /></div>
                <div>
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">ملف المنشأة</h3>
                    <p className="text-xs text-slate-500 dark:text-brand-400">يُستخدم في رمز QR للفواتير الضريبية وفي رأس الطباعة — أدخل البيانات الرسمية للمنشأة</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SETTINGS_FIELDS.map(f => (
                    <div key={f.k} className={f.col === 2 ? 'md:col-span-2' : ''}>
                        <label className="block text-xs font-bold text-slate-600 dark:text-brand-300 mb-1">{f.label}{f.req && <span className="text-red-500"> *</span>}</label>
                        <input value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph} dir={f.dir || 'rtl'}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-700 text-sm focus:border-[#c5a059] focus:ring-2 focus:ring-amber-100 outline-none dark:bg-brand-900 dark:text-brand-50 dark:placeholder-brand-500" />
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                <Btn color="green" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ ملف المنشأة'}</Btn>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  المطابقة البنكية
// ════════════════════════════════════════════════════════════════════════════
function BankReconcileTab({ accounts, toast }) {
    const [sub, setSub]               = useState('accounts'); // 'accounts'|'statement'|'report'
    const [bankAccounts, setBankAccs] = useState([]);
    const [baLoading,    setBaLoad]   = useState(false);
    const [editing,      setEditing]  = useState(null);
    const [selBa,        setSelBa]    = useState('');         // selected bank_account_id
    const [from,         setFrom]     = useState(monthStart());
    const [to,           setTo]       = useState(todayISO());
    const [stmtLines,    setStmt]     = useState([]);
    const [stmtLoad,     setStmtLoad] = useState(false);
    const [newLines,     setNewLines] = useState([{ stmt_date: todayISO(), description: '', debit: '', credit: '', ref: '' }]);
    const [adding,       setAdding]   = useState(false);
    const [report,       setReport]   = useState(null);
    const [rptLoad,      setRptLoad]  = useState(false);

    const assetAccounts = useMemo(() => accounts.filter(a => Number(a.is_group)===0 && a.type==='asset'), [accounts]);

    const loadBankAccs = useCallback(async () => {
        setBaLoad(true);
        try { const r = await api('gl_bank_accounts'); if (r.success) setBankAccs(r.data||[]); }
        catch (e) { toast(e.message,'error'); } finally { setBaLoad(false); }
    }, [toast]);
    useEffect(() => { loadBankAccs(); }, [loadBankAccs]);

    const saveBankAcc = async () => {
        if (!editing.name) { toast('الاسم مطلوب','error'); return; }
        try {
            const r = await api('gl_bank_account_save', { method:'POST', body: { ...editing, id: editing.id||0 }});
            if (r.success) { toast(r.message); setEditing(null); loadBankAccs(); } else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); }
    };

    const loadStmt = useCallback(async () => {
        if (!selBa) return;
        setStmtLoad(true);
        try { const r = await api('gl_bank_stmt_list', { params: { bank_account_id: selBa, from, to }}); if (r.success) setStmt(r.data||[]); }
        catch (e) { toast(e.message,'error'); } finally { setStmtLoad(false); }
    }, [selBa, from, to, toast]);
    useEffect(() => { if (sub==='statement') loadStmt(); }, [sub, selBa, from, to]); // eslint-disable-line

    const addLines = async () => {
        const valid = newLines.filter(l => l.stmt_date && (Number(l.debit)||Number(l.credit)));
        if (!valid.length) { toast('أدخل بند واحد على الأقل','error'); return; }
        setAdding(true);
        try {
            const r = await api('gl_bank_stmt_add', { method:'POST', body: { bank_account_id: Number(selBa), lines: valid }});
            if (r.success) { toast(r.message); setNewLines([{ stmt_date: todayISO(), description:'', debit:'', credit:'', ref:'' }]); loadStmt(); }
            else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); } finally { setAdding(false); }
    };

    const toggleMatch = async (line) => {
        const newVal = line.reconciled ? 0 : 1;
        try {
            const r = await api('gl_bank_reconcile_mark', { method:'POST', body: { id: line.id, reconciled: newVal }});
            if (r.success) { toast(r.message); setStmt(prev => prev.map(l => l.id===line.id ? {...l, reconciled: newVal} : l)); }
            else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); }
    };

    const deleteStmtLine = async (id) => {
        try {
            const r = await api('gl_bank_stmt_delete', { method:'POST', body: { id }});
            if (r.success) { toast(r.message); setStmt(prev => prev.filter(l => l.id!==id)); }
            else toast(r.message,'error');
        } catch (e) { toast(e.message,'error'); }
    };

    const loadReport = useCallback(async () => {
        if (!selBa) { toast('اختر حساباً بنكياً','error'); return; }
        setRptLoad(true);
        try { const r = await api('gl_bank_recon_report', { params: { bank_account_id: selBa, to }}); if (r.success) setReport(r); else toast(r.message,'error'); }
        catch (e) { toast(e.message,'error'); } finally { setRptLoad(false); }
    }, [selBa, to, toast]);

    const importCSV = (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const lines = text.split('\n').slice(1).filter(l => l.trim()); // skip header
            const parsed = lines.map(l => {
                const cols = l.split(',').map(c => c.replace(/^"|"$/g,'').trim());
                return { stmt_date: cols[0]||'', description: cols[1]||'', debit: cols[2]||'', credit: cols[3]||'', ref: cols[4]||'' };
            }).filter(l => l.stmt_date);
            setNewLines(parsed.length ? parsed : newLines);
            toast(`تم تحليل ${parsed.length} سطر من الملف`);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const printReport = () => {
        if (!report) return;
        const ba = report.bank_account;
        const rows = (report.stmt_unmatched||[]).map(l =>
            `<tr><td dir="ltr">${l.stmt_date}</td><td>${l.description}</td>
             <td class="amount">${Number(l.debit)?money(l.debit):''}</td>
             <td class="amount">${Number(l.credit)?money(l.credit):''}</td></tr>`).join('');
        printHtml(`تقرير المطابقة البنكية — ${ba.name}`,
            `<h1>تقرير المطابقة البنكية</h1>
            <h2>${ba.name} · حتى ${report.as_of}</h2>
            <table>
                <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:20px;border-top:2px solid #c5a059;padding-top:10px">
                <p><strong>رصيد دفتر الأستاذ (حتى ${report.as_of}): ${money(report.gl_balance)}</strong></p>
                <p>بنود غير مطابقة (مدين): ${money(report.stmt_unmatched_debit)}</p>
                <p>بنود غير مطابقة (دائن): ${money(report.stmt_unmatched_credit)}</p>
                <p style="font-size:16px;font-weight:900;border-top:1px solid #ccc;padding-top:8px;margin-top:8px">
                    الرصيد المعدّل: ${money(report.adjusted_balance)}</p>
            </div>`
        );
    };

    const blankBa = { id:0, name:'', bank_name:'', account_number:'', iban:'', currency:'SAR', gl_account_id:'' };

    return (
        <div className="space-y-4">
            {/* رأس */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <Scale size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">المطابقة البنكية</h3>
                    <p className="text-xs text-slate-500 dark:text-brand-400">طابق بنود كشف حساب البنك مع حركات دفتر الأستاذ</p>
                </div>
            </div>

            {/* تبويبات فرعية */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-brand-700">
                {[
                    { id:'accounts',  label:'الحسابات البنكية' },
                    { id:'statement', label:'كشف الحساب' },
                    { id:'report',    label:'تقرير المطابقة' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSub(s.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-t-xl border-b-2 transition
                            ${sub===s.id?'border-[#c5a059] text-[#c5a059]':'border-transparent text-slate-500 dark:text-brand-400 hover:text-[#c5a059]'}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ── الحسابات البنكية ── */}
            {sub === 'accounts' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-brand-400">{bankAccounts.length} حساب</span>
                        <Btn color="green" onClick={() => setEditing({...blankBa})}><Plus size={15} /> حساب بنكي جديد</Btn>
                    </div>
                    {baLoading ? <Spinner /> : bankAccounts.length===0 ? <Empty msg="لا توجد حسابات بنكية — أضف حساب البنك وربطه بحساب في دفتر الأستاذ" /> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {bankAccounts.map(ba => (
                                <div key={ba.id} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm p-4 flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Banknote size={18} className="text-emerald-700 dark:text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-brand-800 dark:text-brand-100">{ba.name}</div>
                                        <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5 space-y-0.5">
                                            {ba.bank_name && <div>{ba.bank_name}</div>}
                                            {ba.account_number && <div dir="ltr" className="font-mono">{ba.account_number}</div>}
                                            {ba.iban && <div dir="ltr" className="font-mono text-[10px]">{ba.iban}</div>}
                                            {ba.gl_name && <div className="text-indigo-600 dark:text-indigo-400 font-bold">{ba.gl_code} · {ba.gl_name}</div>}
                                        </div>
                                    </div>
                                    <button onClick={() => setEditing({ id:ba.id, name:ba.name, bank_name:ba.bank_name||'', account_number:ba.account_number||'', iban:ba.iban||'', currency:ba.currency||'SAR', gl_account_id:ba.gl_account_id||'' })}
                                        className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059] shrink-0"><Edit2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {editing && (
                        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                            <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()} dir="rtl">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="font-black text-brand-800 dark:text-brand-100">{editing.id?'تعديل حساب':'حساب بنكي جديد'}</h3>
                                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { k:'name', label:'اسم الحساب', req:true },
                                        { k:'bank_name', label:'اسم البنك' },
                                        { k:'account_number', label:'رقم الحساب', dir:'ltr' },
                                        { k:'iban', label:'IBAN', dir:'ltr' },
                                    ].map(f => (
                                        <div key={f.k}>
                                            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">{f.label}{f.req&&<span className="text-red-500"> *</span>}</label>
                                            <input value={editing[f.k]||''} onChange={e=>setEditing(ed=>({...ed,[f.k]:e.target.value}))} dir={f.dir||'rtl'}
                                                className="w-full bg-slate-50 border border-slate-200 dark:bg-brand-900 dark:border-brand-700 dark:text-brand-50 px-3 py-2 rounded-xl text-sm outline-none focus:border-[#c5a059]" />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">حساب الأستاذ (أصول/بنك)</label>
                                        <AccountCombobox accounts={assetAccounts} value={editing.gl_account_id} onChange={v=>setEditing(ed=>({...ed,gl_account_id:v}))} />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-5">
                                    <Btn color="green" onClick={saveBankAcc}><Save size={14}/> حفظ</Btn>
                                    <Btn color="gray" onClick={()=>setEditing(null)}>إلغاء</Btn>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── كشف الحساب ── */}
            {sub === 'statement' && (
                <div className="space-y-4">
                    {/* فلتر */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الحساب البنكي</label>
                            <select value={selBa} onChange={e=>setSelBa(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900 min-w-[180px]">
                                <option value="">— اختر حساباً —</option>
                                {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من</label>
                            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى</label>
                            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <Btn color="navy" onClick={loadStmt} disabled={!selBa||stmtLoad}>
                            {stmtLoad?<Loader2 size={14} className="animate-spin"/>:<Search size={14}/>} عرض
                        </Btn>
                    </div>

                    {/* جدول البنود */}
                    {stmtLoad ? <Spinner /> : selBa && stmtLines.length > 0 && (
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                        <tr>
                                            <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                                            <th className="px-3 py-3 text-right font-bold">البيان</th>
                                            <th className="px-3 py-3 text-right font-bold">المرجع</th>
                                            <th className="px-3 py-3 text-left font-bold">مدين</th>
                                            <th className="px-3 py-3 text-left font-bold">دائن</th>
                                            <th className="px-3 py-3 text-center font-bold w-24">مطابق</th>
                                            <th className="px-3 py-3 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stmtLines.map(l => (
                                            <tr key={l.id} className={`border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition ${l.reconciled?'opacity-60':''}`}>
                                                <td className="px-3 py-2.5 font-bold text-slate-500 dark:text-brand-400" dir="ltr">{l.stmt_date}</td>
                                                <td className="px-3 py-2.5 text-slate-700 dark:text-brand-300">{l.description||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs text-slate-400 dark:text-brand-500 font-mono">{l.ref||'—'}</td>
                                                <td className="px-3 py-2.5 text-left tabular-nums font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">{Number(l.debit)?money(l.debit):''}</td>
                                                <td className="px-3 py-2.5 text-left tabular-nums font-bold text-rose-600 dark:text-rose-400" dir="ltr">{Number(l.credit)?money(l.credit):''}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <button onClick={()=>toggleMatch(l)}
                                                        className={`w-8 h-5 rounded-full relative inline-flex transition-colors duration-200 ${l.reconciled?'bg-emerald-500':'bg-slate-200 dark:bg-brand-700'}`}>
                                                        <span className={`inline-block w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all duration-200 ${l.reconciled?'right-0.5':'left-0.5'}`}/>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <button onClick={()=>deleteStmtLine(l.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* إضافة بنود جديدة */}
                    {selBa && (
                        <Card>
                            <div className="px-3 py-2.5 bg-slate-50 dark:bg-brand-800/40 border-b border-slate-100 dark:border-brand-700 flex items-center justify-between">
                                <h4 className="text-sm font-black text-slate-700 dark:text-brand-300">إضافة بنود جديدة</h4>
                                <label className="cursor-pointer">
                                    <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                                        <Download size={12}/> استيراد CSV
                                    </span>
                                </label>
                            </div>
                            <div className="p-3 overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="text-slate-400 dark:text-brand-500">
                                        <tr>
                                            <th className="px-2 py-1.5 text-right font-bold w-36">التاريخ</th>
                                            <th className="px-2 py-1.5 text-right font-bold">البيان</th>
                                            <th className="px-2 py-1.5 text-right font-bold w-20">مرجع</th>
                                            <th className="px-2 py-1.5 text-left font-bold w-28">مدين (وارد)</th>
                                            <th className="px-2 py-1.5 text-left font-bold w-28">دائن (صادر)</th>
                                            <th className="w-7"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {newLines.map((l, i) => (
                                            <tr key={i} className="border-b border-slate-50 dark:border-brand-700">
                                                <td className="px-1 py-1"><input type="date" value={l.stmt_date} onChange={e=>setNewLines(nl=>nl.map((x,j)=>j===i?{...x,stmt_date:e.target.value}:x))}
                                                    className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" /></td>
                                                <td className="px-1 py-1"><input value={l.description} onChange={e=>setNewLines(nl=>nl.map((x,j)=>j===i?{...x,description:e.target.value}:x))}
                                                    className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" /></td>
                                                <td className="px-1 py-1"><input value={l.ref} onChange={e=>setNewLines(nl=>nl.map((x,j)=>j===i?{...x,ref:e.target.value}:x))}
                                                    className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs outline-none focus:border-[#c5a059]" /></td>
                                                <td className="px-1 py-1"><input type="number" step="0.01" value={l.debit} onChange={e=>setNewLines(nl=>nl.map((x,j)=>j===i?{...x,debit:e.target.value}:x))}
                                                    className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs tabular-nums outline-none focus:border-emerald-400" dir="ltr" /></td>
                                                <td className="px-1 py-1"><input type="number" step="0.01" value={l.credit} onChange={e=>setNewLines(nl=>nl.map((x,j)=>j===i?{...x,credit:e.target.value}:x))}
                                                    className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 dark:text-brand-50 px-2 py-1 rounded-lg text-xs tabular-nums outline-none focus:border-rose-400" dir="ltr" /></td>
                                                <td className="px-1 py-1 text-center">
                                                    {newLines.length > 1 && <button onClick={()=>setNewLines(nl=>nl.filter((_,j)=>j!==i))} className="text-slate-300 hover:text-red-500"><X size={13}/></button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-brand-700">
                                    <Btn color="gray" size="sm" onClick={()=>setNewLines(nl=>[...nl,{stmt_date:todayISO(),description:'',debit:'',credit:'',ref:''}])}><Plus size={12}/> بند</Btn>
                                    <div className="flex-1"/>
                                    <Btn color="green" onClick={addLines} disabled={adding||!selBa}>
                                        {adding?<Loader2 size={13} className="animate-spin"/>:<Save size={13}/>}
                                        {adding?'جارٍ الحفظ…':'حفظ البنود'}
                                    </Btn>
                                </div>
                            </div>
                        </Card>
                    )}
                    {!selBa && <Empty msg="اختر حساباً بنكياً لعرض أو إضافة بنود" />}
                </div>
            )}

            {/* ── تقرير المطابقة ── */}
            {sub === 'report' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الحساب البنكي</label>
                            <select value={selBa} onChange={e=>setSelBa(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900 min-w-[180px]">
                                <option value="">— اختر حساباً —</option>
                                {bankAccounts.map(ba=><option key={ba.id} value={ba.id}>{ba.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">حتى تاريخ</label>
                            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <Btn color="navy" onClick={loadReport} disabled={rptLoad||!selBa}>
                            {rptLoad?<Loader2 size={14} className="animate-spin"/>:<FileBarChart2 size={14}/>}
                            توليد التقرير
                        </Btn>
                        {report && <Btn color="gray" size="sm" onClick={printReport}><Printer size={13}/> طباعة</Btn>}
                    </div>

                    {rptLoad ? <Spinner /> : report && (
                        <div className="space-y-4">
                            {/* بطاقات ملخص */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { label:'رصيد دفتر الأستاذ', val:report.gl_balance, cls:'text-brand-800 dark:text-brand-100' },
                                    { label:'بنود غير مطابقة (صافي)', val:report.stmt_unmatched_debit-report.stmt_unmatched_credit, cls:'text-amber-700 dark:text-amber-400' },
                                    { label:'الرصيد المعدّل', val:report.adjusted_balance, cls:'text-emerald-700 dark:text-emerald-400 font-black' },
                                ].map(c=>(
                                    <div key={c.label} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm px-4 py-3">
                                        <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                        <div className={`text-xl font-black tabular-nums ${c.cls}`} dir="ltr">{money(c.val)}</div>
                                    </div>
                                ))}
                            </div>

                            {report.stmt_unmatched?.length > 0 && (
                                <Card>
                                    <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/30">
                                        <h4 className="text-sm font-black text-amber-700 dark:text-amber-400">البنود غير المطابقة ({report.stmt_unmatched.length})</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-slate-400 dark:text-brand-500 bg-slate-50/60 dark:bg-brand-800/20">
                                                <tr>
                                                    <th className="px-3 py-2 text-right font-bold">التاريخ</th>
                                                    <th className="px-3 py-2 text-right font-bold">البيان</th>
                                                    <th className="px-3 py-2 text-left font-bold">مدين</th>
                                                    <th className="px-3 py-2 text-left font-bold">دائن</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.stmt_unmatched.map(l=>(
                                                    <tr key={l.id} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800">
                                                        <td className="px-3 py-2 font-bold text-slate-500 dark:text-brand-400" dir="ltr">{l.stmt_date}</td>
                                                        <td className="px-3 py-2 text-slate-700 dark:text-brand-300">{l.description||'—'}</td>
                                                        <td className="px-3 py-2 text-left tabular-nums text-emerald-700 dark:text-emerald-400 font-bold" dir="ltr">{Number(l.debit)?money(l.debit):''}</td>
                                                        <td className="px-3 py-2 text-left tabular-nums text-rose-600 dark:text-rose-400 font-bold" dir="ltr">{Number(l.credit)?money(l.credit):''}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}
                    {!selBa && <Empty msg="اختر حساباً بنكياً لتوليد تقرير المطابقة" />}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب الميزانية التقديرية — إدخال + مقارنة بالفعلي
// ════════════════════════════════════════════════════════════════════════════
function BudgetTab({ accounts, toast }) {
    const curY = new Date().getFullYear();
    const [sub,        setSub]        = useState('input');   // 'input' | 'compare'
    const [fy,         setFy]         = useState(curY);
    const [budgetRows, setBudgetRows] = useState([]);  // { account_id, code, name, type, amount }
    const [editAmts,   setEditAmts]   = useState({});  // accountId → draftAmount string
    const [budLoading, setBudLoading] = useState(false);
    const [saving,     setSaving]     = useState(false);
    const [cmpData,    setCmpData]    = useState(null);
    const [cmpLoading, setCmpLoading] = useState(false);

    // حسابات الإيرادات والمصروفات (غير مجمّعة)
    const incomeAccounts = useMemo(() => accounts.filter(a => Number(a.is_group) === 0 && ['revenue','expense'].includes(a.type)), [accounts]);

    const loadBudget = useCallback(async (y) => {
        setBudLoading(true);
        try {
            const r = await api('gl_budget_get', { params: { fy: y } });
            if (!r.success) { toast(r.message, 'error'); return; }
            // اربط بكل الحسابات الإيراد/المصاريف، وضع القيم المحفوظة حيث وُجدت
            const saved = {};
            (r.data || []).forEach(row => { saved[row.account_id] = String(row.amount || ''); });
            const merged = incomeAccounts.map(a => ({
                account_id: a.id, code: a.code, name: a.name, type: a.type,
                saved: saved[a.id] || '',
            }));
            setBudgetRows(merged);
            setEditAmts(saved);
        } catch (e) { toast(e.message, 'error'); }
        finally { setBudLoading(false); }
    }, [incomeAccounts, toast]);

    useEffect(() => { if (incomeAccounts.length > 0) loadBudget(fy); }, [fy, incomeAccounts.length]); // eslint-disable-line

    const saveBudget = async () => {
        setSaving(true);
        try {
            const rows = Object.entries(editAmts)
                .filter(([, v]) => v !== '' && !isNaN(Number(v)))
                .map(([account_id, amount]) => ({ account_id: Number(account_id), amount: Number(amount) }));
            const r = await api('gl_budget_save', { method: 'POST', body: { fy, rows } });
            if (r.success) { toast(r.message); loadBudget(fy); }
            else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const loadCompare = useCallback(async (y) => {
        setCmpLoading(true);
        try {
            const r = await api('gl_budget_vs_actual', { params: { fy: y } });
            if (r.success) setCmpData(r); else toast(r.message, 'error');
        } catch (e) { toast(e.message, 'error'); }
        finally { setCmpLoading(false); }
    }, [toast]);

    useEffect(() => { if (sub === 'compare') loadCompare(fy); }, [sub, fy]); // eslint-disable-line

    const exportCmp = () => {
        if (!cmpData) return;
        downloadCSV(`budget_vs_actual_${fy}.csv`,
            ['النوع','الكود','الحساب','الميزانية','الفعلي','الفرق','% التحقق'],
            cmpData.data.map(r => [
                TYPE_LABELS[r.type]||r.type, r.code, r.name,
                r.budget, r.actual, r.variance, r.pct !== null ? r.pct+'%' : '—'
            ])
        );
    };

    const printCmp = () => {
        if (!cmpData) return;
        const t = cmpData.totals;
        const rows = cmpData.data.map(r => `
            <tr>
                <td>${r.code}</td><td>${r.name}</td>
                <td class="amount">${money(r.budget)}</td>
                <td class="amount">${money(r.actual)}</td>
                <td class="amount ${r.variance>=0?'':'text-rose-700'}">${money(r.variance)}</td>
                <td class="amount">${r.pct!==null?r.pct+'%':'—'}</td>
            </tr>`).join('');
        printHtml(`الميزانية التقديرية مقابل الفعلي ${fy}`,
            `<h1>الميزانية التقديرية مقابل الفعلي — ${fy}</h1>
            <table>
                <thead><tr><th>الكود</th><th>الحساب</th><th>الميزانية</th><th>الفعلي</th><th>الفرق</th><th>%</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr class="total-row"><td colspan="2">الإيرادات</td><td class="amount">${money(t.rev_budget)}</td><td class="amount">${money(t.rev_actual)}</td><td class="amount">${money(t.rev_variance)}</td><td>—</td></tr>
                    <tr class="total-row"><td colspan="2">المصروفات</td><td class="amount">${money(t.exp_budget)}</td><td class="amount">${money(t.exp_actual)}</td><td class="amount">${money(t.exp_variance)}</td><td>—</td></tr>
                    <tr class="net-row"><td colspan="2">الصافي</td><td class="amount">${money(t.net_budget)}</td><td class="amount">${money(t.net_actual)}</td><td class="amount">${money(t.net_variance)}</td><td>—</td></tr>
                </tfoot>
            </table>`
        );
    };

    const revRows = budgetRows.filter(r => r.type === 'revenue');
    const expRows = budgetRows.filter(r => r.type === 'expense');

    const totalBudget = Object.values(editAmts).reduce((s, v) => s + (Number(v)||0), 0);

    return (
        <div className="space-y-4">
            {/* رأس الصفحة */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                        <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">الميزانية التقديرية</h3>
                        <p className="text-xs text-slate-500 dark:text-brand-400">حدّد أهداف الإيرادات والمصروفات ثم قارنها بالأرقام الفعلية</p>
                    </div>
                </div>
                {/* اختيار السنة */}
                <select value={fy} onChange={e => setFy(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900">
                    {[curY+1, curY, curY-1, curY-2, curY-3].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* تبويبات فرعية */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-brand-700">
                {[
                    { id: 'input',   label: 'إدخال الميزانية' },
                    { id: 'compare', label: 'مقارنة بالفعلي' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSub(s.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-t-xl border-b-2 transition
                            ${sub === s.id ? 'border-[#c5a059] text-[#c5a059]' : 'border-transparent text-slate-500 dark:text-brand-400 hover:text-[#c5a059]'}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ── إدخال الميزانية ── */}
            {sub === 'input' && (
                <>
                    {budLoading ? <Spinner /> : incomeAccounts.length === 0 ? (
                        <Empty msg="لا توجد حسابات إيرادات أو مصروفات — تأكد من إنشاء دليل الحسابات أولاً" />
                    ) : (
                        <div className="space-y-4">
                            {/* ملخص سريع */}
                            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl px-4 py-3 text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center justify-between flex-wrap gap-2">
                                <span>إجمالي الميزانية المدخلة: <span className="tabular-nums" dir="ltr">{money(totalBudget)}</span></span>
                                <Btn color="green" onClick={saveBudget} disabled={saving}><Save size={14} /> {saving ? 'جارٍ الحفظ…' : `حفظ ميزانية ${fy}`}</Btn>
                            </div>

                            {[{ label: 'الإيرادات', rows: revRows, cls: 'text-emerald-700 dark:text-emerald-400' }, { label: 'المصروفات', rows: expRows, cls: 'text-rose-600 dark:text-rose-400' }].map(sec => (
                                <Card key={sec.label}>
                                    <div className="px-3 py-2 bg-slate-50 dark:bg-brand-800/40 border-b border-slate-100 dark:border-brand-700">
                                        <h4 className={`text-sm font-black ${sec.cls}`}>{sec.label} ({sec.rows.length} حساب)</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-slate-400 dark:text-brand-500 bg-slate-50/60 dark:bg-brand-800/20">
                                                <tr>
                                                    <th className="px-3 py-2 text-right font-bold">الكود</th>
                                                    <th className="px-3 py-2 text-right font-bold">الحساب</th>
                                                    <th className="px-3 py-2 text-left font-bold w-44">المبلغ التقديري</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sec.rows.map(r => (
                                                    <tr key={r.account_id} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/50 dark:hover:bg-brand-800/40">
                                                        <td className="px-3 py-2 font-mono text-slate-400 dark:text-brand-500 text-xs">{r.code}</td>
                                                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-brand-300">{r.name}</td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="number" step="0.01" min="0"
                                                                value={editAmts[r.account_id] ?? r.saved ?? ''}
                                                                onChange={e => setEditAmts(prev => ({ ...prev, [r.account_id]: e.target.value }))}
                                                                placeholder="0.00"
                                                                className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-2 py-1.5 rounded-lg text-sm tabular-nums text-left outline-none focus:border-[#c5a059] dark:text-brand-50"
                                                                dir="ltr" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── مقارنة بالفعلي ── */}
            {sub === 'compare' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <Btn color="navy" onClick={() => loadCompare(fy)} disabled={cmpLoading}>
                            {cmpLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {cmpLoading ? 'جارٍ التحميل…' : 'تحديث المقارنة'}
                        </Btn>
                        {cmpData && (
                            <div className="flex gap-2">
                                <Btn color="gray" size="sm" onClick={exportCmp}><Download size={13} /> CSV</Btn>
                                <Btn color="gray" size="sm" onClick={printCmp}><Printer size={13} /> طباعة</Btn>
                            </div>
                        )}
                    </div>
                    {cmpLoading ? <Spinner /> : !cmpData ? (
                        <div className="text-center py-16 text-slate-300 dark:text-brand-600 font-bold text-sm">اضغط «تحديث المقارنة» لعرض النتائج</div>
                    ) : cmpData.data.length === 0 ? <Empty msg="لا توجد بيانات — أدخل الميزانية التقديرية أولاً" /> : (
                        <>
                            {/* بطاقات ملخص */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'صافي الدخل المستهدف', budget: cmpData.totals.net_budget, actual: cmpData.totals.net_actual },
                                    { label: 'إيرادات', budget: cmpData.totals.rev_budget, actual: cmpData.totals.rev_actual },
                                    { label: 'مصروفات', budget: cmpData.totals.exp_budget, actual: cmpData.totals.exp_actual },
                                ].map(c => {
                                    const pct = c.budget ? Math.round((c.actual/c.budget)*100) : null;
                                    return (
                                        <div key={c.label} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm px-4 py-3">
                                            <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                            <div className="text-lg font-black tabular-nums" dir="ltr">{money(c.actual)}</div>
                                            <div className="text-xs text-slate-400 dark:text-brand-500 mt-0.5" dir="ltr">
                                                من {money(c.budget)}{pct !== null && ` · ${pct}%`}
                                            </div>
                                            {c.budget > 0 && (
                                                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-brand-700 overflow-hidden">
                                                    <div className={`h-full rounded-full ${pct>=100?'bg-emerald-500':'bg-brand-700'}`}
                                                        style={{ width: `${Math.min(pct||0, 100)}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* جدول التفاصيل */}
                            <Card>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-brand-800 text-white text-xs dark:bg-brand-900">
                                            <tr>
                                                <th className="px-3 py-3 text-right font-bold">الحساب</th>
                                                <th className="px-3 py-3 text-left font-bold">الميزانية</th>
                                                <th className="px-3 py-3 text-left font-bold">الفعلي</th>
                                                <th className="px-3 py-3 text-left font-bold">الفرق</th>
                                                <th className="px-3 py-3 text-center font-bold w-24">% التحقق</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cmpData.data.map((r, idx, arr) => {
                                                const prevType = idx > 0 ? arr[idx-1].type : null;
                                                const isNewSection = r.type !== prevType;
                                                return (
                                                    <React.Fragment key={r.account_id}>
                                                        {isNewSection && (
                                                            <tr className="bg-slate-50 dark:bg-brand-800/40 border-b border-slate-100 dark:border-brand-700">
                                                                <td className={`px-3 py-2 text-xs font-black ${r.type==='revenue'?'text-emerald-700 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`} colSpan={5}>
                                                                    {TYPE_LABELS[r.type]||r.type}
                                                                </td>
                                                            </tr>
                                                        )}
                                                        <tr className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                                            <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-brand-300">
                                                                <span className="font-mono text-[11px] text-slate-400 dark:text-brand-500 ml-2">{r.code}</span>{r.name}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-left tabular-nums font-bold text-slate-500 dark:text-brand-400" dir="ltr">
                                                                {r.budget > 0 ? money(r.budget) : <span className="text-slate-300 dark:text-brand-600">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-left tabular-nums font-bold text-brand-800 dark:text-brand-100" dir="ltr">{money(r.actual)}</td>
                                                            <td className={`px-3 py-2.5 text-left tabular-nums font-bold ${r.variance>=0?'text-emerald-700 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`} dir="ltr">{money(r.variance)}</td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {r.pct !== null ? (
                                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                                                                        ${r.pct>=100?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                                                                   :'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                                                                        {r.pct}%
                                                                    </span>
                                                                ) : <span className="text-slate-300 dark:text-brand-600 text-xs">—</span>}
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            {[
                                                { label:'إجمالي الإيرادات', b:cmpData.totals.rev_budget, a:cmpData.totals.rev_actual, v:cmpData.totals.rev_variance },
                                                { label:'إجمالي المصروفات', b:cmpData.totals.exp_budget, a:cmpData.totals.exp_actual, v:cmpData.totals.exp_variance },
                                                { label:'صافي الدخل',       b:cmpData.totals.net_budget, a:cmpData.totals.net_actual, v:cmpData.totals.net_variance },
                                            ].map(r => (
                                                <tr key={r.label} className="bg-slate-50 dark:bg-brand-800/60 font-black border-t-2 border-slate-200 dark:border-brand-600">
                                                    <td className="px-3 py-3 text-brand-800 dark:text-brand-100">{r.label}</td>
                                                    <td className="px-3 py-3 text-left tabular-nums text-slate-500 dark:text-brand-400" dir="ltr">{money(r.b)}</td>
                                                    <td className="px-3 py-3 text-left tabular-nums" dir="ltr">{money(r.a)}</td>
                                                    <td className={`px-3 py-3 text-left tabular-nums ${r.v>=0?'text-emerald-700 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`} dir="ltr">{money(r.v)}</td>
                                                    <td></td>
                                                </tr>
                                            ))}
                                        </tfoot>
                                    </table>
                                </div>
                            </Card>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  بيان التدفقات النقدية (الطريقة غير المباشرة)
// ════════════════════════════════════════════════════════════════════
function CashFlowTab({ accounts, toast }) {
    const [from, setFrom] = useState(() => todayISO().slice(0, 4) + '-01-01');
    const [to,   setTo  ] = useState(todayISO);
    const [data, setData] = useState(null);
    const [loading, setLoad] = useState(false);

    // مودال تصنيف الحسابات
    const [showCls, setShowCls]   = useState(false);
    const [clsEdits, setClsEdits] = useState({});
    const [clsBusy,  setClsBusy]  = useState(false);

    const load = useCallback(async () => {
        setLoad(true); setData(null);
        try {
            const r = await api('gl_cash_flow', { params: { from, to } });
            if (r.success) setData(r);
            else toast(r.message || 'خطأ في جلب البيانات', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setLoad(false); }
    }, [from, to]);

    const openCls = () => {
        const edits = {};
        accounts.filter(a => !Number(a.is_group) && !['revenue','expense'].includes(a.type))
                .forEach(a => { edits[a.id] = a.cf_section || 'none'; });
        setClsEdits(edits);
        setShowCls(true);
    };

    const saveCls = async () => {
        setClsBusy(true);
        try {
            const updates = Object.entries(clsEdits).map(([id, cf_section]) => ({ id: Number(id), cf_section }));
            const r = await api('gl_cf_section_save', { method: 'POST', body: { tenant_id: 1, updates } });
            if (r.success) { toast('تم حفظ التصنيفات', 'success'); setShowCls(false); load(); }
            else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setClsBusy(false); }
    };

    const bsAccounts = accounts.filter(a => !Number(a.is_group) && !['revenue','expense'].includes(a.type));

    const CFSection = ({ title, items, total, addItems = [] }) => (
        <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-slate-200 dark:bg-brand-700" />
                <span className="text-xs font-black text-slate-500 dark:text-brand-400 px-2 whitespace-nowrap">{title}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-brand-700" />
            </div>
            <div className="space-y-0.5">
                {addItems.map((ai, i) => (
                    <div key={i} className="flex justify-between py-1.5 px-3 text-sm">
                        <span className="text-slate-600 dark:text-brand-300 font-bold">{ai.label}</span>
                        <span className={`tabular-nums font-bold ${Number(ai.value) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                            {Number(ai.value) >= 0 ? '+' : ''}{money(ai.value)}
                        </span>
                    </div>
                ))}
                {items.map(item => (
                    <div key={item.id} className="flex justify-between py-1.5 px-3 text-sm hover:bg-slate-50 dark:hover:bg-brand-800 rounded-xl transition">
                        <span className="text-slate-600 dark:text-brand-300">
                            <span className="font-mono text-[11px] text-slate-400 dark:text-brand-600 ml-2" dir="ltr">{item.code}</span>
                            {item.name}
                        </span>
                        <span className={`tabular-nums font-bold ${item.cf >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                            {item.cf >= 0 ? '+' : ''}{money(item.cf)}
                        </span>
                    </div>
                ))}
                {items.length === 0 && addItems.length === 0 && (
                    <div className="text-center py-3 text-slate-300 dark:text-brand-700 text-sm font-bold">لا يوجد بنود مصنّفة في هذا القسم</div>
                )}
            </div>
            <div className="flex justify-between items-center mt-2 px-3 py-2.5 bg-slate-50 dark:bg-brand-800/60 rounded-2xl border border-slate-100 dark:border-brand-700 font-black">
                <span className="text-brand-800 dark:text-brand-100">{title}</span>
                <span className={`tabular-nums text-lg ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                    {total >= 0 ? '+' : ''}{money(total)} <span className="text-sm font-bold text-slate-400">﷼</span>
                </span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4" dir="rtl">
            {/* أدوات التصفية */}
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                </div>
                <Btn color="navy" onClick={load} disabled={loading}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} عرض
                </Btn>
                <Btn color="gray" size="sm" onClick={openCls}>
                    <Settings size={14} /> تصنيف الحسابات
                </Btn>
                {data && <>
                    <Btn color="gray" size="sm" onClick={() => downloadCSV('cash_flow.csv', ['البيان', 'المبلغ (ريال)'], [
                        ['صافي الدخل', data.net_income],
                        ['الإهلاك (تعديل)', data.depreciation],
                        ...data.operating.items.map(r => [r.name, r.cf]),
                        ['إجمالي الأنشطة التشغيلية', data.operating.total],
                        ...data.investing.items.map(r => [r.name, r.cf]),
                        ['إجمالي الأنشطة الاستثمارية', data.investing.total],
                        ...data.financing.items.map(r => [r.name, r.cf]),
                        ['إجمالي الأنشطة التمويلية', data.financing.total],
                        ['صافي التغير في النقدية', data.net_change],
                    ])}>
                        <Download size={14} /> CSV
                    </Btn>
                    <Btn color="gray" size="sm" onClick={() => {
                        const row = (lbl, val, bold) => `<tr${bold?' class="tot"':''}><td>${lbl}</td><td style="text-align:left;direction:ltr">${money(val)} ﷼</td></tr>`;
                        const mapR = arr => arr.map(r => row(r.name, r.cf)).join('');
                        printHtml('بيان التدفقات النقدية',
                            `<style>.tot td{font-weight:900;background:#f8fafc;border-top:2px solid #e2e8f0}</style>
                             <h1>بيان التدفقات النقدية (الطريقة غير المباشرة)</h1>
                             <h2>الفترة: ${data.period.from} — ${data.period.to}</h2>
                             <table><thead><tr><th>البيان</th><th style="text-align:left">المبلغ (ريال)</th></tr></thead><tbody>
                             <tr><td colspan="2"><strong>أولاً: الأنشطة التشغيلية</strong></td></tr>
                             ${row('صافي الدخل', data.net_income)}
                             ${data.depreciation ? row('يُضاف: الإهلاك', data.depreciation) : ''}
                             ${mapR(data.operating.items)}
                             ${row('إجمالي التشغيلية', data.operating.total, true)}
                             <tr><td colspan="2"><strong>ثانياً: الأنشطة الاستثمارية</strong></td></tr>
                             ${mapR(data.investing.items)}
                             ${row('إجمالي الاستثمارية', data.investing.total, true)}
                             <tr><td colspan="2"><strong>ثالثاً: الأنشطة التمويلية</strong></td></tr>
                             ${mapR(data.financing.items)}
                             ${row('إجمالي التمويلية', data.financing.total, true)}
                             ${row('صافي التغير في النقدية', data.net_change, true)}
                             ${(data.cash_opening || data.cash_closing) ? row('رصيد النقدية أول الفترة', data.cash_opening) + row('رصيد النقدية آخر الفترة', data.cash_closing, true) : ''}
                             </tbody></table>`
                        );
                    }}>
                        <Printer size={14} /> طباعة
                    </Btn>
                </>}
            </div>

            {loading ? (
                <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-slate-400" size={30} /></div>
            ) : !data ? (
                <Card>
                    <div className="text-center py-16 text-slate-300 dark:text-brand-600 font-bold">
                        <Activity size={36} className="mx-auto mb-3 opacity-40" />
                        اختر الفترة واضغط «عرض» لاستعراض بيان التدفقات النقدية
                        <div className="mt-2 text-sm text-slate-400 dark:text-brand-500 font-bold">
                            الطريقة غير المباشرة — صنّف حساباتك أولاً عبر «تصنيف الحسابات»
                        </div>
                    </div>
                </Card>
            ) : (
                <>
                    {/* KPI summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'التشغيلية',   val: data.operating.total },
                            { label: 'الاستثمارية', val: data.investing.total },
                            { label: 'التمويلية',   val: data.financing.total },
                            { label: 'صافي التغير', val: data.net_change      },
                        ].map(c => {
                            const pos = Number(c.val) >= 0;
                            return (
                                <div key={c.label} className={`rounded-2xl p-4 border text-center ${pos ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'}`}>
                                    <div className={`text-[11px] font-bold mb-1 ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{c.label}</div>
                                    <div className={`text-xl font-black ${pos ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`} dir="ltr">{pos ? '+' : ''}{money(c.val)} ﷼</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Statement body */}
                    <Card>
                        <div className="text-center mb-5">
                            <div className="text-lg font-black text-brand-800 dark:text-brand-100">بيان التدفقات النقدية</div>
                            <div className="text-sm text-slate-400 dark:text-brand-500 font-bold mt-1">الطريقة غير المباشرة · {data.period.from} ← {data.period.to}</div>
                        </div>

                        <CFSection
                            title="الأنشطة التشغيلية"
                            items={data.operating.items}
                            total={data.operating.total}
                            addItems={[
                                { label: 'صافي الدخل',              value: data.net_income   },
                                ...(data.depreciation ? [{ label: 'يُضاف: الإهلاك (بند غير نقدي)', value: data.depreciation }] : []),
                            ]}
                        />
                        <CFSection title="الأنشطة الاستثمارية" items={data.investing.items} total={data.investing.total} />
                        <CFSection title="الأنشطة التمويلية"   items={data.financing.items} total={data.financing.total} />

                        {/* Summary box */}
                        <div className="mt-4 p-4 rounded-2xl bg-brand-800 dark:bg-brand-700 text-white space-y-2">
                            <div className="flex justify-between font-black text-lg">
                                <span>صافي التغير في النقدية</span>
                                <span dir="ltr">{Number(data.net_change) >= 0 ? '+' : ''}{money(data.net_change)} ﷼</span>
                            </div>
                            {(Number(data.cash_opening) !== 0 || Number(data.cash_closing) !== 0) && (
                                <>
                                    <div className="h-px bg-white/20" />
                                    <div className="flex justify-between text-sm font-bold text-white/80">
                                        <span>رصيد النقدية في بداية الفترة</span>
                                        <span dir="ltr">{money(data.cash_opening)} ﷼</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-white/80">
                                        <span>رصيد النقدية في نهاية الفترة</span>
                                        <span dir="ltr">{money(data.cash_closing)} ﷼</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                </>
            )}

            {/* مودال تصنيف الحسابات */}
            {showCls && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setShowCls(false)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()} dir="rtl">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">تصنيف حسابات التدفق النقدي</h3>
                            <button onClick={() => setShowCls(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="text-xs font-bold text-slate-400 dark:text-brand-500 mb-4 p-3 bg-slate-50 dark:bg-brand-800 rounded-xl leading-relaxed">
                            <strong className="text-brand-800 dark:text-brand-100">💵 نقدية</strong> = حسابات النقد والبنك ·
                            <strong className="text-brand-800 dark:text-brand-100"> 🔄 تشغيلي</strong> = مدينون، دائنون، مخزون ·
                            <strong className="text-brand-800 dark:text-brand-100"> 📦 استثماري</strong> = أصول ثابتة، استثمارات ·
                            <strong className="text-brand-800 dark:text-brand-100"> 🏦 تمويلي</strong> = قروض، حقوق ملكية
                        </div>
                        <div className="space-y-0.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-[1fr_136px] gap-2 text-[11px] font-black text-slate-400 dark:text-brand-500 pb-2 border-b border-slate-100 dark:border-brand-700 px-2">
                                <span>الحساب</span><span>التصنيف</span>
                            </div>
                            {bsAccounts.map(a => (
                                <div key={a.id} className="grid grid-cols-[1fr_136px] gap-2 items-center hover:bg-slate-50 dark:hover:bg-brand-800 rounded-xl px-2 py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-[11px] text-slate-400 dark:text-brand-600 shrink-0" dir="ltr">{a.code}</span>
                                        <span className="text-sm font-bold text-brand-800 dark:text-brand-100 truncate">{a.name}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                            a.type === 'asset'     ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                          : a.type === 'liability' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                          :                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                        }`}>
                                            {a.type === 'asset' ? 'أصول' : a.type === 'liability' ? 'خصوم' : 'حقوق'}
                                        </span>
                                    </div>
                                    <select value={clsEdits[a.id] || 'none'}
                                        onChange={e => setClsEdits(p => ({...p, [a.id]: e.target.value}))}
                                        className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-brand-700 text-xs font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059] w-full">
                                        <option value="none">غير مصنّف</option>
                                        <option value="cash">💵 نقدية</option>
                                        <option value="operating">🔄 تشغيلي</option>
                                        <option value="investing">📦 استثماري</option>
                                        <option value="financing">🏦 تمويلي</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-brand-700">
                            <Btn color="gray" onClick={() => setShowCls(false)}>إلغاء</Btn>
                            <Btn color="navy" onClick={saveCls} disabled={clsBusy}>
                                {clsBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                حفظ التصنيفات
                            </Btn>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  الأصول الثابتة
// ════════════════════════════════════════════════════════════════════
function FixedAssetsTab({ accounts, toast }) {
    const [sub, setSub]         = useState('list');
    const [assets, setAssets]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy]       = useState(false);

    // ترحيل الإهلاك
    const [deprAsset,    setDeprAsset]    = useState('');
    const [deprPeriod,   setDeprPeriod]   = useState(() => todayISO().slice(0, 7));
    const [deprResult,   setDeprResult]   = useState(null);
    const [deprBusy,     setDeprBusy]     = useState(false);
    const [batchResult,  setBatchResult]  = useState(null);
    const [batchBusy,    setBatchBusy]    = useState(false);

    // جدول الإهلاك
    const [schedAsset, setSchedAsset] = useState('');
    const [schedData,  setSchedData]  = useState(null);
    const [schedBusy,  setSchedBusy]  = useState(false);

    const DEPR_LABELS = { straight_line: 'القسط الثابت', declining: 'القسط المتناقص' };

    const blankForm = () => ({
        id: 0, code: '', name: '', cost: '', residual_value: 0,
        purchase_date: todayISO(), useful_life_months: 60,
        depreciation_method: 'straight_line',
        gl_account_id: '', accum_depr_account_id: '', expense_account_id: '',
        notes: '',
    });

    const loadAssets = useCallback(async () => {
        setLoading(true);
        try { const r = await api('gl_assets'); if (r.success) setAssets(r.data || []); }
        catch { /* صامت */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAssets(); }, [loadAssets]);

    const saveAsset = async () => {
        if (!editing.name.trim()) return toast('الاسم مطلوب', 'error');
        if (!editing.cost || Number(editing.cost) <= 0) return toast('التكلفة مطلوبة', 'error');
        setBusy(true);
        try {
            const r = await api('gl_asset_save', { method: 'POST', body: { ...editing, tenant_id: 1 } });
            if (r.success) { toast('تم الحفظ بنجاح', 'success'); setEditing(null); loadAssets(); }
            else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setBusy(false); }
    };

    const runDepr = async () => {
        if (!deprAsset) return toast('اختر الأصل', 'error');
        if (!deprPeriod) return toast('اختر الشهر', 'error');
        setDeprBusy(true); setDeprResult(null);
        try {
            const r = await api('gl_asset_depreciate', { method: 'POST', body: { tenant_id: 1, asset_id: Number(deprAsset), period: deprPeriod + '-01' } });
            if (r.success) { toast(r.message, 'success'); setDeprResult(r); loadAssets(); }
            else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setDeprBusy(false); }
    };

    const runBatch = async () => {
        if (!deprPeriod) return toast('اختر الشهر أولاً', 'error');
        setBatchBusy(true); setBatchResult(null);
        try {
            const r = await api('gl_assets_depreciate_batch', { method: 'POST', body: { tenant_id: 1, period: deprPeriod + '-01' } });
            if (r.success && r.posted?.length > 0) {
                toast(r.message, 'success');
                setBatchResult(r);
                loadAssets();
            } else {
                toast(r.message || 'لا توجد أصول مؤهلة للترحيل في هذا الشهر', 'error');
                if (r.errors?.length) setBatchResult(r);
            }
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setBatchBusy(false); }
    };

    const loadSchedule = useCallback(async (aid) => {
        if (!aid) return;
        setSchedBusy(true); setSchedData(null);
        try {
            const r = await api('gl_asset_schedule', { params: { id: aid } });
            if (r.success) setSchedData(r);
            else toast(r.message || 'خطأ', 'error');
        } catch { toast('خطأ في الاتصال', 'error'); }
        finally { setSchedBusy(false); }
    }, [toast]);

    // ── نموذج الأصل (عودة مبكرة) ──────────────────────────────────
    if (editing) return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">
                    {editing.id ? 'تعديل أصل ثابت' : 'إضافة أصل ثابت جديد'}
                </h3>
                <Btn color="gray" size="sm" onClick={() => setEditing(null)}><X size={14} /> إلغاء</Btn>
            </div>
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الاسم *</label>
                        <input value={editing.name} onChange={e => setEditing(p => ({...p, name: e.target.value}))}
                            placeholder="مثال: سيارة توصيل، حاسوب، معدة..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الكود</label>
                        <input value={editing.code} onChange={e => setEditing(p => ({...p, code: e.target.value}))}
                            placeholder="FA-001"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">التكلفة (ريال) *</label>
                        <input type="number" min="0" step="0.01" value={editing.cost} onChange={e => setEditing(p => ({...p, cost: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">القيمة التخريدية (ريال)</label>
                        <input type="number" min="0" step="0.01" value={editing.residual_value} onChange={e => setEditing(p => ({...p, residual_value: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">تاريخ الشراء</label>
                        <input type="date" value={editing.purchase_date} onChange={e => setEditing(p => ({...p, purchase_date: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">العمر الإنتاجي (أشهر)</label>
                        <input type="number" min="1" value={editing.useful_life_months} onChange={e => setEditing(p => ({...p, useful_life_months: Number(e.target.value)}))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">طريقة الإهلاك</label>
                        <select value={editing.depreciation_method} onChange={e => setEditing(p => ({...p, depreciation_method: e.target.value}))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]">
                            <option value="straight_line">القسط الثابت (Straight-Line)</option>
                            <option value="declining">القسط المتناقص (Declining Balance)</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">حساب الأصل في الميزانية</label>
                                <AccountCombobox accounts={accounts} value={editing.gl_account_id} onChange={v => setEditing(p => ({...p, gl_account_id: v}))} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">حساب مجمّع الإهلاك</label>
                                <AccountCombobox accounts={accounts} value={editing.accum_depr_account_id} onChange={v => setEditing(p => ({...p, accum_depr_account_id: v}))} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">حساب مصروف الإهلاك</label>
                                <AccountCombobox accounts={accounts} value={editing.expense_account_id} onChange={v => setEditing(p => ({...p, expense_account_id: v}))} />
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">ملاحظات</label>
                        <textarea value={editing.notes} onChange={e => setEditing(p => ({...p, notes: e.target.value}))} rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059] resize-none" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-brand-700">
                    <Btn color="gray" onClick={() => setEditing(null)}>إلغاء</Btn>
                    <Btn color="navy" onClick={saveAsset} disabled={busy}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ الأصل
                    </Btn>
                </div>
            </Card>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* تبويبات فرعية */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'list',     label: `سجل الأصول${assets.length ? ` (${assets.length})` : ''}` },
                    { id: 'depr',     label: 'ترحيل الإهلاك' },
                    { id: 'schedule', label: 'جدول الإهلاك' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSub(s.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition border ${
                            sub === s.id
                                ? 'bg-brand-800 text-white border-brand-800 dark:bg-brand-700 dark:border-brand-600'
                                : 'border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059]'
                        }`}>{s.label}</button>
                ))}
            </div>

            {/* ── سجل الأصول ─────────────────────────────────── */}
            {sub === 'list' && (
                <>
                    <div className="flex justify-end">
                        <Btn color="navy" size="sm" onClick={() => setEditing(blankForm())}>
                            <Plus size={14} /> أصل جديد
                        </Btn>
                    </div>
                    <Card>
                        {loading ? (
                            <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-slate-400" size={28} /></div>
                        ) : assets.length === 0 ? (
                            <div className="text-center py-14 text-slate-400 dark:text-brand-500 font-bold">لا توجد أصول ثابتة مسجّلة — ابدأ بإضافة أصل جديد</div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[12px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                            <th className="text-right py-3 px-3">الكود</th>
                                            <th className="text-right py-3 px-3">الاسم</th>
                                            <th className="text-left py-3 px-3">التكلفة</th>
                                            <th className="text-left py-3 px-3">القيمة الدفترية</th>
                                            <th className="text-right py-3 px-3">تاريخ الشراء</th>
                                            <th className="text-right py-3 px-3">طريقة الإهلاك</th>
                                            <th className="text-center py-3 px-3">مرحّل/الكل</th>
                                            <th className="py-3 px-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map(a => (
                                            <tr key={a.id} className={`border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition ${a.disposed_at ? 'opacity-50' : ''}`}>
                                                <td className="py-2.5 px-3 font-mono text-xs text-slate-500 dark:text-brand-400">{a.code || '—'}</td>
                                                <td className="py-2.5 px-3 font-bold text-brand-800 dark:text-brand-100">
                                                    {a.name}
                                                    {a.disposed_at && <span className="mr-2 text-[11px] text-rose-500 font-bold">(مستبعد)</span>}
                                                </td>
                                                <td className="py-2.5 px-3 text-left tabular-nums" dir="ltr">{money(a.cost)}</td>
                                                <td className={`py-2.5 px-3 text-left tabular-nums font-black ${Number(a.book_value) <= Number(a.residual_value || 0) ? 'text-slate-400 dark:text-brand-600' : 'text-emerald-600 dark:text-emerald-400'}`} dir="ltr">{money(a.book_value)}</td>
                                                <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap" dir="ltr">{a.purchase_date}</td>
                                                <td className="py-2.5 px-3 text-xs font-bold text-slate-600 dark:text-brand-300">{DEPR_LABELS[a.depreciation_method] || a.depreciation_method}</td>
                                                <td className="py-2.5 px-3 text-center tabular-nums text-[12px] font-bold">
                                                    <span className={Number(a.depr_count) >= Number(a.useful_life_months) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-brand-400'}>
                                                        {a.depr_count}/{a.useful_life_months}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <button onClick={() => setEditing({ id: Number(a.id), code: a.code||'', name: a.name, cost: a.cost, residual_value: a.residual_value, purchase_date: a.purchase_date, useful_life_months: Number(a.useful_life_months), depreciation_method: a.depreciation_method, gl_account_id: a.gl_account_id||'', accum_depr_account_id: a.accum_depr_account_id||'', expense_account_id: a.expense_account_id||'', notes: a.notes||'' })}
                                                        className="text-slate-400 dark:text-brand-500 hover:text-[#c5a059] transition"><Edit2 size={15} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}

            {/* ── ترحيل الإهلاك ───────────────────────────────── */}
            {sub === 'depr' && (
                <Card>
                    <h4 className="font-black text-brand-800 dark:text-brand-100 mb-4">ترحيل قيد إهلاك شهري</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الأصل الثابت</label>
                            <select value={deprAsset} onChange={e => { setDeprAsset(e.target.value); setDeprResult(null); }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]">
                                <option value="">— اختر الأصل —</option>
                                {assets.filter(a => !a.disposed_at && Number(a.depr_count) < Number(a.useful_life_months)).map(a => (
                                    <option key={a.id} value={a.id}>{a.name} — قيمة دفترية: {money(a.book_value)} ﷼</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الشهر</label>
                            <input type="month" value={deprPeriod} onChange={e => { setDeprPeriod(e.target.value); setDeprResult(null); }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <Btn color="gold" onClick={runDepr} disabled={deprBusy || !deprAsset || !deprPeriod}>
                            {deprBusy ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                            ترحيل إهلاك الشهر
                        </Btn>
                    </div>
                    {deprResult && (
                        <div className="mt-5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black mb-3">
                                <CheckCircle2 size={18} /> تم الترحيل بنجاح
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                {[
                                    { label: 'رقم القيد',            val: deprResult.entry_no,         mono: true },
                                    { label: 'مبلغ الإهلاك',         val: money(deprResult.depr_amount) + ' ﷼' },
                                    { label: 'القيمة الدفترية بعده', val: money(deprResult.book_value_after) + ' ﷼' },
                                ].map(c => (
                                    <div key={c.label} className="bg-white dark:bg-brand-900 rounded-xl p-3 border border-emerald-100 dark:border-emerald-500/20">
                                        <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                        <div className={`font-black text-brand-800 dark:text-brand-100 ${c.mono ? 'font-mono text-sm' : 'text-base'}`}>{c.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ترحيل دُفعي لكل الأصول ── */}
                    <div className="mt-6 pt-5 border-t border-slate-100 dark:border-brand-700">
                        <h4 className="font-black text-brand-800 dark:text-brand-100 mb-1">ترحيل إهلاك جميع الأصول دفعةً واحدة</h4>
                        <p className="text-[12px] text-slate-500 dark:text-brand-400 mb-4">يُرحّل قيد إهلاك لكل أصل نشط لم يُرحَّل بعد في الشهر المحدد أعلاه.</p>
                        <Btn color="navy" onClick={runBatch} disabled={batchBusy || !deprPeriod}>
                            {batchBusy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                            ترحيل إهلاك الكل
                        </Btn>
                    </div>

                    {batchResult && (
                        <div className="mt-5 space-y-3">
                            {batchResult.posted?.length > 0 && (
                                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                                            <CheckCircle2 size={16} /> تم ترحيل {batchResult.posted.length} أصل
                                        </span>
                                        <span className="text-[12px] font-bold text-slate-500 dark:text-brand-400">
                                            إجمالي: {money(batchResult.posted.reduce((s, r) => s + Number(r.amount), 0))} ﷼
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-slate-400 dark:text-brand-500 font-black border-b border-emerald-100 dark:border-emerald-500/20">
                                                    <th className="text-right py-1.5 px-2">الأصل</th>
                                                    <th className="text-left py-1.5 px-2">مبلغ الإهلاك</th>
                                                    <th className="text-left py-1.5 px-2">القيمة الدفترية بعده</th>
                                                    <th className="text-right py-1.5 px-2">رقم القيد</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batchResult.posted.map((r, i) => (
                                                    <tr key={i} className="border-b border-emerald-50 dark:border-emerald-500/10">
                                                        <td className="py-1.5 px-2 font-bold text-brand-800 dark:text-brand-100">{r.asset}</td>
                                                        <td className="py-1.5 px-2 text-left tabular-nums" dir="ltr">{money(r.amount)} ﷼</td>
                                                        <td className="py-1.5 px-2 text-left tabular-nums" dir="ltr">{money(r.book_value_after)} ﷼</td>
                                                        <td className="py-1.5 px-2 font-mono text-slate-500 dark:text-brand-400">{r.entry_no}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            {batchResult.errors?.length > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                                    <div className="font-black text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
                                        <AlertCircle size={15} /> أخطاء ({batchResult.errors.length})
                                    </div>
                                    <ul className="space-y-1">
                                        {batchResult.errors.map((e, i) => (
                                            <li key={i} className="text-xs font-bold text-rose-600 dark:text-rose-400 flex gap-2">
                                                <span className="shrink-0">·</span>
                                                <span>{e.asset}: {e.error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {/* ── جدول الإهلاك ────────────────────────────────── */}
            {sub === 'schedule' && (
                <Card>
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                        <div className="flex-1 min-w-48">
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">الأصل الثابت</label>
                            <select value={schedAsset} onChange={e => { setSchedAsset(e.target.value); loadSchedule(e.target.value); }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm text-brand-800 dark:text-brand-100 dark:bg-brand-900 outline-none focus:border-[#c5a059]">
                                <option value="">— اختر الأصل —</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        {schedData && (
                            <>
                                <Btn color="gray" size="sm" onClick={() => downloadCSV(
                                    `schedule_${schedData.asset.name}.csv`,
                                    ['#', 'الفترة', 'مبلغ الإهلاك', 'القيمة الدفترية', 'مرحّل'],
                                    schedData.schedule.map((r, i) => [i + 1, r.period.slice(0, 7), r.depr_amount, r.book_value, r.posted ? 'نعم' : 'لا'])
                                )}>
                                    <Download size={14} /> CSV
                                </Btn>
                                <Btn color="gray" size="sm" onClick={() => {
                                    const rows = schedData.schedule.map((r, i) =>
                                        `<tr class="${r.posted ? 'posted' : ''}"><td>${i+1}</td><td dir="ltr">${r.period.slice(0,7)}</td><td style="text-align:left" dir="ltr">${money(r.depr_amount)}</td><td style="text-align:left" dir="ltr">${money(r.book_value)}</td><td style="text-align:center">${r.posted ? '✓' : '—'}</td></tr>`
                                    ).join('');
                                    printHtml(`جدول إهلاك: ${schedData.asset.name}`,
                                        `<style>.posted td{background:#f0fdf4}</style>
                                         <h1>جدول الإهلاك: ${schedData.asset.name}</h1>
                                         <h2>التكلفة: ${money(schedData.asset.cost)} ﷼ — العمر الإنتاجي: ${schedData.asset.useful_life_months} شهر</h2>
                                         <table><thead><tr><th>#</th><th>الفترة</th><th style="text-align:left">الإهلاك</th><th style="text-align:left">القيمة الدفترية</th><th style="text-align:center">مرحّل</th></tr></thead><tbody>${rows}</tbody></table>`
                                    );
                                }}>
                                    <Printer size={14} /> طباعة
                                </Btn>
                            </>
                        )}
                    </div>
                    {schedBusy ? (
                        <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-slate-400" size={24} /></div>
                    ) : !schedData ? (
                        <div className="text-center py-14 text-slate-300 dark:text-brand-600 font-bold">اختر أصلاً لعرض جدول الإهلاك الكامل</div>
                    ) : (() => {
                        const lastPosted = [...schedData.schedule].reverse().find(r => r.posted);
                        const currentBV  = lastPosted ? Number(lastPosted.book_value) : Number(schedData.asset.cost);
                        const totalDepr  = schedData.schedule.filter(r => r.posted).reduce((s, r) => s + Number(r.depr_amount), 0);
                        return (
                            <>
                                <div className="grid grid-cols-3 gap-3 mb-5">
                                    {[
                                        { label: 'التكلفة الأصلية',       val: schedData.asset.cost },
                                        { label: 'الإهلاك المتراكم المرحّل', val: totalDepr },
                                        { label: 'القيمة الدفترية الحالية', val: currentBV },
                                    ].map(c => (
                                        <div key={c.label} className="bg-slate-50 dark:bg-brand-800/40 rounded-2xl p-3 border border-slate-100 dark:border-brand-700 text-center">
                                            <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{c.label}</div>
                                            <div className="text-xl font-black text-brand-800 dark:text-brand-100">{money(c.val)} <span className="text-sm font-bold text-slate-400">﷼</span></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[12px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                                <th className="text-right py-3 px-3">#</th>
                                                <th className="text-right py-3 px-3">الفترة</th>
                                                <th className="text-left py-3 px-3">الإهلاك</th>
                                                <th className="text-left py-3 px-3">القيمة الدفترية</th>
                                                <th className="text-center py-3 px-3">مرحّل</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedData.schedule.map((r, i) => (
                                                <tr key={i} className={`border-b border-slate-50 dark:border-brand-700 transition ${r.posted ? 'bg-emerald-50/40 dark:bg-emerald-500/5' : 'hover:bg-slate-50/60 dark:hover:bg-brand-800'}`}>
                                                    <td className="py-2 px-3 text-[12px] text-slate-400 dark:text-brand-600 tabular-nums">{i + 1}</td>
                                                    <td className="py-2 px-3 font-bold text-slate-600 dark:text-brand-300" dir="ltr">{r.period.slice(0, 7)}</td>
                                                    <td className="py-2 px-3 text-left tabular-nums font-bold text-slate-700 dark:text-brand-200" dir="ltr">{money(r.depr_amount)}</td>
                                                    <td className="py-2 px-3 text-left tabular-nums font-black text-brand-800 dark:text-brand-100" dir="ltr">{money(r.book_value)}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        {r.posted
                                                            ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[12px] font-bold"><CheckCircle2 size={13} /> مرحّل</span>
                                                            : <span className="text-slate-300 dark:text-brand-700 text-xs">—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        );
                    })()}
                </Card>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  تبويب التدقيق المالي — سجل أحداث محاسبية مع مستوى خطورة + diff
// ════════════════════════════════════════════════════════════════════════════
const AUDIT_ENTITIES = ['entry','invoice','payment','gl','zatca','migration','settings','reclass'];
const AUDIT_ENTITY_LABELS = {
    entry:'القيود', invoice:'الفواتير', payment:'السندات',
    gl:'دفتر الأستاذ', zatca:'زاتكا', migration:'الاستيراد',
    settings:'الإعدادات', reclass:'إعادة تصنيف',
};
const AUDIT_ACTION_META = {
    create:      { label:'إنشاء',     cls:'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
    update:      { label:'تعديل',     cls:'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    delete:      { label:'حذف',       cls:'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
    void:        { label:'إلغاء',     cls:'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
    post:        { label:'ترحيل',     cls:'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' },
    reverse:     { label:'عكس',       cls:'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
    close_year:  { label:'إقفال سنة', cls:'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
    reopen_year: { label:'فتح سنة',   cls:'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
    zatca_stamp: { label:'ختم ZATCA', cls:'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300' },
    save:        { label:'حفظ إعدادات',cls:'bg-slate-50 text-slate-600 dark:bg-brand-800 dark:text-brand-300' },
};
const AUDIT_RISK = {
    4:{ label:'حرج',   dot:'bg-red-500',    cls:'text-red-700 dark:text-red-400' },
    3:{ label:'عالي',  dot:'bg-orange-500', cls:'text-orange-700 dark:text-orange-400' },
    2:{ label:'متوسط', dot:'bg-amber-400',  cls:'text-amber-700 dark:text-amber-400' },
    1:{ label:'منخفض', dot:'bg-slate-400',  cls:'text-slate-500 dark:text-brand-500' },
};
const auditFmtAgo = s => {
    if (!s) return '—';
    try {
        const sec = Math.floor((Date.now() - new Date(s.replace(' ','T'))) / 1000);
        if (sec < 60)    return 'منذ ثوانٍ';
        if (sec < 3600)  return `منذ ${Math.floor(sec/60)} د`;
        if (sec < 86400) return `منذ ${Math.floor(sec/3600)} س`;
        const d = new Date(s.replace(' ','T'));
        return d.toLocaleDateString('ar-SA', { month:'short', day:'numeric' }) + ' ' + d.toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' });
    } catch { return s; }
};

function AuditTab({ toast }) {
    const [rows,     setRows]     = useState([]);
    const [total,    setTotal]    = useState(0);
    const [page,     setPage]     = useState(1);
    const [loading,  setLoading]  = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [q,        setQ]        = useState('');
    const [ent,      setEnt]      = useState('');
    const [risk,     setRisk]     = useState('');
    const [from,     setFrom]     = useState('');
    const [to,       setTo]       = useState('');
    const PER = 50;

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const body = { q, from, to, page: p, per: PER,
                entity: ent || AUDIT_ENTITIES.join(','), // placeholder — backend filters by list
            };
            if (risk) body.risk = risk;
            // استخدم entity list via repeated param أو filter client-side
            const r = await api('activity_log', { method: 'POST', body: {
                ...body,
                entity: ent || '',  // فارغ = كل
                q: ent ? q : (q ? q : AUDIT_ENTITIES.join(' ')),
            }});
            // filter client-side to financial entities
            const data = (r.data || []).filter(x => !ent ? AUDIT_ENTITIES.includes(x.entity) : x.entity === ent);
            setRows(data);
            setTotal(r.total || 0);
            setPage(r.page || p);
        } catch (e) { toast?.(e.message, 'error'); }
        finally { setLoading(false); }
    }, [q, ent, risk, from, to]);

    // Better: use entity filter + risk filter properly
    const loadProper = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            // load each entity type in one call by passing no entity filter then client-filter
            const body = { page: p, per: 200, from, to };
            if (risk) body.risk = risk;
            if (ent)  body.entity = ent;
            if (q)    body.q = q;
            const r = await api('activity_log', { method: 'POST', body });
            const data = (r.data || []).filter(x => AUDIT_ENTITIES.includes(x.entity));
            setRows(data);
            setTotal(data.length);
            setPage(p);
        } catch (e) { toast?.(e.message, 'error'); }
        finally { setLoading(false); }
    }, [q, ent, risk, from, to]);

    useEffect(() => { loadProper(1); }, []); // eslint-disable-line

    const apply = () => loadProper(1);
    const reset = () => { setQ(''); setEnt(''); setRisk(''); setFrom(''); setTo(''); setTimeout(() => loadProper(1), 0); };

    const exportCSV = () => {
        const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const hdrs = ['الوقت','المستخدم','القسم','العملية','التفاصيل','IP','الخطورة','هاش'];
        const data = rows.map(r => [
            r.created_at, r.actor||'', AUDIT_ENTITY_LABELS[r.entity]||r.entity,
            AUDIT_ACTION_META[r.action]?.label || r.action,
            r.detail||'', r.ip_address||'',
            AUDIT_RISK[r.risk_level]?.label||'', r.row_hash||'',
        ]);
        const csv = '﻿' + [hdrs, ...data].map(row => row.map(esc).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `financial_audit_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* فلاتر */}
            <div className="flex flex-wrap items-end gap-2 no-print">
                <div className="relative">
                    <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()}
                        placeholder="بحث…" className="pr-8 pl-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] w-44" />
                </div>
                <select value={ent} onChange={e => setEnt(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059]">
                    <option value="">كل الأقسام</option>
                    {AUDIT_ENTITIES.map(k => <option key={k} value={k}>{AUDIT_ENTITY_LABELS[k]||k}</option>)}
                </select>
                <select value={risk} onChange={e => setRisk(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059]">
                    <option value="">كل الخطورة</option>
                    <option value="4">🔴 حرج فأعلى</option>
                    <option value="3">🟠 عالي فأعلى</option>
                    <option value="2">🟡 متوسط فأعلى</option>
                </select>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059]" />
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059]" />
                <button onClick={apply}
                    className="px-4 py-2 rounded-xl text-sm font-black bg-brand-800 text-white hover:bg-brand-900 transition">
                    تطبيق
                </button>
                <button onClick={reset}
                    className="px-3 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-rose-400 hover:text-rose-500 transition">
                    <X size={14} />
                </button>
                <div className="flex-1" />
                <button onClick={exportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition">
                    <Download size={14} /> تصدير CSV
                </button>
                <button onClick={() => loadProper(1)} disabled={loading}
                    className="p-2 rounded-xl border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-[#c5a059] transition">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* الجدول */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm overflow-hidden">
                {loading ? <div className="py-16 text-center text-slate-400 dark:text-brand-500"><RefreshCw className="animate-spin mx-auto" size={28} /></div>
                : rows.length === 0 ? <div className="py-16 text-center text-slate-300 dark:text-brand-700 font-bold text-sm">لا توجد أحداث مطابقة</div>
                : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-[11px] font-black text-slate-400 dark:text-brand-500 border-b border-slate-100 dark:border-brand-700">
                                    <th className="text-right px-3 py-3">الوقت</th>
                                    <th className="text-right px-3 py-3">الفاعل</th>
                                    <th className="text-right px-3 py-3">القسم</th>
                                    <th className="text-right px-3 py-3">العملية</th>
                                    <th className="text-right px-3 py-3">الخطورة</th>
                                    <th className="text-right px-3 py-3">التفاصيل</th>
                                    <th className="text-right px-3 py-3 hidden md:table-cell">IP</th>
                                    <th className="w-8 px-2 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const am = AUDIT_ACTION_META[r.action] || { label: r.action, cls: 'bg-slate-50 text-slate-600 dark:bg-brand-800 dark:text-brand-300' };
                                    const rm = AUDIT_RISK[r.risk_level] || AUDIT_RISK[1];
                                    const isOpen = expanded === r.id;
                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr className={`border-b border-slate-50 dark:border-brand-800 transition ${isOpen ? 'bg-slate-50/80 dark:bg-brand-800/50' : 'hover:bg-slate-50/60 dark:hover:bg-brand-800/30'}`}>
                                                <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap">{auditFmtAgo(r.created_at)}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold text-brand-800 dark:text-brand-100 max-w-[100px] truncate">{r.actor || '—'}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-brand-200">{AUDIT_ENTITY_LABELS[r.entity]||r.entity}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${am.cls}`}>{am.label}</span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-black ${rm.cls}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${rm.dot} shrink-0`} />{rm.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-brand-200 max-w-[200px] truncate">{r.detail || '—'}</td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-slate-400 dark:text-brand-600 whitespace-nowrap hidden md:table-cell" dir="ltr">{r.ip_address || '—'}</td>
                                                <td className="px-2 py-2.5">
                                                    <button onClick={() => setExpanded(isOpen ? null : r.id)}
                                                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-700 text-slate-400 dark:text-brand-500 transition">
                                                        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="border-b border-slate-100 dark:border-brand-700 bg-slate-50/60 dark:bg-brand-800/40">
                                                    <td colSpan={8} className="px-5 py-3">
                                                        <div className="text-xs space-y-1 text-slate-600 dark:text-brand-300">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                <div><span className="text-slate-400 dark:text-brand-500">الوقت الكامل: </span><span className="font-mono">{r.created_at}</span></div>
                                                                <div><span className="text-slate-400 dark:text-brand-500">الحدث: </span><span className="font-mono">#{r.id}</span></div>
                                                                {r.entity_id && <div><span className="text-slate-400 dark:text-brand-500">كيان: </span><span className="font-mono">{r.entity}#{r.entity_id}</span></div>}
                                                                <div><span className="text-slate-400 dark:text-brand-500">IP: </span><span className="font-mono" dir="ltr">{r.ip_address||'—'}</span></div>
                                                            </div>
                                                            {r.user_agent && <div className="text-slate-400 dark:text-brand-600 truncate">الجهاز: {r.user_agent}</div>}
                                                            {r.row_hash && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-slate-400 dark:text-brand-500">هاش:</span>
                                                                    <span className="font-mono text-[10px] text-slate-400 dark:text-brand-600 break-all" dir="ltr">{r.row_hash}</span>
                                                                    <span className="text-emerald-600 dark:text-emerald-500 font-black text-[10px]">✓</span>
                                                                </div>
                                                            )}
                                                            {(r.old_data || r.new_data) && (
                                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                                    {r.old_data && <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-2"><div className="text-[10px] font-black text-red-600 dark:text-red-400 mb-1">قبل:</div><pre className="text-[10px] text-red-700 dark:text-red-300 overflow-auto max-h-24 whitespace-pre-wrap break-all">{r.old_data}</pre></div>}
                                                                    {r.new_data && <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2"><div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1">بعد:</div><pre className="text-[10px] text-emerald-700 dark:text-emerald-300 overflow-auto max-h-24 whitespace-pre-wrap break-all">{r.new_data}</pre></div>}
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
                    </div>
                )}
                {/* إجمالي */}
                {!loading && rows.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-50 dark:border-brand-700 text-[12px] font-bold text-slate-400 dark:text-brand-500 flex items-center justify-between">
                        <span>{rows.length} حدث معروض</span>
                        {rows.filter(r => Number(r.risk_level) >= 4).length > 0 && (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertCircle size={12} /> {rows.filter(r => Number(r.risk_level) >= 4).length} حدث حرج
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const TABS = [
    { id: 'home',  label: 'الرئيسية',       icon: Activity },
    { id: 'chart', label: 'دليل الحسابات', icon: BookOpen },
    { id: 'journal', label: 'القيود اليومية', icon: FileText },
    { id: 'sales', label: 'فواتير البيع', icon: FileText },
    { id: 'purchases', label: 'فواتير الشراء', icon: FileText },
    { id: 'payments', label: 'سندات القبض/الصرف', icon: Wallet },
    { id: 'products', label: 'المنتجات والخدمات', icon: Package },
    { id: 'trial', label: 'ميزان المراجعة', icon: Scale },
    { id: 'income', label: 'قائمة الدخل', icon: TrendingUp },
    { id: 'balance',   label: 'الميزانية العمومية',   icon: PieChart    },
    { id: 'cashflow',  label: 'التدفقات النقدية',    icon: Activity    },
    { id: 'ledger', label: 'كشف حساب', icon: FileBarChart2 },
    { id: 'vat', label: 'إقرار الضريبة', icon: Banknote },
    { id: 'parties', label: 'العملاء والموردون', icon: Users },
    { id: 'costcenters', label: 'مراكز التكلفة', icon: Layers },
    { id: 'bank', label: 'المطابقة البنكية', icon: Scale },
    { id: 'budget', label: 'الميزانية التقديرية', icon: TrendingUp },
    { id: 'assets',  label: 'الأصول الثابتة',  icon: Building2 },
    { id: 'periods', label: 'السنوات المالية', icon: Calendar },
    { id: 'audit',   label: 'سجل التدقيق',    icon: Shield   },
    { id: 'settings', label: 'ملف المنشأة', icon: Settings },
];

export default function LedgerHub() {
    const { show: toast } = useToast();
    const [activeTab, setActiveTab] = useState('home');

    // بيانات مشتركة
    const [accounts, setAccounts] = useState([]);
    const [accLoading, setAccLoading] = useState(false);
    const [parties, setParties] = useState([]);
    const [partyLoading, setPartyLoading] = useState(false);
    const [costCenters, setCostCenters] = useState([]);
    const [ccLoading, setCcLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [prodLoading, setProdLoading] = useState(false);
    const [company, setCompany] = useState({});
    const [kpis, setKpis] = useState(null);
    const [seeded, setSeeded] = useState(false);

    const loadAccounts = useCallback(async () => {
        setAccLoading(true);
        try { const r = await api('gl_accounts'); setAccounts(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setAccLoading(false); }
    }, [toast]);
    const loadParties = useCallback(async () => {
        setPartyLoading(true);
        try { const r = await api('gl_parties'); setParties(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setPartyLoading(false); }
    }, [toast]);
    const loadCostCenters = useCallback(async () => {
        setCcLoading(true);
        try { const r = await api('gl_cost_centers'); setCostCenters(r.data || []); }
        catch (e) { toast(e.message, 'error'); } finally { setCcLoading(false); }
    }, [toast]);
    const loadProducts = useCallback(async () => {
        setProdLoading(true);
        try { const r = await api('acc_products_list', { params: { limit: 500 } }); setProducts(r.data || []); }
        catch (e) { /* صامت */ } finally { setProdLoading(false); }
    }, []);
    const loadCompany = useCallback(async () => {
        try { const r = await api('gl_settings_get'); if (r.success) setCompany(r.settings || {}); }
        catch (e) { /* صامت — لا يعطّل الواجهة */ }
    }, []);
    const loadKpis = useCallback(async () => {
        try { const r = await api('gl_dashboard_kpis'); if (r.success) setKpis(r); }
        catch (e) { /* صامت */ }
    }, []);

    useEffect(() => { loadAccounts(); loadParties(); loadCostCenters(); loadProducts(); loadCompany(); loadKpis(); }, [loadAccounts, loadParties, loadCostCenters, loadProducts, loadCompany, loadKpis]);

    // زرع دليل الحسابات إن كان فارغاً
    const seed = async () => {
        try { const r = await api('gl_seed'); if (r.success) { toast(r.message || 'تم'); loadAccounts(); } else toast(r.message, 'error'); }
        catch (e) { toast(e.message, 'error'); }
        setSeeded(true);
    };

    return (
        <div dir="rtl" className="space-y-6 p-4 md:p-6 font-cairo">

            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                        <BookOpen size={32} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-black">الدفترة المستقلة</h1>
                        <p className="text-sm text-slate-300 mt-1">محرّك محاسبة بقيد مزدوج كامل — كل البيانات في قاعدتنا · صفر اعتماد على دفترة</p>
                    </div>
                    {accounts.length === 0 && !accLoading && (
                        <Btn color="gold" onClick={seed}><Plus size={15} /> إنشاء دليل الحسابات</Btn>
                    )}
                </div>
            </div>

            {/* شريط مؤشرات سريعة */}
            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'ذمم العملاء (AR)', val: kpis.ar,           color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' },
                        { label: 'ذمم الموردين (AP)', val: kpis.ap,          color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' },
                        { label: `صافي الدخل ${kpis.year}`,val:kpis.net_income_ytd, color: kpis.net_income_ytd>=0?'text-emerald-700 dark:text-emerald-400':'text-rose-700 dark:text-rose-400', bg: 'bg-white dark:bg-brand-900 border-slate-100 dark:border-brand-700' },
                        { label: 'أطراف متأخرة +30 يوم', val: null, count: kpis.overdue_parties, color: kpis.overdue_parties>0?'text-rose-700 dark:text-rose-400':'text-emerald-700 dark:text-emerald-400', bg: 'bg-white dark:bg-brand-900 border-slate-100 dark:border-brand-700' },
                    ].map(({ label, val, count, color, bg }) => (
                        <div key={label} className={`rounded-2xl border px-4 py-3 shadow-sm ${bg}`}>
                            <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">{label}</div>
                            {count !== undefined
                                ? <div className={`text-2xl font-black tabular-nums ${color}`}>{count}</div>
                                : <div className={`text-xl font-black tabular-nums ${color}`} dir="ltr">{money(val)} <span className="text-xs font-normal">﷼</span></div>}
                        </div>
                    ))}
                </div>
            )}

            {/* شريط التبويبات */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 dark:border-brand-700 scrollbar-hide">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const active = activeTab === t.id;
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center gap-2 px-4 md:px-5 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                                    active ? 'border-[#c5a059] text-brand-800 dark:text-brand-100 bg-amber-50/50 dark:bg-brand-800/40' : 'border-transparent text-slate-500 dark:text-brand-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 hover:bg-slate-50 dark:hover:bg-brand-800'
                                }`}>
                                <Icon size={16} className={active ? 'text-[#c5a059]' : ''} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 md:p-6">
                    {activeTab === 'home'  && <DashboardHomeTab setActiveTab={setActiveTab} toast={toast} />}
                    {activeTab === 'chart' && <ChartTab accounts={accounts} reload={loadAccounts} loading={accLoading} toast={toast} />}
                    {activeTab === 'journal' && <JournalTab accounts={accounts} parties={parties} costCenters={costCenters} toast={toast} />}
                    {activeTab === 'sales' && <InvoicesTab docType="sales" parties={parties} accounts={accounts} products={products} company={company} toast={toast} />}
                    {activeTab === 'purchases' && <InvoicesTab docType="purchase" parties={parties} accounts={accounts} products={products} company={company} toast={toast} />}
                    {activeTab === 'payments' && <PaymentsTab parties={parties} accounts={accounts} toast={toast} />}
                    {activeTab === 'products' && <ProductsTab products={products} reload={loadProducts} loading={prodLoading} toast={toast} />}
                    {activeTab === 'trial' && <TrialBalanceTab toast={toast} />}
                    {activeTab === 'income' && <IncomeTab toast={toast} />}
                    {activeTab === 'balance'   && <BalanceSheetTab toast={toast} />}
                    {activeTab === 'cashflow'  && <CashFlowTab accounts={accounts} toast={toast} />}
                    {activeTab === 'ledger' && <LedgerTab accounts={accounts} toast={toast} />}
                    {activeTab === 'vat' && <VatTab toast={toast} />}
                    {activeTab === 'parties' && <PartiesTab parties={parties} reload={loadParties} loading={partyLoading} toast={toast} />}
                    {activeTab === 'costcenters' && <CostCentersTab costCenters={costCenters} reload={loadCostCenters} loading={ccLoading} toast={toast} />}
                    {activeTab === 'bank' && <BankReconcileTab accounts={accounts} toast={toast} />}
                    {activeTab === 'budget' && <BudgetTab accounts={accounts} toast={toast} />}
                    {activeTab === 'assets'  && <FixedAssetsTab accounts={accounts} toast={toast} />}
                    {activeTab === 'periods' && <FiscalPeriodsTab toast={toast} />}
                    {activeTab === 'audit'   && <AuditTab toast={toast} />}
                    {activeTab === 'settings' && <SettingsTab company={company} reload={loadCompany} toast={toast} />}
                </div>
            </div>
        </div>
    );
}
