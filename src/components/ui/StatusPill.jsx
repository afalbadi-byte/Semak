import React from 'react';

// ════════════════════════════════════════════════════════════════════════════
//  شارة حالة ملوّنة موحّدة (مدفوعة / متأخرة / معلّقة ...)
//  تقبل مفتاح حالة (إنجليزي) أو نصًّا مخصّصًا. ألوان ثابتة لدعم Tailwind purge.
// ════════════════════════════════════════════════════════════════════════════

const STATUS_MAP = {
    paid:      { label: 'مدفوعة',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    partial:   { label: 'مدفوعة جزئيًا',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    unpaid:    { label: 'غير مدفوعة',     cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    overdue:   { label: 'متأخرة',        cls: 'bg-red-100 text-red-700 border-red-200' },
    due:       { label: 'مستحقة',        cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    pending:   { label: 'معلّقة',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    draft:     { label: 'مسودة',         cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    posted:    { label: 'مُرحَّل',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    unposted:  { label: 'غير مُرحَّل',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    cancelled: { label: 'ملغاة',         cls: 'bg-slate-200 text-slate-500 border-slate-300' },
    void:      { label: 'ملغاة',         cls: 'bg-slate-200 text-slate-500 border-slate-300' },
    approved:  { label: 'معتمد',         cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rejected:  { label: 'مرفوض',         cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    open:      { label: 'مفتوح',         cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    closed:    { label: 'مغلق',          cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    active:    { label: 'نشط',           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inactive:  { label: 'غير نشط',       cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    customer:  { label: 'عميل',          cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    supplier:  { label: 'مورّد',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    partner:   { label: 'شريك',          cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};

export default function StatusPill({ status, label, tone, dot = false, className = '' }) {
    const key = String(status || '').toLowerCase();
    const def = STATUS_MAP[key];
    const cls = tone || def?.cls || 'bg-slate-100 text-slate-600 border-slate-200';
    const text = label ?? def?.label ?? (status || '—');
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${cls} ${className}`}>
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
            {text}
        </span>
    );
}
