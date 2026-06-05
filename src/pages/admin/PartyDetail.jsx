import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Loader2, ArrowLeft, Search, Printer, RefreshCw, Phone, Mail, Hash,
    Building2, Users, Truck, Handshake, FileText, Wallet
} from 'lucide-react';
import { apiGet } from '../../lib/api/client';
import { Money, StatusPill, EntityLink, Breadcrumbs } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة الأطراف (المحرّك المستقل gl_parties / gl_party_ledger):
//   • بلا معرّف  → قائمة الأطراف القابلة للنقر (عملاء/موردون/شركاء).
//   • مع معرّف   → كشف حساب كامل (افتتاحي + حركات + رصيد جارٍ + إجماليات).
//  روابط مستقرّة قابلة للمشاركة: /admin/dashboard/parties  و  /parties/:id
// ════════════════════════════════════════════════════════════════════════════

const TYPE_TABS = [
    { key: '',          label: 'الكل',     icon: Users },
    { key: 'customer',  label: 'العملاء',  icon: Users },
    { key: 'supplier',  label: 'الموردون', icon: Truck },
    { key: 'partner',   label: 'الشركاء',  icon: Handshake },
];

export default function PartyDetail({ partyId, setActiveTab, tenant = 1 }) {
    if (partyId) return <Statement partyId={Number(partyId)} setActiveTab={setActiveTab} tenant={tenant} />;
    return <Browse tenant={tenant} />;
}

// ─── قائمة الأطراف ───────────────────────────────────────────────────────────
function Browse({ tenant }) {
    const [rows, setRows]     = useState([]);
    const [loading, setLoad]  = useState(true);
    const [type, setType]     = useState('');
    const [q, setQ]           = useState('');

    const load = useCallback(() => {
        setLoad(true);
        apiGet('gl_parties', { tenant, type })
            .then(r => setRows(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setRows([]))
            .finally(() => setLoad(false));
    }, [tenant, type]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(p =>
            (p.name || '').toLowerCase().includes(s) ||
            (p.phone || '').includes(s) ||
            (p.vat_number || '').includes(s)
        );
    }, [rows, q]);

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-6xl mx-auto" dir="rtl">
            <Breadcrumbs items={[{ label: 'كشوف حسابات الأطراف' }]} className="mb-4" />

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* رأس + بحث */}
                <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#1a365d]">كشوف حسابات الأطراف</h3>
                            <p className="text-slate-400 text-xs font-bold">العملاء والموردون والشركاء — كشف حساب فوري</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={q} onChange={e => setQ(e.target.value)}
                            placeholder="بحث بالاسم أو الجوال أو الرقم الضريبي..."
                            className="w-64 max-w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20 outline-none text-sm font-bold text-[#1a365d]"
                        />
                    </div>
                </div>

                {/* فلاتر النوع */}
                <div className="px-5 md:px-6 pt-4 flex flex-wrap gap-2">
                    {TYPE_TABS.map(t => (
                        <button key={t.key} onClick={() => setType(t.key)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-bold border transition ${type === t.key ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#c5a059]'}`}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                    <button onClick={load} title="تحديث"
                        className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold border border-slate-200 text-slate-500 hover:border-[#c5a059] transition">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
                    </button>
                </div>

                {/* الجدول */}
                <div className="p-4 md:p-5">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-300 font-bold">لا توجد أطراف مطابقة</div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-[12px] font-black border-b border-slate-100">
                                        <th className="text-right py-2.5 px-3">الاسم</th>
                                        <th className="text-right py-2.5 px-3">النوع</th>
                                        <th className="text-right py-2.5 px-3">الجوال</th>
                                        <th className="text-right py-2.5 px-3">الرقم الضريبي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => (
                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                                            <td className="py-2.5 px-3">
                                                <EntityLink to={`parties/${p.id}`} icon={Building2}>{p.name}</EntityLink>
                                            </td>
                                            <td className="py-2.5 px-3"><StatusPill status={p.type} /></td>
                                            <td className="py-2.5 px-3 text-slate-600 font-bold" dir="ltr">{p.phone || '—'}</td>
                                            <td className="py-2.5 px-3 text-slate-500 font-bold" dir="ltr">{p.vat_number || '—'}</td>
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

// ─── كشف حساب طرف ────────────────────────────────────────────────────────────
function Statement({ partyId, setActiveTab, tenant }) {
    const [data, setData]    = useState(null);
    const [loading, setLoad] = useState(true);
    const [err, setErr]      = useState('');
    const [from, setFrom]    = useState('');
    const [to, setTo]        = useState('');

    const load = useCallback(() => {
        setLoad(true); setErr('');
        apiGet('gl_party_ledger', { tenant, party_id: partyId, from, to })
            .then(r => { if (r?.success) setData(r); else { setErr(r?.message || 'تعذّر جلب الكشف'); setData(null); } })
            .catch(() => setErr('خطأ في الاتصال'))
            .finally(() => setLoad(false));
    }, [tenant, partyId, from, to]);

    useEffect(() => { load(); }, [load]);

    const party   = data?.party;
    const rows    = data?.data || [];
    const totals  = data?.totals || { debit: 0, credit: 0, closing: 0 };
    const opening = data?.opening ?? 0;

    const closing = totals.closing ?? 0;
    const isCustomer = party?.type === 'customer';
    let balLabel = 'مُسوّى';
    if (Math.abs(closing) >= 0.005) {
        if (isCustomer) balLabel = closing > 0 ? 'مستحق على العميل' : 'رصيد دائن (دفعة مقدّمة)';
        else            balLabel = closing > 0 ? 'مستحق للمورّد'   : 'رصيد مدين على المورّد';
    }

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4 no-print">
                <Breadcrumbs items={[
                    { label: 'كشوف الحسابات', to: 'parties' },
                    { label: party?.name || `طرف #${partyId}` },
                ]} />
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('parties')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 text-slate-600 hover:border-[#c5a059] transition">
                        <ArrowLeft size={15} /> القائمة
                    </button>
                    <button onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-[#1a365d] text-white hover:bg-[#2a4a7d] transition">
                        <Printer size={15} /> طباعة
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" size={30} /></div>
            ) : err ? (
                <div className="text-center py-20 text-rose-500 font-bold">{err}</div>
            ) : !party ? null : (
                <>
                    {/* بطاقة الطرف */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 mb-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#1a365d] flex items-center gap-2">
                                        {party.name} <StatusPill status={party.type} />
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px] font-bold text-slate-500">
                                        {party.phone      && <span className="inline-flex items-center gap-1" dir="ltr"><Phone size={12} /> {party.phone}</span>}
                                        {party.email      && <span className="inline-flex items-center gap-1" dir="ltr"><Mail size={12} /> {party.email}</span>}
                                        {party.vat_number && <span className="inline-flex items-center gap-1" dir="ltr"><Hash size={12} /> {party.vat_number}</span>}
                                    </div>
                                </div>
                            </div>
                            {/* الرصيد الجاري */}
                            <div className="text-left bg-slate-50 rounded-2xl px-5 py-3 border border-slate-100">
                                <div className="text-[11px] font-bold text-slate-400 mb-0.5 flex items-center gap-1 justify-end">
                                    <Wallet size={12} /> الرصيد الحالي
                                </div>
                                <div className="text-2xl font-black"><Money value={Math.abs(closing)} /></div>
                                <div className="text-[11px] font-bold text-slate-500 mt-0.5">{balLabel}</div>
                            </div>
                        </div>
                    </div>

                    {/* فلتر التاريخ */}
                    <div className="flex flex-wrap items-end gap-3 mb-4 no-print">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">من تاريخ</label>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-[#1a365d] outline-none focus:border-[#c5a059]" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">إلى تاريخ</label>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-[#1a365d] outline-none focus:border-[#c5a059]" />
                        </div>
                        {(from || to) && (
                            <button onClick={() => { setFrom(''); setTo(''); }}
                                className="px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 text-slate-500 hover:border-rose-400 hover:text-rose-500 transition">
                                مسح
                            </button>
                        )}
                    </div>

                    {/* جدول الحركات */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-400 text-[12px] font-black border-b border-slate-100">
                                        <th className="text-right py-3 px-3">التاريخ</th>
                                        <th className="text-right py-3 px-3">القيد</th>
                                        <th className="text-right py-3 px-3">البيان</th>
                                        <th className="text-left py-3 px-3">مدين</th>
                                        <th className="text-left py-3 px-3">دائن</th>
                                        <th className="text-left py-3 px-3">الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* رصيد افتتاحي */}
                                    <tr className="border-b border-slate-50 bg-amber-50/30">
                                        <td className="py-2.5 px-3 text-slate-400 font-bold" colSpan={3}>رصيد افتتاحي</td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3"></td>
                                        <td className="py-2.5 px-3 text-left"><Money value={opening} /></td>
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-slate-300 font-bold">
                                            {(from || to) ? 'لا توجد حركات في هذه الفترة' : 'لا توجد حركات مسجّلة لهذا الطرف في الدفتر المستقل بعد'}
                                        </td></tr>
                                    ) : rows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                                            <td className="py-2.5 px-3 text-slate-500 font-bold whitespace-nowrap" dir="ltr">{r.date}</td>
                                            <td className="py-2.5 px-3 text-[12px]" dir="ltr">
                                                {r.entry_id
                                                    ? <EntityLink to={`entry/${r.entry_id}`} muted>{r.entry_no}</EntityLink>
                                                    : <span className="text-slate-400 font-bold">{r.entry_no}</span>}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 font-bold">{r.line_desc || r.ent_desc || '—'}</td>
                                            <td className="py-2.5 px-3 text-left"><Money value={r.debit} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left"><Money value={r.credit} zeroDash /></td>
                                            <td className="py-2.5 px-3 text-left font-black"><Money value={r.balance} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-black text-[#1a365d] border-t-2 border-slate-200">
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
