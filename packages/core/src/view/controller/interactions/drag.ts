import type { GraphGroup, GraphNode, XYPosition } from '../../../protocol/index.js'
import type { ReadonlySignal, Signal } from '../../reactive.js'
import { snap } from '../../rendering/geometry.js'
import type {
  NodeWrightEventSink,
  NodeWrightGroupDragEvent,
  NodeWrightNodeDragEvent,
} from '../../types/index.js'
import type { DragState } from '../interaction-state.js'

export interface GridSnapping {
  enabled: boolean
  size: number
}

/** Snapped preview offsets of the entities being dragged; the graph is untouched until drop. */
export interface DragPreview {
  getNodeDelta: (nodeId: string) => XYPosition | null
  isNodeDragging: (nodeId: string) => boolean
  applyToNode: <T extends GraphNode>(node: T) => T
  applyToGroup: <T extends GraphGroup>(group: T) => T
}

export function createDragPreview(options: {
  drag: ReadonlySignal<DragState | null>
  getSnapping: () => GridSnapping
}): DragPreview {
  function getDelta(origins: Record<string, XYPosition>, entityId: string): XYPosition | null {
    const state = options.drag.value
    const origin = origins[entityId]

    if (!state || !origin) {
      return null
    }

    return {
      x: resolveCoordinate(origin.x + state.lastDelta.x) - origin.x,
      y: resolveCoordinate(origin.y + state.lastDelta.y) - origin.y,
    }
  }

  function resolveCoordinate(value: number): number {
    const snapping = options.getSnapping()
    return snapping.enabled ? snap(value, snapping.size) : value
  }

  function applyDelta<T extends XYPosition>(entity: T, delta: XYPosition | null): T {
    return delta ? { ...entity, x: entity.x + delta.x, y: entity.y + delta.y } : entity
  }

  const getNodeDelta = (nodeId: string) => getDelta(options.drag.value?.nodeOrigin ?? {}, nodeId)

  return {
    getNodeDelta,
    isNodeDragging: (nodeId) => Boolean(options.drag.value?.nodeOrigin[nodeId]),
    applyToNode: (node) => applyDelta(node, getNodeDelta(node.id)),
    applyToGroup: (group) =>
      applyDelta(group, getDelta(options.drag.value?.groupOrigin ?? {}, group.id)),
  }
}

/** Dragging nodes (with the selection) or a group (optionally with its member nodes). */
export interface DragGesture {
  startNodes: (pointerStart: XYPosition, nodeIds: string[], nodes: GraphNode[]) => void
  startGroup: (
    pointerStart: XYPosition,
    group: GraphGroup,
    nodeIds: string[],
    nodes: GraphNode[],
  ) => void
  /** Records the pointer delta of the current frame and emits the drag event. */
  update: (pointer: XYPosition) => void
  finish: (commit: boolean) => void
}

export function createDragGesture(options: {
  drag: Signal<DragState | null>
  getSnapping: () => GridSnapping
  emit: NodeWrightEventSink
  buildNodeDragEvent: (nodeIds: string[], delta: XYPosition) => NodeWrightNodeDragEvent
  buildGroupDragEvent: (
    groupIds: string[],
    nodeIds: string[],
    delta: XYPosition,
  ) => NodeWrightGroupDragEvent
  moveNodesFromOrigins: (origins: Record<string, XYPosition>, delta: XYPosition) => void
  moveGroups: (groupIds: string[], delta: XYPosition, moveNodes: boolean) => void
}): DragGesture {
  function emitDrag(phase: 'start' | 'move' | 'end', state: DragState): void {
    if (state.kind === 'group') {
      const event = options.buildGroupDragEvent(state.groupIds, state.nodeIds, state.lastDelta)
      options.emit(
        phase === 'start' ? 'group-drag-start' : phase === 'end' ? 'group-drag-end' : 'group-drag',
        event,
      )
      return
    }

    const event = options.buildNodeDragEvent(state.nodeIds, state.lastDelta)
    options.emit(
      phase === 'start' ? 'node-drag-start' : phase === 'end' ? 'node-drag-end' : 'node-drag',
      event,
    )
  }

  function start(state: DragState): void {
    options.drag.value = state
    emitDrag('start', state)
  }

  return {
    startNodes(pointerStart, nodeIds, nodes) {
      start({
        kind: 'node',
        pointerStart,
        nodeOrigin: originsOf(nodes),
        groupOrigin: {},
        nodeIds: [...nodeIds],
        groupIds: [],
        lastDelta: { x: 0, y: 0 },
      })
    },
    startGroup(pointerStart, group, nodeIds, nodes) {
      start({
        kind: 'group',
        pointerStart,
        nodeOrigin: originsOf(nodes),
        groupOrigin: { [group.id]: { x: group.x, y: group.y } },
        nodeIds: [...nodeIds],
        groupIds: [group.id],
        lastDelta: { x: 0, y: 0 },
      })
    },
    update(pointer) {
      const state = options.drag.peek()

      if (!state) {
        return
      }

      const next = {
        ...state,
        lastDelta: { x: pointer.x - state.pointerStart.x, y: pointer.y - state.pointerStart.y },
      }
      options.drag.value = next
      emitDrag('move', next)
    },
    finish(commit) {
      const state = options.drag.peek()

      if (!state) {
        return
      }

      emitDrag('end', state)

      if (commit && (state.lastDelta.x !== 0 || state.lastDelta.y !== 0)) {
        commitDrag(state)
      }

      options.drag.value = null
    },
  }

  function commitDrag(state: DragState): void {
    if (state.kind === 'node') {
      options.moveNodesFromOrigins(state.nodeOrigin, state.lastDelta)
      return
    }

    const snapping = options.getSnapping()
    const origin = state.groupIds[0] ? state.groupOrigin[state.groupIds[0]] : undefined
    const delta =
      origin && snapping.enabled
        ? {
            x: snap(origin.x + state.lastDelta.x, snapping.size) - origin.x,
            y: snap(origin.y + state.lastDelta.y, snapping.size) - origin.y,
          }
        : state.lastDelta

    options.moveGroups(state.groupIds, delta, state.nodeIds.length > 0)
  }
}

function originsOf(entities: Array<{ id: string } & XYPosition>): Record<string, XYPosition> {
  return Object.fromEntries(entities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]))
}
