import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, Paperclip, ChevronLeft, Link2, AlertTriangle, X } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { openRefundDoc, openDaftraFile } from '../../lib/docs';
import ReceiptCapture, { uploadReceipt } from '../../components/ReceiptCapture';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auth  = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...auth() });

// ─── المرتجعات: سجل ومزامنة وتسجيل — مقابلٌ للمشتريات في الاتجاه المعاكس ─────
export default function BuyReturns() {
    const [rows, setRows] = useState([]);
    const [sum, setSum]   = useState(null);
    const [q, setQ]       = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg]   = useState(null);
    const [filter, setFilter] = useState('');       // '' | no_docs | no_link
    const [open, setOpen] = useState(null);         // بطاقة مرتجع مفتوحة
    const [form, setForm] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=refund_list&q=${encodeURIComponent(q)}&limit=60`
                + (filter ? `&${filter}=1` : ''), { headers: auth() }).then(x => x.json());
            setRows(r.data || []);
            setSum(r.summary || null);
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, [q, filter]);

    useEffect(() => { load(); }, [filter]);   // eslint-disable-line react-hooks/exhaustive-deps

    const sync = async () => {
        setBusy(true); setMsg(null);
        try {
            const r = await fetch(`${API_URL}?action=refund_sync`, { headers: auth() }).then(x => x.json());
            if (!r.success) {
                // الفحص يقول أي مسار جُرّب وبماذا ردّ — لا نُخفي السبب
                const tried = (r.probe || []).map(p => `${p.endpoint}: ${p.http}`).join(' · ');
                setMsg({ bad: true, t: r.message || 'تعذرت المزامنة', sub: tried });
            } else {
                setMsg({ t: `من ${r.endpoint}: فُحص ${r.checked} · أُضيف ${r.added} · حُدّث ${r.updated}`
                    + ` · بنود ${r.items_synced} · مرفقات ${r.attachments}` });
                await load();
            }
        } catch { setMsg({ bad: true, t: 'تعذر الاتصال' }); }
        finally { setBusy(false); }
    };

    if (form) return <NewReturn onClose={() => setForm(false)} onDone={() => { setForm(false); load(); }} />;
    if (open) return <ReturnCard id={open} onBack={() => { setOpen(null); load(); }} />;

    return (
        <div className="p-4 space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                        placeholder="ابحث برقم المرتجع أو المورد"
                        className="w-full min-w-0 h-[52px] pr-9 pl-3 rounded-xl bg-white/[0.06] border border-white/10 text-[15px] outline-none focus:border-[#c5a059]" />
                </div>
                <button onClick={sync} disabled={busy}
                    className="w-[52px] h-[52px] rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            <button onClick={() => setForm(true)}
                className="w-full h-[52px] rounded-xl bg-[#c5a059] text-[#0b1220] text-[15px] font-black flex items-center justify-center gap-2">
                <Plus size={17} /> تسجيل مرتجع
            </button>

            {msg && (
                <div className={'rounded-xl p-3 text-[12px] leading-relaxed '
                    + (msg.bad ? 'bg-rose-500/10 text-rose-200' : 'bg-emerald-500/10 text-emerald-200')}>
                    <div className="font-bold">{msg.t}</div>
                    {msg.sub && <div className="text-[10px] text-slate-400 mt-1 break-all">{msg.sub}</div>}
                </div>
            )}

            {sum && (
                <div className="grid grid-cols-3 gap-2">
                    <Stat t="المرتجعات" v={sum.n || 0} />
                    <Stat t="القيمة" v={money(sum.gross)} small />
                    <Stat t="بلا فاتورة أصل" v={sum.unlinked || 0} warn={Number(sum.unlinked) > 0} />
                </div>
            )}

            <div className="flex gap-2">
                {[['', 'الكل'], ['no_link', 'بلا فاتورة أصل'], ['no_docs', 'بلا مستند']].map(([k, t]) => (
                    <button key={k} onClick={() => setFilter(k)}
                        className={'flex-1 h-[38px] rounded-xl text-[12px] font-bold border '
                            + (filter === k ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]'
                                            : 'bg-white/5 border-white/10 text-slate-300')}>{t}</button>
                ))}
            </div>

            {!busy && rows.length === 0 && (
                <p className="text-center text-[12px] text-slate-500 py-8">لا مرتجعات بعد — اسحبها من دفترة أو سجّلها هنا</p>
            )}

            <div className="space-y-2">
                {rows.map(r => (
                    <button key={r.id} onClick={() => setOpen(r.id)}
                        className="w-full text-right rounded-2xl bg-white/[0.05] border border-white/10 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-black truncate">{r.supplier || 'بلا مورد'}</span>
                            <span className="text-[15px] font-black tabular-nums text-rose-300 mr-auto shrink-0">
                                −{money(r.gross)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>مرتجع {r.no}</span>
                            <span>{r.date || '—'}</span>
                            {Number(r.docs) > 0 && (
                                <span className="flex items-center gap-1 text-emerald-300">
                                    <Paperclip size={10} />{r.docs}
                                </span>
                            )}
                            <span className="mr-auto">
                                {r.purchase_id
                                    ? <span className="flex items-center gap-1 text-sky-300"><Link2 size={10} />فاتورة {r.purchase_no}</span>
                                    : <span className="flex items-center gap-1 text-amber-300"><AlertTriangle size={10} />بلا أصل</span>}
                            </span>
                            <ChevronLeft size={13} />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function Stat({ t, v, small, warn }) {
    return (
        <div className={'rounded-xl p-2.5 ' + (warn ? 'bg-amber-500/10' : 'bg-white/[0.05]')}>
            <div className={'text-[10px] ' + (warn ? 'text-amber-300' : 'text-slate-400')}>{t}</div>
            <div className={(small ? 'text-[13px]' : 'text-[16px]') + ' font-black tabular-nums'}>{v}</div>
        </div>
    );
}

// ─── بطاقة المرتجع ──────────────────────────────────────────────────────────
function ReturnCard({ id, onBack }) {
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        fetch(`${API_URL}?action=refund_entity&id=${id}`, { headers: auth() })
            .then(r => r.json()).then(r => r.success ? setD(r) : setErr(r.message || 'تعذر الفتح'))
            .catch(() => setErr('تعذر الاتصال'));
    }, [id]);
    useEffect(load, [load]);

    const attach = async () => {
        if (!file) return;
        setBusy(true); setErr('');
        try {
            const url = await uploadReceipt(file);
            if (!url) { setErr('تعذر رفع الملف'); return; }
            const r = await fetch(`${API_URL}?action=refund_doc_add`, {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({ refund_id: id, drive_url: url, file_name: file.name }),
            }).then(x => x.json());
            if (!r.success) setErr(r.message || 'تعذر الإرفاق');
            else { setFile(null); load(); }
        } catch (e) { setErr(e.message || 'تعذر الرفع'); }
        finally { setBusy(false); }
    };

    if (err && !d) return <Shell onBack={onBack}><p className="text-[13px] text-rose-300">{err}</p></Shell>;
    if (!d) return <Shell onBack={onBack}><p className="text-[13px] text-slate-400">…</p></Shell>;

    const h = d.head;
    return (
        <Shell onBack={onBack}>
            <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[15px] font-black">{h.supplier}</span>
                    <span className="text-[18px] font-black tabular-nums text-rose-300 mr-auto">−{money(h.gross)}</span>
                </div>
                <div className="text-[11px] text-slate-400">مرتجع {h.no} · {h.date || '—'}</div>
                {h.reason && <div className="text-[12px] text-slate-300">السبب: {h.reason}</div>}
                {h.purchase_id ? (
                    <div className="rounded-xl bg-sky-500/10 p-2.5 text-[12px] text-sky-200">
                        من فاتورة {h.purchase_no} · {h.orig_supplier} · {money(h.orig_total)} · {h.orig_date || '—'}
                    </div>
                ) : (
                    <div className="rounded-xl bg-amber-500/10 p-2.5 text-[12px] text-amber-200 flex items-center gap-2">
                        <AlertTriangle size={13} /> غير مربوط بفاتورة أصل
                    </div>
                )}
            </div>

            <Section t={`البنود (${(d.items || []).length})`}>
                {(d.items || []).length === 0
                    ? <p className="text-[12px] text-slate-500">لا بنود</p>
                    : d.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-white/5 last:border-0">
                            <span className="truncate">{it.item}</span>
                            <span className="text-slate-400 tabular-nums shrink-0">{it.quantity} × {money(it.unit_price)}</span>
                            <span className="mr-auto font-bold tabular-nums shrink-0">{money(it.subtotal)}</span>
                        </div>
                    ))}
            </Section>

            <Section t={`المستندات (${(d.documents || []).length})`}>
                {(d.documents || []).map(doc => (
                    <div key={doc.src + doc.id} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-white/5 last:border-0">
                        <Paperclip size={12} className="text-slate-500 shrink-0" />
                        <span className="truncate">{doc.file_name}</span>
                        <button onClick={() => (doc.src === 'daftra' ? openDaftraFile(doc.daftra_file_id, true) : openRefundDoc(doc.id, true))
                            .catch(e => setErr(e.message))}
                            className="mr-auto shrink-0 px-2.5 h-[30px] rounded-lg bg-white/10 text-[11px] font-bold">استعراض</button>
                    </div>
                ))}
                <div className="pt-2 space-y-2">
                    <ReceiptCapture file={file} onFile={setFile} onError={setErr} />
                    {file && (
                        <button onClick={attach} disabled={busy}
                            className="w-full h-[44px] rounded-xl bg-[#c5a059] text-[#0b1220] text-[13px] font-black">
                            {busy ? '…' : 'أرفق بالمرتجع'}
                        </button>
                    )}
                </div>
            </Section>
            {err && <p className="text-[12px] text-rose-300">{err}</p>}
        </Shell>
    );
}

// ─── تسجيل مرتجع ────────────────────────────────────────────────────────────
function NewReturn({ onClose, onDone }) {
    const [sup, setSup]   = useState('');
    const [no, setNo]     = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [sub, setSub]   = useState('');
    const [reason, setReason] = useState('');
    const [pick, setPick] = useState(null);         // الفاتورة الأصل
    const [hits, setHits] = useState([]);
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr]   = useState('');

    // البحث عن الفاتورة الأصل: هي التي تملأ المورد وتحدّ سقف المبلغ
    const find = async v => {
        if (v.trim().length < 2) { setHits([]); return; }
        try {
            const r = await fetch(`${API_URL}?action=buy_list&kind=invoices&q=${encodeURIComponent(v)}&limit=8`,
                { headers: auth() }).then(x => x.json());
            setHits(r.data || []);
        } catch { setHits([]); }
    };

    const save = async () => {
        setBusy(true); setErr('');
        try {
            let doc_url = '';
            if (file) doc_url = await uploadReceipt(file);
            const r = await fetch(`${API_URL}?action=refund_create`, {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({ supplier: sup, no, date, subtotal: Number(sub || 0),
                    purchase_id: pick ? pick.id : 0, reason, doc_url }),
            }).then(x => x.json());
            if (!r.success) setErr(r.message || 'تعذر الحفظ');
            else onDone();
        } catch (e) { setErr(e.message || 'تعذر الحفظ'); }
        finally { setBusy(false); }
    };

    const net   = Number(sub || 0);
    const total = Math.round(net * 1.15 * 100) / 100;

    return (
        <Shell onBack={onClose} title="تسجيل مرتجع">
            <div className="space-y-2">
                <Label t="الفاتورة الأصل (اختياري لكن مُفضّل)" />
                {pick ? (
                    <div className="rounded-xl bg-sky-500/10 p-3 flex items-center gap-2 text-[12px] text-sky-200">
                        <span className="truncate">فاتورة {pick.no} · {pick.supplier} · {money(pick.gross)}</span>
                        <button onClick={() => setPick(null)} className="mr-auto"><X size={14} /></button>
                    </div>
                ) : (
                    <>
                        <input onChange={e => find(e.target.value)} placeholder="ابحث برقم الفاتورة أو المورد"
                            className="w-full h-[48px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] outline-none focus:border-[#c5a059]" />
                        {hits.map(h => (
                            <button key={h.id} onClick={() => { setPick(h); setSup(h.supplier); setHits([]); }}
                                className="w-full text-right rounded-xl bg-white/5 p-2.5 text-[12px]">
                                فاتورة {h.no} · {h.supplier} · {money(h.gross)} · {h.date}
                            </button>
                        ))}
                    </>
                )}

                <Label t="المورد" />
                <Input v={sup} on={setSup} ph="اسم المورد" />
                <Label t="رقم المرتجع" />
                <Input v={no} on={setNo} ph="رقم إشعار المرتجع" />
                <Label t="التاريخ" />
                <Input v={date} on={setDate} type="date" />
                <Label t="المبلغ قبل الضريبة" />
                <Input v={sub} on={setSub} type="number" ph="0.00" />
                {net > 0 && (
                    <p className="text-[11px] text-slate-400">
                        الضريبة {money(total - net)} · الإجمالي <span className="text-rose-300 font-black">−{money(total)}</span>
                    </p>
                )}
                <Label t="السبب" />
                <Input v={reason} on={setReason} ph="تالف، فائض، خطأ في الطلب…" />

                <Label t="صورة إشعار المرتجع" />
                <ReceiptCapture file={file} onFile={setFile} onError={setErr} />

                {err && <p className="text-[12px] text-rose-300">{err}</p>}
                <button onClick={save} disabled={busy || !sup || !no || net <= 0}
                    className="w-full h-[52px] rounded-xl bg-[#c5a059] text-[#0b1220] text-[15px] font-black disabled:opacity-40">
                    {busy ? '…' : 'احفظ المرتجع'}
                </button>
            </div>
        </Shell>
    );
}

const Label = ({ t }) => <div className="text-[11px] text-slate-400 pt-1">{t}</div>;
const Input = ({ v, on, ph, type = 'text' }) => (
    <input value={v} onChange={e => on(e.target.value)} placeholder={ph} type={type}
        className="w-full h-[48px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] outline-none focus:border-[#c5a059]" />
);

function Section({ t, children }) {
    return (
        <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3">
            <div className="text-[12px] font-black mb-2">{t}</div>
            {children}
        </div>
    );
}

function Shell({ onBack, title, children }) {
    return (
        <div className="p-4 space-y-3">
            <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-300">
                <ChevronLeft size={16} className="rotate-180" /> {title || 'رجوع'}
            </button>
            {children}
        </div>
    );
}
