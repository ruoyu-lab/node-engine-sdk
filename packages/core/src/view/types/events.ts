import type { NodeEngineApi } from './api.js'
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
  NodeEngineBounds,
  NodeEngineContextTarget,
  NodeEngineEdgeRightClickAction,
  NodeEngineInteractionState,
  NodeEnginePerformanceSample,
  NodeEngineSelectionMode,
  SelectionState,
  ViewportState,
} from './common.js'
import type { NodeEngineCanvasGroupHitAreaKind } from './render.js'
import type { NodeEngineNodeEditorState } from './editor.js'
import type { NodeEngineContextMenuItem } from './extensions.js'

export interface NodeEngineContextMenuState {
  graphPosition: XYPosition
  position: XYPosition
  items: NodeEngineContextMenuItem[]
  target: NodeEngineContextTarget
}

export interface NodeEngineNodeClickEvent {
  node: GraphNode
  event: PointerEvent
}

export interface NodeEngineNodeDoubleClickEvent {
  node: GraphNode
  event: PointerEvent
}

export interface NodeEngineEdgeClickEvent {
  edge: GraphEdge
  event: PointerEvent
}

export interface NodeEngineEdgeRightClickEvent {
  edge: GraphEdge
  event: MouseEvent
  action: NodeEngineEdgeRightClickAction
  graph: GraphSnapshot
}

export interface NodeEngineEdgeDisconnectEvent {
  edge: GraphEdge
  graph: GraphSnapshot
  reason: string
}

export interface NodeEngineGroupClickEvent {
  group: GraphGroup
  event: PointerEvent
  areaId?: string
  areaKind?: NodeEngineCanvasGroupHitAreaKind
}

export interface NodeEngineGroupDragEvent {
  groupIds: string[]
  groups: GraphGroup[]
  nodeIds: string[]
  nodes: GraphNode[]
  delta: XYPosition
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeEngineInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeEngineGroupResizeEvent {
  groupId: string
  group: GraphGroup
  size: {
    width: number
    height: number
  }
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeEngineInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeEngineNodeDragEvent {
  nodeIds: string[]
  nodes: GraphNode[]
  delta: XYPosition
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeEngineInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeEngineNodeResizeEvent {
  nodeId: string
  node: GraphNode
  size: {
    width: number
    height: number
  }
  bounds: NodeEngineBounds
  graph: GraphSnapshot
  viewport: ViewportState
  interaction: NodeEngineInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeEngineMarqueeEvent {
  start: XYPosition
  current: XYPosition
  mode: NodeEngineSelectionMode
  graph: GraphSnapshot
}

export interface NodeEngineViewportInteractionEvent {
  viewport: ViewportState
  source: string
  graph: GraphSnapshot
  interaction: NodeEngineInteractionState
  liveGraph: GraphSnapshot
}

export interface NodeEngineConnectStartEvent {
  source: GraphEndpoint
  sourceNode?: GraphNode
  sourcePort?: GraphPort
  originDirection: GraphPort['direction']
  targetDirection: GraphPort['direction']
  point: XYPosition
  graph: GraphSnapshot
}

export interface NodeEngineConnectPreviewEvent {
  source: GraphEndpoint
  target?: GraphEndpoint
  originDirection: GraphPort['direction']
  targetDirection: GraphPort['direction']
  point: XYPosition
  validation?: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeEngineConnectEndEvent {
  source: GraphEndpoint
  target: GraphEndpoint
  edge?: GraphEdge
  validation: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeEngineConnectionCancelEvent {
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

export interface NodeEngineConnectionInvalidEvent {
  source: GraphEndpoint
  target: GraphEndpoint
  validation: ConnectionValidationResult
  graph: GraphSnapshot
}

export interface NodeEngineCommandErrorEvent {
  commandId: string
  payload?: unknown
  reason?: string
  validation?: ConnectionValidationResult
  snapshot: GraphSnapshot
}

export interface NodeEngineNodeParamChangeEvent {
  nodeId: string
  key: string
  value: GraphValue
  previousValue: GraphValue | undefined
  node: GraphNode
  graph: GraphSnapshot
}

export interface NodeEngineImportEvent {
  input: unknown
  graph: GraphSnapshot
}

export interface NodeEngineConnectEvent {
  edge: GraphEdge
}

export interface NodeEngineEventMap {
  'graph-change': [graph: GraphSnapshot]
  'node-click': [event: NodeEngineNodeClickEvent]
  'node-double-click': [event: NodeEngineNodeDoubleClickEvent]
  'edge-click': [event: NodeEngineEdgeClickEvent]
  'edge-right-click': [event: NodeEngineEdgeRightClickEvent]
  'edge-disconnect': [event: NodeEngineEdgeDisconnectEvent]
  'group-click': [event: NodeEngineGroupClickEvent]
  'group-drag-start': [event: NodeEngineGroupDragEvent]
  'group-drag': [event: NodeEngineGroupDragEvent]
  'group-drag-end': [event: NodeEngineGroupDragEvent]
  'group-resize-start': [event: NodeEngineGroupResizeEvent]
  'group-resize': [event: NodeEngineGroupResizeEvent]
  'group-resize-end': [event: NodeEngineGroupResizeEvent]
  'node-resize-start': [event: NodeEngineNodeResizeEvent]
  'node-resize': [event: NodeEngineNodeResizeEvent]
  'node-resize-end': [event: NodeEngineNodeResizeEvent]
  connect: [event: NodeEngineConnectEvent]
  'node-drag-start': [event: NodeEngineNodeDragEvent]
  'node-drag': [event: NodeEngineNodeDragEvent]
  'node-drag-end': [event: NodeEngineNodeDragEvent]
  'connection-start': [event: NodeEngineConnectStartEvent]
  'connection-preview': [event: NodeEngineConnectPreviewEvent]
  'connection-end': [event: NodeEngineConnectEndEvent]
  'connection-cancel': [event: NodeEngineConnectionCancelEvent]
  'connection-invalid': [event: NodeEngineConnectionInvalidEvent]
  'marquee-start': [event: NodeEngineMarqueeEvent]
  marquee: [event: NodeEngineMarqueeEvent]
  'marquee-end': [event: NodeEngineMarqueeEvent]
  'viewport-interaction-start': [event: NodeEngineViewportInteractionEvent]
  'viewport-interaction': [event: NodeEngineViewportInteractionEvent]
  'viewport-interaction-end': [event: NodeEngineViewportInteractionEvent]
  'context-menu-open': [state: NodeEngineContextMenuState]
  'context-menu-close': [state: NodeEngineContextMenuState | null]
  'selection-change': [selection: SelectionState, graph: GraphSnapshot, source?: string]
  'viewport-change': [viewport: ViewportState, source?: string]
  'command-error': [event: NodeEngineCommandErrorEvent]
  imported: [event: NodeEngineImportEvent]
  'node-editor-open': [state: NodeEngineNodeEditorState]
  'node-editor-close': [state: NodeEngineNodeEditorState]
  'node-param-change': [event: NodeEngineNodeParamChangeEvent]
  'performance-sample': [sample: NodeEnginePerformanceSample]
  command: [event: GraphStoreEvent]
  /**
   * The editor attached to its host elements (`controller.mount()`), so viewport commands such
   * as `api.view.fit.graph()` can measure it. Emitted on every mount, with the editor's API.
   */
  mount: [api: NodeEngineApi]
}

export type NodeEngineEventName = keyof NodeEngineEventMap

/** Emits one editor event with its exact payload; the controller emits and adapters forward. */
export type NodeEngineEventSink = <Event extends NodeEngineEventName>(
  event: Event,
  ...args: NodeEngineEventMap[Event]
) => void

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never

/**
 * Receives every editor event (`onEvent`). It has one call signature per event, so a listener may
 * declare fewer parameters than an event carries (`(name) => ...`, `(name, payload) => ...`), and
 * every `NodeEngineEventSink` is a listener. A single generic signature cannot allow that: the
 * payload is a generic rest tuple, which TypeScript only matches against a rest parameter.
 */
export type NodeEngineEventListener = UnionToIntersection<
  {
    [Event in NodeEngineEventName]: (event: Event, ...args: NodeEngineEventMap[Event]) => void
  }[NodeEngineEventName]
>
