import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import {
    Loader2, ArrowLeft, Search, Printer, RefreshCw, FileText, Hash,
    Building2, Calendar, Link2, ShoppingCart, Receipt, Wallet,
    ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { apiGet, API_URL } from '../../lib/api/client';
import { Money, StatusPill, EntityLink, Breadcrumbs } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة الفواتير (المحرّك المستقل inv_list / inv_single):
//   • بلا معرّف  → قائمة الفواتير القابلة للنقر (مبيعات/مشتريات).
//   • مع معرّف   → تفاصيل الفاتورة (بنود + إجماليات + رمز QR زكاة + روابط).
//  روابط مستقرّة: /admin/dashboard/inv   و   /admin/dashboard/inv/:id
// ════════════════════════════════════════════════════════════════════════════

const TYPE_TABS = [
    { key: '',          label: 'الكل',      icon: FileText },
    { key: 'sales',     label: 'مبيعات',    icon: Receipt },
    { key: 'purchase',  label: 'مشتريات',   icon: ShoppingCart },
];

export default function InvoiceDetail({ invoiceId, setActiveTab, tenant = 1 }) {
    if (invoiceId) return <Detail invoiceId={Number(invoiceId)} setActiveTab={setActiveTab} tenant={tenant} />;
    return <Browse tenant={tenant} />;
}

// ─── قائمة الفواتير ──────────────────────────────────────────────────────────
function Browse({ tenant }) {
    const [rows, setRows]    = useState([]);
    const [loading, setLoad] = useState(true);
    const [dt, setDt]        = useState('');
    const [q, setQ]          = useState('');

    const load = useCallback(() => {
        setLoad(true);
        apiGet('inv_list', { tenant, doc_type: dt })
            .then(r => setRows(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setRows([]))
            .finally(() => setLoad(false));
    }, [tenant, dt]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(i =>
            (i.invoice_no || '').toLowerCase().includes(s) ||
            (i.party_label || '').toLowerCase().includes(s) ||
            (i.issue_date || '').includes(s)
        );
    }, [rows, q]);

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-6xl mx-auto" dir="rtl">
            <Breadcrumbs items={[{ label: 'الفواتير' }]} className="mb-4" />

            <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="p-5 md:p-6 border-b border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-xl flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">الفواتير</h3>
                            <p className="text-slate-400 dark:text-brand-400 text-xs font-bold">مبيعات ومشتريات المحرّك المستقل — انقر الفاتورة لتفاصيلها</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={q} onChange={e => setQ(e.target.value)}
                            placeholder="بحث برقم الفاتورة أو الطرف أو التاريخ..."
                            className="w-64 max-w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-50 dark:placeholder-brand-500 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 outline-none text-sm font-bold text-brand-800"
                        />
                    </div>
                </div>

                <div className="px-5 md:px-6 pt-4 flex flex-wrap gap-2">
                    {TYPE_TABS.map(t => (
                        <button key={t.key} onClick={() => setDt(t.key)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-bold border transition ${dt === t.key ? 'bg-brand-800 text-white border-brand-800' : 'bg-white dark:bg-brand-900 text-slate-600 dark:text-brand-300 border-slate-200 dark:border-brand-700 hover:border-gold-500'}`}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                    <button onClick={load} title="تحديث"
                        className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-gold-500 dark:hover:border-gold-500 transition">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
                    </button>
                </div>

                <div className="p-4 md:p-5">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-300 font-bold">لا توجد فواتير مطابقة</div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 dark:text-brand-400 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-2.5 px-3">رقم الفاتورة</th>
                                        <th className="text-right py-2.5 px-3">النوع</th>
                                        <th className="text-right py-2.5 px-3">الطرف</th>
                                        <th className="text-right py-2.5 px-3">التاريخ</th>
                                        <th className="text-left py-2.5 px-3">الإجمالي</th>
                                        <th className="text-center py-2.5 px-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(i => (
                                        <tr key={i.id} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3">
                                                <EntityLink to={`inv/${i.id}`} icon={Hash}>{i.invoice_no || `#${i.id}`}</EntityLink>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold text-[12px]">{i.doc_type === 'sales' ? 'مبيعات' : 'مشتريات'}</td>
                                            <td className="py-2.5 px-3">
                                                {i.party_id
                                                    ? <EntityLink to={`parties/${i.party_id}`} muted>{i.party_label || '—'}</EntityLink>
                                                    : <span className="text-slate-500 dark:text-brand-400 font-bold">{i.party_label || '—'}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap" dir="ltr">{i.issue_date}</td>
                                            <td className="py-2.5 px-3 text-left font-black"><Money value={i.total} /></td>
                                            <td className="py-2.5 px-3 text-center"><StatusPill status={i.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── تفاصيل فاتورة ───────────────────────────────────────────────────────────
function Detail({ invoiceId, setActiveTab, tenant }) {
    const [inv, setInv]       = useState(null);
    const [items, setItems]   = useState([]);
    const [loading, setLoad]  = useState(true);
    const [err, setErr]       = useState('');
    const [stamping, setStamp] = useState(false);
    const [stampMsg, setStampMsg] = useState('');

    const load = useCallback(() => {
        setLoad(true); setErr('');
        apiGet('inv_single', { tenant, id: invoiceId })
            .then(r => {
                if (r?.success) { setInv(r.invoice); setItems(Array.isArray(r.items) ? r.items : []); }
                else { setErr(r?.message || 'تعذّر جلب الفاتورة'); setInv(null); }
            })
            .catch(() => setErr('خطأ في الاتصال'))
            .finally(() => setLoad(false));
    }, [tenant, invoiceId]);

    useEffect(() => { load(); }, [load]);

    const isSales = inv?.doc_type === 'sales';
    const isStamped = inv?.zatca_status === 'stamped_simulation';

    const doStamp = async () => {
        if (!inv) return;
        setStamp(true); setStampMsg('');
        try {
            const res = await fetch(`${API_URL}?action=zatca_stamp`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenant, id: inv.id }),
            });
            const d = await res.json();
            if (d.success) { setStampMsg('تم الختم بنجاح'); load(); }
            else setStampMsg(d.message || 'فشل الختم');
        } catch { setStampMsg('خطأ في الاتصال'); }
        finally { setStamp(false); }
    };

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-4xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4 no-print">
                <Breadcrumbs items={[
                    { label: 'الفواتير', to: 'inv' },
                    { label: inv?.invoice_no || `فاتورة #${invoiceId}` },
                ]} />
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('inv')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-gold-500 dark:hover:border-gold-500 transition">
                        <ArrowLeft size={15} /> القائمة
                    </button>
                    <button onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-brand-800 text-white hover:bg-[#2a4a7d] transition">
                        <Printer size={15} /> طباعة
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" size={30} /></div>
            ) : err ? (
                <div className="text-center py-20 text-rose-500 font-bold">{err}</div>
            ) : !inv ? null : (
                <>
                    {/* بطاقة الفاتورة */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 md:p-6 mb-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-2xl flex items-center justify-center">
                                    {isSales ? <Receipt size={24} /> : <ShoppingCart size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                                        {inv.invoice_no || `فاتورة #${invoiceId}`}
                                        <StatusPill status={inv.status} />
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px] font-bold text-slate-500 dark:text-brand-400">
                                        <span>{isSales ? 'فاتورة مبيعات' : 'فاتورة مشتريات'}</span>
                                        <span className="inline-flex items-center gap-1" dir="ltr"><Calendar size={12} /> {inv.issue_date}</span>
                                        {inv.due_date && <span className="inline-flex items-center gap-1">استحقاق: <span dir="ltr">{inv.due_date}</span></span>}
                                    </div>
                                    <div className="mt-1.5 text-sm font-bold text-slate-600 dark:text-brand-300">
                                        {inv.party_id
                                            ? <EntityLink to={`parties/${inv.party_id}`} icon={Building2}>{inv.party_label}</EntityLink>
                                            : <span className="inline-flex items-center gap-1"><Building2 size={13} className="opacity-60" /> {inv.party_label || '—'}</span>}
                                        {inv.party_vat && <span className="text-slate-400 mr-3" dir="ltr">ض.ر: {inv.party_vat}</span>}
                                    </div>
                                    {inv.entry_id ? (
                                        <div className="mt-1.5 text-[12px] font-bold">
                                            <EntityLink to={`entry/${inv.entry_id}`} icon={Link2} muted>القيد المحاسبي المرتبط</EntityLink>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            {/* الإجمالي + QR */}
                            <div className="flex items-start gap-4">
                                {inv.qr_base64 ? (
                                    <div className="text-center">
                                        <div id="zatca-qr-box" className="bg-white p-2 rounded-lg border border-slate-200">
                                            <QRCode value={inv.qr_base64} size={92} />
                                        </div>
                                        {isStamped ? (
                                            <div className="flex items-center justify-center gap-1 mt-1 text-[10px] font-bold text-green-600 dark:text-green-400">
                                                <ShieldCheck size={11} /> Phase-2 مختوم
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1 mt-1 text-[10px] font-bold text-amber-500">
                                                <ShieldAlert size={11} /> Phase-1
                                            </div>
                                        )}
                                        {isSales && !isStamped && inv.status === 'posted' && (
                                            <button onClick={doStamp} disabled={stamping}
                                                className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-brand-800 text-white hover:bg-brand-700 disabled:opacity-50 transition no-print">
                                                {stamping ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                                                ختم
                                            </button>
                                        )}
                                        {stampMsg && <div className="text-[10px] font-bold text-red-500 mt-1">{stampMsg}</div>}
                                    </div>
                                ) : (isSales && inv.status === 'posted') ? (
                                    <div className="text-center">
                                        <button onClick={doStamp} disabled={stamping}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-brand-800 text-white hover:bg-brand-700 disabled:opacity-50 transition no-print">
                                            {stamping ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                                            ختم ZATCA
                                        </button>
                                        {stampMsg && <div className="text-[10px] font-bold text-red-500 mt-1">{stampMsg}</div>}
                                    </div>
                                ) : null}
                                <div className="text-left bg-slate-50 dark:bg-brand-800/40 rounded-2xl px-5 py-3 border border-slate-100 dark:border-brand-700">
                                    <div className="text-[11px] font-bold text-slate-400 dark:text-brand-400 mb-0.5 flex items-center gap-1 justify-end">
                                        <Wallet size={12} /> الإجمالي
                                    </div>
                                    <div className="text-2xl font-black dark:text-brand-100"><Money value={inv.total} /></div>
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-brand-400 mt-0.5">شامل الضريبة</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* بنود الفاتورة */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-brand-800/60 text-slate-400 dark:text-brand-400 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-3 px-3">الوصف</th>
                                        <th className="text-left py-3 px-3">الكمية</th>
                                        <th className="text-left py-3 px-3">السعر</th>
                                        <th className="text-left py-3 px-3">الخصم</th>
                                        <th className="text-left py-3 px-3">الضريبة%</th>
                                        <th className="text-left py-3 px-3">الصافي</th>
                                        <th className="text-left py-3 px-3">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr><td colSpan={7} className="py-12 text-center text-slate-300 font-bold">لا توجد بنود</td></tr>
                                    ) : items.map((it, i) => (
                                        <tr key={it.id || i} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3 font-bold">
                                                {it.product_id
                                                    ? <EntityLink to={`prod/${it.product_id}`} title="حركة الصنف">{it.description}</EntityLink>
                                                    : <span className="text-slate-700 dark:text-brand-100">{it.description}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-left text-slate-600 dark:text-brand-300 font-bold" dir="ltr">{Number(it.qty)}</td>
                                            <td className="py-2.5 px-3 text-left"><Money value={it.unit_price} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left"><Money value={it.discount} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left text-slate-500 dark:text-brand-400 font-bold" dir="ltr">{Number(it.tax_rate)}%</td>
                                            <td className="py-2.5 px-3 text-left"><Money value={it.net_amount} /></td>
                                            <td className="py-2.5 px-3 text-left font-black"><Money value={it.line_total} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* إجماليات */}
                        <div className="flex justify-end p-4 md:p-5 border-t border-slate-100 dark:border-brand-700 bg-slate-50/40 dark:bg-brand-800/30">
                            <div className="w-full max-w-xs space-y-1.5 text-sm">
                                <div className="flex justify-between font-bold text-slate-600 dark:text-brand-300"><span>المجموع قبل الضريبة</span><Money value={inv.subtotal} /></div>
                                {Number(inv.discount) > 0 && <div className="flex justify-between font-bold text-slate-500 dark:text-brand-400"><span>الخصم</span><Money value={inv.discount} /></div>}
                                <div className="flex justify-between font-bold text-slate-600 dark:text-brand-300"><span>الضريبة (15%)</span><Money value={inv.tax_total} /></div>
                                <div className="flex justify-between font-black text-brand-800 dark:text-brand-100 text-base pt-1.5 border-t border-slate-200 dark:border-brand-700"><span>الإجمالي</span><Money value={inv.total} /></div>
                            </div>
                        </div>
                    </div>

                    {inv.notes ? <p className="mt-4 text-sm font-bold text-slate-500 dark:text-brand-400">ملاحظات: {inv.notes}</p> : null}
                </>
            )}
        </div>
    );
}
