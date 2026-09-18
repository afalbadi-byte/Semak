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
    // الملفّ بهويّة سماك (الشعار والألوان والتذييل)، والأعمدة المالية أرقامٌ منسّقة تُجمع
    const [{ brandedExcel, SEMAK_THEME }] = await Promise.all([import('../lib/brandedExcel')]);
    const MONEY_KEY = /amount|total|price|balance|paid|vat|tax|cost|debit|credit|subtotal|due|remaining|value/i;
    const list = rows || [];
    const cols = columns.map(c => {
        const money = MONEY_KEY.test(c.key) && list.every(r => { const v = r[c.key]; return v === null || v === undefined || v === '' || Number.isFinite(Number(v)); });
        return { ...c, money };
    });
    const title = String(filename).replace(/[-_]+/g, ' ').trim();
    await brandedExcel({
        title, sheet: sheetName, filename: filename + '_' + dateStamp(),
        meta: [['عدد السجلات', String(list.length)]],
        columns: cols.map(c => ({ label: c.label, type: c.money ? 'money' : 'text', width: c.money ? 15 : Math.min(40, Math.max(12, (c.label || '').length + 6)) })),
        rows: list.map(r => cols.map(c => {
            const raw = r[c.key];
            if (c.money) return raw === null || raw === undefined || raw === '' ? '' : Number(raw);
            const v = c.format ? c.format(raw, r) : raw;
            return v === null || v === undefined ? '' : v;
        })),
    }, SEMAK_THEME);
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
