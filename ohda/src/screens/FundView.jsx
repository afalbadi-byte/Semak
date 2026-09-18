import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileCheck2, FileDown, Pencil, Lock, Unlock, Paperclip, Wallet } from 'lucide-react';
import { call } from '../lib/api';
import { href, go } from '../lib/router';
import { shortDate, dayLabel, KINDS, fullDate } from '../lib/fmt';
import { Money, Card, Btn, Spinner, Empty, CatIcon, useToast } from '../ui';
import { useData } from '../App';
import { t as tr } from '../lib/i18n';
import { FundSheet } from './Funds';

// كشف العهدة: كل حركة ومعها الرصيد بعدها — كما يُقرأ كشف الحساب
export default function FundView({ id }) {
    const { funds, reloadFunds } = useData();
    const toast = useToast();
    const f = funds.find(x => Number(x.id) === id);
    const [rows, setRows] = useState(null);
    const [edit, setEdit] = useState(null);

    useEffect(() => {
        call('txns', { params: { fund: id } }).then(r => setRows(r.success ? r.data : []));
    }, [id, f && f.balance]);

    // الرصيد الجاري يُحسب من الأقدم إلى الأحدث ثم يُعرض الأحدث أولاً
    const lines = useMemo(() => {
        if (!rows) return [];
        const asc = rows.slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id));
        let bal = 0;
        return asc.map(t => { bal += t.type === 'in' ? t.amount : -t.amount; return { ...t, bal: Math.round(bal * 100) / 100 }; }).reverse();
    }, [rows]);

    const byCat = useMemo(() => {
        const m = {};
        (rows || []).filter(t => t.type === 'out').forEach(t => {
            const k = t.cat_id || 0;
            m[k] = m[k] || { id: k, name: t.cat_name || tr('بلا تصنيف'), color: t.cat_color || '#94a3b8', icon: t.cat_icon, total: 0 };
            m[k].total += t.amount;
        });
        return Object.values(m).sort((a, b) => b.total - a.total);
    }, [rows]);

    if (!f) return <Spinner />;
    const settled = f.status === 'settled';

    const toggle = async () => {
        if (!settled && !window.confirm(tr('تصفية العهدة؟ تُقفل فلا تظهر في الإدخال، ولا يُحذف منها شيء — وتُعاد فتحها متى شئت.'))) return;
        const r = await call('fund_settle', { body: { id, reopen: settled ? 1 : 0 } });
        if (r.success) { await reloadFunds(); toast(tr(settled ? 'أُعيد فتح العهدة' : 'صُفّيت العهدة')); }
    };

    return (
        <div className="space-y-5 pt-2 lg:pt-0">
            <Card className="overflow-hidden">
                <div className="p-5 text-white" style={{ background: `linear-gradient(135deg, ${f.color}, #083f39)` }}>
                    <div className="flex items-center gap-2 text-[13px] opacity-90">
                        <Wallet size={15} />{f.name}<span className="opacity-70">· {tr(KINDS[f.kind])}</span>
                        {settled ? <span className="ms-auto px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold">{tr('مُصفّاة')} {f.settled_at ? fullDate(f.settled_at.slice(0, 10)) : ''}</span> : null}
                    </div>
                    <div className="text-[12px] opacity-80 mt-4">{tr('الرصيد المتبقّي')}</div>
                    <Money v={f.balance} className="block text-[36px] font-bold leading-tight" />
                </div>
                <div className="grid grid-cols-3 divide-x rtl:divide-x-reverse divide-paper-2 text-center">
                    <a href={href('/txns', { fund: id, type: 'in' })} className="py-3 hover:bg-paper">
                        <div className="text-[11px] text-ink-3">{tr('المستلم')}</div><Money v={f.received} className="font-bold text-brand-700" />
                    </a>
                    <a href={href('/txns', { fund: id, type: 'out' })} className="py-3 hover:bg-paper">
                        <div className="text-[11px] text-ink-3">{tr('المصروف')}</div><Money v={f.spent} className="font-bold" />
                    </a>
                    <a href={href('/txns', { fund: id, noreceipt: 1 })} className="py-3 hover:bg-paper">
                        <div className="text-[11px] text-ink-3">{tr('بلا إيصال')}</div>
                        <div className={'font-bold ' + (Number(f.no_receipt) ? 'text-amber' : '')}>{f.no_receipt}</div>
                    </a>
                </div>
            </Card>

            <div className="flex flex-wrap gap-2">
                {!settled ? <a href={href('/txn/new', { type: 'out', fund: id })}><Btn><Plus size={17} />{tr('مصروف')}</Btn></a> : null}
                {!settled ? <a href={href('/txn/new', { type: 'in', fund: id })}><Btn kind="soft"><Plus size={17} />{tr('استلام مبلغ')}</Btn></a> : null}
                <a href={href('/statement', { fund: id })}><Btn kind="line"><FileDown size={17} />{tr('كشف حساب PDF')}</Btn></a>
                <a href={'#/fund/' + id + '/report'}><Btn kind="line"><FileCheck2 size={17} />{tr('تقرير التصفية')}</Btn></a>
                <Btn kind="ghost" onClick={() => setEdit(f)}><Pencil size={16} />{tr('تعديل')}</Btn>
                <Btn kind="ghost" onClick={toggle}>{settled ? <><Unlock size={16} />{tr('إعادة فتح')}</> : <><Lock size={16} />{tr('تصفية العهدة')}</>}</Btn>
            </div>

            {byCat.length ? (
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
                    {byCat.map(c => (
                        <a key={c.id} href={href('/txns', { fund: id, cat: c.id || -1 })}
                            className="shrink-0 bg-paper-card border border-paper-2 rounded-xl px-3 py-2 flex items-center gap-2 hover:border-brand-100">
                            <span style={{ color: c.color }}><CatIcon name={c.icon} size={15} /></span>
                            <span className="text-[12px] text-ink-2">{c.name}</span>
                            <Money v={c.total} cur={false} className="text-[13px] font-bold" />
                        </a>
                    ))}
                </div>
            ) : null}

            {!rows ? <Spinner /> : !rows.length ? (
                <Card><Empty icon={Wallet} title={tr('العهدة فارغة')} text={tr('ابدأ باستلام المبلغ المسلَّم لك، ثم سجّل المصاريف منه.')} /></Card>
            ) : (
                <>
                    <Card className="lg:hidden divide-y divide-paper-2">
                        {lines.map(t => (
                            <a key={t.id} href={'#/txn/' + t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] font-semibold truncate">{t.vendor || (t.type === 'in' ? tr('استلام مبلغ') : t.cat_name || tr('مصروف'))}</div>
                                    <div className="text-[11.5px] text-ink-3">{dayLabel(t.d)}{t.type === 'out' && !t.file_id ? <span className="text-amber"> · {tr('بلا إيصال')}</span> : null}</div>
                                </div>
                                <div className="text-end">
                                    <Money v={t.type === 'out' ? -t.amount : t.amount} sign className={'block text-[14px] font-bold ' + (t.type === 'in' ? 'text-brand-700' : '')} />
                                    <span className="block text-[11px] text-ink-3">{tr('الرصيد')} <Money v={t.bal} cur={false} /></span>
                                </div>
                            </a>
                        ))}
                    </Card>

                    <Card className="hidden lg:block overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead className="bg-paper text-ink-3 text-[12px]">
                                <tr className="text-start">
                                    <th className="px-4 py-2.5 font-semibold text-start">{tr('التاريخ')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{tr('البيان')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-start">{tr('التصنيف')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-end">{tr('وارد')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-end">{tr('صادر')}</th>
                                    <th className="px-3 py-2.5 font-semibold text-end">{tr('الرصيد')}</th>
                                    <th className="px-3 py-2.5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-paper-2">
                                {lines.map(t => (
                                    <tr key={t.id} className="hover:bg-paper cursor-pointer" onClick={() => go('/txn/' + t.id)}>
                                        <td className="px-4 py-2.5 whitespace-nowrap">{shortDate(t.d)}</td>
                                        <td className="px-3 py-2.5 font-semibold">{t.vendor || (t.type === 'in' ? tr('استلام مبلغ') : '—')}
                                            {t.note ? <span className="block text-[11px] font-normal text-ink-3 truncate max-w-[260px]">{t.note}</span> : null}</td>
                                        <td className="px-3 py-2.5 text-ink-2">{t.type === 'out' ? (t.cat_name || tr('بلا تصنيف')) : ''}</td>
                                        <td className="px-3 py-2.5 text-end">{t.type === 'in' ? <Money v={t.amount} cur={false} className="font-semibold text-brand-700" /> : ''}</td>
                                        <td className="px-3 py-2.5 text-end">{t.type === 'out' ? <Money v={t.amount} cur={false} className="font-semibold" /> : ''}</td>
                                        <td className={'px-3 py-2.5 text-end font-bold ' + (t.bal < 0 ? 'text-red-700' : '')}><Money v={t.bal} cur={false} /></td>
                                        <td className="px-3 py-2.5 text-center">{t.file_id ? <Paperclip size={14} className="inline text-ink-3" /> : t.type === 'out' ? <span className="text-amber text-[11px]">{tr('بلا')}</span> : null}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}

            <FundSheet f={edit} onClose={() => setEdit(null)} />
        </div>
    );
}
