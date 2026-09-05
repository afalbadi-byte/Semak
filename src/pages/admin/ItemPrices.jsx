import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw, Printer, Package } from 'lucide-react';
import { API_URL } from '../../lib/api/client';
import EntityLink from '../../components/EntityLink';
import SortHeader from '../../components/SortHeader';
import { useSort, smartFirstDir } from '../../lib/sortable';

const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v)))
    ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SORTS = [
    { k: 'orders', t: 'الأكثر طلباً' },
    { k: 'amount', t: 'الأعلى قيمة' },
    { k: 'change', t: 'الأكثر ارتفاعاً' },
    { k: 'name',   t: 'أبجدياً' },
];

// خط بياني مصغّر لآخر اثنتي عشرة حركة سعر
function Spark({ points }) {
    const p = (points || []).map(Number).filter(n => isFinite(n));
    if (p.length < 2) return <span className="text-slate-300 text-[10px]">—</span>;
    const min = Math.min(...p), max = Math.max(...p), span = (max - min) || 1;
    const w = 64, h = 18;
    const d = p.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (p.length - 1)) * w} ${h - ((v - min) / span) * h}`).join(' ');
    const up = p[p.length - 1] >= p[0];
    return (
        <svg width={w} height={h} className="inline-block align-middle">
            <path d={d} fill="none" strokeWidth="1.6" className={up ? 'stroke-red-500' : 'stroke-emerald-500'} />
        </svg>
    );
}

function Change({ pct }) {
    if (pct === null || pct === undefined) return <span className="text-slate-300">—</span>;
    const up = pct > 0, flat = pct === 0;
    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
    return (
        <span className={'inline-flex items-center gap-1 font-black ' + (flat ? 'text-slate-400' : up ? 'text-red-600' : 'text-emerald-600')}>
            <Icon size={13} />{Math.abs(pct)}%
        </span>
    );
}

// ─── متابعة أسعار المشتريات: كل صنف وسعره الآن مقابل ما قبله ────────────────
export default function ItemPrices() {
    const [rows, setRows]   = useState([]);
    const [sort, setSort]   = useState('orders');
    const [q, setQ]         = useState('');
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setBusy(true); setError('');
        try {
            const r = await fetch(`${API_URL}?action=item_prices&sort=${sort}&q=${encodeURIComponent(q)}`)
                .then(x => x.json());
            if (!r.success) throw new Error(r.message || 'تعذر جلب الأسعار');
            setRows(r.data || []);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    }, [sort, q]);

    useEffect(() => { load(); }, [sort]);   // eslint-disable-line react-hooks/exhaustive-deps

    const { sorted: view, key: sortKey, dir: sortDir, toggle } = useSort(rows);
    const onSort = k => toggle(k, smartFirstDir(rows, k));

    const rising = rows.filter(r => (r.change_pct || 0) > 0).length;
    const falling = rows.filter(r => (r.change_pct || 0) < 0).length;

    return (
        <div className="p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
                <div>
                    <h2 className="text-2xl font-black text-brand-900 dark:text-brand-50 flex items-center gap-2">
                        <Package size={24} className="text-gold-500" /> متابعة أسعار المشتريات
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {rows.length} صنف · {rising} ارتفع · {falling} انخفض — الأكثر طلباً في الأعلى
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input value={q} onChange={e => setQ(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && load()}
                            placeholder="ابحث عن صنف..."
                            className="pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 dark:bg-brand-900 text-sm w-52" />
                    </div>
                    <button onClick={load} className="px-3 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold">
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold">
                        <Printer size={15} />
                    </button>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap no-print">
                {SORTS.map(s => (
                    <button key={s.k} onClick={() => setSort(s.k)}
                        className={'px-3 py-1.5 rounded-xl text-xs font-bold ' +
                            (sort === s.k ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600')}>
                        {s.t}
                    </button>
                ))}
            </div>

            {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3">{error}</div>}

            <div className="rounded-2xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-900 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-brand-800">
                            <tr className="text-xs text-slate-500 dark:text-brand-300 text-right">
                                {[['name','الصنف'],['orders','الطلبات'],['last_price','آخر سعر'],['prev_price','السابق'],
                                  ['change_pct','التغير']].map(([k, t]) => (
                                    <SortHeader key={k} label={t} k={k} sortKey={sortKey} dir={sortDir} onSort={onSort}
                                        className="py-2.5 px-3 font-bold" />
                                ))}
                                <th className="py-2.5 px-3 font-bold">المسار</th>
                                {[['total_pct','من البداية'],['min_price','أدنى / أعلى'],['last_supplier','آخر مورد'],
                                  ['amount','القيمة']].map(([k, t]) => (
                                    <SortHeader key={k} label={t} k={k} sortKey={sortKey} dir={sortDir} onSort={onSort}
                                        className="py-2.5 px-3 font-bold" />
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {view.map(r => (
                                <tr key={r.product_id} className="border-t border-slate-100 dark:border-brand-800 hover:bg-slate-50 dark:hover:bg-brand-800/40">
                                    <td className="py-2 px-3">
                                        <EntityLink type="product" value={r.product_id} className="font-bold text-brand-800 dark:text-brand-100">
                                            {r.name}
                                        </EntityLink>
                                        <div className="text-[10px] text-slate-400">{r.last_date} · {r.suppliers} مورد</div>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="inline-block bg-slate-100 dark:bg-brand-800 rounded-lg px-2 py-0.5 text-xs font-black">{r.orders}</span>
                                    </td>
                                    <td className="py-2 px-3 font-black tabular-nums whitespace-nowrap">{money(r.last_price)}</td>
                                    <td className="py-2 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                                        {r.prev_price === null ? '—' : money(r.prev_price)}
                                        {r.prev_date && <div className="text-[10px] text-slate-400">{r.prev_date}</div>}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap"><Change pct={r.change_pct} /></td>
                                    <td className="py-2 px-3"><Spark points={r.spark} /></td>
                                    <td className="py-2 px-3 whitespace-nowrap"><Change pct={r.total_pct} /></td>
                                    <td className="py-2 px-3 tabular-nums text-xs text-slate-500 whitespace-nowrap">
                                        {money(r.min_price)} / {money(r.max_price)}
                                    </td>
                                    <td className="py-2 px-3 text-xs">
                                        {r.last_supplier
                                            ? <EntityLink type="supplier" value={r.last_supplier} className="text-slate-600 dark:text-brand-200">{r.last_supplier}</EntityLink>
                                            : '—'}
                                    </td>
                                    <td className="py-2 px-3 tabular-nums font-bold whitespace-nowrap">{money(r.amount)}</td>
                                </tr>
                            ))}
                            {!rows.length && !busy && (
                                <tr><td colSpan={10} className="py-10 text-center text-slate-400 text-sm">لا أصناف</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
