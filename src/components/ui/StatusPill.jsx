import React from 'react';

// ════════════════════════════════════════════════════════════════════════════
//  شارة حالة ملوّنة موحّدة (مدفوعة / متأخرة / معلّقة ...)
//  تقبل مفتاح حالة (إنجليزي) أو نصًّا مخصّصًا. ألوان ثابتة لدعم Tailwind purge.
// ════════════════════════════════════════════════════════════════════════════

const C = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    amber:   'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    rose:    'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    red:     'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    slate:   'bg-slate-100 text-slate-600 border-slate-200 dark:bg-brand-800 dark:text-brand-300 dark:border-brand-700',
    slateMuted: 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-brand-800/60 dark:text-brand-400 dark:border-brand-700',
    blue:    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    purple:  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
    indigo:  'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
};

const STATUS_MAP = {
    paid:      { label: 'مدفوعة',        cls: C.emerald },
    partial:   { label: 'مدفوعة جزئيًا',  cls: C.amber },
    unpaid:    { label: 'غير مدفوعة',     cls: C.rose },
    overdue:   { label: 'متأخرة',        cls: C.red },
    due:       { label: 'مستحقة',        cls: C.amber },
    pending:   { label: 'معلّقة',         cls: C.amber },
    draft:     { label: 'مسودة',         cls: C.slate },
    posted:    { label: 'مُرحَّل',        cls: C.emerald },
    unposted:  { label: 'غير مُرحَّل',    cls: C.slate },
    cancelled: { label: 'ملغاة',         cls: C.slateMuted },
    void:      { label: 'ملغاة',         cls: C.slateMuted },
    approved:  { label: 'معتمد',         cls: C.emerald },
    rejected:  { label: 'مرفوض',         cls: C.rose },
    open:      { label: 'مفتوح',         cls: C.blue },
    closed:    { label: 'مغلق',          cls: C.slate },
    active:    { label: 'نشط',           cls: C.emerald },
    inactive:  { label: 'غير نشط',       cls: C.slate },
    customer:  { label: 'عميل',          cls: C.purple },
    supplier:  { label: 'مورّد',         cls: C.amber },
    partner:   { label: 'شريك',          cls: C.indigo },
};

export default function StatusPill({ status, label, tone, dot = false, className = '' }) {
    const key = String(status || '').toLowerCase();
    const def = STATUS_MAP[key];
    const cls = tone || def?.cls || C.slate;
    const text = label ?? def?.label ?? (status || '—');
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${cls} ${className}`}>
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
            {text}
        </span>
    );
}
