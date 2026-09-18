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
import { brandedExcel, SEMAK_THEME } from './brandedExcel';


// ─── Excel ──────────────────────────────────────────────────────────────────
// ملفٌّ بهويّة سماك: الشعار وشريط الألوان والبطاقات والتوقيع، والأرقام تُجمع والروابط تُنقر.
export async function toExcel(d) {
    return brandedExcel(d, SEMAK_THEME);
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
