// ─── الاتصال بالخادم ────────────────────────────────────────────────────────
// المسار نسبيّ فيعمل التطبيق حيثما نُشر: مجلداً في موقع أو نطاقاً فرعياً.
const TK = 'ohda_token';

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
    if (res.status === 401) { token.clear(); window.dispatchEvent(new Event('ohda:logout')); }
    return j;
}

// الصورة تُصغَّر على الجهاز قبل الرفع: أسرع على الجوّال، وتصير JPEG
// فتقبلها القراءة الآلية حتى لو التُقطت بصيغة آيفون (HEIC)
export async function shrink(file) {
    if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
        const bmp = await loadBitmap(file);
        const max = 2000;
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
        if (k === 1 && file.type === 'image/jpeg' && file.size < 1.5 * 1024 * 1024) return file;
        const cv = document.createElement('canvas');
        cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.86));
        if (!blob) return file;
        return new File([blob], (file.name || 'receipt').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; }
}

function loadBitmap(file) {
    if (window.createImageBitmap) return createImageBitmap(file);
    return new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = rej;
        im.src = URL.createObjectURL(file);
    });
}

export async function upload(file) {
    const f = await shrink(file);
    const form = new FormData();
    form.append('file', f, f.name || 'receipt.jpg');
    return call('upload', { form });
}
