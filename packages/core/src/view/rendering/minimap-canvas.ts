import type { GraphRect } from './geometry.js'
import type { MinimapTransform } from './minimap-geometry.js'

/** Minimap rectangle of a node in graph coordinates; `color` is its accent, if it has one. */
export interface MinimapNodeRect extends GraphRect {
  id: string
  color: string | undefined
}

/** Minimap rectangle of a group in graph coordinates; `color` is the group's own colour. */
export interface MinimapGroupRect extends GraphRect {
  color: string | undefined
}

/** Everything the minimap paints, derived from the committed graph only. */
export interface MinimapScene {
  groups: readonly MinimapGroupRect[]
  /** Node rectangles by accent colour; `undefined` holds the nodes in the theme's node colour. */
  nodesByColor: ReadonlyMap<string | undefined, readonly MinimapNodeRect[]>
  nodesById: ReadonlyMap<string, MinimapNodeRect>
  /** Bounds of every painted group and node; `null` for an empty graph. */
  bounds: GraphRect | null
}

export interface MinimapColors {
  node: string
  selection: string
  group: string
}

/** Inputs of one minimap paint; a new frame object means something visible changed. */
export interface MinimapPaintFrame {
  /** CSS size of the minimap. */
  width: number
  height: number
  dpr: number
  /** `null` when there is nothing to show (empty graph and unknown viewport). */
  transform: MinimapTransform | null
  scene: MinimapScene
  selectedNodeIds: ReadonlySet<string>
  colors: MinimapColors
}

/** Above this many nodes, nodes are painted as plain rectangles. */
export const MINIMAP_ROUNDED_NODE_LIMIT = 1500

const GROUP_FILL_ALPHA = 0.2
const NODE_RADIUS = 2
/** Nodes stay at least one CSS pixel wide and high, however far the minimap zooms out. */
const MIN_NODE_SIZE = 1

/**
 * Paints groups (translucent) and nodes (accent, theme or selection colour) onto a transparent
 * minimap canvas sized to `width × height × dpr` device pixels. Edges are not painted. Nodes of
 * one colour are filled as a single path, so the cost is one path segment per node.
 */
export function paintMinimap(ctx: CanvasRenderingContext2D, frame: MinimapPaintFrame): void {
  const canvas = ctx.canvas
  const deviceWidth = Math.max(Math.round(frame.width * frame.dpr), 1)
  const deviceHeight = Math.max(Math.round(frame.height * frame.dpr), 1)

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth
    canvas.height = deviceHeight
  }

  ctx.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0)
  ctx.clearRect(0, 0, frame.width, frame.height)

  const { transform, scene } = frame

  if (!transform) {
    return
  }

  ctx.globalAlpha = GROUP_FILL_ALPHA

  for (const group of scene.groups) {
    ctx.fillStyle = group.color ?? frame.colors.group
    ctx.fillRect(
      group.x * transform.scale + transform.x,
      group.y * transform.scale + transform.y,
      group.width * transform.scale,
      group.height * transform.scale,
    )
  }

  ctx.globalAlpha = 1

  const rounded = scene.nodesById.size <= MINIMAP_ROUNDED_NODE_LIMIT

  for (const [color, rects] of scene.nodesByColor) {
    fillNodes(ctx, rects, transform, color ?? frame.colors.node, rounded)
  }

  if (frame.selectedNodeIds.size) {
    const selected: MinimapNodeRect[] = []

    for (const nodeId of frame.selectedNodeIds) {
      const rect = scene.nodesById.get(nodeId)

      if (rect) {
        selected.push(rect)
      }
    }

    fillNodes(ctx, selected, transform, frame.colors.selection, rounded)
  }
}

function fillNodes(
  ctx: CanvasRenderingContext2D,
  rects: readonly MinimapNodeRect[],
  transform: MinimapTransform,
  color: string,
  rounded: boolean,
): void {
  if (!rects.length) {
    return
  }

  ctx.fillStyle = color
  ctx.beginPath()

  for (const rect of rects) {
    const x = rect.x * transform.scale + transform.x
    const y = rect.y * transform.scale + transform.y
    const width = Math.max(rect.width * transform.scale, MIN_NODE_SIZE)
    const height = Math.max(rect.height * transform.scale, MIN_NODE_SIZE)

    if (rounded) {
      ctx.roundRect(x, y, width, height, Math.min(NODE_RADIUS, width / 2, height / 2))
    } else {
      ctx.rect(x, y, width, height)
    }
  }

  ctx.fill()
}
