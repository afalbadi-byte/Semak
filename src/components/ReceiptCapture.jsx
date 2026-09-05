import React, { useState } from 'react';
import { Camera, FolderOpen, Receipt, ScanLine, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import { API_URL, getAdminToken } from '../lib/api/client';

const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v)))
    ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHOD_AR = { transfer: 'تحويل', cash: 'نقدي', cheque: 'شيك', card: 'بطاقة', other: 'أخرى' };
const ISO = new RegExp('^' + String.fromCharCode(92) + 'd{4}-'
    + String.fromCharCode(92) + 'd{2}-' + String.fromCharCode(92) + 'd{2}$');

// ─── التقاط إيصال السداد وقراءته آلياً — مشترك بين شاشة الفاتورة ودفعة المورد ──
// file: { name, mime, dataUrl } | null      onFile: يُبلّغ الأب بالملف ليرفعه عند الحفظ
// onApply(fields): تُنقل قراءة المعالج للنموذج بعد مراجعة المستخدم
export default function ReceiptCapture({ file, onFile, onApply, expectedAmount = 0, onError }) {
    const [scan, setScan] = useState(null);
    const [busy, setBusy] = useState(false);

    const pick = e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { setScan(null); onFile({
            name: f.name || 'receipt.jpg',
            mime: f.type || 'image/jpeg',
            dataUrl: String(rd.result),
        }); };
        rd.readAsDataURL(f);
        e.target.value = '';
    };

    const run = async () => {
        if (!file) return;
        setBusy(true); setScan(null);
        try {
            const body = { image: file.dataUrl, mime: file.mime || 'image/jpeg' };
            if (Number(expectedAmount) > 0) body.invoice_total = Number(expectedAmount);
            const r = await fetch(`${API_URL}?action=receipt_scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify(body),
            }).then(x => x.json());
            if (!r.success) { onError && onError((r.message || 'تعذر قراءة الإيصال') + (r.detail ? ' — ' + r.detail : '')); return; }
            setScan(r.receipt || {});
        } catch { onError && onError('تعذر الاتصال بالمعالج'); }
        finally { setBusy(false); }
    };

    const apply = () => {
        if (!scan) return;
        const out = { details: scan };
        if (scan.amount) out.amount = String(scan.amount);
        if (scan.method) out.method = scan.method;
        if (scan.bank) out.bank = String(scan.bank);
        if (scan.reference) out.reference = String(scan.reference);
        if (scan.beneficiary) out.beneficiary = String(scan.beneficiary);
        if (scan.from_account) out.from_account = String(scan.from_account);
        if (ISO.test(String(scan.pay_date || ''))) out.pay_date = scan.pay_date;
        setScan(null);
        onApply(out);
    };

    if (!file) return (
        <div className="grid grid-cols-2 gap-2">
            <label className="min-h-[56px] rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-1.5 active:bg-white/5">
                <Camera size={15} className="text-slate-400" />
                <span className="text-[11px] text-slate-300 font-bold">تصوير الإيصال</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
            </label>
            <label className="min-h-[56px] rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-1.5 active:bg-white/5">
                <FolderOpen size={15} className="text-slate-400" />
                <span className="text-[11px] text-slate-300 font-bold">من الملفات</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} />
            </label>
        </div>
    );

    return (
        <div className="space-y-2">
            <div className="rounded-xl border border-white/15 p-2.5 flex items-center gap-2">
                <Receipt size={16} className="text-emerald-400 shrink-0" />
                <span className="text-xs font-bold truncate flex-1">{file.name}</span>
                <button type="button" onClick={() => { onFile(null); setScan(null); }}
                    className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-red-400"><X size={14} /></button>
            </div>

            {!scan && (
                <button onClick={run} disabled={busy}
                    className="w-full min-h-[48px] rounded-xl bg-[#1a365d] border border-[#c5a059]/50 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} className="text-[#c5a059]" />}
                    {busy ? 'يقرأ الإيصال...' : 'اقرأ الإيصال تلقائياً'}
                </button>
            )}

            {scan && (
                <div className="rounded-xl border border-[#c5a059]/50 bg-[#1a365d]/40 p-2.5 space-y-2">
                    <div className="text-xs font-black flex items-center gap-1.5">
                        <ScanLine size={14} className="text-[#c5a059]" /> قراءة الإيصال — راجعها
                    </div>
                    {scan.amount_mismatch && (
                        <div className="rounded-lg bg-amber-500/15 text-amber-300 p-2 text-[11px] font-bold flex items-start gap-1.5">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            مبلغ الإيصال {money(scan.amount)} يخالف المبلغ المُدخل {money(scan.invoice_total)}
                        </div>
                    )}
                    <div className="text-[11px] space-y-1 bg-black/20 rounded-lg p-2">
                        {[['المبلغ', money(scan.amount), 1], ['التاريخ', scan.pay_date || '—'],
                          ['الطريقة', METHOD_AR[scan.method] || '—'], ['البنك', scan.bank || '—'],
                          ['المستفيد', scan.beneficiary || '—'], ['من حساب', scan.from_account || '—'],
                          ['المرجع', scan.reference || '—']].map(([k, v, hi]) => (
                            <div key={k} className="flex justify-between gap-2">
                                <span className="text-slate-400 shrink-0">{k}</span>
                                <span className={'truncate text-left ' + (hi ? 'font-black tabular-nums text-[#c5a059]' : 'font-bold')}>{v}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setScan(null)} className="flex-1 min-h-[44px] rounded-lg bg-white/10 text-xs font-bold">تجاهل</button>
                        <button onClick={apply}
                            className="flex-[2] min-h-[44px] rounded-lg bg-[#c5a059] text-[#0b1220] text-xs font-black flex items-center justify-center gap-1.5">
                            <Check size={14} /> اعتمد بيانات الإيصال
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// رفع الملف الملتقط وإرجاع رابطه — يُستدعى لحظة الحفظ لا لحظة الالتقاط
export async function uploadReceipt(file) {
    if (!file) return '';
    const b64 = String(file.dataUrl).split(',')[1] || '';
    const r = await fetch(`${API_URL}?action=doc_upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ filename: file.name, data: b64 }),
    }).then(x => x.json());
    return r.success ? r.url : '';
}
