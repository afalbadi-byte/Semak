import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileWarning, TrendingDown, TrendingUp, ArrowLeft, Plus, Wallet, ReceiptText } from 'lucide-react';
import { call } from '../lib/api';
import { href } from '../lib/router';
import { money, period, dayLabel, shortDate, monthLabel, METHODS } from '../lib/fmt';
import { Money, Card, LinkCard, Section, Donut, Bars, Progress, CatIcon, Spinner, Empty, Btn } from '../ui';
import { useData } from '../App';

const PERIODS = [
    { k: 'month', t: 'هذا الشهر' }, { k: 'last', t: 'الشهر الماضي' },
    { k: 'q', t: 'الربع' }, { k: 'year', t: 'السنة' }, { k: 'all', t: 'الكل' },
];

export default function Dashboard({ q }) {
    const { funds } = useData();
    const pk = q.p || 'month';
    const fund = q.fund || '';
    const { from, to } = period(pk);
    const [d, setD] = useState(null);
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        let live = true;
        setD(null);
        Promise.all([
            call('dashboard', { params: { from, to, fund } }),
            call('txns', { params: { fund } }),
        ]).then(([a, b]) => {
            if (!live) return;
            if (a.success) setD(a);
            if (b.success) setRecent(b.data.slice(0, 6));
        });
        return () => { live = false; };
    }, [from, to, fund]);

    // الأيام كلّها تظهر حتى الفارغ منها، فيُقرأ الإيقاع لا مجرّد النقاط
    const daily = useMemo(() => {
        if (!d) return [];
        const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
        if (days > 62) return null;
        const map = Object.fromEntries(d.daily.map(x => [x.d, x.total]));
        const out = [];
        for (let i = 0; i < days; i++) {
            const dt = new Date(new Date(from + 'T12:00:00').getTime() + i * 86400000);
            const s = dt.toISOString().slice(0, 10);
            out.push({ d: s, value: map[s] || 0, title: shortDate(s) + ' — ' + money(map[s] || 0) });
        }
        return out;
    }, [d, from, to]);

    const q2 = extra => ({ fund, from, to, ...extra });
    const setQ = extra => href('/', { p: pk, fund, ...extra });

    const openFunds = funds.filter(f => f.status !== 'settled');
    const change = d && d.prev_spent > 0 ? ((d.spent - d.prev_spent) / d.prev_spent) * 100 : null;

    return (
        <div className="space-y-5 pt-2 lg:pt-0">
            {/* الفترة والعهدة */}
            <div className="space-y-2">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                    {PERIODS.map(p => (
                        <a key={p.k} href={setQ({ p: p.k })}
                            className={'shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center transition ' +
                                (pk === p.k ? 'bg-ink text-white' : 'bg-paper-card border border-paper-2 text-ink-2')}>
                            {p.t}
                        </a>
                    ))}
                </div>
                {funds.length > 1 ? (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                        <a href={setQ({ fund: '' })}
                            className={'shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold flex items-center ' +
                                (!fund ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>كل العُهد</a>
                        {funds.map(f => (
                            <a key={f.id} href={setQ({ fund: f.id })}
                                className={'shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold flex items-center gap-1.5 ' +
                                    (String(fund) === String(f.id) ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>
                                <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />{f.name}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>

            {!d ? <Spinner /> : (
                <>
                    {/* الرقم الأهمّ */}
                    <div className="grid lg:grid-cols-3 gap-3">
                        <LinkCard href={href('/txns', q2({ type: 'out' }))} className="p-5 lg:col-span-1 bg-gradient-to-bl from-brand to-brand-800 !border-0 text-white">
                            <div className="text-[12px] font-semibold opacity-80">المصروف</div>
                            <Money v={d.spent} className="block text-[34px] font-bold mt-1 leading-tight" />
                            <div className="flex items-center gap-3 mt-3 text-[12px]">
                                <span className="opacity-80">{d.n_out} حركة</span>
                                {change !== null ? (
                                    <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15'}>
                                        {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                        {Math.abs(change).toFixed(0)}٪ عن الفترة السابقة
                                    </span>
                                ) : null}
                            </div>
                        </LinkCard>
                        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 lg:col-span-2">
                            <LinkCard href={href('/txns', q2({ type: 'in' }))} className="p-4">
                                <div className="text-[12px] text-ink-3 font-semibold">المستلم</div>
                                <Money v={d.received} className="block text-[22px] font-bold mt-1 text-brand-700" />
                            </LinkCard>
                            <LinkCard href={href('/txns', q2({ type: 'out' }))} className="p-4">
                                <div className="text-[12px] text-ink-3 font-semibold">ضريبة القيمة المضافة</div>
                                <Money v={d.vat} className="block text-[22px] font-bold mt-1" />
                            </LinkCard>
                            <LinkCard href={href('/txns', q2({ noreceipt: 1 }))} className="p-4">
                                <div className="text-[12px] text-ink-3 font-semibold flex items-center gap-1">بلا إيصال</div>
                                <div className={'text-[22px] font-bold mt-1 ' + (d.no_receipt ? 'text-amber' : 'text-ink')}>{d.no_receipt}</div>
                            </LinkCard>
                            <LinkCard href={href('/txns', q2({}))} className="p-4">
                                <div className="text-[12px] text-ink-3 font-semibold">متوسط اليوم</div>
                                <Money v={daily ? d.spent / Math.max(1, daily.length) : d.spent / 30} frac={0} className="block text-[22px] font-bold mt-1" />
                            </LinkCard>
                        </div>
                    </div>

                    {/* تنبيهات */}
                    {(d.no_receipt > 0 || d.budgets.some(b => b.used >= b.budget * 0.8)) ? (
                        <div className="space-y-2">
                            {d.budgets.filter(b => b.used >= b.budget * 0.8).map(b => (
                                <a key={b.id} href={href('/txns', { cat: b.id, ...period('month') })}
                                    className={'flex items-center gap-3 p-3 rounded-2xl border text-[13px] ' +
                                        (b.used > b.budget ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-900')}>
                                    <AlertTriangle size={17} className="shrink-0" />
                                    <span className="flex-1">
                                        {b.used > b.budget ? 'تجاوزتَ' : 'اقتربتَ من'} ميزانية <b>{b.name}</b> هذا الشهر:
                                        {' '}<Money v={b.used} cur={false} /> من <Money v={b.budget} cur={false} />
                                    </span>
                                    <ArrowLeft size={15} />
                                </a>
                            ))}
                            {d.no_receipt > 0 ? (
                                <a href={href('/txns', q2({ noreceipt: 1 }))}
                                    className="flex items-center gap-3 p-3 rounded-2xl border bg-paper-card border-paper-2 text-[13px] text-ink-2">
                                    <FileWarning size={17} className="shrink-0 text-amber" />
                                    <span className="flex-1">{d.no_receipt} مصروفٍ بلا إيصال — أرفقها قبل التصفية</span>
                                    <ArrowLeft size={15} />
                                </a>
                            ) : null}
                        </div>
                    ) : null}

                    {/* أرصدة العُهد */}
                    {openFunds.length ? (
                        <Section title="أرصدة العُهد" action={<a href="#/funds" className="text-[12px] font-semibold text-brand">الكل</a>}>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {openFunds.slice(0, 4).map(f => (
                                    <LinkCard key={f.id} href={'#/fund/' + f.id} className="p-4">
                                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 truncate">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />{f.name}
                                        </div>
                                        <Money v={f.balance} className={'block text-[20px] font-bold mt-1 ' + (f.balance < 0 ? 'text-red-700' : '')} />
                                        <div className="text-[11px] text-ink-3 mt-0.5">مستلم <Money v={f.received} cur={false} /> · مصروف <Money v={f.spent} cur={false} /></div>
                                    </LinkCard>
                                ))}
                            </div>
                        </Section>
                    ) : null}

                    {d.n_out === 0 && d.received === 0 ? (
                        <Card>
                            <Empty icon={ReceiptText} title="لا حركات في هذه الفترة"
                                text="صوّر أول إيصال ويقرأه التطبيق لك: الجهة والتاريخ والمبلغ والضريبة."
                                action={<a href={href('/txn/new', { type: 'out' })}><Btn><Plus size={17} />مصروف جديد</Btn></a>} />
                        </Card>
                    ) : (
                        <div className="grid lg:grid-cols-5 gap-5">
                            {/* التصنيفات */}
                            <Section title="أين ذهب المال" className="lg:col-span-2">
                                <Card className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Donut data={d.by_cat.map(c => ({ ...c, value: c.total }))} size={150} stroke={24}
                                            hrefFor={c => href('/txns', q2({ cat: c.id || -1 }))}
                                            center={<text x="75" y="80" textAnchor="middle" className="fill-ink" style={{ fontSize: 12, fontWeight: 700 }}>
                                                {d.by_cat.length} تصنيف</text>} />
                                        <div className="flex-1 min-w-0 space-y-1">
                                            {d.by_cat.slice(0, 6).map(c => (
                                                <a key={c.id || 0} href={href('/txns', q2({ cat: c.id || -1 }))}
                                                    className="flex items-center gap-2 text-[12.5px] py-1 rounded-lg hover:bg-paper px-1 -mx-1">
                                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                                                    <span className="flex-1 truncate text-ink-2">{c.name}</span>
                                                    <Money v={c.total} cur={false} className="font-semibold" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            </Section>

                            {/* الإيقاع */}
                            <Section title={daily ? 'المصروف يوماً بيوم' : 'المصروف شهراً بشهر'} className="lg:col-span-3">
                                <Card className="p-4">
                                    {daily ? (
                                        <Bars data={daily} height={150} labelEvery={Math.ceil(daily.length / 8)}
                                            label={x => String(Number(x.d.slice(8)))}
                                            hrefFor={x => href('/txns', { fund, from: x.d, to: x.d })} />
                                    ) : (
                                        <Bars data={d.months.map(m => ({ ...m, value: m.spent, title: m.m }))} height={150}
                                            label={x => monthLabel(x.m)}
                                            hrefFor={x => href('/txns', { fund, from: x.m + '-01', to: x.m + '-31' })} />
                                    )}
                                </Card>
                            </Section>
                        </div>
                    )}

                    {/* الميزانيات */}
                    {d.budgets.length ? (
                        <Section title="ميزانيات هذا الشهر" action={<a href="#/budgets" className="text-[12px] font-semibold text-brand">تعديل</a>}>
                            <Card className="p-4 grid lg:grid-cols-2 gap-x-8 gap-y-4">
                                {d.budgets.map(b => (
                                    <a key={b.id} href={href('/txns', { cat: b.id, ...period('month') })} className="block">
                                        <div className="flex items-center gap-2 text-[13px] mb-1.5">
                                            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: b.color + '1a', color: b.color }}>
                                                <CatIcon name={b.icon} size={14} />
                                            </span>
                                            <span className="flex-1 font-semibold">{b.name}</span>
                                            <span className="text-ink-3 text-[12px]"><Money v={b.used} cur={false} /> / <Money v={b.budget} cur={false} /></span>
                                        </div>
                                        <Progress used={b.used} total={b.budget} color={b.color} />
                                    </a>
                                ))}
                            </Card>
                        </Section>
                    ) : null}

                    {/* ما يُضاف على الشاشة الكبيرة: الجهات وطرق الدفع والاتجاه */}
                    <div className="hidden lg:grid grid-cols-3 gap-5">
                        <Section title="أكثر الجهات صرفاً" className="col-span-2">
                            <Card className="divide-y divide-paper-2">
                                {d.vendors.length ? d.vendors.map((v, i) => (
                                    <a key={v.vendor} href={href('/txns', q2({ vendor: v.vendor }))}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper text-[13px]">
                                        <span className="w-6 text-ink-3 tabular-nums">{i + 1}</span>
                                        <span className="flex-1 font-semibold truncate">{v.vendor}</span>
                                        <span className="text-ink-3 text-[12px]">{v.n} مرّة</span>
                                        <span className="w-40"><Progress used={v.total} total={d.vendors[0].total} /></span>
                                        <Money v={v.total} className="w-28 text-left font-semibold" />
                                    </a>
                                )) : <p className="p-6 text-center text-[13px] text-ink-3">لا جهات مسجّلة بعد</p>}
                            </Card>
                        </Section>
                        <Section title="طرق الدفع">
                            <Card className="p-4 space-y-3">
                                {d.methods.map(m => (
                                    <a key={m.method} href={href('/txns', q2({ method: m.method }))} className="block">
                                        <div className="flex justify-between text-[13px] mb-1">
                                            <span className="font-semibold">{METHODS[m.method] || m.method}</span>
                                            <Money v={m.total} />
                                        </div>
                                        <Progress used={m.total} total={d.spent} />
                                    </a>
                                ))}
                                {!d.methods.length ? <p className="text-center text-[13px] text-ink-3 py-4">—</p> : null}
                            </Card>
                        </Section>
                    </div>

                    {/* آخر الحركات */}
                    <Section title="آخر الحركات" action={<a href={href('/txns', { fund })} className="text-[12px] font-semibold text-brand">عرض الكل</a>}>
                        <Card className="divide-y divide-paper-2">
                            {recent.map(t => <TxnRow key={t.id} t={t} />)}
                            {!recent.length ? <p className="p-6 text-center text-[13px] text-ink-3">لا حركات بعد</p> : null}
                        </Card>
                    </Section>
                </>
            )}
        </div>
    );
}

export function TxnRow({ t, showDate = true }) {
    const out = t.type === 'out';
    return (
        <a href={'#/txn/' + t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-paper transition">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={out ? { background: (t.cat_color || '#94a3b8') + '1a', color: t.cat_color || '#64748b' } : { background: '#e7f3f1', color: '#0f6b61' }}>
                {out ? <CatIcon name={t.cat_icon} size={18} /> : <Wallet size={18} />}
            </span>
            <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold truncate">{t.vendor || (out ? (t.cat_name || 'مصروف') : 'استلام مبلغ')}</span>
                <span className="block text-[12px] text-ink-3 truncate">
                    {showDate ? dayLabel(t.d) + ' · ' : ''}{out ? (t.cat_name || 'بلا تصنيف') : (t.fund_name || '')}
                    {out && !t.file_id ? <span className="text-amber"> · بلا إيصال</span> : null}
                </span>
            </span>
            <Money v={out ? -t.amount : t.amount} sign className={'text-[15px] font-bold ' + (out ? 'text-ink' : 'text-brand-700')} />
        </a>
    );
}
