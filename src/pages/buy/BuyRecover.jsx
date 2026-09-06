import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, ScanLine, Loader2, Check, Trash2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v)))
    ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VERDICT = {
    'مؤكد':     'bg-emerald-500/15 text-emerald-300',
    'مرجّح':    'bg-teal-500/15 text-teal-300',
    'خطأ في القيد': 'bg-rose-500/15 text-rose-300',
    'يحتاج مراجعة': 'bg-fuchsia-500/15 text-fuchsia-300',
    'مرشّح':    'bg-amber-500/15 text-amber-300',
    'متعدد':    'bg-sky-500/15 text-sky-300',
    'بلا دليل': 'bg-white/10 text-slate-400',
};

// ─── استرجاع المرفقات المفقودة: رفع، قراءة بصرية، ثم اعتماد بشري لكل ملف ────
export default function BuyRecover({ onClose }) {
    const [busy, setBusy]   = useState('');
    const [prog, setProg]   = useState(null);
    const [rows, setRows]   = useState([]);
    const [sum, setSum]     = useState({});
    const [filter, setFilter] = useState('');
    const [err, setErr]     = useState('');

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}?action=recover_list&status=pending`
                + (filter ? `&verdict=${encodeURIComponent(filter)}` : ''), { headers: auth() })
                .then(x => x.json());
            if (r.success) { setRows(r.data || []); setSum(r.summary || {}); }
        } catch { /* الشبكة — تُعالج عند الرفع */ }
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    // الرفع: ملفاً ملفاً كي لا ينقطع على الجوال
    const pick = async e => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        setBusy('upload'); setErr('');
        let ok = 0, dup = 0;
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            setProg({ done: i, total: files.length, name: f.name });
            try {
                const b64 = await new Promise(res => {
                    const rd = new FileReader();
                    rd.onload = () => res(String(rd.result).split(',')[1] || '');
                    rd.readAsDataURL(f);
                });
                const r = await fetch(`${API_URL}?action=recover_upload`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                    body: JSON.stringify({ filename: f.name, data: b64 }),
                }).then(x => x.json());
                if (r.success && r.duplicate) dup++; else if (r.success) ok++;
            } catch { /* نكمل البقية */ }
        }
        setProg(null); setBusy('');
        setErr(`رُفع ${ok} ملفا${dup ? ` · ${dup} مكرر تجاوزناه` : ''} — اضغط «اقرأ الملفات»`);
        load();
    };

    const scan = async (rescan = false) => {
        setBusy('scan'); setErr('');
        try {
            for (let i = 0; i < 200; i++) {
                const r = await fetch(`${API_URL}?action=recover_scan&limit=3${rescan ? '&rescan=1' : ''}`,
                    { headers: auth(), cache: 'no-store' }).then(x => x.json());
                if (!r.success) { setErr(r.message || 'تعذر القراءة'); break; }
                setProg({ done: r.scanned, total: r.remaining + r.scanned, msg: r.message });
                await load();
                if (r.remaining === 0) break;
                if (!r.scanned) { setErr(r.detail || 'توقفت القراءة'); break; }
            }
        } finally { setProg(null); setBusy(''); }
    };

    // إعادة المطابقة تحسب من البيانات المستخرجة سلفاً — بلا قراءة بصرية ولا تكلفة
    const rematch = async () => {
        setBusy('rematch'); setErr('');
        try {
            const r = await fetch(`${API_URL}?action=recover_rematch`,
                { headers: auth(), cache: 'no-store' }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذرت المطابقة'); return; }
            setErr(r.message + ' — ' + Object.entries(r.verdicts || {})
                .map(([k, v]) => k + ': ' + v).join(' · '));
            await load();
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(''); }
    };

    const [plan, setPlan] = useState(null);      // معاينة الربط الجماعي قبل الكتابة
    const [batch, setBatch] = useState(null);    // رقم آخر دفعة، للتراجع

    const preview = async () => {
        setErr(''); setBusy('plan');
        try {
            const r = await fetch(`${API_URL}?action=recover_link_safe`, { headers: auth() }).then(x => x.json());
            if (!r.success) setErr(r.message || 'تعذرت المعاينة'); else setPlan(r);
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(''); }
    };

    const applyLink = async () => {
        setErr(''); setBusy('link');
        try {
            const r = await fetch(`${API_URL}?action=recover_link_safe&apply=1`, { headers: auth() }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذر الربط'); return; }
            setBatch(r.batch); setPlan(null);
            await load();
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(''); }
    };

    const undo = async () => {
        if (!batch) return;
        setErr(''); setBusy('undo');
        try {
            const r = await fetch(`${API_URL}?action=recover_link_undo&batch=${encodeURIComponent(batch)}`,
                { headers: auth() }).then(x => x.json());
            if (!r.success) setErr(r.message || 'تعذر التراجع'); else { setBatch(null); await load(); }
        } catch { setErr('تعذر الاتصال'); }
        finally { setBusy(''); }
    };

    const decide = async (id, invoice_id, action) => {
        setErr('');
        try {
            const r = await fetch(`${API_URL}?action=recover_decide`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ id, invoice_id, action }),
            }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذر الحفظ'); return; }
            setRows(v => v.filter(x => Number(x.id) !== Number(id)));
        } catch { setErr('تعذر الاتصال'); }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-[#0b1628] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 bg-[#0b1628]/95 backdrop-blur border-b border-white/10 p-4 flex items-center gap-2">
                <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <X size={17} />
                </button>
                <h2 className="font-black text-[15px]">استرجاع المرفقات</h2>
            </div>

            <div className="p-4 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                    يُقرأ كل ملف بصرياً، ولا يُقترح ربطه بفاتورة إلا حين يتفق الإجمالي واسم المورد والتاريخ معاً.
                    ولا يُربط شيء إلا بتأكيدك أنت.
                </p>

                <label className="w-full min-h-[52px] rounded-2xl border border-dashed border-white/20 flex items-center justify-center gap-2 active:bg-white/5">
                    <Upload size={16} className="text-[#c5a059]" />
                    <span className="text-[13px] font-black">اختر ملفات الاسترجاع</span>
                    <input type="file" multiple accept=".pdf,image/*" className="hidden"
                        onChange={pick} disabled={!!busy} />
                </label>

                {/* الربط الجماعي: لا يكتب شيئاً قبل أن تُعرض القائمة ويُضغط التنفيذ */}
                {!plan && !batch && (
                    <button onClick={preview} disabled={!!busy}
                        className="w-full min-h-[46px] rounded-xl bg-emerald-500/15 text-emerald-300 text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        اربط المطابق تماماً (نفس اليوم · اسم 100%)
                    </button>
                )}

                {plan && (
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3 space-y-2">
                        <div className="text-[13px] font-black text-emerald-200">
                            {plan.would_link} مستنداً مطابقاً تماماً
                            {plan.skipped > 0 && <span className="text-slate-400 font-bold"> · استُبعد {plan.skipped}</span>}
                        </div>
                        <div className="max-h-[220px] overflow-y-auto space-y-1">
                            {(plan.rows || []).map((x, i) => (
                                <div key={i} className="text-[11px] text-slate-300 flex gap-2">
                                    <span className="truncate flex-1">{x.file}</span>
                                    <span className="shrink-0 text-emerald-300">فاتورة {x.inv}</span>
                                </div>
                            ))}
                        </div>
                        {Object.keys(plan.tally || {}).length > 0 && (
                            <div className="rounded-xl bg-black/25 p-2 space-y-0.5">
                                {Object.entries(plan.tally).map(([k, n]) => (
                                    <div key={k} className="text-[11px] flex justify-between gap-2">
                                        <span className="text-slate-300">{k}</span>
                                        <span className="text-slate-500 tabular-nums shrink-0">{n}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(plan.skip || []).length > 0 && (
                            // لا يمرّ شيء؟ السبب هو كل الخبر، فلا يُطوى
                            <details className="text-[11px] text-slate-400" open={!plan.would_link}>
                                <summary className="cursor-pointer">تفصيل كل مستند</summary>
                                <div className="pt-1 space-y-0.5">
                                    {plan.skip.map((x, i) => (
                                        <div key={i}>{x.file} — {x.why}</div>
                                    ))}
                                </div>
                            </details>
                        )}
                        <div className="flex gap-2">
                            <button onClick={applyLink} disabled={!!busy || !plan.would_link}
                                className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 text-[#04140c] text-[12px] font-black disabled:opacity-50">
                                {busy === 'link' ? '…' : `نفّذ الربط (${plan.would_link})`}
                            </button>
                            <button onClick={() => setPlan(null)} disabled={!!busy}
                                className="px-4 min-h-[44px] rounded-xl bg-white/10 text-[12px] font-bold">إلغاء</button>
                        </div>
                    </div>
                )}

                {batch && (
                    <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3 space-y-2">
                        <div className="text-[12px] text-emerald-300 font-bold">تم الربط · دفعة {batch}</div>
                        <button onClick={undo} disabled={!!busy}
                            className="w-full min-h-[40px] rounded-xl bg-rose-500/15 text-rose-300 text-[12px] font-black">
                            {busy === 'undo' ? '…' : 'تراجع عن هذه الدفعة'}
                        </button>
                    </div>
                )}

                <button onClick={rematch} disabled={!!busy}
                    className="w-full min-h-[44px] rounded-xl bg-[#c5a059]/15 text-[#c5a059] text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy === 'rematch' ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                    أعد المطابقة (بلا قراءة — لحظي)
                </button>

                <button onClick={() => scan(true)} disabled={!!busy}
                    className="w-full min-h-[44px] rounded-xl bg-white/10 text-slate-200 text-[12px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    <ScanLine size={14} /> أعد قراءة البنكية وما بلا دليل
                </button>

                <button onClick={scan} disabled={!!busy}
                    className="w-full min-h-[48px] rounded-2xl bg-[#c5a059]/15 text-[#c5a059] text-[13px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy === 'scan' ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
                    {busy === 'scan' ? 'يقرأ الملفات...' : 'اقرأ الملفات'}
                </button>

                {prog && (
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-2.5 text-[11px] font-bold">
                        {prog.msg || `${prog.done} من ${prog.total}`}
                        {prog.name && <span className="text-slate-400"> · {prog.name}</span>}
                    </div>
                )}
                {err && <div className="rounded-xl bg-white/10 p-2.5 text-[11px] font-bold text-slate-200">{err}</div>}

                {!!Object.keys(sum).length && (
                    <div className="flex gap-2 flex-wrap">
                        {[['', 'الكل'], ...Object.keys(sum).map(k => [k, k])].map(([k, t]) => (
                            <button key={k} onClick={() => setFilter(k)}
                                className={'h-9 px-3 rounded-xl text-[11px] font-bold border ' +
                                    (filter === k ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/10 text-slate-400')}>
                                {t}{k && sum[k] ? ` (${sum[k]})` : ''}
                            </button>
                        ))}
                    </div>
                )}

                <div className="space-y-2">
                    {rows.map(r => (
                        <div key={r.id} className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className={'text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ' +
                                    (VERDICT[r.verdict] || 'bg-white/10 text-slate-400')}>
                                    {r.verdict === 'مؤكد' ? <ShieldCheck size={11} className="inline ml-1" /> : null}
                                    {r.verdict || 'قيد القراءة'}
                                </span>
                                <span className="text-[12px] font-bold truncate flex-1">{r.file_name}</span>
                                {r.drive_url && (
                                    <a href={r.drive_url} target="_blank" rel="noopener noreferrer"
                                        className="text-[11px] text-sky-300 flex items-center gap-1 shrink-0">
                                        <ExternalLink size={12} /> افتح
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                                {[['المُصدِر', r.ocr_sup], ['رقم المستند', r.ocr_no],
                                  ['الإجمالي', r.ocr_total ? money(r.ocr_total) : null], ['التاريخ', r.ocr_date]]
                                    .filter(([, v]) => v).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-2">
                                        <span className="text-slate-500 shrink-0">{k}</span>
                                        <span className="font-bold truncate text-left">{v}</span>
                                    </div>
                                ))}
                            </div>

                            {r.evidence && <p className="text-[10px] text-emerald-300 font-bold">{r.evidence}</p>}

                            {!!(r.cands || []).length ? (() => {
                                // المرشّح الذي بُني عليه الحكم يُعرض وحده كقرار؛ والبقية
                                // لم تدخل الحساب، فتُطوى كي لا تبدو خيارات متكافئة.
                                const cs   = r.cands || [];
                                const main = cs.find(c => c.picked) || (cs.length === 1 ? cs[0] : null);
                                const rest = cs.filter(c => c !== main).slice(0, 4);
                                const Row = ({ c, dim }) => (
                                    <div className={'rounded-xl border p-2 flex items-center gap-2 '
                                        + (dim ? 'bg-black/20 border-white/5 opacity-70' : 'bg-black/25 border-white/10')}>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12px] font-bold truncate">
                                                فاتورة {c.no} · {money(c.gross)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate">
                                                {c.supplier} · {c.date} · تطابق الاسم {Math.round((c.sim || 0) * 100)}%
                                                {Number(c.diff) > 0 ? ' · يفرق ' + money(c.diff) : ''}
                                            </div>
                                        </div>
                                        <button onClick={() => decide(r.id, c.id, 'link')}
                                            className={'h-9 px-3 rounded-lg text-[11px] font-black shrink-0 '
                                                + (dim ? 'bg-white/10 text-slate-300' : 'bg-[#c5a059] text-[#0b1628]')}>
                                            اربط
                                        </button>
                                    </div>
                                );
                                return (
                                    <div className="space-y-1.5">
                                        {main && <Row c={main} />}
                                        {!main && cs.slice(0, 4).map(c => <Row key={c.id} c={c} />)}
                                        {!!rest.length && main && (
                                            <details className="text-[10px] text-slate-500">
                                                <summary className="cursor-pointer py-1">
                                                    {rest.length} فاتورة أخرى بنفس المبلغ — لم تدخل في الحكم
                                                </summary>
                                                <div className="space-y-1.5 pt-1.5">
                                                    {rest.map(c => <Row key={c.id} c={c} dim />)}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                );
                            })() : !r.verdict ? (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                    <Loader2 size={12} /> لم يُقرأ بعد — اضغط «اقرأ الملفات»
                                </p>
                            ) : (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> لا فاتورة مطابقة — راجعه بنفسك أو استبعده
                                </p>
                            )}

                            {!!r.verdict && <button onClick={() => decide(r.id, 0, 'reject')}
                                className="w-full h-9 rounded-lg bg-white/10 text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1.5">
                                <Trash2 size={12} /> استبعد
                            </button>}
                        </div>
                    ))}
                    {!rows.length && (
                        <p className="text-[12px] text-slate-500 text-center py-8">
                            لا ملفات معلّقة — ارفع الملفات ثم اقرأها
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
