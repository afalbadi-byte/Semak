import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, ExternalLink, Layers, Download, Archive, Trash2, AlertTriangle, X, Pencil, Plus, Save, Wallet, CheckCircle2, Receipt } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import { SortBar } from '../../components/SortHeader';
import { useSort, smartFirstDir } from '../../lib/sortable';
import { useDepthGuard } from '../../lib/backstack';
import { openDoc, openDaftraDoc, openDaftraFile, openDocsZip } from '../../lib/docs';
import ReceiptCapture, { uploadReceipt } from '../../components/ReceiptCapture';

const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v)))
    ? String(v ?? '—') : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isNum = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const LABEL = { supplier: 'مورد', purchase: 'فاتورة شراء', product: 'صنف', project: 'مشروع', unit: 'وحدة' };

// ─── بطاقة كيان داخل التطبيق: كل دلالة فيها تفتح بطاقتها ────────────────────
export default function BuyEntity({ type, value, onOpen, onBack, depth = 0 }) {
    const [data, setData] = useState(null);
    const [err, setErr]   = useState('');
    const [del, setDel]   = useState(null);   // { blockers } أو { ask: true }
    const [edit, setEdit] = useState(null);   // نسخة قابلة للتحرير من الفاتورة
    const [pay,  setPay]  = useState(null);   // دفعة على مستوى المورد
    const [payRes, setPayRes] = useState(null);
    const [rcpt, setRcpt] = useState(null);   // إرفاق إيصال لدفعة قائمة
    const [busy, setBusy] = useState(false);
    const [tick, setTick] = useState(0);      // لإعادة الجلب بعد الإلغاء

    useDepthGuard((del ? 1 : 0) + (edit ? 1 : 0) + (pay ? 1 : 0) + (rcpt ? 1 : 0),
        () => { rcpt ? setRcpt(null)
              : pay ? (payRes ? (setPay(null), setPayRes(null)) : setPay(null))
              : edit ? setEdit(null) : setDel(null); });

    const post = (action, body) => fetch(`${API_URL}?action=${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(body),
    }).then(r => r.json());

    // الحذف يمر بفحص الموانع أولا: دفعات أو مستندات مرتبطة
    const tryDelete = async () => {
        setBusy(true);
        try {
            const r = await post('purchase_delete', { id: value });
            if (r.success) { onBack(); return; }
            if (r.blocked) setDel({ blockers: r.blockers, message: r.message });
            else setErr(r.message || 'تعذر الحذف');
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    const clearBlocker = async bk => {
        setBusy(true);
        try {
            const r = await post(bk.action, { id: bk.id });
            if (!r.success) { setErr(r.message || 'تعذر الإلغاء'); return; }
            setDel(d => ({ ...d, blockers: d.blockers.filter(x => !(x.kind === bk.kind && x.id === bk.id)) }));
            setTick(t => t + 1);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    // حفظ التعديل: البنود إن وُجدت هي المرجع، وإلا فالمبلغ المُدخل
    const saveEdit = async () => {
        setBusy(true); setErr('');
        try {
            const rows = (edit.items || []).filter(i => String(i.name || '').trim() && Number(i.qty) > 0);
            const body = {
                id: value, no: edit.no, date: edit.date, supplier: edit.supplier,
                note: edit.note || '', project_id: Number(edit.project_id) || 0,
                items: rows.map(i => ({ name: i.name, qty: Number(i.qty) || 0, price: Number(i.price) || 0 })),
            };
            if (!rows.length) body.subtotal = Number(edit.subtotal) || 0;
            if (edit.vat !== '' && edit.vat !== null && edit.vat !== undefined) body.vat = Number(edit.vat) || 0;
            if (!edit.paid_locked) body.paid = Number(edit.paid) || 0;
            const r = await post('purchase_update', body);
            if (!r.success) { setErr(r.message || 'تعذر الحفظ'); return; }
            if (r.overpaid > 0) alert('تنبيه: المسدد يزيد عن الإجمالي بمقدار ' + money(r.overpaid) + ' ريال');
            setEdit(null); setTick(t => t + 1);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    const today = () => new Date().toISOString().slice(0, 10);

    // إرفاق إيصال لدفعة مسجّلة — يرفع الملف ثم يربطه بالدفعة وبفاتورتها
    const saveReceipt = async () => {
        if (!rcpt?.file) return;
        setBusy(true); setErr('');
        try {
            const url = await uploadReceipt(rcpt.file);
            if (!url) { setErr('تعذر رفع الإيصال'); return; }
            const r = await post('pay_receipt_set', {
                src: rcpt.src, id: rcpt.id, receipt_url: url, receipt_details: rcpt.details || null,
            });
            if (!r.success) { setErr(r.message || 'تعذر الحفظ'); return; }
            setRcpt(null); setTick(t => t + 1);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    // دفعة للمورد: توزَّع على المستحق من الأقدم، أو تُقيَّد مقدَّمة بالكامل
    const savePay = async () => {
        setBusy(true); setErr('');
        try {
            let rurl = '';
            if (pay.receipt) {
                rurl = await uploadReceipt(pay.receipt);
                if (!rurl) setErr('تعذر رفع الإيصال — ستُحفظ الدفعة بدونه');
            }
            const r = await post('sup_pay_settle', {
                supplier: value, amount: Number(pay.amount) || 0, mode: pay.mode,
                method: pay.method, pay_date: pay.pay_date, reference: pay.reference || '',
                bank: pay.bank || '', beneficiary: pay.beneficiary || '',
                from_account: pay.from_account || '', note: pay.note || '',
                receipt_url: rurl, receipt_details: pay.details || null,
            });
            if (!r.success) { setErr(r.message || 'تعذر الحفظ'); return; }
            setPayRes(r); setTick(t => t + 1);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    const applyAdvance = async () => {
        setBusy(true); setErr('');
        try {
            const r = await post('sup_advance_apply', { supplier: value });
            if (!r.success) { setErr(r.message || 'تعذر التطبيق'); return; }
            setPayRes(r); setTick(t => t + 1);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(false); }
    };

    const editNet = (edit && (edit.items || []).some(i => Number(i.qty) > 0))
        ? (edit.items || []).reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)
        : Number(edit?.subtotal) || 0;
    const editVat = (edit && edit.vat !== '' && edit.vat !== null && edit.vat !== undefined)
        ? Number(edit.vat) || 0 : Math.round(editNet * 15) / 100;

    useEffect(() => {
        let live = true;
        setData(null); setErr('');
        fetch(`${API_URL}?action=entity&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`,
            { headers: auth() })
            .then(r => r.json())
            .then(r => { if (!live) return; r.success ? setData(r) : setErr(r.message || 'تعذر الجلب'); })
            .catch(() => live && setErr('تعذر الاتصال'));
        return () => { live = false; };
    }, [type, value, tick]);

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-400 min-h-[44px]">
                    <ArrowRight size={16} /> رجوع
                </button>
                {type === 'supplier' && data && data.balance && (
                    <button onClick={() => setPay({
                        mode: data.balance.outstanding > 0 ? 'settle' : 'advance',
                        amount: data.balance.net_due > 0 ? String(data.balance.net_due) : '',
                        method: 'transfer', pay_date: today(), reference: '', bank: '',
                        beneficiary: value, from_account: '', note: '',
                        receipt: null, details: null,
                    })} disabled={busy}
                        className="min-h-[44px] px-3 rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-bold flex items-center gap-1.5">
                        <Wallet size={14} /> دفعة للمورد
                    </button>
                )}
                {type === 'purchase' && data && data.edit && (
                    <button onClick={() => setEdit({ ...data.edit, items: (data.edit.items || []).map(i => ({ ...i })) })}
                        disabled={busy}
                        className="min-h-[44px] px-3 rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-bold flex items-center gap-1.5">
                        <Pencil size={14} /> تعديل
                    </button>
                )}
                {type === 'purchase' && data && data.origin === 'local' && (
                    <button onClick={() => setDel({ ask: true })} disabled={busy}
                        className="min-h-[44px] px-3 rounded-xl bg-red-500/15 text-red-300 text-[12px] font-bold flex items-center gap-1.5">
                        <Trash2 size={14} /> حذف الفاتورة
                    </button>
                )}
            </div>

            {err && <div className="rounded-xl bg-red-500/15 text-red-300 p-3 text-xs font-bold">{err}</div>}
            {!data && !err && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#c5a059]" /></div>}

            {rcpt && (
                <div className="fixed inset-0 bg-black/70 z-[86] flex items-end justify-center p-0 sm:p-4"
                    onClick={() => !busy && setRcpt(null)}>
                    <div dir="rtl" onClick={e => e.stopPropagation()}
                        className="bg-[#0f1e36] rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-[15px] flex items-center gap-2">
                                <Receipt size={16} className="text-[#c5a059]" /> إيصال الدفعة
                            </h3>
                            <button onClick={() => setRcpt(null)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-[12px] space-y-1">
                            <div className="flex justify-between"><span className="text-slate-400">المبلغ</span>
                                <span className="font-black tabular-nums text-[#c5a059]">{money(rcpt.amount)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">التاريخ</span>
                                <span className="font-bold">{rcpt.pay_date || '—'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">المصدر</span>
                                <span className="font-bold">{rcpt.source}</span></div>
                        </div>
                        <ReceiptCapture
                            file={rcpt.file}
                            expectedAmount={Number(rcpt.amount) || 0}
                            onFile={f2 => setRcpt(v => ({ ...v, file: f2, details: f2 ? v.details : null }))}
                            onError={m => setErr(m)}
                            onApply={f2 => setRcpt(v => ({ ...v, details: f2.details }))} />
                        {rcpt.details && (
                            <p className="text-[11px] text-emerald-300 font-bold">قُرئ الإيصال — بياناته ستُحفظ مع الدفعة</p>
                        )}
                        <button onClick={saveReceipt} disabled={busy || !rcpt.file}
                            className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1628] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} احفظ الإيصال
                        </button>
                    </div>
                </div>
            )}

            {pay && (
                <div className="fixed inset-0 bg-black/70 z-[85] flex items-end justify-center p-0 sm:p-4"
                    onClick={() => !busy && (setPay(null), setPayRes(null))}>
                    <div dir="rtl" onClick={e => e.stopPropagation()}
                        className="bg-[#0f1e36] rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-[15px] flex items-center gap-2">
                                <Wallet size={16} className="text-[#c5a059]" /> دفعة للمورد
                            </h3>
                            <button onClick={() => { setPay(null); setPayRes(null); }}
                                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        {payRes ? (
                            <>
                                <div className="rounded-xl bg-emerald-500/15 text-emerald-300 p-3 text-[13px] font-bold flex items-start gap-2">
                                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {payRes.message}
                                </div>
                                {!!(payRes.allocated || payRes.applied || []).length && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] font-bold text-slate-400">التوزيع على الفواتير</div>
                                        {(payRes.allocated || payRes.applied).map((a, i) => (
                                            <div key={i} className="rounded-xl bg-black/25 border border-white/10 p-2.5 flex items-center gap-2 text-[12px]">
                                                <button onClick={() => { setPay(null); setPayRes(null); onOpen('purchase', a.id); }}
                                                    className="font-bold text-[#c5a059] underline decoration-dotted underline-offset-4">
                                                    فاتورة {a.no}
                                                </button>
                                                <span className="mr-auto font-black tabular-nums">{money(a.amount)}</span>
                                                {a.remaining > 0 && <span className="text-[10px] text-amber-300">بقي {money(a.remaining)}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {payRes.advance > 0 && (
                                    <p className="text-[12px] text-amber-300 font-bold">
                                        رصيد مقدَّم للمورد: {money(payRes.advance)} — يُطبَّق على أول فاتورة قادمة بزر «تطبيق الرصيد المقدَّم».
                                    </p>
                                )}
                                <button onClick={() => { setPay(null); setPayRes(null); }}
                                    className="w-full min-h-[52px] rounded-2xl bg-white/10 text-sm font-black">تم</button>
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-[12px] space-y-1">
                                    <div className="flex justify-between"><span className="text-slate-400">المستحق على الفواتير</span>
                                        <span className="font-black tabular-nums">{money(data?.balance?.outstanding)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">رصيد مقدَّم</span>
                                        <span className="font-black tabular-nums">{money(data?.balance?.advance)}</span></div>
                                    <div className="flex justify-between text-[#c5a059]"><span>صافي المستحق</span>
                                        <span className="font-black tabular-nums">{money(data?.balance?.net_due)}</span></div>
                                </div>

                                {data?.balance?.advance > 0 && data?.balance?.outstanding > 0 && (
                                    <button onClick={applyAdvance} disabled={busy}
                                        className="w-full min-h-[48px] rounded-2xl bg-emerald-500/15 text-emerald-300 text-[13px] font-black disabled:opacity-60">
                                        تطبيق الرصيد المقدَّم على المستحق
                                    </button>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    {[['settle', 'إقفال حساب'], ['advance', 'دفعة مقدمة']].map(([k, t]) => (
                                        <button key={k} onClick={() => setPay({ ...pay, mode: k })}
                                            className={'min-h-[48px] rounded-2xl text-[13px] font-black border ' +
                                                (pay.mode === k ? 'bg-[#c5a059] text-[#0b1628] border-[#c5a059]'
                                                                : 'bg-white/5 border-white/10 text-slate-300')}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    {pay.mode === 'settle'
                                        ? 'تُوزَّع الدفعة على الفواتير المستحقة من الأقدم للأحدث، وأي فائض يُقيَّد رصيداً مقدَّماً.'
                                        : 'يُقيَّد كامل المبلغ رصيداً مقدَّماً للمورد بلا ربط بفاتورة، ويُطبَّق لاحقاً.'}
                                </p>

                                <div className="space-y-2 pt-1">
                                    <div className="text-[11px] font-bold text-slate-400">إيصال السداد</div>
                                    <ReceiptCapture
                                        file={pay.receipt}
                                        expectedAmount={Number(pay.amount) || 0}
                                        onFile={f => setPay(v => ({ ...v, receipt: f, details: f ? v.details : null }))}
                                        onError={m => setErr(m)}
                                        onApply={f => setPay(v => ({
                                            ...v,
                                            amount:       f.amount       ?? v.amount,
                                            method:       f.method       ?? v.method,
                                            pay_date:     f.pay_date     ?? v.pay_date,
                                            bank:         f.bank         ?? v.bank,
                                            reference:    f.reference    ?? v.reference,
                                            beneficiary:  f.beneficiary  ?? v.beneficiary,
                                            from_account: f.from_account ?? v.from_account,
                                            details:      f.details,
                                        }))} />
                                    {pay.details && (
                                        <p className="text-[11px] text-emerald-300 font-bold">
                                            نُقلت بيانات الإيصال — راجعها ثم سجّل الدفعة
                                        </p>
                                    )}
                                </div>

                                <Field label="المبلغ">
                                    <input type="number" inputMode="decimal" value={pay.amount}
                                        onChange={e => setPay({ ...pay, amount: e.target.value })} className={INP} />
                                </Field>
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="التاريخ">
                                        <input type="date" value={pay.pay_date}
                                            onChange={e => setPay({ ...pay, pay_date: e.target.value })} className={INP} />
                                    </Field>
                                    <Field label="الطريقة">
                                        <select value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })} className={INP}>
                                            <option value="transfer">تحويل</option>
                                            <option value="cash">نقدي</option>
                                            <option value="cheque">شيك</option>
                                            <option value="card">بطاقة</option>
                                            <option value="other">أخرى</option>
                                        </select>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="البنك">
                                        <input value={pay.bank} onChange={e => setPay({ ...pay, bank: e.target.value })} className={INP} />
                                    </Field>
                                    <Field label="المرجع">
                                        <input value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} className={INP} />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="المستفيد">
                                        <input value={pay.beneficiary} onChange={e => setPay({ ...pay, beneficiary: e.target.value })} className={INP} />
                                    </Field>
                                    <Field label="من حساب">
                                        <input value={pay.from_account} onChange={e => setPay({ ...pay, from_account: e.target.value })} className={INP} />
                                    </Field>
                                </div>
                                <Field label="ملاحظة">
                                    <input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} className={INP} />
                                </Field>

                                <button onClick={savePay} disabled={busy || !(Number(pay.amount) > 0)}
                                    className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1628] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40">
                                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} تسجيل الدفعة
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {edit && (
                <div className="fixed inset-0 bg-black/70 z-[85] flex items-end justify-center p-0 sm:p-4"
                    onClick={() => !busy && setEdit(null)}>
                    <div dir="rtl" onClick={e => e.stopPropagation()}
                        className="bg-[#0f1e36] rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-[15px] flex items-center gap-2">
                                <Pencil size={16} className="text-[#c5a059]" /> تعديل الفاتورة
                            </h3>
                            <button onClick={() => setEdit(null)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        <Field label="المورد">
                            <input value={edit.supplier} onChange={e => setEdit({ ...edit, supplier: e.target.value })} className={INP} />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="رقم الفاتورة">
                                <input value={edit.no} onChange={e => setEdit({ ...edit, no: e.target.value })} className={INP} />
                            </Field>
                            <Field label="التاريخ">
                                <input type="date" value={edit.date || ''} onChange={e => setEdit({ ...edit, date: e.target.value })} className={INP} />
                            </Field>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[12px] font-black text-slate-300">البنود</span>
                            <button onClick={() => setEdit({ ...edit, items: [...(edit.items || []), { name: '', qty: 1, price: 0 }] })}
                                className="h-9 px-2.5 rounded-lg bg-white/10 text-[11px] font-bold flex items-center gap-1">
                                <Plus size={13} /> بند
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(edit.items || []).map((it, i) => (
                                <div key={i} className="rounded-xl bg-black/25 border border-white/10 p-2 space-y-2">
                                    <div className="flex gap-2">
                                        <input value={it.name || ''} placeholder="اسم الصنف"
                                            onChange={e => setEdit({ ...edit, items: edit.items.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}
                                            className={INP + ' flex-1 min-w-0'} />
                                        <button onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== i) })}
                                            className="w-[52px] h-[52px] shrink-0 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" inputMode="decimal" value={it.qty} placeholder="الكمية"
                                            onChange={e => setEdit({ ...edit, items: edit.items.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })}
                                            className={INP + ' min-w-0'} />
                                        <input type="number" inputMode="decimal" value={it.price} placeholder="سعر الوحدة"
                                            onChange={e => setEdit({ ...edit, items: edit.items.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })}
                                            className={INP + ' min-w-0'} />
                                    </div>
                                </div>
                            ))}
                            {!(edit.items || []).length && (
                                <Field label="المبلغ قبل الضريبة">
                                    <input type="number" inputMode="decimal" value={edit.subtotal}
                                        onChange={e => setEdit({ ...edit, subtotal: e.target.value })} className={INP} />
                                </Field>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Field label="الضريبة">
                                <input type="number" inputMode="decimal" value={edit.vat}
                                    onChange={e => setEdit({ ...edit, vat: e.target.value })} className={INP} />
                            </Field>
                            <Field label={edit.paid_locked ? 'المسدد (من الدفعات)' : 'المسدد'}>
                                <input type="number" inputMode="decimal" value={edit.paid} disabled={!!edit.paid_locked}
                                    onChange={e => setEdit({ ...edit, paid: e.target.value })}
                                    className={INP + (edit.paid_locked ? ' opacity-50' : '')} />
                            </Field>
                        </div>
                        <Field label="ملاحظة">
                            <input value={edit.note || ''} onChange={e => setEdit({ ...edit, note: e.target.value })} className={INP} />
                        </Field>

                        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-[12px] space-y-1">
                            <div className="flex justify-between"><span className="text-slate-400">قبل الضريبة</span>
                                <span className="font-black tabular-nums">{money(editNet)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">الضريبة</span>
                                <span className="font-black tabular-nums">{money(editVat)}</span></div>
                            <div className="flex justify-between text-[#c5a059]"><span>الإجمالي</span>
                                <span className="font-black tabular-nums">{money(editNet + editVat)}</span></div>
                        </div>

                        <button onClick={saveEdit} disabled={busy}
                            className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1628] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ التعديل
                        </button>
                    </div>
                </div>
            )}

            {del && (
                <div className="fixed inset-0 bg-black/60 z-[80] flex items-end justify-center p-4" onClick={() => setDel(null)}>
                    <div dir="rtl" className="bg-[#0f1e36] rounded-3xl w-full max-w-sm p-5 space-y-3"
                        onClick={e => e.stopPropagation()}
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-[15px] flex items-center gap-2">
                                <AlertTriangle size={17} className="text-red-400" /> حذف الفاتورة
                            </h3>
                            <button onClick={() => setDel(null)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        {del.ask && (
                            <>
                                <p className="text-[13px] text-slate-300 leading-relaxed">
                                    سيُحذف سجل الفاتورة وبنودها وأثرها في متابعة الأسعار وتكلفة المشروع. لا رجعة.
                                </p>
                                <button onClick={tryDelete} disabled={busy}
                                    className="w-full min-h-[48px] rounded-2xl bg-red-500 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} احذف
                                </button>
                            </>
                        )}

                        {del.blockers && (
                            <>
                                <p className="text-[13px] text-amber-300 font-bold leading-relaxed">{del.message}</p>
                                <p className="text-[12px] text-slate-400">ألغِ كل عنصر أولا ثم أعد الحذف:</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {del.blockers.map(bk => (
                                        <div key={bk.kind + bk.id} className="rounded-xl bg-white/5 border border-white/10 p-2.5 flex items-center gap-2">
                                            <span className="text-[12px] font-bold flex-1 truncate">{bk.label}</span>
                                            <button onClick={() => clearBlocker(bk)} disabled={busy}
                                                className="px-2.5 h-9 rounded-lg bg-red-500/15 text-red-300 text-[11px] font-bold shrink-0">
                                                إلغاء
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={tryDelete} disabled={busy || del.blockers.length > 0}
                                    className="w-full min-h-[48px] rounded-2xl bg-red-500 text-white text-sm font-black disabled:opacity-40">
                                    {del.blockers.length ? 'بقي ' + del.blockers.length + ' عنصرا' : 'احذف الفاتورة'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {data && (
                <>
                    <div>
                        <div className="text-[11px] font-bold text-[#c5a059]">{LABEL[data.type] || data.subtitle}</div>
                        <h2 className="text-[20px] font-black leading-tight">{data.title}</h2>
                        {!!(data.links || []).length && (
                            <div className="flex gap-2 flex-wrap mt-2">
                                {data.links.map((l, i) => (
                                    <button key={i} onClick={() => onOpen(l.type, l.value)}
                                        className="text-[11px] font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!!(data.stats || []).length && (
                        <div className="grid grid-cols-2 gap-2">
                            {data.stats.map((s, i) => (
                                <div key={i} className="rounded-xl bg-white/[0.06] border border-white/10 p-2.5">
                                    <div className="text-[11px] text-slate-400">{s.label}</div>
                                    <div className="text-[15px] font-black mt-0.5 tabular-nums">
                                        {s.money ? money(s.value) : String(s.value ?? '—')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(data.sections || []).map((sec, si) => (
                        <Section key={si} onOpen={onOpen}
                            sec={sec.title === 'الدفعات'
                                ? { ...sec, attach: true, onAttach: r => { setErr(''); setRcpt({ ...r, file: null, details: null }); } }
                                : sec} />
                    ))}
                </>
            )}
        </div>
    );
}

const INP = 'w-full h-[52px] rounded-xl bg-black/30 border border-white/10 px-3 text-[13px] font-bold outline-none focus:border-[#c5a059]';

function Field({ label, children }) {
    return (
        <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-400">{label}</span>
            {children}
        </label>
    );
}

// صفوف القسم كبطاقات لا كجدول — أنسب لعرض الجوال
function Section({ sec, onOpen }) {
    const [open, setOpen] = useState(true);
    const [showSort, setShowSort] = useState(false);
    const raw  = sec.rows || [];
    const cols = sec.cols || [];
    const { sorted: rows, key: sortKey, dir: sortDir, toggle, setDir } = useSort(raw);
    const links = [sec.link, sec.link2].filter(Boolean);
    const head = cols[0];
    const rest = cols.slice(1);

    return (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 p-3 min-h-[48px]">
                <Layers size={15} className="text-[#c5a059]" />
                <span className="font-black text-[13px]">{sec.title}</span>
                <span className="text-[11px] text-slate-500 mr-auto">{rows.length}</span>
            </button>
            {sec.download && rows.some(r => Number(r.downloadable) === 1) && (
                <button onClick={() => openDocsZip(sec.purchase_id).catch(e => alert(e.message))}
                    className="mx-3 mb-2 h-[44px] rounded-xl bg-white/10 flex items-center justify-center gap-1.5 text-[12px] font-bold w-[calc(100%-1.5rem)]">
                    <Archive size={14} className="text-[#c5a059]" /> تنزيل كل المستندات
                </button>
            )}

            {open && (
                <div className="px-3 pb-3 space-y-2">
                    {raw.length > 1 && (
                        <>
                            <button onClick={() => setShowSort(v => !v)}
                                className="text-[11px] font-bold text-slate-400 min-h-[36px]">
                                {showSort ? 'إخفاء الترتيب' : 'ترتيب'}
                            </button>
                            {showSort && (
                                <SortBar cols={cols} sortKey={sortKey} dir={sortDir}
                                    onSort={k => toggle(k, smartFirstDir(raw, k))}
                                    onDir={() => setDir(d => (d === 'asc' ? 'desc' : 'asc'))} />
                            )}
                        </>
                    )}
                    {!raw.length && <p className="text-[12px] text-slate-500 text-center py-3">لا بيانات</p>}
                    {rows.map((r, i) => {
                        const hl = links.find(l => l.col === head?.k);
                        const val = head ? r[head.k] : '';
                        return (
                            <div key={i} className="rounded-xl bg-black/25 border border-white/5 p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    {hl
                                        ? <button onClick={() => onOpen(hl.type, r[hl.value_col])}
                                            className="text-[13px] font-bold text-[#c5a059] text-right underline decoration-dotted underline-offset-4">
                                            {String(val ?? '—')}
                                          </button>
                                        : <span className="text-[13px] font-bold">{String(val ?? '—')}</span>}
                                    <span className="flex items-center gap-2 shrink-0">
                                        {sec.download && Number(r.id) > 0 && Number(r.downloadable) === 1 && (
                                            <>
                                                <button onClick={() => openDoc(r.id, true).catch(e => alert(e.message))}
                                                    className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                                                    <ExternalLink size={12} /> استعراض
                                                </button>
                                                <button onClick={() => openDoc(r.id, false).catch(e => alert(e.message))}
                                                    className="text-[11px] font-bold text-[#c5a059] flex items-center gap-1">
                                                    <Download size={13} /> تنزيل
                                                </button>
                                            </>
                                        )}
                                        {sec.download && Number(r.downloadable) !== 1 && Number(r.daftra) === 1 && (
                                            <>
                                                <button onClick={() => (Number(r.id) > 0 ? openDaftraDoc(r.id, true)
                                                                                        : openDaftraFile(r.file_id, true)).catch(e => alert(e.message))}
                                                    className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                                                    <ExternalLink size={12} /> استعراض
                                                </button>
                                                <button onClick={() => (Number(r.id) > 0 ? openDaftraDoc(r.id, false)
                                                                                        : openDaftraFile(r.file_id, false)).catch(e => alert(e.message))}
                                                    className="text-[11px] font-bold text-[#c5a059] flex items-center gap-1">
                                                    <Download size={13} /> تنزيل
                                                </button>
                                            </>
                                        )}
                                        {sec.download && Number(r.downloadable) !== 1 && Number(r.daftra) !== 1 && (
                                            <span className="text-[10px] text-slate-500">في أرشيف الدرايف</span>
                                        )}
                                        {sec.url_col && r[sec.url_col] && !sec.download && (
                                            <a href={r[sec.url_col]} target="_blank" rel="noopener noreferrer"
                                                className="text-[11px] text-sky-300 flex items-center gap-1">
                                                <ExternalLink size={12} /> فتح
                                            </a>
                                        )}
                                        {sec.attach && !r[sec.url_col] && r.src && (
                                            <button onClick={() => sec.onAttach(r)}
                                                className="text-[11px] font-bold text-[#c5a059] flex items-center gap-1">
                                                <Receipt size={13} /> أرفق إيصالاً
                                            </button>
                                        )}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
                                    {rest.filter(c => c.k !== sec.url_col).map(c => {
                                        const lk = links.find(l => l.col === c.k);
                                        const v = r[c.k];
                                        if (v === null || v === undefined || v === '') return null;
                                        return (
                                            <div key={c.k} className="flex justify-between gap-2 text-[11px]">
                                                <span className="text-slate-500 shrink-0">{c.t}</span>
                                                {lk
                                                    ? <button onClick={() => onOpen(lk.type, r[lk.value_col])}
                                                        className="font-bold text-[#c5a059] truncate text-left">{String(v)}</button>
                                                    : <span className={'font-bold truncate text-left ' + (isNum(v) ? 'tabular-nums' : '')}>
                                                        {isNum(v) && String(v).includes('.') ? money(v) : String(v)}
                                                      </span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
