import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ExternalLink, Layers } from 'lucide-react';
import { API_URL } from '../../lib/api/client';
import EntityLink from '../../components/EntityLink';
import { ENTITY_LABEL } from '../../lib/entity';

const money = v => {
    const n = Number(v);
    if (!isFinite(n)) return v;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const isNum = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));

// ─── بطاقة الكيان: كل ما في النظام تحت اسم واحد، وكل دلالة فيها رابط ─────────
export default function EntityView({ type, value }) {
    const [data, setData]   = useState(null);
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!type || !value) return;
        setBusy(true); setError(''); setData(null);
        try {
            const r = await fetch(`${API_URL}?action=entity&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`)
                .then(x => x.json());
            if (!r.success) throw new Error(r.message || 'تعذر جلب البطاقة');
            setData(r);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    }, [type, value]);

    useEffect(() => { load(); }, [load]);

    if (busy) return <div className="flex justify-center py-24"><Loader2 size={30} className="animate-spin text-brand-300" /></div>;
    if (error) return <div className="p-6 md:p-8"><div className="rounded-xl bg-red-50 text-red-700 text-sm p-4">{error}</div></div>;
    if (!data) return null;

    return (
        <div className="p-6 md:p-8 space-y-5 animate-fadeIn">
            <div>
                <div className="text-xs font-bold text-gold-600">{ENTITY_LABEL[data.type] || data.subtitle}</div>
                <h2 className="text-2xl font-black text-brand-900 dark:text-brand-50">{data.title}</h2>
                {!!(data.links || []).length && (
                    <div className="flex gap-3 flex-wrap mt-2 text-xs">
                        {data.links.map((l, i) => (
                            <EntityLink key={i} type={l.type} value={l.value} className="text-brand-700 font-bold">
                                {l.label}
                            </EntityLink>
                        ))}
                    </div>
                )}
            </div>

            {!!(data.stats || []).length && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.stats.map((s, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-white dark:bg-brand-900 dark:border-brand-700 p-3">
                            <div className="text-[11px] text-slate-500 dark:text-brand-300">{s.label}</div>
                            <div className="text-lg font-black text-brand-900 dark:text-brand-50 mt-1 tabular-nums">
                                {s.money ? money(s.value) : String(s.value ?? '—')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(data.sections || []).map((sec, si) => <Section key={si} sec={sec} />)}
        </div>
    );
}

function Section({ sec }) {
    const rows = sec.rows || [];
    const cols = sec.cols || [];
    const links = [sec.link, sec.link2].filter(Boolean);
    const linkFor = k => links.find(l => l.col === k);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white dark:bg-brand-900 dark:border-brand-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-brand-800 flex items-center gap-2">
                <Layers size={15} className="text-gold-500" />
                <h3 className="font-black text-sm text-brand-900 dark:text-brand-50">{sec.title}</h3>
                <span className="text-[11px] text-slate-400 mr-auto">{rows.length} صف</span>
            </div>
            {!rows.length ? (
                <p className="text-sm text-slate-400 text-center py-8">لا بيانات</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-brand-800">
                            <tr className="text-xs text-slate-500 dark:text-brand-300 text-right">
                                {cols.map(c => <th key={c.k} className="py-2 px-3 font-bold whitespace-nowrap">{c.t}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} className="border-t border-slate-100 dark:border-brand-800 hover:bg-slate-50 dark:hover:bg-brand-800/50">
                                    {cols.map(c => {
                                        const v = r[c.k];
                                        const lk = linkFor(c.k);
                                        if (sec.url_col === c.k) {
                                            return <td key={c.k} className="py-2 px-3">
                                                {v ? <a href={v} target="_blank" rel="noopener noreferrer"
                                                    className="text-brand-700 inline-flex items-center gap-1"><ExternalLink size={13} /> فتح</a> : '—'}
                                            </td>;
                                        }
                                        return (
                                            <td key={c.k} className={'py-2 px-3 whitespace-nowrap ' + (isNum(v) ? 'tabular-nums' : '')}>
                                                {lk
                                                    ? <EntityLink type={lk.type} value={r[lk.value_col]} className="text-brand-700 font-bold">{String(v ?? '—')}</EntityLink>
                                                    : (isNum(v) && String(v).includes('.') ? money(v) : String(v ?? '—'))}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
