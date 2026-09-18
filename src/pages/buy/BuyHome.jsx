import React, { useState, useEffect, useCallback } from 'react';
import { FilePlus, RefreshCw, AlertTriangle, Paperclip, Wallet, TrendingUp, Archive, Loader2, CheckCircle2, ScanLine, Receipt, FileWarning, X, Ticket } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { PasskeySetupCard } from '../../components/PasskeyButton';
import { passkeyEnrolledHere } from '../../lib/passkey';
import { syncDaftra } from '../../lib/sync';
import { useEntity } from './entityCtx';

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ─── الشاشة الأولى: أرقام اليوم وآخر الفواتير ───────────────────────────────
export default function BuyHome({ onNew }) {
    const { openEntity } = useEntity();
    const [k, setK]       = useState(null);
    const [last, setLast] = useState([]);
    const [busy, setBusy] = useState(false);
    const [askPk, setAskPk] = useState(() => !passkeyEnrolledHere());

    const [sync, setSync] = useState(null);
    const [docs, setDocs] = useState(null);      // حالة أرشفة مرفقات دفترة
    const [arch, setArch] = useState(false);
    const [cls, setCls] = useState(null);        // نتيجة الفرز الآلي للمستندات
    const [rcp, setRcp] = useState(null);        // سحب إيصالات الدفعات
    const [rcpBusy, setRcpBusy] = useState(false);
    const [recOpen, setRecOpen] = useState(false);
    const [gaps, setGaps]       = useState(null);   // نواقص التوثيق
    const [gapsOpen, setGapsOpen] = useState(false);
    const [gapTab, setGapTab]   = useState('neither');
    const [tickets, setTickets] = useState(null);  // تذاكر تعديل المستندات
    const [tkOpen, setTkOpen]   = useState(false);
    const [tkBusy, setTkBusy]   = useState(0);
    const [toolsOpen, setToolsOpen] = useState(false);  // أدوات دفترة: صيانة لا استعمال يومي
    const [drillKey, setDrillKey] = useState(null);   // بطاقة مفتوحة على تفصيلها
    const [drill, setDrill]       = useState(null);
    const [drillBusy, setDrillBusy] = useState(false);
    const [clsBusy, setClsBusy] = useState(false);

    const load = useCallback(async (force = false) => {
        setBusy(true);
        try {
            // نجلب من دفترة أولا ثم نعرض، فالأرقام تكون أحدث ما لديها
            const s = await syncDaftra({ force });
            if (s && s.success && !s.skipped) setSync(s);
            const t = getAdminToken();
            const h = t ? { Authorization: `Bearer ${t}` } : {};
            const [a, b] = await Promise.all([
                fetch(`${API_URL}?action=mtg_kpis`, { headers: h }).then(r => r.json()).catch(() => null),
                fetch(`${API_URL}?action=kpi_detail&key=month_total`, { headers: h }).then(r => r.json()).catch(() => null),
            ]);
            if (a && a.success !== false) setK(a.data || a);
            if (b && b.success) setLast((b.rows || []).slice(0, 12));
            fetch(`${API_URL}?action=doc_tickets&status=pending`, { headers: h })
                .then(r => r.json()).then(r => r.success && setTickets(r)).catch(() => {});
            fetch(`${API_URL}?action=buy_gaps`, { headers: h })
                .then(r => r.json()).then(r => r.success && setGaps(r)).catch(() => {});
            fetch(`${API_URL}?action=daftra_link_status`, { headers: h })
                .then(r => r.json()).then(r => r.success && setDocs(r)).catch(() => {});
        } finally { setBusy(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // سحب مرفقات دفترة إلى تخزيننا — دفعة كل ضغطة حتى تنتهي

    // فرز المستندات آلياً: فاتورة أم إيصال، وربط الإيصال بدفعته عند التطابق القاطع

    // إيصالات الدفعات: نافذة الدفعة في دفترة تحمل رابط الملف، فنقرؤه وننزّله ونربطه


    const p = k?.purchases || {};
    const cards = [
        { t: 'مشتريات الشهر', v: money(p.month_total), icon: TrendingUp,   c: 'from-emerald-600 to-emerald-800', k: 'month_total' },
        { t: 'المستحق للموردين', v: money(p.unpaid),   icon: Wallet,       c: 'from-amber-600 to-amber-800', k: 'unpaid' },
        { t: 'بلا مستند',      v: p.docs_missing ?? '—', icon: Paperclip,  c: 'from-rose-600 to-rose-800', k: 'docs_missing' },
        { t: 'فواتير الشهر',   v: p.month_count ?? '—',  icon: AlertTriangle, c: 'from-sky-600 to-sky-800', k: 'month_total' },
    ];

    // كل بطاقة لها مفتاح تفصيل في الخادم — تُفتح قائمتها ومنها الفاتورة
    const openDrill = useCallback(async key => {
        setDrillKey(key); setDrill(null); setDrillBusy(true);
        try {
            const t = getAdminToken();
            const r = await fetch(`${API_URL}?action=kpi_detail&key=${key}`,
                { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(x => x.json());
            setDrill(r.success ? r : { rows: [], title: 'تعذر الجلب' });
        } catch { setDrill({ rows: [], title: 'تعذر الاتصال' }); }
        finally { setDrillBusy(false); }
    }, []);

    const decide = async (id, approve) => {
        setTkBusy(id);
        try {
            const t = getAdminToken();
            const r = await fetch(`${API_URL}?action=doc_ticket_decide`, {
                method: 'POST', headers: { 'Content-Type': 'application/json',
                    ...(t ? { Authorization: `Bearer ${t}` } : {}) },
                body: JSON.stringify({ id, approve }),
            }).then(x => x.json());
            if (!r.success) alert(r.message || 'تعذر الحسم');
            load(true);
        } catch { alert('تعذر الاتصال'); }
        finally { setTkBusy(0); }
    };

    // نواقص التوثيق: نسخة دفترة المطبوعة لا تُحتسب مستندا
    const gt = gaps?.totals;
    const gapRows = gaps ? (gaps[gapTab] || []) : [];
    const GAP_TABS = [
        { k: 'neither',    t: 'بلا الاثنين' },
        { k: 'no_invoice', t: 'بلا فاتورة مورّد' },
        { k: 'no_receipt', t: 'بلا إثبات سداد' },
    ];


    return (
        <div className="p-4 space-y-4">
            <button onClick={onNew}
                className="w-full py-4 rounded-2xl bg-gold-500 text-slate-900 font-black flex items-center justify-center gap-2 shadow-lg active:scale-[.99] transition">
                <FilePlus size={20} /> فاتورة جديدة
            </button>

            {askPk && <PasskeySetupCard onDone={() => setAskPk(false)} />}

            {/* أدوات السحب من دفترة انتقلت إلى «مركز الصيانة» في اللوحة — الشاشة هنا للعمل لا للصيانة */}

            {sync && (sync.added > 0 || sync.updated > 0) && (
                <div className="rounded-xl bg-emerald-500/15 text-emerald-300 p-2.5 text-[11px] font-bold">
                    وصل من دفترة: {sync.added} فاتورة جديدة · {sync.updated} محدَّثة
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                {cards.map((c, i) => {
                    const Icon = c.icon;
                    return (
                        <button key={i} onClick={() => c.k && openDrill(c.k)}
                            className={'text-right rounded-2xl p-3 bg-gradient-to-bl ' + c.c}>
                            <Icon size={16} className="text-white/70" />
                            <div className="text-xl font-black mt-1 tabular-nums">{c.v}</div>
                            <div className="text-[11px] text-white/70 font-bold">{c.t}</div>
                        </button>
                    );
                })}
            </div>

            {gt && (gt.neither.n + gt.no_invoice.n + gt.no_receipt.n) > 0 && (
                <button onClick={() => setGapsOpen(true)}
                    className="w-full text-right rounded-2xl p-4 bg-gradient-to-bl from-orange-600 to-orange-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-white/80">
                                <FileWarning size={16} />
                                <span className="text-[11px] font-bold">نواقص التوثيق</span>
                            </div>
                            <div className="text-2xl font-black mt-1 tabular-nums">{gt.neither.n}</div>
                            <div className="text-[11px] text-white/70 font-bold">فاتورة بلا فاتورة مورّد ولا إثبات سداد</div>
                        </div>
                        <div className="text-left text-[11px] text-white/75 font-bold space-y-1">
                            <div>{gt.no_invoice.n} بلا فاتورة مورّد</div>
                            <div>{gt.no_receipt.n} بلا إثبات سداد</div>
                            <div className="tabular-nums">{money(gt.neither.amount)} ريال</div>
                        </div>
                    </div>
                </button>
            )}

            {tickets?.pending > 0 && (
                <button onClick={() => setTkOpen(true)}
                    className="w-full text-right rounded-2xl p-4 bg-gradient-to-bl from-violet-600 to-violet-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-white/80">
                                <Ticket size={16} />
                                <span className="text-[11px] font-bold">تذاكر تعديل المستندات</span>
                            </div>
                            <div className="text-2xl font-black mt-1 tabular-nums">{tickets.pending}</div>
                        </div>
                        <div className="text-[11px] text-white/75 font-bold">
                            {tickets.is_manager ? 'بانتظار موافقتك' : 'طلباتك المعلّقة'}
                        </div>
                    </div>
                </button>
            )}

            {tkOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="font-black">تذاكر تعديل المستندات</h3>
                        <button onClick={() => setTkOpen(false)} className="text-slate-400"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {(tickets?.data || []).map(t => (
                            <div key={t.id} className="rounded-xl bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold">
                                            {t.kind === 'add' ? 'إضافة مستند' : 'حذف مستند'}
                                            <span className="text-slate-400 font-normal"> · فاتورة #{t.invoice_no}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">{t.supplier}</div>
                                        <div className="text-[12px] mt-1">{t.file_name}</div>
                                        <div className="text-[11px] text-slate-400 mt-1">السبب: {t.reason}</div>
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            {t.requested_by} · {String(t.requested_at || '').slice(0, 16)}
                                        </div>
                                    </div>
                                    {t.drive_url && t.kind === 'add' && (
                                        <a href={t.drive_url} target="_blank" rel="noreferrer"
                                            className="text-[11px] font-bold text-sky-300 shrink-0">فتح الملف</a>
                                    )}
                                </div>
                                {tickets.is_manager && (
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => decide(t.id, true)} disabled={tkBusy === t.id}
                                            className="flex-1 h-10 rounded-xl bg-emerald-600 text-[12px] font-bold disabled:opacity-50">
                                            موافقة
                                        </button>
                                        <button onClick={() => decide(t.id, false)} disabled={tkBusy === t.id}
                                            className="flex-1 h-10 rounded-xl bg-white/10 text-[12px] font-bold disabled:opacity-50">
                                            رفض
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {!(tickets?.data || []).length && <p className="text-center text-slate-500 text-sm py-8">لا تذاكر معلّقة</p>}
                    </div>
                </div>
            )}

            {drillKey && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="font-black">{drill?.title || 'التفاصيل'}</h3>
                        <button onClick={() => { setDrillKey(null); setDrill(null); }}
                            className="text-slate-400"><X size={20} /></button>
                    </div>
                    {drillBusy && <p className="text-center text-slate-500 text-sm py-8">يجلب…</p>}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {(drill?.rows || []).map((r, i) => (
                            <button key={i} onClick={() => { setDrillKey(null); openEntity('purchase', r.id); }}
                                className="w-full text-right rounded-xl bg-white/5 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold truncate">{r.supplier}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">#{r.no} · {r.date}</div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <div className="text-sm font-black tabular-nums">{money(r.gross)}</div>
                                        {Number(r.gross) - Number(r.paid) > 0.5 && (
                                            <div className="text-[11px] text-amber-400 font-bold tabular-nums">
                                                متبقٍ {money(Number(r.gross) - Number(r.paid))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                        {!drillBusy && !(drill?.rows || []).length && (
                            <p className="text-center text-slate-500 text-sm py-8">لا صفوف</p>
                        )}
                    </div>
                </div>
            )}

            {gapsOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="font-black">نواقص التوثيق</h3>
                        <button onClick={() => setGapsOpen(false)} className="text-slate-400"><X size={20} /></button>
                    </div>
                    <div className="flex gap-2 p-3 overflow-x-auto">
                        {GAP_TABS.map(t => (
                            <button key={t.k} onClick={() => setGapTab(t.k)}
                                className={'shrink-0 px-3 py-2 rounded-xl text-[12px] font-bold ' +
                                    (gapTab === t.k ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-300')}>
                                {t.t} · {gaps?.totals?.[t.k]?.n ?? 0}
                            </button>
                        ))}
                    </div>
                    <div className="px-3 pb-2 text-[11px] text-slate-400 font-bold tabular-nums">
                        {gapRows.length} فاتورة · {money(gaps?.totals?.[gapTab]?.amount)} ريال
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
                        {gapRows.map(r => (
                            <button key={r.id} onClick={() => { setGapsOpen(false); openEntity('purchase', r.id); }}
                                className="w-full text-right rounded-xl bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold truncate">{r.supplier}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                            #{r.no} · {r.date}{r.project ? ' · ' + r.project : ''}
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <div className="text-sm font-black tabular-nums">{money(r.gross)}</div>
                                        {Number(r.remaining) > 0.5 && (
                                            <div className="text-[11px] text-amber-400 font-bold tabular-nums">
                                                متبقٍ {money(r.remaining)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 text-[10px] font-bold">
                                    <span className={'px-2 py-0.5 rounded-full ' + (Number(r.orig_docs) ? 'bg-emerald-600/25 text-emerald-300' : 'bg-rose-600/25 text-rose-300')}>
                                        {Number(r.orig_docs) ? 'فاتورة مورّد ✓' : 'بلا فاتورة مورّد'}
                                    </span>
                                    <span className={'px-2 py-0.5 rounded-full ' + (Number(r.receipts) ? 'bg-emerald-600/25 text-emerald-300' : 'bg-rose-600/25 text-rose-300')}>
                                        {Number(r.receipts) ? 'إثبات سداد ✓' : 'بلا إثبات سداد'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                                        {r.payments} دفعة
                                    </span>
                                </div>
                            </button>
                        ))}
                        {!gapRows.length && <p className="text-center text-slate-500 text-sm py-8">لا شيء في هذه الفئة</p>}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h3 className="font-black text-sm">آخر فواتير الشهر</h3>
                <button onClick={() => load(true)} className="text-slate-400">
                    <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="space-y-2">
                {last.map((r, i) => (
                    <button key={i} onClick={() => r.id && openEntity('purchase', r.id)}
                        className="w-full text-right rounded-xl bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold truncate">{r.supplier}</div>
                            <div className="text-sm font-black tabular-nums shrink-0">{money(r.gross)}</div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">#{r.no} · {r.date}</div>
                    </button>
                ))}
                {!last.length && !busy && <p className="text-center text-slate-500 text-sm py-6">لا فواتير هذا الشهر</p>}
            </div>
        </div>
    );
}
