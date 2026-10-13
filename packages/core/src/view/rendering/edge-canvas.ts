import type { GraphPort, XYPosition } from '../../protocol/index.js'
import type { PortSide } from '../types/index.js'
import type { GraphRect } from './geometry.js'
import { withAlpha } from './color.js'

export interface GraphCanvasEdgePoint extends XYPosition {
  side?: PortSide
  tangent?: XYPosition
}

export interface GraphCanvasEdgeEntry {
  id: string
  start: GraphCanvasEdgePoint
  end: GraphCanvasEdgePoint
  stroke: string
  strokeWidth: number
  selected: boolean
  draw?: (ctx: CanvasRenderingContext2D) => void
  hitTest?: (point: XYPosition, zoom: number) => boolean
}

export interface GraphCanvasDraftEdge {
  start: GraphCanvasEdgePoint
  end: GraphCanvasEdgePoint
  color: string
  targetDirection?: GraphPort['direction']
  looseEndpoint?: 'start' | 'end'
}

const DEFAULT_CURVATURE = 0.45
const EDGE_HIT_PADDING = 10
const EDGE_HIT_SAMPLES = 24

export function getBezierCurve(
  start: GraphCanvasEdgePoint,
  end: GraphCanvasEdgePoint,
  curvature = DEFAULT_CURVATURE,
) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  const delta = Math.max(Math.min(distance * curvature, 240), 48)
  const startVector = resolvePointVector(start, 'right')
  const endVector = resolvePointVector(end, 'left')

  return {
    start,
    end,
    controlA: {
      x: start.x + startVector.x * delta,
      y: start.y + startVector.y * delta,
    },
    controlB: {
      x: end.x + endVector.x * delta,
      y: end.y + endVector.y * delta,
    },
  }
}

export function getEdgeBounds(
  start: GraphCanvasEdgePoint,
  end: GraphCanvasEdgePoint,
  curvature = DEFAULT_CURVATURE,
): GraphRect {
  const curve = getBezierCurve(start, end, curvature)
  const xs = [curve.start.x, curve.controlA.x, curve.controlB.x, curve.end.x]
  const ys = [curve.start.y, curve.controlA.y, curve.controlB.y, curve.end.y]
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function isPointNearEdge(
  point: XYPosition,
  edge: Pick<GraphCanvasEdgeEntry, 'start' | 'end' | 'strokeWidth' | 'hitTest'>,
  zoom: number,
): boolean {
  if (edge.hitTest) {
    return edge.hitTest(point, zoom)
  }

  const curve = getBezierCurve(edge.start, edge.end)
  const threshold = Math.max(edge.strokeWidth * 0.8, EDGE_HIT_PADDING / zoom)
  let previous = curve.start

  for (let index = 1; index <= EDGE_HIT_SAMPLES; index += 1) {
    const current = sampleBezierPoint(curve, index / EDGE_HIT_SAMPLES)
    const distance = getDistanceToSegment(point, previous, current)

    if (distance <= threshold) {
      return true
    }

    previous = current
  }

  return false
}

export function drawBezierEdge(
  ctx: CanvasRenderingContext2D,
  start: GraphCanvasEdgePoint,
  end: GraphCanvasEdgePoint,
  options: {
    color: string
    lineWidth: number
    dash?: number[]
    shadowColor?: string
    shadowBlur?: number
  },
): void {
  const curve = getBezierCurve(start, end)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(curve.start.x, curve.start.y)
  ctx.bezierCurveTo(
    curve.controlA.x,
    curve.controlA.y,
    curve.controlB.x,
    curve.controlB.y,
    curve.end.x,
    curve.end.y,
  )
  ctx.strokeStyle = options.color
  ctx.lineWidth = options.lineWidth
  ctx.lineCap = 'round'
  ctx.setLineDash(options.dash ?? [])

  if (options.shadowColor) {
    ctx.shadowColor = options.shadowColor
    ctx.shadowBlur = options.shadowBlur ?? 0
  }

  ctx.stroke()
  ctx.restore()
}

export function drawDraftEndpoint(
  ctx: CanvasRenderingContext2D,
  point: GraphCanvasEdgePoint,
  options: {
    color: string
    direction?: GraphPort['direction']
  },
): void {
  const side = point.side ?? (options.direction === 'output' ? 'right' : 'left')
  const vector = resolvePointVector(point, side)

  ctx.save()
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(options.color, 0.16)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2)
  ctx.strokeStyle = options.color
  ctx.lineWidth = 2.25
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(point.x + vector.x * 8, point.y + vector.y * 8)
  ctx.lineTo(point.x + vector.x * 13, point.y + vector.y * 13)
  ctx.strokeStyle = withAlpha(options.color, 0.68)
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

function resolveSideVector(side: PortSide): XYPosition {
  switch (side) {
    case 'left':
      return { x: -1, y: 0 }
    case 'right':
      return { x: 1, y: 0 }
    case 'top':
      return { x: 0, y: -1 }
    case 'bottom':
      return { x: 0, y: 1 }
  }
}

function resolvePointVector(point: GraphCanvasEdgePoint, defaultSide: PortSide): XYPosition {
  return normalizeVector(point.tangent) ?? resolveSideVector(point.side ?? defaultSide)
}

function normalizeVector(vector: XYPosition | undefined): XYPosition | null {
  if (!vector) {
    return null
  }

  const length = Math.hypot(vector.x, vector.y)

  if (!Number.isFinite(length) || length < 0.0001) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  }
}

function sampleBezierPoint(curve: ReturnType<typeof getBezierCurve>, t: number): XYPosition {
  const inverse = 1 - t
  const weightA = inverse * inverse * inverse
  const weightB = 3 * inverse * inverse * t
  const weightC = 3 * inverse * t * t
  const weightD = t * t * t

  return {
    x:
      curve.start.x * weightA +
      curve.controlA.x * weightB +
      curve.controlB.x * weightC +
      curve.end.x * weightD,
    y:
      curve.start.y * weightA +
      curve.controlA.y * weightB +
      curve.controlB.y * weightC +
      curve.end.y * weightD,
  }
}

function getDistanceToSegment(point: XYPosition, start: XYPosition, end: XYPosition): number {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y

  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const ratio =
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
    (deltaX * deltaX + deltaY * deltaY)
  const clamped = Math.max(0, Math.min(1, ratio))

  return Math.hypot(point.x - (start.x + deltaX * clamped), point.y - (start.y + deltaY * clamped))
}
