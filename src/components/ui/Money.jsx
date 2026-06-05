import React from 'react';

// ════════════════════════════════════════════════════════════════════════════
//  عرض موحّد للأرقام المالية — دقّة 100%
//  يعرض القيمة الممرَّرة كما هي (لا إعادة حساب)، بتنسيق فواصل آلاف ومنزلتين عشريتين.
//  الأرقام دائمًا LTR لتفادي انعكاس العلامات في الواجهة العربية.
// ════════════════════════════════════════════════════════════════════════════

export function formatMoney(value, decimals = 2) {
    const n = Number(value);
    if (value == null || value === '' || Number.isNaN(n)) return (0).toFixed(decimals);
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Money({
    value,
    currency = '﷼',
    decimals = 2,
    className = '',
    signed = false,
    colored = false,
    zeroDash = false,
}) {
    const n = Number(value);
    const invalid = value == null || value === '' || Number.isNaN(n);

    if (invalid || (zeroDash && n === 0)) {
        return <span className={`tabular-nums ${className}`} dir="ltr">—</span>;
    }

    const formatted = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const sign = signed && n > 0 ? '+' : '';
    const tone = colored ? (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-brand-400') : '';

    return (
        <span className={`tabular-nums ${tone} ${className}`} dir="ltr">
            {sign}{formatted}{currency ? ` ${currency}` : ''}
        </span>
    );
}
