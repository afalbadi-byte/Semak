import React, { useCallback, useEffect, useState } from 'react';
import { Flame, Mic, BookOpen, Layers, RotateCcw, ExternalLink, Check, Pencil, CalendarDays, Award } from 'lucide-react';
import { call } from '../lib/api';
import { Card, Ring, Section, Spinner, Btn, hijri, greg, todayStr, useToast } from '../ui';
import { Target } from 'lucide-react';
import { surahsOn, surahsIn, rangeLabel, linesLabel, juzOf, gradeOf, SURAHS } from '../lib/quran';
import { BookMarked } from 'lucide-react';
import { partDone } from './Home';
import TomorrowCard from '../components/TomorrowCard';
import { useData } from '../App';

export default function MemberView({ id }) {
    const { sup } = useData();
    const [d, setD] = useState(null);
    const load = useCallback(async () => {
        const [r, k] = await Promise.all([call('member', { params: { id } }), call('marks_summary', { params: { member_id: id } })]);
        setD(r.success ? { ...r, marks: k.success ? k : null } : { error: r.message });
    }, [id]);
    useEffect(() => { load(); }, [load]);

    if (!d) return <Spinner />;
    if (d.error) return <p className="text-center text-ink-3 py-16">{d.error}</p>;
    const { member: m, plan, now, stats } = d;
    const today = stats.today;
    const color = m.color;
    const mu = pg => '#/m/' + m.id + '/mushaf?p=' + pg;
    // لمس جزءٍ من الورد يفتحه في صفحة الحفظ عند أوّل آيةٍ منه، والمُسمِع جاهزٌ عليه
    const hz = t => '#/hifz?m=' + m.id + '&t=' + t;
    const sm = d.marks;

    return (
        <div className="space-y-5">
            {/* ── البطاقة ── */}
            <Card className="p-5">
                <div className="flex items-center gap-4">
                    <Ring value={now.memorized_pages / 604} color={color} size={84} stroke={9}>
                        <div className="text-center leading-none">
                            <div className="text-[20px] font-bold text-ink tabular-nums">{now.juz >= 1 ? now.juz.toFixed(1).replace('.0', '') : Math.round(now.memorized_pages)}</div>
                            <div className="text-[10px] text-ink-3 mt-1">{now.juz >= 1 ? 'جزء' : 'صفحة'}</div>
                        </div>
                    </Ring>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[20px] font-bold text-ink truncate">{m.name}</h1>
                        <p className="text-[12px] text-ink-3 mt-1">
                            {now.current ? `يحفظ في ${surahsOn(now.current)[0]} · صفحة ${now.current} · الجزء ${juzOf(now.current)}` : 'أتمّ حفظ القرآن الكريم'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <Chip icon={Flame} tone="text-orange-600">{stats.streak} يوم متتالي</Chip>
                            <Chip icon={BookOpen}>{now.memorized_pages} صفحة</Chip>
                            <Chip icon={Award}>{linesLabel(stats.week_lines)} هذا الأسبوع</Chip>
                        </div>
                    </div>
                </div>
            </Card>

            <a href={'#/hifz?m=' + m.id} className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-card" style={{ background: color }}>
                <BookMarked size={22} />
                <div className="flex-1 min-w-0">
                    <div className="font-bold">صفحة الحفظ</div>
                    <div className="text-[12px] opacity-90">مصحفه بعلاماته · تلاوة الشيخ محمد أيوب بالتكرار · سمّع لنفسك</div>
                </div>
            </a>

            {/* ── ورد اليوم ── */}
            <Section title={'ورد اليوم · ' + greg(todayStr(), { weekday: 'long', day: 'numeric', month: 'long' })}
                action={today && sup ? <a href={'#/m/' + m.id + '/log'} className="text-[12px] font-bold text-brand inline-flex items-center gap-1"><Pencil size={12} />عدّل</a> : null}>
                <Card className="divide-y divide-paper-2">
                    <PlanRow icon={BookOpen} title="الحفظ الجديد" done={partDone(today, 'new')} color={color} late={plan.late && plan.late.new}
                        main={plan.new ? `صفحة ${plan.new.page} · ${surahsOn(plan.new.page).join('، ')}` : 'أتمّ الحفظ'}
                        sub={plan.new ? `من السطر ${plan.new.from_line} · المقدار ${linesLabel(plan.new.lines)}` : ''}
                        link={plan.new ? hz('new') : null} />
                    <PlanRow icon={Layers} title={`الألواح (${plan.alwah.length} صفحات)`} done={partDone(today, 'alwah')} color={color} late={plan.late && plan.late.alwah}
                        main={'صفحات ' + rangeLabel(plan.alwah)} sub={surahsIn(plan.alwah).join('، ')}
                        link={plan.alwah.length ? hz('alwah') : null} />
                    <PlanRow icon={RotateCcw} title={`المراجعة (${plan.review.length} صفحات)`} done={partDone(today, 'rev')} color={color} late={plan.late && plan.late.rev}
                        main={plan.review.length ? 'صفحات ' + rangeLabel(plan.review) : 'تبدأ المراجعة بعد أن يتجاوز المحفوظ الألواح'}
                        sub={plan.review.length ? `${surahsIn(plan.review).join('، ')} · الموضع ${plan.cycle_pos} من ${plan.cycle} في الدورة` : ''}
                        link={plan.review.length ? hz('rev') : null} />
                </Card>
                {sup ? (
                    <a href={'#/m/' + m.id + '/log'} className="block mt-3">
                        <Btn className="w-full !h-12"><Mic size={18} />{today ? 'عدّل تسميع اليوم' : 'سجّل تسميع اليوم'}</Btn>
                    </a>
                ) : <p className="mt-3 text-center text-[12px] text-ink-3">يُجاز الورد حين يسمعه المشرف ويضع «تمّ التسميع».</p>}
            </Section>

            {sup && plan.new && plan.late && plan.late.new >= 1 ? <Double member={m} lines={plan.new.lines} onDone={load} /> : null}

            {now.goal ? <GoalCard g={now.goal} color={color} /> : null}

            <TomorrowCard member={m} plan={d.next} sup={sup} onDone={load} />

            {/* ── مصحف الفرد: مواضع الضعف ── */}
            {/* التفاصيل والإحصاءات للمشرف؛ والفرد يرى ورده كبيراً واضحاً */}
            {sup ? (
            <>
            <Section title={'مصحف ' + m.name} action={<a href={mu(now.current || 604)} className="text-[12px] font-bold text-brand inline-flex items-center gap-1"><BookMarked size={13} />افتح المصحف</a>}>
                <Card className="p-4">
                    {sm && sm.total.words ? (
                        <>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div><div className="text-[20px] font-bold text-red-700">{sm.total.err}</div><div className="text-[11px] text-ink-3">خطأ</div></div>
                                <div><div className="text-[20px] font-bold text-amber-600">{sm.total.warn}</div><div className="text-[11px] text-ink-3">تنبيه</div></div>
                                <div><div className="text-[20px] font-bold text-green-700">{sm.total.mastered}</div><div className="text-[11px] text-ink-3">أُتقنت</div></div>
                            </div>
                            <div className="text-[12px] font-semibold text-ink-2 mt-4 mb-2">أكثر الصفحات حاجةً للمراجعة</div>
                            <div className="flex flex-wrap gap-1.5">
                                {sm.pages.map(x => (
                                    <a key={x.page} href={mu(x.page)} className="h-8 px-3 rounded-lg bg-red-50 text-red-800 text-[12px] font-semibold inline-flex items-center gap-1">
                                        ص {x.page} · {surahsOn(x.page)[0]} <span className="opacity-60">({x.err + x.warn})</span>
                                    </a>
                                ))}
                            </div>
                        </>
                    ) : <p className="text-[13px] text-ink-3 leading-6">افتح المصحف وقت التسميع والمس الكلمة التي أخطأ فيها أو نُبّه عليها، فتُحفظ في مصحفه ويظهر هنا أكثر ما يحتاج مراجعته.</p>}
                </Card>
            </Section>

            {/* ── خريطة الأجزاء ── */}
            <Section title={`خريطة المحفوظ · ${now.juz >= 1 ? now.juz.toFixed(1).replace('.0', '') + ' جزء' : now.memorized_pages + ' صفحة'} من ٣٠`}>
                <Card className="p-4">
                    <div className="grid grid-cols-6 gap-1.5">
                        {now.juz_map.map((v, i) => (
                            <div key={i} className="relative h-11 rounded-lg bg-paper-2 overflow-hidden" title={`الجزء ${i + 1}: ${Math.round(v * 100)}%`}>
                                <div className="absolute inset-y-0 right-0 transition-all" style={{ width: (v * 100) + '%', background: color, opacity: v >= 1 ? 1 : 0.55 }} />
                                <span className={'absolute inset-0 flex items-center justify-center text-[12px] font-bold ' + (v >= 0.5 ? 'text-white' : 'text-ink-2')}>{i + 1}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </Section>

            {/* ── آخر ٦٠ يوماً ── */}
            <Section title="آخر ٦٠ يوماً">
                <Card className="p-4">
                    <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1" dir="ltr">
                        {stats.calendar.map(c => (
                            <a key={c.d} href={'#/m/' + m.id + '/log?d=' + c.d} title={greg(c.d) + ' · ' + ['لا تسميع', 'جزء من الورد', 'جزء من الورد', 'الورد كاملاً'][c.s]}
                                className="aspect-square rounded-[4px]"
                                style={{ background: c.s ? color : '#ebe5d8', opacity: c.s ? 0.3 + c.s * 0.23 : 1 }} />
                        ))}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-3">
                        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-[3px] inline-block" style={{ background: color, opacity: 1 }} />الورد كاملاً</span>
                        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-[3px] inline-block" style={{ background: color, opacity: 0.53 }} />بعضه</span>
                        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-[3px] inline-block bg-paper-2" />لا تسميع</span>
                    </div>
                </Card>
            </Section>

            {/* ── الأداء ── */}
            <Section title="الأداء في آخر ٣٠ يوماً">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Stat label="أيام التسميع" value={stats.days30} />
                    <Stat label="الحفظ الجديد" value={gradeText(stats.avg.new)} />
                    <Stat label="الألواح" value={gradeText(stats.avg.alwah)} />
                    <Stat label="المراجعة" value={gradeText(stats.avg.rev)} />
                </div>
                <p className="text-[12px] text-ink-3 mt-2 px-1">مجموع الأخطاء {stats.errors30} · حُفظ في الشهر {linesLabel(stats.month_lines)}</p>
            </Section>

            {/* ── السجلّ ── */}
            <Section title="سجلّ التسميع">
                {d.history.length ? (
                    <Card className="divide-y divide-paper-2">
                        {d.history.map(h => <HistoryRow key={h.id} h={h} mid={m.id} />)}
                    </Card>
                ) : <Card className="p-6 text-center text-[13px] text-ink-3"><CalendarDays className="mx-auto mb-2 text-ink-3" size={22} />لا تسميع بعد</Card>}
            </Section>
            </>
            ) : null}
        </div>
    );
}

const gradeText = v => { if (!v) return '—'; const g = gradeOf(Math.round(v)); return g ? g.t : '—'; };

function Chip({ icon: I, children, tone = 'text-ink-2' }) {
    return <span className={'inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-paper-2 text-[12px] font-semibold ' + tone}><I size={13} />{children}</span>;
}

function Stat({ label, value }) {
    return (
        <Card className="p-3 text-center">
            <div className="text-[17px] font-bold text-ink">{value}</div>
            <div className="text-[11px] text-ink-3 mt-0.5">{label}</div>
        </Card>
    );
}

// الهدف: سورةٌ في تاريخ، والمطلوب يومياً، وهل هو متقدّم أم متأخّر
// قضاءٌ اختياري ليومٍ فات: يُضاعَف حفظ اليوم مرّةً واحدة
function Double({ member, lines, onDone }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        const r = await call('wird_save', { body: { member_id: member.id, d: todayStr(), new_lines: Math.min(90, lines * 2), ranges: { new: null } } });
        setBusy(false);
        if (!r.success) { toast(r.message || 'تعذّر الحفظ', 'err'); return; }
        toast('ضوعف حفظ اليوم');
        onDone();
    };
    return (
        <Card className="p-3 flex items-center gap-2">
            <div className="flex-1 text-[12px] text-ink-2">فاته حفظ أمس. تقدر تضاعف حفظ اليوم مرّةً واحدة.</div>
            <Btn kind="soft" busy={busy} onClick={go}>ضاعف حفظ اليوم</Btn>
        </Card>
    );
}

function GoalCard({ g, color }) {
    const st = { done: ['أتمّ الهدف، ما شاء الله', 'text-green-700'], ahead: ['متقدّم على الهدف', 'text-green-700'], on: ['على المسار', 'text-brand-700'], behind: ['متأخّر عن الهدف', 'text-amber-700'] }[g.state] || ['', ''];
    return (
        <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
                <Target size={17} className="text-ink-3" />
                <div className="font-bold text-ink flex-1">الهدف: {SURAHS[g.surah - 1] ? 'سورة ' + SURAHS[g.surah - 1][0] : ''}</div>
                <span className={'text-[12px] font-bold ' + st[1]}>{st[0]}</span>
            </div>
            <div className="h-2 rounded-full bg-paper-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: Math.round(g.progress * 100) + '%', background: color }} /></div>
            <div className="text-[12px] text-ink-3 leading-6">
                {g.remain_lines ? <>الباقي {linesLabel(g.remain_lines)} في {g.days} يوماً · المطلوب {linesLabel(g.need)} يومياً{g.need > g.target ? <span className="text-amber-700 font-semibold"> (الورد الحالي {linesLabel(g.target)})</span> : null}</> : 'اكتمل'}
                <span className="block">الموعد: {greg(g.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
        </Card>
    );
}

function PlanRow({ icon: I, title, main, sub, done, link, color, late }) {
    return (
        <Row href={link} className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: done ? color : '#ebe5d8', color: done ? '#fff' : '#48534f' }}>
                {done ? <Check size={18} /> : <I size={18} />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-ink-3">{title}{!done && late ? <span className="ms-1 text-amber-700 font-bold">· {late === 1 ? 'مؤجّل من أمس' : `متأخّر ${late} أيام`}</span> : null}</div>
                <div className="text-[15px] font-bold text-ink mt-0.5">{main}</div>
                {sub ? <div className="text-[12px] text-ink-3 mt-0.5 leading-5">{sub}</div> : null}
            </div>
            {link ? <span title="افتح في المصحف مع المُسمِع" className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-3 shrink-0"><BookMarked size={16} /></span> : null}
        </Row>
    );
}
const Row = ({ href, className, children }) => (href ? <a href={href} className={className + ' hover:bg-paper-2/40'}>{children}</a> : <div className={className}>{children}</div>);

function HistoryRow({ h, mid }) {
    const g = k => { const x = gradeOf(h[k]); return x ? <span style={{ color: x.c }}>{x.t}</span> : null; };
    return (
        <a href={'#/m/' + mid + '/log?d=' + h.d} className="block p-4 hover:bg-paper-2/40">
            <div className="flex items-center gap-2">
                <span className="font-bold text-ink text-[14px]">{greg(h.d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="text-[11px] text-ink-3">{hijri(h.d)}</span>
                {h.by ? <span className="ms-auto text-[11px] text-ink-3">سمّع له: {h.by}</span> : null}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[12px]">
                <div className="rounded-lg bg-paper-2/60 p-2">
                    <div className="text-ink-3">جديد</div>
                    <div className="font-semibold text-ink">{h.new_lines ? linesLabel(h.new_lines) : '—'} {g('new_grade')}</div>
                </div>
                <div className="rounded-lg bg-paper-2/60 p-2">
                    <div className="text-ink-3">ألواح</div>
                    <div className="font-semibold text-ink">{h.alwah_done ? 'تمّت' : '—'} {h.alwah_done ? g('alwah_grade') : null}</div>
                </div>
                <div className="rounded-lg bg-paper-2/60 p-2">
                    <div className="text-ink-3">مراجعة</div>
                    <div className="font-semibold text-ink">{h.rev_done ? rangeLabel(h.rev_list) : '—'} {h.rev_done ? g('rev_grade') : null}</div>
                </div>
            </div>
            {(h.new_err + h.alwah_err + h.rev_err) ? <div className="text-[11px] text-red-700 mt-1.5">أخطاء {h.new_err + h.alwah_err + h.rev_err} · تنبيهات {h.new_warn + h.alwah_warn + h.rev_warn}</div> : null}
            {h.note ? <div className="text-[12px] text-ink-2 mt-1.5 leading-5">{h.note}</div> : null}
        </a>
    );
}

