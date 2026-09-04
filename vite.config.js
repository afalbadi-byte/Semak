import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        navigateFallbackDenylist: [/^\/share\//, /^\/api\.php/, /\.(pdf|zip|xml|txt)$/i],
        // الهيكل وحده يُنزَّل مقدماً؛ بقية الشاشات تُجلب عند فتحها وتُخزَّن حينها.
        // كان التخزين المسبق يشمل مئتي ملف بثلاثة ميغا فيبطئ أول فتح على الجوال.
        globPatterns: ['index.html', 'registerSW.js', 'assets/index-*.{js,css}', 'images/favicon.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/semak\.sa\/api\.php/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 }
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
