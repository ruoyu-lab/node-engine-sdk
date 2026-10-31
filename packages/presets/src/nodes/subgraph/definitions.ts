import type { GraphPlugin, GraphPort } from '@node-wright/core/protocol'
import {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createSubgraphDefinition,
  serializeValueType,
  type SubgraphBoundaryPort,
  type SubgraphDefinition,
  type SemanticNodeDefinition,
} from '@node-wright/core/semantics'
import { compactPort } from '../ports.js'

export {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
} from '@node-wright/core/semantics'

export interface SubgraphNodesOptions {
  includeCall?: boolean
  includeBoundary?: boolean
}

/**
 * The `subgraphId` parameter is the only source of the called subgraph. It has no input port:
 * the call node's ports are generated from that subgraph's signature, so the id stays local.
 */
export const subgraphNodeDefinitions: SemanticNodeDefinition[] = [
  {
    type: SUBGRAPH_CALL_NODE_TYPE,
    label: '调用子图',
    category: '子图',
    description: '调用一个 runtime 注册子图，并把子图输出暴露为输出端口。',
    ports: [],
    parameters: [{ key: 'subgraphId', kind: 'string', label: '子图', defaultValue: '' }],
    tags: ['subgraph', 'call'],
  },
  {
    type: SUBGRAPH_INPUT_NODE_TYPE,
    label: '子图输入',
    category: '子图',
    description: '把调用方传入的值暴露给子图内部。',
    ports: [],
    tags: ['subgraph', 'boundary', 'input'],
  },
  {
    type: SUBGRAPH_OUTPUT_NODE_TYPE,
    label: '子图输出',
    category: '子图',
    description: '收集子图内部数据并返回给调用方。',
    ports: [],
    tags: ['subgraph', 'boundary', 'output'],
  },
]

/**
 * Port builders of the call and boundary nodes. They share one signature check, so a subgraph
 * whose input and output ids collide is rejected before any node receives its ports.
 */
export function createSubgraphCallPorts(definition: SubgraphDefinition): GraphPort[] {
  const signature = createSubgraphDefinition(definition)

  return [
    ...(signature.inputs ?? []).map(createInputPort),
    ...(signature.outputs ?? []).map(createOutputPort),
  ]
}

export function createSubgraphInputPorts(definition: SubgraphDefinition): GraphPort[] {
  return (createSubgraphDefinition(definition).inputs ?? []).map(createOutputPort)
}

export function createSubgraphOutputPorts(definition: SubgraphDefinition): GraphPort[] {
  return (createSubgraphDefinition(definition).outputs ?? []).map(createInputPort)
}

export function createSubgraphNodesPlugin(options: SubgraphNodesOptions = {}): GraphPlugin {
  const includeCall = options.includeCall !== false
  const includeBoundary = options.includeBoundary !== false
  const enabled = new Set<string>()

  if (includeCall) enabled.add(SUBGRAPH_CALL_NODE_TYPE)
  if (includeBoundary) {
    enabled.add(SUBGRAPH_INPUT_NODE_TYPE)
    enabled.add(SUBGRAPH_OUTPUT_NODE_TYPE)
  }

  return {
    name: '@node-wright/presets/nodes/subgraph',
    contributes: {
      nodeDefinitions: subgraphNodeDefinitions.filter((definition) => enabled.has(definition.type)),
    },
  }
}

function createInputPort(port: SubgraphBoundaryPort): GraphPort {
  return compactPort({
    id: port.id,
    name: port.name ?? port.id,
    label: port.label ?? port.name ?? port.id,
    direction: 'input',
    kind: 'data',
    side: 'left',
    capacity: 1,
    required: port.required,
    dataType: port.dataType,
    accepts: port.accepts ?? (port.dataType ? [port.dataType] : ['any']),
    data: port.valueType ? { type: serializeValueType(port.valueType) } : undefined,
    meta: port.meta,
  })
}

function createOutputPort(port: SubgraphBoundaryPort): GraphPort {
  return compactPort({
    id: port.id,
    name: port.name ?? port.id,
    label: port.label ?? port.name ?? port.id,
    direction: 'output',
    kind: 'data',
    side: 'right',
    capacity: 'many',
    dataType: port.dataType,
    data: port.valueType ? { type: serializeValueType(port.valueType) } : undefined,
    meta: port.meta,
  })
}
