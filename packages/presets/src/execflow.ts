import {
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
  execflowNodeDefinitions,
  execflowRuntimeDefinitions,
} from './nodes/execflow/index.js'
import { createExecflowPlugin } from '@node-wright/core/semantics'
import type { NodeTypeRegistry } from '@node-wright/core/view'
import { PRESET_NODE_ACCENTS } from './accents.js'
import type { ExecflowPresetOptions, NodeWrightPreset } from './types.js'
import { createPresetLayout } from './layout.js'

export {
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
  execflowNodeDefinitions,
  execflowRuntimeDefinitions,
} from './nodes/execflow/index.js'

export const execflowNodeTypes: NodeTypeRegistry = {
  [EXEC_EVENT_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '事件',
        subtitle: '执行入口',
        fieldSource: 'none',
      },
    },
  },
  [EXEC_SEQUENCE_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '顺序',
        subtitle: '按顺序运行输出',
        fieldSource: 'none',
      },
    },
  },
  [EXEC_BRANCH_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '分支',
        subtitle: '选择一条执行路径',
        fieldSource: 'none',
      },
    },
  },
  [EXEC_DELAY_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '延迟',
        subtitle: '等待后继续执行',
        fieldSource: 'params',
        fields: [{ key: 'durationMs', min: 0, step: 50 }],
      },
    },
  },
  [EXEC_LOG_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '日志',
        subtitle: '记录一个值',
        fieldSource: 'params',
      },
    },
  },
  [EXEC_SET_VARIABLE_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '写入变量',
        subtitle: '保存运行值',
        fieldSource: 'params',
      },
    },
  },
  [EXEC_GET_VARIABLE_NODE_TYPE]: {
    accent: PRESET_NODE_ACCENTS.execflow,
    dom: {
      defaults: {
        title: '读取变量',
        subtitle: '读取运行值',
        fieldSource: 'params',
      },
    },
  },
}

export function createExecflowPreset(options: ExecflowPresetOptions = {}): NodeWrightPreset {
  const includeDefaultNodes = options.includeDefaultNodes !== false

  return {
    nodeDefinitions: includeDefaultNodes ? execflowNodeDefinitions : [],
    runtimeDefinitions: includeDefaultNodes ? execflowRuntimeDefinitions : [],
    nodeTypes: includeDefaultNodes ? execflowNodeTypes : {},
    plugins: [createExecflowPlugin()],
    initialViewport: {
      x: 48,
      y: 40,
      zoom: 0.9,
    },
    layout: createPresetLayout({
      direction: 'TB',
      edgeKinds: ['exec'],
      rankSpacing: 240,
      nodeSpacing: 88,
      groupPadding: 44,
    }),
  }
}
