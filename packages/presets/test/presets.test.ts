import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  type GraphNode,
  type GraphSnapshot,
  type GraphValue,
} from '@node-wright/core/protocol'
import { resolveDomNodeDefinition, resolveDomNodeFields } from '@node-wright/core/view'
import { describe, expect, it } from 'vitest'
import * as presets from '../src/index'
import {
  createDataflowPreset,
  createExecflowPreset,
  createFunctionPreset,
  createHybridFlowPreset,
  createSubgraphPreset,
} from '../src/index'
import * as functionNodes from '../src/nodes/function/index'
import * as subgraphNodes from '../src/nodes/subgraph/index'

describe('standard presets', () => {
  it('provides matching editor, semantic, runtime, viewport, and layout capabilities', () => {
    const preset = createDataflowPreset()
    const definitionTypes = preset.nodeDefinitions.map((definition) => definition.type).sort()
    const runtimeTypes = preset.runtimeDefinitions.map((definition) => definition.type).sort()

    expect(Object.keys(preset.nodeTypes ?? {}).sort()).toEqual(definitionTypes)
    expect(runtimeTypes).toEqual(definitionTypes)
    expect(preset.plugins).toHaveLength(1)
    expect(preset.initialViewport).toEqual({ x: 48, y: 40, zoom: 0.9 })

    const graph = createGraph(definitionTypes[0]!, definitionTypes[1]!)
    const result = preset.layout.run(graph)
    const applied = preset.layout.apply(graph)

    expect(result.nodes).toHaveLength(2)
    expect(applied).not.toBe(graph)
    expect(applied.nodes[1]?.x).toBeGreaterThan(applied.nodes[0]?.x ?? 0)
    expect(graph.nodes.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ])
  })

  it('removes editor and runtime defaults together when a preset opts out', () => {
    for (const preset of [
      createDataflowPreset({ includeDefaultNodes: false }),
      createExecflowPreset({ includeDefaultNodes: false }),
      createFunctionPreset({ includeDefaultNodes: false }),
      createSubgraphPreset({ includeDefaultNodes: false }),
    ]) {
      expect(preset.nodeDefinitions).toEqual([])
      expect(preset.runtimeDefinitions).toEqual([])
      expect(preset.nodeTypes).toEqual({})
    }
  })

  it('exports the call and boundary port builders from the root entry', () => {
    // Graphs that call functions or subgraphs need these builders; the root entry alone suffices.
    expect(presets.createFunctionCallPorts).toBe(functionNodes.createFunctionCallPorts)
    expect(presets.createSubgraphCallPorts).toBe(subgraphNodes.createSubgraphCallPorts)
    expect(presets.createSubgraphInputPorts).toBe(subgraphNodes.createSubgraphInputPorts)
    expect(presets.createSubgraphOutputPorts).toBe(subgraphNodes.createSubgraphOutputPorts)
  })

  it('assembles the complete hybrid preset without duplicate definitions', () => {
    const preset = createHybridFlowPreset()
    const definitionTypes = preset.nodeDefinitions.map((definition) => definition.type)
    const runtimeTypes = preset.runtimeDefinitions.map((definition) => definition.type)

    expect(new Set(definitionTypes).size).toBe(definitionTypes.length)
    expect(new Set(runtimeTypes).size).toBe(runtimeTypes.length)
    expect(runtimeTypes.length).toBeGreaterThan(0)
    expect(preset.layout.options.edgeKinds).toEqual(['data', 'exec'])
  })
})

describe('standard preset DOM fields', () => {
  const preset = createHybridFlowPreset()

  function fieldsOf(type: string, params: Record<string, GraphValue> = {}) {
    const schema = preset.nodeDefinitions.find((definition) => definition.type === type)
    const definition = preset.nodeTypes?.[type]
    const node: GraphNode = { id: type, type, x: 0, y: 0, data: { params } }
    // Only `definition` and `node` are read to resolve the renderer defaults.
    const domDefinition = resolveDomNodeDefinition({
      node,
      schema,
      definition,
    } as unknown as Parameters<typeof resolveDomNodeDefinition>[0])

    return resolveDomNodeFields({ node, schema }, domDefinition)
  }

  it('shows a field for every parameter of the primitive nodes', () => {
    const keys = (type: string) => fieldsOf(type).map((field) => field.key)

    expect(keys('exec:delay')).toEqual(['durationMs'])
    expect(keys('exec:log')).toEqual(['message'])
    expect(keys('exec:set-variable')).toEqual(['scope', 'name'])
    expect(keys('exec:get-variable')).toEqual(['scope', 'name'])
    expect(keys('function:call')).toEqual(['functionId'])
    expect(keys('subgraph:call')).toEqual(['subgraphId'])
    expect(keys('data:source')).toEqual(['value'])
    expect(keys('data:transform')).toEqual(['operation'])
    expect(keys('exec:event')).toEqual([])
  })

  it('keeps display hints and the value domain of the parameter together', () => {
    const [duration] = fieldsOf('exec:delay', { durationMs: 250 })
    const [scope] = fieldsOf('exec:set-variable', { scope: 'graph' })
    const [operation] = fieldsOf('data:transform', { operation: 'json' })

    expect(duration).toMatchObject({ label: '时长', kind: 'number', value: 250, min: 0, step: 50 })
    expect(duration!.inputPortId).toBe('durationMs')
    expect(scope).toMatchObject({ label: '作用域', kind: 'select', value: 'graph' })
    expect(scope!.options?.map((option) => option.value)).toEqual(['run', 'graph', 'node'])
    expect(operation).toMatchObject({ label: '操作', kind: 'select' })
    expect(operation!.options?.map((option) => option.label)).toEqual([
      '透传',
      '字符串',
      '数字',
      '布尔值',
      'JSON',
    ])
  })

  it('only gives display hints for declared parameters', () => {
    for (const [type, nodeType] of Object.entries(preset.nodeTypes ?? {})) {
      const defaults = nodeType.dom && typeof nodeType.dom === 'object' ? nodeType.dom.defaults : {}
      const hints = typeof defaults === 'function' ? [] : (defaults?.fields ?? [])
      const parameterKeys = (
        preset.nodeDefinitions.find((definition) => definition.type === type)?.parameters ?? []
      ).map((parameter) => parameter.key)

      for (const hint of hints) {
        expect(parameterKeys, `${type} hint ${hint.key}`).toContain(hint.key)
      }
    }
  })
})

function createGraph(sourceType: string, targetType: string): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'source', type: sourceType, x: 0, y: 0, width: 200, height: 100 },
      { id: 'target', type: targetType, x: 0, y: 0, width: 200, height: 100 },
    ],
    edges: [
      {
        id: 'edge',
        kind: 'data',
        source: { nodeId: 'source', portId: 'value' },
        target: { nodeId: 'target', portId: 'input' },
      },
    ],
    groups: [],
    meta: {},
  }
}
