import React, { useState, useEffect, useCallback } from 'react';
import { FilePlus, RefreshCw, AlertTriangle, Paperclip, Wallet, TrendingUp } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ─── الشاشة الأولى: أرقام اليوم وآخر الفواتير ───────────────────────────────
export default function BuyHome({ onNew }) {
    const [k, setK]       = useState(null);
    const [last, setLast] = useState([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const t = getAdminToken();
            const h = t ? { Authorization: `Bearer ${t}` } : {};
            const [a, b] = await Promise.all([
                fetch(`${API_URL}?action=mtg_kpis`, { headers: h }).then(r => r.json()).catch(() => null),
                fetch(`${API_URL}?action=kpi_detail&key=month_total`, { headers: h }).then(r => r.json()).catch(() => null),
            ]);
            if (a && a.success !== false) setK(a.data || a);
            if (b && b.success) setLast((b.rows || []).slice(0, 12));
        } finally { setBusy(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

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
                <button onClick={load} className="text-slate-400"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button>
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
