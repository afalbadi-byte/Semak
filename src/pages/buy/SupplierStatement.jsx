import React, { useState, useEffect, useCallback } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { openPrintReport } from '../../lib/printReport';
import { useEntity } from './entityCtx';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const KIND = {
    'فاتورة': 'text-slate-200',
    'دفعة':   'text-emerald-300',
    'مرتجع':  'text-sky-300',
    'استرداد': 'text-amber-300',
};

// ─── كشف حساب مورد: الحركة زمنياً برصيد متحرك، قابل للطباعة والإرسال ────────
export default function SupplierStatement({ supplier, onClose }) {
    const [d, setD]     = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(true);
    const [from, setFrom] = useState('');
    const [to, setTo]     = useState('');
    const [kinds, setKinds] = useState([]);   // فارغ = كل الأنواع
    const [openRow, setOpenRow] = useState(-1);
    const { openEntity } = useEntity();

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

    // الرصيد المتحرك محسوب على كل الحركات؛ الفلتر يُخفي الصفوف ولا يُعيد الحساب
    const KINDS = ['فاتورة', 'دفعة', 'مرتجع', 'استرداد'];
    const shown = (d?.rows || []).filter(r => !kinds.length || kinds.includes(r.kind));
    const toggle = k => setKinds(v => v.includes(k) ? v.filter(x => x !== k) : v.concat(k));

    // الطباعة تفتح نافذة بمحتوى الكشف وحده — بلا أزرار ولا ألوان الشاشة
    // الطباعة بنموذج سماك الرسمي (نفس كليشة عرض السعر والعقد)
    const print = () => openPrintReport('supplier_statement', { supplier, from, to });


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

                {/* فلترة بالنوع — الرصيد يبقى محسوبا على كل الحركات */}
                <div className="flex flex-wrap gap-1.5">
                    {KINDS.map(k => (
                        <button key={k} onClick={() => toggle(k)}
                            className={'px-2.5 h-8 rounded-lg text-[11px] font-bold ' +
                                (kinds.includes(k) ? 'bg-[#c5a059] text-[#0a0f1e]' : 'bg-white/5 text-slate-400')}>
                            {k}
                        </button>
                    ))}
                    {kinds.length > 0 && (
                        <button onClick={() => setKinds([])}
                            className="px-2.5 h-8 rounded-lg text-[11px] font-bold bg-white/10 text-slate-200">
                            الكل
                        </button>
                    )}
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
                            {shown.map((r, i) => (
                                <div key={i} className="border-b border-white/5 last:border-0">
                                    <button onClick={() => setOpenRow(v => v === i ? -1 : i)}
                                        className="w-full text-right px-3 py-2">
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
                                    </button>

                                    {openRow === i && (
                                        <div className="px-3 pb-3 space-y-2">
                                            {r.info && (
                                                <div className="rounded-xl bg-black/25 p-2.5 space-y-1">
                                                    {Object.entries(r.info).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between text-[11px]">
                                                            <span className="text-slate-400">{k}</span>
                                                            <span className="font-bold tabular-nums">
                                                                {typeof v === 'number' ? money(v) : String(v)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                {r.open?.value > 0 && (
                                                    <button onClick={() => { onClose && onClose(); openEntity(r.open.type, r.open.value); }}
                                                        className="flex-1 h-9 rounded-lg bg-white/10 text-[11px] font-bold">
                                                        افتح البطاقة
                                                    </button>
                                                )}
                                                {r.url && (
                                                    <a href={r.url} target="_blank" rel="noreferrer"
                                                        className="flex-1 h-9 rounded-lg bg-white/10 text-[11px] font-bold flex items-center justify-center">
                                                        الإيصال
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
