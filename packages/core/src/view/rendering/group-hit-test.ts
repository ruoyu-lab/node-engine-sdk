import type { XYPosition } from '../../protocol/index.js'
import type {
  NodeEngineCanvasGroupHitAreaKind,
  NodeEngineCanvasGroupHitTestContext,
} from '../types/index.js'
import type { VisibleGroupEntry } from './entries.js'
import { isPointInRect, type GraphRect } from './geometry.js'
import { isPointInGroup } from './group-canvas.js'

/** Hit areas of a group: custom renderer areas first, then the built-in header actions. */
function getDefaultGroupHitLayout(entry: VisibleGroupEntry) {
  const buttonSize = 16
  const buttonGap = 8
  const headerHeight = Math.min(entry.headerHeight, entry.bounds.height)
  const headerCenterY = entry.bounds.y + headerHeight / 2
  let rightCursor = entry.bounds.x + entry.bounds.width - 14
  const actions: Array<{ id: string; kind: 'action'; rect: GraphRect }> = []

  if (entry.showCloseButton) {
    actions.push({
      id: 'close',
      kind: 'action',
      rect: {
        x: rightCursor - buttonSize,
        y: headerCenterY - buttonSize / 2,
        width: buttonSize,
        height: buttonSize,
      },
    })
    rightCursor -= buttonSize + buttonGap
  }

  if (entry.showCollapseButton) {
    actions.push({
      id: 'toggle-collapse',
      kind: 'action',
      rect: {
        x: rightCursor - buttonSize,
        y: headerCenterY - buttonSize / 2,
        width: buttonSize,
        height: buttonSize,
      },
    })
  }

  const resizeSize = 14

  return {
    actions,
    resizeRect: {
      x: entry.bounds.x + entry.bounds.width - resizeSize - 2,
      y: entry.bounds.y + entry.bounds.height - resizeSize - 2,
      width: resizeSize,
      height: resizeSize,
    },
    headerBottom: entry.bounds.y + headerHeight,
  }
}

export function resolveGroupHitArea(
  entry: VisibleGroupEntry,
  point: XYPosition,
  options: {
    collapsed: boolean
    dragHandle: 'body' | 'header'
    /** Creates the renderer hit-test context; only called for renderers with hit-test hooks. */
    createHitContext: () => NodeEngineCanvasGroupHitTestContext
  },
): { id: string; kind: NodeEngineCanvasGroupHitAreaKind } | null {
  const renderer = entry.renderer
  const area = renderer?.hitAreaAt?.(options.createHitContext())

  if (area) {
    return {
      id: area.id,
      kind: area.kind ?? 'body',
    }
  }

  const hitTest = renderer?.hitTest
    ? (targetPoint: XYPosition) =>
        Boolean(renderer.hitTest?.({ ...options.createHitContext(), point: targetPoint }))
    : undefined

  if (!isPointInGroup(point, { bounds: entry.bounds, hitTest })) {
    return null
  }

  const defaultLayout = getDefaultGroupHitLayout(entry)

  for (const action of defaultLayout.actions) {
    if (isPointInRect(point, action.rect)) {
      return action
    }
  }

  if (entry.resizable && !options.collapsed && isPointInRect(point, defaultLayout.resizeRect)) {
    return {
      id: 'resize',
      kind: 'resize-handle',
    }
  }

  if (options.dragHandle === 'body') {
    return {
      id: 'body',
      kind: 'drag-handle',
    }
  }

  if (point.y <= defaultLayout.headerBottom) {
    return {
      id: 'header',
      kind: 'drag-handle',
    }
  }

  return {
    id: 'body',
    kind: 'body',
  }
}
