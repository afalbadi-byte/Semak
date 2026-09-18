import React, { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw, Loader2, Wallet, Link2, Mail, Database, PlayCircle, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import ExportButton from '../../components/ExportButton';

// ─── مركز الصيانة (تقنية المعلومات) ─────────────────────────────────────────
// هنا تعيش أزرار المطابقة والسحب والتدقيق وحدها، بعيداً عن شاشات العمل.
// الكشوفات والتقارير تبقى في أماكنها — هذه أدوات تشغيل لا تقارير.

const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const get   = (a, q = '') => fetch(`${API_URL}?action=${a}${q}`, { headers: auth() }).then(r => r.json());
const post  = (a, body) => fetch(`${API_URL}?action=${a}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(body || {}),
}).then(r => r.json());

const SECTIONS = [
    { k: 'sync',   t: 'المزامنة مع دفترة', i: Database },
    { k: 'paygap', t: 'الدفعات المفقودة',  i: Wallet },
    { k: 'match',  t: 'مطابقة الإيصالات',  i: Link2 },
    { k: 'health', t: 'فحوص النظام',       i: Mail },
];

export default function OpsCenter() {
    const [sec, setSec] = useState('sync');
    // المبدأ: لا خطر على البيانات بضغطة. كل شيء عرضٌ حتى يُفعَّل التنفيذ صراحةً.
    const [armed, setArmed] = useState(false);
    return (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
                <div className="text-xs text-amber-800 leading-relaxed flex-1 min-w-[260px]">
                    أدوات تشغيل للمدير — تسحب وتطابق وتدقّق. الوضع الافتراضي <b>عرض فقط</b>؛ لا شيء يُكتب أو يُحذف
                    حتى تُفعّل التنفيذ، وكل تغيير يُسجَّل ويمكن تتبّعه.
                </div>
                <button onClick={() => setArmed(v => !v)}
                    className={'px-4 py-2 rounded-xl text-xs font-black border ' +
                        (armed ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300')}>
                    {armed ? 'التنفيذ مُفعَّل — اضغط للإيقاف' : 'وضع العرض فقط'}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {SECTIONS.map(s => (
                    <button key={s.k} onClick={() => setSec(s.k)}
                        className={'px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border ' +
                            (sec === s.k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'bg-white border-slate-200 text-slate-600')}>
                        <s.i size={15} /> {s.t}
                    </button>
                ))}
            </div>
            {sec === 'sync'   && <SyncPanel armed={armed} />}
            {sec === 'paygap' && <PayGapPanel armed={armed} />}
            {sec === 'match'  && <MatchPanel armed={armed} />}
            {sec === 'health' && <HealthPanel />}
        </div>
    );
}

// ─── المزامنة ───────────────────────────────────────────────────────────────
function SyncPanel({ armed }) {
    const [st, setSt] = useState(null);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState(null);
    const load = useCallback(() => { get('dmirror_status').then(setSt); }, []);
    useEffect(() => { load(); }, [load]);

    const run = async (what) => {
        setBusy(what); setMsg(null);
        try {
            const r = what === 'refunds' ? await get('refund_sync') : await get('dmirror_tick', '&force=1');
            setMsg(r.success === false
                ? { bad: true, t: r.message || 'تعذّر التشغيل' }
                : { t: what === 'refunds'
                    ? `المرتجعات: فُحص ${r.checked ?? '—'} · أُضيف ${r.added ?? 0} · حُدّث ${r.updated ?? 0}`
                    : `الفواتير: جُلب ${r.result?.fetched ?? 0} · تغيّر ${r.result?.changed ?? 0} · تفاصيل ${r.result?.deep ?? 0}` });
            load();
        } catch { setMsg({ bad: true, t: 'تعذّر الاتصال' }); }
        finally { setBusy(''); }
    };

    const c = st?.counts || {};
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi t="الفواتير في المرآة" v={c.purchases ?? '—'} />
                <Kpi t="البنود" v={c.items ?? '—'} />
                <Kpi t="الدفعات" v={c.payments ?? '—'} />
                <Kpi t="المرفقات" v={c.attachments ?? '—'} sub={`مؤرشف ${c.attachments_archived ?? 0}`} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                    المزامنة تعمل تلقائياً كل ١٠ دقائق (ومسحٌ كامل كل ٦ ساعات) خلف كل طلب على النظام.
                    هذه الأزرار لتشغيلها فوراً عند الحاجة.
                </p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => run('invoices')} disabled={!!busy || !armed}
                        className="px-4 py-2.5 rounded-xl bg-[#1a365d] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {busy === 'invoices' ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
                        اسحب الفواتير الآن
                    </button>
                    <button onClick={() => run('refunds')} disabled={!!busy || !armed}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {busy === 'refunds' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        اسحب المرتجعات الآن
                    </button>
                </div>
                {msg && (
                    <div className={'rounded-xl p-3 text-xs font-bold ' + (msg.bad ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                        {msg.t}
                    </div>
                )}
            </div>
            <Panel title="آخر التشغيلات">
                <table className="w-full text-sm">
                    <thead><tr className="text-[11px] text-slate-500">
                        <th className="text-right py-2">البدء</th><th className="text-right">النوع</th>
                        <th className="text-left">جُلب</th><th className="text-left">تغيّر</th><th className="text-right">ملاحظة</th>
                    </tr></thead>
                    <tbody>
                        {(st?.runs || []).map(r => (
                            <tr key={r.id} className="border-t border-slate-100">
                                <td className="py-2 text-slate-500">{r.started_at}</td>
                                <td>{r.scope}</td>
                                <td className="text-left tabular-nums">{r.fetched}</td>
                                <td className="text-left tabular-nums">{r.changed}</td>
                                <td className="text-slate-400 text-xs">{r.note}</td>
                            </tr>
                        ))}
                        {!(st?.runs || []).length && <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs">لا تشغيلات</td></tr>}
                    </tbody>
                </table>
            </Panel>
        </div>
    );
}

// ─── الدفعات المفقودة ───────────────────────────────────────────────────────
function PayGapPanel({ armed }) {
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState(0);
    const load = useCallback(() => { get('pay_gap_list').then(setD); }, []);
    useEffect(() => { load(); }, [load]);

    const fill = async (row) => {
        const n = Number(row.receipts_n) > 1 && row.confidence === 'verified' ? row.receipts_n : 1;
        if (!window.confirm(`تسجيل ${n > 1 ? n + ' دفعات بمجموع ' : 'دفعة '}${money(row.gap)} على فاتورة ${row.no}؟`)) return;
        setBusy(row.id);
        try {
            const r = await post('pay_gap_fill', { purchase_id: row.id });
            alert(r.success ? (r.message || 'تم') : (r.message || 'تعذّر التسجيل'));
            load();
        } catch { alert('تعذّر الاتصال'); }
        finally { setBusy(0); }
    };

    const STATE = {
        verified:   ['مطابق', 'bg-emerald-100 text-emerald-700'],
        partial:    ['إيصالات ناقصة', 'bg-amber-100 text-amber-700'],
        over:       ['إيصالات أكبر', 'bg-rose-100 text-rose-700'],
        no_receipt: ['بلا إيصال', 'bg-rose-100 text-rose-700'],
        candidate:  ['يحتاج مراجعة', 'bg-amber-100 text-amber-700'],
    };
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi t="فواتير بفجوة" v={d?.count ?? '—'} warn={Number(d?.count) > 0} />
                <Kpi t="مجموع الفجوة" v={money(d?.gap_total)} warn={Number(d?.gap_total) > 0.5} />
                <Kpi t="مطابقة بالإيصالات" v={d?.verified ?? '—'} />
                <Kpi t="تحتاج مراجعة" v={d?.candidates ?? '—'} warn />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
                فواتير ترويستها تقول «مُسدَّدة» ولا يقابلها سطر دفعة. التسجيل يكون بمبلغ الفجوة فقط،
                ومتى طابق مجموع الإيصالات الفجوة تُسجَّل دفعةٌ لكل إيصال بتاريخه. لا يمس دفترة.
            </p>
            <ExportButton rows={d?.data || []} filename="الدفعات-المفقودة"
                columns={[{ key: 'no', label: 'الفاتورة' }, { key: 'date', label: 'التاريخ' }, { key: 'supplier', label: 'المورد' },
                          { key: 'project', label: 'المشروع' }, { key: 'paid', label: 'المسدَّد' }, { key: 'gap', label: 'الفجوة' },
                          { key: 'receipts_total', label: 'مجموع الإيصالات' }, { key: 'confidence', label: 'الحالة' }]} />
            <Panel title="القائمة">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-[11px] text-slate-500 border-b border-slate-200">
                            <th className="text-right py-2">الفاتورة</th><th className="text-right">التاريخ</th>
                            <th className="text-right">المورد</th><th className="text-right">المشروع</th>
                            <th className="text-left">المسدَّد</th><th className="text-left">سطور الدفعات</th>
                            <th className="text-left">الفجوة</th><th className="text-right">الإيصالات</th>
                            <th className="text-right">الحالة</th><th></th>
                        </tr></thead>
                        <tbody>
                            {(d?.data || []).map(r => {
                                const [lbl, cls] = STATE[r.confidence] || STATE.candidate;
                                return (
                                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="py-2 font-black text-brand-900">{r.no}</td>
                                        <td className="text-slate-500">{r.date}</td>
                                        <td className="truncate max-w-[200px]">{r.supplier}</td>
                                        <td className="text-slate-500">{r.project || '—'}</td>
                                        <td className="text-left tabular-nums">{money(r.paid)}</td>
                                        <td className="text-left tabular-nums text-slate-400">{money(Number(r.mirror_pay) + Number(r.local_pay))}</td>
                                        <td className="text-left tabular-nums font-black text-amber-600">{money(r.gap)}</td>
                                        <td className="text-slate-500">{Number(r.receipts_n) ? `${r.receipts_n} · ${money(r.receipts_total)}` : '—'}</td>
                                        <td><span className={'px-1.5 py-0.5 rounded text-[10px] font-black ' + cls}>{lbl}</span></td>
                                        <td>
                                            <button onClick={() => fill(r)} disabled={busy === r.id || !armed}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-40">
                                                {busy === r.id ? '…' : 'سجّل'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!(d?.data || []).length && <tr><td colSpan={10} className="py-8 text-center text-slate-400 text-xs">لا فجوات — كل دفعة لها سطر</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}

// ─── مطابقة الإيصالات بالدفعات ──────────────────────────────────────────────
function MatchPanel({ armed }) {
    const [src, setSrc] = useState('sheet');
    const [plan, setPlan] = useState(null);
    const [busy, setBusy] = useState('');

    const run = async (apply) => {
        setBusy(apply ? 'apply' : 'plan');
        const act = src === 'sheet' ? 'pay_receipt_from_sheet' : 'pay_receipt_from_files';
        try {
            const r = await get(act, apply ? '&apply=1' : '');
            if (!r.success) { alert(r.message || 'تعذّر الربط'); return; }
            if (apply) { alert(`رُبط ${r.linked ?? r.would_link ?? 0} إيصالاً`); setPlan(null); }
            else setPlan(r);
        } catch { alert('تعذّر الاتصال'); }
        finally { setBusy(''); }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                    يقرأ الإيصالات المرفوعة ويطابقها بدفعاتها بالمبلغ والتاريخ. التشغيل على مرحلتين:
                    معاينة أولاً ثم تنفيذ — لا ينفّذ شيئاً قبل أن تراه.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    {[['sheet', 'من جدول التدفقات'], ['files', 'من الملفات المقروءة']].map(([k, t]) => (
                        <button key={k} onClick={() => { setSrc(k); setPlan(null); }}
                            className={'px-3 py-2 rounded-xl text-xs font-bold border ' +
                                (src === k ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'bg-white border-slate-200 text-slate-600')}>{t}</button>
                    ))}
                    <button onClick={() => run(false)} disabled={!!busy}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {busy === 'plan' ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} معاينة
                    </button>
                </div>
            </div>
            {plan && (
                <Panel title={`المعاينة — ${plan.would_link || 0} إيصالاً يطابق دفعةً واحدة`}>
                    <div className="text-xs text-slate-500 mb-2">
                        من {plan.files} ملفاً · دفعات بلا إثبات {plan.payments_open}
                        {plan.ambiguous > 0 && ` · ملتبس ${plan.ambiguous}`}
                        {plan.no_match > 0 && ` · بلا دفعة ${plan.no_match}`}
                    </div>
                    <div className="max-h-[320px] overflow-y-auto space-y-1">
                        {(plan.rows || []).map((x, i) => (
                            <div key={i} className="flex gap-2 text-xs border-b border-slate-50 py-1.5">
                                <span className="truncate flex-1">{x.file}</span>
                                <span className="tabular-nums text-emerald-700">{money(x.amount)}</span>
                                <span className="text-slate-400 truncate max-w-[160px]">{x.supplier}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => run(true)} disabled={!!busy || !plan.would_link || !armed}
                        className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40">
                        {busy === 'apply' ? '…' : `نفّذ الربط (${plan.would_link || 0})`}
                    </button>
                </Panel>
            )}
        </div>
    );
}

// ─── فحوص النظام ────────────────────────────────────────────────────────────
function HealthPanel() {
    const [smtp, setSmtp] = useState(null);
    const [ck, setCk] = useState(null);
    useEffect(() => {
        get('smtp_status').then(setSmtp).catch(() => {});
        get('daftra_cookie_status').then(setCk).catch(() => {});
    }, []);
    return (
        <div className="grid md:grid-cols-2 gap-4">
            <Panel title="خادم البريد">
                {smtp ? (
                    <div className="space-y-1.5 text-sm">
                        <Row ok={smtp.configured} t={smtp.configured ? 'مُهيّأ ويعمل' : 'غير مُهيّأ'} />
                        <div className="text-xs text-slate-500">المُرسِل: {smtp.from || '—'}</div>
                        <div className="text-xs text-slate-500">الخادم: {smtp.host || '—'}:{smtp.port || '—'} ({smtp.secure || '—'})</div>
                        {(smtp.missing || []).length > 0 && (
                            <div className="text-xs text-rose-600">ناقص: {(smtp.missing || []).join('، ')}</div>
                        )}
                    </div>
                ) : <Loading />}
            </Panel>
            <Panel title="جلسة دفترة">
                {ck ? (
                    <div className="space-y-1.5 text-sm">
                        <Row ok={!!ck.has_session} t={ck.has_session ? 'الجلسة مُخزَّنة' : 'لا جلسة'} />
                        <div className="text-xs text-slate-500">آخر تحديث: {ck.updated_at || '—'}</div>
                        <div className="text-xs text-slate-500">الكوكيز: {(ck.cookies || []).join('، ') || '—'}</div>
                    </div>
                ) : <Loading />}
            </Panel>
        </div>
    );
}

function Row({ ok, t }) {
    return (
        <div className={'flex items-center gap-2 font-bold ' + (ok ? 'text-emerald-600' : 'text-rose-600')}>
            {ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {t}
        </div>
    );
}
function Loading() { return <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>; }
function Kpi({ t, v, sub, warn }) {
    return (
        <div className={'rounded-2xl border p-3 ' + (warn ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200')}>
            <div className="text-[11px] font-bold text-slate-400">{t}</div>
            <div className={'text-lg font-black tabular-nums ' + (warn ? 'text-amber-700' : 'text-brand-900')} dir="ltr">{v}</div>
            {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
        </div>
    );
}
function Panel({ title, children }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-sm text-brand-900 mb-2">{title}</h3>
            {children}
        </div>
    );
}
