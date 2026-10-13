import { defineConfig } from 'vite'
import { resolvePlaygroundSite } from '../../playground-shared/config/pages-site'
import {
  playgroundAliases,
  playgroundCacheDir,
} from '../../playground-shared/config/workspace-aliases'

const site = resolvePlaygroundSite('react', process.env.PAGES_BASE)

export default defineConfig({
  base: site.base,
  define: {
    __PLAYGROUND_COMPANION__: JSON.stringify(site.companion),
  },
  cacheDir: playgroundCacheDir('playground-react'),
  // esbuild compiles JSX with the automatic runtime, like the React adapter build.
  esbuild: { jsx: 'automatic' },
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: playgroundAliases,
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
  },
})
