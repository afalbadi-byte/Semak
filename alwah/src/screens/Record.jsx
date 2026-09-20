import React, { useEffect, useState } from 'react';
import { BookOpen, Layers, RotateCcw, Check, Trash2, Save, ExternalLink } from 'lucide-react';
import { call } from '../lib/api';
import { replace, go } from '../lib/router';
import { useData } from '../App';
import { Card, Btn, Stepper, GradePicker, Spinner, inputCls, useToast, greg, hijri, todayStr } from '../ui';
import { surahsOn, surahsIn, rangeLabel, linesLabel, readUrl, LPP } from '../lib/quran';

// ─── تسميع يوم: الحفظ الجديد والألواح والمراجعة ─────────────────────────────
export default function Record({ id, d: dIn }) {
    const toast = useToast();
    const { reloadMembers, sup } = useData();
    const [d, setD] = useState(dIn || todayStr());
    const [data, setData] = useState(null);
    const [f, setF] = useState(null);
    const [busy, setBusy] = useState(false);
    const [fromMushaf, setFromMushaf] = useState(false);

    useEffect(() => {
        setData(null); setF(null);
        call('log_get', { params: { member_id: id, d } }).then(r => {
            if (!r.success) { setData({ error: r.message }); return; }
            setData(r);
            const l = r.log, p = r.plan;
            setF({
                new_page: l ? l.new_page : (p.new ? p.new.page : null),
                new_lines: l ? l.new_lines : (p.new ? p.new.lines : 0),
                new_grade: l ? l.new_grade : 0, new_err: l ? l.new_err : 0, new_warn: l ? l.new_warn : 0,
                alwah_list: l && l.alwah_list.length ? l.alwah_list : p.alwah,
                alwah_done: l ? !!l.alwah_done : false, alwah_grade: l ? l.alwah_grade : 0, alwah_err: l ? l.alwah_err : 0, alwah_warn: l ? l.alwah_warn : 0,
                rev_list: l && l.rev_list.length ? l.rev_list : p.review,
                rev_done: l ? !!l.rev_done : false, rev_grade: l ? l.rev_grade : 0, rev_err: l ? l.rev_err : 0, rev_warn: l ? l.rev_warn : 0,
                note: l ? (l.note || '') : '',
            });
            // لا تسميع مسجّل بعد: أخطاء اليوم وتنبيهاته من علامات المصحف، موزّعةً على أجزاء الورد
            if (!l) call('marks_day', { params: { member_id: id, d } }).then(k => {
                if (!k.success || !k.data.length) return;
                const sum = { new: [0, 0], alwah: [0, 0], rev: [0, 0] };
                k.data.forEach(x => {
                    const part = p.new && x.page === p.new.page ? 'new' : p.alwah.includes(x.page) ? 'alwah' : p.review.includes(x.page) ? 'rev' : null;
                    if (part) { sum[part][0] += x.err; sum[part][1] += x.warn; }
                });
                setF(f0 => f0 && ({ ...f0, new_err: sum.new[0], new_warn: sum.new[1], alwah_err: sum.alwah[0], alwah_warn: sum.alwah[1], rev_err: sum.rev[0], rev_warn: sum.rev[1] }));
                setFromMushaf(true);
            });
        });
    }, [id, d]);

    if (!sup) return <p className="text-center text-ink-3 py-16">إجازة التسميع للمشرف وحده.</p>;
    if (!data || (!f && !data.error)) return <Spinner />;
    if (data.error) return <p className="text-center text-ink-3 py-16">{data.error}</p>;
    const set = (k, v) => setF(x => ({ ...x, [k]: v }));
    const m = data.member, p = data.plan;
    const fromLine = p.new ? p.new.from_line : 1;
    const endLine = fromLine + f.new_lines - 1;

    const save = async () => {
        setBusy(true);
        const r = await call('log_save', { body: { ...f, member_id: id, d } });
        setBusy(false);
        if (!r.success) { toast(r.message || 'تعذّر الحفظ', 'err'); return; }
        toast('حُفظ التسميع، بارك الله فيه');
        reloadMembers();
        replace('/m/' + id);
    };
    const del = async () => {
        if (!window.confirm('حذف تسميع هذا اليوم؟ يعود التقدّم كما كان قبله.')) return;
        const r = await call('log_delete', { body: { member_id: id, d } });
        if (r.success) { toast('حُذف'); reloadMembers(); replace('/m/' + id); } else toast(r.message, 'err');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink-3">تسميع</div>
                    <h1 className="text-[20px] font-bold text-ink truncate" style={{ color: m.color }}>{m.name}</h1>
                    <div className="text-[12px] text-ink-3">{greg(d)} · {hijri(d)}</div>
                </div>
                <input type="date" className={inputCls + ' !w-auto'} value={d} max={todayStr()} onChange={e => e.target.value && setD(e.target.value)} />
            </div>

            {fromMushaf ? <div className="rounded-xl bg-brand-50 text-brand-700 text-[12px] font-semibold p-3">عُبّئت الأخطاء والتنبيهات من علامات المصحف اليوم، وتقدر تعدّلها.</div> : null}

            {/* ── الحفظ الجديد ── */}
            <Part icon={BookOpen} title="الحفظ الجديد" color={m.color}
                head={p.new ? `صفحة ${p.new.page} · ${surahsOn(p.new.page).join('، ')}` : p.rest ? 'يوم راحة' : p.new_off ? 'لا حفظ جديد اليوم' : 'أتمّ الحفظ'}
                link={p.new ? '#/hifz?m=' + id + '&t=new' : null}>
                {p.new ? (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] text-ink-2 leading-6">
                                كم حفظ اليوم؟ <b className="text-ink">{linesLabel(f.new_lines)}</b>
                                {f.new_lines ? <span className="block text-[12px] text-ink-3">
                                    من السطر {fromLine}{f.new_lines === p.new.lines && p.new.to_line ? ` إلى ${p.new.to_line}` : endLine <= LPP ? ` إلى ${endLine}` : ` ويكمل بعدها`}</span> : null}
                            </div>
                            <Stepper value={f.new_lines} onChange={v => set('new_lines', v)} max={90} />
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                            {[[3, '٣ أسطر'], [5, '٥ أسطر'], [8, 'نصف صفحة'], [15, 'صفحة'], [30, 'صفحتان']].map(([v, t]) => (
                                <button key={v} type="button" onClick={() => set('new_lines', v)}
                                    className={'h-8 px-3 rounded-lg text-[12px] font-semibold ' + (f.new_lines === v ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>{t}</button>
                            ))}
                            <button type="button" onClick={() => set('new_lines', 0)} className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-paper-2 text-ink-3">لم يحفظ</button>
                        </div>
                        {f.new_lines ? <Grade f={f} set={set} k="new" /> : null}
                        {f.new_grade === 1 ? <p className="text-[12px] text-red-700">«يعاد»: لا يُحتسب هذا المقدار في التقدّم، ويبقى ورده غداً كما هو.</p> : null}
                    </>
                ) : <p className="text-[13px] text-ink-3">{p.rest ? 'يوم راحة، لا حفظ جديد.' : p.new_off ? 'لا حفظ جديد اليوم.' : 'ما شاء الله، أتمّ حفظ القرآن كاملاً.'}</p>}
            </Part>

            {/* ── الألواح ── */}
            <Part icon={Layers} title={`الألواح (${f.alwah_list.length} صفحات)`} color={m.color}
                head={'صفحات ' + rangeLabel(f.alwah_list)} sub={surahsIn(f.alwah_list).join('، ')}
                done={f.alwah_done} onDone={v => set('alwah_done', v)}>
                {f.alwah_done ? <Grade f={f} set={set} k="alwah" /> : null}
            </Part>

            {/* ── المراجعة ── */}
            <Part icon={RotateCcw} title={`المراجعة (${f.rev_list.length} صفحات)`} color={m.color}
                head={f.rev_list.length ? 'صفحات ' + rangeLabel(f.rev_list) : 'لا مراجعة بعد'}
                sub={surahsIn(f.rev_list).join('، ')}
                done={f.rev_done} onDone={f.rev_list.length ? v => set('rev_done', v) : null}>
                {f.rev_done ? (
                    <>
                        {p.review.length > 1 ? (
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[13px] text-ink-2">راجع فعلاً</span>
                                <Stepper value={f.rev_list.length} min={1} max={Math.max(p.review.length, f.rev_list.length)}
                                    onChange={n => set('rev_list', (p.review.length >= n ? p.review : f.rev_list).slice(0, n))} label="صفحة" />
                            </div>
                        ) : null}
                        <Grade f={f} set={set} k="rev" />
                    </>
                ) : null}
            </Part>

            <Card className="p-4">
                <textarea className={inputCls + ' !h-20 py-2 leading-6'} placeholder="ملاحظة (اختيارية): مواضع الخطأ، تشجيع، وصية للغد…"
                    value={f.note} onChange={e => set('note', e.target.value)} />
            </Card>

            <div className="flex gap-2">
                <Btn className="flex-1 !h-12" busy={busy} onClick={save}><Save size={17} />احفظ التسميع</Btn>
                {data.log ? <Btn kind="danger" className="!h-12" onClick={del} aria-label="حذف"><Trash2 size={17} /></Btn> : null}
            </div>
            <button onClick={() => go('/m/' + id)} className="block mx-auto text-[13px] text-ink-3 font-semibold">إلغاء</button>
        </div>
    );
}

function Part({ icon: I, title, head, sub, color, done, onDone, link, children }) {
    const toggle = onDone !== undefined;
    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: color }}><I size={18} /></div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-ink-3">{title}</div>
                    <div className="text-[15px] font-bold text-ink">{head}</div>
                    {sub ? <div className="text-[12px] text-ink-3 leading-5">{sub}</div> : null}
                </div>
                {link ? <a href={link} title="افتح في المصحف مع المُسمِع" className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-3"><ExternalLink size={16} /></a> : null}
                {toggle && onDone ? (
                    <button type="button" onClick={() => onDone(!done)}
                        className={'h-10 px-3 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 border ' + (done ? 'text-white border-transparent' : 'bg-white border-paper-2 text-ink-2')}
                        style={done ? { background: color } : undefined}>
                        <Check size={15} />{done ? 'سمّع' : 'سمّع؟'}
                    </button>
                ) : null}
            </div>
            {children}
        </Card>
    );
}

// التقدير والأخطاء والتنبيهات لكل جزءٍ من الورد
function Grade({ f, set, k }) {
    return (
        <div className="space-y-3 pt-1">
            <GradePicker value={f[k + '_grade']} onChange={v => set(k + '_grade', v)} />
            <div className="flex items-center justify-around bg-paper-2/50 rounded-xl py-2">
                <Stepper value={f[k + '_err']} onChange={v => set(k + '_err', v)} label="أخطاء" tone="text-red-700" />
                <Stepper value={f[k + '_warn']} onChange={v => set(k + '_warn', v)} label="تنبيهات" tone="text-amber-700" />
            </div>
        </div>
    );
}
