import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url))
const fixturePath = fileURLToPath(new URL('./event-listener.fixture.ts', import.meta.url))

/**
 * Type-level contract of `onEvent`. Every line must type-check, and every `@ts-expect-error` line
 * must fail; TypeScript reports an unused `@ts-expect-error` as an error itself.
 */
const fixture = `
import type { GraphSnapshot } from '@node-wright/core/protocol'
import type {
  NodeWrightEditorOptions,
  NodeWrightEventListener,
  NodeWrightEventName,
  NodeWrightEventSink,
  SelectionState,
  ViewportState,
} from '@node-wright/core/view'

declare const graph: GraphSnapshot
declare const selection: SelectionState
declare const viewport: ViewportState

export const withoutParameters: NodeWrightEditorOptions = { onEvent: () => undefined }
export const nameOnly: NodeWrightEditorOptions = {
  onEvent: (name) => {
    const event: NodeWrightEventName = name
    void event
  },
}
export const firstPayload: NodeWrightEditorOptions = { onEvent: (name, payload) => void [name, payload] }
export const everyPayload: NodeWrightEditorOptions = { onEvent: (name, ...args) => void [name, args] }

declare const sink: NodeWrightEventSink
export const forwardingSink: NodeWrightEventListener = sink

export const notAnyName: NodeWrightEditorOptions = {
  onEvent: (name) => {
    // @ts-expect-error the listener receives event names
    const count: number = name
    void count
  },
}

declare const listener: NodeWrightEventListener
listener('graph-change', graph)
listener('selection-change', selection, graph)
listener('selection-change', selection, graph, 'api')
listener('viewport-change', viewport)
// @ts-expect-error the payload of another event
listener('graph-change', selection)
// @ts-expect-error a missing payload
listener('graph-change')
// @ts-expect-error an unknown event
listener('graph-changed', graph)
`

function typeCheckFixture(): string[] {
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    baseUrl: sourceRoot,
    paths: {
      '@node-wright/core/protocol': ['protocol/index.ts'],
      '@node-wright/core/view': ['view/index.ts'],
    },
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)

  host.getSourceFile = (fileName, languageVersion, ...rest) =>
    fileName === fixturePath
      ? ts.createSourceFile(fileName, fixture, languageVersion)
      : getSourceFile(fileName, languageVersion, ...rest)
  host.fileExists = (
    (fileExists) => (fileName: string) =>
      fileName === fixturePath || fileExists(fileName)
  )(host.fileExists.bind(host))

  const program = ts.createProgram([fixturePath], options, host)

  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile(fixturePath))
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

describe('onEvent listener type', () => {
  it('accepts listeners with fewer parameters and keeps every event payload checked', () => {
    expect(typeCheckFixture()).toEqual([])
  }, 60_000)
})
