import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Video, MonitorUp, Hand, MessageSquare, Link2, Copy, Check, ShieldCheck, Loader2,
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
// مساران: إن صرف الخادم مفتاح 8x8 (JaaS) ضُمِّنت المكالمة داخل التطبيق بلا حدّ.
// وإلا فُتحت على meet.jit.si في نافذتها — فتضمينها هناك يُقطع بعد خمس دقائق.

// إعدادات تُمرَّر في ذيل الرابط، فتدخل الغرفة مباشرةً باسمك بلا صفحة انتظار
const roomUrl = (room, name) => 'https://' + JITSI_HOST + '/' + room + '#' + [
    'config.prejoinConfig.enabled=false',
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=false',
    'config.defaultLanguage=%22ar%22',
    'userInfo.displayName=' + encodeURIComponent(JSON.stringify(name || 'عضو سماك')),
].join('&');
let scriptP = null;
const loadApi = src => {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    if (scriptP) return scriptP;
    scriptP = new Promise((res, rej) => {
        const el = document.createElement('script');
        el.src = src; el.async = true;
        el.onload = res; el.onerror = () => { scriptP = null; rej(new Error('تعذّر تحميل وحدة المكالمة')); };
        document.head.appendChild(el);
    });
    return scriptP;
};

export default function MeetCall({ userName, userEmail, meetingTitle, dense }) {
    const [room, setRoom]   = useState(null);
    const [state, setState] = useState('idle');   // idle | loading | live | error
    const [err, setErr]     = useState('');
    const [copied, setCopied] = useState(false);
    const [jaas, setJaas]   = useState(null);     // إعداد التضمين عبر 8x8 إن توفّر
    const host = useRef(null);
    const apiRef = useRef(null);

    // الغرفة تُطلب من خادمنا: من لا يملك جلسة هنا لا يعرف اسمها
    const fetchRoom = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}?action=mtg_room`, {
                headers: { Authorization: 'Bearer ' + getAdminToken() },
            }).then(x => x.json());
            if (r && r.success) { setRoom(r.room); setJaas(r.jaas || null); return r; }
            setErr((r && r.message) || 'تعذّر تجهيز الغرفة');
        } catch (e) { setErr('تعذّر الوصول إلى الخادم'); }
        return null;
    }, []);

    useEffect(() => { fetchRoom(); }, [fetchRoom]);

    const join = async () => {
        if (!room) return;
        if (!jaas) { window.open(roomUrl(room, userName), '_blank', 'noopener'); return; }
        setState('loading'); setErr('');
        try {
            const fresh = (await fetchRoom()) || {};
            const J = fresh.jaas || jaas;
            if (!J) { setState('idle'); window.open(roomUrl(room, userName), '_blank', 'noopener'); return; }
            await loadApi('https://' + J.domain + '/' + J.app + '/external_api.js');
            const api = new window.JitsiMeetExternalAPI(J.domain, {
                roomName: J.room,
                jwt: J.jwt,
                parentNode: host.current,
                width: '100%', height: '100%',
                userInfo: { displayName: userName || 'عضو سماك', email: userEmail || undefined },
                configOverwrite: {
                    startWithAudioMuted: false,
                    startWithVideoMuted: false,
                    prejoinPageEnabled: false,
                    prejoinConfig: { enabled: false },
                    disableModeratorIndicator: true,
                    disableProfile: true,
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
            // طبقة الانتظار تُغطّي الإطار، ولو بقيت حبست المستخدم خلفها. فنرفعها
            // بأول إشارة حياة من الغرفة، وبمهلةٍ قصيرة على أي حال.
            const live = () => { clearTimeout(t0); setState('live'); };
            const t0 = setTimeout(live, 4000);
            api.addListener('videoConferenceJoined', live);
            api.addListener('participantJoined', live);
            api.addListener('browserSupport', live);
            api.addListener('errorOccurred', e => { live(); if (e && e.error) setErr(String(e.error.message || e.error.name || '')); });
            api.addListener('readyToClose', () => leave());
        } catch (e) { setState('error'); setErr(e.message || 'تعذّر بدء المكالمة'); }
    };

    const leave = () => {
        try { apiRef.current && apiRef.current.dispose(); } catch (e) {}
        apiRef.current = null;
        setState('idle');
    };
    useEffect(() => () => { try { apiRef.current && apiRef.current.dispose(); } catch (e) {} }, []);

    const copyLink = async () => {
        const url = 'https://' + JITSI_HOST + '/' + room;
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
        catch (e) { window.prompt('انسخ الرابط', url); }
    };


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
                    {jaas
                        ? 'لا يدخل الغرفة إلا من يحمل مفتاحاً موقَّعاً يصرفه خادم سماك لمن له حساب هنا — فلا رابط يُسرَّب ولا ضيف بلا دعوة. والمكالمة داخل التطبيق بلا حدٍّ زمني.'
                        : 'اسم الغرفة سرٌّ عشوائي يصرفه خادم سماك لمن يملك حساباً هنا. المكالمة تُفتح في نافذتها بلا حدٍّ زمني، وتبقى الأجندة والسبورة هنا — ارجع إليها من التطبيقات المفتوحة دون أن تنقطع المكالمة.'}
                </p>
                {/* رابط الدعوة لا معنى له مع 8x8: الغرفة لا تُفتح بلا مفتاح موقَّع */}
                {!jaas ? <div className="flex items-center gap-2">
                    <button onClick={copyLink} disabled={!room}
                        className="flex-1 h-11 rounded-2xl bg-white/10 font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-40">
                        {copied ? <><Check size={15} className="text-emerald-400" />نُسخ الرابط</> : <><Copy size={15} />انسخ رابط الدعوة</>}
                    </button>
                    {room ? (
                        <a href={'https://' + JITSI_HOST + '/' + room} target="_blank" rel="noreferrer"
                            className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center"><Link2 size={16} /></a>
                    ) : null}
                </div> : null}
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
                <div className="absolute inset-x-0 top-3 flex flex-col items-center gap-2 pointer-events-none">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur text-[12px] font-bold text-slate-300 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-gold-500" />جارٍ الدخول إلى الغرفة…
                    </span>
                </div>
            ) : null}

        </div>
    );
}
