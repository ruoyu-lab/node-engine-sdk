import type { GraphGroup, XYPosition } from '../../protocol/index.js'
import type { GraphRect } from './geometry.js'
import { CANVAS_FONT_FAMILY, withAlpha } from './color.js'

const GROUP_LABEL_FONT = `600 13px ${CANVAS_FONT_FAMILY}`

export interface GraphCanvasGroupEntry {
  id: string
  group: GraphGroup
  bounds: GraphRect
  headerHeight?: number
  collapsed?: boolean
  showCloseButton?: boolean
  showCollapseButton?: boolean
  resizable?: boolean
  borderColor: string
  backgroundColor: string
  labelColor: string
  draw?: (ctx: CanvasRenderingContext2D) => void
  hitTest?: (point: XYPosition) => boolean
}

export function isPointInGroup(
  point: XYPosition,
  group: Pick<GraphCanvasGroupEntry, 'bounds' | 'hitTest'>,
): boolean {
  if (group.hitTest) {
    return group.hitTest(point)
  }

  return (
    point.x >= group.bounds.x &&
    point.x <= group.bounds.x + group.bounds.width &&
    point.y >= group.bounds.y &&
    point.y <= group.bounds.y + group.bounds.height
  )
}

export function drawGroup(ctx: CanvasRenderingContext2D, entry: GraphCanvasGroupEntry): void {
  const radius = 14
  const headerHeight = Math.min(entry.headerHeight ?? 40, entry.bounds.height)
  const collapsed = entry.collapsed === true
  const { x, y, width, height } = entry.bounds

  ctx.save()
  ctx.beginPath()
  drawRoundedRectPath(ctx, x, y, width, height, radius)
  ctx.fillStyle = entry.backgroundColor
  ctx.fill()
  ctx.strokeStyle = withAlpha(entry.borderColor, 0.72)
  ctx.lineWidth = 1
  ctx.stroke()

  if (headerHeight > 0 && !collapsed) {
    ctx.beginPath()
    ctx.moveTo(x + 1, y + headerHeight - 0.5)
    ctx.lineTo(x + width - 1, y + headerHeight - 0.5)
    ctx.strokeStyle = withAlpha(entry.borderColor, 0.32)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const actionSize = 18
  const actionGap = 4
  const actionCenterY = y + headerHeight / 2
  let actionCursorX = x + width - 11
  if (entry.showCloseButton) {
    const closeRect = {
      x: actionCursorX - actionSize,
      y: actionCenterY - actionSize / 2,
      width: actionSize,
      height: actionSize,
    }
    drawGroupActionButton(ctx, closeRect, entry.borderColor)
    drawCloseGlyph(ctx, closeRect, entry.labelColor)
    actionCursorX -= actionSize + actionGap
  }

  if (entry.showCollapseButton) {
    const collapseRect = {
      x: actionCursorX - actionSize,
      y: actionCenterY - actionSize / 2,
      width: actionSize,
      height: actionSize,
    }
    drawGroupActionButton(ctx, collapseRect, entry.borderColor)
    drawCollapseGlyph(ctx, collapseRect, entry.labelColor, collapsed)
  }

  if (entry.group.label) {
    const markerX = x + 18
    ctx.beginPath()
    ctx.arc(markerX, actionCenterY, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = entry.borderColor
    ctx.fill()

    ctx.fillStyle = entry.labelColor
    ctx.font = GROUP_LABEL_FONT
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(entry.group.label, markerX + 11, actionCenterY)
  }

  if (entry.resizable && !collapsed) {
    drawResizeHandle(ctx, { x: x + width - 10, y: y + height - 10 }, entry.borderColor)
  }

  ctx.restore()
}

function drawGroupActionButton(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  color: string,
): void {
  ctx.save()
  ctx.beginPath()
  drawRoundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, 6)
  ctx.fillStyle = withAlpha(color, 0.14)
  ctx.fill()
  ctx.restore()
}

function drawCollapseGlyph(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  color: string,
  collapsed: boolean,
): void {
  ctx.save()
  ctx.beginPath()
  if (collapsed) {
    ctx.moveTo(rect.x + 5, rect.y + rect.height / 2)
    ctx.lineTo(rect.x + rect.width - 5, rect.y + rect.height / 2)
    ctx.moveTo(rect.x + rect.width / 2, rect.y + 5)
    ctx.lineTo(rect.x + rect.width / 2, rect.y + rect.height - 5)
  } else {
    ctx.moveTo(rect.x + 5, rect.y + rect.height / 2)
    ctx.lineTo(rect.x + rect.width - 5, rect.y + rect.height / 2)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawCloseGlyph(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  color: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(rect.x + 5, rect.y + 5)
  ctx.lineTo(rect.x + rect.width - 5, rect.y + rect.height - 5)
  ctx.moveTo(rect.x + rect.width - 5, rect.y + 5)
  ctx.lineTo(rect.x + 5, rect.y + rect.height - 5)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawResizeHandle(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = withAlpha(color, 0.72)
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(point.x - 8, point.y + 2)
  ctx.lineTo(point.x + 2, point.y - 8)
  ctx.moveTo(point.x - 12, point.y + 2)
  ctx.lineTo(point.x + 2, point.y - 12)
  ctx.moveTo(point.x - 4, point.y + 2)
  ctx.lineTo(point.x + 2, point.y - 4)
  ctx.stroke()
  ctx.restore()
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  ctx.moveTo(x + safeRadius, y)
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius)
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius)
  ctx.arcTo(x, y + height, x, y, safeRadius)
  ctx.arcTo(x, y, x + width, y, safeRadius)
  ctx.closePath()
}
