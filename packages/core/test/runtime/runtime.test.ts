import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'
import {
  NodeEngineRuntime,
  compileGraph,
  type NodeEngineRuntimeNodeDefinition,
} from '../../src/runtime/index'

const definitions: SemanticNodeDefinition[] = [
  {
    type: 'event',
    ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
    capabilities: ['event'],
  },
  {
    type: 'log',
    ports: [{ id: 'in', direction: 'input', kind: 'exec' }],
  },
]

const graph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [
    { id: 'start', type: 'event', x: 0, y: 0 },
    { id: 'log', type: 'log', x: 100, y: 0 },
  ],
  edges: [
    {
      id: 'exec',
      kind: 'exec',
      source: { nodeId: 'start', portId: 'then' },
      target: { nodeId: 'log', portId: 'in' },
    },
  ],
  groups: [],
  meta: {},
}

const runtimeDefinitions: NodeEngineRuntimeNodeDefinition[] = [
  { type: 'event', handler: () => ({ output: 'then' }) },
  { type: 'log', handler: () => ({}) },
]

describe('@node-engine-sdk/core/runtime execution plans', () => {
  it('treats entryNodeId strictly as a node id', () => {
    const compiled = compileGraph({
      graph,
      entryNodeId: 'event',
      definitions,
      runtimeDefinitions,
    })

    expect(compiled.valid).toBe(false)
    expect(compiled.plan).toBeUndefined()
    expect(compiled.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'RUNTIME_ENTRY_NODE_MISSING',
        nodeId: 'event',
      }),
    )
  })

  it('rejects data dependency cycles during compilation', () => {
    const cycleDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
        capabilities: ['event'],
      },
      {
        type: 'cycle',
        ports: [
          { id: 'exec', direction: 'input', kind: 'exec' },
          { id: 'input', direction: 'input', kind: 'data' },
          { id: 'output', direction: 'output', kind: 'data' },
        ],
        capabilities: ['pure'],
      },
    ]
    const cycleGraph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'a', type: 'cycle', x: 100, y: 0 },
        { id: 'b', type: 'cycle', x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'start-a',
          kind: 'exec',
          source: { nodeId: 'start', portId: 'then' },
          target: { nodeId: 'a', portId: 'exec' },
        },
        {
          id: 'a-b',
          kind: 'data',
          source: { nodeId: 'a', portId: 'output' },
          target: { nodeId: 'b', portId: 'input' },
        },
        {
          id: 'b-a',
          kind: 'data',
          source: { nodeId: 'b', portId: 'output' },
          target: { nodeId: 'a', portId: 'input' },
        },
      ],
      groups: [],
      meta: {},
    }
    const compiled = compileGraph({
      graph: cycleGraph,
      entryNodeId: 'start',
      definitions: cycleDefinitions,
      runtimeDefinitions: [
        { type: 'event', handler: () => ({ output: 'then' }) },
        { type: 'cycle', handler: () => ({ values: { output: 1 } }) },
      ],
    })

    expect(compiled.valid).toBe(false)
    expect(compiled.plan).toBeUndefined()
    expect(compiled.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RUNTIME_DATA_CYCLE',
          nodeId: expect.stringMatching(/^(a|b)$/),
        }),
      ]),
    )
  })

  it('evaluates a cacheable data source once per run', async () => {
    const cacheDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
        capabilities: ['event'],
      },
      {
        type: 'source',
        ports: [{ id: 'value', direction: 'output', kind: 'data' }],
        capabilities: ['pure'],
      },
      {
        type: 'consumer',
        ports: [
          { id: 'exec', direction: 'input', kind: 'exec' },
          { id: 'left', direction: 'input', kind: 'data' },
          { id: 'right', direction: 'input', kind: 'data' },
        ],
      },
    ]
    const cacheGraph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'source', type: 'source', x: 0, y: 100 },
        { id: 'consumer', type: 'consumer', x: 180, y: 0 },
      ],
      edges: [
        {
          id: 'exec',
          kind: 'exec',
          source: { nodeId: 'start', portId: 'then' },
          target: { nodeId: 'consumer', portId: 'exec' },
        },
        {
          id: 'left',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'consumer', portId: 'left' },
        },
        {
          id: 'right',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'consumer', portId: 'right' },
        },
      ],
      groups: [],
      meta: {},
    }
    let sourceEvaluations = 0
    const cacheRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ output: 'then' }) },
      {
        type: 'source',
        handler: () => {
          sourceEvaluations += 1
          return { values: { value: 21 } }
        },
      },
      {
        type: 'consumer',
        handler: ({ values }) => ({
          values: { total: Number(values.left) + Number(values.right) },
        }),
      },
    ]
    const compiled = compileGraph({
      graph: cacheGraph,
      entryNodeId: 'start',
      definitions: cacheDefinitions,
      runtimeDefinitions: cacheRuntimeDefinitions,
    })
    const runtime = new NodeEngineRuntime({
      definitions: cacheDefinitions,
      runtimeDefinitions: cacheRuntimeDefinitions,
    })

    expect(compiled.valid).toBe(true)

    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('success')
    expect(result.nodeStates.consumer.values?.total).toBe(42)
    expect(sourceEvaluations).toBe(1)
  })

  it('evaluates an explicitly connected effect data dependency', async () => {
    let effectEvaluations = 0
    const effectDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'effect-source',
        capabilities: ['effect', 'async'],
        ports: [{ id: 'output', direction: 'output', kind: 'data' }],
      },
      {
        type: 'sink',
        capabilities: ['event'],
        ports: [{ id: 'input', direction: 'input', kind: 'data' }],
      },
    ]
    const effectGraph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'effect', type: 'effect-source', x: 0, y: 0 },
        { id: 'sink', type: 'sink', x: 100, y: 0 },
      ],
      edges: [
        {
          id: 'effect-sink',
          kind: 'data',
          source: { nodeId: 'effect', portId: 'output' },
          target: { nodeId: 'sink', portId: 'input' },
        },
      ],
      groups: [],
      meta: {},
    }
    const effectRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[] = [
      {
        type: 'effect-source',
        cacheable: false,
        handler: () => {
          effectEvaluations += 1
          return { values: { output: 'generated' } }
        },
      },
      {
        type: 'sink',
        handler: ({ values }) => ({ data: values.input }),
      },
    ]
    const compiled = compileGraph({
      graph: effectGraph,
      entryNodeId: 'sink',
      definitions: effectDefinitions,
      runtimeDefinitions: effectRuntimeDefinitions,
    })
    const runtime = new NodeEngineRuntime({
      definitions: effectDefinitions,
      runtimeDefinitions: effectRuntimeDefinitions,
    })

    expect(compiled.valid).toBe(true)
    const result = await runtime.run(compiled.plan!)

    expect(effectEvaluations).toBe(1)
    expect(result.nodeStates.sink.inputValues).toEqual({ input: 'generated' })
  })

  it('compiles and runs an execution plan', async () => {
    const compiled = compileGraph({
      graph,
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })
    const runtime = new NodeEngineRuntime({
      definitions,
      runtimeDefinitions,
    })

    expect(compiled.valid).toBe(true)
    expect(compiled.plan?.nodeOrder).toEqual(['start', 'log'])

    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('success')
    expect(Object.keys(result.nodeStates)).toEqual(expect.arrayContaining(['start', 'log']))
  })

  it('does not emit a plan when a handler is missing', () => {
    const compiled = compileGraph({
      graph,
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions: runtimeDefinitions.slice(0, 1),
    })

    expect(compiled.valid).toBe(false)
    expect(compiled.plan).toBeUndefined()
    expect(compiled.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'RUNTIME_HANDLER_MISSING',
    )
  })

  it('passes parameter input port values through runtime params', async () => {
    const parameterDefinitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
        capabilities: ['event'],
      },
      {
        type: 'source',
        ports: [{ id: 'value', direction: 'output', kind: 'data', dataType: 'number' }],
        capabilities: ['pure'],
      },
      {
        type: 'consumer',
        ports: [
          { id: 'in', direction: 'input', kind: 'exec' },
          { id: 'out', direction: 'output', kind: 'data', dataType: 'number' },
        ],
        parameters: [{ key: 'amount', kind: 'number', input: { portId: 'amount' } }],
      },
    ]
    const parameterGraph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'source', type: 'source', x: 0, y: 100, data: { params: { value: 42 } } },
        { id: 'consumer', type: 'consumer', x: 180, y: 0, data: { params: { amount: 7 } } },
      ],
      edges: [
        {
          id: 'exec',
          kind: 'exec',
          source: { nodeId: 'start', portId: 'then' },
          target: { nodeId: 'consumer', portId: 'in' },
        },
        {
          id: 'amount',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'consumer', portId: 'amount' },
        },
      ],
      groups: [],
      meta: {},
    }
    const parameterRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ output: 'then' }) },
      { type: 'source', handler: ({ params }) => ({ values: { value: params.value } }) },
      { type: 'consumer', handler: ({ params }) => ({ values: { out: params.amount } }) },
    ]
    const compiled = compileGraph({
      graph: parameterGraph,
      entryNodeId: 'start',
      definitions: parameterDefinitions,
      runtimeDefinitions: parameterRuntimeDefinitions,
    })
    const runtime = new NodeEngineRuntime({
      definitions: parameterDefinitions,
      runtimeDefinitions: parameterRuntimeDefinitions,
    })

    expect(compiled.valid).toBe(true)

    const result = await runtime.run(compiled.plan!)

    expect(result.nodeStates.consumer.values?.out).toBe(42)
  })
})
