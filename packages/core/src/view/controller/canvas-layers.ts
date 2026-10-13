import type { GraphEndpoint } from '../../protocol/index.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import { type GraphCanvasDraftEdge, type GraphCanvasEdgeEntry } from '../rendering/edge-canvas.js'
import {
  createCanvasEdgeEntry,
  createCanvasGroupEntry,
  getDraftEdgeEntry,
  type VisibleEdgeEntry,
  type VisibleGroupEntry,
} from '../rendering/entries.js'
import { drawGraphCanvas, type GraphCanvasTheme } from '../rendering/graph-canvas.js'
import { drawGridCanvas } from '../rendering/grid-canvas.js'
import type { GraphCanvasGroupEntry } from '../rendering/group-canvas.js'
import { drawCanvasNodes, type CanvasNodeEntry } from '../rendering/node-canvas.js'
import { endpointKey, type PortLayout } from '../rendering/node-layout.js'
import type {
  NodeEngineCanvasEdgeTheme,
  NodeEngineCanvasGroupTheme,
  NodeEngineCanvasNodeTheme,
  NodeEngineGridState,
  NodeEngineRenderContext,
  ViewportState,
} from '../types/index.js'
import type { EndpointStyles } from './endpoint-styles.js'
import type { InteractionState } from './interaction-state.js'
import type { LivePreview } from './live-preview.js'
import type { ResolvedNodeEngineGridColors } from './theme.js'
import type { RenderSurface } from './visibility.js'

/** Everything one paint of the grid canvas depends on. */
export interface GridFrame {
  surface: RenderSurface
  viewport: ViewportState
  grid: NodeEngineGridState
  colors: ResolvedNodeEngineGridColors
}

/** Everything one paint of the graph canvas depends on. */
export interface CanvasFrame {
  surface: RenderSurface
  viewport: ViewportState
  theme: GraphCanvasTheme
  edges: GraphCanvasEdgeEntry[]
  groups: GraphCanvasGroupEntry[]
  draftEdge: GraphCanvasDraftEdge | null
  hoveredEdgeId: string | null
  nodes: CanvasNodeEntry[]
  readonly: boolean
  nodeTheme: NodeEngineCanvasNodeTheme
  connectionSource?: GraphEndpoint
  connectionTarget?: GraphEndpoint
  context: NodeEngineRenderContext
}

export interface CanvasLayers {
  /** Edges in paint order, also used for edge hit testing. */
  readonly edges: ReadonlySignal<GraphCanvasEdgeEntry[]>
  readonly gridFrame: ReadonlySignal<GridFrame>
  readonly canvasFrame: ReadonlySignal<CanvasFrame>
}

export function createCanvasLayers(options: {
  surface: ReadonlySignal<RenderSurface>
  liveViewport: ReadonlySignal<ViewportState>
  gridState: ReadonlySignal<NodeEngineGridState>
  gridColors: ReadonlySignal<ResolvedNodeEngineGridColors>
  visibleEdges: ReadonlySignal<VisibleEdgeEntry[]>
  visibleGroups: ReadonlySignal<VisibleGroupEntry[]>
  paintedNodes: ReadonlySignal<CanvasNodeEntry[]>
  portLayouts: ReadonlySignal<Map<string, PortLayout>>
  state: InteractionState
  readonly: () => boolean
  connectionPreview: () => boolean
  graphTheme: ReadonlySignal<GraphCanvasTheme>
  edgeTheme: ReadonlySignal<NodeEngineCanvasEdgeTheme>
  groupTheme: ReadonlySignal<NodeEngineCanvasGroupTheme>
  nodeTheme: ReadonlySignal<NodeEngineCanvasNodeTheme>
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  endpointStyles: EndpointStyles
  live: LivePreview
  getCanvasContext: () => CanvasRenderingContext2D
}): CanvasLayers {
  const edges = computed(() => {
    const entryOptions = {
      readonly: options.readonly(),
      zoom: options.liveViewport.value.zoom,
      theme: options.edgeTheme.value,
      context: options.renderContext.value,
      getCanvasContext: options.getCanvasContext,
    }

    return options.visibleEdges.value.map((entry) => createCanvasEdgeEntry(entry, entryOptions))
  })

  const groups = computed(() => {
    const entryOptions = {
      readonly: options.readonly(),
      zoom: options.liveViewport.value.zoom,
      theme: options.groupTheme.value,
      context: options.renderContext.value,
      getCanvasContext: options.getCanvasContext,
    }

    return options.visibleGroups.value.map((entry) => createCanvasGroupEntry(entry, entryOptions))
  })

  const draftEdge = computed(() => {
    const connection = options.state.connection.value

    if (!options.connectionPreview() || !connection) {
      return null
    }

    const source = options.portLayouts.value.get(endpointKey(connection.source))

    return getDraftEdgeEntry({
      connection,
      source: source ? options.live.applyToPortLayout(source) : undefined,
      color:
        options.endpointStyles.endpointColor(connection.source) ??
        options.graphTheme.value.draftEdgeColor,
    })
  })

  const hoveredEdgeId = computed(() => {
    const target = options.state.hoverTarget.value

    return target.kind === 'edge' ? target.edge.id : null
  })

  return {
    edges,
    gridFrame: computed(() => ({
      surface: options.surface.value,
      viewport: options.liveViewport.value,
      grid: options.gridState.value,
      colors: options.gridColors.value,
    })),
    canvasFrame: computed(() => ({
      surface: options.surface.value,
      viewport: options.liveViewport.value,
      theme: options.graphTheme.value,
      edges: edges.value,
      groups: groups.value,
      draftEdge: draftEdge.value,
      hoveredEdgeId: hoveredEdgeId.value,
      nodes: options.paintedNodes.value,
      readonly: options.readonly(),
      nodeTheme: options.nodeTheme.value,
      connectionSource: options.state.connection.value?.source,
      connectionTarget: options.state.connectionTarget.value?.endpoint,
      context: options.renderContext.value,
    })),
  }
}

export function paintGrid(ctx: CanvasRenderingContext2D, frame: GridFrame): void {
  drawGridCanvas({
    ctx,
    width: frame.surface.width,
    height: frame.surface.height,
    dpr: frame.surface.dpr,
    viewport: frame.viewport,
    grid: frame.grid,
    minorColor: frame.colors.minor,
    majorColor: frame.colors.major,
  })
}

export function paintCanvas(ctx: CanvasRenderingContext2D, frame: CanvasFrame): void {
  const { surface, viewport } = frame

  drawGraphCanvas({
    ctx,
    width: surface.width,
    height: surface.height,
    dpr: surface.dpr,
    viewport,
    theme: frame.theme,
    edges: frame.edges,
    groups: frame.groups,
    draftEdge: frame.draftEdge,
    hoveredEdgeId: frame.hoveredEdgeId,
  })

  if (!frame.nodes.length) {
    return
  }

  ctx.save()
  ctx.setTransform(
    surface.dpr * viewport.zoom,
    0,
    0,
    surface.dpr * viewport.zoom,
    surface.dpr * viewport.x,
    surface.dpr * viewport.y,
  )
  drawCanvasNodes(ctx, frame.nodes, {
    zoom: viewport.zoom,
    readonly: frame.readonly,
    theme: frame.nodeTheme,
    connectionSource: frame.connectionSource,
    connectionTarget: frame.connectionTarget,
    context: frame.context,
  })
  ctx.restore()
}
