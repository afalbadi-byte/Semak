// مرسِل إشعارات ألواح: يقرأ ما يجب إرساله من الخادم ويدفعه إلى أجهزة المشتركين.
// يعمل من GitHub Actions في مواعيد محدّدة، فتصل الإشعارات ولو كان التطبيق مغلقاً.
import webpush from 'web-push';

const API = process.env.ALWAH_API || 'https://alwah.semak.sa/api.php';
const KEY = process.env.PUSH_KEY, PUB = process.env.VAPID_PUBLIC, PRIV = process.env.VAPID_PRIVATE;
const SLOT = process.env.SLOT || (new Date().getUTCHours() < 16 ? 'morning' : 'evening');
if (!KEY || !PUB || !PRIV) { console.error('مفاتيح ناقصة'); process.exit(1); }

webpush.setVapidDetails('mailto:a.f.albadi@gmail.com', PUB, PRIV);

const due = await (await fetch(`${API}?action=push_due&slot=${SLOT}&key=${encodeURIComponent(KEY)}`)).json();
if (!due.success) { console.error('تعذّر الجلب:', due.message); process.exit(1); }
console.log(SLOT, '— اشتراكات:', due.data.length);

const gone = [], failed = [];
let sent = 0;
for (const x of due.data) {
    const sub = { endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } };
    const payload = JSON.stringify({ title: x.title, body: x.body, url: x.url, tag: x.tag });
    try { await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' }); sent++; }
    catch (e) {
        const c = e.statusCode || 0;
        if (c === 404 || c === 410) gone.push(x.id); else failed.push(x.id);
        console.error('فشل', x.id, c, (e.body || '').toString().slice(0, 120));
    }
}
console.log('أُرسل:', sent, '· منتهية:', gone.length, '· فشل:', failed.length);
if (gone.length || failed.length) {
    await fetch(`${API}?action=push_result&key=${encodeURIComponent(KEY)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gone, failed }),
    });
}
