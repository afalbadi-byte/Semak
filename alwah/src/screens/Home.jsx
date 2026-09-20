import React from 'react';
import { Flame, Mic, UserPlus, BookOpen, Check, Radio } from 'lucide-react';
import { useData } from '../App';
import { Card, Ring, Empty, Btn, hijri, greg, todayStr } from '../ui';
import { surahOf, juzOf } from '../lib/quran';

const PARTS = [['new', 'جديد'], ['alwah', 'ألواح'], ['rev', 'مراجعة']];
export const partDone = (t, k) => !!t && (k === 'new' ? t.new_lines > 0 && t.new_grade !== 1 : k === 'alwah' ? !!t.alwah_done : !!t.rev_done);

export default function Home() {
    const { me, family, members, sup } = useData();
    const d = todayStr();
    const done = members.filter(m => m.today && PARTS.every(([k]) => partDone(m.today, k))).length;

    return (
        <div className="space-y-4">
            <div className="al-hero relative overflow-hidden rounded-3xl text-white p-5">
                <div className="absolute inset-0 al-pattern" />
                <div className="relative">
                    <div className="text-[12px] text-white/70">{greg(d)} · {hijri(d)}</div>
                    <h1 className="text-[20px] font-bold mt-1">{family ? family.name : 'أسرتي'}</h1>
                    <p className="text-[13px] text-white/80 mt-1">
                        {members.length ? `أتمّ ورد اليوم ${done} من ${members.length}` : 'ابدأ بإضافة أفراد الأسرة'}
                    </p>
                    {members.length ? <a href="#/session" className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-[13px] font-bold"><Radio size={16} />جلسة الذكر</a> : null}
                </div>
            </div>

            {!members.length ? (
                <Card>
                    <Empty icon={UserPlus} title="لا أفراد بعد"
                        text="أضف نفسك وزوجتك والأولاد، وحدّد لكلٍّ منهم أين وصل في الحفظ، فيحسب التطبيق ورده اليومي."
                        action={sup ? <a href="#/settings?add=1"><Btn><UserPlus size={17} />أضف فرداً</Btn></a> : null} />
                </Card>
            ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                    {members.map(m => <MemberCard key={m.id} m={m} />)}
                </div>
            )}

            {!sup && !me.member_id ? <p className="text-center text-[12px] text-ink-3">حسابك غير مرتبط بفرد، اطلب من صاحب الحساب ربطه.</p> : null}
        </div>
    );
}

function MemberCard({ m }) {
    const { sup } = useData();
    const p = m.plan;
    const cur = p.current;
    return (
        <Card className="p-4">
            <a href={'#/m/' + m.id} className="flex items-center gap-3">
                <Ring value={p.memorized_pages / 604} color={m.color} size={60}>
                    <div className="text-center leading-none">
                        <div className="text-[15px] font-bold text-ink tabular-nums">{p.juz >= 1 ? Math.floor(p.juz) : Math.round(p.memorized_pages)}</div>
                        <div className="text-[9px] text-ink-3 mt-0.5">{p.juz >= 1 ? 'جزء' : 'صفحة'}</div>
                    </div>
                </Ring>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="font-bold text-ink truncate">{m.name}</span>
                        {m.streak ? <span className="ms-auto inline-flex items-center gap-0.5 text-[12px] font-bold text-orange-600"><Flame size={14} />{m.streak}</span> : null}
                    </div>
                    <div className="text-[12px] text-ink-3 mt-1 truncate flex items-center gap-1">
                        <BookOpen size={12} />{cur ? `يحفظ في ${surahOf(cur)} · ص ${cur} · الجزء ${juzOf(cur)}` : p.rest ? 'يوم راحة' : p.new_off ? 'لا حفظ جديد اليوم' : 'أتمّ حفظ القرآن'}
                    </div>
                </div>
            </a>
            <div className="flex items-center gap-1.5 mt-3">
                {PARTS.map(([k, t]) => {
                    const ok = partDone(m.today, k);
                    return (
                        <span key={k} className={'flex-1 h-8 rounded-lg text-[12px] font-semibold inline-flex items-center justify-center gap-1 ' +
                            (ok ? 'bg-brand-50 text-brand-700' : 'bg-paper-2 text-ink-3')}>
                            {ok ? <Check size={13} /> : null}{t}
                        </span>
                    );
                })}
                {sup ? <a href={'#/m/' + m.id + '/log'} className="h-8 px-3 rounded-lg bg-brand text-white text-[12px] font-bold inline-flex items-center gap-1"><Mic size={13} />تسميع</a> : null}
            </div>
        </Card>
    );
}
