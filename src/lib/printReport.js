// فتح نموذج طباعة بهوية سماك — الخادم يبني الصفحة بترويسة عرض السعر والعقد نفسها.
// الرمز يُرسل في الترويسة لا في الرابط، والصفحة تُكتب في تبويب جديد جاهزة للطباعة أو حفظ PDF.
import { API_URL, getAdminToken } from './api/client';

export async function openPrintReport(type, params = {}) {
    const q = new URLSearchParams({ action: 'print_report', type });
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    // النافذة تُفتح قبل الانتظار حتى لا يحجبها المتصفح
    const w = window.open('', '_blank');
    if (w) w.document.write('<div dir="rtl" style="font-family:Tahoma;padding:40px;text-align:center">جارٍ تجهيز النموذج…</div>');
    try {
        const token = getAdminToken();
        const res = await fetch(`${API_URL}?${q}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const html = await res.text();
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
        return true;
    } catch (e) {
        if (w) { w.document.open(); w.document.write('<div dir="rtl" style="font-family:Tahoma;padding:40px;text-align:center">تعذّر تجهيز النموذج</div>'); w.document.close(); }
        return false;
    }
}

export default openPrintReport;
