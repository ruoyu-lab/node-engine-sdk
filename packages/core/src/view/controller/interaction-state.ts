import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphPort,
  XYPosition,
} from '../../protocol/index.js'
import { signal, type Signal } from '../reactive.js'
import type { GraphRect } from '../rendering/geometry.js'
import type { PortLayout, ResolvedNodeView } from '../rendering/node-layout.js'
import type {
  NodeEngineCanvasGroupHitAreaKind,
  NodeEngineDomNodeResizeHandle,
  NodeEngineSelectionMode,
  ViewportState,
} from '../types/index.js'

/**
 * State of the pointer gestures. At most one of pan, drag, node resize, group resize, connection
 * or marquee is active; each gesture module is the only writer of its own signal.
 */

export interface PanState {
  pointerStart: XYPosition
  current: XYPosition
  viewportStart: ViewportState
  clearSelectionOnClick: boolean
  clearSelectionSource: string | null
}

export interface DragState {
  kind: 'node' | 'group'
  pointerStart: XYPosition
  nodeOrigin: Record<string, XYPosition>
  groupOrigin: Record<string, XYPosition>
  nodeIds: string[]
  groupIds: string[]
  lastDelta: XYPosition
}

export interface NodeResizeState {
  nodeId: string
  handle: NodeEngineDomNodeResizeHandle
  pointerStart: XYPosition
  origin: GraphRect
  currentBounds: GraphRect
}

export interface GroupResizeState {
  groupId: string
  pointerStart: XYPosition
  origin: GraphRect
  currentSize: { width: number; height: number }
}

export interface ConnectionState {
  source: GraphEndpoint
  originDirection: GraphPort['direction']
  start: XYPosition
  current: XYPosition
}

export interface MarqueeState {
  start: XYPosition
  current: XYPosition
  mode: NodeEngineSelectionMode
}

export type CanvasHitTarget =
  | { kind: 'canvas' }
  | { kind: 'node'; node: ResolvedNodeView }
  | { kind: 'port'; node: ResolvedNodeView; port: PortLayout }
  | { kind: 'edge'; edge: GraphEdge }
  | {
      kind: 'group'
      group: GraphGroup
      areaId: string
      areaKind: NodeEngineCanvasGroupHitAreaKind
    }

export interface InteractionState {
  pan: Signal<PanState | null>
  /** Viewport preview of an in-flight wheel zoom or pan, committed when the wheel settles. */
  wheelViewport: Signal<ViewportState | null>
  /** Viewport preview of an in-flight minimap drag, committed when the pointer is released. */
  minimapViewport: Signal<ViewportState | null>
  drag: Signal<DragState | null>
  nodeResize: Signal<NodeResizeState | null>
  groupResize: Signal<GroupResizeState | null>
  connection: Signal<ConnectionState | null>
  connectionTarget: Signal<PortLayout | null>
  marquee: Signal<MarqueeState | null>
  spacePressed: Signal<boolean>
  hoverTarget: Signal<CanvasHitTarget>
  /** Source of the active viewport interaction (`pan`, `wheel.zoom`, `wheel.pan`, `minimap`). */
  viewportSource: Signal<string | null>
}

export function createInteractionState(): InteractionState {
  return {
    pan: signal<PanState | null>(null),
    wheelViewport: signal<ViewportState | null>(null),
    minimapViewport: signal<ViewportState | null>(null),
    drag: signal<DragState | null>(null),
    nodeResize: signal<NodeResizeState | null>(null),
    groupResize: signal<GroupResizeState | null>(null),
    connection: signal<ConnectionState | null>(null),
    connectionTarget: signal<PortLayout | null>(null),
    marquee: signal<MarqueeState | null>(null),
    spacePressed: signal(false),
    hoverTarget: signal<CanvasHitTarget>({ kind: 'canvas' }),
    viewportSource: signal<string | null>(null),
  }
}

/** True while a pointer gesture owns the canvas (hover and wheel inertia are suspended). */
export function hasActiveGesture(state: InteractionState): boolean {
  return Boolean(
    state.drag.value ||
    state.nodeResize.value ||
    state.groupResize.value ||
    state.connection.value ||
    state.pan.value ||
    state.marquee.value,
  )
}

export function resolvePanViewport(state: PanState): ViewportState {
  return {
    ...state.viewportStart,
    x: state.viewportStart.x + (state.current.x - state.pointerStart.x),
    y: state.viewportStart.y + (state.current.y - state.pointerStart.y),
  }
}
