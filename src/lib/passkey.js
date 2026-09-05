import { API_URL, getAdminToken, LS_ADMIN_JWT } from './api/client';

// ─── الدخول بالبصمة/الوجه — WebAuthn ─────────────────────────────────────────
// البصمة لا تغادر الجهاز: الحساس يفتح مفتاحاً خاصاً محفوظاً في عتاد الجوال،
// ونحن نحفظ المفتاح العام فقط ونتحقق من التوقيع.
const b64uToBuf = s => {
    const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const pad = t.length % 4 ? '='.repeat(4 - (t.length % 4)) : '';
    const bin = atob(t + pad);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b.buffer;
};
const bufToB64u = b => {
    const bytes = new Uint8Array(b);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const passkeySupported = () =>
    typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

export async function passkeyAvailableHere() {
    if (!passkeySupported()) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch { return false; }
}

const deviceName = () => {
    const ua = navigator.userAgent;
    if (/iphone/i.test(ua)) return 'آيفون';
    if (/ipad/i.test(ua)) return 'آيباد';
    if (/android/i.test(ua)) return 'أندرويد';
    if (/mac/i.test(ua)) return 'ماك';
    if (/windows/i.test(ua)) return 'ويندوز';
    return 'جهاز';
};

// تفعيل البصمة على هذا الجهاز — يتطلب جلسة قائمة
export async function passkeyRegister() {
    const t = getAdminToken();
    const auth = t ? { Authorization: `Bearer ${t}` } : {};
    const start = await fetch(`${API_URL}?action=wa_reg_start`, { headers: auth }).then(r => r.json());
    if (!start.success) throw new Error(start.message || 'تعذر بدء التفعيل');
    const o = start.options;
    const cred = await navigator.credentials.create({
        publicKey: {
            ...o,
            challenge: b64uToBuf(o.challenge),
            user: { ...o.user, id: b64uToBuf(o.user.id) },
            excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: b64uToBuf(c.id) })),
        },
    });
    if (!cred) throw new Error('أُلغي التفعيل');
    const r = await fetch(`${API_URL}?action=wa_reg_finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
            session: start.session,
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
            attestationObject: bufToB64u(cred.response.attestationObject),
            device_name: deviceName(),
        }),
    }).then(x => x.json());
    if (!r.success) throw new Error(r.message || 'تعذر حفظ البصمة');
    try { localStorage.setItem('semak_passkey', '1'); } catch { /* تجاهل */ }
    return r;
}

// دخول بالبصمة — بلا كلمة مرور
export async function passkeyLogin(identifier = '') {
    const start = await fetch(`${API_URL}?action=wa_auth_start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
    }).then(r => r.json());
    if (!start.success) throw new Error(start.message || 'تعذر بدء الدخول');
    const o = start.options;
    const cred = await navigator.credentials.get({
        publicKey: {
            ...o,
            challenge: b64uToBuf(o.challenge),
            allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: b64uToBuf(c.id) })),
        },
    });
    if (!cred) throw new Error('أُلغي الدخول');
    const r = await fetch(`${API_URL}?action=wa_auth_finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session: start.session,
            id: cred.id,
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
            authenticatorData: bufToB64u(cred.response.authenticatorData),
            signature: bufToB64u(cred.response.signature),
        }),
    }).then(x => x.json());
    if (!r.success) throw new Error(r.message || 'فشل الدخول بالبصمة');
    try {
        if (r.jwt) localStorage.setItem(LS_ADMIN_JWT, r.jwt);
        localStorage.setItem('semak_current_user', JSON.stringify(r.data));
        localStorage.setItem('semak_passkey', '1');
    } catch { /* تجاهل */ }
    return r;
}

export const passkeyEnrolledHere = () => {
    try { return localStorage.getItem('semak_passkey') === '1'; } catch { return false; }
};
