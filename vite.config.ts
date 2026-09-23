import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/bullet-journal/',
  build: {
    // Firebase se carga después de que la interfaz local esté lista, así que su chunk async puede ser mayor.
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Koyomi — Bullet journal',
        short_name: 'Koyomi',
        description: 'Tu bullet journal personal: tareas por día, mes, trimestre y año.',
        theme_color: '#24304d',
        background_color: '#f7f4ed',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/bullet-journal/',
        scope: '/bullet-journal/',
        lang: 'es',
        categories: ['productivity', 'lifestyle'],
        icons: [
          {
            src: '/bullet-journal/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
