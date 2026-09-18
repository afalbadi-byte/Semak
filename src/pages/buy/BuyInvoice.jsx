import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Plus, Trash2, Loader2, X, ScanLine, Wallet, AlertTriangle, Receipt, FolderOpen, FileText } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
// كل حقول النموذج بمقاس واحد: 52 ارتفاعا كحد اللمس، وmin-w-0 يمنع تجاوز البطاقة
const FIELD = 'w-full min-w-0 h-[52px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[15px] text-white placeholder-slate-500 outline-none focus:border-[#c5a059] transition';
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
                className={FIELD} />
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

// ─── صفحات المستند ─────────────────────────────────────────────────────────
// الفاتورة الطويلة تُصوَّر على عدّة صفحات، وتُقرأ معاً كمستندٍ واحد. الصورة
// تُصغَّر على الجهاز قبل الإرسال: أسرع رفعاً وأخفّ على القراءة؛ وPDF كما هو.
async function readPage(f) {
    const isPdf = (f.type || '').includes('pdf') || /\.pdf$/i.test(f.name || '');
    const raw = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    if (isPdf) return { name: f.name || 'invoice.pdf', mime: 'application/pdf', isPdf: true, dataUrl: raw };
    try {
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = raw; });
        const k = Math.min(1, 2000 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        return { name: (f.name || 'page').replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', isPdf: false, dataUrl: cv.toDataURL('image/jpeg', 0.86) };
    } catch { return { name: f.name || 'page.jpg', mime: f.type || 'image/jpeg', isPdf: false, dataUrl: raw }; }
}
const readPages = async e => {
    const list = Array.from((e.target && e.target.files) || []);
    e.target.value = '';
    return Promise.all(list.map(readPage));
};

// شريط الصفحات: صورٌ مصغّرة مرقّمة، وخانةٌ لإضافة صفحة بالكاميرا أو من الملفات
function Pages({ pages, onAdd, onRemove, big }) {
    const h = big ? 'h-28' : 'h-20';
    return (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {pages.map((pg, i) => (
                <div key={i} className={'relative shrink-0 rounded-xl border border-white/15 overflow-hidden bg-white/5 ' + h + ' ' + (big ? 'w-24' : 'w-16')}>
                    {pg.isPdf
                        ? <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
                            <FileText size={20} className="text-[#c5a059]" /><span className="text-[9px] font-bold">PDF</span></div>
                        : <img src={pg.dataUrl} alt="" className="w-full h-full object-cover" />}
                    <span className="absolute bottom-1 right-1 min-w-[18px] h-[18px] px-1 rounded-md bg-black/70 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                    <button type="button" onClick={() => onRemove(i)}
                        className="absolute top-1 left-1 w-6 h-6 rounded-lg bg-black/70 flex items-center justify-center"><X size={12} /></button>
                </div>
            ))}
            {pages.length < 8 ? (
                <div className={'shrink-0 flex flex-col gap-1.5 ' + h + ' ' + (big ? 'w-24' : 'w-20')}>
                    <label className="flex-1 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center gap-1 active:bg-white/5 text-[10px] font-bold text-slate-300">
                        <Camera size={14} className="text-[#c5a059]" />صفحة
                        <input type="file" accept="image/*" capture="environment" onChange={onAdd} className="hidden" />
                    </label>
                    <label className="flex-1 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center gap-1 active:bg-white/5 text-[10px] font-bold text-slate-300">
                        <FolderOpen size={14} className="text-[#c5a059]" />ملف
                        <input type="file" accept="image/*,application/pdf" multiple onChange={onAdd} className="hidden" />
                    </label>
                </div>
            ) : null}
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
    const [photos, setPhotos] = useState([]);       // صفحات الفاتورة: [{ name, mime, isPdf, dataUrl }]
    const [scan, setScan]   = useState(null);       // نتيجة المعالج الذكي قبل الاعتماد
    const [scanning, setScanning] = useState(false);
    const [payOn, setPayOn]   = useState(false);
    const [payMethod, setPayMethod] = useState('transfer');
    const [payRef, setPayRef] = useState('');
    const [payBank, setPayBank] = useState('');
    const [payDate, setPayDate] = useState(today());
    const [receipts, setReceipts] = useState([]);   // صور الإيصال
    const [rScan, setRScan] = useState(null);       // قراءة الإيصال قبل الاعتماد
    const [rScanning, setRScanning] = useState(false);
    const [rDetails, setRDetails] = useState(null);  // تفاصيل الإيصال المعتمدة، تبقى ظاهرة وتُحفظ
    const [payBenef, setPayBenef] = useState('');
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

    // كل التقاطٍ يُضاف صفحةً جديدة؛ وأي تغييرٍ في الصفحات يُسقط القراءة السابقة
    const pickPhoto = async e => {
        const pg = await readPages(e);
        if (pg.length) { setPhotos(a => [...a, ...pg].slice(0, 8)); setScan(null); }
    };
    const pickReceipt = async e => {
        const pg = await readPages(e);
        if (pg.length) { setReceipts(a => [...a, ...pg].slice(0, 8)); setRScan(null); }
    };

    // قراءة الإيصال كما تُقرأ الفاتورة، ثم يراجع المدير ويعتمد
    const runReceiptScan = async () => {
        if (!receipts.length) return;
        setRScanning(true); setRScan(null);
        try {
            const r = await fetch(`${API_URL}?action=receipt_scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ images: receipts.map(x => ({ image: x.dataUrl, mime: x.mime })), invoice_total: total }),
            }).then(x => x.json());
            if (!r.success) { setMsg({ e: 1, t: (r.message || 'تعذر قراءة الإيصال') + (r.detail ? ' — ' + r.detail : '') }); return; }
            setRScan(r.receipt || {});
        } catch { setMsg({ e: 1, t: 'تعذر الاتصال بالمعالج' }); }
        finally { setRScanning(false); }
    };

    const applyReceiptScan = () => {
        if (!rScan) return;
        setRDetails(rScan);
        if (rScan.amount) setPaid(String(rScan.amount));
        if (rScan.method) setPayMethod(rScan.method);
        if (rScan.bank) setPayBank(String(rScan.bank));
        if (rScan.reference) setPayRef(String(rScan.reference));
        if (rScan.beneficiary) setPayBenef(String(rScan.beneficiary));
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(rScan.pay_date || ''))) setPayDate(rScan.pay_date);
        setRScan(null);
        setMsg({ t: 'نُقلت بيانات الإيصال — راجعها ثم احفظ' });
    };

    const runScan = async () => {
        if (!photos.length) return setMsg({ e: 1, t: 'صوّر الفاتورة أولاً' });
        setScanning(true); setMsg(null); setScan(null);
        try {
            const r = await fetch(`${API_URL}?action=invoice_scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ images: photos.map(x => ({ image: x.dataUrl, mime: x.mime })) }),
            }).then(x => x.json());
            if (!r.success) { setMsg({ e: 1, t: (r.message || 'تعذر القراءة') + (r.detail ? ' — ' + r.detail : '') }); return; }
            const inv = r.invoice || {};
            setScan({ ...inv, items: (inv.items || []).map(it => ({ ...it, use: it.match_id || null })) });
        } catch { setMsg({ e: 1, t: 'تعذر الاتصال بالمعالج' }); }
        finally { setScanning(false); }
    };

    // اعتماد القراءة: تُنقل إلى النموذج ليراجعها المدير قبل الحفظ
    const applyScan = () => {
        if (!scan) return;
        if (scan.supplier_matched || scan.supplier) setSupplier(scan.supplier_matched || scan.supplier);
        if (scan.no) setNo(String(scan.no));
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(scan.date || ''))) setDate(scan.date);
        const its = (scan.items || []).map(it => ({
            name: it.use_name || it.match_name || it.name,
            qty: String(it.qty || ''), price: String(it.price || ''),
        })).filter(x => x.name);
        if (its.length) { setItems(its); setManual(''); }
        else if (scan.subtotal) setManual(String(scan.subtotal));
        setScan(null);
        setMsg({ t: 'نُقلت القراءة للنموذج — راجعها ثم احفظ' });
    };

    const save = async () => {
        setMsg(null);
        if (!supplier.trim()) return setMsg({ e: 1, t: 'اسم المورد مطلوب' });
        if (!no.trim())       return setMsg({ e: 1, t: 'رقم الفاتورة مطلوب' });
        if (total <= 0)       return setMsg({ e: 1, t: 'المبلغ مطلوب' });
        setBusy(true);
        try {
            const uploadAll = async list => {
                const urls = [];
                for (const pg of list) {
                    const up = await fetch(`${API_URL}?action=doc_upload`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                        body: JSON.stringify({ filename: pg.name, data: pg.dataUrl.split(',')[1] || '' }),
                    }).then(r => r.json()).catch(() => ({}));
                    if (up.success) urls.push(up.url);
                }
                return urls;
            };
            const docUrls = await uploadAll(photos);
            if (docUrls.length < photos.length) setMsg({ t: 'تعذّر رفع بعض الصفحات، حُفظت الفاتورة بما رُفع' });
            const rcptUrls = payOn ? await uploadAll(receipts) : [];
            const docUrl = docUrls[0] || '', rcptUrl = rcptUrls[0] || '';
            const r = await fetch(`${API_URL}?action=purchase_create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({
                    supplier: supplier.trim(), no: no.trim(), date,
                    project_id: project ? Number(project) : 0,
                    items: items.filter(i => i.name && Number(i.qty) > 0)
                        .map(i => ({ name: i.name, qty: Number(i.qty), price: Number(i.price) || 0 })),
                    subtotal: items.length ? undefined : Number(manual) || 0,
                    paid: payOn ? (Number(paid) || 0) : 0, note, doc_url: docUrl, doc_urls: docUrls,
                    pay_method: payMethod, pay_reference: payRef, pay_bank: payBank,
                    pay_date: payDate, receipt_url: rcptUrl, receipt_urls: rcptUrls,
                    pay_beneficiary: payBenef || (rDetails && rDetails.beneficiary) || '',
                    pay_from_account: (rDetails && rDetails.from_account) || '',
                    receipt_details: rDetails || null,
                }),
            }).then(x => x.json());
            if (!r.success) { setMsg({ e: 1, t: r.message || 'تعذر الحفظ' }); return; }
            setMsg({ t: `حُفظت الفاتورة ${r.no} بمبلغ ${money(r.total)}` + (r.warning ? ' — ' + r.warning : '') });
            setSupplier(''); setNo(''); setItems([]); setManual(''); setPaid(''); setNote(''); setPhotos([]);
            setPayOn(false); setReceipts([]); setPayRef(''); setPayBank('');
            setRDetails(null); setRScan(null); setPayBenef('');
            setTimeout(() => onDone && onDone(), r.warning ? 4000 : 1200);
        } catch (e) {
            setMsg({ e: 1, t: 'تعذر الاتصال — حاول مرة أخرى' });
        } finally { setBusy(false); }
    };

    const setItem = (i, patch) => setItems(a => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));

    return (
        <div className="p-4 space-y-3">
            {photos.length ? (
                <div className="rounded-2xl border border-white/15 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                        <span>{photos.length > 1 ? 'صفحات الفاتورة (' + photos.length + ')' : 'صورة الفاتورة'}</span>
                        <span>فاتورة طويلة؟ أضف بقيّة صفحاتها</span>
                    </div>
                    <Pages big pages={photos} onAdd={pickPhoto}
                        onRemove={i => { setPhotos(a => a.filter((_, k) => k !== i)); setScan(null); }} />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <label className="min-h-[88px] rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 active:bg-white/5">
                        <Camera size={22} className="text-[#c5a059]" />
                        <span className="text-xs font-bold text-slate-300">تصوير الفاتورة</span>
                        <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
                    </label>
                    <label className="min-h-[88px] rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 active:bg-white/5">
                        <FolderOpen size={22} className="text-[#c5a059]" />
                        <span className="text-xs font-bold text-slate-300">من ملفات الجوال</span>
                        <input type="file" accept="image/*,application/pdf" multiple onChange={pickPhoto} className="hidden" />
                    </label>
                </div>
            )}

            {photos.length > 0 && !scan && (
                <button onClick={runScan} disabled={scanning}
                    className="w-full min-h-[52px] rounded-2xl bg-[#1a365d] border border-[#c5a059]/50 text-[15px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {scanning ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} className="text-[#c5a059]" />}
                    {scanning ? (photos.length > 1 ? 'يقرأ ' + photos.length + ' صفحات...' : 'يقرأ الفاتورة...')
                        : (photos.length > 1 ? 'اقرأ الصفحات ' + photos.length + ' معاً' : 'اقرأ الفاتورة تلقائياً')}
                </button>
            )}

            {scan && <ScanReview scan={scan} setScan={setScan} onApply={applyScan} onCancel={() => setScan(null)} />}

            <Suggest kind="supplier" value={supplier} onChange={setSupplier} placeholder="المورد" />

            <div className="grid grid-cols-2 gap-2">
                <input value={no} onChange={e => setNo(e.target.value)} placeholder="رقم الفاتورة"
                    className={FIELD} />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className={FIELD} />
            </div>

            <select value={project} onChange={e => setProject(e.target.value)}
                className={FIELD}>
                <option value="" className="bg-slate-800">بلا مشروع</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id} className="bg-slate-800">{p.name}</option>)}
            </select>

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black">البنود</span>
                    <button onClick={() => setItems(a => a.concat({ name: '', qty: '', price: '' }))}
                        className="text-[11px] font-bold text-gold-500 flex items-center gap-1"><Plus size={13} /> بند</button>
                </div>
                {items.map((it, i) => {
                    const line = (Number(it.qty) || 0) * (Number(it.price) || 0);
                    return (
                        <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-400">بند {i + 1}</span>
                                <div className="flex items-center gap-2">
                                    {line > 0 && <span className="text-[11px] font-black text-[#c5a059] tabular-nums">{money(line)}</span>}
                                    <button onClick={() => setItems(a => a.filter((_, k) => k !== i))}
                                        className="w-9 h-9 rounded-lg bg-white/5 text-red-400 flex items-center justify-center shrink-0">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            <Suggest kind="product" value={it.name} onChange={v => setItem(i, { name: v })}
                                placeholder="الصنف"
                                onPick={s => s.last_price && setItem(i, { price: String(s.last_price) })} />
                            <div className="grid grid-cols-2 gap-2">
                                <input inputMode="decimal" value={it.qty} onChange={e => setItem(i, { qty: e.target.value })}
                                    placeholder="الكمية" className={FIELD} />
                                <input inputMode="decimal" value={it.price} onChange={e => setItem(i, { price: e.target.value })}
                                    placeholder="سعر الوحدة" className={FIELD} />
                            </div>
                        </div>
                    );
                })}
                {!items.length && (
                    <input inputMode="decimal" value={manual} onChange={e => setManual(e.target.value)}
                        placeholder="المبلغ قبل الضريبة"
                        className={FIELD} />
                )}
            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">قبل الضريبة</span><span className="tabular-nums">{money(net)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">ضريبة 15%</span><span className="tabular-nums">{money(vat)}</span></div>
                <div className="flex justify-between font-black text-gold-500 border-t border-white/10 pt-1">
                    <span>الإجمالي</span><span className="tabular-nums">{money(total)}</span>
                </div>
            </div>

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2.5">
                <button onClick={() => { setPayOn(v => !v); if (!payOn && !paid) setPaid(String(total || '')); }}
                    className="w-full flex items-center justify-between min-h-[44px]">
                    <span className="flex items-center gap-2 text-sm font-black"><Wallet size={16} className="text-[#c5a059]" /> سُدِّدت الفاتورة</span>
                    <span className={'w-12 h-7 rounded-full transition relative ' + (payOn ? 'bg-[#c5a059]' : 'bg-white/15')}>
                        <span className={'absolute top-1 w-5 h-5 rounded-full bg-white transition-all ' + (payOn ? 'right-1' : 'right-6')} />
                    </span>
                </button>

                {payOn && (
                    <div className="space-y-2 pt-1">
                        <input inputMode="decimal" value={paid} onChange={e => setPaid(e.target.value)} placeholder="المبلغ المسدد"
                            className={FIELD} />
                        <div className="grid grid-cols-4 gap-1.5">
                            {[['transfer','تحويل'],['cash','نقدي'],['cheque','شيك'],['card','بطاقة']].map(([k, t]) => (
                                <button key={k} onClick={() => setPayMethod(k)}
                                    className={'h-[52px] rounded-xl text-[13px] font-bold border ' +
                                        (payMethod === k ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]' : 'bg-white/5 border-white/10 text-slate-300')}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input value={payBank} onChange={e => setPayBank(e.target.value)} placeholder="البنك / الخزنة"
                                className={FIELD} />
                            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                                className={FIELD} />
                        </div>
                        <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="مرجع العملية أو رقم الشيك"
                            className={FIELD} />
                        <input value={payBenef} onChange={e => setPayBenef(e.target.value)} placeholder="المستفيد (اسم المستلم أو الحساب)"
                            className={FIELD} />
                        {payOn && Number(paid) > total + 0.5 && (
                            <div className="rounded-xl bg-amber-500/15 text-amber-300 p-2.5 text-[11px] font-bold flex items-start gap-1.5">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                المسدد {money(paid)} يتجاوز إجمالي الفاتورة {money(total)} بـ{money(Number(paid) - total)} —
                                سيُحفظ كما هو، وقد يكون الإيصال يغطي فواتير أخرى
                            </div>
                        )}
                        {payDate && date && payDate < date && (
                            <div className="rounded-xl bg-amber-500/15 text-amber-300 p-2.5 text-[11px] font-bold flex items-start gap-1.5">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                تاريخ السداد ({payDate}) قبل تاريخ الفاتورة ({date}) — تأكد أن الإيصال لهذه الفاتورة
                            </div>
                        )}

                        {rDetails && (
                            <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-1.5">
                                <div className="text-[11px] font-black text-[#c5a059] flex items-center gap-1.5">
                                    <Receipt size={13} /> تفاصيل الإيصال كما قُرئت
                                </div>
                                {[
                                    ['المبلغ',        rDetails.amount != null ? money(rDetails.amount) : null],
                                    ['تاريخ السداد',  rDetails.pay_date],
                                    ['الطريقة',       ({ transfer: 'تحويل', cash: 'نقدي', cheque: 'شيك', card: 'بطاقة', other: 'أخرى' })[rDetails.method]],
                                    ['البنك',         rDetails.bank],
                                    ['المستفيد',      rDetails.beneficiary],
                                    ['الحساب المحوَّل منه', rDetails.from_account],
                                    ['المرجع',        rDetails.reference],
                                ].filter(([, v]) => v).map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-[11px] gap-2">
                                        <span className="text-slate-400 shrink-0">{k}</span>
                                        <span className="font-bold text-left truncate">{String(v)}</span>
                                    </div>
                                ))}
                                <p className="text-[10px] text-slate-500 pt-1">تُحفظ مع الدفعة وتظهر في بطاقة الفاتورة</p>
                            </div>
                        )}
                        {receipts.length ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold">
                                    <Receipt size={14} className="text-emerald-400" />
                                    {receipts.length > 1 ? 'صور الإيصال (' + receipts.length + ')' : 'صورة الإيصال'}
                                </div>
                                <Pages pages={receipts} onAdd={pickReceipt}
                                    onRemove={i => { setReceipts(a => a.filter((_, k) => k !== i)); setRScan(null); }} />
                                {!rScan && (
                                    <button onClick={runReceiptScan} disabled={rScanning}
                                        className="w-full min-h-[48px] rounded-xl bg-[#1a365d] border border-[#c5a059]/50 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                        {rScanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} className="text-[#c5a059]" />}
                                        {rScanning ? 'يقرأ الإيصال...' : 'اقرأ الإيصال تلقائياً'}
                                    </button>
                                )}
                                {rScan && (
                                    <div className="rounded-xl border border-[#c5a059]/50 bg-[#1a365d]/40 p-2.5 space-y-2">
                                        <div className="text-xs font-black flex items-center gap-1.5">
                                            <ScanLine size={14} className="text-[#c5a059]" /> قراءة الإيصال — راجعها
                                        </div>
                                        {rScan.amount_mismatch && (
                                            <div className="rounded-lg bg-amber-500/15 text-amber-300 p-2 text-[11px] font-bold flex items-start gap-1.5">
                                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                                مبلغ الإيصال {money(rScan.amount)} يخالف إجمالي الفاتورة {money(rScan.invoice_total)}
                                            </div>
                                        )}
                                        <div className="text-[11px] space-y-1 bg-black/20 rounded-lg p-2">
                                            <div className="flex justify-between"><span className="text-slate-400">المبلغ</span>
                                                <span className="font-black tabular-nums text-[#c5a059]">{money(rScan.amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">التاريخ</span>
                                                <span className="font-bold">{rScan.pay_date || '—'}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">الطريقة</span>
                                                <span className="font-bold">{({ transfer: 'تحويل', cash: 'نقدي', cheque: 'شيك', card: 'بطاقة', other: 'أخرى' })[rScan.method] || '—'}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">البنك</span>
                                                <span className="font-bold truncate max-w-[60%] text-left">{rScan.bank || '—'}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">المستفيد</span>
                                                <span className="font-bold truncate max-w-[60%] text-left">{rScan.beneficiary || '—'}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">المرجع</span>
                                                <span className="font-bold truncate max-w-[60%] text-left">{rScan.reference || '—'}</span></div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setRScan(null)} className="flex-1 min-h-[44px] rounded-lg bg-white/10 text-xs font-bold">تجاهل</button>
                                            <button onClick={applyReceiptScan} className="flex-[2] min-h-[44px] rounded-lg bg-[#c5a059] text-[#0b1220] text-xs font-black flex items-center justify-center gap-1.5">
                                                <Check size={14} /> اعتمد بيانات الإيصال
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <label className="min-h-[56px] rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-1.5 active:bg-white/5">
                                    <Camera size={15} className="text-slate-400" />
                                    <span className="text-[11px] text-slate-300 font-bold">تصوير الإيصال</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickReceipt} />
                                </label>
                                <label className="min-h-[56px] rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-1.5 active:bg-white/5">
                                    <FolderOpen size={15} className="text-slate-400" />
                                    <span className="text-[11px] text-slate-300 font-bold">من الملفات</span>
                                    <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={pickReceipt} />
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة (اختياري)"
                className={FIELD} />

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

// ─── مراجعة قراءة المعالج قبل الاعتماد: كل بند وأقرب ثلاثة أصناف عندنا ──────
function ScanReview({ scan, setScan, onApply, onCancel }) {
    const items = scan.items || [];
    const pick = (i, cand) => setScan(s => ({
        ...s,
        items: s.items.map((it, k) => (k === i
            ? { ...it, use: cand ? cand.id : null, use_name: cand ? cand.name : it.name, match_score: cand ? cand.score : 0 }
            : it)),
    }));

    return (
        <div className="rounded-2xl border border-[#c5a059]/50 bg-[#1a365d]/40 p-3 space-y-3">
            <div className="flex items-center gap-2">
                <ScanLine size={16} className="text-[#c5a059]" />
                <span className="text-sm font-black">قراءة المعالج — راجعها</span>
            </div>

            {scan.duplicate && (
                <div className="rounded-xl bg-red-500/15 text-red-300 p-2.5 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    فاتورة بنفس الرقم لهذا المورد مسجلة عندنا بمبلغ {money(scan.duplicate.total)} — تأكد أنها ليست مكررة
                </div>
            )}
            {scan.subtotal_mismatch && (
                <div className="rounded-xl bg-amber-500/15 text-amber-300 p-2.5 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    مجموع البنود {money(scan.items_subtotal)} لا يطابق مبلغ الفاتورة {money(scan.subtotal)}
                </div>
            )}

            <div className="text-xs space-y-1 bg-black/20 rounded-xl p-2.5">
                <div className="flex justify-between"><span className="text-slate-400">المورد</span>
                    <span className="font-bold truncate max-w-[60%] text-left">{scan.supplier_matched || scan.supplier || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">رقم الفاتورة</span><span className="font-bold">{scan.no || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">التاريخ</span><span className="font-bold">{scan.date || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">قبل الضريبة</span><span className="font-bold tabular-nums">{money(scan.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">الإجمالي</span><span className="font-black tabular-nums text-[#c5a059]">{money(scan.total)}</span></div>
            </div>

            {items.map((it, i) => (
                <div key={i} className="rounded-xl bg-black/20 p-2.5 space-y-1.5">
                    <div className="text-xs font-bold">{it.name}</div>
                    <div className="text-[11px] text-slate-400">
                        {it.qty} × {money(it.price)}
                        {it.last_price ? ' · آخر سعر عندنا ' + money(it.last_price) : ''}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {(it.candidates || []).map(c => (
                            <button key={c.id} onClick={() => pick(i, c)}
                                className={'px-2.5 py-2 rounded-lg text-[11px] font-bold border min-h-[40px] ' +
                                    (it.use === c.id ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]' : 'bg-white/5 border-white/10 text-slate-300')}>
                                {c.name} <span className="opacity-60">{Math.round(c.score * 100)}%</span>
                            </button>
                        ))}
                        <button onClick={() => pick(i, null)}
                            className={'px-2.5 py-2 rounded-lg text-[11px] font-bold border min-h-[40px] ' +
                                (it.use ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white/15 border-white/20 text-white')}>
                            كما في الفاتورة
                        </button>
                    </div>
                </div>
            ))}
            {!items.length && <p className="text-xs text-slate-400 text-center py-2">لم يقرأ بنوداً — أدخل المبلغ يدوياً</p>}

            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 min-h-[48px] rounded-xl bg-white/10 text-sm font-bold">تجاهل</button>
                <button onClick={onApply} className="flex-[2] min-h-[48px] rounded-xl bg-[#c5a059] text-[#0b1220] text-sm font-black flex items-center justify-center gap-2">
                    <Check size={16} /> اعتمد القراءة
                </button>
            </div>
        </div>
    );
}
