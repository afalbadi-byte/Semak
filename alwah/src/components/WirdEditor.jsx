import React, { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { call } from '../lib/api';
import { Btn, useToast, todayStr } from '../ui';
import { linesLabel } from '../lib/quran';
import { partRange, segsPages, segsLines, oneRange, segsFor } from '../lib/ayah';
import { AyahRange } from './AyahPicker';

// ─── ورد الفرد يدوياً (للمشرف) ───────────────────────────────────────────────
// كل جزءٍ نطاقٌ واحد «من سورة كذا آية كذا إلى سورة كذا آية كذا»، ويبقى وردَه حتى
// يغيّره المشرف (لا حساب تلقائيّ يطغى عليه). وما لم يُلمس من الأجزاء يبقى كما هو.
export default function WirdEditor({ member, plan, onDone, d, title }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [touched, setTouched] = useState({});
    const [r, setR] = useState({});                 // لكل جزءٍ نطاقٌ [من، إلى]
    const [orig, setOrig] = useState({});           // المقاطع كما هي (محتواها الدقيق ما لم يُعدَّل النطاق)
    const [off, setOff] = useState({ new: !!plan.new_off });

    useEffect(() => {
        let dead = false;
        (async () => {
            const o = {}, one = {};
            for (const k of ['new', 'alwah', 'rev']) { o[k] = await partRange(plan, k).catch(() => null); one[k] = oneRange(o[k]); }
            if (!dead) { setOrig(o); setR(one); }
        })();
        return () => { dead = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (k, v) => { setR(x => ({ ...x, [k]: v })); setTouched(t => ({ ...t, [k]: true })); setOff(o => ({ ...o, [k]: false })); };
    const none = k => { setOff(o => ({ ...o, [k]: true })); setTouched(t => ({ ...t, [k]: true })); };

    const save = async reset => {
        if (reset && !window.confirm('مسح الورد اليدوي لـ' + member.name + '؟ يعود الورد المقترح حتى تحدّده من جديد.')) return;
        setBusy(true);
        let body = { member_id: member.id, d: d || todayStr() };
        try {
            if (reset) body.reset = 1;
            else {
                const ranges = {};
                // يُرسل كل جزء: ما عُدِّل بنطاقه الجديد، وما لم يُعدَّل بمحتواه كما هو، فيثبت الورد كلّه
                for (const [k, lk] of [['new', null], ['alwah', 'alwah_list'], ['rev', 'rev_list']]) {
                    const segs = segsFor(r[k], orig[k]);
                    if (k === 'new') {
                        if (off.new) body.new_lines = 0;
                        else if (segs) { body.new_lines = Math.max(1, Math.min(90, await segsLines(segs))); ranges.new = segs; }
                    } else if (off[k]) body[lk] = [];
                    else if (segs) { body[lk] = await segsPages(segs); ranges[k] = segs; }
                }
                body.ranges = ranges;
            }
        } catch (e) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        const res = await call('wird_save', { body });
        setBusy(false);
        if (!res.success) { toast(res.message || 'تعذّر الحفظ', 'err'); return; }
        toast(reset ? 'مُسح الورد اليدوي' : 'حُفظ الورد');
        onDone && onDone();
    };

    const hasNew = !!plan.new || !!plan.new_off;
    return (
        <div className="space-y-5">
            <p className="text-[12px] text-ink-3 leading-6">{title || <>يبقى هذا ورد <b className="text-ink">{member.name}</b> حتى تغيّره.</>}</p>
            {hasNew ? (
                <Part title="الحفظ الجديد" off={off.new} onNone={() => none('new')} onOn={() => r.new && set('new', r.new)} noneText="لا حفظ جديد">
                    {r.new ? <><AyahRange from={r.new[0]} to={r.new[1]} onChange={v => set('new', v)} /><Lines r={segsFor(r.new, orig.new)} /></> : <div className="text-[12px] text-ink-3">…</div>}
                </Part>
            ) : null}
            <Part title="الألواح" off={off.alwah} onNone={() => none('alwah')} onOn={() => r.alwah && set('alwah', r.alwah)} noneText="بلا ألواح">
                <AyahRange from={(r.alwah || ['78:1', '78:40'])[0]} to={(r.alwah || ['78:1', '78:40'])[1]} onChange={v => set('alwah', v)} />
            </Part>
            <Part title="المراجعة" off={off.rev} onNone={() => none('rev')} onOn={() => r.rev && set('rev', r.rev)} noneText="بلا مراجعة">
                <AyahRange from={(r.rev || ['78:1', '78:40'])[0]} to={(r.rev || ['78:1', '78:40'])[1]} onChange={v => set('rev', v)} />
            </Part>
            <div className="flex gap-2">
                <Btn className="flex-1 !h-12" busy={busy} onClick={() => save(false)}><Save size={17} />احفظ الورد</Btn>
                {plan.custom && !d ? <Btn kind="line" className="!h-12" disabled={busy} onClick={() => save(true)}><RotateCcw size={16} />امسح</Btn> : null}
            </div>
        </div>
    );
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

function Lines({ r }) {
    const [n, setN] = useState(null);
    useEffect(() => { let dead = false; if (r) segsLines(r).then(x => { if (!dead) setN(x); }).catch(() => {}); return () => { dead = true; }; }, [JSON.stringify(r)]); // eslint-disable-line react-hooks/exhaustive-deps
    return n ? <div className="text-[12px] text-ink-3">المقدار: {linesLabel(n)}</div> : null;
}
