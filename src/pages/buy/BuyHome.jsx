import React, { useState, useEffect, useCallback } from 'react';
import { FilePlus, RefreshCw, AlertTriangle, Paperclip, Wallet, TrendingUp, Archive, Loader2, CheckCircle2, ScanLine, Receipt } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { PasskeySetupCard } from '../../components/PasskeyButton';
import { passkeyEnrolledHere } from '../../lib/passkey';
import { syncDaftra } from '../../lib/sync';

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ─── الشاشة الأولى: أرقام اليوم وآخر الفواتير ───────────────────────────────
export default function BuyHome({ onNew }) {
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
            fetch(`${API_URL}?action=daftra_link_status`, { headers: h })
                .then(r => r.json()).then(r => r.success && setDocs(r)).catch(() => {});
        } finally { setBusy(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // سحب مرفقات دفترة إلى تخزيننا — دفعة كل ضغطة حتى تنتهي
    const archive = async () => {
        setArch(true);
        try {
            const t2 = getAdminToken();
            const h2 = t2 ? { Authorization: `Bearer ${t2}` } : {};
            let idle = 0;
            for (let i = 0; i < 30; i++) {
                const r = await fetch(`${API_URL}?action=daftra_doc_archive&limit=15`,
                    { headers: h2, cache: 'no-store' }).then(x => x.json());
                if (!r.success) { setDocs(d => ({ ...(d || {}), err: r.message, diag: r.detail || '' })); break; }
                setDocs(d => ({ ...(d || {}), archived: (d?.total || 0) - r.remaining, remaining: r.remaining,
                    stuck: r.stuck || 0, err: '', diag: r.failed ? (r.detail || '') : '' }));
                if (r.remaining === 0) break;
                // ملف متعثر ينزل آخر الطابور، فالدفعة التالية تكمل. نتوقف حين يتوقف التقدّم
                idle = r.archived > 0 ? 0 : idle + 1;
                if (idle >= 3) {
                    setDocs(d => ({ ...(d || {}), err: r.message }));
                    break;
                }
            }
        } finally { setArch(false); }
    };

    // فرز المستندات آلياً: فاتورة أم إيصال، وربط الإيصال بدفعته عند التطابق القاطع
    const classify = async () => {
        setClsBusy(true);
        try {
            const t2 = getAdminToken();
            const h2 = t2 ? { Authorization: `Bearer ${t2}` } : {};
            let tot = { classified: 0, receipts: 0, linked: 0 };
            for (let i = 0; i < 40; i++) {
                const r = await fetch(`${API_URL}?action=doc_classify_run&limit=4`,
                    { headers: h2, cache: 'no-store' }).then(x => x.json());
                if (!r.success) { setCls({ err: r.message }); break; }
                tot = { classified: tot.classified + r.classified, receipts: tot.receipts + r.receipts,
                        linked: tot.linked + r.linked };
                setCls({ ...tot, remaining: r.remaining });
                if (r.remaining === 0 || (!r.classified && r.failed)) break;
            }
        } finally { setClsBusy(false); }
    };

    // إيصالات الدفعات: نافذة الدفعة في دفترة تحمل رابط الملف، فنقرؤه وننزّله ونربطه
    const pullReceipts = async () => {
        setRcpBusy(true);
        try {
            const t2 = getAdminToken();
            const h2 = t2 ? { Authorization: `Bearer ${t2}` } : {};
            let tot = { pulled: 0, none: 0 };
            for (let i = 0; i < 60; i++) {
                const r = await fetch(`${API_URL}?action=pay_receipt_pull&limit=6`,
                    { headers: h2, cache: 'no-store' }).then(x => x.json());
                if (!r.success) { setRcp({ err: r.message }); break; }
                tot = { pulled: tot.pulled + r.pulled, none: tot.none + r.no_receipt };
                setRcp({ ...tot, remaining: r.remaining, err: '' });
                if (r.remaining === 0 || (!r.pulled && !r.no_receipt)) break;
            }
        } finally { setRcpBusy(false); }
    };

    const p = k?.purchases || {};
    const cards = [
        { t: 'مشتريات الشهر', v: money(p.month_total), icon: TrendingUp,   c: 'from-emerald-600 to-emerald-800' },
        { t: 'المستحق للموردين', v: money(p.unpaid),   icon: Wallet,       c: 'from-amber-600 to-amber-800' },
        { t: 'بلا مستند',      v: p.docs_missing ?? '—', icon: Paperclip,  c: 'from-rose-600 to-rose-800' },
        { t: 'فواتير الشهر',   v: p.month_count ?? '—',  icon: AlertTriangle, c: 'from-sky-600 to-sky-800' },
    ];

    return (
        <div className="p-4 space-y-4">
            <button onClick={onNew}
                className="w-full py-4 rounded-2xl bg-gold-500 text-slate-900 font-black flex items-center justify-center gap-2 shadow-lg active:scale-[.99] transition">
                <FilePlus size={20} /> فاتورة جديدة
            </button>

            {askPk && <PasskeySetupCard onDone={() => setAskPk(false)} />}

            {docs && docs.total > 0 && docs.remaining > 0 && (
                <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <Archive size={15} className="text-[#c5a059]" />
                        <span className="text-[12px] font-black">مرفقات دفترة</span>
                        <span className="text-[11px] text-slate-400 mr-auto">
                            {docs.archived} من {docs.total} عندنا
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        نسخ المرفقات إلى تخزيننا يجعلها تُفتح فوراً بلا اعتماد على جلسة دفترة.
                    </p>
                    {docs.err && <p className="text-[11px] text-amber-300 font-bold">{docs.err}</p>}
                    {docs.stuck > 0 && (
                        <p className="text-[11px] text-slate-400">
                            {docs.stuck} مرفقا تعذّر جلبه بعد ثلاث محاولات — تُعاد المحاولة مع أي ضغطة لاحقة
                        </p>
                    )}
                    {docs.diag && (
                        <pre dir="ltr" className="text-[9px] text-slate-400 bg-black/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">
                            {docs.diag}
                        </pre>
                    )}
                    <button onClick={archive} disabled={arch}
                        className="w-full min-h-[44px] rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {arch ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        {arch ? 'يسحب المرفقات...' : `اسحب ${docs.remaining} مرفقا إلى تخزيننا`}
                    </button>
                </div>
            )}
            {docs && docs.total > 0 && docs.remaining === 0 && (
                <div className="rounded-xl bg-emerald-500/15 text-emerald-300 p-2.5 text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 size={14} /> كل مرفقات دفترة ({docs.total}) محفوظة عندنا وتُفتح بلا جلسة
                </div>
            )}

            {docs && docs.total > 0 && docs.remaining === 0 && (
                <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <ScanLine size={15} className="text-[#c5a059]" />
                        <span className="text-[12px] font-black">فرز المستندات</span>
                        {cls && !cls.err && (
                            <span className="text-[11px] text-slate-400 mr-auto">
                                {cls.classified} مفروز · {cls.linked} مربوط
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        دفترة ترفق كل شيء على الفاتورة، فيصل الإيصال مصنّفاً فاتورةً. المعالج يقرأ كل مستند
                        ويحدّد نوعه، ويربط الإيصال بدفعته حين يطابق مبلغها تماماً — وما عدا ذلك يُترك لمراجعتك.
                    </p>
                    {cls?.err && <p className="text-[11px] text-amber-300 font-bold">{cls.err}</p>}
                    <button onClick={classify} disabled={clsBusy}
                        className="w-full min-h-[44px] rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {clsBusy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                        {clsBusy ? 'يفرز المستندات...' : 'افرز المستندات آلياً'}
                    </button>
                </div>
            )}

            <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <Receipt size={15} className="text-[#c5a059]" />
                    <span className="text-[12px] font-black">إيصالات الدفعات</span>
                    {rcp && !rcp.err && (
                        <span className="text-[11px] text-slate-400 mr-auto">
                            {rcp.pulled} مسحوب · {rcp.none} بلا إيصال
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                    يفتح كل دفعة في دفترة، ينزّل إيصالها، ويربطه بها بالمعرّف — لا بمطابقة المبلغ.
                </p>
                {rcp?.err && <p className="text-[11px] text-amber-300 font-bold">{rcp.err}</p>}
                <button onClick={pullReceipts} disabled={rcpBusy}
                    className="w-full min-h-[44px] rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {rcpBusy ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                    {rcpBusy ? 'يسحب الإيصالات...' : 'اسحب إيصالات الدفعات'}
                </button>
            </div>

            {sync && (sync.added > 0 || sync.updated > 0) && (
                <div className="rounded-xl bg-emerald-500/15 text-emerald-300 p-2.5 text-[11px] font-bold">
                    وصل من دفترة: {sync.added} فاتورة جديدة · {sync.updated} محدَّثة
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                {cards.map((c, i) => {
                    const Icon = c.icon;
                    return (
                        <div key={i} className={'rounded-2xl p-3 bg-gradient-to-bl ' + c.c}>
                            <Icon size={16} className="text-white/70" />
                            <div className="text-xl font-black mt-1 tabular-nums">{c.v}</div>
                            <div className="text-[11px] text-white/70 font-bold">{c.t}</div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between">
                <h3 className="font-black text-sm">آخر فواتير الشهر</h3>
                <button onClick={() => load(true)} className="text-slate-400">
                    <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="space-y-2">
                {last.map((r, i) => (
                    <div key={i} className="rounded-xl bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold truncate">{r.supplier}</div>
                            <div className="text-sm font-black tabular-nums shrink-0">{money(r.gross)}</div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">#{r.no} · {r.date}</div>
                    </div>
                ))}
                {!last.length && !busy && <p className="text-center text-slate-500 text-sm py-6">لا فواتير هذا الشهر</p>}
            </div>
        </div>
    );
}
