import React, { useState, useEffect, useCallback } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const KIND = {
    'فاتورة': 'text-slate-200',
    'دفعة':   'text-emerald-300',
    'مرتجع':  'text-sky-300',
};

// ─── كشف حساب مورد: الحركة زمنياً برصيد متحرك، قابل للطباعة والإرسال ────────
export default function SupplierStatement({ supplier, onClose }) {
    const [d, setD]     = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(true);
    const [from, setFrom] = useState('');
    const [to, setTo]     = useState('');

    const load = useCallback(async () => {
        setBusy(true); setErr('');
        try {
            const q = new URLSearchParams({ action: 'sup_statement', supplier });
            if (from) q.set('from', from);
            if (to)   q.set('to', to);
            const r = await fetch(`${API_URL}?${q}`, { headers: auth() }).then(x => x.json());
            if (!r.success) setErr(r.message || 'تعذر الكشف'); else setD(r);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    }, [supplier, from, to]);

    useEffect(() => { load(); }, [load]);

    // الطباعة تفتح نافذة بمحتوى الكشف وحده — بلا أزرار ولا ألوان الشاشة
    const print = () => {
        if (!d) return;
        const rows = d.rows.map(r => `<tr>
            <td>${r.date}</td><td>${r.kind}</td><td>${r.ref || ''}</td>
            <td class="n">${r.debit ? money(r.debit) : ''}</td>
            <td class="n">${r.credit ? money(r.credit) : ''}</td>
            <td class="n b">${money(r.balance)}</td></tr>`).join('');
        const w = window.open('', '_blank');
        if (!w) { setErr('المتصفح منع نافذة الطباعة'); return; }
        w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
            <title>كشف حساب — ${d.supplier}</title><style>
            body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:24px;color:#111}
            h1{font-size:18px;margin:0 0 2px} .sub{font-size:12px;color:#555;margin-bottom:14px}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #ccc;padding:5px 7px;text-align:right}
            th{background:#f2f2f2} .n{text-align:left;font-variant-numeric:tabular-nums} .b{font-weight:700}
            tfoot td{font-weight:700;background:#fafafa}
            </style></head><body>
            <h1>كشف حساب مورد — ${d.supplier}</h1>
            <div class="sub">سماك الخير · ${d.from || 'من البداية'} إلى ${d.to || 'اليوم'}
                 · رصيد افتتاحي ${money(d.opening)}</div>
            <table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th>
                <th class="n">عليه</th><th class="n">له</th><th class="n">الرصيد</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="3">الإجمالي</td>
                <td class="n">${money(d.total_debit)}</td>
                <td class="n">${money(d.total_credit)}</td>
                <td class="n">${money(d.closing)}</td></tr></tfoot></table>
            <p style="font-size:11px;color:#666;margin-top:14px">
                الرصيد الموجب مستحقٌّ للمورد. حُرِّر في ${new Date().toLocaleDateString('en-CA')}.</p>
            </body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };

    return (
        <div className="fixed inset-0 z-[90] bg-[#0b1628] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 bg-[#0b1628]/95 backdrop-blur border-b border-white/10 p-4 flex items-center gap-2">
                <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <X size={17} />
                </button>
                <h2 className="font-black text-[14px] truncate flex-1">كشف حساب — {supplier}</h2>
                <button onClick={print} disabled={!d}
                    className="h-10 px-3 rounded-xl bg-[#c5a059] text-[#0b1220] text-[12px] font-black flex items-center gap-1.5 disabled:opacity-40">
                    <Printer size={15} /> طباعة
                </button>
            </div>

            <div className="p-4 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
                <div className="flex gap-2">
                    <label className="flex-1">
                        <div className="text-[10px] text-slate-400 mb-1">من</div>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                            className="w-full h-[44px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] outline-none focus:border-[#c5a059]" />
                    </label>
                    <label className="flex-1">
                        <div className="text-[10px] text-slate-400 mb-1">إلى</div>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)}
                            className="w-full h-[44px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] outline-none focus:border-[#c5a059]" />
                    </label>
                </div>

                {err && <p className="text-[12px] text-rose-300">{err}</p>}
                {busy && <p className="text-[12px] text-slate-500 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> يحسب…</p>}

                {d && (
                    <>
                        <div className="grid grid-cols-3 gap-2">
                            <Box t="عليه" v={d.total_debit} />
                            <Box t="له" v={d.total_credit} tone="text-emerald-300" />
                            <Box t={d.closing >= 0 ? 'مستحق للمورد' : 'له عندنا رصيد'}
                                 v={Math.abs(d.closing)} tone={d.closing >= 0 ? 'text-amber-300' : 'text-sky-300'} />
                        </div>
                        {Number(d.opening) !== 0 && (
                            <p className="text-[11px] text-slate-400">رصيد افتتاحي: {money(d.opening)}</p>
                        )}

                        <div className="rounded-2xl bg-white/[0.05] border border-white/10 overflow-hidden">
                            {d.rows.length === 0 && (
                                <p className="text-[12px] text-slate-500 text-center py-8">لا حركة في هذه المدة</p>
                            )}
                            {d.rows.map((r, i) => (
                                <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-2 text-[12px]">
                                        <span className={'font-black shrink-0 ' + (KIND[r.kind] || '')}>{r.kind}</span>
                                        <span className="text-slate-400 truncate">{r.ref}</span>
                                        <span className="mr-auto tabular-nums font-black shrink-0">
                                            {r.debit ? money(r.debit) : '−' + money(r.credit)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                        <span>{r.date}</span>
                                        <span className="mr-auto tabular-nums">الرصيد {money(r.balance)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            «عليه» فواتير الشراء، و«له» الدفعات والمرتجعات. الرصيد الموجب مستحقٌّ للمورد.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

function Box({ t, v, tone }) {
    return (
        <div className="rounded-xl bg-white/[0.05] p-2.5">
            <div className="text-[10px] text-slate-400">{t}</div>
            <div className={'text-[14px] font-black tabular-nums ' + (tone || '')}>{money(v)}</div>
        </div>
    );
}
