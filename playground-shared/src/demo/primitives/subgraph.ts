import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type {
  NodeEngineRuntimeFunctionDefinition,
  NodeEngineRuntimeSubgraphDefinition,
} from '@node-engine-sdk/core/runtime'
import {
  PRESET_NODE_ACCENTS,
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  FUNCTION_CALL_NODE_TYPE,
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createFunctionCallPorts,
  createHybridFlowPreset,
  createSubgraphCallPorts,
  createSubgraphInputPorts,
  createSubgraphOutputPorts,
} from '@node-engine-sdk/presets'
import type { DemoScenario } from '../scenarios'
import { dataEdge, groupOf, primitiveNode, snapshotOf } from './graph'

const preset = createHybridFlowPreset()

const decorateTitleFunction: NodeEngineRuntimeFunctionDefinition = {
  id: 'decorate-title',
  label: '加书名号',
  mode: 'pure',
  inputs: [{ id: 'text', label: '文本', dataType: 'string', required: true }],
  outputs: [{ id: 'title', label: '标题', dataType: 'string' }],
  handler: ({ values }) => ({ values: { title: `《${String(values.text)}》` } }),
}

const titlePipelineSignature: NodeEngineRuntimeSubgraphDefinition = {
  id: 'title-pipeline',
  label: '标题流水线',
  graph: snapshotOf({ subgraph: 'title-pipeline' }, [], []),
  inputs: [{ id: 'text', label: '文本', dataType: 'any', required: true }],
  outputs: [{ id: 'title', label: '标题', dataType: 'string' }],
}

/**
 * Registered subgraph: its input boundary passes the text through a string conversion and the
 * `decorate-title` function to its output boundary.
 */
const titlePipelineSubgraph: NodeEngineRuntimeSubgraphDefinition = {
  ...titlePipelineSignature,
  inputNodeId: 'sg-input',
  outputNodeId: 'sg-output',
  graph: snapshotOf(
    { subgraph: titlePipelineSignature.id },
    [
      primitiveNode('sg-input', SUBGRAPH_INPUT_NODE_TYPE, {
        title: '子图输入',
        position: { x: 40, y: 80 },
        width: 220,
        height: 112,
        ports: createSubgraphInputPorts(titlePipelineSignature),
      }),
      primitiveNode('sg-format', DATA_TRANSFORM_NODE_TYPE, {
        title: '转为字符串',
        position: { x: 320, y: 60 },
        width: 248,
        height: 150,
        params: { operation: 'string' },
      }),
      primitiveNode('sg-decorate', FUNCTION_CALL_NODE_TYPE, {
        title: '加书名号',
        position: { x: 620, y: 60 },
        width: 260,
        height: 160,
        params: { functionId: decorateTitleFunction.id },
        ports: createFunctionCallPorts(decorateTitleFunction),
      }),
      primitiveNode('sg-output', SUBGRAPH_OUTPUT_NODE_TYPE, {
        title: '子图输出',
        position: { x: 940, y: 80 },
        width: 220,
        height: 112,
        ports: createSubgraphOutputPorts(titlePipelineSignature),
      }),
    ],
    [
      dataEdge('sg-input-to-format', ['sg-input', 'text'], ['sg-format', 'input']),
      dataEdge('sg-format-to-decorate', ['sg-format', 'output'], ['sg-decorate', 'text']),
      dataEdge('sg-decorate-to-output', ['sg-decorate', 'title'], ['sg-output', 'title']),
    ],
  ),
}

/** Two call nodes reuse one registered subgraph; a merge collects both results for the preview. */
export const subgraphScenario: DemoScenario = {
  id: 'subgraph',
  title: '子图复用',
  eyebrow: '子图原语',
  accent: PRESET_NODE_ACCENTS.subgraph,
  summary:
    '两个调用子图节点复用 Runtime 中注册的“标题流水线”子图：子图输入经转换和函数调用到达子图输出，结果合并后预览。',
  graph: createSubgraphGraph,
  preset,
  runtimeDefinitions: preset.runtimeDefinitions,
  functionDefinitions: [decorateTitleFunction],
  subgraphDefinitions: [titlePipelineSubgraph],
  runtimeEventId: 'sub-preview',
  outputs: [{ nodeId: 'sub-preview', portId: 'value', label: '预览' }],
}

function createSubgraphGraph(): GraphSnapshot {
  const nodes = [
    primitiveNode('sub-main', DATA_SOURCE_NODE_TYPE, {
      title: '主标题',
      position: { x: 60, y: 100 },
      width: 240,
      height: 150,
      params: { value: 'Node Engine SDK' },
    }),
    primitiveNode('sub-second', DATA_SOURCE_NODE_TYPE, {
      title: '副标题',
      position: { x: 60, y: 330 },
      width: 240,
      height: 150,
      params: { value: '子图指南' },
    }),
    primitiveNode('sub-call-main', SUBGRAPH_CALL_NODE_TYPE, {
      title: '包装主标题',
      position: { x: 360, y: 100 },
      width: 260,
      height: 160,
      params: { subgraphId: titlePipelineSubgraph.id },
      ports: createSubgraphCallPorts(titlePipelineSubgraph),
    }),
    primitiveNode('sub-call-second', SUBGRAPH_CALL_NODE_TYPE, {
      title: '包装副标题',
      position: { x: 360, y: 330 },
      width: 260,
      height: 160,
      params: { subgraphId: titlePipelineSubgraph.id },
      ports: createSubgraphCallPorts(titlePipelineSubgraph),
    }),
    primitiveNode('sub-merge', DATA_MERGE_NODE_TYPE, {
      title: '合并',
      position: { x: 680, y: 220 },
      width: 220,
      height: 130,
    }),
    primitiveNode('sub-preview', DATA_PREVIEW_NODE_TYPE, {
      title: '预览',
      position: { x: 950, y: 230 },
      width: 220,
      height: 112,
    }),
  ]

  return snapshotOf(
    { scenario: 'subgraph' },
    nodes,
    [
      dataEdge('sub-main-to-call', ['sub-main', 'value'], ['sub-call-main', 'text']),
      dataEdge('sub-second-to-call', ['sub-second', 'value'], ['sub-call-second', 'text']),
      dataEdge('sub-call-main-to-merge', ['sub-call-main', 'title'], ['sub-merge', 'a']),
      dataEdge('sub-call-second-to-merge', ['sub-call-second', 'title'], ['sub-merge', 'b']),
      dataEdge('sub-merge-to-preview', ['sub-merge', 'output'], ['sub-preview', 'value']),
    ],
    [groupOf('sub-group', '子图调用', { x: 24, y: 48, width: 1180, height: 480 }, nodes)],
  )
}
