import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Loader2, ArrowLeft, Search, Printer, RefreshCw, BookOpen, Hash,
    CheckCircle2, Clock, Link2, Building2, Calendar
} from 'lucide-react';
import { apiGet } from '../../lib/api/client';
import { Money, StatusPill, EntityLink, Breadcrumbs } from '../../components/ui';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة القيود (المحرّك المستقل gl_entries / gl_entry_single):
//   • بلا معرّف  → قائمة القيود القابلة للنقر (الأحدث أولاً).
//   • مع معرّف   → تفاصيل القيد كاملة (الأطراف قابلة للنقر، توازن مدين/دائن).
//  روابط مستقرّة: /admin/dashboard/entry   و   /admin/dashboard/entry/:id
// ════════════════════════════════════════════════════════════════════════════

const REF_LABELS = {
    opening:  'رصيد افتتاحي',
    manual:   'قيد يدوي',
    proof:    'سند',
    sales:    'فاتورة مبيعات',
    purchase: 'فاتورة مشتريات',
    payment:  'سند قبض/صرف',
    receipt:  'سند قبض',
    party_subledger: 'تفصيل أطراف',
};

export default function EntryDetail({ entryId, setActiveTab, tenant = 1 }) {
    if (entryId) return <Detail entryId={Number(entryId)} setActiveTab={setActiveTab} tenant={tenant} />;
    return <Browse tenant={tenant} />;
}

// ─── قائمة القيود ────────────────────────────────────────────────────────────
function Browse({ tenant }) {
    const [rows, setRows]    = useState([]);
    const [loading, setLoad] = useState(true);
    const [q, setQ]          = useState('');

    const load = useCallback(() => {
        setLoad(true);
        apiGet('gl_entries', { tenant })
            .then(r => setRows(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setRows([]))
            .finally(() => setLoad(false));
    }, [tenant]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(e =>
            (e.entry_no || '').toLowerCase().includes(s) ||
            (e.description || '').toLowerCase().includes(s) ||
            (e.date || '').includes(s)
        );
    }, [rows, q]);

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-6xl mx-auto" dir="rtl">
            <Breadcrumbs items={[{ label: 'دفتر اليومية' }]} className="mb-4" />

            <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                <div className="p-5 md:p-6 border-b border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 rounded-xl flex items-center justify-center">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-100">دفتر اليومية</h3>
                            <p className="text-slate-400 dark:text-brand-500 text-xs font-bold">كل القيود في المحرّك المستقل — انقر القيد لعرض تفاصيله</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={q} onChange={e => setQ(e.target.value)}
                            placeholder="بحث برقم القيد أو البيان أو التاريخ..."
                            className="w-64 max-w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20 outline-none text-sm font-bold text-brand-800 dark:text-brand-100 dark:bg-brand-900 dark:placeholder-brand-500"
                        />
                    </div>
                </div>

                <div className="px-5 md:px-6 pt-4 flex justify-end">
                    <button onClick={load} title="تحديث"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-500 dark:text-brand-400 hover:border-[#c5a059] transition">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
                    </button>
                </div>

                <div className="p-4 md:p-5">
                    {loading ? (
                        <div className="text-center py-16 text-slate-400 dark:text-brand-500"><Loader2 className="animate-spin mx-auto mb-2" size={28} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-300 dark:text-brand-600 font-bold">لا توجد قيود مطابقة</div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 dark:text-brand-500 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-2.5 px-3">رقم القيد</th>
                                        <th className="text-right py-2.5 px-3">التاريخ</th>
                                        <th className="text-right py-2.5 px-3">البيان</th>
                                        <th className="text-right py-2.5 px-3">النوع</th>
                                        <th className="text-left py-2.5 px-3">المبلغ</th>
                                        <th className="text-center py-2.5 px-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(e => (
                                        <tr key={e.id} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                            <td className="py-2.5 px-3">
                                                <EntityLink to={`entry/${e.id}`} icon={Hash}>{e.entry_no || `#${e.id}`}</EntityLink>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold whitespace-nowrap" dir="ltr">{e.date}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-brand-300 font-bold max-w-xs truncate">{e.description || '—'}</td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold text-[12px]">{REF_LABELS[e.ref_type] || e.ref_type || '—'}</td>
                                            <td className="py-2.5 px-3 text-left font-black"><Money value={e.total_debit} /></td>
                                            <td className="py-2.5 px-3 text-center">
                                                {Number(e.is_posted) === 1
                                                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-[12px] font-bold"><CheckCircle2 size={13} /> مُرحَّل</span>
                                                    : <span className="inline-flex items-center gap-1 text-amber-500 text-[12px] font-bold"><Clock size={13} /> مسودّة</span>}
                                            </td>
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

// ─── تفاصيل قيد ──────────────────────────────────────────────────────────────
function Detail({ entryId, setActiveTab, tenant }) {
    const [entry, setEntry]   = useState(null);
    const [lines, setLines]   = useState([]);
    const [loading, setLoad]  = useState(true);
    const [err, setErr]       = useState('');

    const load = useCallback(() => {
        setLoad(true); setErr('');
        // party_name يأتي الآن من JOIN في gl_entry_single — لا حاجة لجلب كل الأطراف
        apiGet('gl_entry_single', { tenant, id: entryId })
            .then(r => {
                if (r?.success) { setEntry(r.entry); setLines(Array.isArray(r.lines) ? r.lines : []); }
                else { setErr(r?.message || 'تعذّر جلب القيد'); setEntry(null); }
            })
            .catch(() => setErr('خطأ في الاتصال'))
            .finally(() => setLoad(false));
    }, [tenant, entryId]);

    useEffect(() => { load(); }, [load]);

    const totals = useMemo(() => {
        let d = 0, c = 0;
        lines.forEach(l => { d += Number(l.debit) || 0; c += Number(l.credit) || 0; });
        return { debit: Math.round(d * 100) / 100, credit: Math.round(c * 100) / 100 };
    }, [lines]);
    const balanced = Math.abs(totals.debit - totals.credit) < 0.005;

    return (
        <div className="animate-fadeIn p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4 no-print">
                <Breadcrumbs items={[
                    { label: 'دفتر اليومية', to: 'entry' },
                    { label: entry?.entry_no || `قيد #${entryId}` },
                ]} />
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('entry')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300 hover:border-[#c5a059] transition">
                        <ArrowLeft size={15} /> القائمة
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
            ) : !entry ? null : (
                <>
                    {/* بطاقة القيد */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 md:p-6 mb-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-2xl flex items-center justify-center">
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                                        {entry.entry_no || `قيد #${entryId}`}
                                        {Number(entry.is_posted) === 1
                                            ? <span className="inline-flex items-center gap-1 text-emerald-600 text-[12px] font-bold"><CheckCircle2 size={14} /> مُرحَّل</span>
                                            : <span className="inline-flex items-center gap-1 text-amber-500 text-[12px] font-bold"><Clock size={14} /> مسودّة</span>}
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px] font-bold text-slate-500 dark:text-brand-400">
                                        <span className="inline-flex items-center gap-1" dir="ltr"><Calendar size={12} /> {entry.date}</span>
                                        {entry.ref_type && <span className="inline-flex items-center gap-1"><Link2 size={12} /> {REF_LABELS[entry.ref_type] || entry.ref_type}</span>}
                                    </div>
                                    {entry.description && <p className="mt-1.5 text-sm font-bold text-slate-600 dark:text-brand-300">{entry.description}</p>}
                                </div>
                            </div>
                            {/* التوازن */}
                            <div className={`text-left rounded-2xl px-5 py-3 border ${balanced ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-200'}`}>
                                <div className="text-[11px] font-bold text-slate-400 dark:text-brand-500 mb-0.5 text-left">إجمالي القيد</div>
                                <div className="text-2xl font-black"><Money value={totals.debit} /></div>
                                <div className={`text-[11px] font-bold mt-0.5 ${balanced ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {balanced ? 'متوازن (مدين = دائن)' : 'غير متوازن — راجِع البنود'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* جدول البنود */}
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 dark:bg-brand-800/40 text-slate-400 dark:text-brand-500 text-[12px] font-black border-b border-slate-100 dark:border-brand-700">
                                        <th className="text-right py-3 px-3">الحساب</th>
                                        <th className="text-right py-3 px-3">الطرف</th>
                                        <th className="text-right py-3 px-3">البيان</th>
                                        <th className="text-left py-3 px-3">مدين</th>
                                        <th className="text-left py-3 px-3">دائن</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.length === 0 ? (
                                        <tr><td colSpan={5} className="py-12 text-center text-slate-300 font-bold">لا توجد بنود</td></tr>
                                    ) : lines.map((l, i) => {
                                        const pid   = Number(l.party_id) || 0;
                                        // party_name تأتي من JOIN في gl_entry_single مباشرة
                                        const pname = pid ? (l.party_name || `طرف #${pid}`) : null;
                                        return (
                                            <tr key={l.id || i} className="border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/60 dark:hover:bg-brand-800 transition">
                                                <td className="py-2.5 px-3">
                                                    <span className="text-slate-400 dark:text-brand-500 font-bold text-[12px] ml-1" dir="ltr">{l.account_code}</span>
                                                    <span className="text-slate-700 dark:text-brand-300 font-bold">{l.account_name}</span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    {pid
                                                        ? <EntityLink to={`parties/${pid}`} icon={Building2}>{pname}</EntityLink>
                                                        : <span className="text-slate-300 dark:text-brand-600">—</span>}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-500 dark:text-brand-400 font-bold">{l.description || '—'}</td>
                                                <td className="py-2.5 px-3 text-left"><Money value={l.debit} zeroDash /></td>
                                                <td className="py-2.5 px-3 text-left"><Money value={l.credit} zeroDash /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 dark:bg-brand-800/60 font-black text-brand-800 dark:text-brand-100 border-t-2 border-slate-200 dark:border-brand-700">
                                        <td className="py-3 px-3" colSpan={3}>الإجماليات</td>
                                        <td className="py-3 px-3 text-left"><Money value={totals.debit} /></td>
                                        <td className="py-3 px-3 text-left"><Money value={totals.credit} /></td>
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
