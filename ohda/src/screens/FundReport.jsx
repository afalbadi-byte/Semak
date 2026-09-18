import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { call } from '../lib/api';
import { fullDate, METHODS, KINDS, money } from '../lib/fmt';
import { Money, Btn, Spinner } from '../ui';
import { useData } from '../App';

// تقرير تصفية العهدة: ورقةٌ تُسلَّم للمحاسب — ملخّص، ثم جدولٌ مرقَّم، ثم الإيصالات
// بأرقامها نفسها، فيُطابَق كل سطرٍ بإيصاله دون سؤال
export default function FundReport({ id }) {
    const { funds, me } = useData();
    const f = funds.find(x => Number(x.id) === id);
    const [rows, setRows] = useState(null);

    useEffect(() => { call('txns', { params: { fund: id } }).then(r => setRows(r.success ? r.data : [])); }, [id]);

    const data = useMemo(() => {
        if (!rows) return null;
        const asc = rows.slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id));
        const outs = asc.filter(t => t.type === 'out').map((t, i) => ({ ...t, n: i + 1 }));
        const ins = asc.filter(t => t.type === 'in');
        const byCat = {};
        outs.forEach(t => { const k = t.cat_name || 'بلا تصنيف'; byCat[k] = (byCat[k] || 0) + t.amount; });
        return {
            outs, ins, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
            spent: outs.reduce((s, t) => s + t.amount, 0), vat: outs.reduce((s, t) => s + t.vat, 0),
            received: ins.reduce((s, t) => s + t.amount, 0),
            from: asc.length ? asc[0].d : '', to: asc.length ? asc[asc.length - 1].d : '',
            missing: outs.filter(t => !t.file_id).length,
        };
    }, [rows]);

    if (!f || !data) return <Spinner />;
    const bal = data.received - data.spent;
    const imgs = data.outs.filter(t => t.file_id && t.file_mime !== 'application/pdf');
    const pdfs = data.outs.filter(t => t.file_id && t.file_mime === 'application/pdf');

    return (
        <div className="pt-2 lg:pt-0">
            <div className="no-print flex items-center gap-2 mb-4">
                <p className="text-[13px] text-ink-3 flex-1">اطبعه أو احفظه PDF من نافذة الطباعة</p>
                <Btn onClick={() => window.print()}><Printer size={17} />طباعة</Btn>
            </div>

            <article className="bg-white rounded-2xl lg:rounded-3xl border border-paper-2 p-6 lg:p-10 text-ink print:border-0 print:p-0 print:rounded-none">
                <header className="flex items-start justify-between border-b-2 border-ink pb-4 mb-5">
                    <div>
                        <h1 className="text-[22px] font-bold">تقرير تصفية عهدة</h1>
                        <p className="text-[14px] mt-1"><b>{f.name}</b> · {KINDS[f.kind]}</p>
                        <p className="text-[12px] text-ink-2 mt-0.5">صاحب العهدة: {me.name}</p>
                    </div>
                    <div className="text-left text-[12px] text-ink-2 leading-6">
                        <div>الفترة: {fullDate(data.from) || '—'} — {fullDate(data.to) || '—'}</div>
                        <div>تاريخ التقرير: {fullDate(new Date().toISOString().slice(0, 10))}</div>
                        <div>الحالة: {f.status === 'settled' ? 'مُصفّاة' : 'مفتوحة'}</div>
                    </div>
                </header>

                <section className="grid grid-cols-4 gap-3 mb-6 print-avoid">
                    {[['إجمالي المستلم', data.received], ['إجمالي المصروف', data.spent], ['منه ضريبة', data.vat], [bal >= 0 ? 'المتبقّي للإرجاع' : 'المستحقّ لصاحب العهدة', Math.abs(bal)]].map(([t, v], i) => (
                        <div key={t} className={'rounded-xl border p-3 ' + (i === 3 ? 'border-ink bg-paper' : 'border-paper-2')}>
                            <div className="text-[11px] text-ink-2">{t}</div>
                            <Money v={v} frac={2} className="block text-[17px] font-bold mt-0.5" />
                        </div>
                    ))}
                </section>

                {data.ins.length ? (
                    <section className="mb-6 print-avoid">
                        <h2 className="text-[14px] font-bold mb-2">المبالغ المستلمة</h2>
                        <table className="w-full text-[12px] border-collapse">
                            <thead><tr className="bg-paper text-right"><th className="border border-paper-2 px-2 py-1.5">التاريخ</th><th className="border border-paper-2 px-2 py-1.5">المصدر</th><th className="border border-paper-2 px-2 py-1.5">المرجع</th><th className="border border-paper-2 px-2 py-1.5 text-left">المبلغ</th></tr></thead>
                            <tbody>
                                {data.ins.map(t => (
                                    <tr key={t.id}><td className="border border-paper-2 px-2 py-1.5">{fullDate(t.d)}</td><td className="border border-paper-2 px-2 py-1.5">{t.vendor || '—'}</td>
                                        <td className="border border-paper-2 px-2 py-1.5">{t.ref || ''}</td><td className="border border-paper-2 px-2 py-1.5 text-left tabular-nums" dir="ltr">{money(t.amount, 2)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                ) : null}

                <section className="mb-6">
                    <h2 className="text-[14px] font-bold mb-2">المصروفات ({data.outs.length})</h2>
                    <table className="w-full text-[12px] border-collapse">
                        <thead>
                            <tr className="bg-paper text-right">
                                <th className="border border-paper-2 px-2 py-1.5 w-8">#</th>
                                <th className="border border-paper-2 px-2 py-1.5">التاريخ</th>
                                <th className="border border-paper-2 px-2 py-1.5">الجهة</th>
                                <th className="border border-paper-2 px-2 py-1.5">التصنيف</th>
                                <th className="border border-paper-2 px-2 py-1.5">الدفع</th>
                                <th className="border border-paper-2 px-2 py-1.5">المرجع</th>
                                <th className="border border-paper-2 px-2 py-1.5 text-left">الضريبة</th>
                                <th className="border border-paper-2 px-2 py-1.5 text-left">المبلغ</th>
                                <th className="border border-paper-2 px-2 py-1.5 w-12">إيصال</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.outs.map(t => (
                                <tr key={t.id} className="print-avoid">
                                    <td className="border border-paper-2 px-2 py-1.5 text-center tabular-nums">{t.n}</td>
                                    <td className="border border-paper-2 px-2 py-1.5 whitespace-nowrap">{fullDate(t.d)}</td>
                                    <td className="border border-paper-2 px-2 py-1.5">{t.vendor || '—'}{t.note ? <span className="block text-[10.5px] text-ink-3">{t.note}</span> : null}</td>
                                    <td className="border border-paper-2 px-2 py-1.5">{t.cat_name || '—'}</td>
                                    <td className="border border-paper-2 px-2 py-1.5">{METHODS[t.method] || ''}</td>
                                    <td className="border border-paper-2 px-2 py-1.5">{t.ref || ''}</td>
                                    <td className="border border-paper-2 px-2 py-1.5 text-left tabular-nums" dir="ltr">{t.vat ? money(t.vat, 2) : ''}</td>
                                    <td className="border border-paper-2 px-2 py-1.5 text-left tabular-nums font-semibold" dir="ltr">{money(t.amount, 2)}</td>
                                    <td className="border border-paper-2 px-2 py-1.5 text-center">{t.file_id ? '✓' : '—'}</td>
                                </tr>
                            ))}
                            <tr className="bg-paper font-bold">
                                <td colSpan={6} className="border border-paper-2 px-2 py-2">الإجمالي</td>
                                <td className="border border-paper-2 px-2 py-2 text-left tabular-nums" dir="ltr">{money(data.vat, 2)}</td>
                                <td className="border border-paper-2 px-2 py-2 text-left tabular-nums" dir="ltr">{money(data.spent, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                        </tbody>
                    </table>
                    {data.missing ? <p className="text-[11.5px] text-amber mt-2">تنبيه: {data.missing} مصروفٍ بلا إيصال مرفق.</p> : null}
                </section>

                {data.byCat.length ? (
                    <section className="mb-8 print-avoid">
                        <h2 className="text-[14px] font-bold mb-2">حسب التصنيف</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-[12px]">
                            {data.byCat.map(([k, v]) => (
                                <div key={k} className="flex justify-between border-b border-dotted border-paper-2 py-1">
                                    <span>{k}</span><span className="tabular-nums font-semibold" dir="ltr">{money(v, 2)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="grid grid-cols-2 gap-10 mt-10 mb-4 print-avoid text-[12px]">
                    {['صاحب العهدة', 'المراجِع / المعتمِد'].map(s => (
                        <div key={s}>
                            <div className="font-bold mb-8">{s}</div>
                            <div className="border-t border-ink pt-1 text-ink-3">الاسم والتوقيع والتاريخ</div>
                        </div>
                    ))}
                </section>

                {imgs.length ? (
                    <section className="print-break pt-2">
                        <h2 className="text-[14px] font-bold mb-3">الإيصالات المرفقة</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {imgs.map(t => (
                                <figure key={t.id} className="print-avoid border border-paper-2 rounded-lg overflow-hidden">
                                    <img src={t.file_url} alt="" className="w-full h-64 object-contain bg-paper" />
                                    <figcaption className="text-[11px] px-2 py-1.5 border-t border-paper-2 flex justify-between gap-2">
                                        <b>#{t.n} · {t.vendor || '—'}</b><span className="tabular-nums" dir="ltr">{money(t.amount, 2)}</span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                        {pdfs.length ? <p className="text-[11.5px] text-ink-2 mt-3">مستندات PDF مرفقة بالبنود: {pdfs.map(t => '#' + t.n).join('، ')} — تُطبع منفصلة.</p> : null}
                    </section>
                ) : null}

                <footer className="mt-8 pt-3 border-t border-paper-2 text-[10.5px] text-ink-3 flex justify-between">
                    <span>أُعدّ بتطبيق عُهدة</span><span>{f.name}</span>
                </footer>
            </article>
        </div>
    );
}
