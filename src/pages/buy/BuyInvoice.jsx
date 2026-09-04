import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Plus, Trash2, Loader2, X } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

// حقل باقتراحات من بياناتنا — يختصر الكتابة على الجوال ويمنع تعدد صيغ الاسم
function Suggest({ kind, value, onChange, placeholder, onPick }) {
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        if (!open) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try {
                const r = await fetch(`${API_URL}?action=buy_suggest&kind=${kind}&q=${encodeURIComponent(value || '')}`,
                    { headers: auth() }).then(x => x.json());
                setList(r.data || []);
            } catch { setList([]); }
        }, 250);
        return () => clearTimeout(timer.current);
    }, [value, open, kind]);

    return (
        <div className="relative">
            <input value={value} onChange={e => onChange(e.target.value)}
                onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
                placeholder={placeholder}
                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
            {open && !!list.length && (
                <div className="absolute z-30 inset-x-0 mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {list.map((s, i) => (
                        <button key={i} type="button"
                            onMouseDown={e => { e.preventDefault(); onChange(s.name); onPick && onPick(s); setOpen(false); }}
                            className="w-full text-right px-3 py-2 text-xs hover:bg-white/10 border-b border-white/5 last:border-0">
                            <div className="font-bold truncate">{s.name}</div>
                            <div className="text-[10px] text-slate-400">
                                {s.last_price ? 'آخر سعر ' + money(s.last_price) + ' · ' : ''}{s.n} مرة · {s.last_date || ''}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── إدخال فاتورة شراء من الجوال: صورة + بيانات + بنود ─────────────────────
export default function BuyInvoice({ onDone }) {
    const [supplier, setSupplier] = useState('');
    const [no, setNo]       = useState('');
    const [date, setDate]   = useState(today());
    const [project, setProject] = useState('');
    const [projects, setProjects] = useState([]);
    const [items, setItems] = useState([]);
    const [manual, setManual] = useState('');       // مبلغ قبل الضريبة حين لا تُدخل بنود
    const [paid, setPaid]   = useState('');
    const [note, setNote]   = useState('');
    const [photo, setPhoto] = useState(null);       // { name, dataUrl }
    const [busy, setBusy]   = useState(false);
    const [msg, setMsg]     = useState(null);

    useEffect(() => {
        fetch(`${API_URL}?action=pbudget_list`, { headers: auth() }).then(r => r.json())
            .then(r => setProjects(r.data || [])).catch(() => {});
    }, []);

    const net = items.length
        ? items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
        : (Number(manual) || 0);
    const vat = Math.round(net * 0.15 * 100) / 100;
    const total = Math.round((net + vat) * 100) / 100;

    const pickPhoto = e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => setPhoto({ name: f.name || 'invoice.jpg', dataUrl: String(r.result) });
        r.readAsDataURL(f);
    };

    const save = async () => {
        setMsg(null);
        if (!supplier.trim()) return setMsg({ e: 1, t: 'اسم المورد مطلوب' });
        if (!no.trim())       return setMsg({ e: 1, t: 'رقم الفاتورة مطلوب' });
        if (total <= 0)       return setMsg({ e: 1, t: 'المبلغ مطلوب' });
        setBusy(true);
        try {
            let docUrl = '';
            if (photo) {
                const b64 = photo.dataUrl.split(',')[1] || '';
                const up = await fetch(`${API_URL}?action=doc_upload`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                    body: JSON.stringify({ filename: photo.name, data: b64 }),
                }).then(r => r.json());
                if (up.success) docUrl = up.url; else setMsg({ t: 'تعذر رفع الصورة، حُفظت الفاتورة بدونها' });
            }
            const r = await fetch(`${API_URL}?action=purchase_create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    supplier: supplier.trim(), no: no.trim(), date,
                    project_id: project ? Number(project) : 0,
                    items: items.filter(i => i.name && Number(i.qty) > 0)
                        .map(i => ({ name: i.name, qty: Number(i.qty), price: Number(i.price) || 0 })),
                    subtotal: items.length ? undefined : Number(manual) || 0,
                    paid: Number(paid) || 0, note, doc_url: docUrl,
                }),
            }).then(x => x.json());
            if (!r.success) { setMsg({ e: 1, t: r.message || 'تعذر الحفظ' }); return; }
            setMsg({ t: `حُفظت الفاتورة ${r.no} بمبلغ ${money(r.total)}` });
            setSupplier(''); setNo(''); setItems([]); setManual(''); setPaid(''); setNote(''); setPhoto(null);
            setTimeout(() => onDone && onDone(), 1200);
        } catch (e) {
            setMsg({ e: 1, t: 'تعذر الاتصال — حاول مرة أخرى' });
        } finally { setBusy(false); }
    };

    const setItem = (i, patch) => setItems(a => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));

    return (
        <div className="p-4 space-y-3">
            <label className="block">
                <div className="rounded-2xl border-2 border-dashed border-white/15 p-4 text-center active:bg-white/5">
                    {photo ? (
                        <div className="relative">
                            <img src={photo.dataUrl} alt="" className="max-h-44 mx-auto rounded-xl" />
                            <button type="button" onClick={e => { e.preventDefault(); setPhoto(null); }}
                                className="absolute top-1 left-1 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="text-slate-400">
                            <Camera size={26} className="mx-auto mb-1" />
                            <div className="text-xs font-bold">صوّر الفاتورة</div>
                        </div>
                    )}
                </div>
                <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
            </label>

            <Suggest kind="supplier" value={supplier} onChange={setSupplier} placeholder="المورد" />

            <div className="grid grid-cols-2 gap-2">
                <input value={no} onChange={e => setNo(e.target.value)} placeholder="رقم الفاتورة"
                    className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
            </div>

            <select value={project} onChange={e => setProject(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500">
                <option value="" className="bg-slate-800">بلا مشروع</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id} className="bg-slate-800">{p.name}</option>)}
            </select>

            <div className="rounded-2xl bg-white/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black">البنود</span>
                    <button onClick={() => setItems(a => a.concat({ name: '', qty: '', price: '' }))}
                        className="text-[11px] font-bold text-gold-500 flex items-center gap-1"><Plus size={13} /> بند</button>
                </div>
                {items.map((it, i) => (
                    <div key={i} className="space-y-1.5 border-t border-white/5 pt-2">
                        <Suggest kind="product" value={it.name} onChange={v => setItem(i, { name: v })}
                            placeholder="الصنف"
                            onPick={s => s.last_price && setItem(i, { price: String(s.last_price) })} />
                        <div className="flex gap-2">
                            <input inputMode="decimal" value={it.qty} onChange={e => setItem(i, { qty: e.target.value })}
                                placeholder="الكمية"
                                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
                            <input inputMode="decimal" value={it.price} onChange={e => setItem(i, { price: e.target.value })}
                                placeholder="سعر الوحدة"
                                className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
                            <button onClick={() => setItems(a => a.filter((_, k) => k !== i))}
                                className="px-2 text-red-400"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
                {!items.length && (
                    <input inputMode="decimal" value={manual} onChange={e => setManual(e.target.value)}
                        placeholder="المبلغ قبل الضريبة"
                        className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
                )}
            </div>

            <div className="rounded-2xl bg-white/5 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">قبل الضريبة</span><span className="tabular-nums">{money(net)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ضريبة 15%</span><span className="tabular-nums">{money(vat)}</span></div>
                <div className="flex justify-between font-black text-gold-500 border-t border-white/10 pt-1">
                    <span>الإجمالي</span><span className="tabular-nums">{money(total)}</span>
                </div>
            </div>

            <input inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} placeholder="المسدد (اتركه فارغاً إن لم يُسدد)"
                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة (اختياري)"
                className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />

            {msg && (
                <div className={'rounded-xl p-3 text-xs font-bold ' + (msg.e ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300')}>
                    {msg.t}
                </div>
            )}

            <button onClick={save} disabled={busy}
                className="w-full py-4 rounded-2xl bg-gold-500 text-slate-900 font-black flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} حفظ الفاتورة
            </button>
        </div>
    );
}
