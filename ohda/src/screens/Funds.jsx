import React, { useState } from 'react';
import { Plus, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api';
import { href, go } from '../lib/router';
import { KINDS } from '../lib/fmt';
import { Money, Card, Btn, Sheet, Field, inputCls, Seg, PALETTE, Empty, useToast } from '../ui';
import { useData } from '../App';
import { t } from '../lib/i18n';

// العُهد: لكل غرضٍ صندوقه — عهدة العمل، سماك، مصاريف المدارس — ورصيدٌ لا يختلط بغيره
export default function Funds() {
    const { funds } = useData();
    const [edit, setEdit] = useState(null);
    const open = funds.filter(f => f.status !== 'settled');
    const done = funds.filter(f => f.status === 'settled');

    return (
        <div className="space-y-5 pt-2 lg:pt-0">
            <NoFundBanner />
            <div className="flex items-center justify-between">
                <p className="text-[13px] text-ink-3">{t('لكل غرضٍ عهدته ورصيده المستقل')}</p>
                <Btn kind="soft" onClick={() => setEdit({ name: '', kind: 'custody', color: PALETTE[open.length % PALETTE.length], note: '' })}>
                    <Plus size={17} />{t('عهدة جديدة')}
                </Btn>
            </div>

            {!funds.length ? (
                <Card><Empty icon={Wallet} title={t('لا عُهد بعد')} text={t('أنشئ عهدة لكل غرض، واستلم فيها المبالغ وسجّل منها المصاريف.')} /></Card>
            ) : null}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {open.map(f => <FundCard key={f.id} f={f} />)}
            </div>

            {done.length ? (
                <section>
                    <h2 className="text-[13px] font-bold text-ink-2 mb-2 px-1">{t('عُهدٌ مُصفّاة')}</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-80">
                        {done.map(f => <FundCard key={f.id} f={f} />)}
                    </div>
                </section>
            ) : null}

            <FundSheet f={edit} onClose={() => setEdit(null)} />
        </div>
    );
}

// حركاتٌ حُفظت بلا عهدة: موجودة في «الحركات» لكنها لا تُخصم من رصيد أيّ عهدة.
// نعرضها هنا صراحةً ونطلب تسكينها، فلا يبقى مصروفٌ معلّقاً بلا حساب.
export function NoFundBanner() {
    const { noFund } = useData();
    if (!noFund || !noFund.n) return null;
    return (
        <Card className="p-4 border-amber-200 bg-amber-50/60">
            <div className="flex items-start gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><AlertTriangle size={17} /></span>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-amber-900">{t('{n} حركة بلا عهدة', { n: noFund.n })}</div>
                    <div className="text-[12.5px] text-amber-800 leading-6">
                        {t('مسجّلة ومحفوظة، لكنها لا تُخصم من رصيد أيّ عهدة حتى تُسكَّن.')}
                        {noFund.out ? <> {t('مصروف')} <Money v={noFund.out} cur={false} className="font-bold" />.</> : null}
                    </div>
                    <a href={href('/txns', { fund: -1 })} className="inline-block mt-2">
                        <Btn kind="soft" className="!h-9 !px-3 text-[13px]"><Wallet size={15} />{t('سكّنها الآن')}</Btn>
                    </a>
                </div>
            </div>
        </Card>
    );
}

function FundCard({ f }) {
    const used = f.received > 0 ? Math.min(100, (f.spent / f.received) * 100) : 0;
    return (
        <Card className="overflow-hidden">
            <a href={'#/fund/' + f.id} className="block p-4 hover:bg-paper/60">
                <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: f.color }}><Wallet size={17} /></span>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{f.name}</div>
                        <div className="text-[11px] text-ink-3">{t(KINDS[f.kind] || '')}</div>
                    </div>
                    {f.status === 'settled' ? <span className="text-[11px] font-semibold text-brand flex items-center gap-1"><CheckCircle2 size={13} />{t('مُصفّاة')}</span> : null}
                </div>
                <div className="mt-4 text-[12px] text-ink-3 font-semibold">{t('الرصيد')}</div>
                <Money v={f.balance} className={'block text-[26px] font-bold ' + (f.balance < 0 ? 'text-red-700' : '')} />
                <div className="h-1.5 rounded-full bg-paper-2 mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: used + '%', background: f.color }} />
                </div>
            </a>
            <div className="grid grid-cols-3 border-t border-paper-2 text-center divide-x rtl:divide-x-reverse divide-paper-2">
                <a href={href('/txns', { fund: f.id, type: 'in' })} className="py-2.5 hover:bg-paper">
                    <div className="text-[10.5px] text-ink-3">{t('مستلم')}</div>
                    <Money v={f.received} cur={false} className="text-[13px] font-bold text-brand-700" />
                </a>
                <a href={href('/txns', { fund: f.id, type: 'out' })} className="py-2.5 hover:bg-paper">
                    <div className="text-[10.5px] text-ink-3">{t('مصروف')}</div>
                    <Money v={f.spent} cur={false} className="text-[13px] font-bold" />
                </a>
                <a href={href('/txns', { fund: f.id, noreceipt: 1 })} className="py-2.5 hover:bg-paper">
                    <div className="text-[10.5px] text-ink-3">{t('بلا إيصال')}</div>
                    <div className={'text-[13px] font-bold ' + (Number(f.no_receipt) ? 'text-amber' : '')}>{f.no_receipt}</div>
                </a>
            </div>
        </Card>
    );
}

export function FundSheet({ f, onClose }) {
    const { reloadFunds } = useData();
    const toast = useToast();
    const [v, setV] = useState(f);
    const [busy, setBusy] = useState(false);
    React.useEffect(() => { setV(f); }, [f]);
    if (!f || !v) return null;
    const save = async () => {
        if (!v.name.trim()) return;
        setBusy(true);
        const r = await call('fund_save', { body: v });
        setBusy(false);
        if (!r.success) { toast(t(r.message || 'تعذّر الحفظ'), 'err'); return; }
        await reloadFunds();
        toast(t(v.id ? 'حُفظت العهدة' : 'أُنشئت العهدة'));
        onClose();
        if (!v.id) go('/fund/' + r.id);
    };
    return (
        <Sheet open={!!f} onClose={onClose} title={t(v.id ? 'تعديل العهدة' : 'عهدة جديدة')}>
            <div className="space-y-4">
                <Field label={t('الاسم')}><input className={inputCls} value={v.name} onChange={e => setV({ ...v, name: e.target.value })}
                    placeholder={t('عهدة العمل، مصاريف المدارس…')} autoFocus /></Field>
                <div>
                    <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('النوع')}</span>
                    <Seg value={v.kind} onChange={k => setV({ ...v, kind: k })} options={Object.entries(KINDS).map(([k, x]) => ({ v: k, t: t(x) }))} />
                </div>
                <div>
                    <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('اللون')}</span>
                    <div className="flex flex-wrap gap-2">
                        {PALETTE.map(c => (
                            <button key={c} type="button" onClick={() => setV({ ...v, color: c })}
                                className={'w-9 h-9 rounded-xl border-2 ' + (v.color === c ? 'border-ink' : 'border-transparent')} style={{ background: c }} />
                        ))}
                    </div>
                </div>
                <Field label={t('ملاحظة')}><textarea className={inputCls + ' h-auto py-2 min-h-[64px]'} value={v.note || ''} onChange={e => setV({ ...v, note: e.target.value })} /></Field>
                <Btn className="w-full" busy={busy} onClick={save}>{t('حفظ')}</Btn>
            </div>
        </Sheet>
    );
}
