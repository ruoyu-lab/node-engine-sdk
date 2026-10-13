import type {
  GraphEndpoint,
  GraphNode,
  GraphPort,
  NodeDefinition,
  XYPosition,
} from '../../protocol/index.js'
import type {
  NodeEngineCanvasNodeLayoutContext,
  NodeEngineCanvasPortLayout,
  NodeTypeDefinition,
  PortSide,
} from '../types/index.js'

/** Node sizing and default port placement for nodes that do not provide their own layout. */
export interface ResolvedNodeView extends GraphNode {
  width: number
  height: number
  ports: GraphPort[]
  title: string
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
}

export interface PortLayout {
  endpoint: GraphEndpoint
  x: number
  y: number
  side: NonNullable<GraphPort['side']>
  port: GraphPort
  radius?: number
  connectionCount?: number
  connectionColor?: string
}

const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 112
const DEFAULT_SIDE_PORT_TOP_INSET = 84
const DEFAULT_SIDE_PORT_BOTTOM_INSET = 24
const DEFAULT_SIDE_PORT_MIN_GAP = 12
const DEFAULT_SIDE_PORT_PREFERRED_GAP = 18
const DEFAULT_NODE_HEADER_HEIGHT = 36
const DEFAULT_NODE_BODY_TOP_GAP = 12
const DEFAULT_NODE_BODY_LINE_HEIGHT = 18
const DEFAULT_NODE_META_OFFSET_WITH_SUBTITLE = 32
const DEFAULT_NODE_META_OFFSET_WITHOUT_SUBTITLE = 12
const DEFAULT_NODE_META_LINE_HEIGHT = 12
const DEFAULT_NODE_PORT_SAFE_GAP = 0

export function resolveNodeView(
  node: GraphNode,
  definition: NodeTypeDefinition | undefined,
  schema: NodeDefinition | undefined,
): ResolvedNodeView {
  const ports = node.ports?.length ? node.ports : (schema?.ports ?? definition?.ports ?? [])
  const width = node.width ?? schema?.width ?? definition?.width ?? DEFAULT_WIDTH
  const height =
    node.height ?? schema?.height ?? definition?.height ?? resolveDefaultNodeHeight(node, ports)

  return {
    ...node,
    width,
    height,
    ports,
    title:
      readString(node.data?.title) ??
      readString(node.meta?.title) ??
      schema?.label ??
      definition?.label ??
      node.type,
    schema,
    definition,
  }
}

export function createPortLayouts(
  node: ResolvedNodeView,
  canvasContext: NodeEngineCanvasNodeLayoutContext,
): PortLayout[] {
  const customLayouts = resolveCustomPortLayouts(node, canvasContext)

  if (customLayouts) {
    return node.ports.map((port) => {
      const custom = customLayouts.get(port.id)
      const side = custom?.side ?? resolvePortSide(port)
      const point = custom
        ? { x: custom.x, y: custom.y }
        : resolvePortPoint(side, resolvePortRatio(node.ports, port, side), node)

      return {
        endpoint: {
          nodeId: node.id,
          portId: port.id,
        },
        x: node.x + point.x,
        y: node.y + point.y,
        side,
        port,
        radius: custom?.radius,
      }
    })
  }

  const groups = {
    top: node.ports.filter((port) => resolvePortSide(port) === 'top'),
    right: node.ports.filter((port) => resolvePortSide(port) === 'right'),
    bottom: node.ports.filter((port) => resolvePortSide(port) === 'bottom'),
    left: node.ports.filter((port) => resolvePortSide(port) === 'left'),
  }

  return node.ports.map((port) => {
    const side = resolvePortSide(port)
    const sidePorts = groups[side]
    const index = sidePorts.findIndex((item) => item.id === port.id)
    const step = 1 / (sidePorts.length + 1)
    const ratio = (index + 1) * step

    const point =
      side === 'left' || side === 'right'
        ? resolveSidePortPoint(side, index, sidePorts.length, node)
        : resolvePortPoint(side, ratio, node)

    return {
      endpoint: {
        nodeId: node.id,
        portId: port.id,
      },
      x: node.x + point.x,
      y: node.y + point.y,
      side,
      port,
    }
  })
}

export function getGraphBounds(
  nodes: Array<Pick<ResolvedNodeView, 'x' | 'y' | 'width' | 'height'>>,
): { x: number; y: number; width: number; height: number } | null {
  if (!nodes.length) {
    return null
  }

  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function endpointKey(endpoint: GraphEndpoint): string {
  return `${endpoint.nodeId}:${endpoint.portId}`
}

function resolvePortSide(port: GraphPort): NonNullable<GraphPort['side']> {
  if (port.side) {
    return port.side
  }

  return port.direction === 'input' ? 'left' : 'right'
}

function resolveCustomPortLayouts(
  node: ResolvedNodeView,
  canvasContext: NodeEngineCanvasNodeLayoutContext,
): Map<string, NodeEngineCanvasPortLayout> | null {
  const getPortLayout = node.definition?.canvas?.getPortLayout

  if (!getPortLayout) {
    return null
  }

  const layouts = getPortLayout(canvasContext)

  if (!layouts?.length) {
    return null
  }

  return new Map(layouts.map((layout) => [layout.portId, layout]))
}

function resolvePortRatio(ports: GraphPort[], port: GraphPort, side: PortSide): number {
  const sidePorts = ports.filter((item) => resolvePortSide(item) === side)
  const index = sidePorts.findIndex((item) => item.id === port.id)
  const step = 1 / (sidePorts.length + 1)

  return (index + 1) * step
}

function resolvePortPoint(
  side: NonNullable<GraphPort['side']>,
  ratio: number,
  node: ResolvedNodeView,
): XYPosition {
  if (side === 'top') {
    return { x: node.width * ratio, y: 0 }
  }

  if (side === 'bottom') {
    return { x: node.width * ratio, y: node.height }
  }

  if (side === 'left') {
    return { x: 0, y: node.height * ratio }
  }

  return { x: node.width, y: node.height * ratio }
}

function resolveSidePortPoint(
  side: 'left' | 'right',
  index: number,
  count: number,
  node: ResolvedNodeView,
): XYPosition {
  const bottomInset = Math.min(DEFAULT_SIDE_PORT_BOTTOM_INSET, Math.max(16, node.height * 0.18))
  const preferredTopInset = Math.max(
    Math.min(DEFAULT_SIDE_PORT_TOP_INSET, Math.max(52, node.height * 0.34)),
    resolveNodeContentSafeTopInset(node),
  )
  const requiredHeight = Math.max(count, 1) * DEFAULT_SIDE_PORT_MIN_GAP
  const maxTopInset = Math.max(24, node.height - bottomInset - requiredHeight)
  const topInset = Math.min(preferredTopInset, maxTopInset)
  const startY = topInset
  const endY = Math.max(startY + DEFAULT_SIDE_PORT_MIN_GAP, node.height - bottomInset)
  const span = Math.max(endY - startY, DEFAULT_SIDE_PORT_MIN_GAP)
  const step = Math.max(
    DEFAULT_SIDE_PORT_MIN_GAP,
    Math.min(DEFAULT_SIDE_PORT_PREFERRED_GAP, span / count),
  )

  return {
    x: side === 'left' ? 0 : node.width,
    y: startY + step * index + step / 2,
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function resolveNodeContentSafeTopInset(node: Pick<GraphNode, 'data'>): number {
  const subtitle = readString(node.data?.summary)
  const metaText = [readString(node.data?.category), readString(node.data?.state)]
    .filter(Boolean)
    .join(' • ')

  let contentBottom = DEFAULT_NODE_HEADER_HEIGHT

  if (subtitle) {
    contentBottom = Math.max(
      contentBottom,
      DEFAULT_NODE_HEADER_HEIGHT + DEFAULT_NODE_BODY_TOP_GAP + DEFAULT_NODE_BODY_LINE_HEIGHT,
    )
  }

  if (metaText) {
    contentBottom = Math.max(
      contentBottom,
      DEFAULT_NODE_HEADER_HEIGHT +
        (subtitle
          ? DEFAULT_NODE_META_OFFSET_WITH_SUBTITLE
          : DEFAULT_NODE_META_OFFSET_WITHOUT_SUBTITLE) +
        DEFAULT_NODE_META_LINE_HEIGHT,
    )
  }

  return contentBottom + DEFAULT_NODE_PORT_SAFE_GAP
}

function resolveDefaultNodeHeight(node: Pick<GraphNode, 'data'>, ports: GraphPort[]): number {
  const sidePortCount = Math.max(
    ports.filter((port) => resolvePortSide(port) === 'left').length,
    ports.filter((port) => resolvePortSide(port) === 'right').length,
    1,
  )
  const contentSafeTopInset = resolveNodeContentSafeTopInset(node)
  const sidePortsHeight = sidePortCount * DEFAULT_SIDE_PORT_MIN_GAP
  const requiredHeight = contentSafeTopInset + sidePortsHeight + DEFAULT_SIDE_PORT_BOTTOM_INSET

  return Math.max(DEFAULT_HEIGHT, requiredHeight)
}
