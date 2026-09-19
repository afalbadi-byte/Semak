import React, { useEffect, useState } from 'react';
import { CheckCircle2, Hourglass, Undo2, BadgeCheck, Lock } from 'lucide-react';
import { call } from '../lib/api';
import { useData } from '../App';
import { useToast, todayStr, tomorrowStr } from '../ui';
import { GRADES, gradeOf } from '../lib/quran';
import { partRange, segsOf, segsPages, segsLines, oneRange, segsFor, label } from '../lib/ayah';
import { linesLabel } from '../lib/quran';
import { AyahRange } from './AyahPicker';

// ─── «تمّ التسميع»: المشرف وحده يجيز الورد ─────────────────────────────────
// يحدّد المشرف ما سُمِّع بالسورة ورقم الآية (أوّل آيةٍ وآخر آية، مع أوّل كلماتهما)،
// ثم التقدير. وما لم يُجَز يبقى وردَ الغد كما هو. والحفظ الجديد لا يُجاز قبل
// تسميع الألواح والمراجعة. وأخطاء اليوم وتنبيهاته تُؤخذ من علامات مصحفه.
const NAMES = { new: 'حفظ اليوم', alwah: 'الألواح', rev: 'المراجعة' };

export const passed = (t, k) => !!t && (k === 'new' ? t.new_lines > 0 && t.new_grade !== 1 : k === 'alwah' ? !!t.alwah_done : !!t.rev_done);
const gradeKey = k => (k === 'new' ? 'new_grade' : k + '_grade');

// ما يلزم تسميعه قبل الحفظ الجديد
export function newLocks(plan, today) {
    if (!plan) return [];
    const o = [];
    if (plan.lines > 0 && plan.alwah && plan.alwah.length && !passed(today, 'alwah')) o.push('الألواح');
    if (plan.review && plan.review.length && !passed(today, 'rev')) o.push('المراجعة');
    return o;
}

export default function PassBar({ member, part, today, plan, onDone }) {
    const { sup, reloadMembers } = useData();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [rg, setRg] = useState(null);
    const [def, setDef] = useState(null);
    const [nextOpen, setNextOpen] = useState(false);

    // المقطع المقترح: ما سُمّع اليوم إن وُجد، وإلا ورد اليوم
    useEffect(() => {
        let dead = false;
        const r0 = today && today.ranges && segsOf(today.ranges[part]);
        (r0 ? Promise.resolve(r0) : partRange(plan, part)).then(r => { if (!dead) { setDef(r); setRg(oneRange(r)); } }).catch(() => {});
        return () => { dead = true; };
    }, [member && member.id, part, plan && JSON.stringify([plan.new, plan.alwah, plan.review, plan.ranges, plan.auto]), today && JSON.stringify(today.ranges)]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!member || !NAMES[part]) return null;
    const ok = passed(today, part);
    const g = today ? gradeOf(today[gradeKey(part)]) : null;
    const redo = part === 'new' && today && today.new_lines > 0 && today.new_grade === 1;
    const locks = part === 'new' ? newLocks(plan, today) : [];

    const save = async grade => {
        setBusy(true);
        const d = todayStr();
        const [r, k] = await Promise.all([
            call('log_get', { params: { member_id: member.id, d } }),
            call('marks_day', { params: { member_id: member.id, d } }),
        ]);
        if (!r.success) { setBusy(false); toast(r.message, 'err'); return; }
        const l = r.log, p = r.plan;
        const f = {
            new_page: l ? l.new_page : (p.new ? p.new.page : null), new_lines: l ? l.new_lines : 0,
            new_grade: l ? l.new_grade : 0, new_err: l ? l.new_err : 0, new_warn: l ? l.new_warn : 0,
            alwah_list: l && l.alwah_list.length ? l.alwah_list : p.alwah, alwah_done: l ? !!l.alwah_done : false,
            alwah_grade: l ? l.alwah_grade : 0, alwah_err: l ? l.alwah_err : 0, alwah_warn: l ? l.alwah_warn : 0,
            rev_list: l && l.rev_list.length ? l.rev_list : p.review, rev_done: l ? !!l.rev_done : false,
            rev_grade: l ? l.rev_grade : 0, rev_err: l ? l.rev_err : 0, rev_warn: l ? l.rev_warn : 0,
            note: l ? (l.note || '') : '', ranges: { ...((l && l.ranges) || {}) },
        };
        try {
            if (grade === null) {                       // تراجع عن الإجازة
                if (part === 'new') { f.new_lines = 0; f.new_grade = 0; } else f[part + '_done'] = false;
                delete f.ranges[part];
            } else {
                const segs = segsFor(rg, def);
                const changed = JSON.stringify(segs) !== JSON.stringify(segsOf(def));
                // المقطع المُسمَّع بالآيات، ومنه الصفحات (وأسطر الحفظ الجديد إن غيّره المشرف)
                const pages = segs ? await segsPages(segs) : [];
                let e = 0, w = 0;
                if (k.success) k.data.forEach(x => { if (pages.includes(x.page)) { e += x.err; w += x.warn; } });
                if (segs) f.ranges[part] = segs;
                if (part === 'new') {
                    if (!p.new) { setBusy(false); return; }
                    // الأسطر إلى نهاية آخر آيةٍ سُمِّعت، فلا يبدأ الحفظ القادم من وسط آية
                    const lines = segs ? await segsLines(segs) : (f.new_lines || p.new.lines);
                    Object.assign(f, { new_page: p.new.page, new_lines: Math.max(1, Math.min(90, lines)), new_grade: grade, new_err: e, new_warn: w });
                } else {
                    Object.assign(f, { [part + '_done']: true, [part + '_grade']: grade, [part + '_err']: e, [part + '_warn']: w });
                    if (changed && pages.length) f[part === 'alwah' ? 'alwah_list' : 'rev_list'] = pages;
                }
            }
        } catch (err) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        const empty = !f.new_lines && !f.alwah_done && !f.rev_done && !f.note;
        const res = empty && l ? await call('log_delete', { body: { member_id: member.id, d } })
            : await call('log_save', { body: { ...f, member_id: member.id, d } });
        setBusy(false);
        if (!res.success) { toast(res.message || 'تعذّر الحفظ', 'err'); return; }
        setOpen(false);
        toast(grade === null ? 'أُلغيت الإجازة' : grade === 1 ? 'يُعاد غداً' : `تمّ تسميع ${NAMES[part]}، بارك الله فيه`);
        // بعد الإجازة: يحدّد المشرف ورد هذا الجزء القادم (لا حساب تلقائيّ)
        if (grade !== null && !(part === 'new' && grade === 1)) setNextOpen(true);
        reloadMembers();
        onDone && onDone();
    };

    if (ok || redo) return (
        <div className={'rounded-2xl p-3 space-y-1 ' + (ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800')}>
            <div className="flex items-center gap-2">
                {ok ? <BadgeCheck size={20} /> : <Undo2 size={20} />}
                <div className="flex-1 min-w-0 text-[13px] font-bold">
                    {ok ? `تمّ تسميع ${NAMES[part]}` : 'يُعاد حفظ اليوم غداً'}{g ? <span className="font-semibold"> · {g.t}</span> : null}
                </div>
                {sup ? <button disabled={busy} onClick={() => save(null)} className="h-8 px-3 rounded-lg bg-white/70 text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Undo2 size={13} />تراجع</button> : null}
            </div>
            {today && today.ranges && today.ranges[part] ? <RangeText r={today.ranges[part]} /> : null}
            {ok ? (
                nextOpen && sup ? <NextPart member={member} part={part} onDone={() => { setNextOpen(false); reloadMembers(); onDone && onDone(); }} />
                    : sup ? <button onClick={() => setNextOpen(true)} className="h-8 px-3 rounded-lg bg-white/70 text-[12px] font-semibold">حدّد {NEXT[part]} القادم</button> : null
            ) : null}
        </div>
    );

    if (locks.length) return (
        <div className="rounded-2xl p-3 bg-paper-2/60 text-ink-2 text-[13px] font-semibold flex items-center gap-2">
            <Lock size={17} />يُجاز الحفظ الجديد بعد تسميع {locks.join(' و')}
        </div>
    );

    if (!sup) return (
        <div className="rounded-2xl p-3 bg-paper-2/60 text-ink-3 text-[13px] font-semibold flex items-center gap-2">
            <Hourglass size={17} />بانتظار تسميع المشرف ليُجاز {NAMES[part]}
        </div>
    );

    return open ? (
        <div className="rounded-2xl p-3 bg-paper-card border border-brand/30 space-y-3">
            <div className="text-[12px] font-bold text-ink-2">ما سمّعه {member.name} من {NAMES[part]}</div>
            {rg ? <AyahRange from={rg[0]} to={rg[1]} onChange={setRg} labels={['من', 'إلى']} /> : <div className="text-[12px] text-ink-3">…</div>}
            <div className="text-[12px] font-bold text-ink-2">التقدير</div>
            <div className="grid grid-cols-5 gap-1.5">
                {GRADES.map(x => (
                    <button key={x.v} disabled={busy} onClick={() => save(x.v)} className="h-11 rounded-xl text-[12px] font-bold text-white disabled:opacity-50" style={{ background: x.c }}>{x.t}</button>
                ))}
            </div>
            <button onClick={() => { setOpen(false); setRg(oneRange(def)); }} className="block mx-auto text-[12px] text-ink-3 font-semibold">إلغاء</button>
        </div>
    ) : (
        <div className="space-y-2">
            {rg ? <RangeText r={rg} muted /> : null}
            <button onClick={() => setOpen(true)} className="w-full h-12 rounded-2xl bg-brand text-white font-bold inline-flex items-center justify-center gap-2">
                <CheckCircle2 size={18} />تمّ التسميع · {NAMES[part]}
            </button>
        </div>
    );
}

// «من الملك ١ · تبارك الذي بيده الملك إلى الملك ١٤ · ألا يعلم من خلق»، لكل مقطع
export function RangeText({ r, muted }) {
    const one = oneRange(r);
    const [t, setT] = useState(null);
    useEffect(() => {
        let dead = false;
        if (one) Promise.all([label(one[0]), label(one[1])]).then(x => { if (!dead) setT(x); });
        return () => { dead = true; };
    }, [one && one.join('-')]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!t) return null;
    return (
        <div className={'text-[12px] leading-6 ' + (muted ? 'text-ink-3' : '')}>
            من <b className="font-quran text-[15px]">{t[0]}</b>{one[0] !== one[1] ? <> إلى <b className="font-quran text-[15px]">{t[1]}</b></> : null}
        </div>
    );
}

function NameOf({ k }) {
    const [t, setT] = useState(k);
    useEffect(() => { label(k).then(setT).catch(() => {}); }, [k]);
    return <b className="font-quran text-[14px]">{t}</b>;
}

// ─── الورد القادم لجزءٍ من الورد: يحدّده المشرف بعد إجازته ─────────────────────────
// المقترح: ما يلي ما سُمِّع اليوم (الحساب التلقائي اقتراحٌ فقط)، ويعدّله المشرف
// «من سورة كذا آية كذا إلى سورة كذا آية كذا»، فيصير ورد هذا الجزء من الغد حتى يغيّره.
const NEXT = { new: 'الحفظ', alwah: 'الألواح', rev: 'المراجعة' };
function NextPart({ member, part, onDone }) {
    const toast = useToast();
    const [sug, setSug] = useState(null);
    const [one, setOne] = useState(null);
    const [n, setN] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        call('member', { params: { id: member.id } }).then(r => {
            const s0 = r.success && r.now && r.now.auto ? segsOf(r.now.auto[part]) : null;
            setSug(s0 || []); setOne(oneRange(s0));
        });
    }, [member.id, part]);
    const segs = one ? segsFor(one, sug) : null;
    useEffect(() => {
        if (part !== 'new' || !segs) return undefined;
        let dead = false; segsLines(segs).then(x => { if (!dead) setN(x); }).catch(() => {});
        return () => { dead = true; };
    }, [JSON.stringify(segs)]); // eslint-disable-line react-hooks/exhaustive-deps
    const save = async () => {
        setBusy(true);
        const body = { member_id: member.id, d: tomorrowStr(), ranges: { [part]: segs } };
        try {
            if (part === 'new') body.new_lines = Math.max(1, Math.min(90, await segsLines(segs)));
            else body[part === 'alwah' ? 'alwah_list' : 'rev_list'] = await segsPages(segs);
        } catch (e) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        const r = await call('wird_save', { body });
        setBusy(false);
        if (!r.success) { toast(r.message || 'تعذّر الحفظ', 'err'); return; }
        toast('حُدِّد ' + NEXT[part] + ' القادم');
        onDone();
    };
    if (!sug) return <div className="text-[12px] text-ink-3 pt-2">…</div>;
    if (!one) return <div className="text-[12px] pt-2">لا مقترح، حدّده من «عدّل الورد».</div>;
    return (
        <div className="rounded-xl bg-white p-3 space-y-2 text-ink mt-1">
            <div className="text-[12px] font-bold text-ink-2">حدّد {NEXT[part]} القادم لـ{member.name}</div>
            <AyahRange from={one[0]} to={one[1]} onChange={setOne} labels={['من', 'إلى']} />
            {part === 'new' && n ? <div className="text-[12px] text-ink-3">المقدار: {linesLabel(n)}</div> : null}
            <button disabled={busy || !segs} onClick={save} className="w-full h-10 rounded-xl bg-brand text-white text-[13px] font-bold disabled:opacity-50">اعتمده وردَ الغد</button>
        </div>
    );
}
