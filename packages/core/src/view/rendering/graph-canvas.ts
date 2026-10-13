import type { ViewportState } from '../types/index.js'
import {
  drawBezierEdge,
  drawDraftEndpoint,
  type GraphCanvasDraftEdge,
  type GraphCanvasEdgeEntry,
} from './edge-canvas.js'
import { withAlpha } from './color.js'
import { drawGroup, type GraphCanvasGroupEntry } from './group-canvas.js'

export interface GraphCanvasTheme {
  edgeColor: string
  edgeActiveColor: string
  execEdgeColor: string
  draftEdgeColor: string
  draftEdgeGlowColor: string
  selectionColor: string
  groupBackground: string
  groupBorderColor: string
  groupLabelColor: string
  minimapNodeColor: string
}

export interface GraphCanvasDrawOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  viewport: ViewportState
  theme: GraphCanvasTheme
  edges: GraphCanvasEdgeEntry[]
  groups: GraphCanvasGroupEntry[]
  draftEdge?: GraphCanvasDraftEdge | null
  /** Edge under the pointer; it gets a fainter halo than a selected edge. */
  hoveredEdgeId?: string | null
}

/** Width the selection halo adds around an edge, in screen pixels. */
const EDGE_HALO_WIDTH = 7

export function drawGraphCanvas({
  ctx,
  width,
  height,
  dpr,
  viewport,
  theme,
  edges,
  groups,
  draftEdge,
  hoveredEdgeId,
}: GraphCanvasDrawOptions): void {
  const deviceWidth = Math.max(Math.round(width * dpr), 1)
  const deviceHeight = Math.max(Math.round(height * dpr), 1)

  if (ctx.canvas.width !== deviceWidth || ctx.canvas.height !== deviceHeight) {
    ctx.canvas.width = deviceWidth
    ctx.canvas.height = deviceHeight
    ctx.canvas.style.width = `${width}px`
    ctx.canvas.style.height = `${height}px`
  }

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.restore()

  if (!groups.length && !edges.length && !draftEdge) {
    return
  }

  ctx.save()
  ctx.setTransform(
    dpr * viewport.zoom,
    0,
    0,
    dpr * viewport.zoom,
    dpr * viewport.x,
    dpr * viewport.y,
  )

  for (const entry of groups) {
    if (entry.draw) {
      entry.draw(ctx)
      continue
    }

    drawGroup(ctx, entry)
  }

  for (const edge of edges) {
    if (edge.draw) {
      edge.draw(ctx)
      continue
    }

    const hovered = edge.id === hoveredEdgeId

    if (edge.selected || hovered) {
      drawBezierEdge(ctx, edge.start, edge.end, {
        color: withAlpha(theme.selectionColor, edge.selected ? 0.42 : 0.22),
        lineWidth: edge.strokeWidth + EDGE_HALO_WIDTH / viewport.zoom,
      })
    }

    drawBezierEdge(ctx, edge.start, edge.end, {
      color: edge.stroke,
      lineWidth: edge.selected || hovered ? edge.strokeWidth + 0.75 : edge.strokeWidth,
    })
  }

  if (draftEdge) {
    drawBezierEdge(ctx, draftEdge.start, draftEdge.end, {
      color: draftEdge.color,
      lineWidth: 2.5,
      dash: [8, 6],
      shadowColor: theme.draftEdgeGlowColor,
      shadowBlur: 10,
    })
    drawDraftEndpoint(ctx, draftEdge[draftEdge.looseEndpoint ?? 'end'], {
      color: draftEdge.color,
      direction: draftEdge.targetDirection,
    })
  }

  ctx.restore()
}
