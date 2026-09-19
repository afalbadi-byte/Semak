import React, { useState } from 'react';
import { CheckCircle2, Hourglass, Undo2, BadgeCheck } from 'lucide-react';
import { call } from '../lib/api';
import { useData } from '../App';
import { useToast, todayStr } from '../ui';
import { GRADES, gradeOf } from '../lib/quran';

// ─── «تمّ التسميع»: المشرف وحده يجيز الورد ─────────────────────────────────
// لا يُحتسب حفظٌ ولا ألواحٌ ولا مراجعة حتى يسمعها المشرف ويضع «تمّ التسميع» بتقدير.
// تُضمّ إلى تسميع اليوم إن وُجد، وأخطاء اليوم وتنبيهاته تُؤخذ من علامات مصحفه.
const NAMES = { new: 'حفظ اليوم', alwah: 'الألواح', rev: 'المراجعة' };

export const passed = (t, k) => !!t && (k === 'new' ? t.new_lines > 0 && t.new_grade !== 1 : k === 'alwah' ? !!t.alwah_done : !!t.rev_done);
const gradeKey = k => (k === 'new' ? 'new_grade' : k + '_grade');

export default function PassBar({ member, part, today, onDone }) {
    const { sup, reloadMembers } = useData();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!member || !NAMES[part]) return null;

    const ok = passed(today, part);
    const g = today ? gradeOf(today[gradeKey(part)]) : null;
    const redo = part === 'new' && today && today.new_lines > 0 && today.new_grade === 1;

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
            note: l ? (l.note || '') : '',
        };
        // أخطاء هذا الجزء وتنبيهاته اليوم من علامات المصحف
        let e = 0, w = 0;
        const pages = part === 'new' ? (p.new ? [p.new.page] : []) : part === 'alwah' ? f.alwah_list : f.rev_list;
        if (k.success) k.data.forEach(x => { if (pages.includes(x.page)) { e += x.err; w += x.warn; } });

        if (grade === null) {                       // تراجع عن الإجازة
            if (part === 'new') { f.new_lines = 0; f.new_grade = 0; } else f[part + '_done'] = false;
        } else if (part === 'new') {
            if (!p.new) { setBusy(false); return; }
            Object.assign(f, { new_page: p.new.page, new_lines: f.new_lines || p.new.lines, new_grade: grade, new_err: e, new_warn: w });
        } else {
            Object.assign(f, { [part + '_done']: true, [part + '_grade']: grade, [part + '_err']: e, [part + '_warn']: w });
        }
        const empty = !f.new_lines && !f.alwah_done && !f.rev_done && !f.note;
        const res = empty && l ? await call('log_delete', { body: { member_id: member.id, d } })
            : await call('log_save', { body: { ...f, member_id: member.id, d } });
        setBusy(false);
        if (!res.success) { toast(res.message || 'تعذّر الحفظ', 'err'); return; }
        setOpen(false);
        toast(grade === null ? 'أُلغيت الإجازة' : grade === 1 ? 'يُعاد غداً' : `تمّ تسميع ${NAMES[part]}، بارك الله فيه`);
        reloadMembers();
        onDone && onDone();
    };

    if (ok || redo) return (
        <div className={'rounded-2xl p-3 flex items-center gap-2 ' + (ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800')}>
            {ok ? <BadgeCheck size={20} /> : <Undo2 size={20} />}
            <div className="flex-1 min-w-0 text-[13px] font-bold">
                {ok ? `تمّ تسميع ${NAMES[part]}` : 'يُعاد حفظ اليوم'}{g ? <span className="font-semibold"> · {g.t}</span> : null}
            </div>
            {sup ? <button disabled={busy} onClick={() => save(null)} className="h-8 px-3 rounded-lg bg-white/70 text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Undo2 size={13} />تراجع</button> : null}
        </div>
    );

    if (!sup) return (
        <div className="rounded-2xl p-3 bg-paper-2/60 text-ink-3 text-[13px] font-semibold flex items-center gap-2">
            <Hourglass size={17} />بانتظار تسميع المشرف ليُجاز {NAMES[part]}
        </div>
    );

    return open ? (
        <div className="rounded-2xl p-3 bg-paper-card border border-brand/30 space-y-2">
            <div className="text-[12px] font-bold text-ink-2">تقدير تسميع {NAMES[part]} لـ{member.name}</div>
            <div className="grid grid-cols-5 gap-1.5">
                {GRADES.map(x => (
                    <button key={x.v} disabled={busy} onClick={() => save(x.v)} className="h-11 rounded-xl text-[12px] font-bold text-white disabled:opacity-50" style={{ background: x.c }}>{x.t}</button>
                ))}
            </div>
            <button onClick={() => setOpen(false)} className="block mx-auto text-[12px] text-ink-3 font-semibold">إلغاء</button>
        </div>
    ) : (
        <button onClick={() => setOpen(true)} className="w-full h-12 rounded-2xl bg-brand text-white font-bold inline-flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />تمّ التسميع · {NAMES[part]}
        </button>
    );
}
