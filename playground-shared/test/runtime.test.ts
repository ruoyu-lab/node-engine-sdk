import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import { AI_IMAGE_DISPLAY_NODE_TYPE, summarizeAiImageResult } from '../src/business/ai-image'
import { resolveDemoPortValue } from '../src/app/port-values'
import { applyRunResultToGraph } from '../src/app/run-result'
import { canRunScenario, describeRunError, runDemoScenario } from '../src/demo/runtime'
import { countRunOutputs, listRunOutputs, listTraceRows } from '../src/demo/runtime-labels'
import { getDemoScenario } from '../src/demo/scenarios'

const scenario = getDemoScenario('ai-image')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('playground runtime', () => {
  it('runs the AI image workflow and writes the image into the display node', async () => {
    const fetch = vi.fn(async () => new Response('image', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const graph = scenario.graph()

    expect(canRunScenario(scenario)).toBe(true)

    const progress: unknown[] = []
    const run = await runDemoScenario(scenario, graph, scenario.preset.nodeDefinitions, (status) =>
      progress.push(status),
    )

    expect(run.result.status).toBe('success')
    expect(run.result.trace).toHaveLength(4)
    expect(progress).toEqual([{ 'image-display': 'running' }, { 'image-display': 'success' }])
    expect(listTraceRows(run.result).map((row) => row.status)).toEqual([
      'success',
      'success',
      'success',
      'success',
    ])
    expect(run.events.map((event) => event.type)).toEqual([
      'run:success',
      'node:success',
      'node:start',
      'run:start',
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(listRunOutputs(scenario, run.result)).toEqual([
      {
        key: 'image-display:imageUrl',
        label: '图片地址',
        value: expect.stringMatching(/^https:\/\/image\.pollinations\.ai\/prompt\//u),
      },
    ])

    const updated = applyRunResultToGraph(graph, run.result)
    const display = updated.nodes.find((node) => node.type === AI_IMAGE_DISPLAY_NODE_TYPE)

    expect(updated).not.toBe(graph)
    expect(display && summarizeAiImageResult(display)).toEqual({
      state: 'ready',
      label: '1024 × 1024 · 种子 12345',
    })
    expect(applyRunResultToGraph(updated, { ...run.result, nodeStates: {} })).toBe(updated)
  })

  it('reports a failed image request as a failed run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500, statusText: 'Server Error' })),
    )

    const run = await runDemoScenario(scenario, scenario.graph(), scenario.preset.nodeDefinitions)

    expect(run.result.status).toBe('error')
    expect(describeRunError(run.result.error)).toContain('HTTP 500')
    expect(listRunOutputs(scenario, run.result).map((row) => row.value)).toEqual(['错误'])
  })

  it('shows run outputs before parameters on connected ports', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image', { status: 200 })),
    )
    const graph = scenario.graph()
    const seedNode = graph.nodes.find((node) => node.id === 'seed-value')
    const context = { graph, node: seedNode, endpoint: { nodeId: 'seed-value', portId: 'value' } }

    expect(resolveDemoPortValue(context, null, scenario)).toBe(12345)

    const run = await runDemoScenario(scenario, graph, scenario.preset.nodeDefinitions)
    const result = {
      ...run.result,
      nodeStates: {
        ...run.result.nodeStates,
        'seed-value': { nodeId: 'seed-value', status: 'success' as const, values: { value: 7 } },
      },
    }

    expect(resolveDemoPortValue(context, result, scenario)).toBe(7)
  })
})

interface PrimitiveRunExpectation {
  id: string
  outputs: Array<[label: string, value: string]>
  trace: string[]
  events: number
  variables: { run: Record<string, unknown>; graph: Record<string, unknown> }
}

/** Every primitive scenario runs to the same outputs, trace and variables on each run. */
const primitiveRuns: PrimitiveRunExpectation[] = [
  {
    id: 'dataflow',
    outputs: [['预览', '["node-engine-sdk","42"]']],
    trace: [
      'data:preview | df-preview / 成功',
      'data:source | df-name / 成功',
      'data:source | df-build / 成功',
      'data:transform | df-format / 成功',
      'data:merge | df-merge / 成功',
    ],
    events: 4,
    variables: { run: {}, graph: {} },
  },
  {
    id: 'execflow',
    outputs: [
      ['发布日志', '测试版发布说明'],
      ['驳回日志', '未执行'],
    ],
    trace: [
      'exec:event | exec-start / 成功',
      'exec:sequence | exec-sequence / 成功',
      'exec:delay | exec-delay / 成功',
      'exec:set-variable | exec-publish / 成功',
      'exec:get-variable | exec-read-draft / 成功',
      'exec:branch | exec-branch / 成功',
      'exec:get-variable | exec-read-approved / 成功',
      'exec:log | exec-log-approved / 成功',
      'exec:get-variable | exec-read-notes / 成功',
    ],
    events: 14,
    variables: {
      run: { draft: '测试版发布说明', approved: true },
      graph: { notes: '测试版发布说明' },
    },
  },
  {
    id: 'function',
    outputs: [['预览', '你好，Node Engine SDK！（19 字）']],
    trace: [
      'data:preview | fn-preview / 成功',
      'data:source | fn-name / 成功',
      'format-greeting | 函数调用 / 成功',
      'function:call | fn-greet / 成功',
      'append-length | 函数调用 / 成功',
      'function:call | fn-append / 成功',
    ],
    events: 8,
    variables: { run: {}, graph: {} },
  },
  {
    id: 'subgraph',
    outputs: [['预览', '["《Node Engine SDK》","《子图指南》"]']],
    trace: [
      'data:preview | sub-preview / 成功',
      'data:source | sub-main / 成功',
      'title-pipeline | 子图调用 / 成功',
      'data:transform | sg-format / 成功',
      'decorate-title | 函数调用 / 成功',
      'function:call | sg-decorate / 成功',
      'subgraph:call | sub-call-main / 成功',
      'data:source | sub-second / 成功',
      'title-pipeline | 子图调用 / 成功',
      'data:transform | sg-format / 成功',
      'decorate-title | 函数调用 / 成功',
      'function:call | sg-decorate / 成功',
      'subgraph:call | sub-call-second / 成功',
      'data:merge | sub-merge / 成功',
    ],
    events: 12,
    variables: { run: {}, graph: {} },
  },
]

describe('primitive playground scenarios', () => {
  it.each(primitiveRuns)('runs the $id scenario to a deterministic result', async (expected) => {
    const primitive = getDemoScenario(expected.id)

    expect(canRunScenario(primitive)).toBe(true)

    for (const attempt of [1, 2]) {
      const run = await runDemoScenario(
        primitive,
        primitive.graph(),
        primitive.preset.nodeDefinitions,
      )

      expect(run.result.status, `attempt ${attempt}`).toBe('success')
      expect(listRunOutputs(primitive, run.result).map((row) => [row.label, row.value])).toEqual(
        expected.outputs,
      )
      expect(countRunOutputs(primitive, run.result)).toBe(
        expected.outputs.filter(([, value]) => value !== '未执行').length,
      )
      expect(listTraceRows(run.result).map((row) => `${row.title} | ${row.detail}`)).toEqual(
        expected.trace,
      )
      expect(run.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['run:start', 'run:success']),
      )
      expect(run.events).toHaveLength(expected.events)
      expect(new Set(run.events.map((event) => event.id)).size).toBe(expected.events)
      expect(run.result.variables).toMatchObject(expected.variables)
    }
  })

  it('names function and subgraph calls in the event log', async () => {
    const primitive = getDemoScenario('subgraph')
    const run = await runDemoScenario(
      primitive,
      primitive.graph(),
      primitive.preset.nodeDefinitions,
    )

    expect(
      run.events
        .filter((event) => event.type.startsWith('function:') || event.type.startsWith('subgraph:'))
        .map((event) => `${event.type} ${event.detail}`)
        .slice(0, 4),
    ).toEqual([
      'subgraph:success 子图 / title-pipeline',
      'function:success 函数 / decorate-title',
      'function:start 函数 / decorate-title',
      'subgraph:start 子图 / title-pipeline',
    ])
  })

  it('reports a call node without a usable target id as a failed run', async () => {
    const primitive = getDemoScenario('function')
    const withFunctionId = (functionId: string): GraphSnapshot => {
      const graph = primitive.graph()

      return {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === 'fn-greet'
            ? { ...node, data: { ...node.data, params: { functionId } } }
            : node,
        ),
      }
    }

    for (const [functionId, message] of [
      ['', 'Function call node "fn-greet" requires a non-empty "functionId" parameter.'],
      ['missing', 'Function "missing" does not have a runtime handler.'],
    ] as const) {
      const run = await runDemoScenario(
        primitive,
        withFunctionId(functionId),
        primitive.preset.nodeDefinitions,
      )

      expect(run.result.status).toBe('error')
      expect(describeRunError(run.result.error)).toBe(message)
      expect(listRunOutputs(primitive, run.result).map((row) => row.value)).toEqual(['错误'])
    }
  })
})
