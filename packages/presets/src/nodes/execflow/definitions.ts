import type { GraphPlugin, NodeParameterDefinition } from '@node-wright/core/protocol'
import {
  EXEC_IN_PORT_ID,
  EXEC_THEN_PORT_ID,
  VARIABLE_SCOPE_GRAPH,
  VARIABLE_SCOPE_NODE,
  VARIABLE_SCOPE_RUN,
  type SemanticNodeDefinition,
} from '@node-wright/core/semantics'

export { EXEC_ERROR_PORT_ID, EXEC_IN_PORT_ID, EXEC_THEN_PORT_ID } from '@node-wright/core/semantics'

export const EXEC_EVENT_NODE_TYPE = 'exec:event'
export const EXEC_SEQUENCE_NODE_TYPE = 'exec:sequence'
export const EXEC_BRANCH_NODE_TYPE = 'exec:branch'
export const EXEC_DELAY_NODE_TYPE = 'exec:delay'
export const EXEC_LOG_NODE_TYPE = 'exec:log'
export const EXEC_SET_VARIABLE_NODE_TYPE = 'exec:set-variable'
export const EXEC_GET_VARIABLE_NODE_TYPE = 'exec:get-variable'

export interface ExecflowNodesOptions {
  includeEvent?: boolean
  includeSequence?: boolean
  includeBranch?: boolean
  includeDelay?: boolean
  includeLog?: boolean
  includeVariables?: boolean
}

export const execflowNodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: EXEC_EVENT_NODE_TYPE,
    label: '事件',
    category: '执行流',
    description: '启动一条执行流。',
    ports: [
      {
        id: EXEC_THEN_PORT_ID,
        label: '然后',
        direction: 'output',
        kind: 'exec',
        side: 'right',
        capacity: 'many',
      },
    ],
    capabilities: ['event'],
    tags: ['execflow', 'event'],
  },
  {
    type: EXEC_SEQUENCE_NODE_TYPE,
    label: '顺序',
    category: '执行流',
    description: '按顺序运行多个执行输出。',
    ports: [
      createExecInputPort(),
      createExecOutputPort('then:0', '然后 0'),
      createExecOutputPort('then:1', '然后 1'),
    ],
    capabilities: ['effect'],
    tags: ['execflow', 'sequence'],
  },
  {
    type: EXEC_BRANCH_NODE_TYPE,
    label: '分支',
    category: '执行流',
    description: '根据布尔条件选择一条执行路径。',
    ports: [
      createExecInputPort(),
      {
        id: 'condition',
        label: '条件',
        direction: 'input',
        kind: 'data',
        dataType: 'boolean',
        accepts: ['boolean'],
        side: 'left',
        capacity: 1,
        required: true,
      },
      createExecOutputPort('true', '真'),
      createExecOutputPort('false', '假'),
    ],
    capabilities: ['effect'],
    tags: ['execflow', 'branch'],
  },
  {
    type: EXEC_DELAY_NODE_TYPE,
    label: '延迟',
    category: '执行流',
    description: '等待一段时间后继续执行。',
    ports: [createExecInputPort(), createExecOutputPort()],
    parameters: [
      {
        key: 'durationMs',
        kind: 'number',
        label: '时长',
        defaultValue: 100,
        input: { portId: 'durationMs' },
      },
    ],
    capabilities: ['async', 'effect'],
    tags: ['execflow', 'delay', 'async'],
  },
  {
    type: EXEC_LOG_NODE_TYPE,
    label: '日志',
    category: '执行流',
    description: '将一个值写入执行轨迹。',
    ports: [createExecInputPort(), createExecOutputPort()],
    parameters: [
      {
        key: 'message',
        kind: 'string',
        label: '消息',
        defaultValue: '',
        input: { portId: 'message', dataType: 'any' },
      },
    ],
    capabilities: ['effect'],
    tags: ['execflow', 'log'],
  },
  {
    type: EXEC_SET_VARIABLE_NODE_TYPE,
    label: '写入变量',
    category: '执行流',
    description: '在当前 runtime 运行中保存一个变量值。',
    ports: [
      createExecInputPort(),
      {
        id: 'value',
        label: '值',
        direction: 'input',
        kind: 'data',
        dataType: 'any',
        accepts: ['any'],
        side: 'left',
        capacity: 1,
      },
      createExecOutputPort(),
    ],
    parameters: createVariableParameters(),
    capabilities: ['effect'],
    tags: ['execflow', 'variable'],
  },
  {
    type: EXEC_GET_VARIABLE_NODE_TYPE,
    label: '读取变量',
    category: '执行流',
    description: '从当前 runtime 运行中读取一个变量值。',
    ports: [
      {
        id: 'value',
        label: '值',
        direction: 'output',
        kind: 'data',
        dataType: 'any',
        side: 'right',
        capacity: 'many',
      },
    ],
    parameters: createVariableParameters(),
    capabilities: ['pure'],
    tags: ['execflow', 'variable'],
  },
]

export function createExecflowNodesPlugin(options: ExecflowNodesOptions = {}): GraphPlugin {
  return {
    name: '@node-wright/presets/nodes/execflow',
    contributes: {
      nodeDefinitions: filterExecflowNodeDefinitions(options),
    },
  }
}

function filterExecflowNodeDefinitions(options: ExecflowNodesOptions): SemanticNodeDefinition[] {
  const enabled = new Set<string>()

  if (options.includeEvent !== false) enabled.add(EXEC_EVENT_NODE_TYPE)
  if (options.includeSequence !== false) enabled.add(EXEC_SEQUENCE_NODE_TYPE)
  if (options.includeBranch !== false) enabled.add(EXEC_BRANCH_NODE_TYPE)
  if (options.includeDelay !== false) enabled.add(EXEC_DELAY_NODE_TYPE)
  if (options.includeLog !== false) enabled.add(EXEC_LOG_NODE_TYPE)
  if (options.includeVariables !== false) {
    enabled.add(EXEC_SET_VARIABLE_NODE_TYPE)
    enabled.add(EXEC_GET_VARIABLE_NODE_TYPE)
  }

  return execflowNodeDefinitions.filter((definition) => enabled.has(definition.type))
}

function createExecInputPort() {
  return {
    id: EXEC_IN_PORT_ID,
    label: '输入',
    direction: 'input' as const,
    kind: 'exec',
    side: 'left' as const,
    capacity: 1,
  }
}

function createExecOutputPort(id = EXEC_THEN_PORT_ID, label = '然后') {
  return {
    id,
    label,
    direction: 'output' as const,
    kind: 'exec',
    side: 'right' as const,
    capacity: 1,
  }
}

/**
 * Variable reference of the set/get variable nodes. Both parameters are local fields that an
 * upstream connection can drive; the scope is listed first so it renders above the name.
 */
function createVariableParameters(): NodeParameterDefinition[] {
  return [
    {
      key: 'scope',
      kind: 'select',
      label: '作用域',
      defaultValue: VARIABLE_SCOPE_RUN,
      options: [
        { label: '运行', value: VARIABLE_SCOPE_RUN },
        { label: '图', value: VARIABLE_SCOPE_GRAPH },
        { label: '节点', value: VARIABLE_SCOPE_NODE },
      ],
      input: { portId: 'scope', dataType: 'string' },
    },
    {
      key: 'name',
      kind: 'string',
      label: '名称',
      defaultValue: 'value',
      input: { portId: 'name' },
    },
  ]
}
