import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022',
    outDir: resolve(packageRoot, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(packageRoot, 'config/bundle-entry.ts'),
      name: 'NodeEngineVue',
      cssFileName: 'style',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      // Core modules stay external; the shared core stylesheet is bundled into `style.css`.
      external: (id) =>
        id === 'vue' || (/^@node-engine-sdk\/core(?:\/|$)/u.test(id) && !id.endsWith('.css')),
    },
  },
})
