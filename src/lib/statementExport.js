// ════════════════════════════════════════════════════════════════════════════
//  تصدير كشوف الحساب — وصفٌ واحد، ملفّان
//  ─────────────────────────────────────────────────────────────────────────
//  كل شاشة كشفٍ تصف كشفها مرّةً واحدة:
//    { title, subtitle, filename, meta: [[مفتاح, قيمة]], cards: [[عنوان, قيمة, ذهبي؟]],
//      columns: [{ label, type: 'text'|'money'|'date', width }], rows: [[خلية…]],
//      foot: [خلية…], note, signature }
//  والخلية نصٌّ أو رقم، أو { v, href, b } لرابط مستندٍ أو خطٍّ عريض.
//  ثم: toExcel(وصف) يبني ملف xlsx على الجهاز، وtoPdf(وصف) يطبعه الخادم بترويسة
//  سماك المعتمدة. فيتطابق الملفّان مع الشاشة، في الموقع والتطبيقات معاً.
// ════════════════════════════════════════════════════════════════════════════
import { API_URL, getAdminToken } from './api/client';

const val = c => (c && typeof c === 'object' ? c.v : c);
const num = v => {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
};

// ─── Excel ──────────────────────────────────────────────────────────────────
// ملفٌّ حقيقي لا CSV: الأرقام أرقامٌ تُجمع، والورقة من اليمين، والروابط تُنقر.
export async function toExcel(d) {
    const XLSX = await import('xlsx');                 // تُحمَّل عند الحاجة فقط
    const cols = d.columns || [];
    const aoa = [];
    aoa.push(['سماك العقارية — Semak Real Estate']);
    aoa.push([d.title || 'كشف حساب']);
    if (d.subtitle) aoa.push([d.subtitle]);
    (d.meta || []).forEach(([k, v]) => aoa.push([k, v]));
    aoa.push(['تاريخ الإصدار', new Date().toISOString().slice(0, 10)]);
    if (d.cards && d.cards.length) {
        aoa.push([]);
        d.cards.forEach(([k, v]) => aoa.push([k, num(v) !== null ? num(v) : v]));
    }
    aoa.push([]);
    const headRow = aoa.length;
    aoa.push(cols.map(c => c.label));
    const conv = (c, col) => {
        const v = val(c);
        if (col.type === 'money') { const n = num(v); return n === null ? '' : n; }
        return v === null || v === undefined ? '' : String(v);
    };
    (d.rows || []).forEach(r => aoa.push(cols.map((col, i) => conv(r[i], col))));
    if (d.foot) aoa.push(cols.map((col, i) => conv(d.foot[i], col)));
    if (d.note) { aoa.push([]); aoa.push([d.note]); }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // تنسيق المال، وروابط المستندات
    for (let r = 0; r < aoa.length; r++) {
        for (let ci = 0; ci < (aoa[r] || []).length; ci++) {
            const ref = XLSX.utils.encode_cell({ r, c: ci });
            const cell = ws[ref];
            if (!cell) continue;
            if (cell.t === 'n') cell.z = '#,##0.00';
            const src = r > headRow && r - headRow - 1 < (d.rows || []).length ? d.rows[r - headRow - 1][ci] : null;
            if (src && typeof src === 'object' && src.href) {
                ws[ref] = { t: 's', v: src.v || 'عرض', l: { Target: src.href, Tooltip: 'فتح المستند' } };
            }
        }
    }
    ws['!cols'] = cols.map(c => ({ wch: c.width || (c.type === 'money' ? 14 : c.type === 'date' ? 12 : 28) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headRow, c: 0 }, e: { r: headRow + (d.rows || []).length, c: Math.max(0, cols.length - 1) } }) };
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, cols.length - 1) } }, { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, cols.length - 1) } }];

    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };           // الورقة تبدأ من اليمين
    XLSX.utils.book_append_sheet(wb, ws, (d.sheet || 'كشف الحساب').slice(0, 31));
    XLSX.writeFile(wb, safeName(d.filename || d.title || 'كشف حساب') + '.xlsx');
}

// ─── PDF ────────────────────────────────────────────────────────────────────
// الخادم يبني الصفحة بترويسة سماك، وتُفتح جاهزةً للطباعة أو الحفظ PDF
export async function toPdf(d) {
    const w = window.open('', '_blank');
    if (w) w.document.write('<div dir="rtl" style="font-family:Tahoma;padding:40px;text-align:center">جارٍ تجهيز الكشف…</div>');
    try {
        const t = getAdminToken();
        const res = await fetch(`${API_URL}?action=print_doc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
            body: JSON.stringify(d),
        });
        const html = await res.text();
        if (w) { w.document.open(); w.document.write(html); w.document.close(); try { w.document.title = d.filename || d.title || ''; } catch (e) { /* تجاهل */ } }
        return true;
    } catch (e) {
        if (w) { w.document.open(); w.document.write('<div dir="rtl" style="font-family:Tahoma;padding:40px;text-align:center">تعذّر تجهيز الكشف</div>'); w.document.close(); }
        return false;
    }
}

const safeName = s => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
