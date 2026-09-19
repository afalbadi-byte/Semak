import { useEffect, useRef, useState } from 'react';
import { segsAyahs } from './ayah';

// ════════════════════════════════════════════════════════════════════════════
//  مُسمِع الشيخ محمد أيوب: التلاوة آيةً آية من everyayah.com
//  ─────────────────────────────────────────────────────────────────────────
//  طريقتان للتكرار: «المقطع كاملاً» يتلوه من أوّله إلى آخره ثم يعيده، و«كل آية»
//  يكرّرها ثم ينتقل للتي بعدها. وما دام يتلو تبقى الشاشة مضاءة (Wake Lock) فلا
//  ينام الجوال ولا يُقفل، وتظهر أزرار التحكّم في شاشة القفل والإشعارات.
// ════════════════════════════════════════════════════════════════════════════
const SRC = 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps/';
const pad = n => String(n).padStart(3, '0');
const url = k => { const [s, a] = k.split(':'); return SRC + pad(s) + pad(a) + '.mp3'; };
const PREF = 'alwah_rec_v2';
const DEF = { mode: 'seg', n: 3, rate: 1 };
export const loadPref = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (e) { return { ...DEF }; } };
export const eachOf = p => (p.mode === 'ayah' ? Math.max(1, p.n || 1) : 1);
const loopsOf = p => (p.mode === 'seg' ? p.n : 1);

export default function useReciter({ onAyah } = {}) {
    const [pref, setPrefS] = useState(loadPref);
    const [st, setSt] = useState({ on: false, i: 0, rep: 1, loop: 1, paused: false });
    const [list, setList] = useState([]);
    const audio = useRef(null);
    const stRef = useRef(st); stRef.current = st;
    const listRef = useRef(list); listRef.current = list;
    const lock = useRef(null);

    const setPref = p => { setPrefS(p); try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* تجاهل */ } };

    // إبقاء الشاشة مضاءة أثناء التلاوة، وإعادة الطلب إذا عاد التطبيق إلى الواجهة
    const wake = async on => {
        try {
            if (on && !lock.current && navigator.wakeLock) {
                lock.current = await navigator.wakeLock.request('screen');
                lock.current.addEventListener('release', () => { lock.current = null; });
            }
            if (!on && lock.current) { await lock.current.release(); lock.current = null; }
        } catch (e) { /* غير مدعوم */ }
    };
    useEffect(() => { wake(st.on && !st.paused); }, [st.on, st.paused]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const f = () => { if (document.visibilityState === 'visible' && stRef.current.on && !stRef.current.paused) wake(true); };
        document.addEventListener('visibilitychange', f);
        return () => { document.removeEventListener('visibilitychange', f); wake(false); if (audio.current) audio.current.pause(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { onAyah && onAyah(st.on ? list[st.i] : null); }, [st.on, st.i, list]); // eslint-disable-line react-hooks/exhaustive-deps

    const playAt = (i, rep, loop) => {
        const L = listRef.current;
        if (!L[i]) return;
        const a = audio.current || (audio.current = new Audio());
        a.onended = next;
        a.onerror = () => stop();
        a.src = url(L[i]);
        a.playbackRate = loadPref().rate;
        a.play().catch(() => {});
        setSt({ on: true, i, rep, loop, paused: false });
        if (L[i + 1]) { const n = new Audio(); n.preload = 'auto'; n.src = url(L[i + 1]); }
        // أزرار التحكّم في شاشة القفل والإشعارات
        try {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new window.MediaMetadata({ title: L[i], artist: 'الشيخ محمد أيوب', album: 'ألواح' });
                navigator.mediaSession.setActionHandler('pause', () => toggle());
                navigator.mediaSession.setActionHandler('play', () => toggle());
                navigator.mediaSession.setActionHandler('nexttrack', () => jump(1));
                navigator.mediaSession.setActionHandler('previoustrack', () => jump(-1));
            }
        } catch (e) { /* غير مدعوم */ }
    };
    function next() {
        const s = stRef.current, p = loadPref(), L = listRef.current;
        if (s.rep < eachOf(p)) return playAt(s.i, s.rep + 1, s.loop);
        if (s.i < L.length - 1) return playAt(s.i + 1, 1, s.loop);
        const loops = loopsOf(p);
        if (loops === 0 || s.loop < loops) return playAt(0, 1, s.loop + 1);
        stop();
    }
    function stop() { if (audio.current) audio.current.pause(); setSt({ on: false, i: 0, rep: 1, loop: 1, paused: false }); }
    function toggle() {
        const s = stRef.current, a = audio.current;
        if (!s.on || !a) return;
        if (s.paused) { a.play().catch(() => {}); setSt(x => ({ ...x, paused: false })); } else { a.pause(); setSt(x => ({ ...x, paused: true })); }
    }
    function jump(d) { const s = stRef.current; playAt(Math.min(listRef.current.length - 1, Math.max(0, s.i + d)), 1, s.loop); }
    // تشغيل مقاطع [[من، إلى]، …] من أوّلها
    const play = segs => {
        const L = segsAyahs(segs);
        if (!L.length) return;
        listRef.current = L; setList(L);
        playAt(0, 1, 1);
    };
    useEffect(() => { if (audio.current) audio.current.playbackRate = pref.rate; }, [pref.rate]);

    return { pref, setPref, st, list, current: st.on ? list[st.i] : null, play, toggle, stop, jump };
}
