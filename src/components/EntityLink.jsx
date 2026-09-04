import React from 'react';
import { useNavigate } from 'react-router-dom';
import { entityPath } from '../lib/entity';

// ─── رابط دلالة: اضغط الاسم فتفتح بطاقته بكل ما تحته في النظام ───────────────
export default function EntityLink({ type, value, children, className = '' }) {
    const navigate = useNavigate();
    const v = value ?? children;
    if (v === null || v === undefined || v === '' || v === '—') return <span>{children ?? '—'}</span>;
    return (
        <button
            type="button"
            onClick={e => { e.stopPropagation(); navigate(entityPath(type, v)); }}
            className={'text-right underline decoration-dotted underline-offset-4 hover:text-gold-600 transition ' + className}
            title="اعرض كل ما يتعلق بهذا"
        >
            {children ?? v}
        </button>
    );
}
