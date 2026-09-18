import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Loader2, CalendarClock, ShieldCheck, PenTool, AlertTriangle, LogIn, Hourglass } from 'lucide-react';
import { API_URL } from '../../lib/api/client';
import useRtc from './rtc/useRtc';
import CallRoom from './rtc/CallRoom';
import MeetBoard from './MeetBoard';

// ════════════════════════════════════════════════════════════════════════════
//  صفحة الضيف — semak.sa/join/<رمز الدعوة>
//  عميلٌ أو موردٌ يدخل اجتماعنا من المتصفح بلا حساب ولا تطبيق:
//  يرى بطاقة الاجتماع، يجرّب الكاميرا والمايك، يطلب الدخول، وينتظر القبول.
// ════════════════════════════════════════════════════════════════════════════

const fmtTime = t => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return ((h % 12) || 12) + ':' + String(m || 0).padStart(2, '0') + (h < 12 ? ' صباحاً' : ' مساءً');
};
const fmtDate = d => {
    try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return d; }
};
// متصفّحات داخل التطبيقات (إنستغرام، فيسبوك، سناب...) تمنع الكاميرا غالباً
const inApp = () => /FBAN|FBAV|Instagram|Snapchat|Line\/|TikTok|musical_ly/i.test(navigator.userAgent || '');

function Shell({ children }) {
    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {children}
        </div>
    );
}

function Brand() {
    return (
        <div className="flex items-center gap-3 px-5 pt-6">
            <img src="/images/app-icon-512.png" alt="سماك" className="w-11 h-11 rounded-xl" onError={e => { e.currentTarget.style.display = 'none'; }} />
            <div>
                <div className="font-black leading-tight">سماك العقارية</div>
                <div className="text-[11px] text-[#c5a059] font-bold">غرفة الاجتماعات</div>
            </div>
        </div>
    );
}

export default function GuestJoin() {
    const { token } = useParams();
    const [info, setInfo] = useState(null);       // null = تحميل
    const [name, setName] = useState('');
    const [tab, setTab] = useState('call');
    const rtc = useRtc({ guestToken: token });

    // لا تُفهرَس صفحة الدعوة
    useEffect(() => {
        const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow';
        document.head.appendChild(m);
        const old = document.title; document.title = 'دعوة اجتماع | سماك العقارية';
        return () => { m.remove(); document.title = old; };
    }, []);

    useEffect(() => {
        fetch(`${API_URL}?action=rtc_guest_info&gt=${encodeURIComponent(token || '')}`)
            .then(r => r.json())
            .then(r => { setInfo(r); if (r && r.success) setName(r.guest.name || ''); })
            .catch(() => setInfo({ success: false, reason: 'network' }));
    }, [token]);

    // معاينة الكاميرا حين تصلح الدعوة
    useEffect(() => { if (info && info.success && !rtc.local) rtc.openMedia(); }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!info) return <Shell><div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#c5a059]" size={28} /></div></Shell>;

    if (!info.success) {
        const msg = { expired: 'انتهت صلاحية هذه الدعوة.', revoked: 'أُلغيت هذه الدعوة.', network: 'تعذّر الاتصال. تحقق من الإنترنت وأعد المحاولة.' }[info.reason]
            || 'رابط الدعوة غير صحيح.';
        return (
            <Shell><Brand />
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <AlertTriangle size={36} className="text-[#c5a059] mb-3" />
                    <div className="font-black text-lg">{msg}</div>
                    <p className="text-slate-400 text-[13px] mt-2 leading-6">تواصل مع من دعاك لإرسال رابط جديد، أو اتصل على 920032842.</p>
                </div>
            </Shell>
        );
    }

    const m = info.meeting || {};
    const canDraw = !!(info.guest && info.guest.can_draw);

    // ─── داخل الاجتماع ──────────────────────────────────────────────────────
    if (rtc.status === 'in') return (
        <Shell>
            <div className="px-3 pt-2 pb-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#c5a059] font-bold">سماك العقارية</div>
                    <div className="font-black truncate text-[14px]">{m.title || 'اجتماع'}</div>
                </div>
                <div className="flex bg-white/10 rounded-xl p-1">
                    {[['call', 'المكالمة', Video], ['board', 'السبورة', PenTool]].map(([k, t, I]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={'h-9 px-3 rounded-lg text-[12px] font-bold flex items-center gap-1.5 ' + (tab === k ? 'bg-[#c5a059] text-[#0b1220]' : 'text-white/80')}>
                            <I size={14} />{t}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 relative">
                {/* المكالمة تبقى حيّة خلف السبورة */}
                <div className={tab === 'call' ? 'absolute inset-0 px-2 pb-2' : 'hidden'}>
                    <CallRoom rtc={rtc} isGuest title={m.title} height="100%" />
                </div>
                {tab === 'board' ? (
                    <div className="absolute inset-0">
                        <MeetBoard boardId={info.board} userName={rtc.me ? rtc.me.name : name} guestToken={token} readOnly={!canDraw} dense />
                    </div>
                ) : null}
            </div>
        </Shell>
    );

    // ─── في الانتظار ────────────────────────────────────────────────────────
    if (rtc.status === 'waiting' || rtc.status === 'joining') return (
        <Shell><Brand />
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div className="relative w-20 h-20 mb-5">
                    <span className="absolute inset-0 rounded-full border-2 border-[#c5a059]/40 animate-ping" />
                    <span className="absolute inset-0 rounded-full bg-[#1a365d] flex items-center justify-center"><Hourglass size={28} className="text-[#c5a059]" /></span>
                </div>
                <div className="font-black text-lg">بانتظار موافقة المضيف</div>
                <p className="text-slate-400 text-[13px] mt-2 leading-6">أبلغنا الفريق بوصولك. ستدخل الاجتماع تلقائياً فور قبولك، أبقِ هذه الصفحة مفتوحة.</p>
                <button onClick={rtc.leave} className="mt-6 h-11 px-5 rounded-2xl bg-white/10 font-bold text-[13px]">إلغاء</button>
            </div>
        </Shell>
    );

    // ─── انتهى / رُفض / أُخرج ──────────────────────────────────────────────
    if (['denied', 'kicked', 'ended'].includes(rtc.status)) {
        const t = { denied: 'لم يُقبل طلب الدخول.', kicked: 'أُنهيت مشاركتك في الاجتماع.', ended: 'غادرت الاجتماع.' }[rtc.status];
        return (
            <Shell><Brand />
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                    <div className="font-black text-lg">{t}</div>
                    <p className="text-slate-400 text-[13px] mt-2">شكراً لك، سماك العقارية.</p>
                    {rtc.status !== 'kicked' ? (
                        <button onClick={() => { rtc.setError(''); rtc.join({ name }); }}
                            className="mt-6 h-11 px-5 rounded-2xl bg-[#c5a059] text-[#0b1220] font-black text-[13px]">اطلب الدخول مرة أخرى</button>
                    ) : null}
                </div>
            </Shell>
        );
    }

    // ─── قبل الدخول ─────────────────────────────────────────────────────────
    return (
        <Shell><Brand />
            <div className="px-5 pt-5 pb-8 space-y-4 max-w-lg w-full mx-auto">
                <div>
                    <div className="text-slate-400 text-[13px]">أهلاً {info.guest.name}، أنت مدعو إلى</div>
                    <div className="font-black text-xl mt-0.5">{m.title || 'اجتماع سماك'}</div>
                    {m.meet_date ? <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#c5a059] font-bold">
                        <CalendarClock size={14} />{fmtDate(m.meet_date)}{m.meet_time ? '، الساعة ' + fmtTime(m.meet_time) : ''}</div> : null}
                </div>

                {inApp() ? (
                    <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3 text-[12px] leading-6 text-amber-100">
                        افتح الرابط في متصفح الجوال (Safari أو Chrome) حتى تعمل الكاميرا والمايك: من القائمة اختر «فتح في المتصفح».
                    </div>
                ) : null}

                <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#111a2e] border border-white/10">
                    {rtc.local && rtc.cam ? <Preview stream={rtc.local} /> : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-2">
                            {rtc.status === 'media' ? <Loader2 size={22} className="animate-spin" /> : <VideoOff size={26} />}
                            <span className="text-[12px] font-bold">{rtc.status === 'media' ? 'تجهيز الكاميرا…' : rtc.local ? 'الكاميرا مطفأة' : 'اسمح للكاميرا والمايك'}</span>
                        </div>
                    )}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2">
                        <button onClick={rtc.toggleMic} disabled={!rtc.local}
                            className={'w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-40 ' + (rtc.mic ? 'bg-black/50' : 'bg-red-600')}>
                            {rtc.mic ? <Mic size={20} /> : <MicOff size={20} />}</button>
                        <button onClick={rtc.toggleCam} disabled={!rtc.local}
                            className={'w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-40 ' + (rtc.cam ? 'bg-black/50' : 'bg-red-600')}>
                            {rtc.cam ? <Video size={20} /> : <VideoOff size={20} />}</button>
                    </div>
                </div>

                {!rtc.local && rtc.status !== 'media' ? (
                    <button onClick={() => rtc.openMedia()} className="w-full h-11 rounded-2xl bg-white/10 font-bold text-[13px]">السماح بالكاميرا والمايك</button>
                ) : null}

                <div>
                    <label className="text-[11px] text-slate-400 font-bold">اسمك كما يظهر للحضور</label>
                    <input value={name} onChange={e => setName(e.target.value)} maxLength={80}
                        className="w-full h-12 px-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] outline-none focus:border-[#c5a059]" />
                </div>

                {rtc.error ? <div className="rounded-2xl bg-red-500/15 border border-red-500/30 p-3 text-[13px] font-bold text-red-200">{rtc.error}</div> : null}

                <button onClick={() => rtc.join({ name })} disabled={rtc.status === 'media'}
                    className="w-full h-13 min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] font-black text-[16px] flex items-center justify-center gap-2 disabled:opacity-50">
                    <LogIn size={18} />اطلب الدخول
                </button>

                <div className="flex items-start gap-2 text-[12px] text-slate-400 leading-6">
                    <ShieldCheck size={15} className="text-emerald-400 shrink-0 mt-1" />
                    المكالمة مشفّرة وتنتقل بين الأجهزة مباشرة. لا تحتاج حساباً ولا تطبيقاً، ويُقبل دخولك من فريق سماك.
                </div>
            </div>
        </Shell>
    );
}

function Preview({ stream }) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
    return <video ref={ref} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" />;
}
