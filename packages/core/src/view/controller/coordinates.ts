import type { XYPosition } from '../../protocol/index.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import { normalizeRect, type GraphRect } from '../rendering/geometry.js'
import type {
  NodeEngineBounds,
  NodeEngineEditorHost,
  NodeEngineStyleDeclaration,
  ViewportState,
} from '../types/index.js'
import { resolvePanViewport, type InteractionState } from './interaction-state.js'

/**
 * Conversions between client, screen (host-relative) and graph coordinates, always against the
 * live viewport: an active pan, minimap or wheel preview takes precedence over the committed
 * viewport.
 */
export interface EditorCoordinates {
  readonly liveViewport: ReadonlySignal<ViewportState>
  screenToGraph: (point: XYPosition) => XYPosition
  graphToScreen: (point: XYPosition) => XYPosition
  clientToGraph: (point: XYPosition) => XYPosition
  graphRectToScreenRect: (bounds: NodeEngineBounds) => NodeEngineBounds
  /** Host-relative position of a pointer, mouse or wheel event. */
  getScreenPoint: (event: Pick<MouseEvent, 'clientX' | 'clientY'>) => XYPosition
  /** Screen-space CSS box of the graph rectangle spanned by two graph points. */
  toScreenBox: (start: XYPosition, end: XYPosition) => NodeEngineStyleDeclaration
}

export function createEditorCoordinates(options: {
  viewport: ReadonlySignal<ViewportState>
  state: InteractionState
  host: ReadonlySignal<NodeEngineEditorHost | null>
}): EditorCoordinates {
  const liveViewport = computed(() => {
    const pan = options.state.pan.value

    if (pan) {
      return resolvePanViewport(pan)
    }

    return (
      options.state.minimapViewport.value ??
      options.state.wheelViewport.value ??
      options.viewport.value
    )
  })

  function screenToGraph(point: XYPosition): XYPosition {
    const viewport = liveViewport.value

    return {
      x: (point.x - viewport.x) / viewport.zoom,
      y: (point.y - viewport.y) / viewport.zoom,
    }
  }

  function graphToScreen(point: XYPosition): XYPosition {
    const viewport = liveViewport.value

    return {
      x: point.x * viewport.zoom + viewport.x,
      y: point.y * viewport.zoom + viewport.y,
    }
  }

  function getScreenPoint(event: Pick<MouseEvent, 'clientX' | 'clientY'>): XYPosition {
    const rect = options.host.value?.root.getBoundingClientRect()

    if (!rect) {
      return { x: 0, y: 0 }
    }

    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function graphRectToScreenRect(bounds: NodeEngineBounds): NodeEngineBounds {
    const topLeft = graphToScreen(bounds)
    const zoom = liveViewport.value.zoom

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bounds.width * zoom,
      height: bounds.height * zoom,
    }
  }

  return {
    liveViewport,
    screenToGraph,
    graphToScreen,
    clientToGraph(point) {
      const rect = options.host.value?.root.getBoundingClientRect()

      return rect
        ? screenToGraph({ x: point.x - rect.left, y: point.y - rect.top })
        : { x: 0, y: 0 }
    },
    graphRectToScreenRect,
    getScreenPoint,
    toScreenBox(start, end) {
      const rect: GraphRect = graphRectToScreenRect(normalizeRect(start, end))

      return {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }
    },
  }
}
