import React, { useEffect, useState } from 'react';
import { FileDown, ExternalLink } from 'lucide-react';
import { call } from '../lib/api';
import { go } from '../lib/router';
import { fullDate, period, money, METHODS, KINDS } from '../lib/fmt';
import { Btn, Money, Spinner, inputCls } from '../ui';
import { useData } from '../App';

const PRESETS = [
    { k: 'month', t: 'هذا الشهر' }, { k: 'last', t: 'الشهر الماضي' },
    { k: 'q', t: 'الربع' }, { k: 'year', t: 'السنة' }, { k: 'all', t: 'كل الفترات' },
];

// كشف الحساب: رصيدٌ افتتاحي، والحركات بالرصيد الجاري، ولكل مستندٍ رابطه.
// يُحفظ PDF من نافذة الطباعة، والروابط تبقى قابلة للنقر داخل الملف.
export default function Statement({ q }) {
    const { funds } = useData();
    const [d, setD] = useState(null);
    const fund = q.fund || '';
    const from = q.from || '', to = q.to || '';

    useEffect(() => {
        setD(null);
        call('statement', { params: { fund, from, to } }).then(r => setD(r.success ? r : { error: r.message }));
    }, [fund, from, to]);

    const set = patch => go('/statement', { fund, from, to, ...patch });

    // اسم ملف PDF يُؤخذ من عنوان الصفحة لحظة الطباعة
    const pdf = () => {
        const old = document.title;
        const name = ['كشف حساب', d.fund ? d.fund.name : 'كل العُهد', (from || 'البداية') + ' إلى ' + (to || 'اليوم')].join(' - ');
        document.title = name;
        window.print();
        setTimeout(() => { document.title = old; }, 1500);
    };

    const ins = d && d.rows ? d.rows.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0) : 0;
    const outs = d && d.rows ? d.rows.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0) : 0;
    const vat = d && d.rows ? d.rows.filter(t => t.type === 'out').reduce((s, t) => s + t.vat, 0) : 0;
    const docs = d && d.rows ? d.rows.filter(t => t.doc_url).length : 0;
    const outsN = d && d.rows ? d.rows.filter(t => t.type === 'out').length : 0;

    return (
        <div className="pt-2 lg:pt-0">
            {/* ── أدوات الكشف — لا تُطبع ── */}
            <div className="no-print space-y-3 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select className={inputCls} value={fund} onChange={e => set({ fund: e.target.value })}>
                        <option value="">كل العُهد</option>
                        {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input type="date" className={inputCls} value={from} onChange={e => set({ from: e.target.value })} aria-label="من" />
                    <input type="date" className={inputCls} value={to} onChange={e => set({ to: e.target.value })} aria-label="إلى" />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                    {PRESETS.map(p => {
                        const r = p.k === 'all' ? { from: '', to: '' } : period(p.k);
                        const on = r.from === from && r.to === to;
                        return (
                            <button key={p.k} onClick={() => set(r)}
                                className={'shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold ' + (on ? 'bg-ink text-white' : 'bg-paper-card border border-paper-2 text-ink-2')}>
                                {p.t}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-[12px] text-ink-3 flex-1 leading-5">
                        في نافذة الطباعة اختر «حفظ PDF» — على الآيفون: مشاركة ثم «حفظ في الملفات». روابط المستندات تبقى قابلة للنقر داخل الملف.
                    </p>
                    <Btn onClick={pdf} disabled={!d || !d.rows}><FileDown size={17} />تنزيل PDF</Btn>
                </div>
            </div>

            {!d ? <Spinner /> : d.error ? <p className="text-center text-red-700 py-10">{d.error}</p> : (
                <article className="bg-white rounded-2xl lg:rounded-3xl border border-paper-2 p-5 lg:p-10 text-ink print:border-0 print:p-0 print:rounded-none">
                    <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4 mb-5">
                        <div>
                            <h1 className="text-[22px] font-bold">كشف حساب</h1>
                            <p className="text-[14px] mt-1"><b>{d.fund ? d.fund.name : 'كل العُهد'}</b>{d.fund ? ' · ' + (KINDS[d.fund.kind] || '') : ''}</p>
                            <p className="text-[12px] text-ink-2 mt-0.5">صاحب الحساب: {d.user}</p>
                        </div>
                        <div className="text-left text-[12px] text-ink-2 leading-6 shrink-0">
                            <div>من: {from ? fullDate(from) : 'البداية'}</div>
                            <div>إلى: {to ? fullDate(to) : 'اليوم'}</div>
                            <div>أُصدر: {fullDate(new Date().toISOString().slice(0, 10))}</div>
                        </div>
                    </header>

                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6 print:grid-cols-4 print-avoid">
                        {[['الرصيد الافتتاحي', d.opening], ['الوارد', ins], ['الصادر', outs], ['الرصيد الختامي', d.closing]].map(([t, v], i) => (
                            <div key={t} className={'rounded-xl border p-3 ' + (i === 3 ? 'border-ink bg-paper' : 'border-paper-2')}>
                                <div className="text-[11px] text-ink-2">{t}</div>
                                <Money v={v} frac={2} className={'block text-[17px] font-bold mt-0.5 ' + (v < 0 ? 'text-red-700' : '')} />
                            </div>
                        ))}
                    </section>

                    <table className="w-full text-[11.5px] border-collapse">
                        <thead>
                            <tr className="bg-paper text-right">
                                <th className="border border-paper-2 px-1.5 py-1.5 w-7">#</th>
                                <th className="border border-paper-2 px-1.5 py-1.5">التاريخ</th>
                                <th className="border border-paper-2 px-1.5 py-1.5">البيان</th>
                                <th className="border border-paper-2 px-1.5 py-1.5">التصنيف</th>
                                {!d.fund ? <th className="border border-paper-2 px-1.5 py-1.5">العهدة</th> : null}
                                <th className="border border-paper-2 px-1.5 py-1.5 text-left">وارد</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-left">صادر</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 text-left">الرصيد</th>
                                <th className="border border-paper-2 px-1.5 py-1.5 w-16">المستند</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-paper/60">
                                <td className="border border-paper-2 px-1.5 py-1.5" />
                                <td className="border border-paper-2 px-1.5 py-1.5 whitespace-nowrap">{from ? fullDate(from) : '—'}</td>
                                <td colSpan={d.fund ? 4 : 5} className="border border-paper-2 px-1.5 py-1.5 font-semibold">رصيدٌ مرحَّل</td>
                                <td className="border border-paper-2 px-1.5 py-1.5 text-left tabular-nums font-semibold" dir="ltr">{money(d.opening, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                            {d.rows.map((t, i) => (
                                <tr key={t.id} className="print-avoid">
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-center tabular-nums">{i + 1}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 whitespace-nowrap">{fullDate(t.d)}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5">
                                        <span className="font-semibold">{t.vendor || (t.type === 'in' ? 'استلام مبلغ' : 'مصروف')}</span>
                                        {t.ref ? <span className="text-ink-3"> · {t.ref}</span> : null}
                                        {t.type === 'out' && t.method ? <span className="text-ink-3"> · {METHODS[t.method]}</span> : null}
                                        {t.note ? <span className="block text-[10.5px] text-ink-3">{t.note}</span> : null}
                                    </td>
                                    <td className="border border-paper-2 px-1.5 py-1.5">{t.type === 'out' ? (t.cat_name || '—') : ''}</td>
                                    {!d.fund ? <td className="border border-paper-2 px-1.5 py-1.5">{t.fund_name || '—'}</td> : null}
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-left tabular-nums text-brand-700" dir="ltr">{t.type === 'in' ? money(t.amount, 2) : ''}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-left tabular-nums" dir="ltr">{t.type === 'out' ? money(t.amount, 2) : ''}</td>
                                    <td className={'border border-paper-2 px-1.5 py-1.5 text-left tabular-nums font-semibold ' + (t.balance < 0 ? 'text-red-700' : '')} dir="ltr">{money(t.balance, 2)}</td>
                                    <td className="border border-paper-2 px-1.5 py-1.5 text-center">
                                        {t.doc_url ? (
                                            <a href={t.doc_url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-0.5 text-blue-700 underline underline-offset-2 font-semibold">
                                                {t.on_drive ? 'درايف' : 'عرض'}<ExternalLink size={10} className="print:hidden" />
                                            </a>
                                        ) : <span className="text-ink-3">—</span>}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-paper font-bold">
                                <td colSpan={d.fund ? 4 : 5} className="border border-paper-2 px-1.5 py-2">الإجمالي ({d.rows.length} حركة)</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-left tabular-nums text-brand-700" dir="ltr">{money(ins, 2)}</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-left tabular-nums" dir="ltr">{money(outs, 2)}</td>
                                <td className="border border-paper-2 px-1.5 py-2 text-left tabular-nums" dir="ltr">{money(d.closing, 2)}</td>
                                <td className="border border-paper-2" />
                            </tr>
                        </tbody>
                    </table>

                    <section className="mt-4 text-[11.5px] text-ink-2 leading-6 print-avoid">
                        <div>ضريبة القيمة المضافة ضمن الصادر: <b className="tabular-nums" dir="ltr">{money(vat, 2)}</b></div>
                        <div>المستندات المرفقة: {docs} من {d.rows.length} حركة{outsN - d.rows.filter(t => t.type === 'out' && t.doc_url).length > 0
                            ? <span className="text-amber"> — {outsN - d.rows.filter(t => t.type === 'out' && t.doc_url).length} مصروفٍ بلا مستند</span> : null}</div>
                        <div className="text-ink-3 text-[10.5px] mt-1">روابط «عرض» صالحةٌ سنةً من تاريخ الإصدار، وروابط «درايف» تفتح الملف في Google Drive لمن له صلاحية على المجلد.</div>
                    </section>

                    <footer className="mt-8 pt-3 border-t border-paper-2 text-[10.5px] text-ink-3 flex justify-between">
                        <span>أُعدّ بتطبيق عُهدة</span><span>{d.fund ? d.fund.name : 'كل العُهد'}</span>
                    </footer>
                </article>
            )}
        </div>
    );
}
