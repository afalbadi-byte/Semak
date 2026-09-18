import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, RefreshCw, Loader2, FolderKanban, Building2, CalendarRange } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { openPrintReport } from '../../lib/printReport';
import { entityPath } from '../../lib/entity';
import StatementExport from '../../components/StatementExport';
import { supplierDoc, projectDoc } from '../../lib/statementDocs';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const KIND = {
    invoice: { t: 'فاتورة',       c: 'bg-slate-100 text-slate-700' },
    refund:  { t: 'مرتجع',        c: 'bg-sky-100 text-sky-700' },
    extra:   { t: 'تكلفة إضافية', c: 'bg-violet-100 text-violet-700' },
    payment: { t: 'دفعة',         c: 'bg-emerald-100 text-emerald-700' },
};
const monthName = d => (d || '').slice(0, 7);

// ─── كشوف حسابات المشاريع (نسخة سطح المكتب — أغنى: تجميع شهري وتفصيل بالمورد) ──
export default function ProjectStatements() {
    const nav = useNavigate();
    const [projects, setProjects] = useState([]);
    const [pid, setPid]   = useState(0);
    const [from, setFrom] = useState('');
    const [to, setTo]     = useState('');
    const [d, setD]       = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr]   = useState('');
    const [kinds, setKinds] = useState([]);
    const [supFilter, setSupFilter] = useState('');

    useEffect(() => {
        fetch(`${API_URL}?action=projects_list`, { headers: auth() }).then(r => r.json())
            .then(r => {
                if (!r.success) return;
                const list = r.data || [];
                setProjects(list);
                setPid(p => p || Number(list[0]?.project_id || 0));
            }).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        if (!pid) return;
        setBusy(true); setErr('');
        try {
            const q = new URLSearchParams({ action: 'project_statement', project_id: String(pid) });
            if (from) q.set('from', from);
            if (to)   q.set('to', to);
            const r = await fetch(`${API_URL}?${q}`, { headers: auth() }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذر الكشف'); setD(null); } else setD(r);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    }, [pid, from, to]);
    useEffect(() => { load(); }, [load]);

    const s = d?.summary;
    const all = d?.lines || [];
    const lines = all.filter(l => (!kinds.length || kinds.includes(l.type))
        && (!supFilter || (l.party || '') === supFilter));

    // تجميع شهري — لا يوجد في نسخة الجوال
    const months = useMemo(() => {
        const m = {};
        all.forEach(l => {
            const k = monthName(l.date) || '—';
            m[k] = m[k] || { k, debit: 0, credit: 0, cash: 0, n: 0 };
            m[k].debit += Number(l.debit || 0);
            m[k].credit += Number(l.credit || 0);
            m[k].cash += Number(l.cash || 0);
            m[k].n += 1;
        });
        return Object.values(m).sort((a, b) => a.k.localeCompare(b.k));
    }, [all]);

    // تفصيل بالمورد — لا يوجد في نسخة الجوال
    const suppliers = useMemo(() => {
        const m = {};
        all.forEach(l => {
            const k = l.party || '—';
            m[k] = m[k] || { k, invoices: 0, debit: 0, credit: 0, cash: 0 };
            if (l.type === 'invoice') m[k].invoices += 1;
            m[k].debit += Number(l.debit || 0);
            m[k].credit += Number(l.credit || 0);
            m[k].cash += Number(l.cash || 0);
        });
        return Object.values(m).sort((a, b) => b.debit - a.debit);
    }, [all]);

    const preset = (kind) => {
        const t = new Date(); const y = t.getFullYear(); const mo = t.getMonth();
        const f = n => n.toISOString().slice(0, 10);
        if (kind === 'month') { setFrom(f(new Date(y, mo, 1))); setTo(f(new Date(y, mo + 1, 0))); }
        if (kind === 'quarter') { const q = Math.floor(mo / 3) * 3; setFrom(f(new Date(y, q, 1))); setTo(f(new Date(y, q + 3, 0))); }
        if (kind === 'year') { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
        if (kind === 'all') { setFrom(''); setTo(''); }
    };

    const openLine = (l) => {
        if (l.purchase_id) nav(entityPath('purchase', l.purchase_id));
        else if (l.party) nav(entityPath('supplier', l.party));
    };

    return (
        <div className="space-y-4">
            {/* أدوات */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><FolderKanban size={12} /> المشروع</span>
                    <select value={pid || 0} onChange={e => setPid(Number(e.target.value) || 0)}
                        className="h-11 min-w-[200px] px-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-brand-500">
                        <option value="0">— اختر مشروعاً —</option>
                        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><CalendarRange size={12} /> من</span>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="h-11 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500" />
                </label>
                <label className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">إلى</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="h-11 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500" />
                </label>
                <div className="flex gap-1.5">
                    {[['month', 'هذا الشهر'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة'], ['all', 'الكل']].map(([k, t]) => (
                        <button key={k} onClick={() => preset(k)}
                            className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold">{t}</button>
                    ))}
                </div>
                <div className="mr-auto flex gap-2">
                    <button onClick={load} disabled={busy}
                        className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold flex items-center gap-2">
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> تحديث
                    </button>
                    <StatementExport disabled={!pid || !d} className="[&>button]:h-11"
                        build={() => projectDoc((projects.find(p => String(p.project_id) === String(pid)) || {}).name || '', d, lines, from, to)}
                        pdf={() => openPrintReport('project_statement', { project_id: pid, from, to })} />
                </div>
            </div>

            {err && <div className="bg-rose-50 text-rose-700 rounded-xl p-3 text-sm font-bold">{err}</div>}
            {busy && !d && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>}

            {s && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                        <Kpi t="فواتير المشروع" v={money(s.invoiced)} sub={`${s.invoices} فاتورة`} onClick={() => setKinds(['invoice'])} />
                        <Kpi t="المرتجعات" v={'−' + money(s.refunded)} sub={`${s.refunds} مرتجع`} tone="sky" onClick={() => setKinds(['refund'])} />
                        <Kpi t="تكاليف إضافية" v={money(s.extra)} tone="violet" onClick={() => setKinds(['extra'])} />
                        <Kpi t="صافي التكلفة" v={money(s.net_cost)} tone="gold" onClick={() => setKinds([])} />
                        {s.supervision > 0 && <Kpi t="إشراف سماك" v={money(s.supervision)} tone="violet" />}
                        <Kpi t="المسدد للموردين" v={money(s.paid)} tone="emerald" onClick={() => setKinds(['payment'])} />
                        <Kpi t="المتبقي للموردين" v={money(s.outstanding)} tone={Number(s.outstanding) > 0.5 ? 'amber' : 'emerald'} />
                        {Number(s.budget) > 0 && (
                            <Kpi t="المتبقي من الميزانية" v={money(s.remaining)} sub={`الميزانية ${money(s.budget)}`}
                                 tone={Number(s.remaining) < 0 ? 'rose' : 'emerald'} />
                        )}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                        {/* شهرياً */}
                        <Panel title="الحركة شهرياً">
                            <table className="w-full text-sm">
                                <thead><tr className="text-[11px] text-slate-500">
                                    <th className="text-right py-2">الشهر</th><th className="text-left">تكلفة</th>
                                    <th className="text-left">مرتجعات</th><th className="text-left">مدفوع</th><th className="text-left">حركات</th>
                                </tr></thead>
                                <tbody>
                                    {months.map(m => (
                                        <tr key={m.k} className="border-t border-slate-100">
                                            <td className="py-2 font-bold text-brand-900">{m.k}</td>
                                            <td className="text-left tabular-nums">{money(m.debit)}</td>
                                            <td className="text-left tabular-nums text-sky-600">{m.credit ? '−' + money(m.credit) : '—'}</td>
                                            <td className="text-left tabular-nums text-emerald-600">{m.cash ? money(m.cash) : '—'}</td>
                                            <td className="text-left text-slate-400">{m.n}</td>
                                        </tr>
                                    ))}
                                    {!months.length && <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs">لا حركة</td></tr>}
                                </tbody>
                            </table>
                        </Panel>

                        {/* بالمورد */}
                        <Panel title="التفصيل بالمورد" note={supFilter ? 'مُفلتر: ' + supFilter : null}
                               onClear={supFilter ? () => setSupFilter('') : null}>
                            <table className="w-full text-sm">
                                <thead><tr className="text-[11px] text-slate-500">
                                    <th className="text-right py-2">المورد</th><th className="text-left">فواتير</th>
                                    <th className="text-left">تكلفة</th><th className="text-left">مرتجعات</th><th className="text-left">مدفوع</th>
                                </tr></thead>
                                <tbody>
                                    {suppliers.map(x => (
                                        <tr key={x.k} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                                            onClick={() => setSupFilter(f => f === x.k ? '' : x.k)}>
                                            <td className="py-2 font-bold text-brand-900">
                                                <button onClick={e => { e.stopPropagation(); nav(entityPath('supplier', x.k)); }}
                                                    className="underline decoration-dotted underline-offset-4 flex items-center gap-1">
                                                    <Building2 size={12} className="text-slate-400" />{x.k}
                                                </button>
                                            </td>
                                            <td className="text-left">{x.invoices}</td>
                                            <td className="text-left tabular-nums">{money(x.debit)}</td>
                                            <td className="text-left tabular-nums text-sky-600">{x.credit ? '−' + money(x.credit) : '—'}</td>
                                            <td className="text-left tabular-nums text-emerald-600">{x.cash ? money(x.cash) : '—'}</td>
                                        </tr>
                                    ))}
                                    {!suppliers.length && <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs">لا موردين</td></tr>}
                                </tbody>
                            </table>
                        </Panel>
                    </div>

                    {/* الحركة التفصيلية */}
                    <Panel title="كشف الحركة" note={kinds.length ? 'مُفلتر: ' + kinds.map(k => KIND[k].t).join('، ') : null}
                           onClear={kinds.length ? () => setKinds([]) : null}>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                            {Object.entries(KIND).map(([k, v]) => (
                                <button key={k} onClick={() => setKinds(x => x.includes(k) ? x.filter(y => y !== k) : x.concat(k))}
                                    className={'px-3 py-1.5 rounded-lg text-xs font-bold border ' +
                                        (kinds.includes(k) ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-slate-600 border-slate-200')}>
                                    {v.t} ({all.filter(l => l.type === k).length})
                                </button>
                            ))}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-[11px] text-slate-500 border-b border-slate-200">
                                    <th className="text-right py-2">التاريخ</th><th className="text-right">النوع</th>
                                    <th className="text-right">المستند</th><th className="text-right">الطرف</th>
                                    <th className="text-left">مدين</th><th className="text-left">دائن</th>
                                    <th className="text-left">مدفوع</th><th className="text-left">الرصيد</th>
                                </tr></thead>
                                <tbody>
                                    {lines.map((l, i) => (
                                        <tr key={l.type + l.id + i} onClick={() => openLine(l)}
                                            className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                                            <td className="py-2 text-slate-500">{l.date || '—'}</td>
                                            <td><span className={'px-1.5 py-0.5 rounded text-[10px] font-black ' + KIND[l.type].c}>{KIND[l.type].t}</span></td>
                                            <td className="font-bold text-brand-900">{l.no || '—'}</td>
                                            <td className="truncate max-w-[220px]">{l.party}</td>
                                            <td className="text-left tabular-nums">{l.debit ? money(l.debit) : ''}</td>
                                            <td className="text-left tabular-nums text-sky-600">{l.credit ? money(l.credit) : ''}</td>
                                            <td className="text-left tabular-nums text-emerald-600">{l.cash ? money(l.cash) : ''}</td>
                                            <td className="text-left tabular-nums font-bold">{money(l.balance)}</td>
                                        </tr>
                                    ))}
                                    {!lines.length && <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">لا حركة بهذه الفلاتر</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </>
            )}
        </div>
    );
}

function Kpi({ t, v, sub, tone, onClick }) {
    const tones = {
        gold: 'bg-amber-50 text-amber-800 border-amber-200', emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        amber: 'bg-amber-50 text-amber-800 border-amber-200', rose: 'bg-rose-50 text-rose-800 border-rose-200',
        sky: 'bg-sky-50 text-sky-800 border-sky-200', violet: 'bg-violet-50 text-violet-800 border-violet-200',
    };
    return (
        <button type="button" onClick={onClick} disabled={!onClick}
            className={'text-right rounded-2xl border p-3 transition ' + (onClick ? 'hover:shadow-md ' : '')
                + (tones[tone] || 'bg-white text-brand-900 border-slate-200')}>
            <div className="text-[11px] font-bold opacity-70">{t}</div>
            <div className="text-lg font-black tabular-nums mt-0.5" dir="ltr">{v}</div>
            {sub && <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>}
        </button>
    );
}

function Panel({ title, note, onClear, children }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="font-black text-sm text-brand-900">{title}</h3>
                {note && <span className="text-[11px] text-slate-400">{note}</span>}
                {onClear && <button onClick={onClear} className="mr-auto text-[11px] font-bold text-slate-400 hover:text-slate-600">إزالة الفلتر</button>}
            </div>
            {children}
        </div>
    );
}
