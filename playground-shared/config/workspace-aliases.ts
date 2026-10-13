import type { Alias } from 'vite'

const repositoryRoot = new URL('../../', import.meta.url)

/** Every published workspace entry the playground apps import, resolved to its source file. */
const workspaceSources: Record<string, string> = {
  '@node-engine-sdk/core': 'packages/core/src/index.ts',
  '@node-engine-sdk/core/protocol': 'packages/core/src/protocol/index.ts',
  '@node-engine-sdk/core/store': 'packages/core/src/store/index.ts',
  '@node-engine-sdk/core/semantics': 'packages/core/src/semantics/index.ts',
  '@node-engine-sdk/core/runtime': 'packages/core/src/runtime/index.ts',
  '@node-engine-sdk/core/layout': 'packages/core/src/layout/index.ts',
  '@node-engine-sdk/core/debug': 'packages/core/src/debug/index.ts',
  '@node-engine-sdk/core/view': 'packages/core/src/view/index.ts',
  '@node-engine-sdk/core/view/style.css': 'packages/core/src/view/style.css',
  '@node-engine-sdk/vue': 'packages/vue/src/index.ts',
  // The published Vue stylesheet is the core view stylesheet bundled by the adapter build.
  '@node-engine-sdk/vue/style.css': 'packages/core/src/view/style.css',
  '@node-engine-sdk/react': 'packages/react/src/index.ts',
  // The published React stylesheet is the core view stylesheet bundled by the adapter build.
  '@node-engine-sdk/react/style.css': 'packages/core/src/view/style.css',
  '@node-engine-sdk/presets': 'packages/presets/src/index.ts',
  '@node-engine-sdk/presets/nodes/dataflow': 'packages/presets/src/nodes/dataflow/index.ts',
  '@node-engine-sdk/presets/nodes/execflow': 'packages/presets/src/nodes/execflow/index.ts',
  '@node-engine-sdk/presets/nodes/function': 'packages/presets/src/nodes/function/index.ts',
  '@node-engine-sdk/presets/nodes/subgraph': 'packages/presets/src/nodes/subgraph/index.ts',
}

/**
 * Each app keeps its own dependency optimizer cache: both apps resolve to the workspace
 * `node_modules`, and dev servers sharing one cache invalidate each other's optimized deps.
 */
export function playgroundCacheDir(app: string): string {
  return resolveRepositoryPath(`node_modules/.vite/${app}`)
}

function resolveRepositoryPath(path: string): string {
  return decodeURI(new URL(path, repositoryRoot).pathname)
}

/**
 * Vite aliases of both playground apps: workspace packages resolve to their TypeScript sources
 * during development and builds, and `@playground/shared/*` to the framework-neutral app code.
 */
export const playgroundAliases: Alias[] = [
  ...Object.entries(workspaceSources).map(([specifier, source]) => ({
    find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')}$`, 'u'),
    replacement: resolveRepositoryPath(source),
  })),
  {
    find: /^@playground\/shared\//u,
    replacement: resolveRepositoryPath('playground-shared/src/'),
  },
]
