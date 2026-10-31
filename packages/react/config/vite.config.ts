import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig({
  // esbuild compiles JSX with the automatic runtime; no Babel-based React plugin is needed.
  esbuild: { jsx: 'automatic' },
  build: {
    target: 'es2022',
    outDir: resolve(packageRoot, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(packageRoot, 'config/bundle-entry.ts'),
      name: 'NodeWrightReact',
      cssFileName: 'style',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      // React and core modules stay external; the shared core stylesheet is bundled into `style.css`.
      external: (id) =>
        /^react(?:-dom)?(?:\/|$)/u.test(id) ||
        (/^@node-wright\/core(?:\/|$)/u.test(id) && !id.endsWith('.css')),
    },
  },
})
