import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const root = process.cwd()
const packagesDir = join(root, 'packages')
const packedDir = join(root, 'packed')
const consumersDir = await mkdtemp(join(tmpdir(), 'node-wright-consumer-'))

/** The lowest React major allowed by the `@node-wright/react` peer ranges. */
const react18Dependencies = {
  react: '~18.3.1',
  'react-dom': '~18.3.1',
  '@types/react': '^18.3.0',
}

/** Editor controller options under strict NodeNext resolution. */
const coreTypedUsageSource = `
import type { NodeWrightEditorOptions } from '@node-wright/core/view'

const editorOptions: NodeWrightEditorOptions = {
  onEvent: (name) => void name,
}

void editorOptions
`

/** Props, ref and render-prop types of the React adapter under strict NodeNext resolution. */
const reactTypedUsageSource = `
import type { NodeWrightHandle, NodeWrightProps } from '@node-wright/react'

const reactProps: NodeWrightProps = {
  onGraphChange: (graph) => void graph.nodes,
  onSelectionChange: (selection, graph, source) => void [selection.nodes, graph.edges, source],
  renderOverlay: ({ api, contextMenuState }) => (contextMenuState ? api.graph.get().nodes.length : null),
}
const reactHandle: NodeWrightHandle | null = null

void reactProps
void reactHandle
`

/** Server-renders the React adapter and fails on any React warning. */
const reactServerRenderSource = `
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } from '@node-wright/core/protocol'
import { NodeWright } from '@node-wright/react'

const reported = []
const reportError = console.error
console.error = (...args) => {
  reported.push(args.map(String).join(' '))
  reportError(...args)
}

const html = renderToString(
  createElement(NodeWright, {
    graph: { schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION, nodes: [], edges: [], groups: [], meta: {} },
    ariaLabel: 'Packed editor',
  }),
)

if (!html.includes('nw-root') || !html.includes('aria-label="Packed editor"')) {
  throw new Error('@node-wright/react did not render the NodeWright root element.')
}

if (reported.length) {
  throw new Error('@node-wright/react reported errors while rendering on the server.')
}
`

try {
  const packages = await readWorkspacePackages()
  const archives = await readPackageArchives(packages)

  // Every package, with the newest versions its peer ranges allow.
  const consumerDir = join(consumersDir, 'latest')

  await createConsumerPackage(consumerDir, archives, collectExternalPeerDependencies(packages))
  installConsumerDependencies(consumerDir)
  await validateInstalledManifests(consumerDir, packages)
  await runConsumerTypeChecks(consumerDir, packages)
  await runConsumerChecks(consumerDir, packages)

  // The React adapter on React 18.
  const reactArchives = archives.filter(
    (archive) =>
      archive.package.name === '@node-wright/core' || archive.package.name === '@node-wright/react',
  )
  const react18Dir = join(consumersDir, 'react-18')

  await createConsumerPackage(react18Dir, reactArchives, react18Dependencies)
  installConsumerDependencies(react18Dir)
  await runConsumerTypeChecks(
    react18Dir,
    reactArchives.map((archive) => archive.package),
  )
  await runScript(react18Dir, 'verify-react.mjs', reactServerRenderSource)
  validateArchiveContents(archives)

  console.log(
    `Verified ${packages.length} packed package(s) in an isolated consumer, and the React adapter on React 18.`,
  )
} finally {
  await rm(consumersDir, { recursive: true, force: true })
}

async function readWorkspacePackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const packages = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const manifestPath = join(packagesDir, entry.name, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

    if (manifest.private === true) {
      continue
    }

    packages.push({
      name: manifest.name,
      version: manifest.version,
      peerDependencies: manifest.peerDependencies ?? {},
      moduleSpecifiers: listModuleSpecifiers(manifest),
    })
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name))
}

function listModuleSpecifiers(manifest) {
  return Object.entries(manifest.exports)
    .filter(([, target]) => typeof target === 'object' && target !== null)
    .map(([subpath]) => `${manifest.name}${subpath.slice(1)}`)
}

async function readPackageArchives(packages) {
  const entries = await readdir(packedDir, { withFileTypes: true })
  const archiveNames = new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
      .map((entry) => entry.name),
  )

  if (archiveNames.size !== packages.length) {
    throw new Error(
      `Expected ${packages.length} package archive(s), found ${archiveNames.size}. Run npm run pack:all first.`,
    )
  }

  return packages.map((pkg) => {
    const archiveName = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`

    if (!archiveNames.has(archiveName)) {
      throw new Error(`Missing packed archive for ${pkg.name}: ${archiveName}`)
    }

    return { package: pkg, path: join(packedDir, archiveName) }
  })
}

function validateArchiveContents(archives) {
  for (const archive of archives) {
    const result = run('tar', ['-tf', archive.path], { capture: true })
    const entries = result.stdout.split('\n').filter(Boolean)
    const buildInfo = entries.find((entry) => entry.endsWith('.tsbuildinfo'))
    const unexpectedEntry = entries.find((entry) => {
      const path = entry.replace(/^package\/?/u, '')

      return (
        path &&
        path !== 'package.json' &&
        path !== 'README.md' &&
        path !== 'LICENSE' &&
        !path.startsWith('dist/')
      )
    })

    if (buildInfo) {
      throw new Error(`${basename(archive.path)} contains build metadata: ${buildInfo}`)
    }

    if (unexpectedEntry) {
      throw new Error(`${basename(archive.path)} contains an unexpected file: ${unexpectedEntry}`)
    }

    if (!entries.includes('package/LICENSE')) {
      throw new Error(`${basename(archive.path)} is missing the LICENSE file`)
    }
  }
}

async function createConsumerPackage(consumerDir, archives, externalDependencies) {
  const packageDependencies = Object.fromEntries(
    archives.map((archive) => [archive.package.name, `file:${archive.path}`]),
  )
  const dependencies = {
    ...externalDependencies,
    ...packageDependencies,
  }
  const manifest = {
    name: 'node-wright-packed-consumer',
    private: true,
    type: 'module',
    dependencies,
  }

  await mkdir(consumerDir)
  await writeFile(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

function collectExternalPeerDependencies(packages) {
  const workspaceNames = new Set(packages.map((pkg) => pkg.name))
  const peers = {}

  for (const pkg of packages) {
    for (const [name, version] of Object.entries(pkg.peerDependencies)) {
      if (workspaceNames.has(name)) {
        continue
      }

      if (peers[name] && peers[name] !== version) {
        throw new Error(
          `Conflicting peer dependency ranges for ${name}: ${peers[name]} and ${version}`,
        )
      }

      peers[name] = version
    }
  }

  return peers
}

function installConsumerDependencies(consumerDir) {
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumerDir })
}

async function validateInstalledManifests(consumerDir, packages) {
  for (const pkg of packages) {
    const packageDir = join(consumerDir, 'node_modules', ...pkg.name.split('/'))
    const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
    const targets = [manifest.main, manifest.module, manifest.types]

    collectExportTargets(manifest.exports, targets)

    for (const target of new Set(targets.filter(Boolean))) {
      if (typeof target !== 'string' || !target.startsWith('./')) {
        throw new Error(`${pkg.name} contains an invalid package target: ${String(target)}`)
      }

      await access(join(packageDir, target))
    }
  }
}

function collectExportTargets(value, targets) {
  if (typeof value === 'string') {
    targets.push(value)
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const entry of Object.values(value)) {
    collectExportTargets(entry, targets)
  }
}

async function runConsumerTypeChecks(consumerDir, packages) {
  const specifiers = packages.flatMap((pkg) => pkg.moduleSpecifiers)
  const imports = specifiers
    .map((specifier, index) => `import * as packageModule${index} from '${specifier}'`)
    .join('\n')
  const usages = specifiers.map((_, index) => `void packageModule${index}`).join('\n')
  const typedUsages = [
    coreTypedUsageSource,
    packages.some((pkg) => pkg.name === '@node-wright/react') ? reactTypedUsageSource : '',
  ].join('\n')
  const source = `${imports}\n\n${usages}\n${typedUsages}`
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ['./verify-types.ts'],
  }

  await writeFile(join(consumerDir, 'verify-types.ts'), source, 'utf8')
  await writeFile(
    join(consumerDir, 'tsconfig.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
  run(
    process.execPath,
    [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'],
    { cwd: consumerDir },
  )
}

async function runConsumerChecks(consumerDir, packages) {
  const specifiers = packages.flatMap((pkg) => pkg.moduleSpecifiers)
  const source = `
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

const specifiers = ${JSON.stringify(specifiers)}

for (const specifier of specifiers) {
  await import(specifier)
}

const { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } = await import('@node-wright/core/protocol')
const { NodeWright } = await import('@node-wright/vue')

if (!NodeWright) {
  throw new Error('@node-wright/vue does not export NodeWright.')
}

const graph = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  groups: [],
  meta: {},
}
const app = createSSRApp({
  render: () => h(NodeWright, { graph }),
})
const html = await renderToString(app)

if (!html.includes('nw-root')) {
  throw new Error('@node-wright/vue did not render the NodeWright root element.')
}
`

  await runScript(consumerDir, 'verify.mjs', source)
  await runScript(consumerDir, 'verify-react.mjs', reactServerRenderSource)
}

async function runScript(consumerDir, fileName, source) {
  const scriptPath = join(consumerDir, fileName)

  await writeFile(scriptPath, source.trimStart(), 'utf8')
  run(process.execPath, [scriptPath], { cwd: consumerDir })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  })

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`)
  }

  return result
}
