import React, { useState, useEffect } from 'react';
import {
    DollarSign, TrendingDown, TrendingUp, AlertCircle, FileText, Users, RefreshCw,
    ExternalLink, Wallet, Receipt, ShoppingCart, Truck, Building, Coins
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

export default function Finance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('overview');

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}?action=daftra_full_summary`);
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
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-brand-700 p-12 text-center">
                <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري جلب البيانات من دفترة...
            </div>
        );
    }
    if (error || !data) {
        return (
            <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-[2rem] p-8">
                <AlertCircle className="text-red-600 dark:text-red-300 mb-2"/>
                <p className="font-bold text-red-900 dark:text-red-300">تعذّر الاتصال بدفترة</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-2">{error}</p>
            </div>
        );
    }

    const { sales, expenses, purchases, treasuries_total_balance, treasuries, suppliers, expenses_by_category, invoices_by_client, purchases_by_supplier } = data;

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* الرأس */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <DollarSign size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">الإدارة المالية — سماك الخير</h1>
                            <p className="text-sm text-slate-300 mt-1">بيانات حية من دفترة (المقاول الداخلي)</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> فتح دفترة
                    </a>
                </div>
            </div>

            {/* تبويبات */}
            <div className="flex gap-2 flex-wrap bg-white dark:bg-brand-900 p-2 rounded-2xl border border-slate-200 dark:border-brand-700 shadow-sm">
                <Tab active={tab==='overview'}  onClick={()=>setTab('overview')}  icon={DollarSign}>الملخص</Tab>
                <Tab active={tab==='sales'}     onClick={()=>setTab('sales')}     icon={Receipt}>المبيعات</Tab>
                <Tab active={tab==='purchases'} onClick={()=>setTab('purchases')} icon={ShoppingCart}>المشتريات</Tab>
                <Tab active={tab==='suppliers'} onClick={()=>setTab('suppliers')} icon={Truck}>الموردين</Tab>
                <Tab active={tab==='treasuries'} onClick={()=>setTab('treasuries')} icon={Wallet}>الخزائن</Tab>
                <Tab active={tab==='expenses'}  onClick={()=>setTab('expenses')}  icon={TrendingDown}>المصروفات</Tab>
            </div>

            {tab === 'overview' && (
                <>
                    {/* البطاقات الكبيرة */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <BigCard color="emerald" icon={Wallet} title="رصيد الخزائن" value={fmt(treasuries_total_balance)} sub={`${treasuries.length} خزينة`} />
                        <BigCard color="blue" icon={Receipt} title="المبيعات (مفوتر)" value={fmt(sales.total)} sub={`${sales.count} فاتورة • مسدد ${fmt(sales.paid)}`} />
                        <BigCard color="purple" icon={ShoppingCart} title="المشتريات (مفوتر)" value={fmt(purchases.total)} sub={`${purchases.count} فاتورة • مسدد ${fmt(purchases.paid)}`} />
                        <BigCard color="red" icon={TrendingDown} title="المصروفات النثرية" value={fmt(expenses.total)} sub={`${expenses.count} مصروف`} />
                    </div>

                    {/* الموقف المالي */}
                    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-6">
                        <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-4">الموقف المالي</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Stat label="مستحق على العملاء (لنا)" value={fmt(sales.unpaid)} positive />
                            <Stat label="مستحق علينا للموردين" value={fmt(purchases.unpaid)} negative />
                            <Stat label="الفرق الصافي" value={fmt(sales.unpaid - purchases.unpaid)}
                                positive={sales.unpaid >= purchases.unpaid} negative={sales.unpaid < purchases.unpaid} />
                        </div>
                    </div>
                </>
            )}

            {tab === 'sales' && (
                <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-6">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><Receipt size={20}/> الفواتير الصادرة حسب العميل</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <SmallStat label="عدد الفواتير" value={sales.count}/>
                        <SmallStat label="إجمالي" value={fmt(sales.total)} color="blue"/>
                        <SmallStat label="مسدد" value={fmt(sales.paid)} color="emerald"/>
                        <SmallStat label="مستحق" value={fmt(sales.unpaid)} color="amber"/>
                    </div>
                    <Table head={["العميل","عدد","إجمالي","مسدد","مستحق"]}>
                        {Object.entries(invoices_by_client || {}).sort((a,b)=>b[1].total-a[1].total).map(([cid,c])=>(
                            <tr key={cid} className="hover:bg-slate-50/50 dark:hover:bg-brand-800">
                                <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100">{c.name}</td>
                                <td className="px-4 py-3 text-center font-bold dark:text-brand-100">{c.count}</td>
                                <td className="px-4 py-3 text-center font-bold dark:text-brand-100">{fmt(c.total)}</td>
                                <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-300 font-bold">{fmt(c.paid)}</td>
                                <td className={`px-4 py-3 text-center font-bold ${c.unpaid>0?'text-amber-600 dark:text-amber-300':'text-slate-400 dark:text-brand-400'}`}>{fmt(c.unpaid)}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {tab === 'purchases' && (
                <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-6">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><ShoppingCart size={20}/> فواتير الشراء حسب المورد</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <SmallStat label="عدد الفواتير" value={purchases.count}/>
                        <SmallStat label="إجمالي" value={fmt(purchases.total)} color="purple"/>
                        <SmallStat label="مسدد للموردين" value={fmt(purchases.paid)} color="emerald"/>
                        <SmallStat label="مستحق علينا" value={fmt(purchases.unpaid)} color="red"/>
                    </div>
                    <Table head={["المورد","عدد","إجمالي","مسدد","مستحق علينا"]}>
                        {Object.entries(purchases_by_supplier || {}).sort((a,b)=>b[1].total-a[1].total).map(([sid,s])=>(
                            <tr key={sid} className="hover:bg-slate-50/50 dark:hover:bg-brand-800">
                                <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100">{s.name}</td>
                                <td className="px-4 py-3 text-center font-bold dark:text-brand-100">{s.count}</td>
                                <td className="px-4 py-3 text-center font-bold dark:text-brand-100">{fmt(s.total)}</td>
                                <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-300 font-bold">{fmt(s.paid)}</td>
                                <td className={`px-4 py-3 text-center font-bold ${s.unpaid>0?'text-red-600 dark:text-red-300':'text-slate-400 dark:text-brand-400'}`}>{fmt(s.unpaid)}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {tab === 'suppliers' && (
                <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-6">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><Truck size={20}/> سجل الموردين ({suppliers.length})</h3>
                    <Table head={["الاسم","الجوال","الإيميل","الرصيد المبدئي"]}>
                        {suppliers.map((s,i)=>(
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-brand-800">
                                <td className="px-4 py-3 font-bold text-brand-800 dark:text-brand-100">{s.name}</td>
                                <td className="px-4 py-3 font-mono text-sm dark:text-brand-300" dir="ltr">{s.phone || '—'}</td>
                                <td className="px-4 py-3 text-sm dark:text-brand-300">{s.email || '—'}</td>
                                <td className="px-4 py-3 text-center font-bold dark:text-brand-100">{fmt(s.balance)}</td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {tab === 'treasuries' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {treasuries.map((t,i)=>(
                            <div key={i} className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center"><Wallet size={20}/></div>
                                    <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-1 rounded-full">{t.currency}</span>
                                </div>
                                <h4 className="text-sm font-bold text-emerald-900 mb-1">{t.name}</h4>
                                <div className="text-2xl font-black text-emerald-700">{fmt(t.balance)} <span className="text-sm font-bold">{t.currency}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-[#1a365d] text-white rounded-2xl p-6 shadow-xl">
                        <p className="text-sm text-slate-300 mb-1">إجمالي الأرصدة في جميع الخزائن</p>
                        <p className="text-3xl font-black text-[#c5a059]">{fmt(treasuries_total_balance)} SAR</p>
                    </div>
                </div>
            )}

            {tab === 'expenses' && (
                <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-6">
                    <h3 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><TrendingDown size={20}/> المصروفات حسب التصنيف</h3>
                    {Object.entries(expenses_by_category || {}).sort((a,b)=>b[1].total-a[1].total).map(([cat,d],i)=>{
                        const pct = (d.total/expenses.total)*100;
                        const isUncat = !cat || cat.trim()==='';
                        return (
                            <div key={i} className="mb-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold ${isUncat?'text-amber-700 dark:text-amber-300':'text-brand-800 dark:text-brand-100'}`}>
                                        {isUncat?'⚠️ بدون تصنيف':cat} <span className="text-xs text-slate-400 dark:text-brand-400">({d.count})</span>
                                    </span>
                                    <span className="font-black text-brand-800 dark:text-brand-100">{fmt(d.total)} <span className="text-xs text-slate-500 dark:text-brand-400">({pct.toFixed(1)}%)</span></span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${isUncat?'bg-amber-500':'bg-gradient-to-l from-red-500 to-red-400'}`} style={{width:`${pct}%`}}/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex justify-center">
                <button onClick={loadData} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg flex items-center gap-2">
                    <RefreshCw size={16}/> تحديث البيانات
                </button>
            </div>
        </div>
    );
}

function Tab({ active, onClick, icon:Icon, children }) {
    return (
        <button onClick={onClick}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 ${active ? 'bg-brand-800 text-white shadow-md' : 'text-slate-600 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-brand-800'}`}>
            <Icon size={16}/> {children}
        </button>
    );
}

function BigCard({ color, icon:Icon, title, value, sub }) {
    const colors = {
        emerald: 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900',
        blue:    'from-blue-50 to-indigo-50 border-blue-200 text-blue-900',
        purple:  'from-purple-50 to-fuchsia-50 border-purple-200 text-purple-900',
        red:     'from-red-50 to-orange-50 border-red-200 text-red-900',
    };
    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 shadow-sm`}>
            <Icon size={22} className="mb-2 opacity-70"/>
            <div className="text-xs font-bold opacity-80">{title}</div>
            <div className="text-2xl md:text-3xl font-black mt-1">{value}</div>
            <div className="text-[10px] opacity-70 mt-1">{sub}</div>
        </div>
    );
}

function Stat({ label, value, positive, negative }) {
    const cls = positive ? 'text-emerald-700 dark:text-emerald-300' : negative ? 'text-red-700 dark:text-red-300' : 'text-brand-800 dark:text-brand-100';
    return (
        <div className="bg-slate-50 dark:bg-brand-800/40 border border-slate-100 dark:border-brand-700 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-brand-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${cls}`}>{value} <span className="text-xs">SAR</span></div>
        </div>
    );
}

function SmallStat({ label, value, color }) {
    const colors = { blue:'text-blue-700 dark:text-blue-300', emerald:'text-emerald-700 dark:text-emerald-300', amber:'text-amber-700 dark:text-amber-300', red:'text-red-700 dark:text-red-300', purple:'text-purple-700 dark:text-purple-300' };
    return (
        <div className="bg-slate-50 dark:bg-brand-800/40 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500 dark:text-brand-400">{label}</div>
            <div className={`text-lg font-black ${colors[color]||'text-brand-800 dark:text-brand-100'}`}>{value}</div>
        </div>
    );
}

function Table({ head, children }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-xs uppercase">
                    <tr>{head.map((h,i)=>(<th key={i} className={`px-4 py-2 ${i===0?'':'text-center'}`}>{h}</th>))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-brand-700">{children}</tbody>
            </table>
        </div>
    );
}
