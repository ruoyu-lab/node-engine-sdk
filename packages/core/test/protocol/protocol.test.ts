import { describe, expect, it } from 'vitest'
import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  cloneValue,
  parseGraph,
  repairGraph,
  resolveNodePorts,
  validateGraph,
  type GraphSnapshot,
} from '../../src/protocol/index'

describe('@node-wright/core/protocol graph protocol', () => {
  it('parses a complete graph into a detached snapshot', () => {
    const input = {
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
      edges: [],
      groups: [],
      meta: { nested: { enabled: true } },
    }
    const graph = parseGraph(input)

    input.nodes[0].x = 100

    expect(graph.schemaVersion).toBe(NODE_WRIGHT_GRAPH_SCHEMA_VERSION)
    expect(graph.nodes[0].x).toBe(0)
    expect(graph.meta).toEqual({ nested: { enabled: true } })
  })

  it('rejects missing and unsupported schema versions', () => {
    expect(() =>
      parseGraph({
        nodes: [],
        edges: [],
        groups: [],
        meta: {},
      }),
    ).toThrow(/schemaVersion.*expected a string/)

    expect(() =>
      parseGraph({
        schemaVersion: '0.9.0',
        nodes: [],
        edges: [],
        groups: [],
        meta: {},
      }),
    ).toThrow(/unsupported schemaVersion/)
  })

  it('rejects removed fields and non-JSON metadata', () => {
    expect(() =>
      parseGraph({
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'a', type: 'demo', x: 0, y: 0, parentId: 'old-group' }],
        edges: [],
        groups: [],
        meta: {},
      }),
    ).toThrow(/nodes\.0\.parentId.*unexpected property/)

    expect(() =>
      parseGraph({
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [],
        edges: [],
        groups: [],
        meta: { createdAt: new Date() },
      }),
    ).toThrow(/meta\.createdAt.*plain object/)
  })

  it('validates duplicate ids and broken references', () => {
    const result = validateGraph({
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'a', type: 'demo', x: 100, y: 0 },
      ],
      edges: [
        {
          id: 'bad',
          kind: 'data',
          source: { nodeId: 'missing', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
        },
      ],
      groups: [{ id: 'g', x: 0, y: 0, width: 100, height: 100, nodeIds: ['missing'] }],
      meta: {},
    })

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'NODE_ID_DUPLICATE',
        'EDGE_SOURCE_NODE_MISSING',
        'GROUP_NODE_MISSING',
      ]),
    )
  })

  it('treats parameter input ports as protocol ports', () => {
    const definitions = [
      {
        type: 'demo',
        parameterInputs: true,
        parameters: [
          { key: 'prompt', kind: 'string' as const, input: { portId: 'prompt' } },
          { key: 'steps', kind: 'number' as const },
          { key: 'localOnly', kind: 'boolean' as const, input: false },
        ],
      },
    ]
    const ports = resolveNodePorts({ id: 'demo', type: 'demo', x: 0, y: 0 }, definitions)
    const result = validateGraph(
      {
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [
          {
            id: 'source',
            type: 'source',
            x: 0,
            y: 0,
            ports: [{ id: 'value', direction: 'output', kind: 'data' }],
          },
          { id: 'target', type: 'demo', x: 100, y: 0 },
        ],
        edges: [
          {
            id: 'parameter-edge',
            kind: 'data',
            source: { nodeId: 'source', portId: 'value' },
            target: { nodeId: 'target', portId: 'prompt' },
          },
        ],
        groups: [],
        meta: {},
      },
      { nodeDefinitions: definitions },
    )

    expect(ports.map((port) => port.id)).toEqual(['prompt', 'field:steps'])
    expect(result.valid).toBe(true)
  })

  it('keeps parameter input ports disabled by default', () => {
    const ports = resolveNodePorts({ id: 'demo', type: 'demo', x: 0, y: 0 }, [
      {
        type: 'demo',
        parameters: [{ key: 'prompt', kind: 'string' as const }],
      },
    ])

    expect(ports).toEqual([])
  })

  it('repairs invalid edge and group references explicitly', () => {
    const graph: GraphSnapshot = {
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
      edges: [
        {
          id: 'bad',
          kind: 'data',
          source: { nodeId: 'missing', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
        },
      ],
      groups: [{ id: 'g', x: 0, y: 0, width: 100, height: 100, nodeIds: ['a', 'missing'] }],
      meta: {},
    }
    const repaired = repairGraph(graph)

    expect(repaired.graph.edges).toHaveLength(0)
    expect(repaired.graph.groups[0].nodeIds).toEqual(['a'])
    expect(repaired.diagnostics.some((diagnostic) => diagnostic.code.startsWith('REPAIRED_'))).toBe(
      true,
    )
  })

  it('requires the complete graph structure at external boundaries', () => {
    expect(() =>
      parseGraph({
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      }),
    ).toThrow(/nodes.*expected an array/)
  })

  it('validates definition port ids and parameter port conflicts', () => {
    const graph: GraphSnapshot = {
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
      edges: [],
      groups: [],
      meta: {},
    }
    const result = validateGraph(graph, {
      nodeDefinitions: [
        {
          type: 'demo',
          ports: [
            { id: 'value', direction: 'input' },
            { id: 'value', direction: 'output' },
          ],
          parameters: [{ key: 'amount', kind: 'number', input: { portId: 'value' } }],
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'NODE_DEFINITION_PORT_ID_DUPLICATE',
        'NODE_PARAMETER_PORT_ID_CONFLICT',
      ]),
    )
  })

  it('rejects arbitrary edge port ids for a known zero-port node', () => {
    const result = validateGraph(
      {
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'a', type: 'empty', x: 0, y: 0 },
          {
            id: 'b',
            type: 'source',
            x: 100,
            y: 0,
            ports: [{ id: 'output', direction: 'output' }],
          },
        ],
        edges: [
          {
            id: 'invalid',
            kind: 'data',
            source: { nodeId: 'b', portId: 'output' },
            target: { nodeId: 'a', portId: 'invented' },
          },
        ],
        groups: [],
        meta: {},
      },
      { nodeDefinitions: [{ type: 'empty', ports: [] }] },
    )

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'EDGE_TARGET_PORT_MISSING',
    )
  })

  it('validateGraph runs custom diagnosticProviders alongside built-in checks', () => {
    const result = validateGraph(
      {
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
        edges: [],
        groups: [],
        meta: {},
      },
      {
        providers: [
          () => [
            {
              code: 'CUSTOM_RULE_FAILED',
              severity: 'error',
              message: 'custom rule failed',
              source: 'test',
            },
          ],
        ],
      },
    )

    expect(result.valid).toBe(false)
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('CUSTOM_RULE_FAILED')
  })

  it('repairGraph fully sanitizes a graph with multiple kinds of breakage', () => {
    const result = repairGraph({
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'broken-src',
          kind: 'data',
          source: { nodeId: 'missing', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
        },
        {
          id: 'broken-tgt',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'gone', portId: 'in' },
        },
        {
          id: 'ok',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
      groups: [{ id: 'g1', x: 0, y: 0, width: 10, height: 10, nodeIds: ['a', 'ghost', 'b'] }],
      meta: {},
    })

    expect(result.graph.edges.map((edge) => edge.id)).toEqual(['ok'])
    expect(result.graph.groups[0].nodeIds).toEqual(['a', 'b'])
    expect(result.validation.valid).toBe(true)
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code.startsWith('REPAIRED_')),
    ).toHaveLength(3)
  })
})

describe('@node-wright/core/protocol cloneValue', () => {
  it('deep-clones nested structures and detaches from the original', () => {
    const source = { a: { b: [1, 2, { c: 'x' }] } }
    const clone = cloneValue(source)

    clone.a.b[2] = { c: 'y' }

    expect(source.a.b[2]).toEqual({ c: 'x' })
    expect(clone.a.b[2]).toEqual({ c: 'y' })
  })

  it('preserves primitives unchanged', () => {
    expect(cloneValue(null)).toBeNull()
    expect(cloneValue(undefined)).toBeUndefined()
    expect(cloneValue('s')).toBe('s')
    expect(cloneValue(7)).toBe(7)
  })
})
