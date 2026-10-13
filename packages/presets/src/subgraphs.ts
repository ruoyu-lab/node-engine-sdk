import {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  subgraphNodeDefinitions,
  subgraphRuntimeDefinitions,
} from './nodes/subgraph/index.js'
import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'
import { PRESET_NODE_ACCENTS } from './accents.js'
import type { NodeEnginePreset, SubgraphPresetOptions } from './types.js'
import { createPresetLayout } from './layout.js'

export {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createSubgraphCallPorts,
  createSubgraphInputPorts,
  createSubgraphOutputPorts,
  subgraphNodeDefinitions,
  subgraphRuntimeDefinitions,
} from './nodes/subgraph/index.js'

export const subgraphNodeTypes: NodeTypeRegistry = {
  [SUBGRAPH_CALL_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.subgraph,
    dom: {
      defaults: {
        title: '调用子图',
        subtitle: '执行图封装',
        fieldSource: 'params',
      },
    },
  },
  [SUBGRAPH_INPUT_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.subgraph,
    dom: {
      defaults: {
        title: '子图输入',
        subtitle: '边界输入',
        fieldSource: 'none',
      },
    },
  },
  [SUBGRAPH_OUTPUT_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.subgraph,
    dom: {
      defaults: {
        title: '子图输出',
        subtitle: '边界输出',
        fieldSource: 'none',
      },
    },
  },
}

export function createSubgraphPreset(options: SubgraphPresetOptions = {}): NodeEnginePreset {
  const includeDefaultNodes = options.includeDefaultNodes !== false

  return {
    nodeDefinitions: includeDefaultNodes ? subgraphNodeDefinitions : [],
    runtimeDefinitions: includeDefaultNodes ? subgraphRuntimeDefinitions : [],
    nodeTypes: includeDefaultNodes ? subgraphNodeTypes : {},
    plugins: [],
    initialViewport: {
      x: 48,
      y: 40,
      zoom: 0.9,
    },
    layout: createPresetLayout({
      direction: 'LR',
      edgeKinds: ['data', 'exec'],
      rankSpacing: 300,
      nodeSpacing: 88,
      groupPadding: 44,
    }),
  }
}
