import React, { useEffect, useState } from 'react';
import { Share2, Check, CalendarDays } from 'lucide-react';
import { call } from '../lib/api';
import { useData } from '../App';
import { Card, Btn, Empty, Spinner, useToast, tomorrowStr, greg, hijri } from '../ui';
import { segsPages, segsLines, oneRange, label } from '../lib/ayah';
import { PARTS, PartLine, partSegs } from '../components/TomorrowCard';

// ─── ملخّص المساء: ورد الغد لكل أفراد الأسرة في صفحةٍ واحدة ───────────────────
// يعتمده المشرف للجميع بضغطة، ويرسله واتساب للأم أو للمعلّم.
export default function Tomorrow() {
    const { members, sup, family, reloadMembers } = useData();
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [txt, setTxt] = useState('');
    const d = tomorrowStr();

    // نصّ الرسالة: كل فرد وأجزاء ورده بالسور والآيات
    useEffect(() => {
        let dead = false;
        (async () => {
            const L = [`ورد الغد · ${greg(d, { weekday: 'long', day: 'numeric', month: 'long' })}`, hijri(d), ''];
            for (const m of members) {
                L.push(`*${m.name}*`);
                for (const { k, t } of PARTS) {
                    const segs = k === 'new' && m.next && m.next.new_off ? null : partSegs(m.next, k);
                    const one = oneRange(segs);
                    if (!one) { L.push(`${t}: لا شيء`); continue; }
                    const [a, b] = await Promise.all([label(one[0]), label(one[1])]);
                    L.push(one[0] === one[1] ? `${t}: ${a}` : `${t}: من ${a} إلى ${b}`);
                }
                L.push('');
            }
            L.push('تطبيق ألواح · alwah.semak.sa');
            if (!dead) setTxt(L.join('\n'));
        })().catch(() => {});
        return () => { dead = true; };
    }, [members]); // eslint-disable-line react-hooks/exhaustive-deps

    const acceptAll = async () => {
        setBusy(true);
        try {
            for (const m of members) {
                const body = { member_id: m.id, d, ranges: {} };
                for (const { k } of PARTS) {
                    const segs = k === 'new' && m.next && m.next.new_off ? null : partSegs(m.next, k);
                    if (k === 'new') body.new_lines = segs ? Math.max(1, Math.min(90, await segsLines(segs))) : 0;
                    else body[k === 'alwah' ? 'alwah_list' : 'rev_list'] = segs ? await segsPages(segs) : [];
                    if (segs) body.ranges[k] = segs;
                }
                const r = await call('wird_save', { body });
                if (!r.success) { setBusy(false); toast(r.message || 'تعذّر الحفظ', 'err'); return; }
            }
        } catch (e) { setBusy(false); toast('تعذّر تحميل بيانات الآيات، تحقق من الإنترنت', 'err'); return; }
        setBusy(false);
        toast('اعتُمد ورد الغد للجميع');
        reloadMembers();
    };

    if (!members.length) return <Empty icon={CalendarDays} title="لا أفراد بعد" text="أضف أفراد الأسرة من الإعدادات." />;
    if (!members[0].next) return <Spinner />;

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-[20px] font-bold text-ink">ورد الغد</h1>
                <p className="text-[12px] text-ink-3">{greg(d, { weekday: 'long', day: 'numeric', month: 'long' })} · {hijri(d)}{family ? ' · ' + family.name : ''}</p>
            </div>

            {members.map(m => (
                <Card key={m.id} className="p-4 space-y-2">
                    <a href={'#/m/' + m.id} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                        <span className="font-bold text-ink flex-1">{m.name}</span>
                        {m.next && m.next.custom ? <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 rounded-lg px-2 py-0.5">معتمد</span> : <span className="text-[11px] text-ink-3">مقترح</span>}
                    </a>
                    {PARTS.map(({ k, t, icon: I, c }) => (
                        <PartLine key={k} t={t} I={I} c={c} small segs={k === 'new' && m.next && m.next.new_off ? null : partSegs(m.next, k)} />
                    ))}
                </Card>
            ))}

            {sup ? <Btn className="w-full !h-12" busy={busy} onClick={acceptAll}><Check size={17} />اعتمد ورد الغد للجميع</Btn> : null}
            <a href={'https://wa.me/?text=' + encodeURIComponent(txt)} target="_blank" rel="noreferrer" className={txt ? '' : 'pointer-events-none opacity-50'}>
                <Btn kind="line" className="w-full !h-12"><Share2 size={17} />أرسل الملخّص واتساب</Btn>
            </a>
        </div>
    );
}
