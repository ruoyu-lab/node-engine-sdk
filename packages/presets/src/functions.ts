import {
  FUNCTION_CALL_NODE_TYPE,
  functionCallNodeDefinitions,
  functionCallRuntimeDefinitions,
} from './nodes/function/index.js'
import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'
import { PRESET_NODE_ACCENTS } from './accents.js'
import type { FunctionPresetOptions, NodeEnginePreset } from './types.js'
import { createPresetLayout } from './layout.js'

export {
  FUNCTION_CALL_NODE_TYPE,
  createFunctionCallPorts,
  functionCallNodeDefinitions,
  functionCallRuntimeDefinitions,
  type FunctionCallPortOptions,
} from './nodes/function/index.js'

export const functionNodeTypes: NodeTypeRegistry = {
  [FUNCTION_CALL_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.function,
    dom: {
      defaults: {
        title: '调用函数',
        subtitle: '执行注册函数',
        fieldSource: 'params',
      },
    },
  },
}

export function createFunctionPreset(options: FunctionPresetOptions = {}): NodeEnginePreset {
  const includeDefaultNodes = options.includeDefaultNodes !== false

  return {
    nodeDefinitions: includeDefaultNodes ? functionCallNodeDefinitions : [],
    runtimeDefinitions: includeDefaultNodes ? functionCallRuntimeDefinitions : [],
    nodeTypes: includeDefaultNodes ? functionNodeTypes : {},
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
