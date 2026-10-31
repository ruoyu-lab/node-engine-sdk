import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

const coreModules = [
  'protocol',
  'store',
  'semantics',
  'layout',
  'runtime',
  'debug',
  'view',
] as const

type CoreModule = (typeof coreModules)[number]

/** protocol ← store / semantics / layout ← runtime ← debug; view sits on top of the headless modules. */
const allowedDependencies: Record<CoreModule, readonly CoreModule[]> = {
  protocol: [],
  store: ['protocol'],
  semantics: ['protocol'],
  layout: ['protocol'],
  runtime: ['protocol', 'store', 'semantics', 'layout'],
  debug: ['protocol', 'store', 'semantics', 'layout', 'runtime'],
  view: ['protocol', 'store', 'semantics', 'runtime', 'layout'],
}

/**
 * Browser APIs only the `view` module may use. The core tsconfig includes the DOM lib for `view`;
 * this scan keeps every headless module runnable outside a browser.
 */
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLCanvasElement',
  'HTMLInputElement',
  'CanvasRenderingContext2D',
  'PointerEvent',
  'MouseEvent',
  'KeyboardEvent',
  'WheelEvent',
  'FocusEvent',
  'ResizeObserver',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'DOMRect',
]
const domGlobalPattern = new RegExp(`(?<![.\\w$])(?:${domGlobals.join('|')})\\b`, 'u')
const uiFrameworkPattern = /^(?:vue|react|react-dom|preact|svelte|solid-js)(?:\/|$)|^@vue\//u

interface SourceImport {
  file: string
  specifier: string
  target: string
  typeOnly: boolean
}

/**
 * Static `import`/`export ... from` declarations (a declaration may continue on indented lines or
 * lines starting with `}`), side-effect imports, and dynamic imports.
 */
const importPatterns: ReadonlyArray<{
  pattern: RegExp
  typeOnly: (match: RegExpMatchArray) => boolean
}> = [
  {
    pattern: /^(?:import|export)(\s+type)?\b(?:[^'";\n]|\n(?=[\s}]))*?\bfrom\s*['"]([^'"]+)['"]/gmu,
    typeOnly: (match) => match[1] !== undefined,
  },
  { pattern: /^import\s*()['"]([^'"]+)['"]/gmu, typeOnly: () => false },
  { pattern: /\bimport\(\s*()['"]([^'"]+)['"]\s*\)/gu, typeOnly: () => false },
]

const sourceFiles = walk(sourceRoot).filter((file) => file.endsWith('.ts'))
const sourceImports = sourceFiles.flatMap(readImports)

describe('@node-wright/core module boundaries', () => {
  it('places every source file in the root entry or a known domain module', () => {
    for (const file of sourceFiles) {
      const path = toSourcePath(file)

      if (path === 'index.ts') {
        continue
      }

      expect(coreModules, `${path} module`).toContain(path.split('/')[0])
    }

    for (const coreModule of coreModules) {
      expect(existsSync(join(sourceRoot, coreModule, 'index.ts')), `${coreModule} entry`).toBe(true)
    }
  })

  it('uses only relative imports that resolve to source files', () => {
    for (const sourceImport of sourceImports) {
      const location = `${toSourcePath(sourceImport.file)} imports ${sourceImport.specifier}`

      expect(sourceImport.specifier, location).toMatch(/^\.\.?\//u)
      expect(existsSync(sourceImport.target), location).toBe(true)
    }
  })

  it('crosses module boundaries only through module entries', () => {
    for (const sourceImport of crossModuleImports()) {
      expect(
        toSourcePath(sourceImport.target),
        `${toSourcePath(sourceImport.file)} imports ${sourceImport.specifier}`,
      ).toBe(`${getModule(sourceImport.target)}/index.ts`)
    }
  })

  it('follows the protocol ← store/semantics/layout ← runtime ← debug / view direction', () => {
    for (const sourceImport of crossModuleImports()) {
      const from = getModule(sourceImport.file)
      const to = getModule(sourceImport.target)

      expect(
        allowedDependencies[from],
        `${toSourcePath(sourceImport.file)} must not depend on ${to}`,
      ).toContain(to)
    }
  })

  it('keeps the module dependency graph acyclic', () => {
    const graph = new Map<string, Set<string>>(coreModules.map((name) => [name, new Set()]))

    for (const sourceImport of crossModuleImports()) {
      graph.get(getModule(sourceImport.file))?.add(getModule(sourceImport.target))
    }

    expect(findCycles(graph)).toEqual([])
  })

  it('keeps value imports between source files acyclic', () => {
    const graph = new Map<string, Set<string>>(
      sourceFiles.map((file) => [toSourcePath(file), new Set()]),
    )

    for (const sourceImport of sourceImports) {
      if (!sourceImport.typeOnly) {
        graph.get(toSourcePath(sourceImport.file))?.add(toSourcePath(sourceImport.target))
      }
    }

    expect(findCycles(graph)).toEqual([])
  })

  it('restricts browser globals to the view module', () => {
    for (const file of sourceFiles) {
      if (toSourcePath(file).startsWith('view/')) {
        continue
      }

      const source = stripComments(readFileSync(file, 'utf8'))

      expect(source, `${toSourcePath(file)} uses a browser global`).not.toMatch(domGlobalPattern)
    }
  })

  it('never imports a UI framework', () => {
    const specifiers = sourceFiles.flatMap((file) =>
      importPatterns.flatMap(({ pattern }) =>
        [...readFileSync(file, 'utf8').matchAll(pattern)].map((match) => match[2]!),
      ),
    )

    expect(specifiers.filter((specifier) => uiFrameworkPattern.test(specifier))).toEqual([])
  })

  it('exposes protocol and store from the root entry', () => {
    const rootImports = sourceImports.filter(
      (sourceImport) => toSourcePath(sourceImport.file) === 'index.ts',
    )

    expect(rootImports.map((sourceImport) => toSourcePath(sourceImport.target)).sort()).toEqual([
      'protocol/index.ts',
      'store/index.ts',
    ])
  })
})

function crossModuleImports(): SourceImport[] {
  return sourceImports.filter((sourceImport) => {
    const path = toSourcePath(sourceImport.file)

    return path !== 'index.ts' && getModule(sourceImport.file) !== getModule(sourceImport.target)
  })
}

function readImports(file: string): SourceImport[] {
  const source = readFileSync(file, 'utf8')

  return importPatterns.flatMap(({ pattern, typeOnly }) =>
    [...source.matchAll(pattern)].map((match) => {
      const specifier = match[2]!

      return {
        file,
        specifier,
        target: resolve(dirname(file), specifier.replace(/\.js$/u, '.ts')),
        typeOnly: typeOnly(match),
      }
    }),
  )
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/.*$/gmu, '$1')
}

function getModule(file: string): CoreModule {
  const name = toSourcePath(file).split('/')[0]
  const coreModule = coreModules.find((candidate) => candidate === name)

  if (!coreModule) {
    throw new Error(`${toSourcePath(file)} is outside the core domain modules.`)
  }

  return coreModule
}

function findCycles(graph: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const cycles: string[] = []
  const state = new Map<string, 'visiting' | 'done'>()

  for (const start of graph.keys()) {
    if (state.has(start)) {
      continue
    }

    const path: string[] = [start]
    const stack: Array<{ node: string; next: Iterator<string> }> = [
      { node: start, next: (graph.get(start) ?? new Set<string>()).values() },
    ]
    state.set(start, 'visiting')

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!
      const step = frame.next.next()

      if (step.done) {
        state.set(frame.node, 'done')
        stack.pop()
        path.pop()
        continue
      }

      const target = step.value

      if (state.get(target) === 'visiting') {
        cycles.push([...path.slice(path.indexOf(target)), target].join(' -> '))
      } else if (!state.has(target)) {
        state.set(target, 'visiting')
        path.push(target)
        stack.push({ node: target, next: (graph.get(target) ?? new Set<string>()).values() })
      }
    }
  }

  return cycles
}

function toSourcePath(file: string): string {
  return relative(sourceRoot, file).split(sep).join('/')
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)

    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
