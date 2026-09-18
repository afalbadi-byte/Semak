import React, { useEffect, useState } from 'react';
import { FileDown, ExternalLink } from 'lucide-react';
import { call } from '../lib/api';
import { go } from '../lib/router';
import { t } from '../lib/i18n';
import { fullDate, period, money, METHODS, KINDS } from '../lib/fmt';
import { Btn, Money, Spinner, inputCls } from '../ui';
import { useData } from '../App';
import { DocHeader, Beneficiary, Signatures, DocFooter } from './DocParts';

const PRESETS = [
    { k: 'month', t: 'هذا الشهر' }, { k: 'last', t: 'الشهر الماضي' },
    { k: 'q', t: 'الربع' }, { k: 'year', t: 'السنة' }, { k: 'all', t: 'كل الفترات' },
];

// كشف الحساب: رصيدٌ افتتاحي، والحركات بالرصيد الجاري، ولكل مستندٍ رابطه.
// يُحفظ PDF من نافذة الطباعة، والروابط تبقى قابلة للنقر داخل الملف.
export default function Statement({ q }) {
    const { funds, me } = useData();
    const [d, setD] = useState(null);
    const fund = q.fund || '';
    const from = q.from || '', to = q.to || '';

    useEffect(() => {
        setD(null);
        call('statement', { params: { fund, from, to } }).then(r => setD(r.success ? r : { error: t(r.message) }));
    }, [fund, from, to]);

    const set = patch => go('/statement', { fund, from, to, ...patch });

    // اسم ملف PDF يُؤخذ من عنوان الصفحة لحظة الطباعة
    const pdf = () => {
        const old = document.title;
        document.title = [t('كشف حساب'), d.fund ? d.fund.name : t('كل العُهد'), (from || t('البداية')) + ' - ' + (to || t('اليوم'))].join(' - ');
        window.print();
        setTimeout(() => { document.title = old; }, 1500);
    };

    const rows = d && d.rows ? d.rows : [];
    const ins = rows.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
    const outs = rows.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
    const vat = rows.filter(x => x.type === 'out').reduce((s, x) => s + x.vat, 0);
    const docs = rows.filter(x => x.doc_url).length;
    const missing = rows.filter(x => x.type === 'out' && !x.doc_url).length;
    const fundName = d && d.fund ? d.fund.name : t('كل العُهد');

    return (
        <div className="pt-2 lg:pt-0">
            {/* ── أدوات الكشف — لا تُطبع ── */}
            <div className="no-print space-y-3 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select className={inputCls} value={fund} onChange={e => set({ fund: e.target.value })}>
                        <option value="">{t('كل العُهد')}</option>
                        {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input type="date" className={inputCls} value={from} onChange={e => set({ from: e.target.value })} aria-label={t('من')} />
                    <input type="date" className={inputCls} value={to} onChange={e => set({ to: e.target.value })} aria-label={t('إلى')} />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                    {PRESETS.map(p => {
                        const r = p.k === 'all' ? { from: '', to: '' } : period(p.k);
                        const on = r.from === from && r.to === to;
                        return (
                            <button key={p.k} onClick={() => set(r)}
                                className={'shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ' + (on ? 'bg-ink text-white' : 'bg-paper-card border border-paper-2 text-ink-2')}>
                                {t(p.t)}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-[12px] text-ink-3 flex-1 leading-5">{t('في نافذة الطباعة اختر «حفظ PDF» — على الآيفون: مشاركة ثم «حفظ في الملفات». روابط المستندات تبقى قابلة للنقر داخل الملف.')}</p>
                    <Btn onClick={pdf} disabled={!d || !d.rows}><FileDown size={17} />{t('تنزيل PDF')}</Btn>
                </div>
                {d && d.rows && !d.profile.org_name ? (
                    <a href="#/profile" className="block text-[12px] text-brand font-semibold">{t('أضف شعار منشأتك وبياناتها لتظهر في الكشف ←')}</a>
                ) : null}
            </div>

            {!d ? <Spinner /> : d.error ? <p className="text-center text-red-700 py-10">{d.error}</p> : (
                <article className="bg-white rounded-2xl lg:rounded-3xl border border-paper-2 p-5 lg:p-10 text-ink print:border-0 print:p-0 print:rounded-none">
                    <DocHeader title={t('كشف حساب')} profile={d.profile} logo={d.logo_url}
                        subtitle={<><b>{fundName}</b>{d.fund ? ' · ' + t(KINDS[d.fund.kind] || '') : ''}</>}
                        meta={[[t('من'), from ? fullDate(from) : t('البداية')], [t('إلى'), to ? fullDate(to) : t('اليوم')]]} />
                    <Beneficiary name={d.user} email={d.email} phone={d.phone} profile={d.profile} />

                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6 print:grid-cols-4 print-avoid">
                        {[['الرصيد الافتتاحي', d.opening], ['الوارد', ins], ['الصادر', outs], ['الرصيد الختامي', d.closing]].map(([k, v], i) => (
                            <div key={k} className={'rounded-xl border p-3 ' + (i === 3 ? 'border-ink bg-paper' : 'border-paper-2')}>
                                <div className="text-[11px] text-ink-2">{t(k)}</div>
                                <Money v={v} frac={2} className={'block text-[17px] font-bold mt-0.5 ' + (v < 0 ? 'text-red-700' : '')} />
                            </div>
                        ))}
                    </section>

                    <table className="w-full text-[11.5px] border-collapse">
                        <thead>
                            <tr className="bg-paper">
                                <th className="border border-paper-2 px-1.5 py-1.5 w-7 text-start">#</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-start">{t('التاريخ')}</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-start">{t('البيان')}</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-start">{t('التصنيف')}</th>
                                {!d.fund ? <th className="border border-paper-2 px-1.5 py-1.5 text-start">{t('العهدة')}</th> : null}
                                <th className="border border-paper-2 px-1.5 py-1.5 text-end">{t('وارد')}</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-end">{t('صادر')}</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-end">{t('الرصيد')}</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 w-16 text-center">{t('المستند')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-paper/60">
                                <td className="border border-paper-2 px-1.5 py-1.5" />
                                <td className="border border-paper-2 px-1.5 py-1.5 whitespace-nowrap">{from ? fullDate(from) : '—'}</td>
                                <td colSpan={d.fund ? 4 : 5} className="border border-paper-2 px-1.5 py-1.5 font-semibold">{t('رصيدٌ مرحَّل')}</td>
                                <td className="border border-paper-2 px-1.5 py-1.5 text-end tabular-nums font-semibold" dir="ltr">{money(d.opening, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                            {rows.map((x, i) => (
                                <tr key={x.id} className="print-avoid">
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-center tabular-nums">{i + 1}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 whitespace-nowrap">{fullDate(x.d)}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5">
                                        <span className="font-semibold">{x.vendor || t(x.type === 'in' ? 'استلام مبلغ' : 'مصروف')}</span>
                                        {x.ref ? <span className="text-ink-3"> · {x.ref}</span> : null}
                                        {x.type === 'out' && x.method ? <span className="text-ink-3"> · {t(METHODS[x.method])}</span> : null}
                                        {x.note ? <span className="block text-[10.5px] text-ink-3">{x.note}</span> : null}
                                    </td>
                                    <td className="border border-paper-2 px-1.5 py-1.5">{x.type === 'out' ? (x.cat_name || '—') : ''}</td>
                                    {!d.fund ? <td className="border border-paper-2 px-1.5 py-1.5">{x.fund_name || '—'}</td> : null}
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-end tabular-nums text-brand-700" dir="ltr">{x.type === 'in' ? money(x.amount, 2) : ''}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-end tabular-nums" dir="ltr">{x.type === 'out' ? money(x.amount, 2) : ''}</td>
                                    <td className={'border border-paper-2 px-1.5 py-1.5 text-end tabular-nums font-semibold ' + (x.balance < 0 ? 'text-red-700' : '')} dir="ltr">{money(x.balance, 2)}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-center">
                                        {x.doc_url ? (
                                            <a href={x.doc_url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-0.5 text-blue-700 underline underline-offset-2 font-semibold">
                                                {t(x.on_drive ? 'درايف' : 'عرض')}<ExternalLink size={10} className="print:hidden" />
                                            </a>
                                        ) : <span className="text-ink-3">—</span>}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-paper font-bold">
                                <td colSpan={d.fund ? 4 : 5} className="border border-paper-2 px-1.5 py-2">{t('الإجمالي ({n} حركة)', { n: rows.length })}</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-end tabular-nums text-brand-700" dir="ltr">{money(ins, 2)}</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-end tabular-nums" dir="ltr">{money(outs, 2)}</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-end tabular-nums" dir="ltr">{money(d.closing, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                        </tbody>
                    </table>

                    <section className="mt-4 text-[11.5px] text-ink-2 leading-6 print-avoid">
                        <div>{t('ضريبة القيمة المضافة ضمن الصادر:')} <b className="tabular-nums" dir="ltr">{money(vat, 2)}</b></div>
                        <div>{t('المستندات المرفقة: {a} من {b} حركة', { a: docs, b: rows.length })}
                            {missing > 0 ? <span className="text-amber"> — {t('{n} مصروفٍ بلا مستند', { n: missing })}</span> : null}</div>
                        <div className="text-ink-3 text-[10.5px] mt-1">{t('روابط «عرض» صالحةٌ سنةً من تاريخ الإصدار، وروابط «درايف» تفتح الملف في Google Drive لمن له صلاحية على المجلد.')}</div>
                    </section>

                    <Signatures name={d.user || me.name} profile={d.profile} />
                    <DocFooter right={fundName} note={d.profile.report_note} />
                </article>
            )}
        </div>
    );
}
