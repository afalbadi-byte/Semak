import { API_URL, getAdminToken } from './api/client';

// ─── جلب بيانات دفترة عند فتح التطبيق ───────────────────────────────────────
// خفيفة: أحدث صفحة فقط، والخادم يخنق التكرار خلال دقيقتين.
let inflight = null;

export function syncDaftra({ force = false } = {}) {
    if (inflight) return inflight;
    const t = getAdminToken();
    inflight = fetch(`${API_URL}?action=dmirror_sync_lite&limit=40${force ? '&force=1' : ''}`,
        { headers: t ? { Authorization: `Bearer ${t}` } : {} })
        .then(r => r.json())
        .catch(() => ({ success: false }))
        .finally(() => { inflight = null; });
    return inflight;
}

// حالة آخر مزامنة لعرضها للمستخدم
export async function syncStatus() {
    try {
        const r = await fetch(`${API_URL}?action=dmirror_status`).then(x => x.json());
        return r && r.success ? r : null;
    } catch { return null; }
}
