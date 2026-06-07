import React, { useEffect, useState, useCallback } from 'react';
import { Ticket, Plus, Search, ChevronDown, Loader2, X, Send, MessageCircle, Clock, AlertTriangle, User2 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

const STATUS_OPTS = [
    { value: 'open',        label: 'مفتوحة',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
    { value: 'in_progress', label: 'جارية',    cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
    { value: 'resolved',    label: 'محلولة',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { value: 'closed',      label: 'مغلقة',    cls: 'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400' },
];
const PRIORITY_OPTS = [
    { value: 'critical', label: 'حرجة',     cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
    { value: 'high',     label: 'عالية',    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
    { value: 'medium',   label: 'متوسطة',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    { value: 'low',      label: 'منخفضة',   cls: 'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-400' },
];
const statusCls   = (s) => STATUS_OPTS.find(x => x.value === s)?.cls || '';
const statusLabel = (s) => STATUS_OPTS.find(x => x.value === s)?.label || s;
const priorCls    = (p) => PRIORITY_OPTS.find(x => x.value === p)?.cls || '';
const priorLabel  = (p) => PRIORITY_OPTS.find(x => x.value === p)?.label || p;

const inp = 'w-full bg-brand-50/60 dark:bg-brand-800 border border-brand-100/70 dark:border-brand-700 rounded-xl px-3.5 py-2.5 text-sm text-brand-800 dark:text-brand-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';

const EMPTY_FORM = { client_id: '', subject: '', body: '', priority: 'medium', status: 'open' };

export default function SwTickets({ showToast }) {
    const [rows,     setRows]     = useState([]);
    const [clients,  setClients]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [q,        setQ]        = useState('');
    const [statusF,  setStatusF]  = useState('');
    const [selected, setSelected] = useState(null);
    const [replies,  setReplies]  = useState([]);
    const [replBody, setReplBody] = useState('');
    const [sending,  setSending]  = useState(false);
    const [showNew,  setShowNew]  = useState(false);
    const [form,     setForm]     = useState(EMPTY_FORM);
    const [saving,   setSaving]   = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([apiGet('sw_tickets_list'), apiGet('sw_clients_list')])
            .then(([td, cd]) => {
                if (td.success) setRows(td.tickets || []);
                if (cd.success) setClients(cd.clients || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openTicket = (t) => {
        setSelected(t);
        apiGet(`sw_ticket_replies&ticket_id=${t.id}`).then(d => { if (d.success) setReplies(d.replies || []); });
    };

    const sendReply = async () => {
        if (!replBody.trim()) return;
        setSending(true);
        const d = await apiPost('sw_ticket_reply', { ticket_id: selected.id, body: replBody });
        if (d.success) {
            setReplies(r => [...r, d.reply]);
            setReplBody('');
        }
        setSending(false);
    };

    const updateStatus = async (id, status) => {
        await apiPost('sw_ticket_update', { id, status });
        setRows(r => r.map(t => t.id === id ? { ...t, status } : t));
        if (selected?.id === id) setSelected(s => ({ ...s, status }));
    };

    const handleCreate = async () => {
        if (!form.subject.trim()) { showToast('خطأ', 'العنوان مطلوب'); return; }
        setSaving(true);
        const d = await apiPost('sw_ticket_save', form);
        if (d.success) { showToast('تم إنشاء التذكرة'); setShowNew(false); setForm(EMPTY_FORM); load(); }
        else showToast('خطأ', d.message);
        setSaving(false);
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = rows.filter(r => {
        const qm = !q || [r.subject, r.client_name].some(v => v?.toLowerCase().includes(q.toLowerCase()));
        const sm = !statusF || r.status === statusF;
        return qm && sm;
    });

    return (
        <div className="animate-fadeIn p-6 md:p-8 max-w-7xl mx-auto">

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-brand-800 dark:text-brand-50 flex items-center gap-2"><Ticket size={22} className="text-violet-500" /> تذاكر الدعم</h2>
                    <p className="text-sm text-slate-500 dark:text-brand-400 mt-1">{rows.filter(r => r.status === 'open' || r.status === 'in_progress').length} تذكرة نشطة</p>
                </div>
                <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm shadow-md shadow-violet-500/20">
                    <Plus size={16} /> تذكرة جديدة
                </button>
            </div>

            {/* فلاتر */}
            <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث في التذاكر..." className={`${inp} pr-9`} />
                </div>
                <select value={statusF} onChange={e => setStatusF(e.target.value)} className={`${inp} w-auto`}>
                    <option value="">جميع الحالات</option>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* قائمة التذاكر */}
                <div className="lg:col-span-2 bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Ticket size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="font-bold">لا توجد تذاكر</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-brand-100/70 dark:divide-brand-700 overflow-y-auto max-h-[60vh]">
                            {filtered.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => openTicket(t)}
                                    className={`w-full text-right px-4 py-3.5 hover:bg-brand-50/50 dark:hover:bg-brand-800/40 transition ${selected?.id === t.id ? 'bg-violet-50/50 dark:bg-violet-500/5 border-r-4 border-violet-500' : ''}`}
                                >
                                    <div className="flex items-start gap-2 mb-1.5">
                                        <p className="flex-1 font-bold text-sm text-brand-800 dark:text-brand-100 truncate">{t.subject}</p>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${priorCls(t.priority)}`}>{priorLabel(t.priority)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-slate-400 dark:text-brand-400 truncate">{t.client_name || 'بدون عميل'}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${statusCls(t.status)}`}>{statusLabel(t.status)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* تفاصيل التذكرة */}
                <div className="lg:col-span-3">
                    {!selected ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-300 dark:text-brand-600 bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700">
                            <MessageCircle size={48} strokeWidth={1.5} className="mb-3" />
                            <p className="font-bold text-sm">اختر تذكرة لعرض التفاصيل</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-brand-900 rounded-2xl border border-brand-100/70 dark:border-brand-700 overflow-hidden shadow-sm flex flex-col">
                            {/* رأس التذكرة */}
                            <div className="px-5 py-4 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <p className="font-black text-brand-800 dark:text-brand-50">{selected.subject}</p>
                                        <p className="text-[12px] text-slate-400 dark:text-brand-400 mt-0.5">#{selected.id} · {selected.client_name || 'بدون عميل'} · {selected.created_at?.slice(0,10)}</p>
                                    </div>
                                    <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-700 text-slate-400 transition shrink-0"><X size={16} /></button>
                                </div>
                                {selected.body && <p className="text-sm text-slate-600 dark:text-brand-300 bg-white dark:bg-brand-900 rounded-xl p-3 border border-brand-100/70 dark:border-brand-700">{selected.body}</p>}
                                <div className="flex items-center gap-2 mt-3">
                                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${priorCls(selected.priority)}`}>{priorLabel(selected.priority)}</span>
                                    <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)}
                                        className="text-[11px] font-black rounded-full px-2.5 py-1 border-0 bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 focus:ring-1 focus:ring-violet-400 cursor-pointer">
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* الردود */}
                            <div className="flex-1 overflow-y-auto max-h-[40vh] p-4 space-y-3">
                                {replies.length === 0 && <p className="text-center text-sm text-slate-400 py-6">لا يوجد ردود بعد</p>}
                                {replies.map(r => (
                                    <div key={r.id} className={`flex gap-2.5 ${r.is_internal ? 'opacity-70' : ''}`}>
                                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center font-black text-sm shrink-0">
                                            <User2 size={14} />
                                        </div>
                                        <div className="flex-1 bg-brand-50/60 dark:bg-brand-800/60 rounded-xl p-3 border border-brand-100/70 dark:border-brand-700">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] font-black text-brand-700 dark:text-brand-200">{r.user_name || 'الفريق'}</span>
                                                <span className="text-[10px] text-slate-400">{r.created_at?.slice(0,16)}</span>
                                            </div>
                                            <p className="text-sm text-brand-700 dark:text-brand-200">{r.body}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* إضافة رد */}
                            <div className="px-4 pb-4 pt-3 border-t border-brand-100/70 dark:border-brand-700">
                                <div className="flex gap-2">
                                    <textarea value={replBody} onChange={e => setReplBody(e.target.value)} rows={2}
                                        placeholder="اكتب ردك هنا..." className={`${inp} resize-none flex-1`} />
                                    <button onClick={sendReply} disabled={sending || !replBody.trim()}
                                        className="p-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition disabled:opacity-40 self-end">
                                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal إنشاء تذكرة */}
            {showNew && (
                <div className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
                    <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl w-full max-w-lg border border-brand-100/70 dark:border-brand-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100/70 dark:border-brand-700">
                            <h3 className="text-lg font-black text-brand-800 dark:text-brand-50">تذكرة دعم جديدة</h3>
                            <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-slate-400 transition"><X size={18} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">العميل</label>
                                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inp}>
                                    <option value="">بدون عميل محدد</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` - ${c.company}` : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">عنوان التذكرة *</label>
                                <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="وصف مختصر للمشكلة" className={inp} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الأولوية</label>
                                    <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inp}>
                                        {PRIORITY_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الحالة</label>
                                    <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">التفاصيل</label>
                                <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={4} placeholder="اشرح المشكلة بالتفصيل..." className={`${inp} resize-none`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 font-bold text-sm transition hover:bg-brand-200">إلغاء</button>
                            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition text-sm flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin" />} إنشاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
