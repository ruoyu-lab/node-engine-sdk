import type { GraphStore } from '../../store/index.js'
import type { ReadonlySignal } from '../reactive.js'
import { clamp, type GraphRect } from '../rendering/geometry.js'
import type {
  NodeEngineEditorHost,
  NodeEngineFitPadding,
  NodeEngineInsets,
  SelectionState,
} from '../types/index.js'
import type { GeometryQueries } from './geometry-queries.js'
import { zoomViewportAround, type ViewportModel } from './viewport.js'

const DEFAULT_FIT_PADDING = 64

/** Fitting, centring and zooming relative to the mounted host size. */
export interface ViewportCommands {
  fitGraph: (padding?: NodeEngineFitPadding) => void
  fitNodes: (nodeIds: string[], padding?: NodeEngineFitPadding) => void
  fitSelection: (padding?: NodeEngineFitPadding) => void
  zoomTo: (zoom: number) => void
  centerNode: (nodeId: string) => void
  centerSelection: () => void
}

export function createViewportCommands(options: {
  host: ReadonlySignal<NodeEngineEditorHost | null>
  viewport: ViewportModel
  geometry: GeometryQueries
  getSelection: () => SelectionState
  getStore: () => GraphStore
  getZoomRange: () => { minZoom: number; maxZoom: number }
}): ViewportCommands {
  /** Fits `bounds` into the host area left inside the padding and centres it there. */
  function fitBounds(
    bounds: GraphRect | null,
    padding: NodeEngineFitPadding,
    source: string,
  ): void {
    const root = options.host.peek()?.root

    if (!root || !bounds) {
      return
    }

    const inset = resolveFitPadding(padding)
    const width = Math.max(root.clientWidth - inset.left - inset.right, 1)
    const height = Math.max(root.clientHeight - inset.top - inset.bottom, 1)
    const range = options.getZoomRange()
    const zoom = clamp(
      Math.min(width / Math.max(bounds.width, 1), height / Math.max(bounds.height, 1)),
      range.minZoom,
      range.maxZoom,
    )

    options.viewport.set(
      {
        zoom,
        x: inset.left + width / 2 - (bounds.x + bounds.width / 2) * zoom,
        y: inset.top + height / 2 - (bounds.y + bounds.height / 2) * zoom,
      },
      source,
    )
  }

  function centerBounds(bounds: GraphRect | null, source: string): void {
    const root = options.host.peek()?.root

    if (!root || !bounds) {
      return
    }

    const zoom = options.viewport.viewport.peek().zoom

    options.viewport.set(
      {
        x: root.clientWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
        y: root.clientHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
      },
      source,
    )
  }

  function fitNodes(nodeIds: string[], padding: NodeEngineFitPadding = DEFAULT_FIT_PADDING): void {
    fitBounds(options.geometry.nodesBounds(nodeIds), padding, 'fit-nodes')
  }

  return {
    fitGraph(padding: NodeEngineFitPadding = DEFAULT_FIT_PADDING) {
      fitBounds(options.geometry.graphBounds(), padding, 'fit-view')
    },
    fitNodes,
    fitSelection(padding: NodeEngineFitPadding = DEFAULT_FIT_PADDING) {
      const selection = options.getSelection()
      const nodeIds = selection.nodes.length
        ? selection.nodes
        : [
            ...new Set(
              options
                .getStore()
                .getSnapshot()
                .edges.filter((edge) => selection.edges.includes(edge.id))
                .flatMap((edge) => [edge.source.nodeId, edge.target.nodeId]),
            ),
          ]

      fitNodes(nodeIds, padding)
    },
    zoomTo(zoom) {
      const range = options.getZoomRange()
      const root = options.host.peek()?.root
      // Programmatic zoom keeps the graph point at the viewport centre in place (wheel zoom
      // anchors at the pointer instead). An unmounted editor has an empty viewport whose centre
      // is the screen origin.
      const anchor = root ? { x: root.clientWidth / 2, y: root.clientHeight / 2 } : { x: 0, y: 0 }

      options.viewport.set(
        zoomViewportAround(
          options.viewport.viewport.peek(),
          clamp(zoom, range.minZoom, range.maxZoom),
          anchor,
        ),
        'zoom-to',
      )
    },
    centerNode(nodeId) {
      centerBounds(options.geometry.nodesBounds([nodeId]), 'center-node')
    },
    centerSelection() {
      centerBounds(options.geometry.nodesBounds(options.getSelection().nodes), 'center-selection')
    },
  }
}

/** A number pads every side alike; missing sides of an object default to 0. */
function resolveFitPadding(padding: NodeEngineFitPadding): Required<NodeEngineInsets> {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding }
  }

  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  }
}
