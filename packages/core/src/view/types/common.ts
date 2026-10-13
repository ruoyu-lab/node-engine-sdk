import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  XYPosition,
} from '../../protocol/index.js'

import type { NodeEngineApi } from './api.js'
import type { NodeEngineCanvasGroupHitAreaKind } from './render.js'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

/**
 * Framework-neutral inline style declaration. Keys are camelCase CSS properties or `--custom`
 * properties; both the Vue and React adapters accept this shape for element styles.
 */
export type NodeEngineStyleDeclaration = Record<string, string | number>

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

export type NodeEngineCoordinateSpace = 'graph' | 'screen'

export interface NodeEngineBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Distances from the edges of the editor, in screen pixels. */
export interface NodeEngineInsets {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

/** Free space around fitted content: one value for every side, or per side. */
export type NodeEngineFitPadding = number | NodeEngineInsets

export interface NodeEngineHistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface NodeEngineClipboard {
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups: GraphGroup[]
  selection: SelectionState
}

export interface NodeEngineContextTargetCanvas {
  kind: 'canvas'
}

export interface NodeEngineContextTargetNode {
  kind: 'node'
  node: GraphNode
}

export interface NodeEngineContextTargetEdge {
  kind: 'edge'
  edge: GraphEdge
}

export interface NodeEngineContextTargetGroup {
  kind: 'group'
  group: GraphGroup
  areaId?: string
  areaKind?: NodeEngineCanvasGroupHitAreaKind
}

export type NodeEngineContextTarget =
  | NodeEngineContextTargetCanvas
  | NodeEngineContextTargetNode
  | NodeEngineContextTargetEdge
  | NodeEngineContextTargetGroup

export interface NodeEnginePortAnchor {
  endpoint: GraphEndpoint
  x: number
  y: number
  side: PortSide
  port: GraphPort
  radius?: number
  connectionCount?: number
  connectionColor?: string
}

export interface NodeEngineRenderContext {
  graph: GraphSnapshot
  selection: SelectionState
  viewport: ViewportState
  readonly: boolean
  api: NodeEngineApi
  history: NodeEngineHistoryState
  rootElement: HTMLElement | null
  screenToGraph: (point: XYPosition) => XYPosition
  clientToGraph: (point: XYPosition) => XYPosition
  graphToScreen: (point: XYPosition) => XYPosition
}

/** Built-in palette of the editor; the root renders it as its `data-color-scheme` attribute. */
export type NodeEngineColorScheme = 'dark' | 'light'

/**
 * Editor colours. `colorScheme` picks the built-in dark (default) or light palette for the canvas
 * and the stylesheet; every other key overrides one canvas colour of that palette.
 */
export interface NodeEngineTheme {
  colorScheme?: NodeEngineColorScheme
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
export type NodeEngineNodeStatus = 'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export type NodeEngineRenderMode = 'canvas' | 'dom' | 'hybrid'

export type NodeEnginePerformanceMode = 'idle' | 'drag' | 'pan' | 'zoom' | 'connect' | 'marquee'

export type NodeEngineMarqueeGesture = 'space-left' | 'middle' | 'shift-left'

export type NodeEngineSelectionMode = 'replace' | 'add' | 'subtract'

export type NodeEngineEdgeRightClickAction = 'disconnect' | 'context-menu' | 'select' | 'none'

export type NodeEngineNodeEditorActivateOn = 'selected' | 'double-click' | 'manual'

export type NodeEngineNodeEditorFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select'

export type NodeEngineWheelBehavior = 'zoom' | 'pan' | 'mixed'

export interface NodeEngineMarqueeBehaviorOptions {
  gestures?: NodeEngineMarqueeGesture[]
  selectionMode?: NodeEngineSelectionMode
}

export interface NodeEngineEdgeBehaviorOptions {
  rightClickAction?: NodeEngineEdgeRightClickAction
}

export type NodeEngineGroupDragHandleMode = 'header' | 'body'
export type NodeEngineGridPatternStyle = 'line' | 'dash' | 'dot'

export interface NodeEngineGroupBehaviorOptions {
  dragHandle?: NodeEngineGroupDragHandleMode
  headerHeight?: number
  moveNodesOnDrag?: boolean
  resizable?: boolean
  minWidth?: number
  minHeight?: number
  showCloseButton?: boolean
  showCollapseButton?: boolean
}

export interface NodeEngineGridBehaviorOptions {
  adaptive?: boolean
  minPixelStep?: number
  maxPixelStep?: number
  majorEvery?: number
  style?: NodeEngineGridPatternStyle
}

export interface NodeEngineNodeEditorInset {
  top: number
  right: number
  bottom: number
  left: number
}

export interface NodeEngineNodeEditorBehaviorOptions {
  enabled?: boolean
  defaultActivateOn?: NodeEngineNodeEditorActivateOn
  defaultInset?: Partial<NodeEngineNodeEditorInset>
  defaultMaxFields?: number
}

export interface NodeEngineBehaviors {
  marquee?: NodeEngineMarqueeBehaviorOptions
  edge?: NodeEngineEdgeBehaviorOptions
  group?: NodeEngineGroupBehaviorOptions
  grid?: NodeEngineGridBehaviorOptions
  editor?: NodeEngineNodeEditorBehaviorOptions
}

export interface NodeEngineGridState {
  visible: boolean
  adaptive: boolean
  baseStep: number
  step: number
  pixelStep: number
  majorEvery: number
  majorStep: number
  majorPixelStep: number
  style: NodeEngineGridPatternStyle
}

export interface NodeEngineInteractionState {
  mode: NodeEnginePerformanceMode
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

export interface NodeEnginePerformanceOptions {
  enabled?: boolean
  overlay?: boolean
  overlayMinWidth?: number
  overlayDismissible?: boolean
  sampleWindow?: number
  cullPadding?: number
}

export interface NodeEnginePerformanceSample {
  timestamp: number
  renderMode: NodeEngineRenderMode
  mode: NodeEnginePerformanceMode
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
