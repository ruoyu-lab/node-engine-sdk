import { cloneValue, type GraphEndpoint } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import type { ReadonlySignal } from '../reactive.js'
import { getGraphBounds, endpointKey } from '../rendering/node-layout.js'
import type {
  NodeWrightBounds,
  NodeWrightCoordinateSpace,
  NodeWrightPortAnchor,
} from '../types/index.js'
import type { EditorCoordinates } from './coordinates.js'
import type { EndpointStyles } from './endpoint-styles.js'
import { getGroupBoundsRect } from './groups.js'
import type { DragPreview } from './interactions/drag.js'
import type { LivePreview } from './live-preview.js'
import type { NodeViews } from './node-views.js'

/** Live bounds and port anchors in graph or screen space, including gesture previews. */
export interface GeometryQueries {
  nodeBounds: (nodeId: string, space?: NodeWrightCoordinateSpace) => NodeWrightBounds | null
  groupBounds: (groupId: string, space?: NodeWrightCoordinateSpace) => NodeWrightBounds | null
  portAnchor: (
    endpoint: GraphEndpoint,
    space?: NodeWrightCoordinateSpace,
  ) => NodeWrightPortAnchor | null
  /** Bounding box of the given nodes (all nodes when omitted). */
  nodesBounds: (nodeIds?: readonly string[]) => NodeWrightBounds | null
  /** Bounding box of every node and group. */
  graphBounds: () => NodeWrightBounds | null
}

export function createGeometryQueries(options: {
  getStore: () => GraphStore
  nodeViews: NodeViews
  coordinates: EditorCoordinates
  endpointStyles: EndpointStyles
  drag: DragPreview
  live: LivePreview
  headerHeight: ReadonlySignal<number>
}): GeometryQueries {
  return {
    nodeBounds(nodeId, space = 'graph') {
      const bounds = options.nodeViews.nodeBounds.value.get(nodeId)

      if (!bounds) {
        return null
      }

      const delta = options.drag.getNodeDelta(nodeId)
      const resolved = delta ? { ...bounds, x: bounds.x + delta.x, y: bounds.y + delta.y } : bounds

      return space === 'graph'
        ? cloneValue(resolved)
        : options.coordinates.graphRectToScreenRect(resolved)
    },
    groupBounds(groupId, space = 'graph') {
      const group = options.getStore().getGroup(groupId)

      if (!group) {
        return null
      }

      const bounds = getGroupBoundsRect(
        options.live.applyToGroup(group),
        options.headerHeight.value,
      )

      return space === 'graph' ? bounds : options.coordinates.graphRectToScreenRect(bounds)
    },
    portAnchor(endpoint, space = 'graph') {
      const layout = options.nodeViews.portLayouts.value.get(endpointKey(endpoint))

      if (!layout) {
        return null
      }

      const anchor = {
        ...options.live.applyToPortLayout(layout),
        connectionCount: options.endpointStyles.connectionCount(layout),
        connectionColor: options.endpointStyles.connectionColor(layout),
      }

      return space === 'graph'
        ? cloneValue(anchor)
        : { ...cloneValue(anchor), ...options.coordinates.graphToScreen(anchor) }
    },
    nodesBounds(nodeIds) {
      const nodes = options.nodeViews.resolvedNodes.value

      return getGraphBounds(nodeIds ? nodes.filter((node) => nodeIds.includes(node.id)) : nodes)
    },
    graphBounds() {
      const headerHeight = options.headerHeight.value
      const groups = options
        .getStore()
        .getSnapshot()
        .groups.map((group) => getGroupBoundsRect(options.live.applyToGroup(group), headerHeight))

      return getGraphBounds([...options.nodeViews.resolvedNodes.value, ...groups])
    },
  }
}
