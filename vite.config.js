import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // اسم جديد لعامل الخدمة: النسخة القديمة محبوسة في كاش الحافة أسبوعا
      // وتظل تخدم تطبيقا قديما، والرابط الجديد يتجاوزها فورا.
      filename: 'service-worker.js',
      injectRegister: null,
      includeAssets: ['images/favicon.png', 'images/logo-main.png'],
      manifest: {
        name: 'سماك العقارية',
        short_name: 'سماك',
        description: 'سقف يعلو برؤيتك، ومسكن يحكي قصتك',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#1a365d',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/images/favicon.png', sizes: 'any', type: 'image/png', purpose: 'any maskable' },
          { src: '/images/logo-main.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // استثناء مسارات المشاركة/الملفات المرفوعة يدوياً من إعادة توجيه SPA (حتى تفتح مباشرةً)
        // نطاقات التطبيقات تُستثنى: كان عامل الخدمة يقدّم index.html الجذر لكل تنقّل،
        // فلا تصل ‎/buy/index.html أبدا — ومعها بطاقة التعريف الصحيحة و og:url.
        navigateFallbackDenylist: [/^\/share\//, /^\/api\.php/, /\.(pdf|zip|xml|txt)$/i, /^\/(buy|proj|qc)(\/|$)/],
        // الهيكل وحده يُنزَّل مقدماً؛ بقية الشاشات تُجلب عند فتحها وتُخزَّن حينها.
        // كان التخزين المسبق يشمل مئتي ملف بثلاثة ميغا فيبطئ أول فتح على الجوال.
        globPatterns: ['index.html', 'registerSW.js', 'assets/index-*.{js,css}', 'images/favicon.png'],
        // صفحات التطبيقات تُبنى بعد vite فلا يلتقطها التخزين المسبق —
        // يغطّيها runtimeCaching أدناه بعد أول فتح.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // بعد استثنائها من إعادة التوجيه تحتاج كاشها الخاص لتفتح دون شبكة
            urlPattern: /^https:\/\/semak\.sa\/(buy|proj|qc)(\/|$)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell', networkTimeoutSeconds: 5 },
          },
          {
            // القراءات وحدها تُخزَّن. النداءات التي تكتب أو تطول (سحب المرفقات،
            // المزامنة، قراءة الفاتورة والإيصال) تتجاوز الكاش — وإلا انتهت المهلة
            // فعُرض ردٌّ قديم محفوظ وبدا كأنه فشلٌ حاضر.
            urlPattern: /^https:\/\/semak\.sa\/api\.php\?(?!.*action=(daftra_doc_archive|daftra_save_cookie|daftra_link_status|daftra_doc_|dmirror_sync|purchase_create|purchase_update|purchase_delete|sup_pay_|sup_advance_|invoice_scan|receipt_scan|doc_))/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 30 }
          },
          {
            // شاشات التطبيق تُخزَّن أول ما تُفتح فتصير فورية بعدها
            urlPattern: /\/assets\/.+\.(js|css|woff2)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets-cache', expiration: { maxEntries: 220, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /\/images\/.+\.(jpg|png)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'images-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ],
})
