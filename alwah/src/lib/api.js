// ─── الاتصال بالخادم ────────────────────────────────────────────────────────
// المسار نسبيّ فيعمل التطبيق حيثما نُشر: مجلداً في موقع أو نطاقاً فرعياً.
const TK = 'alwah_token';

export const token = {
    get() { try { return localStorage.getItem(TK); } catch (e) { return null; } },
    set(t) { try { localStorage.setItem(TK, t); } catch (e) { /* وضع التصفّح الخاص */ } },
    clear() { try { localStorage.removeItem(TK); } catch (e) { /* تجاهل */ } },
};

export async function call(action, opts = {}) {
    const qs = new URLSearchParams({ action });
    for (const [k, v] of Object.entries(opts.params || {}))
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    const init = { method: opts.body || opts.form ? 'POST' : 'GET', headers: {} };
    const t = token.get();
    if (t) init.headers.Authorization = 'Bearer ' + t;
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    if (opts.form) init.body = opts.form;
    let res;
    try { res = await fetch('api.php?' + qs.toString(), init); }
    catch (e) { return { success: false, message: 'لا اتصال بالإنترنت' }; }
    let j;
    try { j = await res.json(); } catch (e) { return { success: false, message: 'ردّ غير مفهوم من الخادم' }; }
    if (res.status === 401) { token.clear(); window.dispatchEvent(new Event('alwah:logout')); }
    return j;
}

