/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ : BASE_PATH est fourni par la GitHub Action.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'SearchL1',
        short_name: 'SearchL1',
        description: 'Stats de Ligue 1 pour choisir ses joueurs au Championnat des Étoiles',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ECEFEA',
        theme_color: '#ECEFEA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // Données : réseau d'abord (pour avoir la dernière mise à jour), cache si hors ligne ou réseau trop lent.
        runtimeCaching: [
          { urlPattern: /\/data\/.*\.json$/, handler: 'NetworkFirst', options: { cacheName: 'donnees', networkTimeoutSeconds: 6 } },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
