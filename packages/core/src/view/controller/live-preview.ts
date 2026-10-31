import {
  cloneValue,
  type GraphGroup,
  type GraphNode,
  type GraphSnapshot,
  type XYPosition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import type { ReadonlySignal } from '../reactive.js'
import type { PortLayout } from '../rendering/node-layout.js'
import type {
  NodeWrightGroupDragEvent,
  NodeWrightGroupResizeEvent,
  NodeWrightInteractionState,
  NodeWrightNodeDragEvent,
  NodeWrightNodeResizeEvent,
  NodeWrightViewportInteractionEvent,
  ViewportState,
} from '../types/index.js'
import type { DragPreview } from './interactions/drag.js'
import type { ResizePreview } from './interactions/resize.js'

/**
 * The graph as the user currently sees it: committed state plus drag and resize previews. Also
 * builds the gesture event payloads, which always carry both the committed and the live graph.
 */
export interface LivePreview {
  applyToNode: (node: GraphNode) => GraphNode
  applyToGroup: (group: GraphGroup) => GraphGroup
  applyToPortLayout: (port: PortLayout) => PortLayout
  getGraph: () => GraphSnapshot
  getNode: (nodeId: string) => GraphNode | undefined
  getGroup: (groupId: string) => GraphGroup | undefined
  getViewport: () => ViewportState
  nodeDragEvent: (nodeIds: string[], delta: XYPosition) => NodeWrightNodeDragEvent
  groupDragEvent: (
    groupIds: string[],
    nodeIds: string[],
    delta: XYPosition,
  ) => NodeWrightGroupDragEvent
  nodeResizeEvent: (nodeId: string) => NodeWrightNodeResizeEvent
  groupResizeEvent: (groupId: string) => NodeWrightGroupResizeEvent
  viewportEvent: (source: string) => NodeWrightViewportInteractionEvent
}

export function createLivePreview(options: {
  getStore: () => GraphStore
  liveViewport: ReadonlySignal<ViewportState>
  drag: DragPreview
  resize: ResizePreview
  getInteractionState: () => NodeWrightInteractionState
}): LivePreview {
  function applyToNode(node: GraphNode): GraphNode {
    return options.resize.applyToNode(options.drag.applyToNode(node))
  }

  function applyToGroup(group: GraphGroup): GraphGroup {
    const dragged = options.drag.applyToGroup(group)
    const size = options.resize.getGroupSize(group.id)

    return size ? { ...dragged, width: size.width, height: size.height } : dragged
  }

  function getGraph(): GraphSnapshot {
    const graph = options.getStore().getSnapshot()

    return {
      ...graph,
      nodes: graph.nodes.map(applyToNode),
      groups: graph.groups.map(applyToGroup),
    }
  }

  function getViewport(): ViewportState {
    return cloneValue(options.liveViewport.peek())
  }

  function withLiveState<T extends { graph: GraphSnapshot }>(payload: T) {
    return {
      ...payload,
      viewport: getViewport(),
      interaction: options.getInteractionState(),
      liveGraph: getGraph(),
    }
  }

  return {
    applyToNode,
    applyToGroup,
    applyToPortLayout(port) {
      const delta = options.drag.getNodeDelta(port.endpoint.nodeId)
      return delta ? { ...port, x: port.x + delta.x, y: port.y + delta.y } : port
    },
    getGraph,
    getNode(nodeId) {
      const node = options.getStore().getNode(nodeId)
      return node ? applyToNode(node) : undefined
    },
    getGroup(groupId) {
      const group = options.getStore().getGroup(groupId)
      return group ? applyToGroup(group) : undefined
    },
    getViewport,
    nodeDragEvent(nodeIds, delta) {
      const graph = options.getStore().getSnapshot()
      const ids = new Set(nodeIds)

      return withLiveState({
        nodeIds: [...nodeIds],
        nodes: graph.nodes.filter((node) => ids.has(node.id)).map(options.drag.applyToNode),
        delta,
        graph,
      })
    },
    groupDragEvent(groupIds, nodeIds, delta) {
      const graph = options.getStore().getSnapshot()
      const groups = new Set(groupIds)
      const nodes = new Set(nodeIds)

      return withLiveState({
        groupIds: [...groupIds],
        groups: graph.groups.filter((group) => groups.has(group.id)).map(applyToGroup),
        nodeIds: [...nodeIds],
        nodes: graph.nodes.filter((node) => nodes.has(node.id)).map(options.drag.applyToNode),
        delta,
        graph,
      })
    },
    nodeResizeEvent(nodeId) {
      const graph = options.getStore().getSnapshot()
      const node = options.getStore().getNode(nodeId)
      const preview = node ? applyToNode(node) : null

      return withLiveState({
        nodeId,
        node: preview ?? { id: nodeId, type: '', x: 0, y: 0, width: 0, height: 0 },
        size: { width: preview?.width ?? 0, height: preview?.height ?? 0 },
        bounds: {
          x: preview?.x ?? 0,
          y: preview?.y ?? 0,
          width: preview?.width ?? 0,
          height: preview?.height ?? 0,
        },
        graph,
      })
    },
    groupResizeEvent(groupId) {
      const graph = options.getStore().getSnapshot()
      const group = options.getStore().getGroup(groupId)
      const preview = group ? applyToGroup(group) : null

      return withLiveState({
        groupId,
        group: preview ?? { id: groupId, x: 0, y: 0, width: 0, height: 0 },
        size: { width: preview?.width ?? 0, height: preview?.height ?? 0 },
        graph,
      })
    },
    viewportEvent(source) {
      const graph = options.getStore().getSnapshot()
      const viewport = options.liveViewport.peek()

      return withLiveState({ viewport, source, graph: { ...graph, viewport } })
    },
  }
}
