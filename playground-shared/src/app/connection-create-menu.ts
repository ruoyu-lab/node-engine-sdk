import {
  resolvePortKind,
  type GraphEndpoint,
  type GraphNode,
  type GraphPort,
  type GraphValue,
  type XYPosition,
} from '@node-wright/core/protocol'
import type { NodeWrightApi, NodeWrightConnectionCancelEvent } from '@node-wright/core/view'
import { DATA_PREVIEW_NODE_TYPE, DATA_SOURCE_NODE_TYPE } from '@node-wright/presets'
import {
  AI_IMAGE_DISPLAY_NODE_TYPE,
  AI_IMAGE_GENERATE_NODE_TYPE,
  AI_PROMPT_NODE_TYPE,
} from '../business/ai-image'
import type { DemoScenario } from '../demo/scenarios'

/** A cancelled connection drag shorter than this (in screen pixels) does not open the menu. */
const CONNECTION_CREATE_DRAG_THRESHOLD = 18
/** Horizontal gap between the released connection point and the created node. */
const CONNECTION_CREATE_NODE_OFFSET = 88
const CREATED_NODE_WIDTH = 240
const MENU_MARGIN = 12
const MENU_WIDTH = 240
const MENU_HEIGHT = 180

export interface ConnectionCreateOption {
  id: string
  label: string
  description: string
  nodeType: string
  portId: string
  portDirection: GraphPort['direction']
  data?: GraphNode['data']
}

/** The node menu that opens where a connection drag was released over empty canvas. */
export interface ConnectionCreateMenu {
  source: GraphEndpoint
  sourcePort?: GraphPort
  graphPosition: XYPosition
  screenPosition: XYPosition
  options: ConnectionCreateOption[]
}

export interface ScreenSize {
  width: number
  height: number
}

export type ConnectionCreateResult = { nodeId: string } | { error: string }

/**
 * Opens the menu where a connection drag was cancelled. It offers only node types the scenario
 * registers, and the generic data source and preview only for data ports; a click-length drag,
 * or a port no offered node can connect to, opens nothing.
 */
export function openConnectionCreateMenu(
  event: NodeWrightConnectionCancelEvent,
  screen: ScreenSize,
  scenario: DemoScenario,
): ConnectionCreateMenu | null {
  if (event.dragDistance < CONNECTION_CREATE_DRAG_THRESHOLD) {
    return null
  }

  const registeredTypes = new Set(
    scenario.preset.nodeDefinitions.map((definition) => definition.type),
  )
  const options = (
    event.targetDirection === 'output'
      ? resolveOutputProviderOptions(event.sourcePort)
      : resolveInputConsumerOptions(event.sourcePort)
  ).filter((option) => registeredTypes.has(option.nodeType))

  if (options.length === 0) {
    return null
  }

  return {
    source: event.source,
    sourcePort: event.sourcePort,
    graphPosition: event.point,
    screenPosition: clampMenuScreenPosition(event.screenPoint, screen),
    options,
  }
}

export function resolveConnectionCreateMenuStyle(menu: ConnectionCreateMenu): {
  left: string
  top: string
} {
  return {
    left: `${menu.screenPosition.x}px`,
    top: `${menu.screenPosition.y}px`,
  }
}

/**
 * Creates the chosen node next to the released point and connects it to the dragged port. A
 * provider for an input that already has its single upstream edge replaces that edge; a node
 * that cannot be connected is removed again and the validation reason is returned.
 */
export function createNodeFromConnectionMenu(
  api: NodeWrightApi,
  menu: ConnectionCreateMenu,
  option: ConnectionCreateOption,
): ConnectionCreateResult {
  const node = api.nodes.create(option.nodeType, {
    x:
      menu.graphPosition.x +
      (option.portDirection === 'input'
        ? CONNECTION_CREATE_NODE_OFFSET
        : -CONNECTION_CREATE_NODE_OFFSET - CREATED_NODE_WIDTH),
    y: menu.graphPosition.y - 64,
    data: option.data,
  })

  if (!node) {
    return { error: `无法创建 ${option.label} 节点。` }
  }

  const endpoint = { nodeId: node.id, portId: option.portId }
  const source = option.portDirection === 'output' ? endpoint : menu.source
  const target = option.portDirection === 'input' ? endpoint : menu.source
  let validation = api.edges.connect(source, target)

  if (!validation.valid && option.portDirection === 'output') {
    for (const edge of api.graph.get().edges) {
      if (endpointEquals(edge.target, menu.source)) {
        api.edges.remove(edge.id)
      }
    }

    validation = api.edges.connect(source, target)
  }

  if (!validation.valid) {
    api.nodes.remove(node.id)
    return { error: validation.reason ?? '无法连接新节点。' }
  }

  api.selection.nodes([node.id])
  return { nodeId: node.id }
}

function resolveOutputProviderOptions(sourcePort: GraphPort | undefined): ConnectionCreateOption[] {
  const options: ConnectionCreateOption[] = []
  const portId = sourcePort?.id

  if (portId === 'prompt') {
    options.push({
      id: 'prompt-source',
      label: '提示词',
      description: '创建提示词节点并连接到这个输入端',
      nodeType: AI_PROMPT_NODE_TYPE,
      portId: 'prompt',
      portDirection: 'output',
      data: {
        title: '提示词',
        params: {
          text: 'a cinematic product photo, clean studio lighting',
        },
      },
    })
  }

  if (portId === 'imageUrl') {
    options.push({
      id: 'image-generate-source',
      label: '生成图片',
      description: '创建生成节点，把图片 URL 接入这里',
      nodeType: AI_IMAGE_GENERATE_NODE_TYPE,
      portId: 'imageUrl',
      portDirection: 'output',
      data: {
        title: '生成图片',
      },
    })
  }

  if (!isDataPort(sourcePort)) {
    return options
  }

  options.push({
    id: 'data-source',
    label: '数据源',
    description: '创建一个可编辑值，作为这个输入端的上游',
    nodeType: DATA_SOURCE_NODE_TYPE,
    portId: 'value',
    portDirection: 'output',
    data: {
      title: '数据源',
      params: {
        value: resolveDefaultSourceValue(sourcePort),
      },
    },
  })

  return options
}

function resolveInputConsumerOptions(sourcePort: GraphPort | undefined): ConnectionCreateOption[] {
  const options: ConnectionCreateOption[] = []
  const portId = sourcePort?.id

  if (portId === 'prompt') {
    options.push({
      id: 'image-generate-target',
      label: '生成图片',
      description: '创建生成节点，并接到提示词输入',
      nodeType: AI_IMAGE_GENERATE_NODE_TYPE,
      portId: 'prompt',
      portDirection: 'input',
      data: {
        title: '生成图片',
      },
    })
  }

  if (portId === 'imageUrl') {
    options.push({
      id: 'image-display-target',
      label: '图片预览',
      description: '创建图片预览节点，并接入图片 URL',
      nodeType: AI_IMAGE_DISPLAY_NODE_TYPE,
      portId: 'imageUrl',
      portDirection: 'input',
      data: {
        title: '图片预览',
      },
    })
  }

  if (!isDataPort(sourcePort)) {
    return options
  }

  options.push({
    id: 'data-preview-target',
    label: '数据预览',
    description: '创建预览节点，检查这个输出值',
    nodeType: DATA_PREVIEW_NODE_TYPE,
    portId: 'value',
    portDirection: 'input',
    data: {
      title: '数据预览',
    },
  })

  return options
}

/** The generic data nodes connect through their `value` data port. */
function isDataPort(port: GraphPort | undefined): boolean {
  return port !== undefined && resolvePortKind(port) === 'data'
}

function resolveDefaultSourceValue(port: GraphPort | undefined): GraphValue {
  if (port?.dataType === 'number') {
    return 0
  }

  if (port?.dataType === 'boolean') {
    return false
  }

  return ''
}

function clampMenuScreenPosition(point: XYPosition, screen: ScreenSize): XYPosition {
  return {
    x: Math.min(Math.max(point.x, MENU_MARGIN), Math.max(MENU_MARGIN, screen.width - MENU_WIDTH)),
    y: Math.min(Math.max(point.y, MENU_MARGIN), Math.max(MENU_MARGIN, screen.height - MENU_HEIGHT)),
  }
}

function endpointEquals(left: GraphEndpoint, right: GraphEndpoint): boolean {
  return left.nodeId === right.nodeId && left.portId === right.portId
}
