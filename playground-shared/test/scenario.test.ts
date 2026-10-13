import {
  parseGraph,
  resolveNodePorts,
  validateGraph,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { compileGraph } from '@node-engine-sdk/core/runtime'
import { describe, expect, it } from 'vitest'
import { PRESET_NODE_ACCENTS } from '@node-engine-sdk/presets'
import {
  AI_IMAGE_ACCENT,
  AI_IMAGE_DISPLAY_DOM_COMPONENT,
  AI_IMAGE_DISPLAY_NODE_TYPE,
  summarizeAiImageResult,
} from '../src/business/ai-image'
import {
  applyDocumentTheme,
  canvasThemes,
  resolveInitialTheme,
  toggleCanvasTheme,
} from '../src/app/canvas-themes'
import { graphFileName, parseGraphFile, serializeGraphFile } from '../src/app/graph-file'
import {
  countRunOutputs,
  formatRunStatus,
  formatRuntimeEventType,
  listNodeParams,
  listRunOutputs,
  listTraceRows,
} from '../src/demo/runtime-labels'
import { demoScenarios, getDemoScenario, type DemoScenario } from '../src/demo/scenarios'

const scenario = getDemoScenario('ai-image')

/** Diagnostics the editor reports for a graph: protocol structure plus the preset's semantics. */
function diagnose(target: DemoScenario, graph: GraphSnapshot) {
  return validateGraph(graph, {
    nodeDefinitions: target.preset.nodeDefinitions,
    providers: (target.preset.plugins ?? []).flatMap(
      (plugin) => plugin.contributes?.diagnostics ?? [],
    ),
  }).diagnostics
}

describe('playground scenario', () => {
  it('builds a strictly valid AI image graph for both playground apps', () => {
    const graph = scenario.graph()
    const parsed = parseGraph(graph, { nodeDefinitions: scenario.preset.nodeDefinitions })

    expect(parsed.nodes.map((node) => node.id)).toEqual([
      'prompt',
      'image-generate',
      'seed-value',
      'image-display',
    ])
    expect(parsed.edges).toHaveLength(3)
    expect(parsed.groups).toHaveLength(1)
    expect(scenario.graph()).not.toBe(graph)
    expect(demoScenarios.map((entry) => entry.id)).toEqual([
      'ai-image',
      'dataflow',
      'execflow',
      'function',
      'subgraph',
    ])
    expect(() => getDemoScenario('missing')).toThrow('Unknown demo scenario "missing".')
  })

  it('builds every scenario graph to pass strict parsing, diagnostics and compilation', () => {
    for (const entry of demoScenarios) {
      const graph = entry.graph()
      const nodeDefinitions = entry.preset.nodeDefinitions

      expect(parseGraph(graph, { nodeDefinitions }), entry.id).toEqual(graph)
      expect(diagnose(entry, graph), entry.id).toEqual([])
      expect(
        compileGraph({
          graph,
          entryNodeId: entry.runtimeEventId,
          definitions: nodeDefinitions,
          runtimeDefinitions: entry.runtimeDefinitions,
          functionDefinitions: entry.functionDefinitions,
          subgraphDefinitions: entry.subgraphDefinitions,
        }).diagnostics,
        entry.id,
      ).toEqual([])

      for (const subgraph of entry.subgraphDefinitions ?? []) {
        expect(parseGraph(subgraph.graph, { nodeDefinitions }), subgraph.id).toEqual(subgraph.graph)
        expect(diagnose(entry, subgraph.graph), subgraph.id).toEqual([])
      }

      for (const output of entry.outputs) {
        const node = graph.nodes.find((candidate) => candidate.id === output.nodeId)
        const inputs = node ? resolveNodePorts(node, nodeDefinitions) : []

        expect(
          inputs.filter((port) => port.direction === 'input').map((port) => port.id),
          `${entry.id} output ${output.nodeId}`,
        ).toContain(output.portId)
      }
    }
  })

  it('renders every scenario node through DOM and the display node through its component key', () => {
    const nodeTypes = scenario.preset.nodeTypes ?? {}

    for (const entry of demoScenarios) {
      const graphs = [entry.graph(), ...(entry.subgraphDefinitions ?? []).map((sub) => sub.graph)]

      for (const node of graphs.flatMap((graph) => graph.nodes)) {
        expect(entry.preset.nodeTypes?.[node.type]?.dom, `${entry.id} ${node.type}`).toBeTruthy()
      }
    }

    const displayRenderer = nodeTypes[AI_IMAGE_DISPLAY_NODE_TYPE]?.dom

    expect(displayRenderer && displayRenderer.component).toBe(AI_IMAGE_DISPLAY_DOM_COMPONENT)
  })

  it('round-trips graph files through JSON', () => {
    const graph = scenario.graph()
    const text = serializeGraphFile(graph)

    expect(text.endsWith('\n')).toBe(true)
    expect(parseGraphFile(text)).toEqual(graph)
    expect(() => parseGraphFile('{ "nodes": ')).toThrow(SyntaxError)
    expect(demoScenarios.map(graphFileName)).toEqual([
      'ai-image-workflow.json',
      'dataflow-workflow.json',
      'execflow-workflow.json',
      'function-workflow.json',
      'subgraph-workflow.json',
    ])
  })
})

describe('playground presentation helpers', () => {
  it('summarizes the image display result from its generated URL', () => {
    const display = scenario.graph().nodes.find((node) => node.type === AI_IMAGE_DISPLAY_NODE_TYPE)

    if (!display) {
      throw new Error('The scenario has no image display node.')
    }

    const withUrl = (imageUrl: string) => ({ ...display, data: { params: { imageUrl } } })

    expect(summarizeAiImageResult(display)).toEqual({ state: 'empty', label: '等待运行' })
    expect(
      summarizeAiImageResult(
        withUrl('https://image.pollinations.ai/prompt/x?width=512&height=768&seed=7'),
      ),
    ).toEqual({ state: 'ready', label: '512 × 768 · 种子 7' })
    expect(summarizeAiImageResult(withUrl('https://example.com/image.png'))).toEqual({
      state: 'ready',
      label: '已生成',
    })
    expect(summarizeAiImageResult(withUrl('not a url'))).toEqual({
      state: 'invalid',
      label: '图片地址无效',
    })
  })

  it('labels runtime statuses, events and parameters', () => {
    expect(formatRunStatus(undefined)).toBe('空闲')
    expect(formatRunStatus('success')).toBe('成功')
    expect(formatRuntimeEventType('node:success')).toBe('节点成功')
    expect(formatRuntimeEventType('function:start')).toBe('function:start')
    expect(listNodeParams({ seed: 7, model: 'auto' })).toEqual([
      ['seed', '7'],
      ['model', 'auto'],
    ])
    expect(listNodeParams(undefined)).toEqual([])
    expect(listRunOutputs(scenario, null)).toEqual([
      { key: 'image-display:imageUrl', label: '图片地址', value: '等待运行' },
    ])
    expect(countRunOutputs(scenario, null)).toBe(0)
    expect(listTraceRows(null)).toEqual([])
  })

  it('toggles between the editor palettes and follows the system theme at start', () => {
    const prefersLight = (light: boolean) => ({
      matchMedia: (query: string) =>
        ({ matches: light && query === '(prefers-color-scheme: light)' }) as MediaQueryList,
    })
    const document = { documentElement: { dataset: {} as DOMStringMap } } as Document

    expect(canvasThemes.dark.theme).toEqual({ colorScheme: 'dark' })
    expect(canvasThemes.light.theme).toEqual({ colorScheme: 'light' })
    expect(toggleCanvasTheme('dark')).toBe('light')
    expect(toggleCanvasTheme('light')).toBe('dark')
    expect(resolveInitialTheme(prefersLight(true))).toBe('light')
    expect(resolveInitialTheme(prefersLight(false))).toBe('dark')
    expect(resolveInitialTheme(undefined)).toBe('dark')

    applyDocumentTheme(document, 'light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('marks every scenario with the accent of its node family', () => {
    expect(demoScenarios.map((item) => item.accent)).toEqual([
      AI_IMAGE_ACCENT,
      PRESET_NODE_ACCENTS.dataflow,
      PRESET_NODE_ACCENTS.execflow,
      PRESET_NODE_ACCENTS.function,
      PRESET_NODE_ACCENTS.subgraph,
    ])
    expect(
      Object.values(scenario.preset.nodeTypes ?? {})
        .filter((definition) => definition.dom && typeof definition.dom === 'object')
        .every((definition) => definition.accent),
    ).toBe(true)
  })
})
