import { describe, expect, it, vi } from 'vitest'
import {
  GraphParseError,
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  parseGraph,
  repairGraph,
  validateGraph,
  type ConnectionContext,
  type GraphSnapshot,
} from '@node-wright/core/protocol'
import { GraphStore } from '@node-wright/core/store'
import {
  createHybridFlowPlugin,
  defineConnectionRule,
  type SemanticNodeDefinition,
} from '@node-wright/core/semantics'

const nodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: 'step',
    ports: [
      { id: 'in', direction: 'input', kind: 'exec' },
      { id: 'then', direction: 'output', kind: 'exec' },
      { id: 'value', direction: 'input' },
      { id: 'result', direction: 'output' },
    ],
  },
]

function createGraph(edges: GraphSnapshot['edges'] = []): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'a', type: 'step', x: 0, y: 0 },
      { id: 'b', type: 'step', x: 200, y: 0 },
      { id: 'c', type: 'step', x: 400, y: 0 },
    ],
    edges,
    groups: [],
    meta: {},
  }
}

describe('edge kind', () => {
  it('is required by the protocol and must be the kind of the source port', () => {
    const edge = {
      id: 'e',
      source: { nodeId: 'a', portId: 'then' },
      target: { nodeId: 'b', portId: 'in' },
    }

    expect(() => parseGraph({ ...createGraph(), edges: [edge] }, { nodeDefinitions })).toThrow(
      new GraphParseError('edges.0.kind', 'expected a string.'),
    )

    const mismatched = createGraph([{ ...edge, kind: 'data' }])

    expect(validateGraph(mismatched, { nodeDefinitions }).diagnostics).toEqual([
      expect.objectContaining({
        code: 'EDGE_KIND_MISMATCH',
        severity: 'error',
        edgeId: 'e',
        portId: 'then',
        path: 'edges.0.kind',
      }),
    ])
    expect(repairGraph(mismatched, { nodeDefinitions }).graph.edges).toEqual([])
    expect(validateGraph(createGraph([{ ...edge, kind: 'exec' }]), { nodeDefinitions }).valid).toBe(
      true,
    )
  })

  it('is derived from the source port when the store connects or reconnects', () => {
    const validator = vi.fn((context: ConnectionContext) => {
      void context
      return { valid: true }
    })
    const store = new GraphStore(createGraph(), { nodeDefinitions, validators: [validator] })

    store.connect({ nodeId: 'a', portId: 'then' }, { nodeId: 'b', portId: 'in' }, { edgeId: 'x' })
    store.connect(
      { nodeId: 'a', portId: 'result' },
      { nodeId: 'b', portId: 'value' },
      { edgeId: 'd' },
    )

    expect(validator.mock.calls.map(([context]) => context.kind)).toEqual(['exec', 'data'])
    expect(store.getEdge('x')?.kind).toBe('exec')
    expect(store.getEdge('d')?.kind).toBe('data')

    store.reconnectEdge('x', { target: { nodeId: 'c', portId: 'in' } })
    store.reconnectEdge('d', { source: { nodeId: 'c', portId: 'then' } })

    expect(store.getEdge('x')?.kind).toBe('exec')
    expect(store.getEdge('d')?.kind).toBe('exec')
    expect(validator.mock.calls.at(-1)?.[0].kind).toBe('exec')

    expect(() =>
      store.addEdge({
        id: 'wrong',
        kind: 'data',
        source: { nodeId: 'b', portId: 'then' },
        target: { nodeId: 'c', portId: 'in' },
      }),
    ).toThrow('Edge "wrong" kind "data" differs from the kind "exec" of its source port "then".')
  })

  it('scopes kind-specific rules identically for interaction and graph diagnostics', () => {
    const plugin = createHybridFlowPlugin({
      execflow: {
        rules: [
          defineConnectionRule('no-exec-into-c', (context) =>
            context.target.nodeId === 'c'
              ? { valid: false, code: 'EXEC_INTO_C', reason: 'No execution into c.' }
              : { valid: true },
          ),
        ],
      },
    })
    const execIntoC = {
      id: 'exec',
      kind: 'exec',
      source: { nodeId: 'b', portId: 'then' },
      target: { nodeId: 'c', portId: 'in' },
    }
    const dataIntoC = {
      id: 'data',
      kind: 'data',
      source: { nodeId: 'b', portId: 'result' },
      target: { nodeId: 'c', portId: 'value' },
    }
    const store = new GraphStore(createGraph([execIntoC, dataIntoC]), {
      nodeDefinitions,
      plugins: [plugin],
    })

    expect(
      store.validateConnection({ nodeId: 'a', portId: 'then' }, { nodeId: 'c', portId: 'in' }),
    ).toEqual(expect.objectContaining({ valid: false, code: 'EXEC_INTO_C' }))
    expect(
      store.validateConnection({ nodeId: 'a', portId: 'result' }, { nodeId: 'c', portId: 'value' }),
    ).toEqual({ valid: true })
    expect(
      store
        .listDiagnostics()
        .filter((diagnostic) => diagnostic.code === 'EXEC_INTO_C')
        .map((diagnostic) => diagnostic.edgeId),
    ).toEqual(['exec'])
  })
})
