import React, { useState, useEffect } from 'react';
import {
    Wrench, RefreshCw, MessageCircle, Search, X, Send,
    CheckCircle2, Clock, Hammer, User, Phone, Hash,
    CalendarDays, ChevronDown, AlertCircle, ExternalLink
} from 'lucide-react';
import { notifyClientStatusUpdate } from '../../services/whatsappService';

const API_URL = "https://semak.sa/api.php";
const TIME_SLOTS = [
    "08:00 ص - 10:00 ص",
    "10:00 ص - 12:00 م",
    "01:00 م - 03:00 م",
    "04:00 م - 06:00 م",
];

// ─── ألوان الحالات ──────────────────────────────────────────────
const STATUS_META = {
    'قيد الانتظار':          { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400',   col: 'pending'   },
    'تم التعيين':            { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    col: 'active'    },
    'تم اعتماد الموعد':      { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  col: 'active'    },
    'تم اقتراح موعد بديل':  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   col: 'active'    },
    'جاري العمل':            { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',  col: 'active'    },
    'مكتمل':                 { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', col: 'completed' },
};

const COLUMNS = [
    { id: 'pending',   title: 'جديدة / انتظار',   icon: Clock,        color: 'border-slate-300',  bg: 'bg-slate-50',   text: 'text-slate-600'  },
    { id: 'active',    title: 'جاري التنفيذ',      icon: Hammer,       color: 'border-blue-300',   bg: 'bg-blue-50/60', text: 'text-blue-700'   },
    { id: 'completed', title: 'مكتملة',            icon: CheckCircle2, color: 'border-emerald-300',bg: 'bg-emerald-50/60', text: 'text-emerald-700' },
];

// ─── بناء رسالة واتساب ─────────────────────────────────────────
function buildWaMessage(ticket) {
    const tech = ticket.technician && ticket.technician !== 'لم يتم التعيين'
        ? `👨‍🔧 الفني المختص: *${ticket.technician}*`
        : 'سيتم إعلامكم باسم الفني لاحقاً.';
    const dateText = ticket.scheduleDate
        ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime || 'غير محدد'}*`
        : 'لم يتم تحديد موعد الزيارة بعد.';
    const otpText = ticket.otp
        ? `\n\n🔑 *رمز إغلاق الطلب:* ${ticket.otp}\n_(أعطه للفني عند الانتهاء لتأكيد إغلاق الطلب)_`
        : '';
    return (
        `مرحباً عميلنا العزيز 👋\n` +
        `من شركة *سماك العقارية* 🏢\n\n` +
        `بخصوص طلب الصيانة رقم: *#${ticket.id}*\n` +
        `وحدة: *${ticket.unit}*\n` +
        `نوع العطل: *${ticket.type}*\n\n` +
        `📌 الحالة الحالية: *${ticket.status}*\n\n` +
        `${tech}\n\n` +
        `*موعد الزيارة:*\n${dateText}` +
        `${otpText}\n\n` +
        `نسعد بخدمتكم! 🌟`
    );
}

// ─── مودال معاينة وإرسال واتساب ────────────────────────────────
function WaModal({ ticket, onClose, onSent }) {
    const [message, setMessage] = useState(buildWaMessage(ticket));
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const phone = String(ticket.phone || '').replace(/\D/g, '').replace(/^0/, '966');

    const openWaMe = () => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        setSent(true);
        setTimeout(() => { onSent?.(); onClose(); }, 800);
    };

    const sendViaMottasl = async () => {
        setSending(true);
        try {
            await notifyClientStatusUpdate({ ...ticket, _customMessage: message });
            setSent(true);
            setTimeout(() => { onSent?.(); onClose(); }, 800);
        } catch {
            // fallback
            openWaMe();
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
                            <MessageCircle size={20} className="text-green-600" />
                        </div>
                        <div>
                            <p className="font-black text-[#1a365d] text-base">معاينة رسالة واتساب</p>
                            <p className="text-xs text-slate-400 font-bold">{ticket.name} — {ticket.unit}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
                </div>

                {/* رقم الجوال */}
                <div className="px-5 pt-4 pb-2">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                        <Phone size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">إرسال إلى:</span>
                        <span className="text-sm font-black text-[#1a365d]" dir="ltr">{ticket.phone}</span>
                    </div>
                </div>

                {/* معاينة الرسالة */}
                <div className="px-5 pb-2 flex-1 overflow-y-auto">
                    <label className="text-xs font-black text-slate-400 block mb-2">نص الرسالة (قابل للتعديل)</label>
                    <div className="bg-[#e9fbe5] rounded-2xl rounded-tl-sm p-4 relative">
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={12}
                            className="w-full bg-transparent text-sm text-slate-700 font-medium leading-relaxed outline-none resize-none"
                            dir="rtl"
                        />
                        <span className="text-[10px] text-slate-400 absolute bottom-2 left-3">{message.length} حرف</span>
                    </div>
                </div>

                {/* أزرار الإرسال */}
                <div className="p-5 border-t border-slate-100 space-y-2">
                    {sent ? (
                        <div className="text-center py-3 text-emerald-600 font-black flex items-center justify-center gap-2">
                            <CheckCircle2 size={20} /> تم الإرسال ✅
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={openWaMe}
                                className="w-full bg-[#25D366] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#20bb5a] transition shadow-md">
                                <ExternalLink size={16} />
                                فتح واتساب وإرسال يدوياً
                            </button>
                            <button
                                onClick={sendViaMottasl}
                                disabled={sending}
                                className="w-full bg-[#1a365d] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#1a365d]/90 transition disabled:opacity-50">
                                {sending
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <Send size={16} />}
                                إرسال مباشر عبر النظام
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── بطاقة التذكرة ─────────────────────────────────────────────
function TicketCard({ ticket, techList, onUpdate, onWa, adminView }) {
    const [expanded, setExpanded] = useState(false);
    const sm = STATUS_META[ticket.status] || STATUS_META['قيد الانتظار'];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow overflow-hidden">

            {/* شريط الحالة العلوي */}
            <div className={`h-1.5 w-full ${sm.dot}`} />

            <div className="p-4">
                {/* رأس البطاقة */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg text-[10px] font-black">#{ticket.id}</span>
                        <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-0.5 rounded-lg text-[10px] font-bold">{ticket.unit}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${sm.bg} ${sm.text}`}>
                        {ticket.status}
                    </span>
                </div>

                {/* معلومات العميل */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-black shrink-0">
                        {ticket.name?.charAt(0) || '؟'}
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-700">{ticket.name || 'غير مسجل'}</p>
                        {ticket.phone && (
                            <a href={`tel:${ticket.phone}`} className="text-[10px] text-blue-500 font-bold" dir="ltr">{ticket.phone}</a>
                        )}
                    </div>
                    <div className="mr-auto">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold">{ticket.type}</span>
                    </div>
                </div>

                {/* الوصف */}
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2.5 leading-relaxed line-clamp-2 border border-slate-100 font-medium mb-3">
                    {ticket.desc}
                </p>

                {/* الموعد */}
                {ticket.scheduleDate && (
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-bold mb-3 bg-indigo-50 px-2.5 py-1.5 rounded-xl">
                        <CalendarDays size={11} />
                        {ticket.scheduleDate} — {ticket.scheduleTime}
                    </div>
                )}

                {/* رمز OTP */}
                {adminView && ticket.otp && ['تم اعتماد الموعد','جاري العمل'].includes(ticket.status) && (
                    <div className="text-[10px] text-center bg-amber-50 text-amber-700 font-black rounded-lg py-1.5 px-2 border border-amber-200 mb-3">
                        🔑 رمز الإغلاق: {ticket.otp}
                    </div>
                )}

                {/* زر تفاصيل الإدارة */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] text-slate-400 hover:text-[#1a365d] font-bold transition py-1">
                    <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    {expanded ? 'إخفاء التحكم' : 'إظهار التحكم'}
                </button>

                {/* قسم التحكم */}
                {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold block mb-1">التاريخ</label>
                                <input
                                    type="date"
                                    value={ticket.scheduleDate || ''}
                                    onChange={e => onUpdate(ticket.id, 'scheduleDate', e.target.value)}
                                    className="w-full text-[11px] font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-[#1a365d] transition"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold block mb-1">الوقت</label>
                                <select
                                    value={ticket.scheduleTime || 'غير محدد'}
                                    onChange={e => onUpdate(ticket.id, 'scheduleTime', e.target.value)}
                                    className="w-full text-[11px] font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-[#1a365d] transition">
                                    <option value="غير محدد" disabled>اختر</option>
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <select
                            value={ticket.technician || 'لم يتم التعيين'}
                            onChange={e => onUpdate(ticket.id, 'technician', e.target.value)}
                            className="w-full text-[11px] font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-[#1a365d] transition">
                            <option value="لم يتم التعيين" disabled>— إسناد لفني —</option>
                            {techList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <div className="flex gap-2">
                            <select
                                value={ticket.status}
                                onChange={e => onUpdate(ticket.id, 'status', e.target.value)}
                                className="flex-1 text-[11px] font-bold p-2 rounded-xl border border-slate-200 outline-none focus:border-[#1a365d] transition">
                                {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <button
                                onClick={() => onWa(ticket)}
                                title="معاينة وإرسال رسالة واتساب للعميل"
                                className="bg-[#25D366] text-white px-3 py-2 rounded-xl hover:bg-[#20bb5a] transition shadow-sm flex items-center gap-1.5 text-[11px] font-black whitespace-nowrap">
                                <MessageCircle size={14} />
                                واتساب
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── الصفحة الرئيسية ───────────────────────────────────────────
export default function MaintenanceManage({ showToast, activeUser }) {
    const [tickets, setTickets]       = useState([]);
    const [techList, setTechList]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [waTicket, setWaTicket]     = useState(null);

    const loadMaintenance = async () => {
        setLoading(true);
        try {
            const res  = await fetch(`${API_URL}?action=get_maintenance`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setTickets(data.map(row => {
                    let desc = row.descrip || '---';
                    let scheduleDate = row.date ? row.date.split(' ')[0] : '';
                    let scheduleTime = 'غير محدد';
                    if (desc.includes('التاريخ المفضل:')) {
                        const dm = desc.match(/التاريخ المفضل: (.*)/);
                        const tm = desc.match(/الوقت المفضل: (.*)/);
                        if (dm) scheduleDate = dm[1];
                        if (tm) scheduleTime = tm[1];
                        desc = desc.split('\n\nالوصف:\n')[1] || desc;
                    }
                    return {
                        id: row.id, date: row.date, scheduleDate, scheduleTime,
                        name: row.name, phone: row.phone, unit: row.unit,
                        type: row.type, desc,
                        status: row.status || 'قيد الانتظار',
                        technician: row.technician || 'لم يتم التعيين',
                        otp: row.otp,
                    };
                }));
            }

            fetch(`${API_URL}?action=get_users`)
                .then(r => r.json())
                .then(d => {
                    const arr = d?.data || d;
                    if (Array.isArray(arr))
                        setTechList(arr.filter(u => u.role === 'technician').map(t => t.name));
                }).catch(() => {});

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadMaintenance(); }, []);

    const updateTicketStatus = async (id, field, value) => {
        let newOtp = null;
        setTickets(prev => prev.map(t => {
            if (t.id !== id) return t;
            const updated = { ...t, [field]: value };
            if (field === 'status' && value === 'تم اعتماد الموعد' && !t.otp) {
                newOtp = Math.floor(1000 + Math.random() * 9000).toString();
                updated.otp = newOtp;
            }
            return updated;
        }));

        const current = tickets.find(t => t.id === id);
        let apiField = field, apiValue = value;
        if (field === 'scheduleDate' || field === 'scheduleTime') {
            apiField = 'descrip';
            const d = field === 'scheduleDate' ? value : current.scheduleDate;
            const tm = field === 'scheduleTime' ? value : current.scheduleTime;
            apiValue = `الوقت المفضل: ${tm}\nالتاريخ المفضل: ${d}\n\nالوصف:\n${current.desc}`;
        }

        try {
            const payload = { ticket_id: id, field_name: apiField, new_value: apiValue };
            if (newOtp) payload.otp = newOtp;
            const res  = await fetch(`${API_URL}?action=update_maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success && field === 'status') {
                showToast?.('تم التحديث', `الحالة: ${value}`);
                // عرض مودال واتساب تلقائياً عند تغيير الحالة
                const updated = tickets.find(t => t.id === id);
                if (updated) {
                    setWaTicket({ ...updated, status: value, otp: newOtp || updated.otp });
                }
            }
        } catch {
            showToast?.('خطأ', 'فشل الاتصال', 'error');
        }
    };

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
        ? tickets.filter(t =>
            t.name?.toLowerCase().includes(q) ||
            t.unit?.toLowerCase().includes(q) ||
            t.phone?.includes(q) ||
            t.type?.includes(searchQuery))
        : tickets;

    const stats = {
        total:     tickets.length,
        pending:   tickets.filter(t => STATUS_META[t.status]?.col === 'pending').length,
        active:    tickets.filter(t => STATUS_META[t.status]?.col === 'active').length,
        completed: tickets.filter(t => STATUS_META[t.status]?.col === 'completed').length,
    };

    return (
        <div className="animate-fadeIn" dir="rtl">

            {/* ── إحصائيات ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'إجمالي الطلبات', value: stats.total,     color: 'text-[#1a365d]',   bg: 'bg-white',         border: 'border-slate-200' },
                    { label: 'جديدة / انتظار',  value: stats.pending,   color: 'text-slate-600',   bg: 'bg-slate-50',      border: 'border-slate-200' },
                    { label: 'جاري التنفيذ',    value: stats.active,    color: 'text-blue-600',    bg: 'bg-blue-50',       border: 'border-blue-200'  },
                    { label: 'مكتملة',          value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50',    border: 'border-emerald-200'},
                ].map(s => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
                        <p className="text-xs text-slate-400 font-bold">{s.label}</p>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ── شريط البحث ────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الوحدة أو الجوال..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pr-9 pl-4 text-sm font-bold outline-none focus:border-[#1a365d] transition"
                    />
                </div>
                <button
                    onClick={loadMaintenance}
                    className="bg-white border border-slate-200 text-slate-500 px-4 py-2.5 rounded-2xl font-bold hover:bg-slate-50 hover:text-[#1a365d] transition flex items-center gap-2 text-sm">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث
                </button>
            </div>

            {/* ── الكانبان ──────────────────────────────────── */}
            {loading ? (
                <div className="text-center py-24 text-slate-400">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-[#1a365d]" size={36} />
                    <p className="font-bold">جاري تحميل الطلبات...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {COLUMNS.map(col => {
                        const Icon = col.icon;
                        const colTickets = filtered.filter(t => STATUS_META[t.status]?.col === col.id);
                        return (
                            <div key={col.id} className={`${col.bg} border-2 ${col.color} rounded-3xl p-4 flex flex-col min-h-[500px]`}>
                                <div className={`flex items-center gap-2 mb-4 ${col.text}`}>
                                    <Icon size={18} />
                                    <h4 className="font-black text-sm">{col.title}</h4>
                                    <span className="mr-auto bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black text-slate-600 shadow-sm">
                                        {colTickets.length}
                                    </span>
                                </div>

                                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                                    {colTickets.length === 0 ? (
                                        <div className="text-center py-16 text-slate-300 font-bold text-xs border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                                            لا توجد طلبات
                                        </div>
                                    ) : (
                                        colTickets.map(ticket => (
                                            <TicketCard
                                                key={ticket.id}
                                                ticket={ticket}
                                                techList={techList}
                                                onUpdate={updateTicketStatus}
                                                onWa={setWaTicket}
                                                adminView={activeUser?.role === 'admin'}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── مودال واتساب ─────────────────────────────── */}
            {waTicket && (
                <WaModal
                    ticket={waTicket}
                    onClose={() => setWaTicket(null)}
                    onSent={() => setWaTicket(null)}
                />
            )}
        </div>
    );
}
