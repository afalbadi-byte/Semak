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
        globPatterns: ['**/*.{js,css,html,woff2}', 'images/logo-*.{png,jpg}', 'images/favicon.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/semak\.sa\/api\.php/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 }
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
