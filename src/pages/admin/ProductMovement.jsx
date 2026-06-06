import React, { useState, useEffect, useCallback } from 'react';
import {
    Loader2, ArrowLeft, Printer, Package, ShoppingCart, Receipt,
} from 'lucide-react';
import { apiGet } from '../../lib/api/client';
import { Money, EntityLink, Breadcrumbs } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة حركة صنف (المحرّك المستقل gl_product_ledger):
//   /admin/dashboard/prod/:id  → مشتريات (وارد) ومبيعات (منصرف) من بنود الفواتير
//   المُرحّلة، مع رصيد كمية جارٍ. كل فاتورة/طرف قابل للنقر.
// ════════════════════════════════════════════════════════════════════════════

const qty = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

export default function ProductMovement({ productId, setActiveTab, tenant = 1 }) {
    const [data, setData]    = useState(null);
    const [loading, setLoad] = useState(true);
    const [err, setErr]      = useState('');
    const [from, setFrom]    = useState('');
    const [to, setTo]        = useState('');

    const load = useCallback(() => {
        if (!productId) return;
        setLoad(true); setErr('');
        apiGet('gl_product_ledger', { tenant, product_id: productId, from, to })
            .then(r => { if (r?.success) setData(r); else { setErr(r?.message || 'تعذّر جلب الحركة'); setData(null); } })
            .catch(() => setErr('خطأ في الاتصال'))
            .finally(() => setLoad(false));
    }, [tenant, productId, from, to]);

    useEffect(() => { load(); }, [load]);

    const product = data?.product;
    const rows    = data?.data || [];
    const totals  = data?.totals || { in: 0, out: 0, closing: 0, stock_balance: 0 };
    const opening = data?.opening ?? 0;

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4 no-print">
                <Breadcrumbs items={[
                    { label: 'المنتجات', to: 'products' },
                    { label: product ? product.name : `صنف #${productId}` },
                ]} />
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('products')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059] transition">
                        <ArrowLeft size={15} /> المنتجات
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
            ) : !product ? null : (
                <>
                    {/* بطاقة الصنف */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 md:p-6 mb-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center justify-center">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">{product.name}</h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px] font-bold text-slate-500 dark:text-brand-400">
                                        {product.code && <span className="font-mono" dir="ltr">{product.code}</span>}
                                        {product.unit && <span>{product.unit}</span>}
                                        <span>سعر البيع: <Money value={product.unit_price} /></span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-left bg-slate-50 dark:bg-brand-800/40 rounded-2xl px-5 py-3 border border-slate-100 dark:border-brand-700">
                                <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-0.5">المخزون المسجّل</div>
                                <div className="text-2xl font-black tabular-nums" dir="ltr">{qty(totals.stock_balance)}</div>
                                <div className="text-[11px] font-bold text-slate-500 dark:text-brand-400 mt-0.5">صافي الحركة: <span dir="ltr">{qty(totals.closing)}</span></div>
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

                    {/* جدول الحركة */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-slate-400 dark:text-brand-500 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-3 px-3">التاريخ</th>
                                        <th className="text-right py-3 px-3">الفاتورة</th>
                                        <th className="text-right py-3 px-3">الطرف</th>
                                        <th className="text-left py-3 px-3">وارد</th>
                                        <th className="text-left py-3 px-3">منصرف</th>
                                        <th className="text-left py-3 px-3">الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-50 dark:border-brand-700 bg-amber-50/30 dark:bg-amber-500/10">
                                        <td className="py-2.5 px-3 text-slate-400 dark:text-brand-500 font-bold" colSpan={3}>رصيد افتتاحي</td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3 text-left tabular-nums font-bold" dir="ltr">{qty(opening)}</td>
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-300 font-bold">
                                            {(from || to) ? 'لا توجد حركة في هذه الفترة' : 'لا توجد حركة مسجّلة لهذا الصنف في الفواتير المُرحّلة'}
                                        </td></tr>
                                    ) : rows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap" dir="ltr">{r.issue_date}</td>
                                            <td className="py-2.5 px-3 text-[12px]" dir="ltr">
                                                <EntityLink to={`inv/${r.invoice_id}`} muted icon={r.doc_type === 'purchase' ? ShoppingCart : Receipt}>
                                                    {r.invoice_no || `#${r.invoice_id}`}
                                                </EntityLink>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-brand-300 font-bold">
                                                {r.party_id
                                                    ? <EntityLink to={`parties/${r.party_id}`} muted>{r.party_label || '—'}</EntityLink>
                                                    : (r.party_label || '—')}
                                            </td>
                                            <td className="py-2.5 px-3 text-left tabular-nums text-emerald-700 dark:text-emerald-300 font-bold" dir="ltr">{Number(r.qty_in) ? qty(r.qty_in) : '—'}</td>
                                            <td className="py-2.5 px-3 text-left tabular-nums text-rose-700 dark:text-rose-300 font-bold" dir="ltr">{Number(r.qty_out) ? qty(r.qty_out) : '—'}</td>
                                            <td className="py-2.5 px-3 text-left tabular-nums font-black" dir="ltr">{qty(r.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-slate-200 dark:border-brand-700">
                                        <td className="py-3 px-3" colSpan={3}>الإجماليات</td>
                                        <td className="py-3 px-3 text-left tabular-nums text-emerald-700 dark:text-emerald-300" dir="ltr">{qty(totals.in)}</td>
                                        <td className="py-3 px-3 text-left tabular-nums text-rose-700 dark:text-rose-300" dir="ltr">{qty(totals.out)}</td>
                                        <td className="py-3 px-3 text-left tabular-nums" dir="ltr">{qty(totals.closing)}</td>
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
