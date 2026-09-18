// ─── مُفكِّك عامل الخدمة القديم ────────────────────────────────────────────
// كان عامل الخدمة يُنشر باسم /sw.js، ثم صار /service-worker.js. الأجهزة التي
// ثبّتت الموقع قبل التغيير بقيت على القديم: يطلب تحديثه من /sw.js فيجده كما هو،
// فيظل يقدّم نسخةً محفوظة قديمة من الموقع لا تعرف التطبيقات الأحدث
// (فعلق تطبيق الاجتماعات على شاشة البداية).
// هذا الملف يحلّ محلّه على تلك الأجهزة فقط: يمسح كاشه، ويلغي تسجيله،
// ويعيد تحميل الصفحات المفتوحة لتأخذ الموقع الحالي وعامل خدمته الجديد.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => { try { c.navigate(c.url); } catch (e) { /* تجاهل */ } });
  })());
});
