import { useState, useRef, useCallback, useEffect } from 'react';
import { call } from './api';

// ════════════════════════════════════════════════════════════════════════════
//  محرّك مكالمة الاجتماع — WebRTC بين الأجهزة مباشرة
//  ─────────────────────────────────────────────────────────────────────────
//  • الصوت والصورة يسريان من جهازٍ إلى جهاز (مشفّرين)، لا عبر خادمنا.
//  • خادمنا «يعرّف» الأجهزة فقط: كل ثانية نسأله من في الغرفة وهل وصلتنا رسالة.
//  • بين كل جهازين: صاحب الرقم الأصغر يبدأ بالعرض، والآخر يرد — فلا يتصادمان.
//  • العرض يُرسَل بعد اكتمال جمع العناوين (لا قطرةً قطرة)، فتكفي رسالتان للاتصال.
//  • الشبكة الشبكية (mesh) تناسب اجتماعاً صغيراً؛ ومع كل مشاركٍ نُنقص جودة
//    الصورة المرسلة ليبقى الجوال قادراً على الإرسال للجميع.
// ════════════════════════════════════════════════════════════════════════════

const POLL_MS = 1000;
const ICE_WAIT_MS = 2500;
const bitrateFor = n => (n <= 1 ? 1200000 : n === 2 ? 700000 : n <= 4 ? 450000 : 300000);

const VIDEO = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

// انتظار اكتمال جمع عناوين الاتصال (بحدٍّ أقصى) ثم إرسال الوصف كاملاً
function waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(res => {
        const t = setTimeout(done, ICE_WAIT_MS);
        function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); }
        function chk() { if (pc.iceGatheringState === 'complete') done(); }
        pc.addEventListener('icegatheringstatechange', chk);
    });
}

export default function useRtc({ guestToken = null, meetingId = 0 } = {}) {
    const [status, setStatus]   = useState('idle');   // idle | media | joining | waiting | in | denied | kicked | ended | error
    const [error, setError]     = useState('');
    const [local, setLocal]     = useState(null);     // MediaStream
    const [mic, setMic]         = useState(true);
    const [cam, setCam]         = useState(true);
    const [hand, setHand]       = useState(false);
    const [share, setShare]     = useState(false);
    const [facing, setFacing]   = useState('user');
    const [peers, setPeers]     = useState([]);       // [{id,name,role,mic,cam,hand,share,stream,conn}]
    const [waiting, setWaiting] = useState([]);
    const [speaking, setSpeaking] = useState({});
    const [me, setMe]           = useState(null);     // { peer, name, role, meeting_id, can_draw }

    const R = useRef({});                             // حالة لا تُعيد الرسم
    const r = R.current;
    if (!r.pcs) Object.assign(r, { pcs: new Map(), streams: new Map(), since: 0, alive: false, timer: null,
        ice: [], peer: null, local: null, flags: { mic: true, cam: true, hand: false, share: false },
        list: [], camTrack: null, audio: null, meters: new Map(), busy: false });

    // نداءات ألواح بجلسة الدخول نفسها (المكالمة داخل الأسرة، بلا ضيوف)
    const post = useCallback(async (action, body) => call(action, { body: body || {} }), []);

    const signal = useCallback((to, kind, payload) =>
        post('rtc_signal', { peer: r.peer, to, kind, payload }).catch(() => null), [post, r]);

    // ─── قائمة المشاركين للعرض: بيانات الخادم + الصورة + حالة الاتصال ─────
    const publish = useCallback(() => {
        setPeers(r.list.map(p => {
            const c = r.pcs.get(p.id);
            const st = c ? c.pc.connectionState : 'new';
            return { ...p, stream: r.streams.get(p.id) || null,
                     conn: st === 'connected' ? 'connected' : (c && c.failed) ? 'failed' : 'connecting' };
        }));
    }, [r]);

    // ─── مؤشّر المتكلّم: مستوى الصوت لكل بثّ ───────────────────────────────
    const meter = useCallback((id, stream) => {
        try {
            if (!r.audio) return;
            if (r.meters.has(id)) { const m = r.meters.get(id); if (m.stream === stream) return; try { m.src.disconnect(); } catch (e) {} }
            if (!stream || !stream.getAudioTracks().length) return;
            const src = r.audio.createMediaStreamSource(stream);
            const an = r.audio.createAnalyser(); an.fftSize = 512;
            src.connect(an);
            r.meters.set(id, { src, an, stream, buf: new Uint8Array(an.fftSize) });
        } catch (e) { /* المؤشّر تحسينٌ لا شرط */ }
    }, [r]);

    // ─── جودة الإرسال بحسب عدد المشاركين ───────────────────────────────────
    const tuneBitrate = useCallback(() => {
        const n = r.pcs.size;
        r.pcs.forEach(({ pc }) => pc.getSenders().forEach(s => {
            if (!s.track || s.track.kind !== 'video') return;
            try {
                const p = s.getParameters();
                if (!p.encodings || !p.encodings.length) p.encodings = [{}];
                p.encodings[0].maxBitrate = bitrateFor(n);
                s.setParameters(p).catch(() => {});
            } catch (e) { /* بعض المتصفحات لا تدعم */ }
        }));
    }, [r]);

    const closePc = useCallback((id) => {
        const c = r.pcs.get(id);
        if (c) { try { c.pc.close(); } catch (e) {} clearTimeout(c.retry); r.pcs.delete(id); }
        r.streams.delete(id);
        const m = r.meters.get(id); if (m) { try { m.src.disconnect(); } catch (e) {} r.meters.delete(id); }
    }, [r]);

    // ─── اتصالٌ مع جهاز ────────────────────────────────────────────────────
    const makePc = useCallback((id, offerer) => {
        closePc(id);
        const pc = new RTCPeerConnection({ iceServers: r.ice, bundlePolicy: 'max-bundle' });
        const c = { pc, offerer, tries: (r.pcs.get(id) || {}).tries || 0, failed: false, retry: null };
        r.pcs.set(id, c);
        // من ينضمّ أثناء مشاركة الشاشة يستقبل الشاشة لا الكاميرا
        if (r.local) {
            r.local.getAudioTracks().forEach(t => pc.addTrack(t, r.local));
            const v = r.flags.share && r.shareTrack ? r.shareTrack : r.camTrack;
            if (v) pc.addTrack(v, r.local);
        }
        pc.ontrack = e => {
            const s = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
            r.streams.set(id, s); meter(id, s); publish();
        };
        pc.onconnectionstatechange = () => {
            const st = pc.connectionState;
            if (st === 'connected') { c.failed = false; c.tries = 0; tuneBitrate(); }
            if (st === 'failed' || st === 'disconnected') {
                // الأصغر رقماً يعيد المحاولة؛ ثلاث محاولات ثم نُظهر تعذّر الاتصال
                clearTimeout(c.retry);
                c.retry = setTimeout(() => {
                    if (r.pcs.get(id) !== c || !r.alive) return;
                    if (pc.connectionState === 'connected') return;
                    if (c.offerer && c.tries < 3) { c.tries++; startOffer(id, c.tries); }
                    else if (c.tries >= 3 || !c.offerer) { c.failed = pc.connectionState === 'failed'; publish(); }
                }, st === 'failed' ? 1500 : 5000);
            }
            publish();
        };
        return c;
    }, [r, closePc, meter, publish, tuneBitrate]); // eslint-disable-line react-hooks/exhaustive-deps

    const startOffer = useCallback(async (id, tries = 0) => {
        const c = makePc(id, true);
        c.tries = tries;
        try {
            const offer = await c.pc.createOffer();
            await c.pc.setLocalDescription(offer);
            await waitIce(c.pc);
            if (r.pcs.get(id) !== c) return;
            await signal(id, 'offer', c.pc.localDescription);
            // لا ردّ خلال خمس عشرة ثانية؟ نعيد العرض
            c.retry = setTimeout(() => {
                if (r.pcs.get(id) === c && !c.pc.remoteDescription && r.alive && c.tries < 3) startOffer(id, c.tries + 1);
            }, 15000);
        } catch (e) { /* يعاد في النبضة التالية */ }
        publish();
    }, [makePc, signal, publish, r]);

    const onSignal = useCallback(async (s) => {
        const from = s.from_peer;
        try {
            if (s.kind === 'offer') {
                const c = makePc(from, false);
                await c.pc.setRemoteDescription(s.payload);
                const ans = await c.pc.createAnswer();
                await c.pc.setLocalDescription(ans);
                await waitIce(c.pc);
                if (r.pcs.get(from) === c) await signal(from, 'answer', c.pc.localDescription);
            } else if (s.kind === 'answer') {
                const c = r.pcs.get(from);
                if (c && c.offerer && c.pc.signalingState === 'have-local-offer') {
                    clearTimeout(c.retry);
                    await c.pc.setRemoteDescription(s.payload);
                }
            } else if (s.kind === 'bye') {
                closePc(from);
            }
        } catch (e) { /* رسالة قديمة أو اتصال أُعيد — تُتجاهل */ }
        publish();
    }, [makePc, signal, closePc, publish, r]);

    // ─── النبضة ────────────────────────────────────────────────────────────
    const rejoin = useRef(null);
    const tick = useCallback(async () => {
        if (!r.alive || r.busy) return;
        r.busy = true;
        try {
            const res = await post('rtc_poll', { peer: r.peer, since: r.since, ...r.flags });
            if (!r.alive) return;
            if (!res || !res.success) {
                if (res && res.state === 'gone') { guestToken ? end('ended') : rejoin.current && rejoin.current(); }
                return;
            }
            if (res.state === 'waiting') { setStatus('waiting'); return; }
            if (res.state === 'denied' || res.state === 'kicked') { end(res.state); return; }
            if (res.state === 'left') { guestToken ? end('ended') : rejoin.current && rejoin.current(); return; }
            setStatus('in');
            for (const s of res.signals || []) { await onSignal(s); r.since = Math.max(r.since, s.id); }
            const list = res.peers || [];
            r.list = list;
            const ids = new Set(list.map(p => p.id));
            Array.from(r.pcs.keys()).forEach(id => { if (!ids.has(id)) closePc(id); });
            list.forEach(p => { if (!r.pcs.has(p.id) && r.peer < p.id) startOffer(p.id); });
            if (list.length !== r.lastN) { r.lastN = list.length; tuneBitrate(); }
            setWaiting(res.waiting || []);
            publish();
        } catch (e) { /* انقطاع لحظي — النبضة التالية تكمل */ }
        finally { r.busy = false; }
    }, [post, onSignal, closePc, startOffer, publish, tuneBitrate, guestToken, r]); // eslint-disable-line react-hooks/exhaustive-deps

    const loop = useCallback(() => {
        clearTimeout(r.timer);
        if (!r.alive) return;
        tick().finally(() => { if (r.alive) r.timer = setTimeout(loop, POLL_MS); });
    }, [tick, r]);

    // ─── الكاميرا والمايك ──────────────────────────────────────────────────
    const openMedia = useCallback(async (opts = {}) => {
        setStatus(s => (s === 'idle' ? 'media' : s)); setError('');
        const wantCam = opts.cam !== false, wantMic = opts.mic !== false;
        let s = null;
        try {
            s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: { ...VIDEO, facingMode: 'user' } });
        } catch (e) {
            // بلا كاميرا (أو رُفض إذنها) نكمل بالصوت وحده
            try { s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO }); }
            catch (e2) { setError('لم يُسمح بالمايك أو الكاميرا. افتح إعدادات المتصفح واسمح لهذا الموقع.'); setStatus('idle'); return null; }
        }
        s.getAudioTracks().forEach(t => { t.enabled = wantMic; });
        s.getVideoTracks().forEach(t => { t.enabled = wantCam; });
        r.local = s; r.camTrack = s.getVideoTracks()[0] || null;
        r.flags.mic = wantMic; r.flags.cam = wantCam && !!r.camTrack;
        setMic(wantMic); setCam(wantCam && !!r.camTrack); setLocal(s);
        setStatus(st => (st === 'media' ? 'idle' : st));
        return s;
    }, [r]);

    // ─── الدخول ────────────────────────────────────────────────────────────
    const join = useCallback(async ({ name } = {}) => {
        setError('');
        if (!r.local) { const s = await openMedia(); if (!s) return; }
        try {
            // سياق الصوت يحتاج لمسة المستخدم — والدخول لمسة
            if (!r.audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) r.audio = new AC(); }
            if (r.audio && r.audio.state === 'suspended') r.audio.resume().catch(() => {});
            meter('me', r.local);
        } catch (e) {}
        setStatus('joining');
        try {
            const res = guestToken
                ? await post('rtc_guest_join', { name })
                : await post('rtc_join', { meeting_id: meetingId, mic: r.flags.mic, cam: r.flags.cam });
            if (!res || !res.success) { setError((res && res.message) || 'تعذّر الدخول'); setStatus('error'); return; }
            r.peer = res.peer; r.ice = res.ice || []; r.since = 0; r.alive = true;
            setMe({ peer: res.peer, name: res.name, role: res.role, meeting_id: res.meeting_id, can_draw: res.can_draw });
            setStatus(res.state === 'waiting' ? 'waiting' : 'in');
            loop();
        } catch (e) { setError('تعذّر الوصول إلى الخادم'); setStatus('error'); }
    }, [r, openMedia, meter, post, guestToken, meetingId, loop]);

    // الموظّف الذي كنسه الخادم (غاب دقيقة، أو فتح من جهاز آخر) يعود بمقعدٍ جديد
    rejoin.current = async () => {
        Array.from(r.pcs.keys()).forEach(closePc);
        r.alive = false; clearTimeout(r.timer);
        await join({});
    };

    function end(reason) {
        r.alive = false; clearTimeout(r.timer);
        Array.from(r.pcs.keys()).forEach(closePc);
        r.list = []; setPeers([]); setWaiting([]);
        setStatus(reason || 'ended');
    }

    const stopMedia = useCallback(() => {
        if (r.local) r.local.getTracks().forEach(t => t.stop());
        if (r.shareTrack) { try { r.shareTrack.stop(); } catch (e) {} r.shareTrack = null; }
        r.local = null; r.camTrack = null; setLocal(null);
    }, [r]);

    const leave = useCallback(async () => {
        const peer = r.peer;
        end('ended');
        stopMedia();
        if (peer) post('rtc_leave', { peer }, true).catch(() => {});
        r.peer = null;
    }, [r, stopMedia, post]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── الأزرار ───────────────────────────────────────────────────────────
    const toggleMic = useCallback(() => {
        const v = !r.flags.mic; r.flags.mic = v; setMic(v);
        if (r.local) r.local.getAudioTracks().forEach(t => { t.enabled = v; });
    }, [r]);

    const toggleCam = useCallback(() => {
        if (!r.camTrack) return;
        const v = !r.flags.cam; r.flags.cam = v; setCam(v);
        r.camTrack.enabled = v;
    }, [r]);

    const toggleHand = useCallback(() => { const v = !r.flags.hand; r.flags.hand = v; setHand(v); }, [r]);

    const replaceVideo = useCallback((track) => {
        r.pcs.forEach(({ pc }) => pc.getSenders().forEach(s => { if (s.track && s.track.kind === 'video') s.replaceTrack(track).catch(() => {}); }));
    }, [r]);

    // تبديل الكاميرا الأمامية والخلفية (للجوال)
    const flipCam = useCallback(async () => {
        if (!r.local || r.flags.share) return;
        const next = facing === 'user' ? 'environment' : 'user';
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { ...VIDEO, facingMode: { exact: next } } })
                .catch(() => navigator.mediaDevices.getUserMedia({ video: { ...VIDEO, facingMode: next } }));
            const t = s.getVideoTracks()[0];
            t.enabled = r.flags.cam;
            replaceVideo(t);
            if (r.camTrack) { r.local.removeTrack(r.camTrack); r.camTrack.stop(); }
            r.local.addTrack(t); r.camTrack = t;
            setFacing(next); setLocal(new MediaStream(r.local.getTracks()));
        } catch (e) { setError('تعذّر تبديل الكاميرا'); }
    }, [r, facing, replaceVideo]);

    // مشاركة الشاشة (من الكمبيوتر)
    const canShare = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
        && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const toggleShare = useCallback(async () => {
        if (r.flags.share) {
            if (r.shareTrack) { try { r.shareTrack.stop(); } catch (e) {} r.shareTrack = null; }
            if (r.camTrack) replaceVideo(r.camTrack);
            r.flags.share = false; setShare(false);
            setLocal(r.local ? new MediaStream(r.local.getTracks()) : null);
            return;
        }
        try {
            const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
            const t = s.getVideoTracks()[0];
            r.shareTrack = t; replaceVideo(t);
            r.flags.share = true; setShare(true);
            setLocal(new MediaStream([t, ...(r.local ? r.local.getAudioTracks() : [])]));
            t.onended = () => { if (r.flags.share) toggleShare(); };
        } catch (e) { /* ألغى المستخدم */ }
    }, [r, replaceVideo]);

    const admit = useCallback((peerId, allow) =>
        post('rtc_admit', { peer_id: peerId, allow: allow ? 1 : 0 }).then(() => tick()), [post, tick]);
    const kick = useCallback(peerId => post('rtc_kick', { peer_id: peerId }).then(() => tick()), [post, tick]);

    // ─── قياس المتكلّم كل ربع ثانية ────────────────────────────────────────
    useEffect(() => {
        if (status !== 'in' && status !== 'waiting') return;
        const iv = setInterval(() => {
            const out = {};
            r.meters.forEach((m, id) => {
                m.an.getByteTimeDomainData(m.buf);
                let sum = 0; for (let i = 0; i < m.buf.length; i++) { const v = (m.buf[i] - 128) / 128; sum += v * v; }
                const rms = Math.sqrt(sum / m.buf.length);
                if (rms > 0.035 && (id !== 'me' || r.flags.mic)) out[id] = true;
            });
            setSpeaking(prev => {
                const a = Object.keys(prev).join(), b = Object.keys(out).join();
                return a === b ? prev : out;
            });
        }, 250);
        return () => clearInterval(iv);
    }, [status, r]);

    // الخروج عند إغلاق الصفحة
    useEffect(() => {
        const bye = () => { if (r.peer && r.alive) post('rtc_leave', { peer: r.peer }, true).catch(() => {}); };
        window.addEventListener('pagehide', bye);
        return () => {
            window.removeEventListener('pagehide', bye);
            bye(); r.alive = false; clearTimeout(r.timer);
            Array.from(r.pcs.keys()).forEach(closePc);
            if (r.local) r.local.getTracks().forEach(t => t.stop());
            if (r.audio) { try { r.audio.close(); } catch (e) {} }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        status, error, setError, local, mic, cam, hand, share, facing, peers, waiting, speaking, me, canShare,
        openMedia, join, leave, stopMedia, toggleMic, toggleCam, toggleHand, toggleShare, flipCam, admit, kick,
    };
}
