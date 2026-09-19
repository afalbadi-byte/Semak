import { useEffect, useState } from 'react';

// ─── التنقّل بذيل الرابط (#) ────────────────────────────────────────────────
// كل شاشة لها عنوانها في الرابط: التحديث يُبقيك مكانك، وزرّ الرجوع يعيدك
// لآخر ما فتحت. ونحفظ سجلّ ما زرته داخل التطبيق في الجلسة، فنعرف متى يكون
// «رجوع» رجوعاً فعلاً ومتى يكون خروجاً من التطبيق إلى صفحةٍ قبله.

const NAV = 'alwah_nav';
const cur = () => window.location.hash.replace(/^#/, '') || '/';
const load = () => { try { return JSON.parse(sessionStorage.getItem(NAV) || '[]'); } catch (e) { return []; } };
const save = s => { try { sessionStorage.setItem(NAV, JSON.stringify(s.slice(-60))); } catch (e) { /* تجاهل */ } };

function track() {
    const s = load(), h = cur();
    if (s.length > 1 && s[s.length - 2] === h) s.pop();        // رجوعٌ خطوة
    else if (s[s.length - 1] !== h) s.push(h);                  // صفحةٌ جديدة
    save(s);
}

function parse() {
    const [path, q] = cur().split('?');
    return {
        path: path || '/',
        parts: (path || '/').split('/').filter(Boolean),
        q: Object.fromEntries(new URLSearchParams(q || '')),
    };
}

export function useRoute() {
    const [r, setR] = useState(() => { track(); return parse(); });
    useEffect(() => {
        const f = () => { track(); setR(parse()); window.scrollTo(0, 0); };
        window.addEventListener('hashchange', f);
        return () => window.removeEventListener('hashchange', f);
    }, []);
    return r;
}

export function href(path, q) {
    const s = q ? new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
    return '#' + path + (s ? '?' + s : '');
}

export function go(path, q) { window.location.hash = href(path, q).slice(1); }

// استبدال الصفحة الحالية دون أن تدخل السجلّ — بعد الحفظ مثلاً
export function replace(path, q) {
    const s = load(); s.pop(); save(s);
    window.location.replace(href(path, q));
}

export function back(fallback) {
    if (load().length > 1) window.history.back();
    else replace(fallback || '/');
}
