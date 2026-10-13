import { describe, expect, it, vi } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  parseGraph,
  type GraphMetadata,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { NodeEngineRuntime, type NodeEngineRuntimeNodeContext } from '@node-engine-sdk/core/runtime'
import type { SubgraphDefinition } from '@node-engine-sdk/core/semantics'
import {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createSubgraphCallPorts,
  createSubgraphInputPorts,
  createSubgraphNodesPlugin,
  createSubgraphOutputPorts,
  subgraphCallRuntimeHandler,
  subgraphNodeDefinitions,
  subgraphRuntimeDefinitions,
} from '../../src/nodes/subgraph/index'

const emptyGraph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  groups: [],
  meta: {},
}

/** Child subgraph whose output boundary returns the `value` input as `result`. */
const childSignature: SubgraphDefinition = {
  id: 'child',
  graph: emptyGraph,
  inputs: [{ id: 'value' }],
  outputs: [{ id: 'result' }],
}
const child: SubgraphDefinition = {
  ...childSignature,
  graph: {
    ...emptyGraph,
    nodes: [
      {
        id: 'in',
        type: SUBGRAPH_INPUT_NODE_TYPE,
        x: 0,
        y: 0,
        ports: createSubgraphInputPorts(childSignature),
      },
      {
        id: 'out',
        type: SUBGRAPH_OUTPUT_NODE_TYPE,
        x: 300,
        y: 0,
        ports: createSubgraphOutputPorts(childSignature),
      },
    ],
    edges: [
      {
        id: 'in-to-out',
        kind: 'data',
        source: { nodeId: 'in', portId: 'value' },
        target: { nodeId: 'out', portId: 'result' },
      },
    ],
  },
}

/** Runs one call node whose `data` is given, with `child` registered. */
async function runCallNode(data: GraphMetadata) {
  const graph: GraphSnapshot = {
    ...emptyGraph,
    nodes: [
      {
        id: 'call',
        type: SUBGRAPH_CALL_NODE_TYPE,
        x: 0,
        y: 0,
        ports: createSubgraphCallPorts(child),
        data,
      },
    ],
  }
  const runtime = new NodeEngineRuntime({
    graph,
    definitions: subgraphNodeDefinitions,
    runtimeDefinitions: subgraphRuntimeDefinitions,
    subgraphDefinitions: [child],
  })

  return runtime.run(runtime.compile('call').plan!)
}

describe('@node-engine-sdk/presets/nodes/subgraph', () => {
  it('calls the subgraph named by the subgraphId parameter with every input value', async () => {
    const callSubgraph = vi.fn().mockResolvedValue({
      values: { result: 'ok' },
      data: { completed: true },
    })
    const context = {
      node: { id: 'call', type: SUBGRAPH_CALL_NODE_TYPE, x: 0, y: 0 },
      params: { subgraphId: ' child ' },
      values: { subgraphId: 'other', input: 7 },
      callSubgraph,
    } as unknown as NodeEngineRuntimeNodeContext

    const result = await subgraphCallRuntimeHandler(context)

    expect(callSubgraph).toHaveBeenCalledWith('child', { subgraphId: 'other', input: 7 })
    expect(result).toEqual({
      values: { result: 'ok' },
      data: { completed: true },
    })
  })

  it('reads the subgraph id only from the subgraphId parameter', async () => {
    const missing = 'Error: Subgraph call node "call" requires a non-empty "subgraphId" parameter.'
    const called = await runCallNode({ params: { subgraphId: 'child', value: 5 } })

    expect(called.status).toBe('success')
    expect(called.nodeStates.call?.outputValues).toEqual({ result: 5 })

    for (const data of [{ params: { id: 'child' } }, { id: 'child' }, { params: {} }, {}]) {
      const result = await runCallNode(data)

      expect(result.status, JSON.stringify(data)).toBe('error')
      expect(String(result.error), JSON.stringify(data)).toBe(missing)
    }

    for (const subgraphId of ['', '   ', 7]) {
      expect(String((await runCallNode({ params: { subgraphId } })).error)).toBe(missing)
    }
  })

  it('derives call and boundary ports from one subgraph signature', () => {
    const definition = {
      id: 'child',
      graph: emptyGraph,
      inputs: [
        {
          id: 'input',
          label: 'Input',
          dataType: 'number',
          valueType: { kind: 'number' as const },
          required: true,
        },
      ],
      outputs: [{ id: 'result', dataType: 'number' }],
    }

    expect(createSubgraphCallPorts(definition).map((port) => port.id)).toEqual(['input', 'result'])
    expect(createSubgraphInputPorts(definition)).toEqual([
      expect.objectContaining({ id: 'input', direction: 'output', capacity: 'many' }),
    ])
    expect(createSubgraphOutputPorts(definition)).toEqual([
      expect.objectContaining({ id: 'result', direction: 'input', capacity: 1 }),
    ])
    expect(createSubgraphCallPorts(definition)[0].data).toEqual({
      type: { kind: 'number' },
    })
  })

  it('generates ports without unset fields, so a graph using them passes strict parsing', () => {
    const signature = {
      id: 'bare',
      graph: emptyGraph,
      inputs: [{ id: 'value' }],
      outputs: [{ id: 'result' }],
    }
    const graph: GraphSnapshot = {
      ...emptyGraph,
      nodes: [
        {
          id: 'call',
          type: SUBGRAPH_CALL_NODE_TYPE,
          x: 0,
          y: 0,
          ports: createSubgraphCallPorts(signature),
        },
        {
          id: 'in',
          type: SUBGRAPH_INPUT_NODE_TYPE,
          x: 0,
          y: 0,
          ports: createSubgraphInputPorts(signature),
        },
        {
          id: 'out',
          type: SUBGRAPH_OUTPUT_NODE_TYPE,
          x: 0,
          y: 0,
          ports: createSubgraphOutputPorts(signature),
        },
      ],
    }

    for (const port of graph.nodes.flatMap((node) => node.ports ?? [])) {
      expect(Object.values(port), port.id).not.toContain(undefined)
    }

    expect(parseGraph(graph, { nodeDefinitions: subgraphNodeDefinitions })).toEqual(graph)
  })

  it('rejects a signature whose input and output ids would collide on the call node', () => {
    const definition = {
      id: 'child',
      graph: emptyGraph,
      inputs: [{ id: 'value' }],
      outputs: [{ id: 'value' }],
    }

    for (const createPorts of [
      createSubgraphCallPorts,
      createSubgraphInputPorts,
      createSubgraphOutputPorts,
    ]) {
      expect(() => createPorts(definition)).toThrow(
        'Subgraph "child" has an invalid signature:\n- outputs.0.id: Subgraph "child" output "value" reuses the port id of input 0',
      )
    }
  })

  it('selects call and boundary contributions independently', () => {
    expect(
      createSubgraphNodesPlugin({ includeBoundary: false }).contributes?.nodeDefinitions?.map(
        (definition) => definition.type,
      ),
    ).toEqual([SUBGRAPH_CALL_NODE_TYPE])
    expect(
      createSubgraphNodesPlugin({ includeCall: false }).contributes?.nodeDefinitions?.map(
        (definition) => definition.type,
      ),
    ).toEqual([SUBGRAPH_INPUT_NODE_TYPE, SUBGRAPH_OUTPUT_NODE_TYPE])
  })
})
