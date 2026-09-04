import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Search, Link2, Trash2, AlertTriangle, CheckCircle2, FolderOpen, RefreshCw, Plus, Upload } from 'lucide-react';
import { API_URL } from '../../lib/api/client';

const DRIVE_FOLDER = 'سماك-المستندات';
const TYPES = { invoice: 'فاتورة مورد', receipt: 'إيصال سداد', other: 'مستند آخر' };
const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const driveSearch = name => `https://drive.google.com/drive/search?q=${encodeURIComponent(name)}`;

export default function PurchaseDocs() {
    const [stats, setStats]     = useState(null);
    const [docs, setDocs]       = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [tab, setTab]         = useState('missing');
    const [q, setQ]             = useState('');
    const [form, setForm]       = useState(null);
    const [pend, setPend]       = useState([]);
    const [pendTotal, setPendTotal] = useState(0);
    const [pForm, setPForm]     = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [s, d, pc] = await Promise.all([
                fetch(`${API_URL}?action=pdocs_stats`).then(r => r.json()),
                fetch(`${API_URL}?action=pdocs_list`).then(r => r.json()),
                fetch(`${API_URL}?action=pcost_list`).then(r => r.json()),
            ]);
            if (s.success) setStats(s);
            if (d.success) setDocs(d.data || []);
            if (pc && pc.success) { setPend(pc.data || []); setPendTotal(pc.awaiting_total || 0); }
        } catch (e) { setError('تعذر تحميل البيانات'); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const addDoc = async payload => {
        const r = await fetch(`${API_URL}?action=pdocs_add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(x => x.json());
        if (r.success) { setForm(null); load(); } else setError(r.message || 'تعذر الحفظ');
    };

    const uploadDoc = async (file, meta) => {
        const b64 = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result).split(',')[1] || '');
            fr.onerror = rej; fr.readAsDataURL(file);
        });
        const up = await fetch(`${API_URL}?action=doc_upload`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, data: b64 }),
        }).then(x => x.json());
        if (!up.success) { setError(up.message || 'تعذر رفع الملف'); return; }
        await addDoc({ ...meta, file_name: file.name, drive_url: up.url, file_size: file.size, source: 'upload' });
    };

    const delDoc = async id => {
        if (!window.confirm('حذف ربط هذا المستند؟ الملف نفسه يبقى في درايفك.')) return;
        await fetch(`${API_URL}?action=pdocs_delete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        load();
    };

    const savePend = async payload => {
        const r = await fetch(`${API_URL}?action=pcost_save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(x => x.json());
        if (r.success) { setPForm(null); load(); } else setError(r.message || 'تعذر الحفظ');
    };

    const delPend = async id => {
        if (!window.confirm('حذف هذا الالتزام؟')) return;
        await fetch(`${API_URL}?action=pcost_delete`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        load();
    };

    const missing = useMemo(() => {
        const list = (stats && stats.missing) || [];
        if (!q.trim()) return list;
        const t = q.trim();
        return list.filter(x => String(x.no).includes(t) || String(x.supplier || '').includes(t));
    }, [stats, q]);

    const linked = useMemo(() => {
        if (!q.trim()) return docs;
        const t = q.trim();
        return docs.filter(d => String(d.invoice_no).includes(t) || String(d.supplier || '').includes(t) || String(d.file_name).includes(t));
    }, [docs, q]);

    const cover = stats && stats.invoices_total
        ? Math.round((stats.invoices_with_docs / stats.invoices_total) * 100) : 0;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-black text-brand-900 flex items-center gap-2">
                        <FileText size={24} className="text-gold-500" /> مستندات المشتريات
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        أرشيف مستقل: الملفات في درايفك، والربط في نظامنا.
                    </p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold hover:bg-brand-800 disabled:opacity-50">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card label="فواتير لها مستندات" value={stats.invoices_with_docs} tone="emerald" />
                    <Card label="فواتير بلا مستندات" value={stats.invoices_without_docs} tone="red" />
                    <Card label="إجمالي المستندات" value={stats.documents} tone="brand" />
                    <Card label="نسبة التغطية" value={cover + '%'} tone="gold" />
                </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setTab('missing')}
                    className={'px-4 py-2 rounded-xl text-sm font-bold ' + (tab === 'missing' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600')}>
                    بلا مستندات {stats ? '(' + stats.invoices_without_docs + ')' : ''}
                </button>
                <button onClick={() => setTab('linked')}
                    className={'px-4 py-2 rounded-xl text-sm font-bold ' + (tab === 'linked' ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600')}>
                    المستندات المربوطة {stats ? '(' + stats.documents + ')' : ''}
                </button>
                <button onClick={() => setTab('pending')}
                    className={'px-4 py-2 rounded-xl text-sm font-bold ' + (tab === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600')}>
                    بانتظار الفاتورة ({pend.filter(x => x.status === 'awaiting_invoice').length})
                </button>
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برقم الفاتورة أو المورد أو اسم الملف"
                        className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <a href={driveSearch(DRIVE_FOLDER)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500 text-white text-sm font-bold hover:bg-gold-600">
                    <FolderOpen size={16} /> فتح مجلد الدرايف
                </a>
            </div>

            {tab === 'missing' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="p-3 text-right">الفاتورة</th>
                                <th className="p-3 text-right">التاريخ</th>
                                <th className="p-3 text-right">المورد</th>
                                <th className="p-3 text-center">المبلغ</th>
                                <th className="p-3 text-center">ربط</th>
                            </tr>
                        </thead>
                        <tbody>
                            {missing.map(m => (
                                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-bold text-brand-900">{m.no}</td>
                                    <td className="p-3 text-slate-500">{m.date}</td>
                                    <td className="p-3">{m.supplier}</td>
                                    <td className="p-3 text-center font-bold">{fmt(m.total)}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => setForm({ purchase_id: m.id, no: m.no, supplier: m.supplier })}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-900 text-white text-xs font-bold hover:bg-brand-800">
                                            <Plus size={14} /> إضافة مستند
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!missing.length && (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">
                                    <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
                                    لا توجد فواتير بلا مستندات
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'linked' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="p-3 text-right">الفاتورة</th>
                                <th className="p-3 text-right">المورد</th>
                                <th className="p-3 text-right">المستند</th>
                                <th className="p-3 text-center">النوع</th>
                                <th className="p-3 text-center">المصدر</th>
                                <th className="p-3 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {linked.map(d => (
                                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-bold text-brand-900">{d.invoice_no || d.mirror_no}</td>
                                    <td className="p-3 text-slate-600">{d.supplier}</td>
                                    <td className="p-3">
                                        <a href={d.drive_url || driveSearch(d.file_name)} target="_blank" rel="noreferrer"
                                            className="text-brand-700 hover:text-gold-600 font-medium inline-flex items-center gap-1">
                                            <Link2 size={14} /> {d.file_name}
                                        </a>
                                        {d.note && <div className="text-[11px] text-slate-400 mt-0.5">{d.note}</div>}
                                    </td>
                                    <td className="p-3 text-center text-xs">{TYPES[d.doc_type] || d.doc_type}</td>
                                    <td className="p-3 text-center text-xs text-slate-500">
                                        {d.source === 'recovered' ? 'مسترجع' : 'يدوي'}
                                        {d.confidence ? ' · ' + d.confidence : ''}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => delDoc(d.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                            {!linked.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد مستندات مربوطة بعد</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'pending' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div>
                            <div className="text-xs font-bold text-amber-800">مدفوع بانتظار فاتورة المورد</div>
                            <div className="text-[11px] text-amber-700 mt-0.5">التزامات سُدّدت ولم تصل فواتيرها بعد — لا تظهر في دفترة</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-black text-amber-900">{fmt(pendTotal)}</div>
                            <button onClick={() => setPForm({ status: 'awaiting_invoice' })}
                                className="px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold">+ التزام</button>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="p-3 text-right">المورد</th>
                                    <th className="p-3 text-right">الموضوع</th>
                                    <th className="p-3 text-center">تاريخ السداد</th>
                                    <th className="p-3 text-center">المدفوع</th>
                                    <th className="p-3 text-center">إجمالي الالتزام</th>
                                    <th className="p-3 text-center">الحالة</th>
                                    <th className="p-3 text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pend.map(x => (
                                    <tr key={x.id} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-bold text-brand-900">{x.supplier}</td>
                                        <td className="p-3 text-slate-600">{x.subject || '—'}
                                            {x.note && <div className="text-[11px] text-slate-400">{x.note}</div>}</td>
                                        <td className="p-3 text-center text-slate-500">{x.paid_date || '—'}</td>
                                        <td className="p-3 text-center font-bold">{fmt(x.paid)}</td>
                                        <td className="p-3 text-center">{fmt(x.amount)}</td>
                                        <td className="p-3 text-center">
                                            <span className={'px-2 py-1 rounded-lg text-[11px] font-bold ' + (x.status === 'invoiced' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                                                {x.status === 'invoiced' ? 'وصلت الفاتورة' : 'ناقص فاتورة'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center whitespace-nowrap">
                                            <button onClick={() => setPForm(x)} className="text-brand-700 text-xs font-bold ml-2">تعديل</button>
                                            <button onClick={() => delPend(x.id)} className="text-red-500"><Trash2 size={15} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {!pend.length && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد التزامات مسجّلة</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pForm && <PendForm item={pForm} onCancel={() => setPForm(null)} onSave={savePend} />}
            {form && <LinkForm form={form} onCancel={() => setForm(null)} onSave={addDoc} onUpload={uploadDoc} />}
        </div>
    );
}

function Card({ label, value, tone }) {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        red: 'bg-red-50 text-red-700 border-red-100',
        brand: 'bg-slate-50 text-brand-800 border-slate-200',
        gold: 'bg-amber-50 text-amber-700 border-amber-100',
    };
    return (
        <div className={'rounded-2xl border p-4 ' + (tones[tone] || tones.brand)}>
            <div className="text-xs font-bold opacity-70">{label}</div>
            <div className="text-2xl font-black mt-1">{value}</div>
        </div>
    );
}

function LinkForm({ form, onCancel, onSave, onUpload }) {
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('invoice');
    const [note, setNote] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                <div>
                    <h3 className="font-black text-brand-900 text-lg">ربط مستند بالفاتورة {form.no}</h3>
                    <p className="text-xs text-slate-500 mt-1">{form.supplier}</p>
                </div>
                <label className="block border-2 border-dashed border-brand-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50">
                    <Upload size={22} className="mx-auto text-brand-700 mb-1" />
                    <div className="text-sm font-bold text-brand-900">{busy ? 'جارٍ الرفع...' : 'ارفع الملف مباشرة'}</div>
                    <div className="text-[11px] text-slate-500 mt-1">PDF أو صورة — يُحفظ على خادمنا ويصير رابطه جاهزاً</div>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={busy}
                        onChange={async e => {
                            const f = e.target.files && e.target.files[0];
                            if (!f) return;
                            setBusy(true);
                            await onUpload(f, { purchase_id: form.purchase_id, doc_type: type, note: note });
                            setBusy(false);
                        }} />
                </label>
                <div className="text-center text-[11px] text-slate-400">أو اربط ملفاً موجوداً في درايفك باسمه</div>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الملف كما في الدرايف"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    {Object.keys(TYPES).map(k => <option key={k} value={k}>{TYPES[k]}</option>)}
                </select>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة (اختياري)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">إلغاء</button>
                    <button disabled={!name.trim()}
                        onClick={() => onSave({ purchase_id: form.purchase_id, file_name: name.trim(), doc_type: type, note: note, drive_folder: DRIVE_FOLDER })}
                        className="px-4 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold disabled:opacity-40">حفظ الربط</button>
                </div>
            </div>
        </div>
    );
}

function PendForm({ item, onCancel, onSave }) {
    const [f, setF] = useState({
        id: item.id || 0,
        supplier: item.supplier || '',
        subject: item.subject || '',
        amount: item.amount || '',
        paid: item.paid || '',
        paid_date: item.paid_date || new Date().toISOString().slice(0, 10),
        project_id: item.project_id || '',
        status: item.status || 'awaiting_invoice',
        note: item.note || '',
    });
    const up = (k, v) => setF(p => ({ ...p, [k]: v }));
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3" onClick={e => e.stopPropagation()}>
                <h3 className="font-black text-brand-900 text-lg">التزام بانتظار فاتورة</h3>
                <input value={f.supplier} onChange={e => up('supplier', e.target.value)} placeholder="المورد"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <input value={f.subject} onChange={e => up('subject', e.target.value)} placeholder="الموضوع (مثال: الدفعة الأولى للمصعد)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={f.paid} onChange={e => up('paid', e.target.value)} placeholder="المبلغ المدفوع"
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                    <input type="number" value={f.amount} onChange={e => up('amount', e.target.value)} placeholder="إجمالي الالتزام"
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                    <input type="date" value={f.paid_date} onChange={e => up('paid_date', e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                    <select value={f.project_id} onChange={e => up('project_id', e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
                        <option value="">بلا مشروع</option>
                        <option value="3">سماك البوابة</option>
                        <option value="6">فيلا د. ليلى</option>
                        <option value="7">التطوير والإدارة</option>
                    </select>
                </div>
                <select value={f.status} onChange={e => up('status', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <option value="awaiting_invoice">ناقص فاتورة</option>
                    <option value="invoiced">وصلت الفاتورة</option>
                    <option value="cancelled">ملغى</option>
                </select>
                <input value={f.note} onChange={e => up('note', e.target.value)} placeholder="ملاحظة"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">إلغاء</button>
                    <button disabled={!f.supplier.trim()} onClick={() => onSave(f)}
                        className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold disabled:opacity-40">حفظ</button>
                </div>
            </div>
        </div>
    );
}
