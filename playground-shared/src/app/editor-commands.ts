import type {
  NodeEngineApi,
  NodeEngineMinimapOptions,
  NodeEnginePerformanceOptions,
  NodeEngineWheelBehavior,
  SelectionState,
} from '@node-engine-sdk/core/view'
import type { DemoScenario } from '../demo/scenarios'
import type { CanvasArea } from './canvas-insets'

/** Editor options both playground apps pass unchanged; constants keep their identity. */
export const PLAYGROUND_WHEEL_BEHAVIOR: NodeEngineWheelBehavior = 'mixed'
export const PLAYGROUND_MINIMAP: Readonly<NodeEngineMinimapOptions> = { width: 200, height: 136 }
export const EMPTY_SELECTION: Readonly<SelectionState> = { nodes: [], edges: [] }

/** Performance sampling, with or without the editor's performance overlay. */
export const PLAYGROUND_PERFORMANCE: Readonly<
  Record<'sampling' | 'overlay', Readonly<Partial<NodeEnginePerformanceOptions>>>
> = {
  sampling: { enabled: true },
  overlay: { enabled: true, overlay: true, overlayMinWidth: 600 },
}

const ZOOM_STEP = 1.25
/** Below this zoom node text is too small to read; narrow screens show the graph's start instead. */
const READABLE_ZOOM = 0.5

export interface HistoryAvailability {
  canUndo: boolean
  canRedo: boolean
}

export const NO_HISTORY: Readonly<HistoryAvailability> = { canUndo: false, canRedo: false }

export function readHistory(api: NodeEngineApi): HistoryAvailability {
  return { canUndo: api.history.canUndo(), canRedo: api.history.canRedo() }
}

/**
 * Fits the graph into the canvas area the floating panels leave free (`measureCanvasArea`).
 * When that takes the zoom below a readable size, as on phones, the view zooms back in around the
 * middle of the free area's left edge, so the start of the graph stays in view and the rest is a
 * pan away.
 */
export function fitGraph(api: NodeEngineApi, area: CanvasArea): void {
  api.view.fit.graph(area.insets)

  const fitted = api.view.get()

  if (fitted.zoom >= READABLE_ZOOM) {
    return
  }

  const { insets } = area
  const anchor = { x: insets.left, y: insets.top + (area.height - insets.top - insets.bottom) / 2 }
  const scale = READABLE_ZOOM / fitted.zoom

  api.view.set({
    zoom: READABLE_ZOOM,
    x: anchor.x - (anchor.x - fitted.x) * scale,
    y: anchor.y - (anchor.y - fitted.y) * scale,
  })
}

export function zoomIn(api: NodeEngineApi): void {
  api.view.zoom.to(api.view.get().zoom * ZOOM_STEP)
}

export function zoomOut(api: NodeEngineApi): void {
  api.view.zoom.to(api.view.get().zoom / ZOOM_STEP)
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

/** Restores the scenario's initial graph, clearing selection and history, and fits it. */
export function resetScenarioGraph(
  api: NodeEngineApi,
  scenario: DemoScenario,
  area: CanvasArea,
): void {
  api.selection.clear()
  api.graph.set(scenario.graph())
  fitGraph(api, area)
}

/** Applies the preset layout as one undoable change and fits the result. */
export function applyScenarioLayout(
  api: NodeEngineApi,
  scenario: DemoScenario,
  area: CanvasArea,
): void {
  api.graph.apply(scenario.preset.layout.apply(api.graph.get()))
  fitGraph(api, area)
}
