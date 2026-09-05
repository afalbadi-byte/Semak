import { useEffect, useRef } from 'react';

// ─── زر الرجوع في الجوال ─────────────────────────────────────────────────────
// التطبيق شاشاته حالة داخلية لا عناوين، فحركة الرجوع كانت تخرج منه مباشرة.
// نسجّل لكل شاشة داخلية خطوة في تاريخ المتصفح، فترجع الحركة شاشة واحدة.
let seq = 0;
const stack = [];        // { id, handler }
let skip = 0;            // خطوات نستهلكها نحن، لا يجوز تنفيذ معالجها
let installed = false;

function install() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    window.addEventListener('popstate', () => {
        if (skip > 0) { skip--; return; }
        const top = stack.pop();
        if (top) top.handler();
    });
}

export function pushScreen(handler) {
    install();
    const id = ++seq;
    stack.push({ id, handler });
    try { window.history.pushState({ semakScreen: id }, ''); } catch { /* تجاهل */ }
    return id;
}

// إغلاق من داخل الواجهة: نزيل الخطوة من التاريخ بلا تنفيذ المعالج مرتين
export function closeScreen(id) {
    const i = stack.findIndex(s => s.id === id);
    if (i === -1) return;
    stack.splice(i, 1);
    skip++;
    try { window.history.back(); } catch { skip--; }
}

// عمق الشاشات المفتوحة: يدفع خطوة لكل مستوى ويستهلكها عند الرجوع
export function useDepthGuard(depth, onBack) {
    const ids = useRef([]);
    const cb  = useRef(onBack);
    cb.current = onBack;

    useEffect(() => {
        while (ids.current.length < depth) {
            ids.current.push(pushScreen(() => { ids.current.pop(); cb.current(); }));
        }
        while (ids.current.length > depth) {
            closeScreen(ids.current.pop());
        }
    }, [depth]);

    // عند إزالة المكوّن ننظّف ما تبقّى من خطواتنا
    useEffect(() => () => { while (ids.current.length) closeScreen(ids.current.pop()); }, []);
}
