import type { NodeWrightApi } from './api.js'
import type {
  ConnectionValidationResult,
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  GraphStoreEvent,
  GraphValue,
  XYPosition,
} from '../../protocol/index.js'

import type {
  NodeWrightBounds,
  NodeWrightContextTarget,
  NodeWrightEdgeRightClickAction,
  NodeWrightInteractionState,
  NodeWrightPerformanceSample,
  NodeWrightSelectionMode,
  SelectionState,
  ViewportState,
} from './common.js'
import type { NodeWrightCanvasGroupHitAreaKind } from './render.js'
import type { NodeWrightNodeEditorState } from './editor.js'
import type { NodeWrightContextMenuItem } from './extensions.js'

export interface NodeWrightContextMenuState {
  graphPosition: XYPosition
  position: XYPosition
  items: NodeWrightContextMenuItem[]
  target: NodeWrightContextTarget
}

export interface NodeWrightNodeClickEvent {
  node: GraphNode
  event: PointerEvent
}

export interface NodeWrightNodeDoubleClickEvent {
  node: GraphNode
  event: PointerEvent
}

export interface NodeWrightEdgeClickEvent {
  edge: GraphEdge
  event: PointerEvent
}

export interface NodeWrightEdgeRightClickEvent {
  edge: GraphEdge
  event: MouseEvent
  action: NodeWrightEdgeRightClickAction
  graph: GraphSnapshot
}

export interface NodeWrightEdgeDisconnectEvent {
  edge: GraphEdge
  graph: GraphSnapshot
  reason: string
}

export interface NodeWrightGroupClickEvent {
  group: GraphGroup
  event: PointerEvent
  areaId?: string
  areaKind?: NodeWrightCanvasGroupHitAreaKind
}

export interface NodeWrightGroupDragEvent {
  groupIds: string[]
  groups: GraphGroup[]
  nodeIds: string[]
  nodes: GraphNode[]
  delta: XYPosition
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeWrightInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeWrightGroupResizeEvent {
  groupId: string
  group: GraphGroup
  size: {
    width: number
    height: number
  }
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeWrightInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeWrightNodeDragEvent {
  nodeIds: string[]
  nodes: GraphNode[]
  delta: XYPosition
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeWrightInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeWrightNodeResizeEvent {
  nodeId: string
  node: GraphNode
  size: {
    width: number
    height: number
  }
  bounds: NodeWrightBounds
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeWrightInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeWrightMarqueeEvent {
  start: XYPosition
  current: XYPosition
  mode: NodeWrightSelectionMode
  graph: GraphSnapshot
}

export interface NodeWrightViewportInteractionEvent {
  viewport: ViewportState
  source: string
  graph: GraphSnapshot
  interaction: NodeWrightInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeWrightConnectStartEvent {
  source: GraphEndpoint
  sourceNode?: GraphNode
  sourcePort?: GraphPort
  originDirection: GraphPort['direction']
  targetDirection: GraphPort['direction']
  point: XYPosition
  graph: GraphSnapshot
}

export interface NodeWrightConnectPreviewEvent {
  source: GraphEndpoint
  target?: GraphEndpoint
  originDirection: GraphPort['direction']
  targetDirection: GraphPort['direction']
  point: XYPosition
  validation?: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeWrightConnectEndEvent {
  source: GraphEndpoint
  target: GraphEndpoint
  edge?: GraphEdge
  validation: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeWrightConnectionCancelEvent {
  source: GraphEndpoint
  sourceNode?: GraphNode
  sourcePort?: GraphPort
  originDirection: GraphPort['direction']
  targetDirection: GraphPort['direction']
  startPoint: XYPosition
  point: XYPosition
  screenPoint: XYPosition
  dragDistance: number
  graph: GraphSnapshot
}

export interface NodeWrightConnectionInvalidEvent {
  source: GraphEndpoint
  target: GraphEndpoint
  validation: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeWrightCommandErrorEvent {
  commandId: string
  payload?: unknown
  reason?: string
  validation?: ConnectionValidationResult
  snapshot: GraphSnapshot
}

export interface NodeWrightNodeParamChangeEvent {
  nodeId: string
  key: string
  value: GraphValue
  previousValue: GraphValue | undefined
  node: GraphNode
  graph: GraphSnapshot
}

export interface NodeWrightImportEvent {
  input: unknown
  graph: GraphSnapshot
}

export interface NodeWrightConnectEvent {
  edge: GraphEdge
}

export interface NodeWrightEventMap {
  'graph-change': [graph: GraphSnapshot]
  'node-click': [event: NodeWrightNodeClickEvent]
  'node-double-click': [event: NodeWrightNodeDoubleClickEvent]
  'edge-click': [event: NodeWrightEdgeClickEvent]
  'edge-right-click': [event: NodeWrightEdgeRightClickEvent]
  'edge-disconnect': [event: NodeWrightEdgeDisconnectEvent]
  'group-click': [event: NodeWrightGroupClickEvent]
  'group-drag-start': [event: NodeWrightGroupDragEvent]
  'group-drag': [event: NodeWrightGroupDragEvent]
  'group-drag-end': [event: NodeWrightGroupDragEvent]
  'group-resize-start': [event: NodeWrightGroupResizeEvent]
  'group-resize': [event: NodeWrightGroupResizeEvent]
  'group-resize-end': [event: NodeWrightGroupResizeEvent]
  'node-resize-start': [event: NodeWrightNodeResizeEvent]
  'node-resize': [event: NodeWrightNodeResizeEvent]
  'node-resize-end': [event: NodeWrightNodeResizeEvent]
  connect: [event: NodeWrightConnectEvent]
  'node-drag-start': [event: NodeWrightNodeDragEvent]
  'node-drag': [event: NodeWrightNodeDragEvent]
  'node-drag-end': [event: NodeWrightNodeDragEvent]
  'connection-start': [event: NodeWrightConnectStartEvent]
  'connection-preview': [event: NodeWrightConnectPreviewEvent]
  'connection-end': [event: NodeWrightConnectEndEvent]
  'connection-cancel': [event: NodeWrightConnectionCancelEvent]
  'connection-invalid': [event: NodeWrightConnectionInvalidEvent]
  'marquee-start': [event: NodeWrightMarqueeEvent]
  marquee: [event: NodeWrightMarqueeEvent]
  'marquee-end': [event: NodeWrightMarqueeEvent]
  'viewport-interaction-start': [event: NodeWrightViewportInteractionEvent]
  'viewport-interaction': [event: NodeWrightViewportInteractionEvent]
  'viewport-interaction-end': [event: NodeWrightViewportInteractionEvent]
  'context-menu-open': [state: NodeWrightContextMenuState]
  'context-menu-close': [state: NodeWrightContextMenuState | null]
  'selection-change': [selection: SelectionState, graph: GraphSnapshot, source?: string]
  'viewport-change': [viewport: ViewportState, source?: string]
  'command-error': [event: NodeWrightCommandErrorEvent]
  imported: [event: NodeWrightImportEvent]
  'node-editor-open': [state: NodeWrightNodeEditorState]
  'node-editor-close': [state: NodeWrightNodeEditorState]
  'node-param-change': [event: NodeWrightNodeParamChangeEvent]
  'performance-sample': [sample: NodeWrightPerformanceSample]
  command: [event: GraphStoreEvent]
  /**
   * The editor attached to its host elements (`controller.mount()`), so viewport commands such
   * as `api.view.fit.graph()` can measure it. Emitted on every mount, with the editor's API.
   */
  mount: [api: NodeWrightApi]
}

export type NodeWrightEventName = keyof NodeWrightEventMap

/** Emits one editor event with its exact payload; the controller emits and adapters forward. */
export type NodeWrightEventSink = <Event extends NodeWrightEventName>(
  event: Event,
  ...args: NodeWrightEventMap[Event]
) => void

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never

/**
 * Receives every editor event (`onEvent`). It has one call signature per event, so a listener may
 * declare fewer parameters than an event carries (`(name) => ...`, `(name, payload) => ...`), and
 * every `NodeWrightEventSink` is a listener. A single generic signature cannot allow that: the
 * payload is a generic rest tuple, which TypeScript only matches against a rest parameter.
 */
export type NodeWrightEventListener = UnionToIntersection<
  {
    [Event in NodeWrightEventName]: (event: Event, ...args: NodeWrightEventMap[Event]) => void
  }[NodeWrightEventName]
>
