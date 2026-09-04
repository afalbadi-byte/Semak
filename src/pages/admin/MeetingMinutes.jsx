import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Printer, Calendar, Users, CheckCircle2, Clock, Star } from 'lucide-react';
import { API_URL } from '../../lib/api/client';

// ─── محاضر الاجتماعات — عرض للموظفين، القراءة فقط، للاجتماعات المقفلة ─────────
const SECTIONS = {
    projects:  'المشاريع',
    gov:       'المتعلقات الحكومية',
    purchases: 'المشتريات',
    cash:      'السيولة',
    sales:     'المبيعات',
    scorecard: 'الأرقام',
    rocks:     'أولويات التسعين يوماً',
    headlines: 'مستجدات',
    segue:     'الافتتاح',
    conclude:  'الختام',
};
const sectionName = s => SECTIONS[s] || s || 'عام';

export default function MeetingMinutes() {
    const [list, setList]       = useState([]);
    const [openId, setOpenId]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch(`${API_URL}?action=mtg_minutes`).then(x => x.json());
            if (!r.success) throw new Error(r.message || 'تعذر جلب المحاضر');
            setList(r.data || []);
            setOpenId(id => id ?? (r.data && r.data.length ? r.data[0].id : null));
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const current = list.find(m => String(m.id) === String(openId)) || null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 no-print">
                <div>
                    <h2 className="text-2xl font-black text-brand-900 flex items-center gap-2">
                        <FileText size={24} className="text-gold-500" /> محاضر الاجتماعات
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        ما تم الاتفاق عليه في الاجتماعات المنتهية، ومن يتولى كل مهمة ومتى موعدها
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="px-3 py-2 rounded-xl bg-brand-900 text-white text-sm font-bold">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold">
                        <Printer size={15} />
                    </button>
                </div>
            </div>

            {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3">{error}</div>}

            {!loading && !list.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                    <FileText size={40} className="mx-auto text-slate-300" />
                    <p className="text-slate-500 text-sm mt-3">لا محاضر منشورة بعد — يظهر المحضر هنا بعد إقفال الاجتماع</p>
                </div>
            )}

            {list.length > 1 && (
                <div className="flex gap-2 flex-wrap no-print">
                    {list.map(m => (
                        <button key={m.id} onClick={() => setOpenId(m.id)}
                            className={'px-3 py-2 rounded-xl text-xs font-bold ' +
                                (String(m.id) === String(openId) ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-600')}>
                            {m.meet_date}
                        </button>
                    ))}
                </div>
            )}

            {current && <Minutes m={current} />}
        </div>
    );
}

function Minutes({ m }) {
    const items   = m.items || [];
    const todos   = items.filter(i => i.kind === 'todo');
    const issues  = items.filter(i => i.kind !== 'todo');
    const domains = [...new Set(issues.map(i => i.section))];

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black text-brand-900">{m.title}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><Calendar size={13} /> {m.meet_date}</span>
                    {m.attendees && <span className="flex items-center gap-1"><Users size={13} /> {m.attendees}</span>}
                    {m.rating && <span className="flex items-center gap-1 text-gold-600 font-bold"><Star size={13} /> التقييم {Number(m.rating)} من عشرة</span>}
                </div>
            </div>

            {m.cascading && (
                <div className="rounded-xl bg-gold-50 border border-gold-200 p-4">
                    <div className="font-black text-sm text-brand-900 mb-1">ما يخص الفريق</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.cascading}</div>
                </div>
            )}

            {m.summary && (
                <div>
                    <div className="font-black text-sm text-brand-900 mb-1">خلاصة الاجتماع</div>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap">{m.summary}</div>
                </div>
            )}

            {domains.map(d => (
                <div key={d || 'x'}>
                    <div className="font-black text-sm text-brand-900 mb-2">{sectionName(d)}</div>
                    <div className="space-y-2">
                        {issues.filter(i => i.section === d).map((i, k) => (
                            <div key={k} className="rounded-xl bg-slate-50 p-3">
                                <div className="flex items-start gap-2">
                                    {i.status === 'done'
                                        ? <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                                        : <Clock size={15} className="text-amber-500 mt-0.5 shrink-0" />}
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-700">{i.title}</div>
                                        {i.decision && <div className="text-xs text-slate-600 mt-1">القرار: {i.decision}</div>}
                                        <div className="text-[11px] text-slate-400 mt-1">
                                            {i.owner ? 'المسؤول ' + i.owner : 'بلا مسؤول'}
                                            {i.due_date ? ' · الموعد ' + i.due_date : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {!!todos.length && (
                <div>
                    <div className="font-black text-sm text-brand-900 mb-2">المهام الخارجة من الاجتماع</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-400 text-right">
                                    <th className="py-2">المهمة</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todos.map((t, k) => (
                                    <tr key={k} className="border-t border-slate-100">
                                        <td className="py-2 text-slate-700">{t.title}</td>
                                        <td className="text-slate-500">{t.owner || '—'}</td>
                                        <td className="text-slate-500">{t.due_date || '—'}</td>
                                        <td className={t.status === 'done' ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                                            {t.status === 'done' ? 'منجزة' : 'قائمة'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!issues.length && !todos.length && (
                <p className="text-sm text-slate-400 text-center py-4">لم تسجل بنود في هذا الاجتماع</p>
            )}
        </div>
    );
}
