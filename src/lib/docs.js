import { API_URL, getAdminToken } from './api/client';

// ─── فتح المستندات ──────────────────────────────────────────────────────────
// الروابط لا تستطيع حمل ترويسة التفويض، فنطلب تذكرة قصيرة العمر ثم نفتح بها.
// عمر الجلسة ثماني ساعات؛ نفحصها هنا لنقول للمستخدم سببا مفهوما لا رسالة خام
function sessionState() {
    const t = getAdminToken();
    if (!t) return 'none';
    try {
        const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (p && p.exp && p.exp * 1000 < Date.now()) return 'expired';
    } catch { /* رمز غير مقروء — ندع الخادم يحكم */ }
    return 'ok';
}

export function sessionMessage() {
    const st = sessionState();
    if (st === 'none')    return 'لم تسجّل الدخول — افتح صفحة الدخول ثم أعد المحاولة';
    if (st === 'expired') return 'انتهت جلستك — سجّل الدخول من جديد ثم أعد المحاولة';
    return null;
}

async function ticket(kind, id, extra) {
    const bad = sessionMessage();
    if (bad) throw new Error(bad);
    const t = getAdminToken();
    const r = await fetch(`${API_URL}?action=doc_ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ kind, id, ...(extra || {}) }),
    }).then(x => x.json());
    if (!r.success) {
        const m = String(r.message || '');
        if (m.includes('تسجيل الدخول') || m.includes('انتهت الجلسة'))
            throw new Error('انتهت جلستك — سجّل الدخول من جديد ثم أعد المحاولة');
        throw new Error(m || 'تعذر فتح المستند');
    }
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

// مستند مستضاف عندنا: استعراض في تبويب أو تنزيل
export async function openDoc(id, view = false) {
    const k = await ticket('get', id);
    go(`${API_URL}?action=doc_get&id=${id}&k=${k}${view ? '&view=1' : ''}`, view);
}

// مرفق دفترة عبر سجل عندنا: استعراض في تبويب أو تنزيل
export async function openDaftraDoc(id, view = false) {
    const k = await ticket('daftra', id);
    go(`${API_URL}?action=doc_daftra&id=${id}&k=${k}${view ? '&view=1' : ''}`, view);
}

// مرفق موجود في دفترة بلا سجل عندنا — نفتحه بمعرّف ملفه مباشرة
export async function openDaftraFile(fileId, view = false) {
    const k = await ticket('daftra', 0, { file_id: fileId });
    go(`${API_URL}?action=doc_daftra&file_id=${fileId}&k=${k}${view ? '&view=1' : ''}`, view);
}

// كل مستندات فاتورة في ملف مضغوط
export async function openDocsZip(purchaseId) {
    const k = await ticket('zip', purchaseId);
    go(`${API_URL}?action=doc_zip&purchase_id=${purchaseId}&k=${k}`, false);
}
