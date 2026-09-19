import React, { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { call } from '../lib/api';
import { Btn, Stepper, useToast, todayStr, inputCls } from '../ui';
import { linesLabel, rangeLabel, surahsIn } from '../lib/quran';

// ─── تعديل ورد اليوم يدوياً (للمشرف) ─────────────────────────────────────────
// يُحفظ لهذا الفرد في هذا اليوم وحده، ويبقى الحساب التلقائي لما بعده. والمراجعة
// تستكمل غداً بعد آخر صفحةٍ رُوجعت فعلاً، فالتعديل لا يُربك الدورة.
const range = (a, b) => { a = +a; b = +b; if (!a && b) a = b; if (!b && a) b = a; if (!a || !b || a > 604 || b > 604) return []; if (a > b) [a, b] = [b, a]; const o = []; for (let p = Math.max(1, a); p <= Math.min(604, b) && o.length < 60; p++) o.push(p); return o; };
const ends = l => (l && l.length ? [Math.min(...l), Math.max(...l)] : ['', '']);

export default function WirdEditor({ member, plan, onDone }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const newOff = !!plan.new_off;
    // ما لم يُلمس يبقى كما هو (المراجعة قد تكون مقطعين من جزأين، فلا تُختصر في «من-إلى»)
    const [touched, setTouched] = useState({});
    const touch = k => setTouched(t => ({ ...t, [k]: true }));
    const [nl, setNl0] = useState(newOff ? 0 : plan.new ? plan.new.lines : member.target_lines);
    const [a, setA0] = useState(ends(plan.alwah));
    const [r, setR0] = useState(ends(plan.review));
    const setNl = v => { setNl0(v); touch('n'); };
    const setA = v => { setA0(v); touch('a'); };
    const setR = v => { setR0(v); touch('r'); };
    const hasNew = !!plan.new || newOff;

    const bad = (t, v) => t && (v[0] !== '' || v[1] !== '') && !range(v[0], v[1]).length;
    const save = async reset => {
        if (!reset && (bad(touched.a, a) || bad(touched.r, r))) { toast('أرقام الصفحات من ١ إلى ٦٠٤', 'err'); return; }
        setBusy(true);
        const body = reset ? { member_id: member.id, d: todayStr(), reset: 1 }
            : { member_id: member.id, d: todayStr(), new_lines: hasNew && touched.n ? nl : (plan.custom && plan.custom.new_lines !== undefined ? plan.custom.new_lines : null),
                alwah_list: touched.a ? range(a[0], a[1]) : (plan.custom && plan.custom.alwah ? plan.alwah : null),
                rev_list: touched.r ? range(r[0], r[1]) : (plan.custom && plan.custom.review ? plan.review : null) };
        const res = await call('wird_save', { body });
        setBusy(false);
        if (!res.success) { toast(res.message || 'تعذّر الحفظ', 'err'); return; }
        toast(reset ? 'عاد الورد إلى الحساب التلقائي' : 'حُفظ ورد اليوم');
        onDone && onDone();
    };

    const al = touched.a ? range(a[0], a[1]) : plan.alwah, rv = touched.r ? range(r[0], r[1]) : plan.review;
    return (
        <div className="space-y-5">
            <p className="text-[12px] text-ink-3 leading-6">يسري التعديل على ورد <b className="text-ink">{member.name}</b> اليوم فقط، ويعود الحساب التلقائي من الغد.</p>

            {hasNew ? (
                <div className="space-y-2">
                    <div className="text-[13px] font-bold text-ink">الحفظ الجديد</div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-ink-2">{nl ? linesLabel(nl) : 'لا حفظ جديد اليوم'}</span>
                        <Stepper value={nl} onChange={setNl} max={90} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {[[0, 'لا حفظ اليوم'], [3, '٣ أسطر'], [5, '٥ أسطر'], [8, 'نصف صفحة'], [15, 'صفحة'], [30, 'صفحتان']].map(([v, t]) => (
                            <button key={v} type="button" onClick={() => setNl(v)} className={'h-8 px-3 rounded-lg text-[12px] font-semibold ' + (nl === v ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>{t}</button>
                        ))}
                    </div>
                </div>
            ) : null}

            <Pages title="الألواح" v={a} set={setA} list={al} />
            <Pages title="المراجعة" v={r} set={setR} list={rv} />

            <div className="flex gap-2">
                <Btn className="flex-1 !h-12" busy={busy} onClick={() => save(false)}><Save size={17} />احفظ ورد اليوم</Btn>
                {plan.custom ? <Btn kind="line" className="!h-12" disabled={busy} onClick={() => save(true)} title="الورد التلقائي"><RotateCcw size={16} />التلقائي</Btn> : null}
            </div>
        </div>
    );
}

// من صفحة إلى صفحة (يُعرض نزولاً من جهة البقرة إلى جهة الناس)
function Pages({ title, v, set, list }) {
    return (
        <div className="space-y-2">
            <div className="flex items-baseline gap-2">
                <div className="text-[13px] font-bold text-ink">{title}</div>
                <div className="text-[12px] text-ink-3">{list.length ? `${list.length} ${list.length <= 10 ? 'صفحات' : 'صفحة'}` : 'لا شيء اليوم'}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-ink-3">من صفحة
                    <input type="number" inputMode="numeric" min={1} max={604} onFocus={e => e.target.select()} className={inputCls + ' mt-0.5'} value={v[0]} onChange={e => set([e.target.value, v[1]])} />
                </label>
                <label className="text-[11px] text-ink-3">إلى صفحة
                    <input type="number" inputMode="numeric" min={1} max={604} onFocus={e => e.target.select()} className={inputCls + ' mt-0.5'} value={v[1]} onChange={e => set([v[0], e.target.value])} />
                </label>
            </div>
            {list.length ? <div className="text-[12px] text-ink-3">{rangeLabel(list)} · {surahsIn(list).slice(0, 4).join('، ')}</div> : null}
            <button type="button" onClick={() => set(['', ''])} className="text-[12px] text-ink-3 font-semibold">بلا {title} اليوم</button>
        </div>
    );
}
