import React, { useState, useEffect } from 'react';
import {
    Loader2, ArrowLeft, Printer, BookOpen,
} from 'lucide-react';
import { apiGet } from '../../lib/api/client';
import { Money, EntityLink, Breadcrumbs } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة دفتر أستاذ حساب (المحرّك المستقل gl_ledger):
//   /admin/dashboard/acct/:id  → رصيد افتتاحي + حركات + رصيد جارٍ + إجماليات.
//  رقم كل قيد قابل للنقر إلى تفاصيله، وكل طرف إلى كشف حسابه.
// ════════════════════════════════════════════════════════════════════════════

const TYPE_LABELS = {
    asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
    revenue: 'إيرادات', expense: 'مصروفات',
};

export default function AccountDetail({ accountId, setActiveTab, tenant = 1 }) {
    const [data, setData]    = useState(null);
    const [loading, setLoad] = useState(true);
    const [err, setErr]      = useState('');
    const [from, setFrom]    = useState('');
    const [to, setTo]        = useState('');

    useEffect(() => {
        if (!accountId) return;
        const ctrl = new AbortController();
        setLoad(true); setErr('');
        apiGet('gl_ledger', { tenant, account_id: accountId, from, to }, { signal: ctrl.signal })
            .then(r => { if (r?.success) setData(r); else { setErr(r?.message || 'تعذّر جلب الكشف'); setData(null); } })
            .catch(e => { if (e?.name !== 'AbortError') setErr('خطأ في الاتصال'); })
            .finally(() => { if (!ctrl.signal.aborted) setLoad(false); });
        return () => ctrl.abort();
    }, [tenant, accountId, from, to]);

    const account = data?.account;
    const rows    = data?.data || [];
    const totals  = data?.totals || { debit: 0, credit: 0, closing: 0 };
    const opening = data?.opening ?? 0;

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4 no-print">
                <Breadcrumbs items={[
                    { label: 'شجرة الحسابات', to: 'ledger' },
                    { label: account ? `${account.code} · ${account.name}` : `حساب #${accountId}` },
                ]} />
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('ledger')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059] transition">
                        <ArrowLeft size={15} /> الدفتر
                    </button>
                    <button onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-brand-800 text-white hover:bg-brand-900 transition">
                        <Printer size={15} /> طباعة
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 dark:text-brand-500"><Loader2 className="animate-spin mx-auto mb-2" size={30} /></div>
            ) : err ? (
                <div className="text-center py-20 text-rose-500 font-bold">{err}</div>
            ) : !account ? null : (
                <>
                    {/* بطاقة الحساب */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 md:p-6 mb-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-2xl flex items-center justify-center">
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">{account.name}</h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px] font-bold text-slate-500 dark:text-brand-400">
                                        <span className="font-mono" dir="ltr">{account.code}</span>
                                        <span>{TYPE_LABELS[account.type] || account.type}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-left bg-slate-50 dark:bg-brand-800/40 rounded-2xl px-5 py-3 border border-slate-100 dark:border-brand-700">
                                <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-0.5">الرصيد الختامي</div>
                                <div className="text-2xl font-black"><Money value={totals.closing} /></div>
                            </div>
                        </div>
                    </div>

                    {/* فلتر التاريخ */}
                    <div className="flex flex-wrap items-end gap-3 mb-4 no-print">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">من تاريخ</label>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-1">إلى تاريخ</label>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 text-sm font-bold text-brand-800 dark:text-brand-100 outline-none focus:border-[#c5a059] dark:bg-brand-900" />
                        </div>
                        {(from || to) && (
                            <button onClick={() => { setFrom(''); setTo(''); }}
                                className="px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-rose-400 hover:text-rose-500 transition">
                                مسح
                            </button>
                        )}
                    </div>

                    {/* جدول الحركات */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-slate-400 dark:text-brand-500 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-3 px-3">التاريخ</th>
                                        <th className="text-right py-3 px-3">القيد</th>
                                        <th className="text-right py-3 px-3">البيان</th>
                                        <th className="text-left py-3 px-3">مدين</th>
                                        <th className="text-left py-3 px-3">دائن</th>
                                        <th className="text-left py-3 px-3">الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-50 dark:border-brand-700 bg-amber-50/30 dark:bg-amber-500/10">
                                        <td className="py-2.5 px-3 text-slate-400 dark:text-brand-500 font-bold" colSpan={3}>رصيد افتتاحي</td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3 text-left"><Money value={opening} /></td>
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-300 font-bold">
                                            {(from || to) ? 'لا توجد حركات في هذه الفترة' : 'لا توجد حركات مسجّلة على هذا الحساب'}
                                        </td></tr>
                                    ) : rows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap" dir="ltr">{r.date}</td>
                                            <td className="py-2.5 px-3 text-[12px]" dir="ltr">
                                                {r.entry_id
                                                    ? <EntityLink to={`entry/${r.entry_id}`} muted>{r.entry_no}</EntityLink>
                                                    : <span className="text-slate-400 dark:text-brand-500 font-bold">{r.entry_no}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-brand-300 font-bold">
                                                {r.party_id
                                                    ? <EntityLink to={`parties/${r.party_id}`} muted>{r.line_desc || r.ent_desc || 'طرف'}</EntityLink>
                                                    : (r.line_desc || r.ent_desc || '—')}
                                            </td>
                                            <td className="py-2.5 px-3 text-left"><Money value={r.debit} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left"><Money value={r.credit} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left font-black"><Money value={r.balance} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-slate-200 dark:border-brand-700">
                                        <td className="py-3 px-3" colSpan={3}>الإجماليات</td>
                                        <td className="py-3 px-3 text-left"><Money value={totals.debit} /></td>
                                        <td className="py-3 px-3 text-left"><Money value={totals.credit} /></td>
                                        <td className="py-3 px-3 text-left"><Money value={totals.closing} /></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
