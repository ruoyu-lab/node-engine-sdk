import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { NodeEngineRuntime, compileGraph } from '@node-engine-sdk/core/runtime'
import {
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
  EXEC_IN_PORT_ID,
  EXEC_THEN_PORT_ID,
  execflowNodeDefinitions,
  execflowRuntimeDefinitions,
} from '../../src/nodes/execflow/index'
import {
  DATA_SOURCE_NODE_TYPE,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from '../../src/nodes/dataflow/index'

function makeGraph(partial: Partial<GraphSnapshot>): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...partial,
  }
}

async function runExecflow(graph: GraphSnapshot, entryNodeId = 'event') {
  const compiled = compileGraph({
    graph,
    entryNodeId,
    definitions: execflowNodeDefinitions,
    runtimeDefinitions: execflowRuntimeDefinitions,
  })

  expect(compiled.valid, JSON.stringify(compiled.diagnostics)).toBe(true)

  const runtime = new NodeEngineRuntime({
    definitions: execflowNodeDefinitions,
    runtimeDefinitions: execflowRuntimeDefinitions,
  })

  return runtime.run(compiled.plan!)
}

describe('@node-engine-sdk/presets/nodes/execflow handlers', () => {
  it('event → log walks the exec chain and records the message in trace', async () => {
    const graph = makeGraph({
      nodes: [
        { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
        { id: 'log', type: EXEC_LOG_NODE_TYPE, x: 100, y: 0 },
      ],
      edges: [
        {
          id: 'e',
          kind: 'exec',
          source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'log', portId: EXEC_IN_PORT_ID },
        },
      ],
    })

    const result = await runExecflow(graph)

    expect(result.status).toBe('success')
    expect(Object.keys(result.nodeStates).sort()).toEqual(['event', 'log'])
  })

  it('branch picks "true" when condition is true and "false" otherwise', async () => {
    async function runWith(condition: boolean) {
      const graph = makeGraph({
        nodes: [
          { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
          {
            id: 'branch',
            type: EXEC_BRANCH_NODE_TYPE,
            x: 100,
            y: 0,
            data: { params: {} },
            ports: [
              { id: EXEC_IN_PORT_ID, direction: 'input', kind: 'exec' },
              {
                id: 'condition',
                direction: 'input',
                kind: 'data',
                dataType: 'boolean',
                accepts: ['boolean'],
              },
              { id: 'true', direction: 'output', kind: 'exec' },
              { id: 'false', direction: 'output', kind: 'exec' },
            ],
          },
          { id: 'onTrue', type: EXEC_LOG_NODE_TYPE, x: 200, y: -50 },
          { id: 'onFalse', type: EXEC_LOG_NODE_TYPE, x: 200, y: 50 },
          {
            id: 'srcCond',
            type: 'data:source',
            x: 0,
            y: 100,
            data: { params: { value: condition } },
            ports: [{ id: 'value', direction: 'output', kind: 'data', dataType: 'boolean' }],
          },
        ],
        edges: [
          {
            id: 'e0',
            kind: 'exec',
            source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
            target: { nodeId: 'branch', portId: EXEC_IN_PORT_ID },
          },
          {
            id: 'eCond',
            kind: 'data',
            source: { nodeId: 'srcCond', portId: 'value' },
            target: { nodeId: 'branch', portId: 'condition' },
          },
          {
            id: 'eTrue',
            kind: 'exec',
            source: { nodeId: 'branch', portId: 'true' },
            target: { nodeId: 'onTrue', portId: EXEC_IN_PORT_ID },
          },
          {
            id: 'eFalse',
            kind: 'exec',
            source: { nodeId: 'branch', portId: 'false' },
            target: { nodeId: 'onFalse', portId: EXEC_IN_PORT_ID },
          },
        ],
      })

      const compiled = compileGraph({
        graph,
        entryNodeId: 'event',
        definitions: [
          ...execflowNodeDefinitions,
          {
            type: 'data:source',
            ports: [{ id: 'value', direction: 'output', kind: 'data' }],
          },
        ],
        runtimeDefinitions: [
          ...execflowRuntimeDefinitions,
          {
            type: 'data:source',
            handler: ({ node }) => ({
              values: { value: (node.data as { params: { value: unknown } })?.params?.value },
            }),
          },
        ],
      })

      expect(compiled.valid).toBe(true)
      const runtime = new NodeEngineRuntime({
        definitions: execflowNodeDefinitions,
        runtimeDefinitions: execflowRuntimeDefinitions,
        handlers: {
          'data:source': ({ node }) => ({
            values: { value: (node.data as { params: { value: unknown } })?.params?.value },
          }),
        },
      })

      return runtime.run(compiled.plan!)
    }

    const truthy = await runWith(true)
    expect(truthy.nodeStates.onTrue?.status).toBe('success')
    expect(truthy.nodeStates.onFalse).toBeUndefined()

    const falsy = await runWith(false)
    expect(falsy.nodeStates.onFalse?.status).toBe('success')
    expect(falsy.nodeStates.onTrue).toBeUndefined()
  })

  it('sequence fans out exec to every connected then:N output', async () => {
    const graph = makeGraph({
      nodes: [
        { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
        { id: 'seq', type: EXEC_SEQUENCE_NODE_TYPE, x: 100, y: 0 },
        { id: 'a', type: EXEC_LOG_NODE_TYPE, x: 200, y: -50 },
        { id: 'b', type: EXEC_LOG_NODE_TYPE, x: 200, y: 50 },
      ],
      edges: [
        {
          id: 'e0',
          kind: 'exec',
          source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'seq', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'e1',
          kind: 'exec',
          source: { nodeId: 'seq', portId: 'then:0' },
          target: { nodeId: 'a', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'e2',
          kind: 'exec',
          source: { nodeId: 'seq', portId: 'then:1' },
          target: { nodeId: 'b', portId: EXEC_IN_PORT_ID },
        },
      ],
    })

    const result = await runExecflow(graph)

    expect(result.status).toBe('success')
    expect(result.nodeStates.a?.status).toBe('success')
    expect(result.nodeStates.b?.status).toBe('success')
  })

  it('delay node resolves after the configured duration without blocking the run', async () => {
    const graph = makeGraph({
      nodes: [
        { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
        {
          id: 'delay',
          type: EXEC_DELAY_NODE_TYPE,
          x: 100,
          y: 0,
          data: { params: { durationMs: 10 } },
        },
        { id: 'log', type: EXEC_LOG_NODE_TYPE, x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'e0',
          kind: 'exec',
          source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'delay', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'e1',
          kind: 'exec',
          source: { nodeId: 'delay', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'log', portId: EXEC_IN_PORT_ID },
        },
      ],
    })

    const start = Date.now()
    const result = await runExecflow(graph)
    const elapsed = Date.now() - start

    expect(result.status).toBe('success')
    expect(elapsed).toBeGreaterThanOrEqual(10)
    expect(result.nodeStates.log?.status).toBe('success')
  })

  it('set-variable writes to run scope, get-variable reads it back', async () => {
    const graph = makeGraph({
      nodes: [
        { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
        {
          id: 'set',
          type: EXEC_SET_VARIABLE_NODE_TYPE,
          x: 100,
          y: 0,
          data: { params: { name: 'counter', scope: 'run' } },
          // `name` and `scope` are parameter input ports contributed by the node definition.
          ports: [
            { id: EXEC_IN_PORT_ID, direction: 'input', kind: 'exec' },
            { id: 'value', direction: 'input', kind: 'data', dataType: 'any' },
            { id: EXEC_THEN_PORT_ID, direction: 'output', kind: 'exec' },
          ],
        },
        {
          id: 'src',
          type: 'data:source',
          x: 0,
          y: 100,
          data: { params: { value: 42 } },
          ports: [{ id: 'value', direction: 'output', kind: 'data', dataType: 'number' }],
        },
        {
          id: 'get',
          type: EXEC_GET_VARIABLE_NODE_TYPE,
          x: 300,
          y: 0,
          data: { params: { name: 'counter', scope: 'run' } },
        },
        {
          id: 'preview',
          type: 'data:preview',
          x: 400,
          y: 0,
          ports: [
            { id: 'value', direction: 'input', kind: 'data', dataType: 'any', required: true },
          ],
        },
        {
          id: 'tail',
          type: EXEC_LOG_NODE_TYPE,
          x: 200,
          y: 0,
        },
      ],
      edges: [
        {
          id: 'e0',
          kind: 'exec',
          source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'set', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'eVal',
          kind: 'data',
          source: { nodeId: 'src', portId: 'value' },
          target: { nodeId: 'set', portId: 'value' },
        },
        {
          id: 'e1',
          kind: 'exec',
          source: { nodeId: 'set', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'tail', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'eGet',
          kind: 'data',
          source: { nodeId: 'get', portId: 'value' },
          target: { nodeId: 'preview', portId: 'value' },
        },
      ],
    })

    const sourcePreviewDefinitions = [
      ...execflowNodeDefinitions,
      { type: 'data:source', ports: [{ id: 'value', direction: 'output' as const, kind: 'data' }] },
      {
        type: 'data:preview',
        ports: [{ id: 'value', direction: 'input' as const, kind: 'data', required: true }],
      },
    ]
    const sourcePreviewHandlers = {
      'data:source': ({ node }: { node: { data?: unknown } }) => ({
        values: { value: (node.data as { params: { value: unknown } })?.params?.value },
      }),
      'data:preview': ({ values }: { values: Record<string, unknown> }) => ({
        data: values.value,
      }),
    }

    const compiled = compileGraph({
      graph,
      entryNodeId: 'event',
      definitions: sourcePreviewDefinitions,
      runtimeDefinitions: [
        ...execflowRuntimeDefinitions,
        { type: 'data:source', handler: sourcePreviewHandlers['data:source'] },
        { type: 'data:preview', handler: sourcePreviewHandlers['data:preview'] },
      ],
    })

    expect(compiled.valid, JSON.stringify(compiled.diagnostics)).toBe(true)

    const runtime = new NodeEngineRuntime({
      definitions: sourcePreviewDefinitions,
      runtimeDefinitions: execflowRuntimeDefinitions,
      handlers: sourcePreviewHandlers,
    })
    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('success')
    expect(result.variables.run?.counter).toBe(42)
  })

  it('reads parameters locally unless their input port is driven by a connection', async () => {
    const definitions = [...execflowNodeDefinitions, ...dataflowNodeDefinitions]
    const runtimeDefinitions = [...execflowRuntimeDefinitions, ...dataflowRuntimeDefinitions]
    const graph = makeGraph({
      nodes: [
        { id: 'event', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
        {
          id: 'local',
          type: EXEC_LOG_NODE_TYPE,
          x: 100,
          y: 0,
          data: { params: { message: 'hi' } },
        },
        {
          id: 'driven',
          type: EXEC_LOG_NODE_TYPE,
          x: 200,
          y: 0,
          data: { params: { message: 'ignored' } },
        },
        {
          id: 'wait',
          type: EXEC_DELAY_NODE_TYPE,
          x: 300,
          y: 0,
          data: { params: { durationMs: 0 } },
        },
        {
          id: 'source',
          type: DATA_SOURCE_NODE_TYPE,
          x: 0,
          y: 100,
          data: { params: { value: 15 } },
        },
      ],
      edges: [
        {
          id: 'e0',
          kind: 'exec',
          source: { nodeId: 'event', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'local', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'e1',
          kind: 'exec',
          source: { nodeId: 'local', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'driven', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'e2',
          kind: 'exec',
          source: { nodeId: 'driven', portId: EXEC_THEN_PORT_ID },
          target: { nodeId: 'wait', portId: EXEC_IN_PORT_ID },
        },
        {
          id: 'message',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'driven', portId: 'message' },
        },
        {
          id: 'duration',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'wait', portId: 'durationMs' },
        },
      ],
    })
    const compiled = compileGraph({ graph, entryNodeId: 'event', definitions, runtimeDefinitions })

    expect(compiled.valid, JSON.stringify(compiled.diagnostics)).toBe(true)

    const start = Date.now()
    const result = await new NodeEngineRuntime({ definitions, runtimeDefinitions }).run(
      compiled.plan!,
    )
    const summary = (nodeId: string) =>
      result.trace.find((entry) => entry.nodeId === nodeId)?.outputSummary

    expect(result.status).toBe('success')
    expect(summary('local')).toMatchObject({ data: 'hi' })
    expect(summary('driven')).toMatchObject({ data: 15 })
    expect(Date.now() - start).toBeGreaterThanOrEqual(15)
  })

  it('declares every editable value as a parameter with its own input port', () => {
    const byType = new Map(
      execflowNodeDefinitions.map((definition) => [definition.type, definition]),
    )
    const parameterPorts = (type: string) =>
      (byType.get(type)?.parameters ?? []).map((parameter) => [
        parameter.key,
        typeof parameter.input === 'object' ? parameter.input.portId : undefined,
      ])

    expect(parameterPorts(EXEC_DELAY_NODE_TYPE)).toEqual([['durationMs', 'durationMs']])
    expect(parameterPorts(EXEC_LOG_NODE_TYPE)).toEqual([['message', 'message']])
    expect(parameterPorts(EXEC_SET_VARIABLE_NODE_TYPE)).toEqual([
      ['scope', 'scope'],
      ['name', 'name'],
    ])
    expect(parameterPorts(EXEC_GET_VARIABLE_NODE_TYPE)).toEqual([
      ['scope', 'scope'],
      ['name', 'name'],
    ])

    for (const definition of execflowNodeDefinitions) {
      const portIds = (definition.ports ?? []).map((port) => port.id)

      for (const parameter of definition.parameters ?? []) {
        expect(portIds).not.toContain(parameter.key)
      }
    }
  })
})
