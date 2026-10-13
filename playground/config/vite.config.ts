import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolvePlaygroundSite } from '../../playground-shared/config/pages-site'
import {
  playgroundAliases,
  playgroundCacheDir,
} from '../../playground-shared/config/workspace-aliases'

const site = resolvePlaygroundSite('vue', process.env.PAGES_BASE)

export default defineConfig({
  base: site.base,
  define: {
    __PLAYGROUND_COMPANION__: JSON.stringify(site.companion),
  },
  cacheDir: playgroundCacheDir('playground-vue'),
  plugins: [vue()],
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: playgroundAliases,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
})
