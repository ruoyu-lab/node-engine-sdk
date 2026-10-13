import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import {
  PRESET_NODE_ACCENTS,
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  createDataflowPreset,
} from '@node-engine-sdk/presets'
import type { DemoScenario } from '../scenarios'
import { dataEdge, groupOf, primitiveNode, snapshotOf } from './graph'

const preset = createDataflowPreset()

/** Two sources, a string conversion and a merge feed one preview, the entry of the run. */
export const dataflowScenario: DemoScenario = {
  id: 'dataflow',
  title: '数据流管线',
  eyebrow: '数据流原语',
  accent: PRESET_NODE_ACCENTS.dataflow,
  summary:
    '数据源、转换、合并与预览组成的纯数据管线。以预览节点为入口，Runtime 沿数据依赖向上游求值。',
  graph: createDataflowGraph,
  preset,
  runtimeDefinitions: preset.runtimeDefinitions,
  runtimeEventId: 'df-preview',
  outputs: [{ nodeId: 'df-preview', portId: 'value', label: '预览' }],
}

function createDataflowGraph(): GraphSnapshot {
  const nodes = [
    primitiveNode('df-name', DATA_SOURCE_NODE_TYPE, {
      title: '名称',
      position: { x: 80, y: 100 },
      width: 248,
      height: 150,
      params: { value: 'node-engine-sdk' },
    }),
    primitiveNode('df-build', DATA_SOURCE_NODE_TYPE, {
      title: '构建号',
      position: { x: 80, y: 330 },
      width: 248,
      height: 150,
      params: { value: 42 },
    }),
    primitiveNode('df-format', DATA_TRANSFORM_NODE_TYPE, {
      title: '转为字符串',
      position: { x: 400, y: 330 },
      width: 248,
      height: 150,
      params: { operation: 'string' },
    }),
    primitiveNode('df-merge', DATA_MERGE_NODE_TYPE, {
      title: '合并',
      position: { x: 720, y: 210 },
      width: 220,
      height: 130,
    }),
    primitiveNode('df-preview', DATA_PREVIEW_NODE_TYPE, {
      title: '预览',
      position: { x: 1010, y: 220 },
      width: 220,
      height: 112,
    }),
  ]

  return snapshotOf(
    { scenario: 'dataflow' },
    nodes,
    [
      dataEdge('df-build-to-format', ['df-build', 'value'], ['df-format', 'input']),
      dataEdge('df-name-to-merge', ['df-name', 'value'], ['df-merge', 'a']),
      dataEdge('df-format-to-merge', ['df-format', 'output'], ['df-merge', 'b']),
      dataEdge('df-merge-to-preview', ['df-merge', 'output'], ['df-preview', 'value']),
    ],
    [groupOf('df-group', '数据处理管线', { x: 40, y: 48, width: 1230, height: 480 }, nodes)],
  )
}
