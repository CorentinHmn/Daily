/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in Paramètres, to tell which version a phone runs (Vercel gives the commit; locally, git).
const commit = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

// The site for Vercel (dist/), split into cacheable files, with a service worker so the iPhone home-screen app opens
// offline (the network-only Supabase calls are never cached).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in main.tsx (update checks, reload)
      manifest: false, // public/manifest.webmanifest, linked from index.html
      workbox: {
        // The page itself is not precached (a precached page opened first in its old version, the new one only after a
        // reload): online it always comes from the network, the copy kept below only serves offline.
        globPatterns: ['**/*.{js,css,woff2,png,svg,webp,ico,webmanifest}'],
        // The ten background photos (2 MB together) are not all fetched up front: each one is kept once shown.
        globIgnores: ['backdrop/**'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 8 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/backdrop/'),
            handler: 'CacheFirst',
            options: { cacheName: 'backdrops', expiration: { maxEntries: 48 } },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(commit), __APP_BUILT__: JSON.stringify(new Date().toISOString()) },
  server: { port: 5320 },
  preview: { port: 4320 },
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['src/**/*.test.ts'] },
});
