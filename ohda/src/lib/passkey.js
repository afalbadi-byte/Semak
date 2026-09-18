// ─── الدخول بالبصمة و Face ID (مفاتيح المرور) ───────────────────────────────
// المتصفّح يطلب من الجهاز التحقّق من صاحبه، ثم يعيد توقيعاً نرسله للخادم.
// لا بصمة ولا صورة وجه تغادر الجهاز، ولا كلمة مرور تُكتب.
import { call } from './api';

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(b, c => c.charCodeAt(0));
};

const FLAG = 'ohda_pk';                 // هذا الجهاز فيه مفتاحٌ مسجَّل
export const pkHere = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
const markHere = v => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch (e) { /* تجاهل */ } };

// هل في الجهاز بصمةٌ أو وجهٌ مفعَّل؟
export async function pkSupported() {
    try {
        return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
            && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { return false; }
}

// اسمٌ مفهوم للجهاز في قائمة الأجهزة
export function deviceName() {
    const ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return (ua.match(/Android[^;]*;\s*([^;)]+)/) || [])[1] || 'Android';
    if (/Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Device';
}

export async function pkRegister() {
    const o = await call('pk_reg_options');
    if (!o.success) throw new Error(o.message || '');
    const x = o.options;
    const cred = await navigator.credentials.create({ publicKey: {
        ...x,
        challenge: unb64u(x.challenge),
        user: { ...x.user, id: unb64u(x.user.id) },
        excludeCredentials: (x.excludeCredentials || []).map(c => ({ ...c, id: unb64u(c.id) })),
    } });
    const r = await call('pk_reg_verify', { body: {
        id: cred.id,
        clientDataJSON: b64u(cred.response.clientDataJSON),
        attestationObject: b64u(cred.response.attestationObject),
        name: deviceName(),
    } });
    if (!r.success) throw new Error(r.message || '');
    markHere(true);
    return true;
}

// الدخول: يُرجع رمز الجلسة
export async function pkLogin() {
    const o = await call('pk_auth_options');
    if (!o.success) throw new Error(o.message || '');
    const x = o.options;
    const cred = await navigator.credentials.get({ publicKey: {
        ...x, challenge: unb64u(x.challenge), allowCredentials: [],
    } });
    const r = await call('pk_auth_verify', { body: {
        id: b64u(cred.rawId),
        clientDataJSON: b64u(cred.response.clientDataJSON),
        authenticatorData: b64u(cred.response.authenticatorData),
        signature: b64u(cred.response.signature),
    } });
    if (!r.success) {
        if (/غير مسجّلة/.test(r.message || '')) markHere(false);
        throw new Error(r.message || '');
    }
    markHere(true);
    return r.token;
}

export const forgetHere = () => markHere(false);

// أخطاء المتصفّح المألوفة: إلغاء المستخدم لا يُعرض خطأً
export const pkCancelled = e => e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
