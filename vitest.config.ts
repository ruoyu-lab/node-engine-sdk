import { readFileSync, readdirSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

interface PackageManifest {
  name: string
  exports: Record<string, string | { types: string; import: string }>
}

const packagesRoot = new URL('./packages/', import.meta.url)

/**
 * Maps every published `@node-engine-sdk/*` entry, including subpath exports such as
 * `@node-engine-sdk/core/protocol`, to its TypeScript source so tests never depend on build output.
 */
const alias = readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const packageRoot = new URL(`${entry.name}/`, packagesRoot)
    const manifest = JSON.parse(
      readFileSync(new URL('package.json', packageRoot), 'utf8'),
    ) as PackageManifest

    return Object.entries(manifest.exports).flatMap(([subpath, target]) => {
      if (typeof target === 'string') {
        return []
      }

      const source = target.import.replace(/^\.\/dist\//u, './src/').replace(/\.js$/u, '.ts')

      return [
        {
          find: new RegExp(`^${escapeRegExp(`${manifest.name}${subpath.slice(1)}`)}$`, 'u'),
          replacement: decodeURI(new URL(source, packageRoot).pathname),
        },
      ]
    })
  })

/** Editor view tests (core `view` and the UI adapters) need a DOM; everything else runs headless. */
const domTests = [
  'packages/core/test/view/**/*.test.ts',
  'packages/vue/test/**/*.test.ts',
  'packages/react/test/**/*.test.{ts,tsx}',
]

export default defineConfig({
  plugins: [vue()],
  // React adapter sources and tests use the automatic JSX runtime.
  esbuild: { jsx: 'automatic' },
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'headless',
          include: ['packages/*/test/**/*.test.{ts,tsx}', 'playground-shared/test/**/*.test.ts'],
          exclude: domTests,
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: domTests,
          environment: 'happy-dom',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/*/src/**/*.d.ts',
        'packages/{core,presets,react,vue}/src/index.ts',
        'packages/core/src/{protocol,store,semantics,runtime,view}/index.ts',
        'packages/core/src/semantics/rules/index.ts',
        'packages/core/src/view/{dom-model,types}/index.ts',
        'packages/presets/src/nodes/*/index.ts',
        'packages/*/src/types.ts',
        'packages/core/src/*/types.ts',
        'packages/core/src/view/types/**',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 87,
        branches: 78,
        functions: 84,
        lines: 87,
      },
    },
  },
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
