import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const workspaceVersion = '0.1.0-beta.3'
const optionalCoreModules = [
  '@node-wright/core/semantics',
  '@node-wright/core/runtime',
  '@node-wright/core/layout',
  '@node-wright/core/debug',
]
const expectedExports: Record<string, string[]> = {
  core: [
    '.',
    './protocol',
    './store',
    './semantics',
    './runtime',
    './layout',
    './debug',
    './view',
    './view/style.css',
    './package.json',
  ],
  presets: [
    '.',
    './nodes/dataflow',
    './nodes/execflow',
    './nodes/function',
    './nodes/subgraph',
    './package.json',
  ],
  react: ['.', './style.css', './package.json'],
  vue: ['.', './style.css', './package.json'],
}
const uiAdapters = ['react', 'vue']
/** The Vue and React apps and the framework-neutral code they share. */
const playgroundDirectories = ['playground', 'playground-react', 'playground-shared']
const internalImportPattern =
  /(?:\bfrom\s+|\bimport\s+)['"](@node-wright\/[^/'"]+)((?:\/[^'"]+)?)['"]/gu

describe('package boundaries', () => {
  it('publishes exactly the core, presets, react, and vue workspace packages', () => {
    expect(listPackageDirectories().sort()).toEqual(['core', 'presets', 'react', 'vue'])
  })

  it('keeps workspace and internal package versions unified', () => {
    const workspaceManifest = readPackageManifest(repositoryRoot)

    expect(workspaceManifest.version).toBe(workspaceVersion)

    for (const packageName of listPackageDirectories()) {
      const manifest = readPackageManifest(join(repositoryRoot, 'packages', packageName))

      expect(manifest.version, `${packageName} version`).toBe(workspaceVersion)

      for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
        if (dependency.startsWith('@node-wright/')) {
          expect(version, `${packageName} dependency ${dependency}`).toBe(workspaceVersion)
        }
      }
    }
  })

  it('declares exactly the internal packages used by each package source', () => {
    for (const packageName of listPackageDirectories()) {
      const packageRoot = join(repositoryRoot, 'packages', packageName)
      const manifest = readPackageManifest(packageRoot)
      const source = readSourceFiles(join(packageRoot, 'src')).join('\n')
      const importedPackages = new Set<string>()

      for (const match of source.matchAll(internalImportPattern)) {
        importedPackages.add(match[1]!)
      }

      const declaredPackages = Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      }).filter((dependency) => dependency.startsWith('@node-wright/'))

      expect([...declaredPackages].sort(), `${packageName} internal dependencies`).toEqual(
        [...importedPackages].sort(),
      )
    }
  })

  it('keeps publish manifests explicit and side-effect declarations accurate', () => {
    for (const packageName of listPackageDirectories()) {
      const packageRoot = join(repositoryRoot, 'packages', packageName)
      const manifest = readPackageManifest(packageRoot)

      expect(manifest.type, `${packageName} module type`).toBe('module')
      expect(manifest.engines?.node, `${packageName} Node.js support`).toBe('>=20.19.0')
      expect(manifest.files, `${packageName} published files`).toEqual([
        'dist',
        'README.md',
        'LICENSE',
      ])
      expect(manifest.license, `${packageName} license`).toBe('MIT')
      expect(manifest.publishConfig, `${packageName} publish access`).toEqual({ access: 'public' })
      expect(
        readFileSync(join(packageRoot, 'LICENSE'), 'utf8'),
        `${packageName} LICENSE matches the repository LICENSE`,
      ).toBe(readFileSync(join(repositoryRoot, 'LICENSE'), 'utf8'))
      expect(manifest.main, `${packageName} main entry`).toBe('./dist/index.js')
      expect(manifest.module, `${packageName} module entry`).toBe('./dist/index.js')
      expect(manifest.types, `${packageName} type entry`).toBe('./dist/index.d.ts')
      expect(manifest.exports?.['.'], `${packageName} package export`).toEqual({
        types: './dist/index.d.ts',
        import: './dist/index.js',
      })
      expect(manifest.exports?.['./package.json'], `${packageName} manifest export`).toBe(
        './package.json',
      )
      expect(Object.keys(manifest.exports ?? {}), `${packageName} export map`).toEqual(
        expectedExports[packageName],
      )

      for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
        if (typeof target === 'string') {
          continue
        }

        const entry = subpath === '.' ? 'index' : `${subpath.slice(2)}/index`

        expect(target, `${packageName} export ${subpath}`).toEqual({
          types: `./dist/${entry}.d.ts`,
          import: `./dist/${entry}.js`,
        })
        expect(
          existsSync(join(packageRoot, 'src', `${entry}.ts`)),
          `${packageName} export ${subpath} source entry`,
        ).toBe(true)
      }

      if (uiAdapters.includes(packageName)) {
        expect(manifest.sideEffects).toEqual(['./dist/style.css'])
        expect(manifest.exports?.['./style.css']).toBe('./dist/style.css')
      } else if (packageName === 'core') {
        expect(manifest.sideEffects).toEqual(['./dist/view/style.css'])
        expect(manifest.exports?.['./view/style.css']).toBe('./dist/view/style.css')
        expect(existsSync(join(packageRoot, 'src', 'view', 'style.css'))).toBe(true)
      } else {
        expect(manifest.sideEffects, `${packageName} side effects`).toBe(false)
      }
    }
  })

  it('uses NodeNext-safe specifiers in the sources of emitted adapter declarations', () => {
    const vueSourceRoot = join(repositoryRoot, 'packages', 'vue', 'src')
    const publicDeclarationSources = [
      join(vueSourceRoot, 'index.ts'),
      join(vueSourceRoot, 'types.ts'),
      ...walk(join(repositoryRoot, 'packages', 'react', 'src')),
    ]

    for (const file of publicDeclarationSources) {
      const source = readFileSync(file, 'utf8')

      for (const match of source.matchAll(
        /(?:\bfrom\s+|\bexport\s+[^'"\n]+\s+from\s+)['"](\.\.?\/[^'"]+)['"]/gu,
      )) {
        expect(match[1], `${relative(repositoryRoot, file)} relative specifier`).toMatch(
          /\.(?:js|vue)$/u,
        )
      }
    }
  })

  it('keeps the UI adapters on the framework-neutral editor controller and Core free of internal package imports', () => {
    const coreSource = readSourceFiles(join(repositoryRoot, 'packages', 'core', 'src')).join('\n')

    expect(coreSource).not.toMatch(/['"]@node-wright\//u)

    for (const adapter of uiAdapters) {
      const adapterSource = readSourceFiles(join(repositoryRoot, 'packages', adapter, 'src')).join(
        '\n',
      )
      const adapterImports = new Set(
        [...adapterSource.matchAll(internalImportPattern)].map((match) => `${match[1]}${match[2]}`),
      )

      expect([...adapterImports].sort(), `${adapter} imports`).toEqual([
        '@node-wright/core/protocol',
        '@node-wright/core/view',
      ])

      for (const optionalModule of optionalCoreModules) {
        expect(adapterSource, `${adapter} imports ${optionalModule}`).not.toContain(optionalModule)
      }
    }
  })

  it('keeps each UI adapter free of the other UI framework', () => {
    const reactSource = readSourceFiles(join(repositoryRoot, 'packages', 'react', 'src')).join('\n')
    const vueSource = readSourceFiles(join(repositoryRoot, 'packages', 'vue', 'src')).join('\n')

    expect(reactSource).not.toMatch(/['"](?:vue|@vue\/[^'"]+|@node-wright\/vue)['"]/u)
    expect(vueSource).not.toMatch(/['"](?:react|react-dom)(?:\/[^'"]*)?['"]/u)
  })

  it('keeps business AI and HTTP implementations inside the playground', () => {
    const frameworkSource = readdirSync(join(repositoryRoot, 'packages'))
      .flatMap((packageName) =>
        readSourceFiles(join(repositoryRoot, 'packages', packageName, 'src')),
      )
      .join('\n')

    expect(frameworkSource).not.toMatch(/pollinations|ai:image-generate|ai:prompt/iu)
    expect(frameworkSource).not.toMatch(/\bfetch\s*\(/u)
  })

  it('keeps presets framework-neutral so every UI adapter can reuse them', () => {
    const presetsRoot = join(repositoryRoot, 'packages', 'presets')
    const manifest = readPackageManifest(presetsRoot)
    const presetsSource = readSourceFiles(join(presetsRoot, 'src')).join('\n')

    expect(Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })).toEqual([
      '@node-wright/core',
    ])
    expect(presetsSource).not.toMatch(/['"](?:vue|react|@node-wright\/vue)(?:\/[^'"]*)?['"]/u)
  })

  it('keeps standard node systems free of Vue and presets free of Runtime startup', () => {
    const nodesRoot = join(repositoryRoot, 'packages', 'presets', 'src', 'nodes')

    for (const file of walk(nodesRoot).filter((path) => path.endsWith('.ts'))) {
      const source = readFileSync(file, 'utf8')
      const location = relative(repositoryRoot, file)

      expect(source, `${location} imports Vue`).not.toMatch(/['"](?:vue|@node-wright\/vue)['"]/u)

      for (const match of source.matchAll(/\bfrom\s+['"](\.\.?\/[^'"]+)['"]/gu)) {
        expect(
          resolve(dirname(file), match[1]!).startsWith(nodesRoot),
          `${location} imports preset assembly ${match[1]}`,
        ).toBe(true)
      }
    }

    const presetsSource = readSourceFiles(join(repositoryRoot, 'packages', 'presets', 'src')).join(
      '\n',
    )

    expect(presetsSource).not.toMatch(/new\s+NodeWrightRuntime\b/u)
  })

  it('makes the playground consume standard nodes through presets only', () => {
    const playgroundSource = playgroundDirectories
      .flatMap((directory) => readSourceFiles(join(repositoryRoot, directory, 'src')))
      .join('\n')

    expect(playgroundSource).not.toMatch(/from ['"]@node-wright\/presets\/nodes\//u)
  })

  it('keeps the shared playground code framework-neutral and its business code single-sourced', () => {
    const sharedSource = readSourceFiles(join(repositoryRoot, 'playground-shared', 'src')).join(
      '\n',
    )

    expect(sharedSource).not.toMatch(
      /['"](?:vue|react|react-dom|@node-wright\/(?:vue|react))(?:\/[^'"]*)?['"]/u,
    )

    for (const app of ['playground', 'playground-react']) {
      const appSource = readSourceFiles(join(repositoryRoot, app, 'src')).join('\n')

      expect(appSource, `${app} implements business nodes or runtime`).not.toMatch(
        /['"]ai:(?:prompt|image-generate|image-display)['"]|\bfetch\s*\(|new\s+NodeWrightRuntime\b/u,
      )
    }
  })

  it('does not publish placeholder APIs for unimplemented product features', () => {
    const publicFrameworkSource = ['core', 'react', 'vue', 'presets']
      .flatMap((packageName) =>
        readSourceFiles(join(repositoryRoot, 'packages', packageName, 'src')),
      )
      .join('\n')

    expect(publicFrameworkSource).not.toMatch(/\b(?:PersistencePlugin|NodeSearchApi)\b/u)
  })
})

interface PackageManifest {
  version?: string
  type?: string
  sideEffects?: boolean | string[]
  engines?: Record<string, string>
  main?: string
  module?: string
  types?: string
  exports?: Record<string, unknown>
  files?: string[]
  license?: string
  publishConfig?: { access?: string }
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function listPackageDirectories(): string[] {
  return readdirSync(join(repositoryRoot, 'packages')).filter((entry) =>
    statSync(join(repositoryRoot, 'packages', entry)).isDirectory(),
  )
}

function readPackageManifest(packageRoot: string): PackageManifest {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as PackageManifest
}

function readSourceFiles(directory: string): string[] {
  return walk(directory)
    .filter((file) => /\.(?:ts|tsx|vue)$/u.test(file))
    .map((file) => `// ${relative(repositoryRoot, file)}\n${readFileSync(file, 'utf8')}`)
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)

    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
