import type { GraphStore } from '../../store/index.js'
import type { ReadonlySignal } from '../reactive.js'
import { getEdgeBounds } from '../rendering/edge-canvas.js'
import type { VisibleEdgeEntry } from '../rendering/entries.js'
import { rectIntersects } from '../rendering/geometry.js'
import type { PortLayout } from '../rendering/node-layout.js'
import type { NodeWrightEventSink, ViewportState } from '../types/index.js'
import type { EditorCoordinates } from './coordinates.js'
import type { EditorSettings } from './editor-settings.js'
import type { FrameScheduler } from './frame-scheduler.js'
import type { GroupCommands } from './group-commands.js'
import { hasActiveGesture, type InteractionState } from './interaction-state.js'
import type { ConnectionGesture } from './interactions/connection.js'
import { createDragGesture, type DragGesture } from './interactions/drag.js'
import { createInteractionFrame, type InteractionFrame } from './interactions/interaction-frame.js'
import { createMarqueeGesture, type MarqueeGesture } from './interactions/marquee.js'
import {
  createResizeGesture,
  type ResizeGesture,
  type ResizePreview,
} from './interactions/resize.js'
import {
  createPanGesture,
  createViewportInteraction,
  type PanGesture,
} from './interactions/viewport-gestures.js'
import { createWheelGesture, type WheelGesture } from './interactions/wheel.js'
import type { LivePreview } from './live-preview.js'
import type { NodeCommands } from './node-commands.js'
import type { NodeViews } from './node-views.js'
import type { SelectionModel } from './selection.js'
import type { ViewportModel } from './viewport.js'

/** The pointer and wheel gestures of an editor, coalesced into animation frames. */
export interface EditorGestures {
  pan: PanGesture
  wheel: WheelGesture
  marquee: MarqueeGesture
  drag: DragGesture
  resize: ResizeGesture
  frame: InteractionFrame
}

export function createEditorGestures(options: {
  state: InteractionState
  settings: EditorSettings
  getStore: () => GraphStore
  viewport: ViewportModel
  coordinates: EditorCoordinates
  selection: SelectionModel
  nodeViews: NodeViews
  visibleEdges: ReadonlySignal<VisibleEdgeEntry[]>
  live: LivePreview
  nodes: NodeCommands
  groups: GroupCommands
  resizePreview: ResizePreview
  connection: ConnectionGesture
  findConnectionTarget: (screenPoint: { x: number; y: number }) => PortLayout | null
  getScheduler: () => FrameScheduler | null
  drawNow: (timestamp: number) => void
  closeContextMenu: () => void
  emit: NodeWrightEventSink
}): EditorGestures {
  const viewportInteraction = createViewportInteraction({
    source: options.state.viewportSource,
    emit: options.emit,
    buildEvent: options.live.viewportEvent,
  })
  const setViewport = (next: ViewportState, source: string) => {
    options.viewport.set(next, source)
  }
  const pan = createPanGesture({
    pan: options.state.pan,
    getViewport: () => options.viewport.viewport.peek(),
    setViewport,
    getSelection: () => options.selection.selection.peek(),
    clearSelection: (source) => options.selection.clear(source),
    interaction: viewportInteraction,
  })
  const wheel = createWheelGesture({
    state: options.state,
    getViewport: () => options.viewport.viewport.peek(),
    getLiveViewport: () => options.coordinates.liveViewport.peek(),
    getZoomRange: options.settings.getZoomRange,
    getBehavior: () => options.settings.options.peek().wheelBehavior,
    getInertia: () => options.settings.options.peek().wheelInertia,
    hasActiveGesture: () => hasActiveGesture(options.state),
    getScreenPoint: options.coordinates.getScreenPoint,
    screenToGraph: options.coordinates.screenToGraph,
    setViewport,
    interaction: viewportInteraction,
    getScheduler: options.getScheduler,
    drawNow: options.drawNow,
    closeContextMenu: options.closeContextMenu,
  })
  const marquee = createMarqueeGesture({
    marquee: options.state.marquee,
    getGestures: () => options.settings.behaviors.peek().marquee.gestures,
    getDefaultMode: () => options.settings.behaviors.peek().marquee.selectionMode,
    isSpacePressed: () => options.state.spacePressed.peek(),
    getGraph: () => options.getStore().getSnapshot(),
    getSelection: () => options.selection.selection.peek(),
    getNodes: () => options.nodeViews.resolvedNodes.peek(),
    getEdgeIdsInRect: (bounds) =>
      options.visibleEdges
        .peek()
        .filter((entry) => rectIntersects(getEdgeBounds(entry.source, entry.target), bounds))
        .map((entry) => entry.edge.id),
    setSelection: options.selection.set,
    emit: options.emit,
  })
  const drag = createDragGesture({
    drag: options.state.drag,
    getSnapping: options.settings.getSnapping,
    emit: options.emit,
    buildNodeDragEvent: options.live.nodeDragEvent,
    buildGroupDragEvent: options.live.groupDragEvent,
    moveNodesFromOrigins: options.nodes.moveFromOrigins,
    moveGroups: (groupIds, delta, moveNodes) => {
      options.groups.move(groupIds, delta, { moveNodes })
    },
  })
  const resize = createResizeGesture({
    nodeResize: options.state.nodeResize,
    groupResize: options.state.groupResize,
    preview: options.resizePreview,
    getGroupMinimumSize: options.settings.getGroupMinimumSize,
    emit: options.emit,
    buildNodeResizeEvent: options.live.nodeResizeEvent,
    buildGroupResizeEvent: options.live.groupResizeEvent,
    resizeNode: (nodeId, bounds) => {
      options.nodes.resize(nodeId, bounds)
    },
    resizeGroup: (groupId, size) => {
      options.groups.resize(groupId, size)
    },
  })
  const frame = createInteractionFrame({
    state: options.state,
    screenToGraph: options.coordinates.screenToGraph,
    findConnectionTarget: options.findConnectionTarget,
    drag,
    resize,
    pan,
    marquee,
    connection: options.connection,
    getScheduler: options.getScheduler,
    drawNow: options.drawNow,
  })

  return { pan, wheel, marquee, drag, resize, frame }
}
