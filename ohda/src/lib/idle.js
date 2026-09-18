// ─── الخروج التلقائي ────────────────────────────────────────────────────────
// آخر نشاطٍ يُحفظ على الجهاز، فإن مضت المدّة المختارة بلا لمسة خرج التطبيق —
// حتى لو أُغلق وفُتح بعد ساعات. المدّة لكل جهاز، والافتراضي ربع ساعة.
const K_MIN = 'ohda_idle', K_LAST = 'ohda_last';
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } };

export const IDLE_OPTIONS = [5, 15, 30, 60, 0];          // بالدقائق، والصفر: أبداً
export const idleMinutes = () => { const v = get(K_MIN); return v === null ? 15 : Number(v); };
export const setIdleMinutes = m => { set(K_MIN, String(m)); touch(true); };

let lastWrite = 0;
export function touch(force) {
    const now = Date.now();
    if (!force && now - lastWrite < 5000) return;        // لا نكتب مع كل حركة
    lastWrite = now;
    set(K_LAST, String(now));
}

export function expired() {
    const m = idleMinutes();
    if (!m) return false;
    const last = Number(get(K_LAST) || 0);
    return last > 0 && Date.now() - last > m * 60000;
}

// يراقب النشاط ويستدعي onExpire عند انقضاء المدّة؛ يُعيد دالّة الإيقاف
export function watchIdle(onExpire) {
    touch(true);
    const act = () => touch(false);
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    evs.forEach(e => window.addEventListener(e, act, { passive: true }));
    const check = () => { if (expired()) onExpire(); };
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(check, 20000);
    return () => {
        evs.forEach(e => window.removeEventListener(e, act));
        document.removeEventListener('visibilitychange', vis);
        clearInterval(t);
    };
}
