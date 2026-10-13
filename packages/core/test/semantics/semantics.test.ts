import { describe, expect, it } from 'vitest'
import { GraphStore } from '@node-engine-sdk/core/store'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type NodeDefinition,
} from '@node-engine-sdk/core/protocol'
import {
  createDataflowPlugin,
  createFunctionReference,
  createHybridFlowPlugin,
  createSubgraphReference,
  createVariableReference,
  hasNodeCapability,
  normalizeVariableScope,
  type SemanticNodeDefinition,
} from '../../src/semantics/index'

const definitions: NodeDefinition[] = [
  {
    type: 'source',
    ports: [{ id: 'out', direction: 'output', kind: 'data', dataType: 'string' }],
  },
  {
    type: 'target',
    ports: [
      { id: 'in', direction: 'input', kind: 'data', dataType: 'number', required: true },
      { id: 'out', direction: 'output', kind: 'data', dataType: 'number' },
    ],
  },
]

describe('@node-engine-sdk/core/semantics diagnostics', () => {
  it('reports semantic connection and required input diagnostics', () => {
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'source', type: 'source', x: 0, y: 0 },
          { id: 'target', type: 'target', x: 100, y: 0 },
        ],
        edges: [
          {
            id: 'wrong-direction',
            kind: 'data',
            source: { nodeId: 'target', portId: 'in' },
            target: { nodeId: 'source', portId: 'out' },
          },
        ],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions: definitions,
        plugins: [createDataflowPlugin()],
      },
    )

    expect(store.listDiagnostics().map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['PORT_DIRECTION_MISMATCH', 'REQUIRED_INPUT_MISSING']),
    )
  })

  it('uses protocol-resolved parameter ports for interaction and diagnostics', () => {
    const parameterDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'source',
        ports: [
          {
            id: 'value',
            direction: 'output',
            kind: 'data',
            dataType: 'number',
          },
        ],
      },
      {
        type: 'parameter-target',
        parameters: [
          {
            key: 'seed',
            kind: 'number',
            input: {
              portId: 'seed',
              required: true,
              dataType: 'number',
            },
          },
        ],
      },
    ]
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'source', type: 'source', x: 0, y: 0 },
          { id: 'target', type: 'parameter-target', x: 100, y: 0 },
        ],
        edges: [
          {
            id: 'parameter-edge',
            kind: 'data',
            source: { nodeId: 'source', portId: 'value' },
            target: { nodeId: 'target', portId: 'seed' },
          },
        ],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions: parameterDefinitions,
        plugins: [createDataflowPlugin()],
      },
    )

    expect(
      store.validateConnection(
        { nodeId: 'source', portId: 'value' },
        { nodeId: 'target', portId: 'seed' },
        { ignoreEdgeId: 'parameter-edge' },
      ),
    ).toEqual({ valid: true })
    expect(store.listDiagnostics()).toEqual([])
  })

  it('applies hybrid data and exec options only to their matching edge kind', () => {
    const nodeDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'hybrid',
        ports: [
          { id: 'data-out', direction: 'output', kind: 'data' },
          { id: 'data-in', direction: 'input', kind: 'data' },
          { id: 'exec-out', direction: 'output', kind: 'exec' },
          { id: 'exec-in', direction: 'input', kind: 'exec' },
        ],
      },
    ]
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'node', type: 'hybrid', x: 0, y: 0 }],
        edges: [],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions,
        plugins: [
          createHybridFlowPlugin({
            dataflow: {
              allowSameNodeConnections: true,
              preventCycles: false,
            },
            execflow: {
              allowSameNodeConnections: false,
              preventCycles: false,
            },
          }),
        ],
      },
    )

    expect(
      store.validateConnection(
        { nodeId: 'node', portId: 'data-out' },
        { nodeId: 'node', portId: 'data-in' },
      ),
    ).toEqual({ valid: true })
    expect(
      store.validateConnection(
        { nodeId: 'node', portId: 'exec-out' },
        { nodeId: 'node', portId: 'exec-in' },
      ),
    ).toEqual(
      expect.objectContaining({
        valid: false,
        code: 'SAME_NODE_CONNECTION',
      }),
    )
  })

  it('reports every existing edge that participates in a data cycle', () => {
    const cycleDefinition: SemanticNodeDefinition = {
      type: 'cycle',
      ports: [
        { id: 'in', direction: 'input', kind: 'data' },
        { id: 'out', direction: 'output', kind: 'data' },
      ],
    }
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: ['a', 'b', 'c'].map((id, index) => ({
          id,
          type: 'cycle',
          x: index * 100,
          y: 0,
        })),
        edges: [
          {
            id: 'a-b',
            kind: 'data',
            source: { nodeId: 'a', portId: 'out' },
            target: { nodeId: 'b', portId: 'in' },
          },
          {
            id: 'b-c',
            kind: 'data',
            source: { nodeId: 'b', portId: 'out' },
            target: { nodeId: 'c', portId: 'in' },
          },
          {
            id: 'c-a',
            kind: 'data',
            source: { nodeId: 'c', portId: 'out' },
            target: { nodeId: 'a', portId: 'in' },
          },
        ],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions: [cycleDefinition],
        plugins: [createDataflowPlugin()],
      },
    )

    expect(
      store
        .listDiagnostics()
        .filter((diagnostic) => diagnostic.code === 'DATAFLOW_CYCLE_DETECTED')
        .map((diagnostic) => diagnostic.edgeId)
        .sort(),
    ).toEqual(['a-b', 'b-c', 'c-a'])
  })

  it('reads capabilities only from SemanticNodeDefinition.capabilities', () => {
    const baseDefinition: NodeDefinition = { type: 'base' }
    const semanticDefinition: SemanticNodeDefinition = {
      type: 'semantic',
      capabilities: ['pure'],
    }

    expect(hasNodeCapability(baseDefinition, 'pure')).toBe(false)
    expect(hasNodeCapability(semanticDefinition, 'pure')).toBe(true)
  })

  it('rejects empty function, subgraph, and variable references', () => {
    expect(() => createFunctionReference('   ')).toThrow('Function id must be a non-empty string.')
    expect(() => createSubgraphReference({ id: '' })).toThrow(
      'Subgraph id must be a non-empty string.',
    )
    expect(() => createVariableReference('')).toThrow('Variable name must be a non-empty string.')
    expect(() => normalizeVariableScope('   ')).toThrow(
      'Variable scope must be a non-empty string.',
    )
    expect(normalizeVariableScope(undefined)).toBe('run')
  })
})
