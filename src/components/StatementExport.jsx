import React, { useState } from 'react';
import { FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import { toExcel, toPdf } from '../lib/statementExport';

// ─── زرّا تصدير الكشف: Excel وPDF ───────────────────────────────────────────
// build() يعيد وصف الكشف كما تعرضه الشاشة؛ وpdf اختياري لمن له نموذج خادمٍ خاص
// (كشف المشروع وكشف المورد يُطبعان من print_report بتفاصيلهما الكاملة).
export default function StatementExport({ build, pdf, variant = 'desktop', disabled, className = '' }) {
    const [busy, setBusy] = useState('');
    const run = async (kind) => {
        if (busy || disabled) return;
        setBusy(kind);
        try {
            if (kind === 'pdf' && pdf) await pdf();
            else { const d = build(); if (d) await (kind === 'xlsx' ? toExcel(d) : toPdf(d)); }
        } finally { setBusy(''); }
    };
    const mobile = variant === 'mobile';
    const base = mobile
        ? 'min-h-[40px] px-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 '
        : 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold transition disabled:opacity-40 ';
    const xls = mobile ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        : 'border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10';
    const pdfc = mobile ? 'bg-white/10 text-white border border-white/15'
        : 'bg-brand-800 text-white hover:bg-brand-900';
    return (
        <div className={'flex items-center gap-2 no-print ' + className}>
            <button type="button" onClick={() => run('xlsx')} disabled={disabled || !!busy} className={base + xls} title="تنزيل ملف Excel">
                {busy === 'xlsx' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
            </button>
            <button type="button" onClick={() => run('pdf')} disabled={disabled || !!busy} className={base + pdfc} title="PDF بترويسة سماك">
                {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF
            </button>
        </div>
    );
}
