import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  XYPosition,
} from '../../protocol/index.js'

import type { NodeWrightApi } from './api.js'
import type { NodeWrightCanvasGroupHitAreaKind } from './render.js'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

/**
 * Framework-neutral inline style declaration. Keys are camelCase CSS properties or `--custom`
 * properties; both the Vue and React adapters accept this shape for element styles.
 */
export type NodeWrightStyleDeclaration = Record<string, string | number>

export interface ViewportState {
  x: number
  y: number
  zoom: number
  minZoom?: number
  maxZoom?: number
}

export interface SelectionState {
  nodes: string[]
  edges: string[]
}

export type NodeWrightCoordinateSpace = 'graph' | 'screen'

export interface NodeWrightBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Distances from the edges of the editor, in screen pixels. */
export interface NodeWrightInsets {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

/** Free space around fitted content: one value for every side, or per side. */
export type NodeWrightFitPadding = number | NodeWrightInsets

export interface NodeWrightHistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface NodeWrightClipboard {
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups: GraphGroup[]
  selection: SelectionState
}

export interface NodeWrightContextTargetCanvas {
  kind: 'canvas'
}

export interface NodeWrightContextTargetNode {
  kind: 'node'
  node: GraphNode
}

export interface NodeWrightContextTargetEdge {
  kind: 'edge'
  edge: GraphEdge
}

export interface NodeWrightContextTargetGroup {
  kind: 'group'
  group: GraphGroup
  areaId?: string
  areaKind?: NodeWrightCanvasGroupHitAreaKind
}

export type NodeWrightContextTarget =
  | NodeWrightContextTargetCanvas
  | NodeWrightContextTargetNode
  | NodeWrightContextTargetEdge
  | NodeWrightContextTargetGroup

export interface NodeWrightPortAnchor {
  endpoint: GraphEndpoint
  x: number
  y: number
  side: PortSide
  port: GraphPort
  radius?: number
  connectionCount?: number
  connectionColor?: string
}

export interface NodeWrightRenderContext {
  graph: GraphSnapshot
  selection: SelectionState
  viewport: ViewportState
  readonly: boolean
  api: NodeWrightApi
  history: NodeWrightHistoryState
  rootElement: HTMLElement | null
  screenToGraph: (point: XYPosition) => XYPosition
  clientToGraph: (point: XYPosition) => XYPosition
  graphToScreen: (point: XYPosition) => XYPosition
}

/** Built-in palette of the editor; the root renders it as its `data-color-scheme` attribute. */
export type NodeWrightColorScheme = 'dark' | 'light'

/**
 * Editor colours. `colorScheme` picks the built-in dark (default) or light palette for the canvas
 * and the stylesheet; every other key overrides one canvas colour of that palette.
 */
export interface NodeWrightTheme {
  colorScheme?: NodeWrightColorScheme
  background?: string
  gridColor?: string
  gridMajorColor?: string
  edgeColor?: string
  edgeActiveColor?: string
  /** Execution edges and exec ports. */
  execEdgeColor?: string
  draftEdgeColor?: string
  draftEdgeGlowColor?: string
  /** Halo of selected and hovered edges. */
  selectionColor?: string
  marqueeColor?: string
  marqueeBorderColor?: string
  groupBackground?: string
  groupBorderColor?: string
  groupLabelColor?: string
  /** Minimap fill of nodes without an accent colour. */
  minimapNodeColor?: string
  nodeBackground?: string
  nodeBorderColor?: string
  nodeSelectedBorderColor?: string
  nodeShadowColor?: string
  nodeTitleColor?: string
  nodeSubtitleColor?: string
  nodeMetaColor?: string
  portFillColor?: string
  portStrokeColor?: string
  portLabelColor?: string
  portActiveColor?: string
  portActiveFillColor?: string
  portConnectedColor?: string
  portConnectedDotColor?: string
}

/**
 * Execution status a host shows on a node (see the `nodeStatus` editor option). The values match
 * the runtime's node statuses, so a run result maps onto the editor without translation.
 */
export type NodeWrightNodeStatus = 'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export type NodeWrightRenderMode = 'canvas' | 'dom' | 'hybrid'

export type NodeWrightPerformanceMode = 'idle' | 'drag' | 'pan' | 'zoom' | 'connect' | 'marquee'

export type NodeWrightMarqueeGesture = 'space-left' | 'middle' | 'shift-left'

export type NodeWrightSelectionMode = 'replace' | 'add' | 'subtract'

export type NodeWrightEdgeRightClickAction = 'disconnect' | 'context-menu' | 'select' | 'none'

export type NodeWrightNodeEditorActivateOn = 'selected' | 'double-click' | 'manual'

export type NodeWrightNodeEditorFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select'

export type NodeWrightWheelBehavior = 'zoom' | 'pan' | 'mixed'

export interface NodeWrightMarqueeBehaviorOptions {
  gestures?: NodeWrightMarqueeGesture[]
  selectionMode?: NodeWrightSelectionMode
}

export interface NodeWrightEdgeBehaviorOptions {
  rightClickAction?: NodeWrightEdgeRightClickAction
}

export type NodeWrightGroupDragHandleMode = 'header' | 'body'
export type NodeWrightGridPatternStyle = 'line' | 'dash' | 'dot'

export interface NodeWrightGroupBehaviorOptions {
  dragHandle?: NodeWrightGroupDragHandleMode
  headerHeight?: number
  moveNodesOnDrag?: boolean
  resizable?: boolean
  minWidth?: number
  minHeight?: number
  showCloseButton?: boolean
  showCollapseButton?: boolean
}

export interface NodeWrightGridBehaviorOptions {
  adaptive?: boolean
  minPixelStep?: number
  maxPixelStep?: number
  majorEvery?: number
  style?: NodeWrightGridPatternStyle
}

export interface NodeWrightNodeEditorInset {
  top: number
  right: number
  bottom: number
  left: number
}

export interface NodeWrightNodeEditorBehaviorOptions {
  enabled?: boolean
  defaultActivateOn?: NodeWrightNodeEditorActivateOn
  defaultInset?: Partial<NodeWrightNodeEditorInset>
  defaultMaxFields?: number
}

export interface NodeWrightBehaviors {
  marquee?: NodeWrightMarqueeBehaviorOptions
  edge?: NodeWrightEdgeBehaviorOptions
  group?: NodeWrightGroupBehaviorOptions
  grid?: NodeWrightGridBehaviorOptions
  editor?: NodeWrightNodeEditorBehaviorOptions
}

export interface NodeWrightGridState {
  visible: boolean
  adaptive: boolean
  baseStep: number
  step: number
  pixelStep: number
  majorEvery: number
  majorStep: number
  majorPixelStep: number
  style: NodeWrightGridPatternStyle
}

export interface NodeWrightInteractionState {
  mode: NodeWrightPerformanceMode
  spacePressed: boolean
  marqueeActive: boolean
  draggingNodeIds: string[]
  resizingNodeIds: string[]
  draggingGroupIds: string[]
  resizingGroupIds: string[]
  editingNodeId: string | null
  viewport: ViewportState
  viewportSource: string | null
  dragDelta: XYPosition | null
}

export interface NodeWrightPerformanceOptions {
  enabled?: boolean
  overlay?: boolean
  overlayMinWidth?: number
  overlayDismissible?: boolean
  sampleWindow?: number
  cullPadding?: number
}

export interface NodeWrightPerformanceSample {
  timestamp: number
  renderMode: NodeWrightRenderMode
  mode: NodeWrightPerformanceMode
  frameMs: number
  avgFrameMs: number
  drawMs: number
  avgDrawMs: number
  fps: number
  totalNodes: number
  visibleNodes: number
  totalEdges: number
  visibleEdges: number
  totalGroups: number
  visibleGroups: number
}
