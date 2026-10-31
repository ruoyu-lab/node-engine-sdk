import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'
import {
  NodeWrightRuntime,
  compileGraph,
  type NodeWrightRuntimeNodeDefinition,
} from '../../src/runtime/index'

describe('@node-wright/core/runtime large graphs', () => {
  it('compiles and executes a 5,000-node dependency chain without recursive overflow', async () => {
    const size = 5_000
    const definition: SemanticNodeDefinition = {
      type: 'data',
      ports: [
        { id: 'input', direction: 'input', kind: 'data' },
        { id: 'output', direction: 'output', kind: 'data' },
      ],
      capabilities: ['event', 'pure'],
    }
    const runtimeDefinition: NodeWrightRuntimeNodeDefinition = {
      type: definition.type,
      handler: ({ values }) => ({ values: { output: values.input } }),
    }
    const graph: GraphSnapshot = {
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      nodes: Array.from({ length: size }, (_, index) => ({
        id: `node-${index}`,
        type: definition.type,
        x: index,
        y: 0,
      })),
      edges: Array.from({ length: size - 1 }, (_, index) => ({
        id: `edge-${index}`,
        kind: 'data',
        source: { nodeId: `node-${index}`, portId: 'output' },
        target: { nodeId: `node-${index + 1}`, portId: 'input' },
      })),
      groups: [],
      meta: {},
    }
    const result = compileGraph({
      graph,
      entryNodeId: `node-${size - 1}`,
      definitions: [definition],
      runtimeDefinitions: [runtimeDefinition],
    })

    expect(result.valid).toBe(true)
    expect(result.plan?.nodeOrder).toHaveLength(size)
    expect(result.plan?.nodeOrder[0]).toBe('node-0')
    expect(result.plan?.nodeOrder[size - 1]).toBe(`node-${size - 1}`)

    const runtime = new NodeWrightRuntime({
      definitions: [definition],
      runtimeDefinitions: [runtimeDefinition],
      debug: {
        captureInputs: false,
        captureOutputs: false,
        captureCallStack: false,
      },
    })
    const execution = await runtime.run(result.plan!)

    expect(execution.status).toBe('success')
    expect(Object.keys(execution.nodeStates)).toHaveLength(size)
  })
})
