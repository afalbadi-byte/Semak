import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, FileText, Users, RefreshCw, ExternalLink, Wallet, Receipt } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function Finance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}?action=daftra_summary`);
            const json = await res.json();
            if (json.success) setData(json);
            else setError(json.message || 'فشل جلب البيانات');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-12 text-center">
                <RefreshCw className="animate-spin inline mr-2 text-emerald-600" /> جاري جلب البيانات من دفترة...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-[2rem] p-8">
                <AlertCircle className="text-red-600 mb-2" />
                <p className="font-bold text-red-900">تعذّر الاتصال بدفترة</p>
                <p className="text-sm text-red-700 mt-2">{error}</p>
            </div>
        );
    }

    const s = data.summary;
    const categories = data.expenses_by_category || {};
    const sortedCategories = Object.entries(categories).sort((a, b) => b[1].total - a[1].total);
    const maxCategoryAmount = Math.max(...Object.values(categories).map(c => c.total), 1);

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <DollarSign size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">الإدارة المالية — سماك الخير</h1>
                            <p className="text-sm text-slate-300 mt-1">بيانات حية من دفاتر المقاول الداخلي عبر دفترة</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> فتح دفترة
                    </a>
                </div>
            </div>

            {/* بطاقات المؤشرات الرئيسية */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KpiCard icon={Receipt} color="blue" label="إجمالي الفواتير الصادرة" value={fmt(s.total_invoiced)} unit="ريال" sub={`${s.invoice_count} فاتورة`} />
                <KpiCard icon={TrendingUp} color="emerald" label="المسدد" value={fmt(s.total_paid)} unit="ريال" sub={s.invoice_count > 0 && s.total_invoiced > 0 ? `${((s.total_paid / s.total_invoiced) * 100).toFixed(1)}%` : '—'} />
                <KpiCard icon={AlertCircle} color="amber" label="المستحق" value={fmt(s.outstanding)} unit="ريال" sub={`${s.unpaid_count} فاتورة غير مسددة`} />
                <KpiCard icon={TrendingDown} color="red" label="إجمالي المصروفات" value={fmt(s.total_expenses)} unit="ريال" sub={`${s.expense_count} مصروف`} />
                <KpiCard icon={Wallet} color={s.net_cashflow >= 0 ? "emerald" : "red"} label="صافي التدفق النقدي" value={fmt(s.net_cashflow)} unit="ريال" sub={s.net_cashflow >= 0 ? "إيجابي ✓" : "سالب ⚠️"} />
            </div>

            {/* تفصيل المصروفات حسب التصنيف */}
            <div className="bg-white rounded-[1.5rem] shadow border border-slate-100 p-6">
                <h3 className="text-lg font-black text-[#1a365d] mb-4 flex items-center gap-2">
                    <TrendingDown size={20} className="text-red-600"/>
                    المصروفات حسب التصنيف
                </h3>
                {sortedCategories.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">لا توجد مصروفات بعد</p>
                ) : (
                    <div className="space-y-3">
                        {sortedCategories.map(([cat, d], i) => {
                            const pct = (d.total / s.total_expenses) * 100;
                            const barPct = (d.total / maxCategoryAmount) * 100;
                            const isUncategorized = !cat || cat.trim() === '';
                            return (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${isUncategorized ? 'text-amber-700' : 'text-[#1a365d]'}`}>
                                                {isUncategorized ? '⚠️ بدون تصنيف' : cat}
                                            </span>
                                            <span className="text-xs text-slate-400">({d.count} مصروف)</span>
                                        </div>
                                        <div className="text-left">
                                            <span className="font-black text-[#1a365d]">{fmt(d.total)}</span>
                                            <span className="text-xs text-slate-500 mr-2">{pct.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${isUncategorized ? 'bg-amber-500' : 'bg-gradient-to-l from-red-500 to-red-400'} transition-all`} style={{ width: `${barPct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {categories[''] && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
                        <strong>تنبيه:</strong> يوجد <strong>{fmt(categories[''].total)} ريال</strong> مصروفات غير مصنّفة ({categories[''].count} مصروف). يُنصح بتصنيفها لمتابعة أدق للتكاليف.
                    </div>
                )}
            </div>

            {/* الفواتير حسب العميل */}
            <div className="bg-white rounded-[1.5rem] shadow border border-slate-100 p-6">
                <h3 className="text-lg font-black text-[#1a365d] mb-4 flex items-center gap-2">
                    <Users size={20} className="text-blue-600"/>
                    الفواتير حسب العميل
                </h3>
                <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-2">العميل</th>
                            <th className="px-4 py-2 text-center">عدد الفواتير</th>
                            <th className="px-4 py-2 text-center">إجمالي المفوتر</th>
                            <th className="px-4 py-2 text-center">المسدد</th>
                            <th className="px-4 py-2 text-center">المستحق</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Object.entries(data.invoices_by_client || {})
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([cid, c]) => (
                            <tr key={cid} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-bold text-[#1a365d]">{c.name || `#${cid}`}</td>
                                <td className="px-4 py-3 text-center font-bold">{c.count}</td>
                                <td className="px-4 py-3 text-center font-bold">{fmt(c.total)}</td>
                                <td className="px-4 py-3 text-center text-emerald-600 font-bold">{fmt(c.paid)}</td>
                                <td className={`px-4 py-3 text-center font-bold ${c.unpaid > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{fmt(c.unpaid || 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <div className="flex justify-center">
                <button onClick={loadData} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg flex items-center gap-2">
                    <RefreshCw size={16}/> تحديث البيانات
                </button>
            </div>
        </div>
    );
}

function KpiCard({ icon: Icon, color, label, value, unit, sub }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <div className={`rounded-2xl border p-4 ${colors[color]}`}>
            <Icon size={20} className="mb-2 opacity-70"/>
            <div className="text-[11px] font-bold opacity-80">{label}</div>
            <div className="text-xl md:text-2xl font-black mt-1">{value}</div>
            <div className="text-[10px] opacity-70 mt-1">{unit} • {sub}</div>
        </div>
    );
}
