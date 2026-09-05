import { useState, useMemo, useCallback } from 'react';

// ─── ترتيب موحّد لكل جداولنا ────────────────────────────────────────────────
// يميّز النوع تلقائيا: الأرقام عدديا، والتواريخ زمنيا، والنصوص عربيا وإنجليزيا.
const NUM = /^-?[\d,]+(\.\d+)?%?$/;
const ISO = /^\d{4}-\d{2}-\d{2}(\s|T|$)/;

export const valueKind = v => {
    if (v === null || v === undefined || v === '') return 'empty';
    const s = String(v).trim();
    if (ISO.test(s)) return 'date';
    if (NUM.test(s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) return 'num';
    return 'text';
};

const toNum = v => {
    const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,%\s]/g, '');
    const n = Number(s);
    return isFinite(n) ? n : null;
};

// مقارنة قيمتين: الفارغ دائما في الآخر مهما كان الاتجاه
export function compareValues(a, b) {
    const ea = a === null || a === undefined || a === '';
    const eb = b === null || b === undefined || b === '';
    if (ea && eb) return 0;
    if (ea) return 1;
    if (eb) return -1;

    const na = toNum(a), nb = toNum(b);
    if (na !== null && nb !== null) return na - nb;

    const sa = String(a), sb = String(b);
    if (ISO.test(sa) && ISO.test(sb)) return sa < sb ? -1 : sa > sb ? 1 : 0;

    return sa.localeCompare(sb, ['ar', 'en'], { numeric: true, sensitivity: 'base' });
}

const isEmpty = v => v === null || v === undefined || v === '';

export function sortRows(rows, key, dir) {
    if (!key || !Array.isArray(rows)) return rows;
    const sign = dir === 'desc' ? -1 : 1;
    return [...rows].sort((x, y) => {
        const a = x?.[key], b = y?.[key];
        // الفارغ في الذيل دائما، لا ينقلب مع اتجاه الترتيب
        const ea = isEmpty(a), eb = isEmpty(b);
        if (ea && eb) return 0;
        if (ea) return 1;
        if (eb) return -1;
        const c = compareValues(a, b);
        return c === 0 ? 0 : c * sign;
    });
}

// خطاف للجداول: يعيد الصفوف مرتبة مع مفتاح الترتيب واتجاهه
export function useSort(rows, initialKey = null, initialDir = 'asc') {
    const [key, setKey] = useState(initialKey);
    const [dir, setDir] = useState(initialDir);

    // العمود الجديد يبدأ بالاتجاه المناسب لنوعه، وإعادة الضغط تعكسه
    const toggle = useCallback((k, firstDir) => {
        setKey(prev => {
            if (prev === k) { setDir(d => (d === 'asc' ? 'desc' : 'asc')); return k; }
            setDir(firstDir === 'desc' ? 'desc' : 'asc');
            return k;
        });
    }, []);

    const sorted = useMemo(() => sortRows(rows || [], key, dir), [rows, key, dir]);
    return { sorted, key, dir, toggle, setKey, setDir };
}

// أول اتجاه منطقي لعمود حسب نوع أول قيمة فيه
export const smartFirstDir = (rows, k) => {
    const first = (rows || []).map(r => r?.[k]).find(v => v !== null && v !== undefined && v !== '');
    const kind = valueKind(first);
    return (kind === 'num' || kind === 'date') ? 'desc' : 'asc';
};
