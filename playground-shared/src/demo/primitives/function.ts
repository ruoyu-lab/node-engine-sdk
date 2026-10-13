import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type { NodeEngineRuntimeFunctionDefinition } from '@node-engine-sdk/core/runtime'
import {
  PRESET_NODE_ACCENTS,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  FUNCTION_CALL_NODE_TYPE,
  createFunctionCallPorts,
  createHybridFlowPreset,
} from '@node-engine-sdk/presets'
import type { DemoScenario } from '../scenarios'
import { dataEdge, groupOf, primitiveNode, snapshotOf } from './graph'

const preset = createHybridFlowPreset()

const formatGreetingFunction: NodeEngineRuntimeFunctionDefinition = {
  id: 'format-greeting',
  label: '格式化问候',
  mode: 'pure',
  inputs: [{ id: 'name', label: '名称', dataType: 'string', required: true }],
  outputs: [{ id: 'message', label: '消息', dataType: 'string' }],
  handler: ({ values }) => ({ values: { message: `你好，${String(values.name)}！` } }),
}

const appendLengthFunction: NodeEngineRuntimeFunctionDefinition = {
  id: 'append-length',
  label: '附加字数',
  mode: 'pure',
  inputs: [{ id: 'text', label: '文本', dataType: 'string', required: true }],
  outputs: [{ id: 'summary', label: '摘要', dataType: 'string' }],
  handler: ({ values }) => {
    const text = String(values.text)

    return { values: { summary: `${text}（${Array.from(text).length} 字）` } }
  },
}

/**
 * Two call nodes chain registered functions; each node's ports come from its function signature
 * and its `functionId` parameter names the function it calls.
 */
export const functionScenario: DemoScenario = {
  id: 'function',
  title: '函数调用链',
  eyebrow: '函数原语',
  accent: PRESET_NODE_ACCENTS.function,
  summary:
    '调用函数节点按函数 id 参数调用 Runtime 中注册的函数，端口由函数签名生成。问候语再交给第二个函数附加字数。',
  graph: createFunctionGraph,
  preset,
  runtimeDefinitions: preset.runtimeDefinitions,
  functionDefinitions: [formatGreetingFunction, appendLengthFunction],
  runtimeEventId: 'fn-preview',
  outputs: [{ nodeId: 'fn-preview', portId: 'value', label: '预览' }],
}

function createFunctionGraph(): GraphSnapshot {
  const nodes = [
    primitiveNode('fn-name', DATA_SOURCE_NODE_TYPE, {
      title: '名称',
      position: { x: 60, y: 160 },
      width: 240,
      height: 150,
      params: { value: 'Node Engine SDK' },
    }),
    primitiveNode('fn-greet', FUNCTION_CALL_NODE_TYPE, {
      title: '格式化问候',
      position: { x: 360, y: 150 },
      width: 260,
      height: 160,
      params: { functionId: formatGreetingFunction.id },
      ports: createFunctionCallPorts(formatGreetingFunction),
    }),
    primitiveNode('fn-append', FUNCTION_CALL_NODE_TYPE, {
      title: '附加字数',
      position: { x: 680, y: 150 },
      width: 260,
      height: 160,
      params: { functionId: appendLengthFunction.id },
      ports: createFunctionCallPorts(appendLengthFunction),
    }),
    primitiveNode('fn-preview', DATA_PREVIEW_NODE_TYPE, {
      title: '预览',
      position: { x: 1000, y: 170 },
      width: 220,
      height: 112,
    }),
  ]

  return snapshotOf(
    { scenario: 'function' },
    nodes,
    [
      dataEdge('fn-name-to-greet', ['fn-name', 'value'], ['fn-greet', 'name']),
      dataEdge('fn-greet-to-append', ['fn-greet', 'message'], ['fn-append', 'text']),
      dataEdge('fn-append-to-preview', ['fn-append', 'summary'], ['fn-preview', 'value']),
    ],
    [groupOf('fn-group', '函数调用链', { x: 24, y: 80, width: 1230, height: 300 }, nodes)],
  )
}
