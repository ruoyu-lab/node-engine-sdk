import type { GraphEndpoint, GraphNode, NodeDefinition, XYPosition } from '../../protocol/index.js'
import type {
  NodeWrightBounds,
  NodeWrightCanvasNodeRenderContext,
  NodeWrightCanvasNodeTheme,
  NodeWrightPortAnchor,
  NodeWrightRenderContext,
  NodeTypeDefinition,
} from '../types/index.js'
import { drawDefaultCanvasNode, resolvePortRadius } from './node-painter.js'

/** One node prepared for canvas painting and hit testing. */
export interface CanvasNodeEntry {
  node: GraphNode
  bounds: NodeWrightBounds
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  inputs: NodeWrightPortAnchor[]
  outputs: NodeWrightPortAnchor[]
  selected: boolean
  dragging: boolean
}

const PORT_HIT_PADDING = 8

export function drawCanvasNodes(
  ctx: CanvasRenderingContext2D,
  nodes: CanvasNodeEntry[],
  options: {
    zoom: number
    readonly: boolean
    theme: NodeWrightCanvasNodeTheme
    connectionSource?: GraphEndpoint
    connectionTarget?: GraphEndpoint
    context: NodeWrightRenderContext
  },
): void {
  for (const entry of nodes) {
    const renderContext: NodeWrightCanvasNodeRenderContext = {
      ctx,
      node: entry.node,
      schema: entry.schema,
      definition: entry.definition,
      bounds: entry.bounds,
      selected: entry.selected,
      dragging: entry.dragging,
      readonly: options.readonly,
      zoom: options.zoom,
      inputs: entry.inputs,
      outputs: entry.outputs,
      connectionSource: options.connectionSource,
      connectionTarget: options.connectionTarget,
      theme: options.theme,
      context: options.context,
    }

    const draw = entry.definition?.canvas?.draw

    if (draw) {
      draw(renderContext)
      continue
    }

    drawDefaultCanvasNode(renderContext)
  }
}

export function isPointInNodeBounds(point: XYPosition, bounds: NodeWrightBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

export function isPointNearPort(
  point: XYPosition,
  port: Pick<NodeWrightPortAnchor, 'x' | 'y' | 'radius'>,
  zoom: number,
): boolean {
  const radius = Math.max(resolvePortRadius(port.radius), PORT_HIT_PADDING / zoom)

  return Math.hypot(point.x - port.x, point.y - port.y) <= radius
}
