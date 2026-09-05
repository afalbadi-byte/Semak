import { API_URL, getAdminToken } from './api/client';

// ─── فتح المستندات ──────────────────────────────────────────────────────────
// الروابط لا تستطيع حمل ترويسة التفويض، فنطلب تذكرة قصيرة العمر ثم نفتح بها.
async function ticket(kind, id) {
    const t = getAdminToken();
    const r = await fetch(`${API_URL}?action=doc_ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ kind, id }),
    }).then(x => x.json());
    if (!r.success) throw new Error(r.message || 'تعذر فتح المستند');
    return r.k;
}

const go = (url, newTab) => {
    if (newTab) {
        const w = window.open(url, '_blank', 'noopener');
        if (!w) window.location.href = url;      // المتصفح منع النافذة
    } else {
        window.location.href = url;
    }
};

// تنزيل مستند مستضاف عندنا
export async function openDoc(id) {
    const k = await ticket('get', id);
    go(`${API_URL}?action=doc_get&id=${id}&k=${k}`, false);
}

// مرفق دفترة: استعراض في تبويب أو تنزيل
export async function openDaftraDoc(id, view = false) {
    const k = await ticket('daftra', id);
    go(`${API_URL}?action=doc_daftra&id=${id}&k=${k}${view ? '&view=1' : ''}`, view);
}

// كل مستندات فاتورة في ملف مضغوط
export async function openDocsZip(purchaseId) {
    const k = await ticket('zip', purchaseId);
    go(`${API_URL}?action=doc_zip&purchase_id=${purchaseId}&k=${k}`, false);
}
