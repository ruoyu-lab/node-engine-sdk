import { describe, expect, it, vi } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  parseGraph,
  type GraphMetadata,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import {
  NodeEngineRuntime,
  compileGraph,
  type NodeEngineRuntimeFunctionDefinition,
  type NodeEngineRuntimeFunctionHandler,
} from '@node-engine-sdk/core/runtime'
import {
  DATA_SOURCE_NODE_TYPE,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from '../../src/nodes/dataflow/index'
import {
  FUNCTION_CALL_NODE_TYPE,
  createFunctionCallPorts,
  createFunctionNodesPlugin,
  functionCallNodeDefinitions,
  functionCallRuntimeDefinitions,
} from '../../src/nodes/function/index'

const answer: NodeEngineRuntimeFunctionDefinition = {
  id: 'answer',
  outputs: [{ id: 'result' }],
  handler: () => ({ values: { result: 42 } }),
}

/** Runs one call node whose `data` is given, with `answer` registered. */
async function runCallNode(data: GraphMetadata) {
  const graph: GraphSnapshot = {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [
      {
        id: 'call',
        type: FUNCTION_CALL_NODE_TYPE,
        x: 0,
        y: 0,
        ports: createFunctionCallPorts(answer),
        data,
      },
    ],
    edges: [],
    groups: [],
    meta: {},
  }
  const runtime = new NodeEngineRuntime({
    graph,
    definitions: functionCallNodeDefinitions,
    runtimeDefinitions: functionCallRuntimeDefinitions,
    functionDefinitions: [answer],
  })

  return runtime.run(runtime.compile('call').plan!)
}

describe('@node-engine-sdk/presets/nodes/function', () => {
  it('calls a registered runtime function by node parameter', async () => {
    const graph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        {
          id: 'call',
          type: FUNCTION_CALL_NODE_TYPE,
          x: 0,
          y: 0,
          data: { params: { functionId: 'answer' } },
        },
      ],
      edges: [],
      groups: [],
      meta: {},
    }
    const functionDefinitions = [
      {
        id: 'answer',
        handler: () => ({ values: { result: 42 }, data: 'called' }),
      },
    ]
    const compiled = compileGraph({
      graph,
      entryNodeId: 'call',
      definitions: functionCallNodeDefinitions,
      runtimeDefinitions: functionCallRuntimeDefinitions,
    })
    const runtime = new NodeEngineRuntime({
      definitions: functionCallNodeDefinitions,
      runtimeDefinitions: functionCallRuntimeDefinitions,
      functionDefinitions,
    })

    expect(compiled.valid, JSON.stringify(compiled.diagnostics)).toBe(true)

    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('success')
    expect(result.nodeStates.call.outputValues).toEqual({ result: 42 })
  })

  it('reads the function id only from the functionId parameter', async () => {
    const missing = 'Error: Function call node "call" requires a non-empty "functionId" parameter.'

    expect((await runCallNode({ params: { functionId: ' answer ' } })).nodeStates.call).toEqual(
      expect.objectContaining({ status: 'success', outputValues: { result: 42 } }),
    )

    for (const data of [{ params: { id: 'answer' } }, { id: 'answer' }, { params: {} }, {}]) {
      const result = await runCallNode(data)

      expect(result.status, JSON.stringify(data)).toBe('error')
      expect(String(result.error), JSON.stringify(data)).toBe(missing)
    }

    for (const functionId of ['', '   ', 42]) {
      expect(String((await runCallNode({ params: { functionId } })).error)).toBe(missing)
    }
  })

  it('passes a connected input named functionId to the function instead of selecting by it', async () => {
    const handler = vi.fn<NodeEngineRuntimeFunctionHandler>(({ values }) => ({
      values: { result: values.functionId },
    }))
    const echo: NodeEngineRuntimeFunctionDefinition = {
      id: 'echo',
      inputs: [{ id: 'functionId' }],
      outputs: [{ id: 'result' }],
      handler,
    }
    const graph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        {
          id: 'source',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 0,
          data: { params: { value: 'answer' } },
        },
        {
          id: 'call',
          type: FUNCTION_CALL_NODE_TYPE,
          x: 300,
          y: 0,
          ports: createFunctionCallPorts(echo),
          data: { params: { functionId: 'echo' } },
        },
      ],
      edges: [
        {
          id: 'source-to-call',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'call', portId: 'functionId' },
        },
      ],
      groups: [],
      meta: {},
    }
    const runtime = new NodeEngineRuntime({
      graph,
      definitions: [...dataflowNodeDefinitions, ...functionCallNodeDefinitions],
      runtimeDefinitions: [...dataflowRuntimeDefinitions, ...functionCallRuntimeDefinitions],
      functionDefinitions: [echo, answer],
    })
    const result = await runtime.run(runtime.compile('call').plan!)

    expect(result.status).toBe('success')
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ values: { functionId: 'answer' } }),
    )
    expect(result.nodeStates.call?.outputValues).toEqual({ result: 'answer' })
  })

  it('derives data and optional execution ports from a function signature', () => {
    const ports = createFunctionCallPorts(
      {
        id: 'format',
        inputs: [
          {
            id: 'value',
            name: 'source',
            label: 'Value',
            dataType: 'string',
            required: true,
          },
        ],
        outputs: [{ id: 'result', dataType: 'string' }],
      },
      { includeExecPorts: true },
    )

    expect(ports.map((port) => port.id)).toEqual(['exec:in', 'exec:then', 'value', 'result'])
    expect(ports[2]).toEqual(
      expect.objectContaining({
        name: 'source',
        direction: 'input',
        required: true,
        accepts: ['string'],
      }),
    )
    expect(ports[3]).toEqual(expect.objectContaining({ direction: 'output', capacity: 'many' }))
  })

  it('generates ports without unset fields, so a graph using them passes strict parsing', () => {
    const ports = createFunctionCallPorts(
      { id: 'bare', inputs: [{ id: 'value' }], outputs: [{ id: 'result' }] },
      { includeExecPorts: true },
    )
    const graph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [{ id: 'call', type: FUNCTION_CALL_NODE_TYPE, x: 0, y: 0, ports }],
      edges: [],
      groups: [],
      meta: {},
    }

    for (const port of ports) {
      expect(Object.values(port), port.id).not.toContain(undefined)
    }

    expect(parseGraph(graph, { nodeDefinitions: functionCallNodeDefinitions })).toEqual(graph)
  })

  it('rejects a signature whose input and output ids would collide on the call node', () => {
    expect(() =>
      createFunctionCallPorts({
        id: 'echo',
        inputs: [{ id: 'value' }],
        outputs: [{ id: 'value' }],
      }),
    ).toThrow(
      'Function "echo" has an invalid signature:\n- outputs.0.id: Function "echo" output "value" reuses the port id of input 0',
    )
    expect(() => createFunctionCallPorts({ id: 'echo', outputs: [{ id: 'exec:then' }] })).toThrow(
      'outputs.0.id: Function "echo" output "exec:then" uses an execution port id reserved',
    )
  })

  it('can exclude the call node contribution without retaining another path', () => {
    expect(createFunctionNodesPlugin().contributes?.nodeDefinitions).toHaveLength(1)
    expect(createFunctionNodesPlugin({ includeCall: false }).contributes?.nodeDefinitions).toEqual(
      [],
    )
  })
})
