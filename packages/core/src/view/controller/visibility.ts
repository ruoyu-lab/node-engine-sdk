import type { GraphSnapshot } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import { withAlpha } from '../rendering/color.js'
import { getEdgeBounds } from '../rendering/edge-canvas.js'
import {
  resolveEdgeRenderer,
  resolveGroupRenderer,
  type VisibleEdgeEntry,
  type VisibleGroupEntry,
} from '../rendering/entries.js'
import {
  expandRect,
  getViewportGraphBounds,
  rectIntersects,
  type GraphRect,
} from '../rendering/geometry.js'
import type { CanvasNodeEntry } from '../rendering/node-canvas.js'
import { endpointKey, type ResolvedNodeView } from '../rendering/node-layout.js'
import type { GraphCanvasTheme } from '../rendering/graph-canvas.js'
import type { NodeWrightCanvasEdgeTheme, SelectionState, ViewportState } from '../types/index.js'
import type { EndpointStyles } from './endpoint-styles.js'
import type { EditorExtensions } from './extensions.js'
import { getGroupBoundsRect, isGroupCollapsed, resolveCollapsedGroupNodeIds } from './groups.js'
import type { DragPreview } from './interactions/drag.js'
import type { LivePreview } from './live-preview.js'
import type { NodeViews } from './node-views.js'
import type { NodeStackOrder } from './stack-order.js'
import type { ResolvedNodeWrightBehaviors } from './theme.js'

/** A coloured group fills its body with a faint tint of its colour. */
const GROUP_TINT_ALPHA = 0.06

export interface RenderSurface {
  width: number
  height: number
  dpr: number
}

/**
 * Viewport culling. Only nodes, edges and groups intersecting the visible graph area (plus the
 * configured padding) are painted, hit tested or rendered as DOM; members of collapsed groups
 * are hidden. Nodes are ordered by their stack order (paint order, last on top).
 */
export interface EditorVisibility {
  readonly nodes: ReadonlySignal<CanvasNodeEntry[]>
  readonly edges: ReadonlySignal<VisibleEdgeEntry[]>
  readonly groups: ReadonlySignal<VisibleGroupEntry[]>
}

export function createEditorVisibility(options: {
  graph: ReadonlySignal<GraphSnapshot>
  schemaRevision: ReadonlySignal<number>
  getStore: () => GraphStore
  surface: ReadonlySignal<RenderSurface>
  liveViewport: ReadonlySignal<ViewportState>
  cullPadding: ReadonlySignal<number>
  selection: ReadonlySignal<SelectionState>
  selectedNodeIds: ReadonlySignal<ReadonlySet<string>>
  nodeViews: NodeViews
  extensions: EditorExtensions
  endpointStyles: EndpointStyles
  drag: DragPreview
  live: LivePreview
  stackOrder: NodeStackOrder
  groupBehaviors: ReadonlySignal<ResolvedNodeWrightBehaviors['group']>
  graphTheme: ReadonlySignal<GraphCanvasTheme>
  edgeTheme: ReadonlySignal<NodeWrightCanvasEdgeTheme>
}): EditorVisibility {
  const bounds = computed<GraphRect | null>(() => {
    const surface = options.surface.value

    if (!surface.width || !surface.height) {
      return null
    }

    return expandRect(
      getViewportGraphBounds(options.liveViewport.value, surface),
      options.cullPadding.value,
    )
  })

  const collapsedNodeIds = computed(() => resolveCollapsedGroupNodeIds(options.graph.value))

  const nodes = computed<CanvasNodeEntry[]>(() => {
    const area = bounds.value
    const collapsed = collapsedNodeIds.value
    const layouts = options.nodeViews.nodePortLayouts.value
    const entries = options.nodeViews.resolvedNodes.value
      .filter((node) => !collapsed.has(node.id))
      .map((node) => options.drag.applyToNode(node))
      .filter((node) => !area || rectIntersects(area, node))
      .map((node, index) => ({
        entry: createCanvasNodeEntry(node, layouts.get(node.id)),
        index,
        stackOrder: options.stackOrder.resolve(node.id, index),
      }))

    return entries
      .sort((left, right) =>
        left.stackOrder === right.stackOrder
          ? left.index - right.index
          : left.stackOrder - right.stackOrder,
      )
      .map(({ entry }) => entry)
  })

  function createCanvasNodeEntry(
    node: ResolvedNodeView,
    layouts: { inputs: CanvasNodeEntry['inputs']; outputs: CanvasNodeEntry['outputs'] } | undefined,
  ): CanvasNodeEntry {
    return {
      node,
      bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      schema: node.schema,
      definition: node.definition,
      inputs: options.endpointStyles.decorate(
        layouts?.inputs ?? [],
        options.live.applyToPortLayout,
      ),
      outputs: options.endpointStyles.decorate(
        layouts?.outputs ?? [],
        options.live.applyToPortLayout,
      ),
      selected: options.selectedNodeIds.value.has(node.id),
      dragging: options.drag.isNodeDragging(node.id),
    }
  }

  const edges = computed<VisibleEdgeEntry[]>(() => {
    void options.schemaRevision.value

    const area = bounds.value
    const collapsed = collapsedNodeIds.value
    const layouts = options.nodeViews.portLayouts.value
    const selectedEdgeIds = new Set(options.selection.value.edges)
    const edgeTypes = options.extensions.edgeTypes.value
    const edgeRenderers = options.extensions.edgeRenderers.value
    const defaultRenderer = options.extensions.renderers.value.edge
    const store = options.getStore()
    const entries: VisibleEdgeEntry[] = []

    for (const edge of options.graph.value.edges) {
      if (collapsed.has(edge.source.nodeId) || collapsed.has(edge.target.nodeId)) {
        continue
      }

      const sourceLayout = layouts.get(endpointKey(edge.source))
      const targetLayout = layouts.get(endpointKey(edge.target))

      if (!sourceLayout || !targetLayout) {
        continue
      }

      const source = options.live.applyToPortLayout(sourceLayout)
      const target = options.live.applyToPortLayout(targetLayout)

      if (area && !rectIntersects(getEdgeBounds(source, target), area)) {
        continue
      }

      const schema = edge.type ? store.getEdgeDefinition(edge.type) : undefined
      const definition = edgeTypes[edge.type ?? '']
      const exec = edge.kind === 'exec'

      entries.push({
        edge,
        source,
        target,
        schema,
        definition,
        renderer: resolveEdgeRenderer(edge, schema, definition, edgeRenderers, defaultRenderer),
        selected: selectedEdgeIds.has(edge.id),
        stroke: exec
          ? options.edgeTheme.value.execStroke
          : (definition?.stroke ??
            options.endpointStyles.endpointColor(edge.source) ??
            options.edgeTheme.value.stroke),
        strokeWidth: definition?.strokeWidth ?? (exec ? 3 : 2.25),
      })
    }

    return entries
  })

  const groups = computed<VisibleGroupEntry[]>(() => {
    const area = bounds.value
    const behaviors = options.groupBehaviors.value
    const renderers = options.extensions.groupRenderers.value
    const defaultRenderer = options.extensions.renderers.value.group
    const theme = options.graphTheme.value
    const entries: VisibleGroupEntry[] = []

    for (const group of options.graph.value.groups) {
      const resolved = options.live.applyToGroup(group)
      const groupBounds = getGroupBoundsRect(resolved, behaviors.headerHeight)

      if (area && !rectIntersects(groupBounds, area)) {
        continue
      }

      entries.push({
        group: resolved,
        renderer: resolveGroupRenderer(resolved, renderers, defaultRenderer),
        bounds: groupBounds,
        headerHeight: behaviors.headerHeight,
        collapsed: isGroupCollapsed(resolved),
        showCloseButton: behaviors.showCloseButton,
        showCollapseButton: behaviors.showCollapseButton,
        resizable: behaviors.resizable,
        borderColor: resolved.color ?? theme.groupBorderColor,
        backgroundColor: resolved.color
          ? withAlpha(resolved.color, GROUP_TINT_ALPHA)
          : theme.groupBackground,
        labelColor: theme.groupLabelColor,
      })
    }

    return entries
  })

  return { nodes, edges, groups }
}
