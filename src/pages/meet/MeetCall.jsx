import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Video, Mic, MicOff, VideoOff, PhoneOff, MonitorUp, Hand, MessageSquare,
    Users, Link2, Copy, Check, ShieldCheck, Loader2, Maximize2,
} from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  مكالمة الاجتماع — صوت وصورة ومشاركة شاشة
//  ─────────────────────────────────────────────────────────────────────────
//  الاستضافة على Hostinger مشتركة: لا تقبل خوادم إشارة دائمة (WebSocket) ولا
//  خادم ترحيل TURN، وبدونهما لا تصمد مكالمة جماعية خلف شبكات الجوّال. لذلك
//  تُدار الوسائط عبر Jitsi Meet — مفتوح المصدر ومشفّر بين الأطراف — ويبقى
//  اسم الغرفة سرّاً عشوائياً يُصرف من خادمنا لمن يملك حساباً هنا فقط.
//  فإن أردنا لاحقاً استضافة كل شيء على خادمٍ لنا، يُبدَّل هذا الملف وحده.
// ════════════════════════════════════════════════════════════════════════════

const JITSI_HOST   = 'meet.jit.si';
const JITSI_SCRIPT = 'https://meet.jit.si/external_api.js';

let scriptP = null;
const loadApi = () => {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    if (scriptP) return scriptP;
    scriptP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = JITSI_SCRIPT; s.async = true;
        s.onload = res; s.onerror = () => { scriptP = null; rej(new Error('تعذّر تحميل وحدة المكالمة')); };
        document.head.appendChild(s);
    });
    return scriptP;
};

export default function MeetCall({ userName, userEmail, meetingTitle, dense }) {
    const [room, setRoom]   = useState(null);
    const [state, setState] = useState('idle');   // idle | loading | live | error
    const [err, setErr]     = useState('');
    const [mic, setMic]     = useState(true);
    const [cam, setCam]     = useState(true);
    const [hand, setHand]   = useState(false);
    const [n, setN]         = useState(1);
    const [copied, setCopied] = useState(false);
    const host = useRef(null);
    const apiRef = useRef(null);

    // الغرفة تُطلب من خادمنا: من لا يملك جلسة هنا لا يعرف اسمها
    const fetchRoom = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}?action=mtg_room`, {
                headers: { Authorization: 'Bearer ' + getAdminToken() },
            }).then(x => x.json());
            if (r && r.success) setRoom(r.room);
            else setErr((r && r.message) || 'تعذّر تجهيز الغرفة');
        } catch (e) { setErr('تعذّر الوصول إلى الخادم'); }
    }, []);

    useEffect(() => { fetchRoom(); }, [fetchRoom]);

    const join = async () => {
        if (!room) return;
        setState('loading'); setErr('');
        try {
            await loadApi();
            const api = new window.JitsiMeetExternalAPI(JITSI_HOST, {
                roomName: room,
                parentNode: host.current,
                width: '100%', height: '100%',
                userInfo: { displayName: userName || 'عضو سماك', email: userEmail || undefined },
                configOverwrite: {
                    startWithAudioMuted: false,
                    startWithVideoMuted: false,
                    prejoinPageEnabled: false,
                    disableDeepLinking: true,
                    defaultLanguage: 'ar',
                    subject: meetingTitle || 'اجتماع سماك',
                },
                interfaceConfigOverwrite: {
                    MOBILE_APP_PROMO: false,
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_BRAND_WATERMARK: false,
                    DEFAULT_BACKGROUND: '#0b1220',
                    TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'chat', 'raisehand',
                        'tileview', 'participants-pane', 'settings', 'toggle-camera', 'fullscreen', 'hangup'],
                },
            });
            apiRef.current = api;
            api.addListener('videoConferenceJoined', () => setState('live'));
            api.addListener('audioMuteStatusChanged',  e => setMic(!e.muted));
            api.addListener('videoMuteStatusChanged',  e => setCam(!e.muted));
            api.addListener('raiseHandUpdated',        e => { if (e.id === api.getParticipantsInfo()[0]?.participantId) setHand(!!e.handRaised); });
            const count = () => { try { setN(api.getNumberOfParticipants() || 1); } catch (e) {} };
            api.addListener('participantJoined', count);
            api.addListener('participantLeft', count);
            api.addListener('readyToClose', () => leave());
        } catch (e) { setState('error'); setErr(e.message || 'تعذّر بدء المكالمة'); }
    };

    const leave = () => {
        try { apiRef.current && apiRef.current.dispose(); } catch (e) {}
        apiRef.current = null;
        setState('idle'); setHand(false);
    };
    useEffect(() => () => { try { apiRef.current && apiRef.current.dispose(); } catch (e) {} }, []);

    const cmd = (c, v) => { try { apiRef.current && apiRef.current.executeCommand(c, v); } catch (e) {} };
    const copyLink = async () => {
        const url = 'https://' + JITSI_HOST + '/' + room;
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
        catch (e) { window.prompt('انسخ الرابط', url); }
    };

    const ctl = on => 'w-12 h-12 rounded-2xl flex items-center justify-center transition ' +
        (on ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-600 text-white');

    // ─── قبل الانضمام ───────────────────────────────────────────────────────
    if (state !== 'live' && state !== 'loading') return (
        <div dir="rtl" className="p-4 space-y-4">
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-l from-[#1a365d] to-[#2d5299] p-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center"><Video size={22} /></div>
                    <div>
                        <div className="font-black text-lg">غرفة اجتماع سماك</div>
                        <div className="text-[12px] text-white/70 font-bold">{meetingTitle || 'الاجتماع الدوري'}</div>
                    </div>
                </div>
                <button onClick={join} disabled={!room}
                    className="mt-4 w-full h-12 rounded-2xl bg-gold-500 text-slate-900 font-black disabled:opacity-40">
                    {room ? 'ادخل بالصوت والصورة' : <Loader2 size={18} className="animate-spin mx-auto" />}
                </button>
            </div>

            {err ? <div className="rounded-2xl bg-red-500/15 border border-red-500/30 p-3 text-sm font-bold text-red-200">{err}</div> : null}

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck size={16} /><span className="text-[13px] font-black">الغرفة مقصورة على الفريق</span>
                </div>
                <p className="text-[12px] leading-6 text-slate-400">
                    اسم الغرفة سرٌّ عشوائي يصرفه خادم سماك لمن يملك حساباً هنا، ولا يُنشر في أي رابط عام.
                    الوسائط تمرّ عبر Jitsi Meet مفتوح المصدر — استضافتنا المشتركة لا تحتمل خادم وسائط دائماً —
                    وبقيّة الاجتماع (المهام والسبورة والمحضر) كلّها على خادمنا.
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={copyLink} disabled={!room}
                        className="flex-1 h-11 rounded-2xl bg-white/10 font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-40">
                        {copied ? <><Check size={15} className="text-emerald-400" />نُسخ الرابط</> : <><Copy size={15} />انسخ رابط الدعوة</>}
                    </button>
                    {room ? (
                        <a href={'https://' + JITSI_HOST + '/' + room} target="_blank" rel="noreferrer"
                            className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center"><Link2 size={16} /></a>
                    ) : null}
                </div>
            </div>

            <ul className="grid grid-cols-2 gap-2">
                {[['صوت وصورة', Video], ['مشاركة الشاشة', MonitorUp], ['محادثة مكتوبة', MessageSquare], ['رفع اليد', Hand]].map(([t, I]) => (
                    <li key={t} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex items-center gap-2">
                        <I size={15} className="text-gold-500" /><span className="text-[12px] font-bold text-slate-300">{t}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    // ─── أثناء المكالمة ─────────────────────────────────────────────────────
    return (
        <div dir="rtl" className="relative w-full" style={{ height: dense ? 'calc(100vh - 190px)' : '72vh' }}>
            <div ref={host} className="absolute inset-0 rounded-2xl overflow-hidden bg-black" />
            {state === 'loading' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b1220]/90 rounded-2xl">
                    <Loader2 size={26} className="animate-spin text-gold-500" />
                    <span className="text-[12px] font-bold text-slate-400">جارٍ الدخول إلى الغرفة…</span>
                </div>
            ) : null}

            <div className="absolute top-3 inset-x-3 flex items-center gap-2 pointer-events-none">
                <span className="px-2.5 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur text-[11px] font-black text-slate-200 flex items-center gap-1.5">
                    <Users size={12} />{n}
                </span>
                <span className="px-2.5 py-1.5 rounded-xl bg-red-600/90 text-[11px] font-black flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />مباشر
                </span>
            </div>

            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2">
                <button onClick={() => cmd('toggleAudio')} className={ctl(mic)} title={mic ? 'كتم' : 'إلغاء الكتم'}>
                    {mic ? <Mic size={19} /> : <MicOff size={19} />}
                </button>
                <button onClick={() => cmd('toggleVideo')} className={ctl(cam)} title={cam ? 'إطفاء الكاميرا' : 'تشغيل الكاميرا'}>
                    {cam ? <Video size={19} /> : <VideoOff size={19} />}
                </button>
                <button onClick={() => cmd('toggleShareScreen')} className={ctl(true)} title="مشاركة الشاشة"><MonitorUp size={19} /></button>
                <button onClick={() => { cmd('toggleRaiseHand'); setHand(v => !v); }}
                    className={'w-12 h-12 rounded-2xl flex items-center justify-center transition ' +
                        (hand ? 'bg-gold-500 text-slate-900' : 'bg-white/10 text-white')} title="رفع اليد"><Hand size={19} /></button>
                <button onClick={() => cmd('toggleChat')} className={ctl(true)} title="المحادثة"><MessageSquare size={19} /></button>
                <button onClick={() => cmd('toggleTileView')} className={ctl(true)} title="عرض الشبكة"><Maximize2 size={19} /></button>
                <button onClick={leave} className="w-14 h-12 rounded-2xl bg-red-600 flex items-center justify-center" title="إنهاء">
                    <PhoneOff size={19} />
                </button>
            </div>
        </div>
    );
}
