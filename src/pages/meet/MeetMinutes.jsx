import React, { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronLeft, Send, Star, RefreshCw, Check } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

// محاضر الاجتماعات المقفلة — للقراءة، ولإعادة إرسال المحضر بالبريد عند الحاجة
const DOM = { projects: 'المشاريع', gov: 'الحكومية', purchases: 'المشتريات', cash: 'السيولة', sales: 'المبيعات', other: 'عام' };
const ST  = { open: 'للتنفيذ', doing: 'قيد التنفيذ', done: 'منجزة', cancelled: 'ملغاة' };

export default function MeetMinutes() {
    const [rows, setRows] = useState([]);
    const [sel, setSel]   = useState(null);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState('');

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=mtg_minutes`,
                { headers: { Authorization: 'Bearer ' + getAdminToken() } }).then(x => x.json());
            if (r.success) setRows(r.data || r.meetings || []);
        } catch (e) {}
        setBusy(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const resend = async m => {
        if (!window.confirm('إعادة إرسال محضر «' + m.title + '» إلى الحضور؟')) return;
        const r = await fetch(`${API_URL}?action=mtg_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getAdminToken() },
            body: JSON.stringify({ id: m.id, what: 'minutes' }),
        }).then(x => x.json());
        setSent(r && r.sent ? 'أُرسل إلى ' + r.sent : 'تعذّر الإرسال' + (r && r.errors && r.errors[0] ? ' — ' + r.errors[0] : ''));
        setTimeout(() => setSent(''), 4000);
    };

    if (sel) {
        const m = sel;
        return (
            <div dir="rtl" className="p-3 space-y-3">
                <button onClick={() => setSel(null)} className="flex items-center gap-1 text-[12px] font-bold text-gold-500">
                    <ChevronLeft size={15} className="rotate-180" />كل المحاضر
                </button>
                <div className="rounded-3xl bg-gradient-to-l from-[#1a365d] to-[#2d5299] border border-white/10 p-4">
                    <div className="font-black">{m.title}</div>
                    <div className="text-[12px] text-white/70 font-bold mt-0.5">{m.meet_date}{m.rating ? ' · التقييم ' + m.rating + '/10' : ''}</div>
                    {m.attendees ? <div className="text-[11px] text-white/60 mt-1.5">الحضور: {m.attendees}</div> : null}
                </div>
                {m.summary ? (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                        <div className="text-[11px] font-black text-slate-400 mb-1">الخلاصة</div>
                        <p className="text-sm leading-7 whitespace-pre-wrap">{m.summary}</p>
                    </div>
                ) : null}
                {m.cascading ? (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                        <div className="text-[11px] font-black text-slate-400 mb-1">ما يُبلَّغ للفريق</div>
                        <p className="text-sm leading-7 whitespace-pre-wrap">{m.cascading}</p>
                    </div>
                ) : null}
                <div className="space-y-2">
                    {(m.items || []).map((it, i) => (
                        <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className={'text-[10px] font-black px-1.5 py-0.5 rounded-md ' +
                                    (it.kind === 'todo' ? 'bg-violet-500/20 text-violet-300' : 'bg-rose-500/20 text-rose-300')}>
                                    {it.kind === 'todo' ? 'مهمة' : 'قضية'}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">{DOM[it.section] || 'عام'}</span>
                                <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-md ' +
                                    (it.status === 'done' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400')}>
                                    {ST[it.status] || it.status}
                                </span>
                            </div>
                            <div className="text-sm font-bold leading-6">{it.title}</div>
                            {it.decision ? <div className="text-[12px] text-slate-400 leading-6 mt-1">{it.decision}</div> : null}
                            {(it.owner || it.due_date) ? (
                                <div className="text-[11px] text-slate-500 mt-1">{it.owner || '—'}{it.due_date ? ' · ' + it.due_date : ''}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
                <button onClick={() => resend(m)}
                    className="w-full h-11 rounded-2xl bg-white/10 font-bold text-[13px] flex items-center justify-center gap-2">
                    <Send size={15} />إعادة إرسال المحضر بالبريد
                </button>
                {sent ? <p className="text-center text-[12px] font-bold text-emerald-400">{sent}</p> : null}
            </div>
        );
    }

    return (
        <div dir="rtl" className="p-3 space-y-2">
            <div className="flex items-center gap-2 px-1">
                <FileText size={16} className="text-gold-500" />
                <span className="font-black text-sm">المحاضر</span>
                <button onClick={load} className="ms-auto w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>
            {rows.map(m => (
                <button key={m.id} onClick={() => setSel(m)}
                    className="w-full text-right rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{m.title}</div>
                        <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                            {m.meet_date} · {(m.items || []).length} بند
                            {m.closed_at ? <span className="text-emerald-400"> · مُقفل</span> : null}
                        </div>
                    </div>
                    {m.rating ? (
                        <span className="text-[11px] font-black px-2 py-1 rounded-lg bg-gold-500/15 text-gold-500 flex items-center gap-1">
                            <Star size={11} />{m.rating}
                        </span>
                    ) : null}
                    <ChevronLeft size={16} className="text-slate-500" />
                </button>
            ))}
            {!rows.length && !busy ? <p className="text-center text-[12px] text-slate-500 py-10">لا محاضر مقفلة بعد</p> : null}
        </div>
    );
}
