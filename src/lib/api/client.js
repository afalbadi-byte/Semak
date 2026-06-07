// ════════════════════════════════════════════════════════════════════════════
//  العميل الموحّد للـ API — مصدر واحد لكل نداءات الخادم
//  بدّل تكرار "https://semak.sa/api.php" في كل ملف باستيراد من هنا.
//  • API_URL   : الرابط الأساسي (قابل للتهيئة عبر VITE_API_URL)
//  • TENANT    : معرّف المنشأة للمحرّك المستقل gl_*/acc_*
//  • apiUrl()  : بناء رابط كامل (للروابط window.open / href / img / PDF)
//  • api()     : نداء عام GET/POST يُرجع JSON مُحلَّل
//  • apiGet()  / apiPost() : اختصارات مريحة
// ════════════════════════════════════════════════════════════════════════════

export const API_URL = import.meta.env.VITE_API_URL || 'https://semak.sa/api.php';

// معرّف المنشأة (للمحرّك المحاسبي المستقل). افتراضي 1 للإنتاج، قابل للتهيئة لاحقًا للـ SaaS.
export const TENANT = Number(import.meta.env.VITE_TENANT_ID || 1);

// ─── رموز JWT المخزونة في localStorage ──────────────────────────────────────
export const LS_ADMIN_JWT    = 'semak_admin_jwt';
export const LS_PLATFORM_JWT = 'semak_platform_token';

export function getAdminToken()    { try { return localStorage.getItem(LS_ADMIN_JWT)    || null; } catch { return null; } }
export function getPlatformToken() { try { return localStorage.getItem(LS_PLATFORM_JWT) || null; } catch { return null; } }

// إرجاع ترويسة Authorization إن وُجد رمز صالح
function authHeaders() {
    const t = getPlatformToken() || getAdminToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─── بناء رابط كامل مع باراميترات ───────────────────────────────────────────
// يُستخدم للروابط المباشرة: window.open / <a href> / <img src> / روابط PDF.
export function apiUrl(action, params = {}) {
    const qs = new URLSearchParams();
    if (action) qs.set('action', action);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `${API_URL}?${s}` : API_URL;
}

// ─── نداء عام (GET أو POST) ─────────────────────────────────────────────────
// يُرجع الـ JSON المُحلَّل كما هو (يحافظ على شكل { success, ... } المعتمد في الـ API).
// يرمي خطأً واضحًا عند فشل القراءة/الشبكة.
export async function api(action, { method = 'GET', params = {}, body = null, tenant = null, signal } = {}) {
    const p = { ...params };
    if (tenant != null && p.tenant == null) p.tenant = tenant;
    const url  = apiUrl(action, p);
    const opts = { method, signal };
    if (body != null) {
        // وجود body يعني POST تلقائيًا (ما لم يُحدَّد method صراحةً غير GET)
        opts.method  = method === 'GET' ? 'POST' : method;
        opts.headers = { 'Content-Type': 'application/json', ...authHeaders() };
        const payload = { action, ...(tenant != null ? { tenant_id: tenant } : {}), ...body };
        opts.body = JSON.stringify(payload);
    } else {
        // GET أو طلب بدون body — نضيف ترويسة المصادقة فقط
        opts.headers = { ...authHeaders() };
    }
    const res = await fetch(url, opts);
    let json;
    try { json = await res.json(); }
    catch { throw new Error(`HTTP ${res.status}: استجابة غير صالحة من الخادم`); }
    return json;
}

// ─── اختصارات ───────────────────────────────────────────────────────────────
export const apiGet  = (action, params = {}, opts = {}) =>
    api(action, { ...opts, method: 'GET', params });

export const apiPost = (action, body = {}, params = {}, opts = {}) =>
    api(action, { ...opts, method: 'POST', params, body });

// ─── المستخدم الحالي (من جلسة لوحة الموظفين) ────────────────────────────────
// يقرأ بيانات الموظف المسجَّل من localStorage (يحفظها AdminLogin بعد الدخول).
export function currentUser() {
    try {
        const raw = localStorage.getItem('semak_current_user');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// ─── تسجيل حدث في سجل النشاط (اللوق) ────────────────────────────────────────
// استدعاء صامت (لا يُعطّل الواجهة عند الفشل). actor يُملأ تلقائيًا من المستخدم الحالي.
export function logEvent(entity, action, detail = '', entityId = null) {
    const u = currentUser();
    const actor = u ? (u.name || u.email || '') : '';
    try {
        apiPost('log_event', {
            entity, action, detail,
            entity_id: entityId,
            actor,
        }, {}, { tenant: TENANT }).catch(() => {});
    } catch { /* تجاهل أي خطأ — التسجيل ثانوي */ }
}
