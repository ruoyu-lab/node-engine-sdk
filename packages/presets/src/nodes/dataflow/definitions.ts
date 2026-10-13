import type { GraphPlugin } from '@node-engine-sdk/core/protocol'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'

export const DATA_SOURCE_NODE_TYPE = 'data:source'
export const DATA_TRANSFORM_NODE_TYPE = 'data:transform'
export const DATA_MERGE_NODE_TYPE = 'data:merge'
export const DATA_PREVIEW_NODE_TYPE = 'data:preview'

export interface DataflowNodesOptions {
  includeSource?: boolean
  includeTransform?: boolean
  includeMerge?: boolean
  includePreview?: boolean
}

export const dataflowNodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: DATA_SOURCE_NODE_TYPE,
    label: '数据源',
    category: '数据流',
    description: '向下游节点提供可复用的数据值。',
    ports: [
      {
        id: 'value',
        label: '值',
        direction: 'output',
        kind: 'data',
        dataType: 'any',
        capacity: 'many',
      },
    ],
    parameters: [
      {
        key: 'value',
        kind: 'json',
        label: '值',
        defaultValue: '',
      },
    ],
    capabilities: ['pure'],
    tags: ['dataflow', 'source'],
  },
  {
    type: DATA_TRANSFORM_NODE_TYPE,
    label: '转换',
    category: '数据流',
    description: '将一个输入数据转换为另一个输出值。',
    ports: [
      {
        id: 'input',
        label: '输入',
        direction: 'input',
        kind: 'data',
        dataType: 'any',
        accepts: ['any'],
        capacity: 1,
        required: true,
      },
      {
        id: 'output',
        label: '输出',
        direction: 'output',
        kind: 'data',
        dataType: 'any',
        capacity: 'many',
      },
    ],
    parameters: [
      {
        key: 'operation',
        kind: 'select',
        label: '操作',
        defaultValue: 'pass',
        options: [
          { label: '透传', value: 'pass' },
          { label: '字符串', value: 'string' },
          { label: '数字', value: 'number' },
          { label: '布尔值', value: 'boolean' },
          { label: 'JSON', value: 'json' },
        ],
      },
    ],
    capabilities: ['pure'],
    tags: ['dataflow', 'transform'],
  },
  {
    type: DATA_MERGE_NODE_TYPE,
    label: '合并',
    category: '数据流',
    description: '将两个数据值合并为一个输出。',
    ports: [
      {
        id: 'a',
        label: 'A',
        direction: 'input',
        kind: 'data',
        dataType: 'any',
        accepts: ['any'],
        capacity: 1,
        required: true,
      },
      {
        id: 'b',
        label: 'B',
        direction: 'input',
        kind: 'data',
        dataType: 'any',
        accepts: ['any'],
        capacity: 1,
      },
      {
        id: 'output',
        label: '输出',
        direction: 'output',
        kind: 'data',
        dataType: 'any',
        capacity: 'many',
      },
    ],
    capabilities: ['pure'],
    tags: ['dataflow', 'merge'],
  },
  {
    type: DATA_PREVIEW_NODE_TYPE,
    label: '预览',
    category: '数据流',
    description: '展示或检查一个数据值。',
    ports: [
      {
        id: 'value',
        label: '值',
        direction: 'input',
        kind: 'data',
        dataType: 'any',
        accepts: ['any'],
        capacity: 1,
        required: true,
      },
    ],
    capabilities: ['effect'],
    tags: ['dataflow', 'preview'],
  },
]

export function createDataflowNodesPlugin(options: DataflowNodesOptions = {}): GraphPlugin {
  return {
    name: '@node-engine-sdk/presets/nodes/dataflow',
    contributes: {
      nodeDefinitions: filterDataflowNodeDefinitions(options),
    },
  }
}

function filterDataflowNodeDefinitions(options: DataflowNodesOptions): SemanticNodeDefinition[] {
  const enabled = new Set<string>()

  if (options.includeSource !== false) enabled.add(DATA_SOURCE_NODE_TYPE)
  if (options.includeTransform !== false) enabled.add(DATA_TRANSFORM_NODE_TYPE)
  if (options.includeMerge !== false) enabled.add(DATA_MERGE_NODE_TYPE)
  if (options.includePreview !== false) enabled.add(DATA_PREVIEW_NODE_TYPE)

  return dataflowNodeDefinitions.filter((definition) => enabled.has(definition.type))
}
