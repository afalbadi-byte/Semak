import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { call } from '../lib/api';
import { t } from '../lib/i18n';
import { fullDate, METHODS, KINDS, money } from '../lib/fmt';
import { Money, Btn, Spinner } from '../ui';
import { useData } from '../App';
import { DocHeader, Beneficiary, Signatures, DocFooter } from './DocParts';

// تقرير تصفية العهدة: ورقةٌ تُسلَّم للمحاسب — ملخّص، ثم جدولٌ مرقَّم، ثم الإيصالات
// بأرقامها نفسها، فيُطابَق كل سطرٍ بإيصاله دون سؤال
export default function FundReport({ id }) {
    const { funds, me, profile, logo } = useData();
    const f = funds.find(x => Number(x.id) === id);
    const [rows, setRows] = useState(null);

    useEffect(() => { call('txns', { params: { fund: id } }).then(r => setRows(r.success ? r.data : [])); }, [id]);

    const data = useMemo(() => {
        if (!rows) return null;
        const asc = rows.slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id));
        const outs = asc.filter(x => x.type === 'out').map((x, i) => ({ ...x, n: i + 1 }));
        const ins = asc.filter(x => x.type === 'in');
        const byCat = {};
        outs.forEach(x => { const k = x.cat_name || t('بلا تصنيف'); byCat[k] = (byCat[k] || 0) + x.amount; });
        return {
            outs, ins, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
            spent: outs.reduce((s, x) => s + x.amount, 0), vat: outs.reduce((s, x) => s + x.vat, 0),
            received: ins.reduce((s, x) => s + x.amount, 0),
            from: asc.length ? asc[0].d : '', to: asc.length ? asc[asc.length - 1].d : '',
            missing: outs.filter(x => !x.file_id).length,
        };
    }, [rows]);

    if (!f || !data) return <Spinner />;
    const bal = data.received - data.spent;
    // كل صفحةٍ صورةٌ مستقلّة بعنوانها: رقم البند، ورقم الصفحة إن تعدّدت
    const pagesOf = x => ((x.files && x.files.length) ? x.files : (x.file_id ? [{ id: x.file_id, url: x.file_url, mime: x.file_mime }] : []));
    const imgs = data.outs.flatMap(x => { const ps = pagesOf(x); return ps.filter(pg => pg.mime !== 'application/pdf').map(pg => ({ ...x, pg, pn: ps.length > 1 ? ps.indexOf(pg) + 1 : 0 })); });
    const pdfs = data.outs.filter(x => pagesOf(x).some(pg => pg.mime === 'application/pdf'));
    const th = 'border border-paper-2 px-2 py-1.5';

    const print = () => {
        const old = document.title;
        document.title = t('تقرير تصفية عهدة') + ' - ' + f.name;
        window.print();
        setTimeout(() => { document.title = old; }, 1500);
    };

    return (
        <div className="pt-2 lg:pt-0">
            <div className="no-print flex items-center gap-2 mb-4">
                <p className="text-[13px] text-ink-3 flex-1">{t('اطبعه أو احفظه PDF من نافذة الطباعة')}</p>
                <Btn onClick={print}><Printer size={17} />{t('طباعة')}</Btn>
            </div>

            <article className="bg-white rounded-2xl lg:rounded-3xl border border-paper-2 p-6 lg:p-10 text-ink print:border-0 print:p-0 print:rounded-none">
                <DocHeader title={t('تقرير تصفية عهدة')} profile={profile} logo={logo}
                    subtitle={<><b>{f.name}</b> · {t(KINDS[f.kind])}</>}
                    meta={[[t('الفترة'), (fullDate(data.from) || '—') + ' — ' + (fullDate(data.to) || '—')],
                           [t('الحالة'), t(f.status === 'settled' ? 'مُصفّاة' : 'مفتوحة')]]} />
                <Beneficiary name={me.name} email={me.email} phone={me.phone} profile={profile} />

                <section className="grid grid-cols-4 gap-3 mb-6 print-avoid">
                    {[['إجمالي المستلم', data.received], ['إجمالي المصروف', data.spent], ['منه ضريبة', data.vat],
                      [bal >= 0 ? 'المتبقّي للإرجاع' : 'المستحقّ لصاحب العهدة', Math.abs(bal)]].map(([k, v], i) => (
                        <div key={k} className={'rounded-xl border p-3 ' + (i === 3 ? 'border-ink bg-paper' : 'border-paper-2')}>
                            <div className="text-[11px] text-ink-2">{t(k)}</div>
                            <Money v={v} frac={2} className="block text-[17px] font-bold mt-0.5" />
                        </div>
                    ))}
                </section>
                {bal < 0 && profile.iban ? (
                    <p className="-mt-3 mb-6 text-[11.5px] text-ink-2">{t('يُحوَّل المستحقّ إلى الآيبان:')} <b dir="ltr" className="tabular-nums">{profile.iban}</b>{profile.bank ? ' — ' + profile.bank : ''}</p>
                ) : null}

                {data.ins.length ? (
                    <section className="mb-6 print-avoid">
                        <h2 className="text-[14px] font-bold mb-2">{t('المبالغ المستلمة')}</h2>
                        <table className="w-full text-[12px] border-collapse">
                            <thead><tr className="bg-paper">
                                <th className={th + ' text-start'}>{t('التاريخ')}</th><th className={th + ' text-start'}>{t('المصدر')}</th>
                                <th className={th + ' text-start'}>{t('المرجع')}</th><th className={th + ' text-end'}>{t('المبلغ')}</th>
                            </tr></thead>
                            <tbody>
                                {data.ins.map(x => (
                                    <tr key={x.id}><td className={th}>{fullDate(x.d)}</td><td className={th}>{x.vendor || '—'}</td>
                                        <td className={th}>{x.ref || ''}</td><td className={th + ' text-end tabular-nums'} dir="ltr">{money(x.amount, 2)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                ) : null}

                <section className="mb-6">
                    <h2 className="text-[14px] font-bold mb-2">{t('المصروفات ({n})', { n: data.outs.length })}</h2>
                    <table className="w-full text-[12px] border-collapse">
                        <thead>
                            <tr className="bg-paper">
                                <th className={th + ' w-8 text-start'}>#</th>
                                <th className={th + ' text-start'}>{t('التاريخ')}</th>
                                <th className={th + ' text-start'}>{t('الجهة')}</th>
                                <th className={th + ' text-start'}>{t('التصنيف')}</th>
                                <th className={th + ' text-start'}>{t('الدفع')}</th>
                                <th className={th + ' text-start'}>{t('المرجع')}</th>
                                <th className={th + ' text-end'}>{t('الضريبة')}</th>
                                <th className={th + ' text-end'}>{t('المبلغ')}</th>
                                <th className={th + ' w-12 text-center'}>{t('إيصال')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.outs.map(x => (
                                <tr key={x.id} className="print-avoid">
                                    <td className={th + ' text-center tabular-nums'}>{x.n}</td>
                                    <td className={th + ' whitespace-nowrap'}>{fullDate(x.d)}</td>
                                    <td className={th}>{x.vendor || '—'}{x.note ? <span className="block text-[10.5px] text-ink-3">{x.note}</span> : null}</td>
                                    <td className={th}>{x.cat_name || '—'}</td>
                                    <td className={th}>{t(METHODS[x.method] || '')}</td>
                                    <td className={th}>{x.ref || ''}</td>
                                    <td className={th + ' text-end tabular-nums'} dir="ltr">{x.vat ? money(x.vat, 2) : ''}</td>
                                    <td className={th + ' text-end tabular-nums font-semibold'} dir="ltr">{money(x.amount, 2)}</td>
                                    <td className={th + ' text-center'}>{x.file_id ? '✓' : '—'}</td>
                                </tr>
                            ))}
                            <tr className="bg-paper font-bold">
                                <td colSpan={6} className="border border-paper-2 px-2 py-2">{t('الإجمالي')}</td>
                                <td className="border border-paper-2 px-2 py-2 text-end tabular-nums" dir="ltr">{money(data.vat, 2)}</td>
                                <td className="border border-paper-2 px-2 py-2 text-end tabular-nums" dir="ltr">{money(data.spent, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                        </tbody>
                    </table>
                    {data.missing ? <p className="text-[11.5px] text-amber mt-2">{t('تنبيه: {n} مصروفٍ بلا إيصال مرفق.', { n: data.missing })}</p> : null}
                </section>

                {data.byCat.length ? (
                    <section className="mb-8 print-avoid">
                        <h2 className="text-[14px] font-bold mb-2">{t('حسب التصنيف')}</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-[12px]">
                            {data.byCat.map(([k, v]) => (
                                <div key={k} className="flex justify-between border-b border-dotted border-paper-2 py-1">
                                    <span>{k}</span><span className="tabular-nums font-semibold" dir="ltr">{money(v, 2)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                <Signatures name={me.name} profile={profile} />

                {imgs.length ? (
                    <section className="print-break pt-2">
                        <h2 className="text-[14px] font-bold mb-3">{t('الإيصالات المرفقة')}</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {imgs.map(x => (
                                <figure key={x.pg.id} className="print-avoid border border-paper-2 rounded-lg overflow-hidden">
                                    <img src={x.pg.url} alt="" className="w-full h-64 object-contain bg-paper" />
                                    <figcaption className="text-[11px] px-2 py-1.5 border-t border-paper-2 flex justify-between gap-2">
                                        <b>#{x.n}{x.pn ? '/' + x.pn : ''} · {x.vendor || '—'}</b><span className="tabular-nums" dir="ltr">{money(x.amount, 2)}</span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                        {pdfs.length ? <p className="text-[11.5px] text-ink-2 mt-3">{t('مستندات PDF مرفقة بالبنود: {list} — تُطبع منفصلة.', { list: pdfs.map(x => '#' + x.n).join('، ') })}</p> : null}
                    </section>
                ) : null}

                <DocFooter right={f.name} note={profile.report_note} />
            </article>
        </div>
    );
}
