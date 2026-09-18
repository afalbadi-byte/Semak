import React, { useState, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, ShieldCheck, Loader2, UserPlus, Users, ExternalLink } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import useRtc from './rtc/useRtc';
import CallRoom from './rtc/CallRoom';
import GuestInvites from './rtc/GuestInvites';

// ════════════════════════════════════════════════════════════════════════════
//  مكالمة الاجتماع — من صنعنا، داخل التطبيق، بحساب المستخدم نفسه
//  ─────────────────────────────────────────────────────────────────────────
//  الصوت والصورة بين الأجهزة مباشرة (WebRTC) ومشفّرة، وخادمنا يعرّفها فقط.
//  تناسب اجتماعاً حتى ستة أشخاص تقريباً؛ وللأكبر يبقى رابط Jitsi احتياطاً.
//  والضيف (عميل أو مورد) يُدعى برابطٍ خاصّ وينتظر حتى يقبله أحد الفريق.
// ════════════════════════════════════════════════════════════════════════════

const JITSI_HOST = 'meet.jit.si';

// active: هل الشاشة ظاهرة؟ المكالمة تبقى حيّة خلف التبويبات، لكن معاينة الكاميرا
// قبل الدخول لا تعمل إلا والشاشة ظاهرة.
export default function MeetCall({ userName, meetingTitle, meetingId, meeting, dense, active = true }) {
    const [mid, setMid]   = useState(meetingId || 0);
    const [room, setRoom] = useState(null);           // غرفة Jitsi الاحتياطية
    const [invite, setInvite] = useState(false);
    const rtc = useRtc({ meetingId: mid });

    // رقم الاجتماع (إن لم يصل) واسم غرفة الاحتياط من الخادم
    const fetchRoom = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}?action=mtg_room${meetingId ? '&id=' + meetingId : ''}`, {
                headers: { Authorization: 'Bearer ' + getAdminToken() },
            }).then(x => x.json());
            if (r && r.success) { setRoom(r.room); if (!meetingId) setMid(r.meeting_id); }
        } catch (e) { /* الاحتياط ليس شرطاً */ }
    }, [meetingId]);
    useEffect(() => { if (meetingId) setMid(meetingId); fetchRoom(); }, [meetingId, fetchRoom]);

    const inCall = ['joining', 'waiting', 'in'].includes(rtc.status);
    // معاينة الكاميرا قبل الدخول — وتُطفأ إذا غادر الشاشة ولم يدخل المكالمة
    useEffect(() => {
        if (inCall) return;
        if (active && !rtc.local && rtc.status !== 'media') rtc.openMedia();
        if (!active && rtc.local) rtc.stopMedia();
    }, [active, inCall]); // eslint-disable-line react-hooks/exhaustive-deps
    const title = (meeting && meeting.title) || meetingTitle || 'الاجتماع الدوري';
    const invitePanel = invite ? <GuestInvites meetingId={mid} meeting={meeting} onClose={() => setInvite(false)} /> : null;

    // ─── أثناء المكالمة ─────────────────────────────────────────────────────
    if (inCall) return (
        <div className={dense ? 'p-2' : ''}>
            <CallRoom rtc={rtc} title={title} onInvite={() => setInvite(true)}
                height={dense ? 'calc(100vh - 190px)' : '74vh'} />
            {invitePanel}
        </div>
    );

    // ─── قبل الدخول ─────────────────────────────────────────────────────────
    return (
        <div dir="rtl" className="p-4 space-y-4">
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-l from-[#1a365d] to-[#2d5299]">
                <div className="relative aspect-video bg-[#0b1220]">
                    {rtc.local && rtc.cam ? <Preview stream={rtc.local} /> : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-2">
                            {rtc.status === 'media' ? <Loader2 size={22} className="animate-spin" /> : <VideoOff size={26} />}
                            <span className="text-[12px] font-bold">{rtc.status === 'media' ? 'تجهيز الكاميرا…' : rtc.local ? 'الكاميرا مطفأة' : 'بدون كاميرا'}</span>
                        </div>
                    )}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2">
                        <button onClick={rtc.toggleMic} disabled={!rtc.local}
                            className={'w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-40 ' + (rtc.mic ? 'bg-black/50 text-white' : 'bg-red-600 text-white')}>
                            {rtc.mic ? <Mic size={20} /> : <MicOff size={20} />}</button>
                        <button onClick={rtc.toggleCam} disabled={!rtc.local}
                            className={'w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-40 ' + (rtc.cam ? 'bg-black/50 text-white' : 'bg-red-600 text-white')}>
                            {rtc.cam ? <Video size={20} /> : <VideoOff size={20} />}</button>
                    </div>
                </div>
                <div className="p-4">
                    <div className="font-black text-lg text-white">غرفة اجتماع سماك</div>
                    <div className="text-[12px] text-white/70 font-bold">{title}{userName ? ' · تدخل باسم ' + userName : ''}</div>
                    <button onClick={() => rtc.join({})} disabled={!mid}
                        className="mt-4 w-full h-12 rounded-2xl bg-[#c5a059] text-[#0b1220] font-black disabled:opacity-40 flex items-center justify-center gap-2">
                        <Video size={18} />ادخل المكالمة
                    </button>
                    <button onClick={() => setInvite(true)} disabled={!mid}
                        className="mt-2 w-full h-11 rounded-2xl bg-white/10 text-white font-bold text-[13px] disabled:opacity-40 flex items-center justify-center gap-2">
                        <UserPlus size={16} />دعوة ضيف (عميل أو مورد)
                    </button>
                </div>
            </div>

            {rtc.error ? <div className="rounded-2xl bg-red-500/15 border border-red-500/30 p-3 text-sm font-bold text-red-200">{rtc.error}</div> : null}
            {rtc.status === 'ended' ? <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 text-[13px] text-slate-300 font-bold">غادرت المكالمة.</div> : null}

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck size={16} /><span className="text-[13px] font-black">مكالمة خاصة بالفريق ومن تدعوه</span>
                </div>
                <p className="text-[12px] leading-6 text-slate-400">
                    الصوت والصورة ينتقلان بين الأجهزة مباشرة ومشفّرين، ولا يمرّان على خادمنا. تدخل بحسابك،
                    والضيف لا يدخل إلا برابط دعوة وبعد أن يقبله أحد الفريق.
                </p>
                <div className="flex items-center gap-2 text-[12px] text-slate-400"><Users size={14} className="text-[#c5a059]" />الأنسب حتى ستة مشاركين.</div>
                {room ? (
                    <a href={'https://' + JITSI_HOST + '/' + room} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-[#c5a059] font-bold">
                        <ExternalLink size={13} />اجتماع أكبر؟ افتحه في Jitsi</a>
                ) : null}
            </div>
            {invitePanel}
        </div>
    );
}

function Preview({ stream }) {
    const ref = React.useRef(null);
    useEffect(() => { if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
    return <video ref={ref} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" />;
}
