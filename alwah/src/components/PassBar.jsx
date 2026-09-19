import React, { useEffect, useState } from 'react';
import { CheckCircle2, Hourglass, Undo2, BadgeCheck, Lock } from 'lucide-react';
import { call } from '../lib/api';
import { useData } from '../App';
import { useToast, todayStr } from '../ui';
import { GRADES, gradeOf } from '../lib/quran';
import { partRange, segsOf, segsPages, segsLines, memSegs, memEnds, oneRange, segsFor, label } from '../lib/ayah';
import { linesLabel } from '../lib/quran';
import AyahPicker from './AyahPicker';
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
        // بعد إجازة الحفظ الجديد: يحدّد المشرف الحفظ القادم استعداداً له
        if (part === 'new' && grade !== null && grade !== 1) setNextOpen(true);
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
            {ok && part === 'new' ? (
                nextOpen && sup ? <NextNew member={member} onDone={() => { setNextOpen(false); reloadMembers(); onDone && onDone(); }} />
                    : <div className="flex items-center gap-2 pt-1 border-t border-green-200/70">
                        <div className="flex-1 text-[12px]">{today.ranges && today.ranges.next && today.ranges.next.to ? <>الحفظ القادم: {linesLabel(today.ranges.next.lines)} إلى <NameOf k={today.ranges.next.to} /></> : 'الحفظ القادم: بالمقدار المعتاد'}</div>
                        {sup ? <button onClick={() => setNextOpen(true)} className="h-8 px-3 rounded-lg bg-white/70 text-[12px] font-semibold">حدّده</button> : null}
                    </div>
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

// ─── الحفظ القادم: يحدّده المشرف بعد إجازة حفظ اليوم ─────────────────────────────
// يبدأ من حيث انتهى اليوم (بترتيب الحفظ: السورة من أوّلها، ثم التي قبلها)، ويختار
// المشرف آخر آية، فيصير هذا المقطع ورد الحفظ الجديد القادم.
function NextNew({ member, onDone }) {
    const toast = useToast();
    const [st, setSt] = useState(null);           // { dir, start, end }
    const [n, setN] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        call('member', { params: { id: member.id } }).then(r => {
            const now = r.success && r.now;
            if (!now || !now.new) { setSt({ done: true }); return; }
            const [a, b] = memEnds(now.dir, segsOf(now.auto && now.auto.new) || []);
            setSt({ dir: now.dir, start: a, end: b });
        });
    }, [member.id]);
    useEffect(() => {
        if (!st || !st.start) return;
        let dead = false;
        segsLines(memSegs(st.dir, st.start, st.end)).then(x => { if (!dead) setN(x); }).catch(() => {});
        return () => { dead = true; };
    }, [st && st.start, st && st.end]); // eslint-disable-line react-hooks/exhaustive-deps
    const save = async reset => {
        setBusy(true);
        const r = await call('next_save', { body: reset ? { member_id: member.id, d: todayStr(), reset: 1 } : { member_id: member.id, d: todayStr(), lines: n, to: st.end } });
        setBusy(false);
        if (!r.success) { toast(r.message || 'تعذّر الحفظ', 'err'); return; }
        toast(reset ? 'الحفظ القادم بالمقدار المعتاد' : 'حُدِّد الحفظ القادم');
        onDone();
    };
    if (!st) return <div className="text-[12px] text-ink-3 pt-2">…</div>;
    if (st.done) return <div className="text-[12px] pt-2">أتمّ الحفظ، ما شاء الله.</div>;
    return (
        <div className="rounded-xl bg-white p-3 space-y-2 text-ink mt-1">
            <div className="text-[12px] font-bold text-ink-2">حدّد الحفظ القادم لـ{member.name}</div>
            <div className="text-[11px] text-ink-3">يبدأ من</div>
            <NameOf k={st.start} />
            <AyahPicker label="إلى" value={st.end} min={st.dir === 'asc' ? st.start : null} onChange={v => setSt(x => ({ ...x, end: v }))} />
            {n ? <div className="text-[12px] text-ink-3">المقدار: {linesLabel(n)}</div> : null}
            <div className="flex gap-2">
                <button disabled={busy || !n} onClick={() => save(false)} className="flex-1 h-10 rounded-xl bg-brand text-white text-[13px] font-bold disabled:opacity-50">اعتمد الحفظ القادم</button>
                <button disabled={busy} onClick={() => save(true)} className="h-10 px-3 rounded-xl bg-paper-2 text-ink-2 text-[12px] font-semibold">المقدار المعتاد</button>
            </div>
        </div>
    );
}
