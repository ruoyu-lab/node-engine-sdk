import type { GraphPlugin, GraphPort } from '@node-engine-sdk/core/protocol'
import type {
  FunctionDefinition,
  FunctionParameter,
  FunctionReturn,
  SemanticNodeDefinition,
} from '@node-engine-sdk/core/semantics'
import {
  EXEC_IN_PORT_ID,
  EXEC_THEN_PORT_ID,
  createFunctionDefinition,
} from '@node-engine-sdk/core/semantics'
import { compactPort } from '../ports.js'

export const FUNCTION_CALL_NODE_TYPE = 'function:call'

export interface FunctionNodesOptions {
  includeCall?: boolean
}

export interface FunctionCallPortOptions {
  includeExecPorts?: boolean
}

/**
 * The `functionId` parameter is the only source of the called function. It has no input port:
 * the node's ports are generated from that function's signature, so the id stays a local value.
 */
export const functionCallNodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: FUNCTION_CALL_NODE_TYPE,
    label: '调用函数',
    category: '函数',
    description: '调用一个 runtime 注册函数，并把返回值暴露为输出端口。',
    ports: [],
    parameters: [{ key: 'functionId', kind: 'string', label: '函数', defaultValue: '' }],
    tags: ['function', 'call'],
  },
]

/** Throws on a signature whose ports would collide on the call node (see `validateFunctionSignature`). */
export function createFunctionCallPorts(
  definition: FunctionDefinition,
  options: FunctionCallPortOptions = {},
): GraphPort[] {
  const signature = createFunctionDefinition(definition)
  const ports: GraphPort[] = []

  if (options.includeExecPorts) {
    ports.push(
      {
        id: EXEC_IN_PORT_ID,
        label: '输入',
        direction: 'input',
        kind: 'exec',
        side: 'left',
        capacity: 1,
      },
      {
        id: EXEC_THEN_PORT_ID,
        label: '然后',
        direction: 'output',
        kind: 'exec',
        side: 'right',
        capacity: 1,
      },
    )
  }

  ports.push(
    ...(signature.inputs ?? []).map(createInputPort),
    ...(signature.outputs ?? []).map(createOutputPort),
  )

  return ports
}

export function createFunctionNodesPlugin(options: FunctionNodesOptions = {}): GraphPlugin {
  return {
    name: '@node-engine-sdk/presets/nodes/function',
    contributes: {
      nodeDefinitions: options.includeCall === false ? [] : functionCallNodeDefinitions,
    },
  }
}

function createInputPort(parameter: FunctionParameter): GraphPort {
  return compactPort({
    id: parameter.id,
    name: parameter.name ?? parameter.id,
    label: parameter.label ?? parameter.name ?? parameter.id,
    direction: 'input',
    kind: 'data',
    side: 'left',
    capacity: 1,
    required: parameter.required,
    dataType: parameter.dataType,
    accepts: parameter.accepts ?? (parameter.dataType ? [parameter.dataType] : ['any']),
    meta: parameter.meta,
  })
}

function createOutputPort(output: FunctionReturn): GraphPort {
  return compactPort({
    id: output.id,
    name: output.name ?? output.id,
    label: output.label ?? output.name ?? output.id,
    direction: 'output',
    kind: 'data',
    side: 'right',
    capacity: 'many',
    dataType: output.dataType,
    meta: output.meta,
  })
}
