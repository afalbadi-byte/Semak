import React, { useEffect, useState } from 'react';
import { BookOpen, Layers, RotateCcw, Check, SlidersHorizontal, CalendarDays } from 'lucide-react';
import { call } from '../lib/api';
import { Card, Btn, Sheet, useToast, tomorrowStr, greg } from '../ui';
import { useData } from '../App';
import { segsOf, segsPages, segsLines, oneRange, label } from '../lib/ayah';
import WirdEditor from './WirdEditor';

// ─── بطاقة ورد الغد: يراه المشرف جاهزاً فيعتمده بضغطة أو يعدّله ───────────────
// الأجزاء الثلاثة بمقاطعها «من … إلى …»، ولكلٍّ لونه الثابت في التطبيق كلّه.
export const PARTS = [
    { k: 'new', t: 'الحفظ الجديد', icon: BookOpen, c: '#1f5f4a' },
    { k: 'alwah', t: 'الألواح', icon: Layers, c: '#b8893a' },
    { k: 'rev', t: 'المراجعة', icon: RotateCcw, c: '#0e7490' },
];
export const partSegs = (plan, k) => (plan ? segsOf((plan.ranges && plan.ranges[k]) || (plan.auto && plan.auto[k])) : null);

export default function TomorrowCard({ member, plan, sup, onDone }) {
    const toast = useToast();
    const { reloadMembers } = useData();
    const [busy, setBusy] = useState(false);
    const [edit, setEdit] = useState(false);
    if (!plan) return null;

    // اعتماد المقترح كما هو: يصير وردَ الغد الثابت
    const accept = async () => {
        setBusy(true);
        const body = { member_id: member.id, d: tomorrowStr(), ranges: {} };
        try {
            for (const { k } of PARTS) {
                const segs = k === 'new' && plan.new_off ? null : partSegs(plan, k);
                if (k === 'new') body.new_lines = segs ? Math.max(1, Math.min(90, await segsLines(segs))) : 0;
                else body[k === 'alwah' ? 'alwah_list' : 'rev_list'] = segs ? await segsPages(segs) : [];
                if (segs) body.ranges[k] = segs;
            }
        } catch (e) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        const r = await call('wird_save', { body });
        setBusy(false);
        if (!r.success) { toast(r.message || 'تعذّر الحفظ', 'err'); return; }
        toast('اعتُمد ورد الغد');
        reloadMembers();
        onDone && onDone();
    };

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <CalendarDays size={17} className="text-ink-3" />
                <div className="font-bold text-ink flex-1">ورد الغد · {greg(tomorrowStr(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {plan.rest ? <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg px-2 py-0.5">يوم راحة</span> : null}
                {plan.custom ? <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 rounded-lg px-2 py-0.5">معتمد</span> : <span className="text-[11px] font-semibold text-ink-3">مقترح</span>}
            </div>
            <div className="space-y-2">
                {PARTS.map(({ k, t, icon: I, c }) => (
                    <PartLine key={k} t={t} I={I} c={c} segs={k === 'new' && plan.new_off ? null : partSegs(plan, k)} />
                ))}
            </div>
            {plan.new_hold ? <p className="text-[12px] text-amber-700 font-semibold leading-6">لا حفظ جديد حتى يُسمّع {plan.new_hold} اليوم.</p> : null}
            {sup && !plan.custom && new Date().getHours() >= 18 ? <p className="text-[12px] text-amber-700 font-semibold">لم يُعتمد ورد الغد بعد.</p> : null}
            {sup ? (
                <div className="flex gap-2">
                    <Btn className="flex-1" busy={busy} onClick={accept}><Check size={16} />اعتمد ورد الغد</Btn>
                    <Btn kind="line" onClick={() => setEdit(true)}><SlidersHorizontal size={15} />عدّل</Btn>
                </div>
            ) : null}
            <Sheet open={edit} onClose={() => setEdit(false)} title={'ورد الغد · ' + member.name}>
                {edit ? <WirdEditor member={member} plan={plan} d={tomorrowStr()} title="يسري هذا الورد من الغد، ويبقى حتى تغيّره."
                    onDone={() => { setEdit(false); onDone && onDone(); }} /> : null}
            </Sheet>
        </Card>
    );
}

export function PartLine({ t, I, c, segs, small }) {
    const one = oneRange(segs);
    const [x, setX] = useState(null);
    useEffect(() => {
        let dead = false;
        if (one) Promise.all([label(one[0]), label(one[1])]).then(v => { if (!dead) setX(v); }); else setX(null);
        return () => { dead = true; };
    }, [one && one.join('-')]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div className="flex items-start gap-2.5">
            <span className={(small ? 'w-7 h-7' : 'w-8 h-8') + ' rounded-xl flex items-center justify-center shrink-0 text-white'} style={{ background: c }}><I size={small ? 13 : 15} /></span>
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-ink-3">{t}</div>
                {!segs ? <div className="text-[13px] text-ink-3">لا شيء</div>
                    : x ? <div className="text-[13px] text-ink leading-6">من <b className="font-quran text-[15px]">{x[0]}</b>{one[0] !== one[1] ? <> إلى <b className="font-quran text-[15px]">{x[1]}</b></> : null}</div>
                        : <div className="text-[13px] text-ink-3">…</div>}
            </div>
        </div>
    );
}
