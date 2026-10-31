import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime, compileGraph } from '@node-wright/core/runtime'
import {
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from '../../src/nodes/dataflow/index'

function makeGraph(partial: Partial<GraphSnapshot>): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...partial,
  }
}

async function runDataflow(graph: GraphSnapshot, entryNodeId: string) {
  const compiled = compileGraph({
    graph,
    entryNodeId,
    definitions: dataflowNodeDefinitions,
    runtimeDefinitions: dataflowRuntimeDefinitions,
  })

  expect(compiled.valid).toBe(true)

  const runtime = new NodeWrightRuntime({
    definitions: dataflowNodeDefinitions,
    runtimeDefinitions: dataflowRuntimeDefinitions,
  })

  return runtime.run(compiled.plan!)
}

describe('@node-wright/presets/nodes/dataflow handlers', () => {
  it('source emits its param value to downstream nodes', async () => {
    const graph = makeGraph({
      nodes: [
        {
          id: 'src',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 0,
          data: { params: { value: 'hello' } },
        },
        { id: 'preview', type: DATA_PREVIEW_NODE_TYPE, x: 100, y: 0 },
      ],
      edges: [
        {
          id: 'e',
          kind: 'data',
          source: { nodeId: 'src', portId: 'value' },
          target: { nodeId: 'preview', portId: 'value' },
        },
      ],
    })

    const result = await runDataflow(graph, 'preview')

    expect(result.status).toBe('success')
    expect(result.nodeStates.src.outputValues).toEqual({ value: 'hello' })
    expect(result.nodeStates.preview.inputValues).toEqual({ value: 'hello' })
  })

  it('transform applies the configured operation (json, number, boolean, string)', async () => {
    const cases: Array<[string, unknown, unknown]> = [
      ['json', { a: 1 }, '{"a":1}'],
      ['number', '42', 42],
      ['boolean', 0, false],
      ['string', 7, '7'],
      ['pass', { a: 1 }, { a: 1 }],
    ]

    for (const [operation, input, expected] of cases) {
      const graph = makeGraph({
        nodes: [
          {
            id: 'src',
            type: DATA_SOURCE_NODE_TYPE,
            x: 0,
            y: 0,
            data: { params: { value: input } },
          },
          {
            id: 'tx',
            type: DATA_TRANSFORM_NODE_TYPE,
            x: 100,
            y: 0,
            data: { params: { operation } },
          },
          { id: 'pv', type: DATA_PREVIEW_NODE_TYPE, x: 200, y: 0 },
        ],
        edges: [
          {
            id: 'e1',
            kind: 'data',
            source: { nodeId: 'src', portId: 'value' },
            target: { nodeId: 'tx', portId: 'input' },
          },
          {
            id: 'e2',
            kind: 'data',
            source: { nodeId: 'tx', portId: 'output' },
            target: { nodeId: 'pv', portId: 'value' },
          },
        ],
      })

      const result = await runDataflow(graph, 'pv')

      expect(result.status, `op=${operation}`).toBe('success')
      expect(result.nodeStates.tx.outputValues, `op=${operation}`).toEqual({ output: expected })
    }
  })

  it('merge returns a single value when only one input is connected', async () => {
    const graph = makeGraph({
      nodes: [
        {
          id: 'src',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 0,
          data: { params: { value: 'only-a' } },
        },
        { id: 'mg', type: DATA_MERGE_NODE_TYPE, x: 100, y: 0 },
        { id: 'pv', type: DATA_PREVIEW_NODE_TYPE, x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'e1',
          kind: 'data',
          source: { nodeId: 'src', portId: 'value' },
          target: { nodeId: 'mg', portId: 'a' },
        },
        {
          id: 'e2',
          kind: 'data',
          source: { nodeId: 'mg', portId: 'output' },
          target: { nodeId: 'pv', portId: 'value' },
        },
      ],
    })

    const result = await runDataflow(graph, 'pv')

    expect(result.status).toBe('success')
    expect(result.nodeStates.mg.outputValues).toEqual({ output: 'only-a' })
  })

  it('merge wraps both inputs into a tuple when b is connected', async () => {
    const graph = makeGraph({
      nodes: [
        {
          id: 'srcA',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 0,
          data: { params: { value: 'A' } },
        },
        {
          id: 'srcB',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 100,
          data: { params: { value: 'B' } },
        },
        { id: 'mg', type: DATA_MERGE_NODE_TYPE, x: 100, y: 0 },
        { id: 'pv', type: DATA_PREVIEW_NODE_TYPE, x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'ea',
          kind: 'data',
          source: { nodeId: 'srcA', portId: 'value' },
          target: { nodeId: 'mg', portId: 'a' },
        },
        {
          id: 'eb',
          kind: 'data',
          source: { nodeId: 'srcB', portId: 'value' },
          target: { nodeId: 'mg', portId: 'b' },
        },
        {
          id: 'eout',
          kind: 'data',
          source: { nodeId: 'mg', portId: 'output' },
          target: { nodeId: 'pv', portId: 'value' },
        },
      ],
    })

    const result = await runDataflow(graph, 'pv')

    expect(result.status).toBe('success')
    expect(result.nodeStates.mg.outputValues).toEqual({ output: ['A', 'B'] })
  })
})
