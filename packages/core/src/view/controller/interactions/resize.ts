import type { GraphGroup, XYPosition } from '../../../protocol/index.js'
import type { ReadonlySignal, Signal } from '../../reactive.js'
import { snap, type GraphRect } from '../../rendering/geometry.js'
import type {
  NodeEngineDomNodeResizeHandle,
  NodeEngineDomNodeSizeConstraints,
  NodeEngineEventSink,
  NodeEngineGroupResizeEvent,
  NodeEngineNodeResizeEvent,
} from '../../types/index.js'
import type { GroupResizeState, NodeResizeState } from '../interaction-state.js'
import type { GridSnapping } from './drag.js'

interface Size {
  width: number
  height: number
}

/** Live size previews of the node or group being resized. */
export interface ResizePreview {
  /** Bounds for dragging `handle` by a delta from `origin`, respecting constraints and snapping. */
  resolveNodeBounds: (resize: {
    nodeId: string
    handle: NodeEngineDomNodeResizeHandle
    origin: GraphRect
    deltaX: number
    deltaY: number
  }) => GraphRect
  getNodeSize: (nodeId: string) => Size | null
  getGroupSize: (groupId: string) => Size | null
  applyToNode: <T extends { id: string }>(node: T) => T
}

export function createResizePreview(options: {
  nodeResize: ReadonlySignal<NodeResizeState | null>
  groupResize: ReadonlySignal<GroupResizeState | null>
  getSnapping: () => GridSnapping
  getNodeConstraints: (nodeId: string) => NodeEngineDomNodeSizeConstraints
}): ResizePreview {
  function resolveLength(value: number): number {
    const snapping = options.getSnapping()
    return snapping.enabled ? snap(value, snapping.size) : value
  }

  return {
    resolveNodeBounds(resize) {
      const constraints = options.getNodeConstraints(resize.nodeId)
      const fromLeft = resize.handle === 'nw' || resize.handle === 'sw'
      const fromTop = resize.handle === 'nw' || resize.handle === 'ne'
      const width = Math.max(
        constraints.minWidth,
        resolveLength(resize.origin.width + (fromLeft ? -resize.deltaX : resize.deltaX)),
      )
      const height = Math.max(
        constraints.minHeight,
        resolveLength(resize.origin.height + (fromTop ? -resize.deltaY : resize.deltaY)),
      )

      return {
        x: fromLeft ? resize.origin.x + resize.origin.width - width : resize.origin.x,
        y: fromTop ? resize.origin.y + resize.origin.height - height : resize.origin.y,
        width,
        height,
      }
    },
    getNodeSize(nodeId) {
      const state = options.nodeResize.value

      return state?.nodeId === nodeId
        ? { width: state.currentBounds.width, height: state.currentBounds.height }
        : null
    },
    getGroupSize(groupId) {
      const state = options.groupResize.value
      return state?.groupId === groupId ? state.currentSize : null
    },
    applyToNode(node) {
      const state = options.nodeResize.value

      return state?.nodeId === node.id ? { ...node, ...state.currentBounds } : node
    },
  }
}

/** Resizing a node from one of its corner handles, or a group from its resize handle. */
export interface ResizeGesture {
  startNode: (
    node: GraphRect & { id: string },
    handle: NodeEngineDomNodeResizeHandle,
    pointerStart: XYPosition,
  ) => void
  startGroup: (group: GraphGroup, pointerStart: XYPosition) => void
  /** Applies the graph-space pointer of the current frame and emits the resize event. */
  update: (pointer: XYPosition) => void
  finish: (commit: boolean) => void
}

export function createResizeGesture(options: {
  nodeResize: Signal<NodeResizeState | null>
  groupResize: Signal<GroupResizeState | null>
  preview: ResizePreview
  getGroupMinimumSize: () => Size
  emit: NodeEngineEventSink
  buildNodeResizeEvent: (nodeId: string) => NodeEngineNodeResizeEvent
  buildGroupResizeEvent: (groupId: string) => NodeEngineGroupResizeEvent
  resizeNode: (nodeId: string, bounds: GraphRect) => void
  resizeGroup: (groupId: string, size: Size) => void
}): ResizeGesture {
  return {
    startNode(node, handle, pointerStart) {
      const origin = { x: node.x, y: node.y, width: node.width, height: node.height }

      options.nodeResize.value = {
        nodeId: node.id,
        handle,
        pointerStart,
        origin,
        currentBounds: origin,
      }
      options.emit('node-resize-start', options.buildNodeResizeEvent(node.id))
    },
    startGroup(group, pointerStart) {
      options.groupResize.value = {
        groupId: group.id,
        pointerStart,
        origin: { x: group.x, y: group.y, width: group.width, height: group.height },
        currentSize: { width: group.width, height: group.height },
      }
      options.emit('group-resize-start', options.buildGroupResizeEvent(group.id))
    },
    update(pointer) {
      const nodeResize = options.nodeResize.peek()

      if (nodeResize) {
        options.nodeResize.value = {
          ...nodeResize,
          currentBounds: options.preview.resolveNodeBounds({
            nodeId: nodeResize.nodeId,
            handle: nodeResize.handle,
            origin: nodeResize.origin,
            deltaX: pointer.x - nodeResize.pointerStart.x,
            deltaY: pointer.y - nodeResize.pointerStart.y,
          }),
        }
        options.emit('node-resize', options.buildNodeResizeEvent(nodeResize.nodeId))
        return
      }

      const groupResize = options.groupResize.peek()

      if (groupResize) {
        const minimum = options.getGroupMinimumSize()

        options.groupResize.value = {
          ...groupResize,
          currentSize: {
            width: Math.max(
              minimum.width,
              groupResize.origin.width + (pointer.x - groupResize.pointerStart.x),
            ),
            height: Math.max(
              minimum.height,
              groupResize.origin.height + (pointer.y - groupResize.pointerStart.y),
            ),
          },
        }
        options.emit('group-resize', options.buildGroupResizeEvent(groupResize.groupId))
      }
    },
    finish(commit) {
      const nodeResize = options.nodeResize.peek()

      if (nodeResize) {
        const bounds = nodeResize.currentBounds
        const origin = nodeResize.origin

        options.emit('node-resize-end', options.buildNodeResizeEvent(nodeResize.nodeId))

        if (
          commit &&
          (bounds.x !== origin.x ||
            bounds.y !== origin.y ||
            bounds.width !== origin.width ||
            bounds.height !== origin.height)
        ) {
          options.resizeNode(nodeResize.nodeId, bounds)
        }

        options.nodeResize.value = null
      }

      const groupResize = options.groupResize.peek()

      if (groupResize) {
        const size = groupResize.currentSize

        options.emit('group-resize-end', options.buildGroupResizeEvent(groupResize.groupId))

        if (
          commit &&
          (size.width !== groupResize.origin.width || size.height !== groupResize.origin.height)
        ) {
          options.resizeGroup(groupResize.groupId, size)
        }

        options.groupResize.value = null
      }
    },
  }
}
