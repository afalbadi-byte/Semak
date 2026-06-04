// ─── أدوات التصدير المشتركة (Excel / CSV) ────────────────────────────────────
// تُستخدم في كل صفحات القوائم. تحترم البيانات الممرّرة (المفلترة حاليًا).
// ملاحظة: مكتبة xlsx تُحمّل ديناميكيًا عند الطلب فقط (lazy) لتقليل حجم الحزمة.

/**
 * تصدير مصفوفة كائنات إلى ملف Excel (.xlsx).
 * @param {Array<Object>} rows  الصفوف (بعد الفلترة).
 * @param {Array<{key:string,label:string,format?:Function}>} columns  تعريف الأعمدة.
 * @param {string} filename  اسم الملف بدون امتداد.
 * @param {string} sheetName اسم ورقة العمل.
 */
export async function exportToExcel(rows, columns, filename = 'export', sheetName = 'البيانات') {
    const XLSX = await import('xlsx');
    const data = (rows || []).map(r => {
        const o = {};
        columns.forEach(c => {
            const raw = r[c.key];
            o[c.label] = c.format ? c.format(raw, r) : (raw ?? '');
        });
        return o;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.label) });
    // عرض الأعمدة تلقائيًا
    ws['!cols'] = columns.map(c => ({ wch: Math.max(12, (c.label || '').length + 4) }));
    // اتجاه الورقة RTL
    ws['!dir'] = 'rtl';
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${dateStamp()}.xlsx`);
}

/**
 * تصدير إلى CSV (مع BOM لدعم العربية في Excel).
 */
export function exportToCSV(rows, columns, filename = 'export') {
    const header = columns.map(c => csvCell(c.label)).join(',');
    const lines = (rows || []).map(r =>
        columns.map(c => {
            const raw = r[c.key];
            return csvCell(c.format ? c.format(raw, r) : (raw ?? ''));
        }).join(',')
    );
    const csv = '﻿' + [header, ...lines].join('\r\n'); // BOM
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${filename}_${dateStamp()}.csv`);
}

function csvCell(v) {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** تنسيقات جاهزة للأعمدة */
export const fmt = {
    money: (v) => v != null && v !== '' ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '',
    int:   (v) => v != null && v !== '' ? Number(v).toLocaleString('en-US') : '',
    date:  (v) => v || '',
};
