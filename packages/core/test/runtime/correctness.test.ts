import { describe, expect, it } from 'vitest'
import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
  type NodeWrightExecutionPlan,
} from '@node-wright/core/protocol'
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  type SemanticNodeDefinition,
} from '@node-wright/core/semantics'
import {
  NodeWrightRuntime,
  compileGraph,
  createConcurrentScheduler,
  type NodeWrightRuntimeEvent,
  type NodeWrightRuntimeNodeDefinition,
} from '../../src/runtime/index'

describe('@node-wright/core/runtime correctness', () => {
  it('shares one in-flight node evaluation across output ports and releases it after each run', async () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        capabilities: ['event'],
        ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
      },
      {
        type: 'source',
        capabilities: ['pure'],
        ports: [
          { id: 'left', direction: 'output', kind: 'data' },
          { id: 'right', direction: 'output', kind: 'data' },
        ],
      },
      {
        type: 'sink',
        ports: [
          { id: 'exec', direction: 'input', kind: 'exec' },
          { id: 'left', direction: 'input', kind: 'data' },
          { id: 'right', direction: 'input', kind: 'data' },
        ],
      },
    ]
    const graph = createGraph(
      [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'source', type: 'source', x: 0, y: 100 },
        { id: 'sink', type: 'sink', x: 100, y: 0 },
      ],
      [
        createEdge('exec', 'exec', 'start', 'then', 'sink', 'exec'),
        createEdge('left', 'data', 'source', 'left', 'sink', 'left'),
        createEdge('right', 'data', 'source', 'right', 'sink', 'right'),
      ],
    )
    let evaluations = 0
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ output: 'then' }) },
      {
        type: 'source',
        handler: async () => {
          evaluations += 1
          await Promise.resolve()
          return { values: { left: 20, right: 22 } }
        },
      },
      {
        type: 'sink',
        handler: ({ values }) => ({
          values: { total: Number(values.left) + Number(values.right) },
        }),
      },
    ]
    const plan = compilePlan(graph, definitions, runtimeDefinitions, 'start')
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      scheduler: createConcurrentScheduler({ maxConcurrency: 4 }),
    })

    const first = await runtime.run(plan)
    const second = await runtime.run(plan)

    expect(first.nodeStates.sink.values?.total).toBe(42)
    expect(second.nodeStates.sink.values?.total).toBe(42)
    expect(evaluations).toBe(2)
    expect(
      first.trace.filter((entry) => entry.kind === 'data' && entry.nodeId === 'source'),
    ).toHaveLength(1)
    expect(
      second.trace.filter((entry) => entry.kind === 'data' && entry.nodeId === 'source'),
    ).toHaveLength(1)
  })

  it('distinguishes explicit undefined, null, and a missing output property', async () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'source',
        capabilities: ['pure'],
        ports: [
          { id: 'undefinedValue', direction: 'output', kind: 'data' },
          { id: 'nullValue', direction: 'output', kind: 'data' },
          { id: 'missingValue', direction: 'output', kind: 'data' },
        ],
      },
      {
        type: 'sink',
        capabilities: ['event'],
        ports: [{ id: 'missingValue', direction: 'input', kind: 'data' }],
        parameters: [
          { key: 'undefinedValue', kind: 'json', input: { portId: 'undefinedValue' } },
          { key: 'nullValue', kind: 'json', input: { portId: 'nullValue' } },
        ],
      },
    ]
    const nodes = [
      { id: 'source', type: 'source', x: 0, y: 0 },
      {
        id: 'sink',
        type: 'sink',
        x: 100,
        y: 0,
        data: { params: { undefinedValue: 1, nullValue: 2 } },
      },
    ]
    const baseEdges = [
      createEdge('undefined', 'data', 'source', 'undefinedValue', 'sink', 'undefinedValue'),
      createEdge('null', 'data', 'source', 'nullValue', 'sink', 'nullValue'),
    ]
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      {
        type: 'source',
        handler: () => ({
          values: {
            undefinedValue: undefined,
            nullValue: null,
          },
        }),
      },
      {
        type: 'sink',
        handler: ({ params }) => ({ values: params }),
      },
    ]
    const validGraph = createGraph(nodes, baseEdges)
    const validPlan = compilePlan(validGraph, definitions, runtimeDefinitions, 'sink')
    const runtime = new NodeWrightRuntime({ definitions, runtimeDefinitions })
    const result = await runtime.run(validPlan)

    expect(
      Object.prototype.hasOwnProperty.call(result.nodeStates.sink.values, 'undefinedValue'),
    ).toBe(true)
    expect(result.nodeStates.sink.values?.undefinedValue).toBeUndefined()
    expect(result.nodeStates.sink.values?.nullValue).toBeNull()

    const missingGraph = createGraph(nodes, [
      ...baseEdges,
      createEdge('missing', 'data', 'source', 'missingValue', 'sink', 'missingValue'),
    ])
    const missingPlan: NodeWrightExecutionPlan = {
      ...validPlan,
      graph: missingGraph,
    }
    const missing = await runtime.run(missingPlan)

    expect(missing.status).toBe('error')
    expect(String(missing.error)).toContain('did not produce output "missingValue"')
  })

  it('detects a data cycle even when a caller bypasses compilation', async () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'data',
        capabilities: ['pure'],
        ports: [
          { id: 'input', direction: 'input', kind: 'data' },
          { id: 'output', direction: 'output', kind: 'data' },
        ],
      },
      {
        type: 'sink',
        capabilities: ['event'],
        ports: [{ id: 'input', direction: 'input', kind: 'data' }],
      },
    ]
    const graph = createGraph(
      [
        { id: 'a', type: 'data', x: 0, y: 0 },
        { id: 'b', type: 'data', x: 100, y: 0 },
        { id: 'sink', type: 'sink', x: 200, y: 0 },
      ],
      [
        createEdge('a-b', 'data', 'a', 'output', 'b', 'input'),
        createEdge('b-a', 'data', 'b', 'output', 'a', 'input'),
        createEdge('a-sink', 'data', 'a', 'output', 'sink', 'input'),
      ],
    )
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'data', handler: ({ values }) => ({ values: { output: values.input } }) },
      { type: 'sink', handler: () => ({}) },
    ]
    const runtime = new NodeWrightRuntime({ definitions, runtimeDefinitions })
    const plan: NodeWrightExecutionPlan = {
      id: 'manual-cycle',
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      graph,
      entryNodeId: 'sink',
      nodeOrder: ['a', 'b', 'sink'],
      diagnostics: [],
    }

    const result = await runtime.run(plan)

    expect(result.status).toBe('error')
    expect(String(result.error)).toMatch(/data dependency cycle reached node "(a|b)"/)
  })

  it('rejects a stale plan instead of fabricating output when a handler is missing', async () => {
    const definitions: SemanticNodeDefinition[] = [
      { type: 'event', capabilities: ['event'], ports: [] },
    ]
    const graph = createGraph([{ id: 'start', type: 'event', x: 0, y: 0 }], [])
    const validRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({}) },
    ]
    const plan = compilePlan(graph, definitions, validRuntimeDefinitions, 'start')
    const runtime = new NodeWrightRuntime({ definitions })

    const result = await runtime.run(plan)

    expect(result.status).toBe('error')
    expect(String(result.error)).toContain('does not have a runtime handler')
    expect(result.nodeStates.start.status).toBe('error')
  })

  it('emits one run cancellation and reports the active node as cancelled', async () => {
    const definitions: SemanticNodeDefinition[] = [
      { type: 'event', capabilities: ['event'], ports: [] },
    ]
    const graph = createGraph([{ id: 'start', type: 'event', x: 0, y: 0 }], [])
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({}) },
    ]
    const plan = compilePlan(graph, definitions, runtimeDefinitions, 'start')
    const events: NodeWrightRuntimeEvent['type'][] = []
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent(event) {
        events.push(event.type)
        if (event.type === 'node:start') {
          runtime.cancel(event.run.runId)
        }
      },
    })

    const result = await runtime.run(plan)

    expect(result.status).toBe('cancelled')
    expect(events.filter((type) => type === 'run:cancel')).toHaveLength(1)
    expect(events).toContain('node:cancel')
    expect(events).not.toContain('node:success')
    expect(result.nodeStates.start.status).toBe('cancelled')
  })

  it('isolates immutable event snapshots and records listener failures without failing the run', async () => {
    const definitions: SemanticNodeDefinition[] = [
      { type: 'event', capabilities: ['event'], ports: [] },
    ]
    const graph = createGraph([{ id: 'start', type: 'event', x: 0, y: 0 }], [])
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({}) },
    ]
    const plan = compilePlan(graph, definitions, runtimeDefinitions, 'start')
    let snapshotWasFrozen = false
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent(event) {
        if (event.type !== 'run:start') {
          return
        }

        snapshotWasFrozen = Object.isFrozen(event) && Object.isFrozen(event.run)
        event.run.status = 'cancelled'
      },
    })

    const result = await runtime.run(plan)

    expect(snapshotWasFrozen).toBe(true)
    expect(result.status).toBe('success')
    expect(result.listenerErrors).toHaveLength(1)
  })

  it('keeps concurrent branch call stacks isolated', async () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        capabilities: ['event'],
        ports: [
          { id: 'left', direction: 'output', kind: 'exec' },
          { id: 'right', direction: 'output', kind: 'exec' },
        ],
      },
      {
        type: 'worker',
        capabilities: ['pure'],
        ports: [{ id: 'exec', direction: 'input', kind: 'exec' }],
      },
    ]
    const graph = createGraph(
      [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'left', type: 'worker', x: 100, y: -50 },
        { id: 'right', type: 'worker', x: 100, y: 50 },
      ],
      [
        createEdge('left', 'exec', 'start', 'left', 'left', 'exec'),
        createEdge('right', 'exec', 'start', 'right', 'right', 'exec'),
      ],
    )
    const stacks = new Map<string, string[]>()
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ outputs: ['left', 'right'] }) },
      {
        type: 'worker',
        handler: async ({ node, callStack }) => {
          stacks.set(
            node.id,
            callStack.flatMap((frame) => frame.nodeId ?? []),
          )
          await Promise.resolve()
          return {}
        },
      },
    ]
    const plan = compilePlan(graph, definitions, runtimeDefinitions, 'start')
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      scheduler: createConcurrentScheduler({ maxConcurrency: 2 }),
    })

    const result = await runtime.run(plan)

    expect(result.status).toBe('success')
    expect(stacks.get('left')).toEqual(['left'])
    expect(stacks.get('right')).toEqual(['right'])
    expect(
      result.callFrames.filter((frame) => frame.nodeId === 'left' || frame.nodeId === 'right'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ depth: 0, parentId: undefined }),
        expect.objectContaining({ depth: 0, parentId: undefined }),
      ]),
    )
  })

  it('keeps function and subgraph frames nested under the calling node', async () => {
    const definitions: SemanticNodeDefinition[] = [
      { type: 'event', capabilities: ['event'], ports: [] },
    ]
    const graph = createGraph([{ id: 'start', type: 'event', x: 0, y: 0 }], [])
    const subgraph = createGraph(
      [
        {
          id: 'input',
          type: SUBGRAPH_INPUT_NODE_TYPE,
          x: 0,
          y: 0,
          ports: [{ id: 'value', name: 'value', direction: 'output', kind: 'data' }],
        },
        {
          id: 'output',
          type: SUBGRAPH_OUTPUT_NODE_TYPE,
          x: 100,
          y: 0,
          ports: [{ id: 'value', name: 'value', direction: 'input', kind: 'data' }],
        },
      ],
      [createEdge('value', 'data', 'input', 'value', 'output', 'value')],
    )
    const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      {
        type: 'event',
        handler: async ({ callFunction, callSubgraph }) => {
          const doubled = await callFunction('double', { value: 21 })
          const wrapped = await callSubgraph('identity', doubled.values)
          return { values: { result: wrapped.values?.value } }
        },
      },
    ]
    const plan = compilePlan(graph, definitions, runtimeDefinitions, 'start')
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      functionDefinitions: [
        {
          id: 'double',
          mode: 'pure',
          handler: ({ values }) => ({ values: { value: Number(values.value) * 2 } }),
        },
      ],
      subgraphDefinitions: [
        {
          id: 'identity',
          graph: subgraph,
          outputNodeId: 'output',
          inputs: [{ id: 'value' }],
          outputs: [{ id: 'value' }],
        },
      ],
    })

    const result = await runtime.run(plan)
    const nodeFrame = result.callFrames.find((frame) => frame.nodeId === 'start')
    const nestedFrames = result.callFrames.filter(
      (frame) => frame.functionId === 'double' || frame.subgraphId === 'identity',
    )

    expect(result.status).toBe('success')
    expect(result.nodeStates.start.values?.result).toBe(42)
    expect(nodeFrame).toBeDefined()
    expect(nestedFrames).toHaveLength(2)
    expect(
      nestedFrames.every((frame) => frame.parentId === nodeFrame?.id && frame.depth === 1),
    ).toBe(true)
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'function', status: 'success' }),
        expect.objectContaining({ kind: 'subgraph', status: 'success' }),
      ]),
    )
  })

  it('does not retry effects unless idempotence is explicit', async () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'event',
        capabilities: ['event'],
        ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
      },
      {
        type: 'effect',
        capabilities: ['effect'],
        ports: [{ id: 'exec', direction: 'input', kind: 'exec' }],
      },
    ]
    const graph = createGraph(
      [
        { id: 'start', type: 'event', x: 0, y: 0 },
        { id: 'effect', type: 'effect', x: 100, y: 0 },
      ],
      [createEdge('exec', 'exec', 'start', 'then', 'effect', 'exec')],
    )
    let unsafeAttempts = 0
    const unsafeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ output: 'then' }) },
      {
        type: 'effect',
        handler: () => {
          unsafeAttempts += 1
          throw new Error('unsafe-effect')
        },
      },
    ]
    const unsafePlan = compilePlan(graph, definitions, unsafeDefinitions, 'start')
    const unsafeRuntime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions: unsafeDefinitions,
      scheduler: createConcurrentScheduler({ retries: 2 }),
    })

    expect((await unsafeRuntime.run(unsafePlan)).status).toBe('error')
    expect(unsafeAttempts).toBe(1)

    let safeAttempts = 0
    const safeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
      { type: 'event', handler: () => ({ output: 'then' }) },
      {
        type: 'effect',
        idempotent: true,
        handler: () => {
          safeAttempts += 1
          if (safeAttempts === 1) throw new Error('retry-idempotent-effect')
          return {}
        },
      },
    ]
    const safePlan = compilePlan(graph, definitions, safeDefinitions, 'start')
    const safeRuntime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions: safeDefinitions,
      scheduler: createConcurrentScheduler({ retries: 2 }),
    })

    expect((await safeRuntime.run(safePlan)).status).toBe('success')
    expect(safeAttempts).toBe(2)
  })
})

function createGraph(nodes: GraphSnapshot['nodes'], edges: GraphSnapshot['edges']): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes,
    edges,
    groups: [],
    meta: {},
  }
}

function createEdge(
  id: string,
  kind: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): GraphSnapshot['edges'][number] {
  return {
    id,
    kind,
    source: { nodeId: sourceNodeId, portId: sourcePortId },
    target: { nodeId: targetNodeId, portId: targetPortId },
  }
}

function compilePlan(
  graph: GraphSnapshot,
  definitions: SemanticNodeDefinition[],
  runtimeDefinitions: NodeWrightRuntimeNodeDefinition[],
  entryNodeId: string,
): NodeWrightExecutionPlan {
  const compiled = compileGraph({
    graph,
    definitions,
    runtimeDefinitions,
    entryNodeId,
  })

  if (!compiled.plan) {
    throw new Error(compiled.diagnostics.map((diagnostic) => diagnostic.message).join('\n'))
  }

  return compiled.plan
}
