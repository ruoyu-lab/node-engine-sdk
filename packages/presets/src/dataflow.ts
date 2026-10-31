import {
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from './nodes/dataflow/index.js'
import { createDataflowPlugin } from '@node-wright/core/semantics'
import type { NodeTypeRegistry } from '@node-wright/core/view'
import { PRESET_NODE_ACCENTS } from './accents.js'
import type { DataflowPresetOptions, NodeWrightPreset } from './types.js'
import { createPresetLayout } from './layout.js'

export {
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from './nodes/dataflow/index.js'

export const dataflowNodeTypes: NodeTypeRegistry = {
  [DATA_SOURCE_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.dataflow,
    dom: {
      defaults: {
        title: '数据源',
        subtitle: '可复用数据值',
        fieldSource: 'params',
        fields: [{ key: 'value', kind: 'text' }],
      },
    },
  },
  [DATA_TRANSFORM_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.dataflow,
    dom: {
      defaults: {
        title: '转换',
        subtitle: '映射输入数据',
        fieldSource: 'params',
      },
    },
  },
  [DATA_MERGE_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.dataflow,
    dom: {
      defaults: {
        title: '合并',
        subtitle: '组合多个值',
        fieldSource: 'none',
      },
    },
  },
  [DATA_PREVIEW_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.dataflow,
    dom: {
      defaults: {
        title: '预览',
        subtitle: '检查结果',
        fieldSource: 'none',
      },
    },
  },
}

export function createDataflowPreset(options: DataflowPresetOptions = {}): NodeWrightPreset {
  const includeDefaultNodes = options.includeDefaultNodes !== false

  return {
    nodeDefinitions: includeDefaultNodes ? dataflowNodeDefinitions : [],
    runtimeDefinitions: includeDefaultNodes ? dataflowRuntimeDefinitions : [],
    nodeTypes: includeDefaultNodes ? dataflowNodeTypes : {},
    plugins: [createDataflowPlugin()],
    initialViewport: {
      x: 48,
      y: 40,
      zoom: 0.9,
    },
    layout: createPresetLayout({
      direction: 'LR',
      edgeKinds: ['data'],
      rankSpacing: 300,
      nodeSpacing: 88,
      groupPadding: 44,
    }),
  }
}
