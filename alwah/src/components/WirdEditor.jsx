import React, { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { call } from '../lib/api';
import { Btn, useToast, todayStr } from '../ui';
import { linesLabel } from '../lib/quran';
import { partRange, segsPages, segsLines, memSegs, label } from '../lib/ayah';
import AyahPicker, { AyahRange } from './AyahPicker';

// ─── تعديل ورد اليوم يدوياً (للمشرف) ─────────────────────────────────────────
// كل جزءٍ يُحدَّد بالسورة ورقم الآية (أوّل آيةٍ وآخر آية مع أوّل كلماتهما)، ويُحفظ لهذا
// الفرد في هذا اليوم وحده، ويعود الحساب التلقائي من الغد. وما لم يُلمس يبقى كما هو.
export default function WirdEditor({ member, plan, onDone }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [touched, setTouched] = useState({});
    const [r, setR] = useState({});                 // المقاطع: new / alwah / rev، لكلٍّ قائمة مقاطع [من، إلى]
    const [off, setOff] = useState({ new: !!plan.new_off });
    const [start, setStart] = useState(null);        // بداية حفظ اليوم (ثابتة: من حيث وصل)

    useEffect(() => {
        let dead = false;
        (async () => {
            const o = {};
            for (const k of ['new', 'alwah', 'rev']) o[k] = await partRange(plan, k).catch(() => null);
            if (!dead) { setR(o); if (o.new) setStart(memEnds(plan.dir, o.new)[0]); }
        })();
        return () => { dead = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (k, v) => { setR(x => ({ ...x, [k]: v })); setTouched(t => ({ ...t, [k]: true })); setOff(o => ({ ...o, [k]: false })); };
    const none = k => { setOff(o => ({ ...o, [k]: true })); setTouched(t => ({ ...t, [k]: true })); };

    const save = async reset => {
        setBusy(true);
        let body;
        try {
            if (reset) body = { member_id: member.id, d: todayStr(), reset: 1 };
            else {
                const ranges = { ...(plan.ranges || {}) };
                const c = plan.custom || {};
                body = { member_id: member.id, d: todayStr(),
                    new_lines: c.new_lines !== undefined ? c.new_lines : null,
                    alwah_list: c.alwah ? plan.alwah : null, rev_list: c.review ? plan.review : null };
                if (touched.new) {
                    if (off.new) { body.new_lines = 0; delete ranges.new; }
                    else if (r.new) { body.new_lines = Math.max(1, Math.min(90, await segsLines(r.new))); ranges.new = r.new; }
                }
                for (const [k, lk] of [['alwah', 'alwah_list'], ['rev', 'rev_list']]) {
                    if (!touched[k]) continue;
                    if (off[k]) { body[lk] = []; delete ranges[k]; } else if (r[k]) { body[lk] = await segsPages(r[k]); ranges[k] = r[k]; }
                }
                body.ranges = ranges;
            }
        } catch (e) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        const res = await call('wird_save', { body });
        setBusy(false);
        if (!res.success) { toast(res.message || 'تعذّر الحفظ', 'err'); return; }
        toast(reset ? 'عاد الورد إلى الحساب التلقائي' : 'حُفظ ورد اليوم');
        onDone && onDone();
    };

    const hasNew = !!plan.new || !!plan.new_off;
    return (
        <div className="space-y-5">
            <p className="text-[12px] text-ink-3 leading-6">يسري التعديل على ورد <b className="text-ink">{member.name}</b> اليوم فقط، ويعود الحساب التلقائي من الغد.</p>

            {hasNew ? (
                <Part title="الحفظ الجديد" off={off.new} onNone={() => none('new')} onOn={() => r.new && set('new', r.new)} noneText="لا حفظ جديد اليوم">
                    {start && r.new ? (
                        <>
                            <div className="text-[11px] text-ink-3">يبدأ من حيث وصل</div>
                            <StartText k={start} />
                            <AyahPicker label="إلى" value={memEnds(plan.dir, r.new)[1]} min={plan.dir === 'asc' ? start : null} onChange={v => set('new', memSegs(plan.dir, start, v))} />
                            <NewLines r={r.new} />
                        </>
                    ) : <div className="text-[12px] text-ink-3">…</div>}
                </Part>
            ) : null}

            <Part title="الألواح" off={off.alwah} onNone={() => none('alwah')} onOn={() => r.alwah && set('alwah', r.alwah)} noneText="بلا ألواح اليوم">
                <Segs v={r.alwah} onChange={v => set('alwah', v)} />
            </Part>

            <Part title="المراجعة" off={off.rev} onNone={() => none('rev')} onOn={() => r.rev && set('rev', r.rev)} noneText="بلا مراجعة اليوم">
                <Segs v={r.rev} onChange={v => set('rev', v)} />
            </Part>

            <div className="flex gap-2">
                <Btn className="flex-1 !h-12" busy={busy} onClick={() => save(false)}><Save size={17} />احفظ ورد اليوم</Btn>
                {plan.custom ? <Btn kind="line" className="!h-12" disabled={busy} onClick={() => save(true)}><RotateCcw size={16} />التلقائي</Btn> : null}
            </div>
        </div>
    );
}

// بداية مقطع الحفظ ونهايته بترتيب الحفظ (من الناس صعوداً: السورة الأعلى رقماً أوّلاً)
function memEnds(dir, segs) {
    if (dir === 'asc') return [segs[0][0], segs[segs.length - 1][1]];
    const sn = k => +String(k).split(':')[0];
    const hi = segs.reduce((a, b) => (sn(b[0]) > sn(a[0]) ? b : a)), lo = segs.reduce((a, b) => (sn(b[0]) < sn(a[0]) ? b : a));
    return [hi[0], lo[1]];
}

function Part({ title, off, onNone, onOn, noneText, children }) {
    return (
        <div className="space-y-2 rounded-2xl border border-paper-2 p-3">
            <div className="flex items-center gap-2">
                <div className="text-[13px] font-bold text-ink flex-1">{title}</div>
                {off ? <button type="button" onClick={onOn} className="text-[12px] font-semibold text-brand">أعده</button>
                    : <button type="button" onClick={onNone} className="text-[12px] font-semibold text-ink-3">{noneText}</button>}
            </div>
            {off ? <div className="text-[13px] text-ink-3">{noneText}</div> : children}
        </div>
    );
}

function StartText({ k }) {
    const [t, setT] = useState('');
    useEffect(() => { label(k).then(setT).catch(() => {}); }, [k]);
    return <div className="font-quran text-[16px] text-ink">{t}</div>;
}

// مقاطع الجزء: لكلّ مقطعٍ من آيةٍ إلى آية (الألواح والمراجعة قد تكون من أكثر من سورة)
function Segs({ v, onChange }) {
    const segs = v && v.length ? v : [['78:1', '78:40']];
    return segs.map((sg, i) => (
        <div key={i} className={segs.length > 1 ? 'rounded-xl bg-paper-2/40 p-2' : ''}>
            <AyahRange from={sg[0]} to={sg[1]} labels={[segs.length > 1 ? `المقطع ${i + 1}: من` : 'من', 'إلى']} onChange={x => onChange(segs.map((y, j) => (j === i ? x : y)))} />
        </div>
    ));
}

function NewLines({ r }) {
    const [n, setN] = useState(null);
    useEffect(() => { let dead = false; segsLines(r).then(x => { if (!dead) setN(x); }).catch(() => {}); return () => { dead = true; }; }, [JSON.stringify(r)]); // eslint-disable-line react-hooks/exhaustive-deps
    return n ? <div className="text-[12px] text-ink-3">المقدار: {linesLabel(n)}</div> : null;
}
