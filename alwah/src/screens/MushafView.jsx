import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { call } from '../lib/api';
import { go } from '../lib/router';
import { useData } from '../App';
import { useToast, todayStr } from '../ui';
import Mushaf from '../components/Mushaf';
import WordActions from '../components/WordActions';
import { surahsOn, juzOf, rangeLabel, SURAHS, JUZ_START } from '../lib/quran';

// ─── مصحف الفرد: صفحاته بعلاماته هو ─────────────────────────────────────────
export default function MushafView({ id, p: pIn }) {
    const { members } = useData();
    const toast = useToast();
    const m = members.find(x => x.id === id);
    const start = Number(pIn) || (m && m.plan && m.plan.current) || 604;
    const [page, setPage] = useState(Math.min(604, Math.max(1, start)));
    const [marks, setMarks] = useState({});
    // الرابط هو المرجع: رجوعٌ أو رابطٌ لصفحةٍ أخرى يُحدّث الصفحة المعروضة
    useEffect(() => { const q = Number(pIn); if (q && q !== page) setPage(Math.min(604, Math.max(1, q))); }, [pIn]); // eslint-disable-line react-hooks/exhaustive-deps
    const [sel, setSel] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const r = await call('marks_page', { params: { member_id: id, page } });
        if (r.success) { const o = {}; r.marks.forEach(x => { o[x.word_key] = x; }); setMarks(o); }
    }, [id, page]);
    useEffect(() => { setSel(null); load(); }, [load]);

    // رابطٌ يحفظ الصفحة: التحديث يُبقيك مكانك
    const to = p => { const q = Math.min(604, Math.max(1, p)); setPage(q); go('/m/' + id + '/mushaf', { p: q }); };

    const op = async o => {
        if (!sel) return;
        setBusy(true);
        const r = await call('mark', { body: { member_id: id, word_key: sel.k, page, op: o, d: todayStr() } });
        setBusy(false);
        if (!r.success) { toast(r.message, 'err'); return; }
        setMarks(x => { const n = { ...x }; if (r.mark && (r.mark.err || r.mark.warn)) n[sel.k] = r.mark; else delete n[sel.k]; return n; });
        if (o === 'err' || o === 'warn') { toast(o === 'err' ? 'سُجّل خطأ' : 'سُجّل تنبيه'); setSel(null); }
    };

    if (!m) return <p className="text-center text-ink-3 py-16">غير موجود</p>;
    const plan = m.plan;
    const chips = [
        plan.new ? { t: 'حفظ اليوم', p: plan.new.page } : null,
        plan.alwah.length ? { t: 'الألواح ' + rangeLabel(plan.alwah), p: Math.min(...plan.alwah) } : null,
        plan.review.length ? { t: 'المراجعة ' + rangeLabel(plan.review), p: plan.review[0] } : null,
    ].filter(Boolean);
    const count = Object.values(marks).filter(x => !x.resolved).length;

    return (
        <div className="space-y-3 pb-28">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                <h1 className="font-bold text-ink">مصحف {m.name}</h1>
                <span className="ms-auto text-[12px] text-ink-3">{count ? `${count} علامة في الصفحة` : 'لا علامات في الصفحة'}</span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
                {chips.map(c => (
                    <button key={c.t} onClick={() => to(c.p)} className={'shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border ' + (page === c.p ? 'bg-brand text-white border-brand' : 'bg-paper-card border-paper-2 text-ink-2')}>{c.t}</button>
                ))}
            </div>

            {/* ── التقليب ── */}
            <div className="flex items-center gap-2">
                <button onClick={() => to(page - 1)} disabled={page <= 1} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center disabled:opacity-30" aria-label="الصفحة السابقة"><ChevronRight size={20} /></button>
                <div className="flex-1 text-center leading-tight">
                    <div className="font-bold text-ink">{surahsOn(page).join('، ')}</div>
                    <div className="text-[11px] text-ink-3">صفحة {page} · الجزء {juzOf(page)}</div>
                </div>
                <button onClick={() => to(page + 1)} disabled={page >= 604} className="w-11 h-11 rounded-xl bg-paper-card border border-paper-2 flex items-center justify-center disabled:opacity-30" aria-label="الصفحة التالية"><ChevronLeft size={20} /></button>
            </div>

            <Mushaf page={page} marks={marks} onWord={w => setSel(w)} selected={sel && sel.k} />

            <div className="flex items-center justify-center gap-3 text-[11px] text-ink-3">
                <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(220,38,38,.35)' }} />خطأ</span>
                <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(217,119,6,.35)' }} />تنبيه</span>
                <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(22,163,74,.2)' }} />أُتقنت</span>
                <span>· يغمق اللون بتكرار الخطأ</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <select className="h-10 rounded-xl bg-paper-card border border-paper-2 px-2 text-[13px]" value="" onChange={e => e.target.value && to(+e.target.value)}>
                    <option value="">انتقل إلى سورة…</option>
                    {SURAHS.map(([n, p], i) => <option key={i} value={p}>{i + 1}. {n}</option>)}
                </select>
                <select className="h-10 rounded-xl bg-paper-card border border-paper-2 px-2 text-[13px]" value="" onChange={e => e.target.value && to(+e.target.value)}>
                    <option value="">انتقل إلى جزء…</option>
                    {JUZ_START.map((p, i) => <option key={i} value={p}>الجزء {i + 1}</option>)}
                </select>
            </div>

            <WordActions word={sel} mark={sel ? marks[sel.k] : null} onOp={op} onClose={() => setSel(null)} busy={busy} />
        </div>
    );
}
