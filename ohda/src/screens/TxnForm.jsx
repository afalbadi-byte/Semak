import React, { useEffect, useRef, useState } from 'react';
import { Camera, FileUp, Loader2, Sparkles, Trash2, FileText, Check, ChevronDown, Calculator, AlertCircle, X, RefreshCw } from 'lucide-react';
import { call, upload } from '../lib/api';
import { back } from '../lib/router';
import { today, money, METHODS, fullDate } from '../lib/fmt';
import { Btn, Field, inputCls, Seg, CatIcon, Money, Spinner, Sheet, useToast } from '../ui';
import { useData } from '../App';
import { t } from '../lib/i18n';

// العهدة لا تُختار تلقائياً إلا إذا كانت واحدة: مع تعدّدها يختار صاحبها بنفسه،
// فلا يُخصم مصروفٌ من عهدةٍ لم تُصرف منها
const openOf = funds => funds.filter(f => f.status !== 'settled');
const blank = (q, funds) => {
    const op = openOf(funds);
    return {
        type: q.type === 'in' ? 'in' : 'out',
        amount: '', vat: '', d: today(), vendor: '', cat_id: 0, method: 'cash', ref: '', note: '',
        fund_id: Number(q.fund) || (op.length === 1 ? op[0].id : 0),
    };
};

export default function TxnForm({ id, q }) {
    const { funds, cats, flags, reloadFunds } = useData();
    const toast = useToast();
    const [f, setF] = useState(() => blank(q, funds));
    const [files, setFiles] = useState([]);         // صفحات المستند: [{ id, url, mime }]
    const [cur, setCur] = useState(0);              // الصفحة المعروضة كبيرة
    const touched = useRef(new Set());              // حقولٌ كتبها المستخدم بيده — لا تمسّها القراءة
    const [scan, setScan] = useState(null);         // ما قرأه القارئ
    const [stage, setStage] = useState('');         // uploading | reading
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(!!id);
    const [vendors, setVendors] = useState([]);
    const [dup, setDup] = useState(null);
    const [showItems, setShowItems] = useState(false);
    const cam = useRef(null), pick = useRef(null), amt = useRef(null);

    useEffect(() => { call('vendors').then(r => r.success && setVendors(r.data)); }, []);

    useEffect(() => {
        if (!id) { setF(blank(q, funds)); setFiles([]); setScan(null); touched.current = new Set(); setLoading(false); return; }
        setLoading(true);
        call('txns', { params: { id } }).then(r => {
            const t = r.success && r.data[0];
            if (t) {
                setF({ id: t.id, type: t.type, amount: String(t.amount), vat: t.vat ? String(t.vat) : '', d: t.d, vendor: t.vendor || '',
                    cat_id: Number(t.cat_id) || 0, method: t.method || 'cash', ref: t.ref || '', note: t.note || '', fund_id: Number(t.fund_id) || 0 });
                setFiles((t.files && t.files.length) ? t.files : (t.file_id ? [{ id: t.file_id, url: t.file_url, mime: t.file_mime }] : []));
                setCur(0);
                touched.current = new Set(['amount', 'vat', 'd', 'vendor', 'cat_id', 'method', 'ref']);   // حركةٌ محفوظة: القراءة لا تغيّر أرقامها
            }
            setLoading(false);
        });
    }, [id, q.type]);   // eslint-disable-line react-hooks/exhaustive-deps

    const set = (k, v) => { touched.current.add(k); setF(x => ({ ...x, [k]: v })); };
    const out = f.type === 'out';

    // ─── المستند: صفحةٌ أو صفحات، تُقرأ معاً كمستندٍ واحد ─────────────────────
    // كل صفحةٍ جديدة تعيد القراءة بكل الصفحات؛ فالإجمالي الذي في الصفحة الأخيرة
    // يصحّح ما قُرئ من الأولى. وما كتبه المستخدم بيده لا يُمسّ أبداً.
    const readAll = async list => {
        if (!flags.ai || !out || !list.length) return;
        setStage('reading');
        const s2 = await call('scan', { body: { file_ids: list.map(x => x.id) } });
        setStage('');
        if (!s2.success) { setErr(t(s2.message || 'تعذّرت القراءة') + ' — ' + t('أكمل البيانات يدوياً')); return; }
        const x = s2.data, tc = touched.current;
        setScan(x);
        setF(p => ({
            ...p,
            amount: tc.has('amount') ? p.amount : (x.total ? String(x.total) : p.amount),
            vat: tc.has('vat') ? p.vat : (x.vat ? String(x.vat) : p.vat),
            d: tc.has('d') ? p.d : (/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : p.d),
            vendor: tc.has('vendor') ? p.vendor : (x.vendor || p.vendor),
            cat_id: tc.has('cat_id') ? p.cat_id : (x.cat_id || p.cat_id),
            method: tc.has('method') ? p.method : (['cash', 'card', 'transfer'].includes(x.method) ? x.method : p.method),
            ref: tc.has('ref') ? p.ref : (x.invoice_no || p.ref),
        }));
    };

    const onFile = async e => {
        const picked = Array.from((e.target && e.target.files) || []);
        e.target.value = '';
        if (!picked.length) return;
        setErr(''); setStage('uploading');
        const added = [];
        for (const fl of picked.slice(0, 8 - files.length)) {
            const r = await upload(fl);
            if (r.success) added.push({ id: r.id, url: r.url, mime: r.mime });
            else setErr(t(r.message || 'تعذّر رفع الملف'));
        }
        setStage('');
        if (!added.length) return;
        const next = [...files, ...added];
        setFiles(next);
        setCur(next.length - 1);
        await readAll(next);
    };

    const removePage = i => {
        const next = files.filter((_, k) => k !== i);
        setFiles(next);
        setCur(c => Math.max(0, Math.min(c, next.length - 1)));
        if (!next.length) setScan(null);
    };

    const pickVendor = v => {
        set('vendor', v);
        const hit = vendors.find(x => x.vendor === v);
        if (hit) setF(p => ({ ...p, vendor: v, cat_id: p.cat_id || hit.cat_id || 0, method: hit.method || p.method }));
    };

    // ─── الحفظ ──────────────────────────────────────────────────────────────
    const save = async (force, again) => {
        setErr('');
        if (!(Number(f.amount) > 0)) { setErr(t('اكتب المبلغ')); amt.current && amt.current.focus(); return; }
        // مع وجود عهدةٍ مفتوحة لا تُحفظ حركةٌ معلّقة بلا عهدة: لا تُخصم من رصيدٍ ولا تظهر في كشف
        if (!Number(f.fund_id) && openOf(funds).length) { setErr(t('اختر العهدة')); window.scrollTo(0, 0); return; }
        setBusy(true);
        const r = await call('txn_save', { body: { ...f, amount: Number(f.amount), vat: Number(f.vat) || 0, file_ids: files.map(x => x.id), force: force ? 1 : 0 } });
        setBusy(false);
        if (r.duplicate) { setDup({ ...r.duplicate, again }); return; }
        if (!r.success) { setErr(t(r.message || 'تعذّر الحفظ')); return; }
        reloadFunds();
        toast(t(f.id ? 'حُفظت التعديلات' : (out ? 'سُجّل المصروف' : 'سُجّل الاستلام')));
        if (again) { setF({ ...blank({ type: f.type, fund: f.fund_id }, funds), d: f.d }); setFiles([]); setScan(null); touched.current = new Set(); window.scrollTo(0, 0); return; }
        back('/txns');
    };

    const remove = async () => {
        if (!window.confirm(t('نقل الحركة إلى السلّة؟ تُستعاد منها متى شئت.'))) return;
        const r = await call('txn_delete', { body: { id: f.id } });
        if (r.success) { reloadFunds(); toast(t('نُقلت إلى السلّة')); back('/txns'); }
    };

    if (loading) return <Spinner />;
    const openFunds = funds.filter(x => x.status !== 'settled' || x.id === f.fund_id);
    const vatGuess = Number(f.amount) > 0 ? Math.round((Number(f.amount) * 15 / 115) * 100) / 100 : 0;

    return (
        <div className="pt-2 lg:pt-0 lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">
            {/* ── الإيصال ── */}
            <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-3 mb-5">
                {!f.id ? (
                    <Seg value={f.type} onChange={v => set('type', v)} options={[{ v: 'out', t: t('مصروف') }, { v: 'in', t: t('استلام مبلغ') }]} />
                ) : null}

                <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFile} />

                {files.length ? (
                    <div className="relative rounded-2xl overflow-hidden border border-paper-2 bg-paper-card">
                        {(() => {
                            const pg = files[cur] || files[0];
                            return pg.mime === 'application/pdf' ? (
                                <a href={pg.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-5 text-brand-700 font-semibold">
                                    <FileText size={28} />{t('مستند PDF — اضغط للعرض')}
                                </a>
                            ) : (
                                <a href={pg.url} target="_blank" rel="noreferrer">
                                    <img src={pg.url} alt={t('الإيصال')} className="w-full max-h-[220px] lg:max-h-[480px] object-contain bg-paper-2" />
                                </a>
                            );
                        })()}
                        <div className="flex gap-1.5 p-2 border-t border-paper-2 overflow-x-auto no-scrollbar">
                            {files.map((pg, i) => (
                                <div key={pg.id} className={'relative shrink-0 w-14 h-16 rounded-lg overflow-hidden border-2 ' + (i === cur ? 'border-brand' : 'border-paper-2')}>
                                    <button type="button" onClick={() => setCur(i)} className="w-full h-full bg-paper-2 flex items-center justify-center">
                                        {pg.mime === 'application/pdf' ? <FileText size={18} className="text-brand" /> : <img src={pg.url} alt="" className="w-full h-full object-cover" />}
                                    </button>
                                    <span className="absolute bottom-0.5 end-0.5 min-w-[16px] h-4 px-1 rounded bg-ink/75 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">{i + 1}</span>
                                    <button type="button" onClick={() => removePage(i)} aria-label={t('إزالة')}
                                        className="absolute top-0.5 start-0.5 w-5 h-5 rounded bg-ink/70 text-white flex items-center justify-center"><X size={11} /></button>
                                </div>
                            ))}
                            {files.length < 8 ? (
                                <>
                                    <button type="button" onClick={() => cam.current.click()} disabled={!!stage}
                                        className="shrink-0 w-14 h-16 rounded-lg border-2 border-dashed border-brand-100 bg-brand-50/60 text-brand-700 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold">
                                        <Camera size={16} />{t('صفحة')}
                                    </button>
                                    <button type="button" onClick={() => pick.current.click()} disabled={!!stage}
                                        className="shrink-0 w-14 h-16 rounded-lg border-2 border-dashed border-paper-2 text-ink-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold">
                                        <FileUp size={16} />{t('ملف')}
                                    </button>
                                </>
                            ) : null}
                        </div>
                        {files.length > 1 && out && flags.ai ? (
                            <div className="flex items-center gap-2 px-3 pb-2 text-[11.5px] text-ink-3">
                                <span className="flex-1">{t('{n} صفحات تُقرأ معاً كمستندٍ واحد', { n: files.length })}</span>
                                <button type="button" onClick={() => readAll(files)} disabled={!!stage} className="flex items-center gap-1 font-semibold text-brand">
                                    <RefreshCw size={12} />{t('أعد القراءة')}
                                </button>
                            </div>
                        ) : null}
                        {stage ? (
                            <div className="absolute inset-0 bg-paper-card/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                <Loader2 size={26} className="animate-spin text-brand" />
                                <span className="text-[13px] font-semibold text-ink-2">{stage === 'uploading' ? t('يُرفع الملف…')
                                    : files.length > 1 ? t('يقرأ {n} صفحات…', { n: files.length }) : t('يقرأ الإيصال…')}</span>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => cam.current.click()} disabled={!!stage}
                            className="h-28 rounded-2xl border-2 border-dashed border-brand-100 bg-brand-50/60 text-brand-700 flex flex-col items-center justify-center gap-1.5 font-semibold text-[14px] hover:bg-brand-50">
                            {stage ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
                            {t(stage === 'uploading' ? 'يُرفع…' : 'صوّر الإيصال')}
                        </button>
                        <button onClick={() => pick.current.click()} disabled={!!stage}
                            className="h-28 rounded-2xl border-2 border-dashed border-paper-2 bg-paper-card text-ink-2 flex flex-col items-center justify-center gap-1.5 font-semibold text-[14px] hover:border-ink-3">
                            <FileUp size={24} />{t('صورة أو PDF')}
                        </button>
                    </div>
                )}

                {out && flags.ai && !files.length ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-ink-3 px-1">
                        <Sparkles size={13} className="text-amber" />{t('يقرأ التطبيق الجهة والتاريخ والمبلغ والضريبة من الإيصال')}
                    </p>
                ) : null}

                {scan ? (
                    <div className={'rounded-2xl border p-3 text-[12.5px] ' + (scan.confidence === 'low' ? 'bg-amber-50 border-amber-100' : 'bg-brand-50 border-brand-100')}>
                        <div className="flex items-center gap-1.5 font-bold text-brand-800">
                            <Sparkles size={14} />{t('قُرئ الإيصال')}
                            <span className="ms-auto text-[11px] font-semibold opacity-70">
                                {t(scan.confidence === 'high' ? 'قراءة واضحة' : scan.confidence === 'medium' ? 'راجع الأرقام' : 'قراءة ضعيفة — راجعها')}
                            </span>
                        </div>
                        {scan.note ? <p className="mt-1.5 text-ink-2 flex gap-1.5"><AlertCircle size={14} className="shrink-0 mt-0.5 text-amber" />{scan.note}</p> : null}
                        {scan.items && scan.items.length ? (
                            <>
                                <button onClick={() => setShowItems(v => !v)} className="mt-2 flex items-center gap-1 font-semibold text-brand-700">
                                    {t('{n} بنود', { n: scan.items.length })} <ChevronDown size={14} className={showItems ? 'rotate-180' : ''} />
                                </button>
                                {showItems ? (
                                    <ul className="mt-1.5 space-y-1">
                                        {scan.items.map((it, i) => (
                                            <li key={i} className="flex justify-between gap-2 text-ink-2">
                                                <span className="truncate">{it.qty > 1 ? it.qty + '× ' : ''}{it.name}</span>
                                                <Money v={it.amount} cur={false} />
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* ── البيانات ── */}
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-paper-card rounded-2xl border border-paper-2 p-4">
                    <label className="block text-[12px] font-semibold text-ink-2 mb-1">{t('المبلغ')}</label>
                    <div className="flex items-baseline gap-2" dir="ltr">
                        <input ref={amt} inputMode="decimal" value={f.amount} placeholder="0.00"
                            onChange={e => set('amount', e.target.value.replace(/[^\d.]/g, ''))}
                            className="flex-1 min-w-0 bg-transparent text-[40px] font-bold outline-none tabular-nums placeholder:text-paper-2 text-left" />
                        <span className="text-ink-3 font-semibold">{t('ر.س')}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('التاريخ')} hint={f.d !== today() ? fullDate(f.d) : null}>
                        <input type="date" className={inputCls} value={f.d} onChange={e => set('d', e.target.value)} />
                    </Field>
                    {out ? (
                        <Field label={t('الضريبة (١٥٪)')}>
                            <div className="relative">
                                <input inputMode="decimal" className={inputCls + ' rtl:pl-11 ltr:pr-11'} dir="ltr" value={f.vat} placeholder="0"
                                    onChange={e => set('vat', e.target.value.replace(/[^\d.]/g, ''))} />
                                <button type="button" title={t('احسب من المبلغ: {v}', { v: money(vatGuess, 2) })} onClick={() => set('vat', String(vatGuess))}
                                    className="absolute rtl:left-1 ltr:right-1 top-1 w-9 h-9 rounded-lg text-ink-3 hover:bg-paper-2 flex items-center justify-center">
                                    <Calculator size={16} />
                                </button>
                            </div>
                        </Field>
                    ) : (
                        <Field label={t('المرجع')}>
                            <input className={inputCls} value={f.ref} onChange={e => set('ref', e.target.value)} placeholder={t('رقم التحويل')} />
                        </Field>
                    )}
                </div>

                <Field label={t(out ? 'الجهة' : 'المصدر')}>
                    <input className={inputCls} list="oh-vendors" value={f.vendor} onChange={e => pickVendor(e.target.value)}
                        placeholder={t(out ? 'المتجر أو المحطّة أو المدرسة' : 'من سلّمك المبلغ')} />
                    <datalist id="oh-vendors">{vendors.map(v => <option key={v.vendor} value={v.vendor} />)}</datalist>
                </Field>

                {out ? (
                    <div>
                        <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('التصنيف')}</span>
                        <div className="flex flex-wrap gap-1.5">
                            {cats.map(c => (
                                <button key={c.id} type="button" onClick={() => set('cat_id', f.cat_id === Number(c.id) ? 0 : Number(c.id))}
                                    className={'h-9 ps-2 pe-3 rounded-xl border text-[13px] font-semibold flex items-center gap-1.5 transition ' +
                                        (f.cat_id === Number(c.id) ? 'text-white border-transparent' : 'bg-paper-card border-paper-2 text-ink-2')}
                                    style={f.cat_id === Number(c.id) ? { background: c.color } : undefined}>
                                    <span style={f.cat_id === Number(c.id) ? undefined : { color: c.color }}><CatIcon name={c.icon} size={15} /></span>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {openFunds.length ? (
                    <div>
                        <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t(out ? 'من عهدة' : 'إلى عهدة')}
                            {openFunds.length > 1 ? <span className="text-red-600"> *</span> : null}</span>
                        <div className="flex flex-wrap gap-1.5">
                            {openFunds.map(x => (
                                <button key={x.id} type="button" onClick={() => set('fund_id', Number(x.id))}
                                    className={'h-9 px-3 rounded-xl border text-[13px] font-semibold flex items-center gap-1.5 ' +
                                        (f.fund_id === Number(x.id) ? 'bg-ink text-white border-ink' : 'bg-paper-card border-paper-2 text-ink-2')}>
                                    <span className="w-2 h-2 rounded-full" style={{ background: x.color }} />{x.name}
                                    <span className="opacity-60 text-[11px]"><Money v={x.balance} cur={false} frac={0} /></span>
                                </button>
                            ))}
                        </div>
                        {openFunds.length > 1 && !Number(f.fund_id)
                            ? <p className="text-[11.5px] text-amber-700 mt-1.5">{t('اختر العهدة التي صُرفت منها، وإلا لن تُخصم الحركة من أيّ رصيد.')}</p> : null}
                    </div>
                ) : null}

                <div>
                    <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('طريقة الدفع')}</span>
                    <Seg value={f.method} onChange={v => set('method', v)} options={Object.entries(METHODS).map(([v, x]) => ({ v, t: t(x) }))} />
                </div>

                {out ? (
                    <Field label={t('رقم الفاتورة أو المرجع')}>
                        <input className={inputCls} value={f.ref} onChange={e => set('ref', e.target.value)} />
                    </Field>
                ) : null}

                <Field label={t('ملاحظة')}>
                    <textarea className={inputCls + ' h-auto py-2.5 min-h-[76px]'} value={f.note} onChange={e => set('note', e.target.value)} />
                </Field>

                {err ? <p className="text-[13px] font-semibold text-red-700">{err}</p> : null}

                <div className="flex gap-2 pt-1 sticky bottom-0 lg:bottom-4 bg-paper/90 backdrop-blur py-2 -mx-1 px-1 z-10"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
                    <Btn className="flex-1 !h-12 text-[15px]" busy={busy} onClick={() => save(false, false)}><Check size={18} />{t(f.id ? 'حفظ التعديلات' : 'حفظ')}</Btn>
                    {!f.id ? <Btn kind="soft" className="!h-12" disabled={busy} onClick={() => save(false, true)}>{t('حفظ وإضافة آخر')}</Btn> : null}
                    {f.id ? <Btn kind="danger" className="!h-12 !px-3" onClick={remove} aria-label={t('حذف')}><Trash2 size={18} /></Btn> : null}
                </div>
            </div>

            <Sheet open={!!dup} onClose={() => setDup(null)} title={t('يبدو أنها مسجّلة من قبل')}>
                {dup ? (
                    <div className="space-y-4">
                        <p className="text-[14px] text-ink-2 leading-7">
                            {t('سُجّل من قبل: {v} بتاريخ {d} بمبلغ', { v: dup.vendor || t('مصروف'), d: fullDate(dup.d) })} <Money v={dup.amount} className="font-bold" /> — {t('بنفس اليوم والجهة والمبلغ.')}
                        </p>
                        <div className="flex gap-2">
                            <Btn kind="line" className="flex-1" onClick={() => setDup(null)}>{t('لا، ألغِ')}</Btn>
                            <Btn className="flex-1" onClick={() => { const a = dup.again; setDup(null); save(true, a); }}>{t('سجّلها مرّة ثانية')}</Btn>
                        </div>
                        <a href={'#/txn/' + dup.id} className="block text-center text-[13px] font-semibold text-brand">{t('افتح المسجَّلة')}</a>
                    </div>
                ) : null}
            </Sheet>
        </div>
    );
}
