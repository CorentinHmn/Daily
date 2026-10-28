/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

// Two builds:
//  - default: ONE self-contained HTML file (JS, CSS and Poppins inlined) for the desktop app (file://) — dist/;
//  - `--mode web`: the site for Vercel, split into cacheable files, with a service worker so the iPhone home-screen
//    app opens offline (the network-only Supabase calls are never cached) — dist-web/.
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  return {
    base: web ? '/' : './',
    plugins: [
      react(),
      tailwindcss(),
      web
        ? VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: false, // public/manifest.webmanifest, linked from index.html
            workbox: {
              globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
              navigateFallback: '/index.html',
              cleanupOutdatedCaches: true,
            },
          })
        : viteSingleFile({ removeViteModuleLoader: true }),
    ],
    server: { port: 5320 },
    build: web
      ? { outDir: 'dist-web', emptyOutDir: true, chunkSizeWarningLimit: 1500 }
      : { assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
    test: { include: ['src/**/*.test.ts'] },
  };
});
