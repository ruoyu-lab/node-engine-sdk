import type { XYPosition } from '../../protocol/index.js'
import type { GraphRect } from './geometry.js'

/**
 * Minimap geometry. The minimap shows its world, the union of the graph content and the visible
 * viewport, scaled uniformly to fit the minimap minus its padding and centred in it.
 */

/** Maps graph coordinates onto minimap pixels: `minimap = graph * scale + (x, y)`. */
export interface MinimapTransform {
  scale: number
  x: number
  y: number
}

export interface MinimapSize {
  width: number
  height: number
}

/** Smallest rectangle containing both rectangles; a missing rectangle is ignored. */
export function unionRects(left: GraphRect | null, right: GraphRect | null): GraphRect | null {
  if (!left || !right) {
    return left ?? right
  }

  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)

  return {
    x,
    y,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    height: Math.max(left.y + left.height, right.y + right.height) - y,
  }
}

/** The area the minimap shows: the content bounds together with the visible viewport. */
export function resolveMinimapWorld(
  content: GraphRect | null,
  viewport: GraphRect | null,
): GraphRect | null {
  return unionRects(content, viewport)
}

/** Scales `world` uniformly into `size` minus `padding` on every side and centres it. */
export function fitMinimapTransform(
  world: GraphRect,
  size: MinimapSize,
  padding: number,
): MinimapTransform {
  const scale = Math.min(
    Math.max(size.width - padding * 2, 1) / Math.max(world.width, 1),
    Math.max(size.height - padding * 2, 1) / Math.max(world.height, 1),
  )

  return {
    scale,
    x: size.width / 2 - (world.x + world.width / 2) * scale,
    y: size.height / 2 - (world.y + world.height / 2) * scale,
  }
}

export function graphToMinimap(transform: MinimapTransform, point: XYPosition): XYPosition {
  return {
    x: point.x * transform.scale + transform.x,
    y: point.y * transform.scale + transform.y,
  }
}

export function minimapToGraph(transform: MinimapTransform, point: XYPosition): XYPosition {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  }
}

export function graphRectToMinimap(transform: MinimapTransform, rect: GraphRect): GraphRect {
  return {
    x: rect.x * transform.scale + transform.x,
    y: rect.y * transform.scale + transform.y,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  }
}

export function minimapTransformEquals(
  left: MinimapTransform | null,
  right: MinimapTransform | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.scale === right.scale &&
      left.x === right.x &&
      left.y === right.y)
  )
}
