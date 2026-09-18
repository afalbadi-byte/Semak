import React, { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { call } from '../lib/api';
import { href } from '../lib/router';
import { period } from '../lib/fmt';
import { Money, Card, Btn, Sheet, Field, inputCls, Progress, CatIcon, ICONS, PALETTE, Spinner, useToast } from '../ui';
import { useData } from '../App';
import { t } from '../lib/i18n';

// الميزانية: سقفٌ شهري لكل تصنيف، ويُقاس عليه صرف هذا الشهر
export default function Budgets() {
    const { cats, reloadCats } = useData();
    const [used, setUsed] = useState(null);
    const [edit, setEdit] = useState(null);
    const month = period('month');

    useEffect(() => {
        call('dashboard', { params: month }).then(r => {
            if (r.success) setUsed(Object.fromEntries(r.by_cat.map(c => [c.id || 0, c.total])));
        });
    }, [cats]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (!used) return <Spinner />;
    const totBudget = cats.reduce((s, c) => s + c.budget, 0);
    const totUsed = Object.values(used).reduce((s, v) => s + v, 0);
    const budgeted = cats.filter(c => c.budget > 0);
    const usedBudgeted = budgeted.reduce((s, c) => s + (used[c.id] || 0), 0);
    const day = new Date().getDate(), days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    return (
        <div className="space-y-5 pt-2 lg:pt-0">
            <div className="grid lg:grid-cols-3 gap-3">
                <a href={href('/txns', { type: 'out', ...month })} className="bg-paper-card rounded-2xl border border-paper-2 p-4 lg:col-span-2">
                    <div className="flex justify-between text-[12px] text-ink-3 font-semibold">
                        <span>{t('مصروف هذا الشهر من الميزانية')}</span><span>{t('اليوم {a} من {b}', { a: day, b: days })}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <Money v={usedBudgeted} className="text-[28px] font-bold" />
                        {totBudget ? <span className="text-ink-3 text-[14px]">{t('من')} <Money v={totBudget} /></span> : null}
                    </div>
                    {totBudget ? (
                        <div className="relative mt-3">
                            <Progress used={usedBudgeted} total={totBudget} />
                            {/* علامة موضع اليوم من الشهر: ما قبلها صرفٌ في موعده */}
                            <span className="absolute -top-1 h-4 w-0.5 bg-ink/40 rounded" style={{ insetInlineStart: (day / days) * 100 + '%' }} />
                        </div>
                    ) : <p className="text-[12.5px] text-ink-3 mt-2">{t('حدّد ميزانية لتصنيفاتك ليظهر هنا تقدّمك وتنبيهك قبل التجاوز.')}</p>}
                </a>
                <a href={href('/txns', { type: 'out', ...month })} className="bg-paper-card rounded-2xl border border-paper-2 p-4">
                    <div className="text-[12px] text-ink-3 font-semibold">{t('كل مصروف الشهر')}</div>
                    <Money v={totUsed} className="block text-[28px] font-bold mt-1" />
                    <div className="text-[12px] text-ink-3 mt-1">{t('منه خارج الميزانيات')} <Money v={totUsed - usedBudgeted} cur={false} /></div>
                </a>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-bold text-ink-2 px-1">{t('التصنيفات')}</h2>
                <Btn kind="soft" onClick={() => setEdit({ name: '', icon: 'tag', color: PALETTE[cats.length % PALETTE.length], budget: 0 })}><Plus size={17} />{t('تصنيف')}</Btn>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
                {cats.map(c => {
                    const u = used[c.id] || 0;
                    return (
                        <Card key={c.id} className="p-4">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + '1a', color: c.color }}>
                                    <CatIcon name={c.icon} size={18} />
                                </span>
                                <a href={href('/txns', { cat: c.id, ...month })} className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{c.name}</div>
                                    <div className="text-[12px] text-ink-3">
                                        <Money v={u} cur={false} />{c.budget ? <> {t('من')} <Money v={c.budget} cur={false} /></> : ' · ' + t('بلا سقف')}
                                    </div>
                                </a>
                                <button onClick={() => setEdit(c)} className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-3" aria-label={t('تعديل')}><Pencil size={15} /></button>
                            </div>
                            {c.budget ? <div className="mt-3"><Progress used={u} total={c.budget} color={c.color} /></div> : null}
                        </Card>
                    );
                })}
            </div>

            <CatSheet c={edit} onClose={() => setEdit(null)} onSaved={reloadCats} />
        </div>
    );
}

function CatSheet({ c, onClose, onSaved }) {
    const toast = useToast();
    const [v, setV] = useState(c);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setV(c); }, [c]);
    if (!c || !v) return null;
    const save = async del => {
        if (del && !window.confirm(t('حذف التصنيف؟ تبقى حركاته مسجّلة بلا تصنيف.'))) return;
        setBusy(true);
        const r = await call('cat_save', { body: { ...v, budget: Number(v.budget) || 0, delete: del ? 1 : 0 } });
        setBusy(false);
        if (!r.success) { toast(t(r.message || 'تعذّر الحفظ'), 'err'); return; }
        await onSaved(); toast(t(del ? 'حُذف التصنيف' : 'حُفظ')); onClose();
    };
    return (
        <Sheet open={!!c} onClose={onClose} title={t(v.id ? 'تعديل التصنيف' : 'تصنيف جديد')}>
            <div className="space-y-4">
                <Field label={t('الاسم')}><input className={inputCls} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></Field>
                <Field label={t('الميزانية الشهرية')} hint={t('اتركها صفراً إن لم ترد سقفاً')}>
                    <input className={inputCls} inputMode="decimal" dir="ltr" value={v.budget || ''} placeholder="0"
                        onChange={e => setV({ ...v, budget: e.target.value.replace(/[^\d.]/g, '') })} />
                </Field>
                <div>
                    <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('الأيقونة')}</span>
                    <div className="grid grid-cols-8 gap-1.5">
                        {Object.keys(ICONS).map(k => (
                            <button key={k} type="button" onClick={() => setV({ ...v, icon: k })}
                                className={'h-10 rounded-xl flex items-center justify-center border ' + (v.icon === k ? 'border-ink bg-paper-card' : 'border-transparent bg-paper-2 text-ink-2')}
                                style={v.icon === k ? { color: v.color } : undefined}>
                                <CatIcon name={k} size={17} />
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('اللون')}</span>
                    <div className="flex flex-wrap gap-2">
                        {PALETTE.map(col => (
                            <button key={col} type="button" onClick={() => setV({ ...v, color: col })}
                                className={'w-9 h-9 rounded-xl border-2 ' + (v.color === col ? 'border-ink' : 'border-transparent')} style={{ background: col }} />
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Btn className="flex-1" busy={busy} onClick={() => save(false)}>{t('حفظ')}</Btn>
                    {v.id ? <Btn kind="danger" onClick={() => save(true)}>{t('حذف')}</Btn> : null}
                </div>
            </div>
        </Sheet>
    );
}
