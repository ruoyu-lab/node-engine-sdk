import { cloneValue, type GraphSnapshot, type XYPosition } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { signal, type ReadonlySignal } from '../reactive.js'
import { clamp } from '../rendering/geometry.js'
import type { NodeEngineEventSink, ViewportState } from '../types/index.js'

/** Committed viewport (pan offset and zoom); live gesture previews are layered on top of it. */
export interface ViewportModel {
  readonly viewport: ReadonlySignal<ViewportState>
  set: (patch: Partial<ViewportState>, source: string) => GraphSnapshot
  get: () => ViewportState
}

export function createViewportModel(options: {
  initial: Partial<ViewportState> | undefined
  getZoomRange: () => { minZoom: number; maxZoom: number }
  getStore: () => GraphStore
  emit: NodeEngineEventSink
}): ViewportModel {
  const viewport = signal(normalizeViewport(options.initial))

  function normalizeViewport(value: Partial<ViewportState> | undefined): ViewportState {
    const range = options.getZoomRange()
    const minZoom = value?.minZoom ?? range.minZoom
    const maxZoom = Math.max(value?.maxZoom ?? range.maxZoom, minZoom)

    return {
      x: value?.x ?? 0,
      y: value?.y ?? 0,
      zoom: clamp(value?.zoom ?? 1, minZoom, maxZoom),
      minZoom,
      maxZoom,
    }
  }

  return {
    viewport,
    set(patch, source) {
      const next = normalizeViewport({ ...viewport.peek(), ...patch })

      if (!viewportEquals(viewport.peek(), next)) {
        viewport.value = next
        options.emit('viewport-change', cloneValue(next), source)
      }

      return options.getStore().getSnapshot()
    },
    get: () => cloneValue(viewport.peek()),
  }
}

export function viewportEquals(left: ViewportState, right: ViewportState): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.zoom === right.zoom &&
    left.minZoom === right.minZoom &&
    left.maxZoom === right.maxZoom
  )
}

/**
 * Changes the zoom so that the graph point under the screen point `anchor` stays under it. The
 * zoom must already be clamped to the editor's range.
 */
export function zoomViewportAround(
  viewport: ViewportState,
  zoom: number,
  anchor: XYPosition,
): Pick<ViewportState, 'x' | 'y' | 'zoom'> {
  const graphPoint = {
    x: (anchor.x - viewport.x) / viewport.zoom,
    y: (anchor.y - viewport.y) / viewport.zoom,
  }

  return {
    zoom,
    x: anchor.x - graphPoint.x * zoom,
    y: anchor.y - graphPoint.y * zoom,
  }
}
