import React from 'react';
import { useNavigate } from 'react-router-dom';

// ════════════════════════════════════════════════════════════════════════════
//  رابط قابل للنقر يفتح تفاصيل الكيان داخل اللوحة — "لا عناصر صامتة".
//  to: مسار نسبي داخل /admin/dashboard مثل "suppliers/123" أو "invoices/45".
//  يستخدم <a href> حقيقيًا (قابل للفتح في تبويب جديد) مع تنقّل SPA عند النقر العادي.
// ════════════════════════════════════════════════════════════════════════════

export default function EntityLink({
    to,
    children,
    icon: Icon,
    title,
    onClick,
    className = '',
    muted = false,
}) {
    const navigate = useNavigate();
    const href = to ? `/admin/dashboard/${to}` : undefined;

    const handle = (e) => {
        // احترام فتح تبويب جديد (Ctrl/Cmd/middle click) — لا تتدخّل
        if (e.metaKey || e.ctrlKey || e.button === 1) return;
        e.preventDefault();
        if (onClick) onClick(e);
        if (to) navigate(href);
    };

    const base = muted
        ? 'text-slate-600 hover:text-[#c5a059]'
        : 'text-[#1a365d] hover:text-[#c5a059]';

    return (
        <a
            href={href}
            onClick={handle}
            title={title}
            className={`inline-flex items-center gap-1 font-bold hover:underline underline-offset-2 decoration-[#c5a059]/60 transition cursor-pointer ${base} ${className}`}
        >
            {Icon ? <Icon size={13} className="opacity-60 shrink-0" /> : null}
            {children}
        </a>
    );
}
