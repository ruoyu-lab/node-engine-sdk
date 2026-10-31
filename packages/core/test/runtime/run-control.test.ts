import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import {
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  type SemanticNodeDefinition,
} from '@node-wright/core/semantics'
import {
  NodeWrightRuntime,
  type NodeWrightRuntimeEvent,
  type NodeWrightRuntimeNodeDefinition,
  type NodeWrightRuntimeOptions,
} from '../../src/runtime/index'

const definitions: SemanticNodeDefinition[] = [
  {
    type: 'event',
    ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
    capabilities: ['event'],
  },
  {
    type: 'step',
    ports: [
      { id: 'in', direction: 'input', kind: 'exec' },
      { id: 'then', direction: 'output', kind: 'exec' },
    ],
  },
]

const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
  { type: 'event', handler: () => ({ output: 'then' }) },
  { type: 'step', handler: () => ({ output: 'then' }) },
]

function createGraph(
  nodes: GraphSnapshot['nodes'],
  edges: GraphSnapshot['edges'] = [],
): GraphSnapshot {
  return { schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION, nodes, edges, groups: [], meta: {} }
}

/** start → mid → end, connected by exec edges. */
function createChainGraph(): GraphSnapshot {
  return createGraph(
    [
      { id: 'start', type: 'event', x: 0, y: 0 },
      { id: 'mid', type: 'step', x: 100, y: 0 },
      { id: 'end', type: 'step', x: 200, y: 0 },
    ],
    [
      {
        id: 'start-mid',
        kind: 'exec',
        source: { nodeId: 'start', portId: 'then' },
        target: { nodeId: 'mid', portId: 'in' },
      },
      {
        id: 'mid-end',
        kind: 'exec',
        source: { nodeId: 'mid', portId: 'then' },
        target: { nodeId: 'end', portId: 'in' },
      },
    ],
  )
}

/** A runtime whose `onPause` decides how each pause continues. */
function createRuntime(
  onPause: (runtime: NodeWrightRuntime, event: NodeWrightRuntimeEvent) => void,
  options: Partial<NodeWrightRuntimeOptions> = {},
): { runtime: NodeWrightRuntime; events: NodeWrightRuntimeEvent[] } {
  const events: NodeWrightRuntimeEvent[] = []
  const runtime: NodeWrightRuntime = new NodeWrightRuntime({
    definitions,
    runtimeDefinitions,
    ...options,
    onEvent: (event) => {
      events.push(event)

      if (event.type === 'run:pause') {
        queueMicrotask(() => onPause(runtime, event))
      }
    },
  })

  return { runtime, events }
}

function pausedAt(events: NodeWrightRuntimeEvent[]): Array<string | undefined> {
  return events.filter((event) => event.type === 'run:pause').map((event) => event.node?.id)
}

describe('@node-wright/core/runtime run control', () => {
  it('steps into and over nodes until the run is resumed', async () => {
    const actions = ['stepInto', 'stepOver', 'resume'] as const
    const { runtime, events } = createRuntime((target, event) => {
      const action = actions[pausedAt(events).length - 1]!
      void target[action](event.run.runId)
    })
    runtime.setBreakpoint({ nodeId: 'mid' })

    const result = await runtime.run(runtime.compile('start', createChainGraph()).plan!)

    expect(result.status).toBe('success')
    expect(pausedAt(events)).toEqual(['mid', 'mid', 'end'])
    expect(events.filter((event) => event.type === 'run:step')).toHaveLength(2)
    expect(events.filter((event) => event.type === 'run:resume')).toHaveLength(1)
  })

  it('pauses before the next node after a manual pause', async () => {
    const events: NodeWrightRuntimeEvent[] = []
    const runtime: NodeWrightRuntime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        events.push(event)

        if (event.type === 'node:start' && event.node?.id === 'start') {
          runtime.pause(event.run.runId)
        }

        if (event.type === 'run:pause' && event.node) {
          queueMicrotask(() => runtime.resume(event.run.runId))
        }
      },
    })

    const result = await runtime.run(runtime.compile('start', createChainGraph()).plan!)

    expect(result.status).toBe('success')
    expect(pausedAt(events)).toEqual([undefined, 'mid'])
  })

  it('pauses at function and subgraph breakpoints and steps out to the calling node', async () => {
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
      [
        {
          id: 'value',
          kind: 'data',
          source: { nodeId: 'input', portId: 'value' },
          target: { nodeId: 'output', portId: 'value' },
        },
      ],
    )
    const conditions: string[] = []
    const actions = ['resume', 'stepOut', 'resume'] as const
    const { runtime, events } = createRuntime(
      (target, event) => {
        const action = actions[pausedAt(events).length - 1]!
        void target[action](event.run.runId)
      },
      {
        runtimeDefinitions: [
          {
            type: 'event',
            handler: async ({ callFunction, callSubgraph }) => {
              const doubled = await callFunction('double', { value: 21 })
              const wrapped = await callSubgraph('identity', doubled.values)
              return { values: { result: wrapped.values?.value } }
            },
          },
        ],
        functionDefinitions: [
          {
            id: 'double',
            handler: ({ values }) => ({ values: { value: Number(values.value) * 2 } }),
          },
        ],
        subgraphDefinitions: [{ id: 'identity', graph: subgraph, outputNodeId: 'output' }],
      },
    )
    runtime.setBreakpoint({ subgraphId: 'identity' })
    runtime.setBreakpoint({
      id: 'double-breakpoint',
      functionId: 'double',
      condition: ({ functionDefinition, frame }) => {
        conditions.push(`${functionDefinition?.id}:${frame?.kind}:${frame?.depth}`)
        return true
      },
    })
    const graph = createGraph([{ id: 'start', type: 'event', x: 0, y: 0 }])

    const result = await runtime.run(runtime.compile('start', graph).plan!)

    expect(result.status).toBe('success')
    expect(result.nodeStates.start?.values).toEqual({ result: 42 })
    expect(conditions).toEqual(['double:function:1'])
    expect(pausedAt(events)).toEqual([undefined, undefined, 'start'])
    expect(
      events
        .filter((event) => event.type === 'function:start' || event.type === 'subgraph:start')
        .map((event) => event.functionDefinition?.id ?? event.subgraphDefinition?.id),
    ).toEqual(['double', 'identity'])
  })

  it('validates breakpoints and clears them by id', async () => {
    const { runtime, events } = createRuntime((target, event) => target.resume(event.run.runId))

    expect(() => runtime.setBreakpoint({})).toThrow(
      'Breakpoint requires nodeId, functionId, subgraphId, or id.',
    )

    runtime.setBreakpoint({ id: 'mid-breakpoint', nodeId: 'mid' })
    runtime.clearBreakpoint('mid-breakpoint')
    const result = await runtime.run(runtime.compile('start', createChainGraph()).plan!)

    expect(result.status).toBe('success')
    expect(pausedAt(events)).toEqual([])
  })

  it('exposes active runs by id and rejects control of unknown runs', async () => {
    const seen: Array<string | undefined> = []
    const runtime: NodeWrightRuntime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        if (event.type === 'node:start') {
          seen.push(runtime.getRun(event.run.runId)?.status)
        }
      },
    })

    const result = await runtime.run(runtime.compile('start', createChainGraph()).plan!)

    expect(seen).toEqual(['running', 'running', 'running'])
    expect(runtime.getRun(result.runId)).toBeUndefined()
    expect(() => runtime.pause('missing')).toThrow('Run "missing" was not found.')
    expect(() => runtime.resume('missing')).toThrow('Run "missing" was not found.')
    expect(() => runtime.cancel('missing')).toThrow('Run "missing" was not found.')
    await expect(runtime.step('missing')).rejects.toThrow('Run "missing" was not found.')
    await expect(runtime.stepOver('missing')).rejects.toThrow('Run "missing" was not found.')
    await expect(runtime.stepOut('missing')).rejects.toThrow('Run "missing" was not found.')
  })

  it('compiles the configured graph and rejects a plan whose entry node is missing', async () => {
    const graph = createChainGraph()
    const withSource = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      graph: () => graph,
    })
    const withGraph = new NodeWrightRuntime({ definitions, runtimeDefinitions, graph })
    const withoutGraph = new NodeWrightRuntime({ definitions, runtimeDefinitions })

    expect(withSource.compile().plan?.entryNodeId).toBe('start')
    expect(withGraph.compile('mid').plan?.entryNodeId).toBe('mid')
    expect(() => withoutGraph.compile()).toThrow('Runtime graph is required for compile().')

    const plan = withGraph.compile('start').plan!
    await expect(withGraph.run({ ...plan, entryNodeId: 'missing' })).rejects.toThrow(
      'Execution plan entry node "missing" was not found.',
    )
  })
})
