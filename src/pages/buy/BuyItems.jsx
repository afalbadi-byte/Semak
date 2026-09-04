import React, { useState, useEffect, useCallback } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => (v === null || v === undefined || isNaN(Number(v)))
    ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── أسعار الأصناف على الجوال: الأكثر طلباً أولاً، وسعر اليوم مقابل ما قبله ──
export default function BuyItems() {
    const [rows, setRows] = useState([]);
    const [q, setQ]       = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (query) => {
        setBusy(true);
        try {
            const t = getAdminToken();
            const r = await fetch(`${API_URL}?action=item_prices&sort=orders&q=${encodeURIComponent(query || '')}`,
                { headers: t ? { Authorization: `Bearer ${t}` } : {} }).then(x => x.json());
            setRows((r.data || []).slice(0, 120));
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, []);

    useEffect(() => { load(''); }, [load]);

    return (
        <div className="p-4 space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && load(q)}
                        placeholder="ابحث عن صنف..."
                        className="w-full pr-9 pl-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
                </div>
                <button onClick={() => load(q)} className="px-4 rounded-xl bg-white/10">
                    <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="space-y-2">
                {rows.map(r => {
                    const pct = r.change_pct;
                    const up = pct > 0, flat = pct === 0 || pct === null || pct === undefined;
                    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
                    return (
                        <div key={r.product_id} className="rounded-xl bg-white/5 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{r.name}</div>
                                    <div className="text-[11px] text-slate-400 truncate">
                                        {r.orders} طلب · {r.last_supplier || 'بلا مورد'} · {r.last_date}
                                    </div>
                                </div>
                                <div className="text-left shrink-0">
                                    <div className="text-base font-black tabular-nums">{money(r.last_price)}</div>
                                    <div className={'text-[11px] font-bold flex items-center gap-0.5 justify-end ' +
                                        (flat ? 'text-slate-500' : up ? 'text-red-400' : 'text-emerald-400')}>
                                        <Icon size={12} />{flat ? '—' : Math.abs(pct) + '%'}
                                    </div>
                                </div>
                            </div>
                            {r.prev_price !== null && r.prev_price !== undefined && (
                                <div className="text-[11px] text-slate-500 mt-1">
                                    السابق {money(r.prev_price)} · المدى {money(r.min_price)} إلى {money(r.max_price)}
                                </div>
                            )}
                        </div>
                    );
                })}
                {!rows.length && !busy && <p className="text-center text-slate-500 text-sm py-8">لا نتائج</p>}
            </div>
        </div>
    );
}
