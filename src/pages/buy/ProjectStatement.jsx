import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Loader2, RefreshCw } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

// نوع السطر: لون وتسمية — الفاتورة تحميل، والمرتجع خصم، والدفعة نقد خارج
const KIND = {
    invoice: { t: 'فاتورة',       c: 'bg-white/10 text-slate-200' },
    refund:  { t: 'مرتجع',        c: 'bg-sky-500/15 text-sky-200' },
    extra:   { t: 'تكلفة إضافية', c: 'bg-violet-500/15 text-violet-200' },
    payment: { t: 'دفعة',         c: 'bg-emerald-500/15 text-emerald-200' },
};

// ─── كشف حساب المشروع: الفواتير والمرتجعات والتكاليف والدفعات زمنياً برصيد متحرك ───
export default function ProjectStatement() {
    const [projects, setProjects] = useState([]);
    const [pid, setPid]   = useState(0);
    const [from, setFrom] = useState('');
    const [to, setTo]     = useState('');
    const [d, setD]       = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr]   = useState('');
    const [kinds, setKinds] = useState([]);           // فارغ = كل الأنواع

    useEffect(() => {
        fetch(`${API_URL}?action=projects_list`, { headers: auth() }).then(r => r.json())
            .then(r => {
                if (!r.success) return;
                const list = r.data || [];
                setProjects(list);
                if (list.length && !pid) setPid(Number(list[0].project_id));
            }).catch(() => {});
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    const load = useCallback(async () => {
        if (!pid) return;
        setBusy(true); setErr('');
        try {
            const q = new URLSearchParams({ action: 'project_statement', project_id: String(pid) });
            if (from) q.set('from', from);
            if (to)   q.set('to', to);
            const r = await fetch(`${API_URL}?${q}`, { headers: auth() }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذر الكشف'); setD(null); }
            else setD(r);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    }, [pid, from, to]);

    useEffect(() => { load(); }, [load]);

    const s = d?.summary;
    const lines = (d?.lines || []).filter(l => !kinds.length || kinds.includes(l.type));
    const basis = s?.basis === 'gross' ? 'شامل الضريبة' : 'صافي بلا ضريبة';

    return (
        <div className="space-y-3">
            {/* المشروع — قائمة منسدلة */}
            <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-400">المشروع</span>
                <select value={pid || 0} onChange={e => setPid(Number(e.target.value) || 0)}
                    className="w-full min-h-[48px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] font-bold outline-none focus:border-[#c5a059]">
                    <option value="0">— اختر مشروعاً —</option>
                    {projects.map(p => (
                        <option key={p.project_id} value={p.project_id}>{p.name}</option>
                    ))}
                </select>
            </label>

            {/* المدة */}
            <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="flex-1 min-w-0 h-[44px] px-2 rounded-xl bg-white/[0.06] border border-white/10 text-[12px] outline-none" />
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="flex-1 min-w-0 h-[44px] px-2 rounded-xl bg-white/[0.06] border border-white/10 text-[12px] outline-none" />
                <button onClick={load} disabled={busy}
                    className="w-[44px] h-[44px] rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => window.print()}
                    className="w-[44px] h-[44px] rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Printer size={16} />
                </button>
            </div>

            {err && <div className="rounded-xl bg-rose-500/10 text-rose-200 p-3 text-[12px]">{err}</div>}
            {busy && !d && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-500" /></div>}

            {s && (
                <>
                    {/* الخلاصة */}
                    <div className="grid grid-cols-2 gap-2">
                        <Card t="فواتير المشروع" v={money(s.invoiced)} sub={`${s.invoices} فاتورة · ${basis}`} />
                        <Card t="المرتجعات" v={'−' + money(s.refunded)} sub={`${s.refunds} مرتجع`} tone="sky" />
                        <Card t="تكاليف إضافية" v={money(s.extra)} tone="violet" />
                        <Card t="صافي التكلفة" v={money(s.net_cost)} tone="gold" />
                        {s.supervision > 0 && <Card t="إشراف سماك" v={money(s.supervision)} tone="violet" />}
                        <Card t="المسدد للموردين" v={money(s.paid)} tone="emerald" />
                        <Card t="المتبقي للموردين" v={money(s.outstanding)} sub="من إجمالي الفواتير شامل الضريبة"
                              tone={Number(s.outstanding) > 0.5 ? 'amber' : 'emerald'} />
                        {Number(s.budget) > 0 && (
                            <Card t="المتبقي من الميزانية" v={money(s.remaining)}
                                  sub={`الميزانية ${money(s.budget)}`}
                                  tone={Number(s.remaining) < 0 ? 'rose' : 'emerald'} />
                        )}
                    </div>

                    {/* تصفية الأنواع */}
                    <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(KIND).map(([k, v]) => {
                            const on = kinds.includes(k);
                            return (
                                <button key={k} onClick={() => setKinds(x => on ? x.filter(y => y !== k) : x.concat(k))}
                                    className={'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border '
                                        + (on ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]'
                                              : 'bg-white/5 border-white/10 text-slate-300')}>
                                    {v.t} ({(d.lines || []).filter(l => l.type === k).length})
                                </button>
                            );
                        })}
                        {kinds.length > 0 && (
                            <button onClick={() => setKinds([])}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400">الكل</button>
                        )}
                    </div>

                    {/* الحركة */}
                    <div className="space-y-2">
                        {lines.map((l, i) => {
                            const k = KIND[l.type] || KIND.invoice;
                            return (
                                <div key={l.type + l.id + i}
                                    className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={'px-1.5 py-0.5 rounded-md text-[10px] font-black ' + k.c}>{k.t}</span>
                                        <span className="text-[13px] font-bold truncate">{l.party || '—'}</span>
                                        <span className={'text-[14px] font-black tabular-nums mr-auto shrink-0 '
                                            + (l.credit > 0 ? 'text-sky-300' : l.cash > 0 ? 'text-emerald-300' : 'text-slate-200')}>
                                            {l.credit > 0 ? '−' + money(l.credit) : l.cash > 0 ? money(l.cash) : money(l.debit)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                        <span>{l.date || '—'}</span>
                                        {l.no && <span>#{l.no}</span>}
                                        {l.ref && <span>من فاتورة {l.ref}</span>}
                                        {l.vat > 0 && <span>ضريبة {money(l.vat)}</span>}
                                        <span className="mr-auto tabular-nums">
                                            {l.type === 'payment' ? `مسدد تراكمي ${money(l.cash_cum)}` : `الرصيد ${money(l.balance)}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {!busy && !lines.length && (
                            <p className="text-center text-[12px] text-slate-500 py-8">
                                لا حركة في هذه المدة — تأكد من تسكين الفواتير والمرتجعات على المشروع
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function Card({ t, v, sub, tone }) {
    const tones = {
        gold: 'bg-[#c5a059]/12 text-[#e6c88a]', emerald: 'bg-emerald-500/10 text-emerald-200',
        amber: 'bg-amber-500/10 text-amber-200', rose: 'bg-rose-500/10 text-rose-200',
        sky: 'bg-sky-500/10 text-sky-200', violet: 'bg-violet-500/10 text-violet-200',
    };
    return (
        <div className={'rounded-xl p-2.5 ' + (tones[tone] || 'bg-white/[0.05] text-slate-200')}>
            <div className="text-[10px] opacity-70 font-bold">{t}</div>
            <div className="text-[15px] font-black tabular-nums mt-0.5">{v}</div>
            {sub && <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>}
        </div>
    );
}
