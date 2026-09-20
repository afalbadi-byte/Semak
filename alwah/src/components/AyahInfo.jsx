import React, { useEffect, useState } from 'react';
import { BookText, Sparkles, ChevronDown } from 'lucide-react';
import { ayahName } from '../lib/ayah';
import { BOOKS, ayahText, nuzulOf } from '../lib/tafsir';

// ─── تفسير الآية وسبب نزولها ─────────────────────────────────────────────────
// نصوصٌ منشورة باسم كتابها ومؤلّفه: المختصر في التفسير للتفسير المبسّط، والوجيز
// للواحدي (صاحب «أسباب النزول») لمناسبة النزول. ولا يُعرض شيءٌ من عند التطبيق.
const TABS = [
    { k: 'tafsir', t: 'التفسير', icon: BookText },
    { k: 'nuzul', t: 'سبب النزول', icon: Sparkles },
];

export default function AyahInfo({ ayah }) {
    const [tab, setTab] = useState(null);       // مطويٌّ حتى يُطلب
    const [book, setBook] = useState('mukhtasar');
    const [st, setSt] = useState({});

    useEffect(() => { setSt({}); setTab(null); }, [ayah]);

    const key = tab === 'nuzul' ? 'wajiz' : book;
    useEffect(() => {
        if (!tab || st[key] !== undefined) return undefined;
        let dead = false;
        setSt(s => ({ ...s, [key]: null }));
        ayahText(key, ayah)
            .then(t => { if (!dead) setSt(s => ({ ...s, [key]: t || '' })); })
            .catch(() => { if (!dead) setSt(s => ({ ...s, [key]: 'err' })); });
        return () => { dead = true; };
    }, [tab, key, ayah]); // eslint-disable-line react-hooks/exhaustive-deps

    const raw = st[key];
    const text = tab === 'nuzul' && typeof raw === 'string' && raw !== 'err' ? nuzulOf(raw) : raw;
    const b = BOOKS[key];

    return (
        <div className="mt-3 pt-3 border-t border-paper-2 space-y-2">
            <div className="flex gap-1.5">
                {TABS.map(({ k, t, icon: I }) => (
                    <button key={k} onClick={() => setTab(tab === k ? null : k)}
                        className={'h-10 px-3 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 border ' + (tab === k ? 'bg-brand text-white border-brand' : 'bg-paper-card border-paper-2 text-ink-2')}>
                        <I size={15} />{t}
                        {tab === k ? <ChevronDown size={14} /> : null}
                    </button>
                ))}
            </div>

            {tab ? (
                <div className="rounded-2xl bg-paper-2/40 p-3 space-y-2">
                    <div className="text-[12px] text-ink-3">{ayahName(ayah)}</div>
                    {tab === 'tafsir' ? (
                        <div className="flex gap-1.5 flex-wrap">
                            {['mukhtasar', 'muyassar', 'saadi'].map(x => (
                                <button key={x} onClick={() => setBook(x)}
                                    className={'h-8 px-2.5 rounded-lg text-[12px] font-semibold ' + (book === x ? 'bg-brand text-white' : 'bg-white text-ink-2 border border-paper-2')}>{BOOKS[x].name}</button>
                            ))}
                        </div>
                    ) : null}

                    {raw === undefined || raw === null ? <div className="text-[13px] text-ink-3">…</div>
                        : raw === 'err' ? <div className="text-[13px] text-red-700">تعذّر جلب النصّ، تحقّق من الإنترنت.</div>
                            : !text ? <div className="text-[13px] text-ink-3">لم يُذكر سبب نزولٍ لهذه الآية في {b.name}.</div>
                                : <p className="text-[14px] leading-8 text-ink whitespace-pre-line">{text}</p>}

                    {text && raw !== 'err' ? <p className="text-[11px] text-ink-3 leading-5">المصدر: {b.name} · {b.by}</p> : null}
                </div>
            ) : null}
        </div>
    );
}
