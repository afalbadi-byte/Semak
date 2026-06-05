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
        opts.headers = { 'Content-Type': 'application/json' };
        const payload = { action, ...(tenant != null ? { tenant_id: tenant } : {}), ...body };
        opts.body = JSON.stringify(payload);
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
