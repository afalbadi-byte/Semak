// ─── الإشعارات: اشتراك الجهاز في الدفع (Web Push) ────────────────────────────
// يُسجَّل عامل الخدمة، ثم يُطلب إذن الإشعارات، ثم يُحفظ اشتراك الجهاز في الخادم،
// فتصل التنبيهات ولو كان التطبيق مغلقاً. مفتاح الخادم العام يُحقن عند النشر.
import { call } from './api';

export const VAPID = '__VAPID_PUBLIC__';
export const hasKey = () => VAPID.length > 20;
export const pushReady = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && hasKey();
export const pushState = () => (!hasKey() ? 'nokey' : !pushReady() ? 'unsupported' : Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off');

const b64 = s => {
    const p = '='.repeat((4 - (s.length % 4)) % 4);
    const r = (s + p).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(r);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};
const enc = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function register() {
    if (!pushReady()) return null;
    return navigator.serviceWorker.register('./sw.js', { scope: './' });
}

export async function subscribe() {
    if (!pushReady()) throw new Error('الإشعارات غير مدعومة على هذا الجهاز');
    const reg = await register();
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(perm === 'denied' ? 'الإشعارات محظورة في إعدادات المتصفح' : 'لم يُمنح الإذن');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
    const k = sub.toJSON().keys || {};
    const r = await call('push_sub', { body: { endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth, agent: navigator.userAgent.slice(0, 120) } });
    if (!r.success) throw new Error(r.message || 'تعذّر حفظ الاشتراك');
    return sub;
}

export async function unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) { await call('push_unsub', { body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
}
export const enc64 = enc;
