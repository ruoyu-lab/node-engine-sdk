import type {
  ConnectionValidationResult,
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphMetadata,
  GraphNode,
  GraphNodePatch,
  GraphPort,
  GraphSnapshot,
  GraphValue,
  EdgeDefinition,
  NodeDefinition,
  NodeParameterOption,
  XYPosition,
} from '../../protocol/index.js'
import type {
  NodeWrightBounds,
  NodeWrightCoordinateSpace,
  NodeWrightNodeStatus,
  NodeWrightPortAnchor,
  NodeWrightRenderContext,
  NodeWrightStyleDeclaration,
  PortSide,
} from './common.js'
import type {
  NodeWrightDomFieldKind,
  NodeWrightDomImageFieldFit,
  NodeWrightDomNodeDefinition,
  NodeWrightDomNodeFieldSource,
} from './dom.js'

import type { EdgeTypeDefinition, NodeTypeDefinition } from './extensions.js'

export interface NodeWrightCanvasNodeTheme {
  background: string
  border: string
  borderSelected: string
  shadow: string
  title: string
  subtitle: string
  meta: string
  portFill: string
  portStroke: string
  portLabel: string
  portActive: string
  portActiveFill: string
  portConnected: string
  portConnectedDot: string
  /** Colour of exec ports. */
  exec: string
}

export interface NodeWrightCanvasNodeLayoutContext {
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  ports: GraphPort[]
  selected: boolean
  dragging: boolean
  readonly: boolean
  context: NodeWrightRenderContext
}

export interface NodeWrightCanvasPortLayout {
  portId: string
  x: number
  y: number
  side?: PortSide
  radius?: number
}

export interface NodeWrightCanvasNodeRenderContext {
  ctx: CanvasRenderingContext2D
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  bounds: NodeWrightBounds
  selected: boolean
  dragging: boolean
  readonly: boolean
  zoom: number
  inputs: NodeWrightPortAnchor[]
  outputs: NodeWrightPortAnchor[]
  connectionSource?: GraphEndpoint
  connectionTarget?: GraphEndpoint
  theme: NodeWrightCanvasNodeTheme
  context: NodeWrightRenderContext
}

export interface NodeWrightCanvasNodeHitTestContext extends NodeWrightCanvasNodeRenderContext {
  point: XYPosition
}

export interface NodeWrightCanvasNodeRenderer {
  measure?: (
    context: NodeWrightCanvasNodeLayoutContext,
  ) => { width?: number; height?: number } | void
  getPortLayout?: (
    context: NodeWrightCanvasNodeLayoutContext,
  ) => NodeWrightCanvasPortLayout[] | void
  draw?: (context: NodeWrightCanvasNodeRenderContext) => void
  hitTestNode?: (context: NodeWrightCanvasNodeHitTestContext) => boolean
}

export type NodeWrightDomNodeRendererMode = 'replace' | 'overlay'
export type NodeWrightDomNodePointerEvents = 'none' | 'auto'
export type NodeWrightDomNodeClassValue = string | string[] | Record<string, boolean>

export interface NodeWrightDomNodeRenderContext {
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  bounds: NodeWrightBounds
  screenBounds: NodeWrightBounds
  selected: boolean
  dragging: boolean
  /** The node's entry of the `nodeStatus` editor option. */
  status?: NodeWrightNodeStatus
  readonly: boolean
  zoom: number
  inputs: NodeWrightPortAnchor[]
  outputs: NodeWrightPortAnchor[]
  connectionSource?: GraphEndpoint
  connectionTarget?: GraphEndpoint
  theme: NodeWrightCanvasNodeTheme
  context: NodeWrightRenderContext
}

export interface NodeWrightDomNodeSizeConstraints {
  minWidth: number
  minHeight: number
}

export interface NodeWrightResolvedDomNodeLayout extends NodeWrightDomNodeSizeConstraints {
  headerHeight: number
  portTop: number
  portGap: number
  portInset: number
  portBottomPadding: number
  fieldPortGap: number
  minFieldsTop: number
  bottomPadding: number
  fieldRowHeight: number
  fieldRowGap: number
}

export interface NodeWrightResolvedDomNodePort {
  key: string
  id: string
  side: PortSide
  label: string
  color: string
  top: number
  active?: boolean
  connectable?: boolean | null
  connectionValidation?: ConnectionValidationResult | null
  anchor: NodeWrightPortAnchor
  port: GraphPort
}

export interface NodeWrightResolvedDomFieldDriveSource {
  edgeId: string
  source: GraphEndpoint
  target: GraphEndpoint
  sourcePort?: GraphPort
}

export interface NodeWrightResolvedDomNodeField {
  key: string
  label: string
  description?: string
  kind: NodeWrightDomFieldKind
  inputPortId?: string
  inputPort?: NodeWrightResolvedDomNodePort
  top: number
  height: number
  value: unknown
  textValue: string
  resolvedValue: unknown
  resolvedTextValue: string
  driven: boolean
  driveSource?: NodeWrightResolvedDomFieldDriveSource
  placeholder?: string
  highlighted: boolean
  /** The parameter's own options. */
  options?: NodeParameterOption[]
  min?: number
  max?: number
  step?: number
  aspectRatio?: number
  fit?: NodeWrightDomImageFieldFit
  downloadable?: boolean
  openable?: boolean
  emptyHint?: string
}

export interface NodeWrightResolvedDomNodeModel {
  title: string
  subtitle?: string
  /** Accent colour of the node (`meta.accent`, then the node type's `accent`). */
  accent?: string
  fieldSource: NodeWrightDomNodeFieldSource
  layout: NodeWrightResolvedDomNodeLayout
  minWidth: number
  minHeight: number
  fieldsTop: number
  maxVisibleFields: number
  inputs: NodeWrightResolvedDomNodePort[]
  outputs: NodeWrightResolvedDomNodePort[]
  fields: NodeWrightResolvedDomNodeField[]
}

export type NodeWrightDomNodeResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

export interface NodeWrightDomNodeApi {
  getNode: () => GraphNode | undefined
  getSchema: () => NodeDefinition | undefined
  getDefinition: () => NodeTypeDefinition | undefined
  getBounds: (space?: NodeWrightCoordinateSpace) => NodeWrightBounds | null
  getContext: () => NodeWrightDomNodeRenderContext | null
  getModel: () => NodeWrightResolvedDomNodeModel | null
  focus: () => void
  interaction: {
    pointerDown: (event: PointerEvent) => boolean
  }
  select: (options?: { add?: boolean }) => GraphSnapshot
  center: () => void
  fit: (padding?: number) => void
  update: (patch: GraphNodePatch) => GraphSnapshot
  remove: () => GraphSnapshot
  editor: {
    open: () => void
    close: () => void
  }
  params: {
    update: (
      key: string,
      value: GraphValue,
      options?: {
        source?: string
      },
    ) => GraphSnapshot
    set: (
      params: GraphMetadata,
      options?: {
        replace?: boolean
        source?: string
      },
    ) => GraphSnapshot
  }
  ports: {
    get: (portId: string, space?: NodeWrightCoordinateSpace) => NodeWrightPortAnchor | null
    startConnection: (portId: string, event: PointerEvent) => boolean
    finishConnection: (portId: string, event: PointerEvent) => boolean
    previewConnection: (portId: string | null) => boolean
  }
  resize: {
    get: () => { width: number; height: number } | null
    getConstraints: () => NodeWrightDomNodeSizeConstraints | null
    start: (event: PointerEvent, handle?: NodeWrightDomNodeResizeHandle) => boolean
  }
}

export type NodeWrightDomNodeServicesValue = Record<string, unknown>
export type NodeWrightDomNodeActionsValue = Record<string, unknown>

/** Everything a DOM node component receives, independent of the UI framework rendering it. */
export interface NodeWrightDomNodeProps extends NodeWrightDomNodeRenderContext {
  domModel: NodeWrightResolvedDomNodeModel
  domApi: NodeWrightDomNodeApi
  domServices: NodeWrightDomNodeServicesValue
  domActions: NodeWrightDomNodeActionsValue
}

export interface NodeWrightDomNodeRenderer {
  /**
   * Key of the DOM node component registered with the UI adapter. Defaults to the adapter's
   * built-in default node component (`NODE_WRIGHT_DEFAULT_DOM_COMPONENT`).
   */
  component?: string
  mode?: NodeWrightDomNodeRendererMode
  defaults?:
    | Partial<NodeWrightDomNodeDefinition>
    | ((
        context: NodeWrightDomNodeRenderContext,
      ) => Partial<NodeWrightDomNodeDefinition> | undefined | void)
  visible?: (context: NodeWrightDomNodeRenderContext) => boolean
  pointerEvents?:
    | NodeWrightDomNodePointerEvents
    | ((context: NodeWrightDomNodeRenderContext) => NodeWrightDomNodePointerEvents | undefined)
  className?:
    | NodeWrightDomNodeClassValue
    | ((context: NodeWrightDomNodeRenderContext) => NodeWrightDomNodeClassValue | undefined)
  style?:
    | NodeWrightStyleDeclaration
    | ((context: NodeWrightDomNodeRenderContext) => NodeWrightStyleDeclaration | undefined | void)
  services?:
    | NodeWrightDomNodeServicesValue
    | ((
        context: NodeWrightDomNodeRenderContext,
      ) => NodeWrightDomNodeServicesValue | undefined | void)
  actions?:
    | NodeWrightDomNodeActionsValue
    | ((
        context: NodeWrightDomNodeRenderContext,
      ) => NodeWrightDomNodeActionsValue | undefined | void)
  props?: (context: NodeWrightDomNodeRenderContext) => Record<string, unknown> | undefined | void
}

export type NodeWrightDomNodeRendererDefinition = false | NodeWrightDomNodeRenderer

export interface NodeWrightCanvasEdgeTheme {
  /** Data edges whose source port has no semantic colour. */
  stroke: string
  activeStroke: string
  /** Execution edges. */
  execStroke: string
  draftStroke: string
  draftGlow: string
  /** Halo of selected and hovered edges. */
  selection: string
}

export interface NodeWrightCanvasEdgeRenderContext {
  ctx: CanvasRenderingContext2D
  edge: GraphEdge
  schema?: EdgeDefinition
  definition?: EdgeTypeDefinition
  selected: boolean
  readonly: boolean
  source?: NodeWrightPortAnchor
  target?: NodeWrightPortAnchor
  stroke: string
  strokeWidth: number
  zoom: number
  theme: NodeWrightCanvasEdgeTheme
  context: NodeWrightRenderContext
}

export interface NodeWrightCanvasEdgeHitTestContext extends NodeWrightCanvasEdgeRenderContext {
  point: XYPosition
}

export interface NodeWrightCanvasEdgeRenderer {
  draw?: (context: NodeWrightCanvasEdgeRenderContext) => void
  hitTest?: (context: NodeWrightCanvasEdgeHitTestContext) => boolean
}

export interface NodeWrightCanvasGroupTheme {
  background: string
  border: string
  label: string
}

export interface NodeWrightCanvasGroupRenderContext {
  ctx: CanvasRenderingContext2D
  group: GraphGroup
  bounds: NodeWrightBounds
  headerHeight: number
  collapsed: boolean
  readonly: boolean
  zoom: number
  borderColor: string
  backgroundColor: string
  labelColor: string
  theme: NodeWrightCanvasGroupTheme
  context: NodeWrightRenderContext
}

export interface NodeWrightCanvasGroupHitTestContext extends NodeWrightCanvasGroupRenderContext {
  point: XYPosition
}

export type NodeWrightCanvasGroupHitAreaKind = 'body' | 'drag-handle' | 'action' | 'resize-handle'

export interface NodeWrightCanvasGroupHitArea {
  id: string
  kind?: NodeWrightCanvasGroupHitAreaKind
}

export interface NodeWrightCanvasGroupRenderer {
  draw?: (context: NodeWrightCanvasGroupRenderContext) => void
  hitTest?: (context: NodeWrightCanvasGroupHitTestContext) => boolean
  hitAreaAt?: (
    context: NodeWrightCanvasGroupHitTestContext,
  ) => NodeWrightCanvasGroupHitArea | null | void
}

export interface NodeWrightCanvasRenderers {
  node?: NodeWrightCanvasNodeRenderer
  edge?: NodeWrightCanvasEdgeRenderer
  group?: NodeWrightCanvasGroupRenderer
}
