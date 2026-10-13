import type {
  EdgeDefinition,
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphPort,
  XYPosition,
} from '../../protocol/index.js'
import type {
  EdgeTypeDefinition,
  NodeEngineCanvasEdgeHitTestContext,
  NodeEngineCanvasEdgeRenderer,
  NodeEngineCanvasEdgeTheme,
  NodeEngineCanvasGroupHitTestContext,
  NodeEngineCanvasGroupRenderer,
  NodeEngineCanvasGroupTheme,
  NodeEngineCanvasNodeLayoutContext,
  NodeEngineCanvasNodeRenderer,
  NodeEngineEdgeRendererContribution,
  NodeEngineGroupRendererContribution,
  NodeEngineRenderContext,
  NodeTypeDefinition,
} from '../types/index.js'
import type { GraphCanvasDraftEdge, GraphCanvasEdgeEntry } from './edge-canvas.js'
import type { GraphRect } from './geometry.js'
import type { GraphCanvasGroupEntry } from './group-canvas.js'
import type { PortLayout, ResolvedNodeView } from './node-layout.js'

/** Turns resolved graph entities into the entries the canvas painters and hit tests consume. */

export interface VisibleEdgeEntry {
  edge: GraphEdge
  source: PortLayout
  target: PortLayout
  schema?: EdgeDefinition
  definition?: EdgeTypeDefinition
  renderer?: NodeEngineCanvasEdgeRenderer
  selected: boolean
  stroke: string
  strokeWidth: number
}

export interface VisibleGroupEntry {
  group: GraphGroup
  renderer?: NodeEngineCanvasGroupRenderer
  bounds: GraphRect
  headerHeight: number
  collapsed: boolean
  showCloseButton: boolean
  showCollapseButton: boolean
  resizable: boolean
  borderColor: string
  backgroundColor: string
  labelColor: string
}

export interface CanvasEntryOptions<Theme> {
  readonly: boolean
  zoom: number
  theme: Theme
  context: NodeEngineRenderContext
  getCanvasContext: () => CanvasRenderingContext2D
}

/** Fills the canvas hooks a node type leaves undefined with the editor-wide node renderer. */
export function mergeNodeRenderer(
  definition: NodeTypeDefinition | undefined,
  renderer: NodeEngineCanvasNodeRenderer | undefined,
): NodeTypeDefinition | undefined {
  if (!renderer) {
    return definition
  }

  return {
    ...definition,
    canvas: {
      measure: definition?.canvas?.measure ?? renderer.measure,
      getPortLayout: definition?.canvas?.getPortLayout ?? renderer.getPortLayout,
      draw: definition?.canvas?.draw ?? renderer.draw,
      hitTestNode: definition?.canvas?.hitTestNode ?? renderer.hitTestNode,
    },
  }
}

/** Later contributions win; a contribution applies when `match` accepts or its `type` fits. */
export function resolveEdgeRenderer(
  edge: GraphEdge,
  schema: EdgeDefinition | undefined,
  definition: EdgeTypeDefinition | undefined,
  renderers: NodeEngineEdgeRendererContribution[],
  defaultRenderer: NodeEngineCanvasEdgeRenderer | undefined,
): NodeEngineCanvasEdgeRenderer | undefined {
  for (let index = renderers.length - 1; index >= 0; index -= 1) {
    const renderer = renderers[index]!

    if (renderer.match?.(edge, schema)) {
      return renderer.renderer
    }

    if (renderer.type === undefined || renderer.type === edge.type) {
      return renderer.renderer
    }
  }

  return definition?.canvas ?? defaultRenderer
}

export function resolveGroupRenderer(
  group: GraphGroup,
  renderers: NodeEngineGroupRendererContribution[],
  defaultRenderer: NodeEngineCanvasGroupRenderer | undefined,
): NodeEngineCanvasGroupRenderer | undefined {
  for (let index = renderers.length - 1; index >= 0; index -= 1) {
    const renderer = renderers[index]!

    if (!renderer.match || renderer.match(group)) {
      return renderer.renderer
    }
  }

  return defaultRenderer
}

export interface DraftConnection {
  source: GraphEndpoint
  originDirection: GraphPort['direction']
  current: XYPosition
}

/** The dashed edge between the dragged port and the pointer (or snapped target). */
export function getDraftEdgeEntry(options: {
  connection: DraftConnection | null
  source: PortLayout | undefined
  color: string
}): GraphCanvasDraftEdge | null {
  if (!options.connection || !options.source) {
    return null
  }

  const targetDirection = options.connection.originDirection === 'output' ? 'input' : 'output'
  const loosePoint = {
    ...options.connection.current,
    side: targetDirection === 'output' ? ('right' as const) : ('left' as const),
  }

  if (options.connection.originDirection === 'input') {
    return {
      start: loosePoint,
      end: options.source,
      targetDirection,
      looseEndpoint: 'start',
      color: options.color,
    }
  }

  return {
    start: options.source,
    end: loosePoint,
    targetDirection,
    looseEndpoint: 'end',
    color: options.color,
  }
}

export function applyCanvasMeasureToNode(
  node: ResolvedNodeView,
  layoutContext: NodeEngineCanvasNodeLayoutContext,
): ResolvedNodeView {
  const measured = node.definition?.canvas?.measure?.(layoutContext)

  if (!measured) {
    return node
  }

  return {
    ...node,
    width: measured.width ?? node.width,
    height: measured.height ?? node.height,
  }
}

export function createCanvasEdgeEntry(
  entry: VisibleEdgeEntry,
  options: CanvasEntryOptions<NodeEngineCanvasEdgeTheme>,
): GraphCanvasEdgeEntry {
  const renderer = entry.renderer
  const createContext = (ctx: CanvasRenderingContext2D, zoom: number) => ({
    ctx,
    edge: entry.edge,
    schema: entry.schema,
    definition: entry.definition,
    selected: entry.selected,
    readonly: options.readonly,
    source: entry.source,
    target: entry.target,
    stroke: entry.stroke,
    strokeWidth: entry.strokeWidth,
    zoom,
    theme: options.theme,
    context: options.context,
  })

  return {
    id: entry.edge.id,
    start: entry.source,
    end: entry.target,
    stroke: entry.stroke,
    strokeWidth: entry.strokeWidth,
    selected: entry.selected,
    draw: renderer?.draw ? (ctx) => renderer.draw?.(createContext(ctx, options.zoom)) : undefined,
    hitTest: renderer?.hitTest
      ? (point, zoom) =>
          Boolean(
            renderer.hitTest?.({
              ...createContext(options.getCanvasContext(), zoom),
              point,
            } satisfies NodeEngineCanvasEdgeHitTestContext),
          )
      : undefined,
  }
}

export function createCanvasGroupEntry(
  entry: VisibleGroupEntry,
  options: CanvasEntryOptions<NodeEngineCanvasGroupTheme>,
): GraphCanvasGroupEntry {
  const renderer = entry.renderer
  const createContext = (ctx: CanvasRenderingContext2D) => ({
    ctx,
    group: entry.group,
    bounds: entry.bounds,
    headerHeight: entry.headerHeight,
    collapsed: entry.collapsed,
    readonly: options.readonly,
    zoom: options.zoom,
    borderColor: entry.borderColor,
    backgroundColor: entry.backgroundColor,
    labelColor: entry.labelColor,
    theme: options.theme,
    context: options.context,
  })

  return {
    id: entry.group.id,
    group: entry.group,
    bounds: entry.bounds,
    headerHeight: entry.headerHeight,
    collapsed: entry.collapsed,
    showCloseButton: entry.showCloseButton,
    showCollapseButton: entry.showCollapseButton,
    resizable: entry.resizable,
    borderColor: entry.borderColor,
    backgroundColor: entry.backgroundColor,
    labelColor: entry.labelColor,
    draw: renderer?.draw ? (ctx) => renderer.draw?.(createContext(ctx)) : undefined,
    hitTest: renderer?.hitTest
      ? (point) =>
          Boolean(
            renderer.hitTest?.({
              ...createContext(options.getCanvasContext()),
              point,
            } satisfies NodeEngineCanvasGroupHitTestContext),
          )
      : undefined,
  }
}
