import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  createGraphValidationResult,
  mergeGraphValidationResults,
  validateGraph,
  type GraphDiagnostic,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'

function createGraph(patch: Partial<Omit<GraphSnapshot, 'schemaVersion'>>): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...patch,
  }
}

function codes(diagnostics: GraphDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code)
}

describe('@node-engine-sdk/core/protocol validateGraph', () => {
  it('warns about unregistered types only when definitions are given', () => {
    const graph = createGraph({
      nodes: [
        { id: 'a', type: 'unknown', x: 0, y: 0, ports: [{ id: 'out', direction: 'output' }] },
        { id: 'b', type: 'unknown', x: 100, y: 0, ports: [{ id: 'in', direction: 'input' }] },
      ],
      edges: [
        {
          id: 'edge',
          kind: 'data',
          type: 'custom',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
    })

    expect(validateGraph(graph).diagnostics).toEqual([])

    const result = validateGraph(graph, { nodeDefinitions: [], edgeDefinitions: [] })

    expect(result.valid).toBe(true)
    expect(codes(result.diagnostics)).toEqual([
      'NODE_TYPE_UNKNOWN',
      'NODE_TYPE_UNKNOWN',
      'EDGE_TYPE_UNKNOWN',
    ])
  })

  it('reports duplicate ids of every entity kind with their paths', () => {
    const result = validateGraph(
      createGraph({
        nodes: [
          {
            id: 'a',
            type: 'demo',
            x: 0,
            y: 0,
            ports: [
              { id: 'out', direction: 'output' },
              { id: 'out', direction: 'output' },
              { id: 'field:text', direction: 'input' },
            ],
          },
        ],
        edges: [
          {
            id: 'edge',
            kind: 'data',
            source: { nodeId: 'a', portId: 'out' },
            target: { nodeId: 'a', portId: 'field:text' },
          },
          {
            id: 'edge',
            kind: 'data',
            source: { nodeId: 'a', portId: 'out' },
            target: { nodeId: 'a', portId: 'field:text' },
          },
        ],
        groups: [
          { id: 'group', x: 0, y: 0, width: 10, height: 10 },
          { id: 'group', x: 0, y: 0, width: 10, height: 10 },
        ],
      }),
      {
        nodeDefinitions: [
          { type: 'demo' },
          {
            type: 'demo',
            parameters: [
              { key: 'text', kind: 'string', input: true },
              { key: 'copy', kind: 'string', input: { portId: 'field:text' } },
            ],
          },
        ],
      },
    )

    expect(result.valid).toBe(false)
    expect(
      result.diagnostics.map(({ code, path, edgeId, groupId }) => ({
        code,
        path,
        edgeId,
        groupId,
      })),
    ).toEqual([
      expect.objectContaining({
        code: 'NODE_DEFINITION_TYPE_DUPLICATE',
        path: 'nodeDefinitions.1.type',
      }),
      expect.objectContaining({ code: 'NODE_PARAMETER_PORT_ID_DUPLICATE' }),
      expect.objectContaining({ code: 'PORT_ID_DUPLICATE', path: 'nodes.0.ports.1.id' }),
      expect.objectContaining({ code: 'NODE_PARAMETER_PORT_ID_CONFLICT', path: 'nodes.0.ports' }),
      expect.objectContaining({ code: 'NODE_PARAMETER_PORT_ID_CONFLICT', path: 'nodes.0.ports' }),
      { code: 'EDGE_ID_DUPLICATE', path: 'edges.1.id', edgeId: 'edge', groupId: undefined },
      { code: 'GROUP_ID_DUPLICATE', path: 'groups.1.id', edgeId: undefined, groupId: 'group' },
    ])
  })

  it('checks edge ports and kinds only where the ports are known', () => {
    const result = validateGraph(
      createGraph({
        nodes: [
          { id: 'source', type: 'demo', x: 0, y: 0, ports: [{ id: 'out', direction: 'output' }] },
          { id: 'target', type: 'demo', x: 100, y: 0, ports: [{ id: 'in', direction: 'input' }] },
          { id: 'open', type: 'free', x: 200, y: 0 },
        ],
        edges: [
          {
            id: 'wrong-kind',
            kind: 'exec',
            source: { nodeId: 'source', portId: 'out' },
            target: { nodeId: 'target', portId: 'in' },
          },
          {
            id: 'missing-source-port',
            kind: 'data',
            source: { nodeId: 'source', portId: 'nope' },
            target: { nodeId: 'target', portId: 'in' },
          },
          {
            id: 'missing-target-node',
            kind: 'data',
            source: { nodeId: 'source', portId: 'out' },
            target: { nodeId: 'gone', portId: 'in' },
          },
          {
            id: 'unknown-ports',
            kind: 'anything',
            source: { nodeId: 'open', portId: 'any' },
            target: { nodeId: 'open', portId: 'other' },
          },
        ],
      }),
    )

    expect(codes(result.diagnostics)).toEqual([
      'EDGE_KIND_MISMATCH',
      'EDGE_SOURCE_PORT_MISSING',
      'EDGE_TARGET_NODE_MISSING',
    ])
  })
})

describe('@node-engine-sdk/core/protocol validation results', () => {
  it('derives validity from error diagnostics and merges results', () => {
    const warning: GraphDiagnostic = {
      code: 'W',
      severity: 'warning',
      message: 'Warning.',
      source: 'test',
    }
    const error: GraphDiagnostic = {
      code: 'E',
      severity: 'error',
      message: 'Error.',
      source: 'test',
    }

    expect(createGraphValidationResult([warning]).valid).toBe(true)
    expect(createGraphValidationResult([warning, error]).valid).toBe(false)
    expect(
      mergeGraphValidationResults(createGraphValidationResult([warning]), undefined, [error]),
    ).toEqual({ valid: false, diagnostics: [warning, error] })
    expect(mergeGraphValidationResults()).toEqual({ valid: true, diagnostics: [] })
  })
})
