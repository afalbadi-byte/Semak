import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../lib/api/client';
import EntityLink from '../../components/EntityLink';
import SortHeader from '../../components/SortHeader';
import { useSort, smartFirstDir } from '../../lib/sortable';

const REPORTS = [
    { key: 'vat_return',            name: 'الإقرار الضريبي',              group: 'الضرائب' },
    { key: 'tax_detail',            name: 'تقرير الضرائب — تفصيل البنود', group: 'الضرائب' },
    { key: 'vat_input',             name: 'ضريبة المشتريات شهرياً',       group: 'الضرائب' },
    { key: 'purchases_by_supplier', name: 'المشتريات حسب المورد',         group: 'المشتريات' },
    { key: 'purchases_by_class',    name: 'المشتريات حسب البند',          group: 'المشتريات' },
    { key: 'purchases_by_project',  name: 'المشتريات حسب المشروع',        group: 'المشتريات' },
    { key: 'items_by_product',      name: 'المشتريات حسب الصنف',          group: 'المشتريات' },
    { key: 'supplier_aging',        name: 'أعمار الذمم الدائنة',          group: 'المالية' },
    { key: 'payments_by_period',    name: 'الدفعات حسب الفترة',           group: 'المالية' },
    { key: 'docs_coverage',         name: 'تغطية المستندات',              group: 'الرقابة' },
    { key: 'sales_units',           name: 'الوحدات والمبيعات',            group: 'المبيعات' },
    { key: 'leads_monthly',         name: 'المهتمون شهرياً',              group: 'المبيعات' },
    { key: 'project_budgets',       name: 'ميزانيات المشاريع والإنجاز',   group: 'المشاريع' },
    { key: 'extra_costs',           name: 'تكاليف خارج فواتير المشتريات', group: 'المشاريع' },
];

const money = v => {
    const n = Number(v);
    if (!isFinite(n)) return v;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const isNum = v => v !== '' && v !== null && !isNaN(Number(v));

// أي عمود دلالي في أي تقرير يصير رابطاً لبطاقة كيانه
const entityOf = (colKey, row) => {
    if (colKey === 'supplier' && row.supplier) return { type: 'supplier', value: row.supplier };
    if (colKey === 'unit_code' && row.unit_code) return { type: 'unit', value: row.unit_code };
    if (colKey === 'no' && row.id) return { type: 'purchase', value: row.id };
    if ((colKey === 'item' || colKey === 'name') && row.product_id) return { type: 'product', value: row.product_id };
    if (colKey === 'project' && row.project_id) return { type: 'project', value: row.project_id };
    return null;
};

export default function TaxReports() {
    const today = new Date().toISOString().slice(0, 10);
    const [type, setType]   = useState('vat_return');
    const [from, setFrom]   = useState(today.slice(0, 4) + '-01-01');
    const [to, setTo]       = useState(today);
    const [g, setG]         = useState('month');
    const [data, setData]   = useState(null);

    // ترتيب صفوف أي تقرير بالضغط على رأس عموده
    const { sorted: sortedRows, key: sortKey, dir: sortDir, toggle } = useSort(data ? data.rows : []);
    const onSort = k => toggle(k, smartFirstDir(data ? data.rows : [], k));
    const [busy, setBusy]   = useState(false);
    const [err, setErr]     = useState('');

    const load = useCallback(async () => {
        setBusy(true); setErr('');
        try {
            const u = `${API_URL}?action=rpt&type=${type}&from=${from}&to=${to}&g=${g}`;
            const j = await fetch(u).then(r => r.json());
            if (j.success) setData(j); else { setData(null); setErr(j.message || 'تعذر التحميل'); }
        } catch (e) { setErr('تعذر الاتصال'); }
        setBusy(false);
    }, [type, from, to, g]);

    useEffect(() => { load(); }, [load]);

    const exportCsv = () => {
        if (!data) return;
        const head = data.columns.map(c => c.t).join(',');
        const body = data.rows.map(r => data.columns.map(c => {
            const v = r[c.k] == null ? '' : String(r[c.k]);
            return v.includes(',') ? '"' + v + '"' : v;
        }).join(',')).join('\n');
        const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${data.title}-${from}-${to}.csv`;
        a.click();
    };

    const groups = [...new Set(REPORTS.map(r => r.group))];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
                <div>
                    <h2 className="text-2xl font-black text-brand-900 flex items-center gap-2">
                        <BarChart3 size={24} className="text-gold-500" /> مركز التقارير
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">تقارير تُبنى من بياناتنا مباشرة — لا تعتمد على أي نظام خارجي</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={busy}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold disabled:opacity-50">
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> تحديث
                    </button>
                    <button onClick={exportCsv} disabled={!data}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40">
                        <Download size={15} /> تصدير
                    </button>
                    <button onClick={() => window.print()} disabled={!data}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold disabled:opacity-40">
                        <Printer size={15} /> طباعة
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 no-print">
                <div className="flex flex-wrap gap-2">
                    {groups.map(gr => (
                        <div key={gr} className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[11px] font-black text-slate-400 px-1">{gr}</span>
                            {REPORTS.filter(r => r.group === gr).map(r => (
                                <button key={r.key} onClick={() => setType(r.key)}
                                    className={'px-3 py-1.5 rounded-lg text-xs font-bold ' + (type === r.key ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                                    {r.name}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-500">من</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
                    <label className="text-xs font-bold text-slate-500">إلى</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
                    {type === 'payments_by_period' && (
                        <select value={g} onChange={e => setG(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm">
                            <option value="day">يومي</option>
                            <option value="week">أسبوعي</option>
                            <option value="month">شهري</option>
                            <option value="year">سنوي</option>
                        </select>
                    )}
                    <div className="flex gap-1 mr-auto">
                        {[['هذا الشهر', () => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10)); setTo(today); }],
                          ['هذا العام', () => { setFrom(today.slice(0,4) + '-01-01'); setTo(today); }],
                          ['العام الماضي', () => { const y = +today.slice(0,4) - 1; setFrom(y + '-01-01'); setTo(y + '-12-31'); }]].map(([lbl, fn]) => (
                            <button key={lbl} onClick={fn} className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200">{lbl}</button>
                        ))}
                    </div>
                </div>
            </div>

            {err && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertTriangle size={16} /> {err}</div>}

            {data && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden print-area">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="font-black text-brand-900 text-lg">{data.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            من {data.from} إلى {data.to} · {data.count} سطر
                        </p>
                    </div>

                    {data.extra && data.extra.net_due != null && (
                        <div className="mx-4 mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-amber-800">صافي الضريبة للفترة</div>
                                {data.extra.note && <div className="text-[11px] text-amber-700 mt-0.5">{data.extra.note}</div>}
                            </div>
                            <div className="text-2xl font-black text-amber-900">{money(data.extra.net_due)}</div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    {data.columns.map(c => (
                                        <SortHeader key={c.k} label={c.t} k={c.k} sortKey={sortKey} dir={sortDir}
                                            onSort={onSort} className="p-3 text-right font-black text-xs" />
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((r, i) => (
                                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                                        {data.columns.map(c => (
                                            <td key={c.k} className={'p-3 whitespace-nowrap ' + (isNum(r[c.k]) ? 'text-left font-bold tabular-nums' : '')}>
                                                {(() => {
                                                    const e = entityOf(c.k, r);
                                                    const txt = isNum(r[c.k]) ? money(r[c.k]) : (r[c.k] || '—');
                                                    return e ? <EntityLink type={e.type} value={e.value} className="text-brand-700 font-bold">{txt}</EntityLink> : txt;
                                                })()}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {!data.rows.length && (
                                    <tr><td colSpan={data.columns.length} className="p-8 text-center text-slate-400">لا توجد بيانات في هذه الفترة</td></tr>
                                )}
                            </tbody>
                            {!!data.rows.length && Object.keys(data.totals || {}).length > 0 && (
                                <tfoot className="bg-brand-50 font-black">
                                    <tr>
                                        {data.columns.map((c, i) => (
                                            <td key={c.k} className="p-3 text-left tabular-nums">
                                                {i === 0 ? 'الإجمالي' : (data.totals[c.k] != null ? money(data.totals[c.k]) : '')}
                                            </td>
                                        ))}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
