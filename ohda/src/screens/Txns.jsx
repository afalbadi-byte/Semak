import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Download, SlidersHorizontal, Paperclip, Trash2, RotateCcw, ReceiptText, Plus, FileDown } from 'lucide-react';
import { call } from '../lib/api';
import { href, go } from '../lib/router';
import { t } from '../lib/i18n';
import { dayLabel, shortDate, METHODS, fullDate } from '../lib/fmt';
import { Money, Card, Spinner, Empty, Btn, Sheet, Field, inputCls, CatIcon, useToast } from '../ui';
import { useData } from '../App';
import { TxnRow } from './Dashboard';

// الحركات: كل ما في الرابط مرشِّح — فأي رقمٍ في التطبيق يفتح هنا مصفّى على ما يخصّه
export default function Txns({ q }) {
    const { funds, cats } = useData();
    const toast = useToast();
    const [rows, setRows] = useState(null);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(q.q || '');
    const trash = q.trash === '1';

    useEffect(() => {
        let live = true;
        setRows(null);
        call('txns', { params: q }).then(r => { if (live) setRows(r.success ? r.data : []); });
        return () => { live = false; };
    }, [JSON.stringify(q)]);   // eslint-disable-line react-hooks/exhaustive-deps

    const set = patch => go('/txns', { ...q, ...patch });
    const clear = k => { const n = { ...q }; delete n[k]; go('/txns', n); };

    const sums = useMemo(() => {
        const s = { out: 0, in: 0, vat: 0, n: 0 };
        (rows || []).forEach(x => { s[x.type] += x.amount; if (x.type === 'out') s.vat += x.vat; s.n++; });
        return s;
    }, [rows]);

    const groups = useMemo(() => {
        const g = [];
        (rows || []).forEach(x => {
            const last = g[g.length - 1];
            if (last && last.d === x.d) { last.items.push(x); if (x.type === 'out') last.total += x.amount; }
            else g.push({ d: x.d, items: [x], total: x.type === 'out' ? x.amount : 0 });
        });
        return g;
    }, [rows]);

    // الشارات تشرح ما يُعرض الآن، وكلٌّ منها يُزال بلمسة
    const chips = [];
    if (q.type) chips.push(['type', t(q.type === 'in' ? 'المستلم' : 'المصروف')]);
    if (q.fund) chips.push(['fund', (funds.find(f => String(f.id) === q.fund) || {}).name || t('عهدة')]);
    if (q.cat) chips.push(['cat', q.cat === '-1' ? t('بلا تصنيف') : (cats.find(c => String(c.id) === q.cat) || {}).name || t('تصنيف')]);
    if (q.from || q.to) chips.push(['from', q.from === q.to ? fullDate(q.from) : (shortDate(q.from) || '…') + ' — ' + (shortDate(q.to) || '…')]);
    if (q.vendor) chips.push(['vendor', q.vendor]);
    if (q.method) chips.push(['method', t(METHODS[q.method] || q.method)]);
    if (q.noreceipt) chips.push(['noreceipt', t('بلا إيصال')]);
    if (q.q) chips.push(['q', '«' + q.q + '»']);

    const exportCsv = () => {
        const head = ['التاريخ', 'النوع', 'الجهة', 'التصنيف', 'العهدة', 'طريقة الدفع', 'المبلغ', 'الضريبة', 'المرجع', 'ملاحظة', 'إيصال'].map(x => t(x));
        const lines = (rows || []).map(x => [x.d, t(x.type === 'in' ? 'استلام' : 'مصروف'), x.vendor, x.cat_name || '', x.fund_name || '',
            t(METHODS[x.method] || ''), x.amount, x.vat, x.ref || '', (x.note || '').replace(/\n/g, ' '), t(x.file_id ? 'نعم' : 'لا')]);
        const csv = [head, ...lines].map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
        // علامة BOM ليقرأ إكسل العربية سليمة
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = t('عهدة') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
    };

    const restore = async x => {
        const r = await call('txn_delete', { body: { id: x.id, restore: 1 } });
        if (r.success) { toast(t('استُعيدت الحركة')); setRows(rows.filter(y => y.id !== x.id)); }
    };

    return (
        <div className="space-y-4 pt-2 lg:pt-0">
            {/* البحث والمرشِّحات */}
            <div className="flex gap-2">
                <form className="flex-1 relative" onSubmit={e => { e.preventDefault(); set({ q: text.trim() }); }}>
                    <Search size={17} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-3" />
                    <input value={text} onChange={e => setText(e.target.value)} placeholder={t('ابحث بالجهة أو الملاحظة أو المرجع')}
                        className={inputCls + ' ps-10'} />
                </form>
                <Btn kind="line" onClick={() => setOpen(true)} className="!px-3" aria-label={t('تصفية')}><SlidersHorizontal size={18} /></Btn>
                <a href={href('/statement', { fund: q.fund, from: q.from, to: q.to })} aria-label={t('كشف حساب PDF')}>
                    <Btn kind="line" className="!px-3"><FileDown size={17} /><span className="hidden lg:inline">{t('كشف PDF')}</span></Btn>
                </a>
                <Btn kind="line" onClick={exportCsv} className="!px-3 hidden sm:inline-flex" disabled={!rows || !rows.length}>
                    <Download size={17} /><span className="hidden lg:inline">{t('تصدير Excel')}</span>
                </Btn>
            </div>

            {chips.length || trash ? (
                <div className="flex flex-wrap gap-1.5">
                    {trash ? <span className="h-8 px-3 rounded-full bg-red-50 text-red-700 text-[12px] font-semibold flex items-center">{t('السلّة')}</span> : null}
                    {chips.map(([k, x]) => (
                        <button key={k} onClick={() => (k === 'from' ? go('/txns', { ...q, from: '', to: '' }) : clear(k))}
                            className="h-8 ps-3 pe-2 rounded-full bg-brand-50 text-brand-700 text-[12px] font-semibold flex items-center gap-1">
                            {x}<X size={13} />
                        </button>
                    ))}
                    {chips.length > 1 ? <a href="#/txns" className="h-8 px-3 rounded-full text-[12px] font-semibold text-ink-3 flex items-center">{t('مسح الكل')}</a> : null}
                </div>
            ) : null}

            {/* المجاميع — لكل رقمٍ رابطه */}
            {rows && rows.length ? (
                <div className="grid grid-cols-3 gap-2">
                    <a href={href('/txns', { ...q, type: 'out' })} className="bg-paper-card rounded-2xl border border-paper-2 p-3">
                        <div className="text-[11px] text-ink-3 font-semibold">{t('المصروف')}</div>
                        <Money v={sums.out} className="block font-bold text-[16px] mt-0.5" />
                    </a>
                    <a href={href('/txns', { ...q, type: 'in' })} className="bg-paper-card rounded-2xl border border-paper-2 p-3">
                        <div className="text-[11px] text-ink-3 font-semibold">{t('المستلم')}</div>
                        <Money v={sums.in} className="block font-bold text-[16px] mt-0.5 text-brand-700" />
                    </a>
                    <div className="bg-paper-card rounded-2xl border border-paper-2 p-3">
                        <div className="text-[11px] text-ink-3 font-semibold">{t('الحركات')}</div>
                        <div className="font-bold text-[16px] mt-0.5">{sums.n}</div>
                    </div>
                </div>
            ) : null}

            {!rows ? <Spinner /> : !rows.length ? (
                <Card>
                    <Empty icon={ReceiptText} title={t(trash ? 'السلّة فارغة' : 'لا حركات تطابق')}
                        text={t(trash ? 'ما تحذفه يبقى هنا ويُستعاد متى شئت.' : chips.length ? 'جرّب إزالة بعض المرشِّحات.' : 'سجّل أول مصروف وسيظهر هنا.')}
                        action={!trash && !chips.length ? <a href={href('/txn/new', { type: 'out' })}><Btn><Plus size={17} />{t('مصروف جديد')}</Btn></a> : null} />
                </Card>
            ) : (
                <>
                    {/* الجوّال: قائمة مجمّعة باليوم */}
                    <div className="lg:hidden space-y-4">
                        {groups.map(g => (
                            <section key={g.d}>
                                <a href={href('/txns', { ...q, from: g.d, to: g.d })} className="flex items-center justify-between px-1 mb-1.5">
                                    <span className="text-[12px] font-bold text-ink-2">{dayLabel(g.d)}</span>
                                    {g.total ? <Money v={g.total} className="text-[12px] text-ink-3" /> : null}
                                </a>
                                <Card className="divide-y divide-paper-2">
                                    {g.items.map(x => trash ? (
                                        <div key={x.id} className="flex items-center gap-2 pe-3">
                                            <div className="flex-1 min-w-0 opacity-60"><TxnRow t={x} showDate={false} /></div>
                                            <Btn kind="soft" className="!h-9 !px-3 text-[12px]" onClick={() => restore(x)}><RotateCcw size={14} />{t('استعادة')}</Btn>
                                        </div>
                                    ) : <TxnRow key={x.id} t={x} showDate={false} />)}
                                </Card>
                            </section>
                        ))}
                    </div>

                    {/* الشاشة الكبيرة: جدولٌ بكل الأعمدة */}
                    <Card className="hidden lg:block overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead className="bg-paper text-ink-3 text-[12px]">
                                <tr className="text-start">
                                    <th className="px-4 py-2.5 font-semibold text-start">{t('التاريخ')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{t('الجهة')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{t('التصنيف')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{t('العهدة')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{t('الدفع')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-end">{t('الضريبة')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-end">{t('المبلغ')}</th>
                                    <th className="px-3 py-2.5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-paper-2">
                                {rows.map(x => (
                                    <tr key={x.id} className={'hover:bg-paper cursor-pointer ' + (trash ? 'opacity-70' : '')}
                                        onClick={() => !trash && go('/txn/' + x.id)}>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <a href={href('/txns', { ...q, from: x.d, to: x.d })} onClick={e => e.stopPropagation()} className="hover:text-brand">{shortDate(x.d)}</a>
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold max-w-[220px] truncate">
                                            {x.vendor ? <a href={href('/txns', { vendor: x.vendor })} onClick={e => e.stopPropagation()} className="hover:text-brand">{x.vendor}</a>
                                                : <span className="text-ink-3">{x.type === 'in' ? t('استلام مبلغ') : '—'}</span>}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {x.type === 'out' ? (
                                                <a href={href('/txns', { ...q, cat: x.cat_id || -1 })} onClick={e => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1.5 hover:text-brand">
                                                    <span style={{ color: x.cat_color || '#94a3b8' }}><CatIcon name={x.cat_icon} size={14} /></span>
                                                    {x.cat_name || t('بلا تصنيف')}
                                                </a>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2.5 text-ink-2">
                                            {x.fund_id ? <a href={'#/fund/' + x.fund_id} onClick={e => e.stopPropagation()} className="hover:text-brand">{x.fund_name}</a> : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-ink-2">{t(METHODS[x.method] || '')}</td>
                                        <td className="px-3 py-2.5 text-end"><Money v={x.vat} cur={false} className="text-ink-3" /></td>
                                        <td className="px-3 py-2.5 text-end">
                                            <Money v={x.type === 'out' ? -x.amount : x.amount} sign className={'font-bold ' + (x.type === 'in' ? 'text-brand-700' : '')} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {trash ? (
                                                <button onClick={e => { e.stopPropagation(); restore(x); }} title={t('استعادة')} className="text-brand"><RotateCcw size={15} /></button>
                                            ) : x.file_id ? <Paperclip size={15} className="text-ink-3 inline" /> : x.type === 'out' ? <span className="text-amber text-[11px]">{t('بلا')}</span> : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>

                    <div className="flex justify-between items-center pt-1">
                        {!trash ? <a href="#/txns?trash=1" className="text-[12px] text-ink-3 flex items-center gap-1"><Trash2 size={13} />{t('السلّة')}</a> : <span />}
                        <button onClick={exportCsv} className="sm:hidden text-[12px] font-semibold text-brand flex items-center gap-1"><Download size={14} />{t('تصدير Excel')}</button>
                    </div>
                </>
            )}

            <FilterSheet open={open} onClose={() => setOpen(false)} q={q} onApply={n => { setOpen(false); go('/txns', n); }} />
        </div>
    );
}

function FilterSheet({ open, onClose, q, onApply }) {
    const { funds, cats } = useData();
    const [f, setF] = useState(q);
    useEffect(() => { if (open) setF(q); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
    const s = k => e => setF({ ...f, [k]: e.target.value });
    return (
        <Sheet open={open} onClose={onClose} title={t('تصفية الحركات')}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('من')}><input type="date" className={inputCls} value={f.from || ''} onChange={s('from')} /></Field>
                    <Field label={t('إلى')}><input type="date" className={inputCls} value={f.to || ''} onChange={s('to')} /></Field>
                </div>
                <Field label={t('النوع')}>
                    <select className={inputCls} value={f.type || ''} onChange={s('type')}>
                        <option value="">{t('الكل')}</option><option value="out">{t('المصروف')}</option><option value="in">{t('المستلم')}</option>
                    </select>
                </Field>
                <Field label={t('العهدة')}>
                    <select className={inputCls} value={f.fund || ''} onChange={s('fund')}>
                        <option value="">{t('كل العُهد')}</option>
                        {funds.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                </Field>
                <Field label={t('التصنيف')}>
                    <select className={inputCls} value={f.cat || ''} onChange={s('cat')}>
                        <option value="">{t('كل التصنيفات')}</option>
                        {cats.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        <option value="-1">{t('بلا تصنيف')}</option>
                    </select>
                </Field>
                <Field label={t('طريقة الدفع')}>
                    <select className={inputCls} value={f.method || ''} onChange={s('method')}>
                        <option value="">{t('الكل')}</option>
                        {Object.entries(METHODS).map(([k, x]) => <option key={k} value={k}>{t(x)}</option>)}
                    </select>
                </Field>
                <label className="flex items-center gap-2 text-[14px]">
                    <input type="checkbox" checked={!!f.noreceipt} onChange={e => setF({ ...f, noreceipt: e.target.checked ? '1' : '' })}
                        className="w-5 h-5 accent-brand" />
                    {t('المصاريف التي بلا إيصال فقط')}
                </label>
                <div className="flex gap-2 pt-2">
                    <Btn className="flex-1" onClick={() => onApply(f)}>{t('عرض النتائج')}</Btn>
                    <Btn kind="line" onClick={() => onApply({})}>{t('مسح')}</Btn>
                </div>
            </div>
        </Sheet>
    );
}
