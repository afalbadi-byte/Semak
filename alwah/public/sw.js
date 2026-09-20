// عامل خدمة ألواح: للإشعارات وحدها (لا تخزين للصفحات)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
    const title = d.title || 'ألواح';
    e.waitUntil(self.registration.showNotification(title, {
        body: d.body || '',
        icon: './icon-192.png',
        badge: './icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: d.tag || 'alwah',
        renotify: true,
        data: { url: d.url || './' },
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.url) || './';
    e.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) if ('focus' in c) { c.navigate(new URL(url, self.registration.scope).href); return c.focus(); }
        return self.clients.openWindow(new URL(url, self.registration.scope).href);
    })());
});
