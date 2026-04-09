import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import { resolve } from 'pathe'

// Keep server routes enabled by default so /api/* handlers are always built.
// Set FOR_SITES=false only when intentionally creating a client-only build.
const forSites = process.env?.FOR_SITES !== 'false'

const config = defineConfig({
  build: {
    target: 'es2020',
  },
  plugins: [
    tanstackStart(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    forSites &&
      nitroV2Plugin({
        compatibilityDate: '2025-10-08',
        preset: 'node-server',
        scanDirs: ['./server', './src/server'],
        handlers: [
          {
            route: '/api/storage-upload',
            method: 'put',
            handler: resolve('./src/server/api/storage-upload.put.ts'),
          },
          {
            route: '/api/healthz',
            method: 'get',
            handler: resolve('./src/server/api/healthz.get.ts'),
          },
        ],
      }),
    devtoolsJson(),
    viteReact(),
  ],
  optimizeDeps: {
    // TanStack Start resolves these virtual entry imports at runtime.
    // Excluding them avoids Rolldown prebundle resolve errors for #tanstack-* specifiers.
    exclude: [
      '@tanstack/start-server-core',
      '@tanstack/start-client-core',
      '@tanstack/react-start',
      '@tanstack/start',
    ],
  },
  server: {
    host: '::',
    allowedHosts: true,
    hmr: true,
  },
})

export default config
