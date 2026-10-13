import type { XYPosition } from '../../protocol/index.js'
import type { ViewportState } from '../types/index.js'

/** Axis-aligned rectangle math shared by culling, hit testing and selection. */
export interface GraphRect {
  x: number
  y: number
  width: number
  height: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid
}

export function normalizeRect(start: XYPosition, end: XYPosition): GraphRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function isPointInRect(point: XYPosition, rect: GraphRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function getViewportGraphBounds(
  viewport: ViewportState,
  size: { width: number; height: number },
): GraphRect {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: size.width / viewport.zoom,
    height: size.height / viewport.zoom,
  }
}

export function expandRect(rect: GraphRect, padding: number): GraphRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function rectIntersects(left: GraphRect, right: GraphRect): boolean {
  return !(
    left.x > right.x + right.width ||
    left.x + left.width < right.x ||
    left.y > right.y + right.height ||
    left.y + left.height < right.y
  )
}
