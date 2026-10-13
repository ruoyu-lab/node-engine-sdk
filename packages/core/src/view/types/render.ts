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
  NodeEngineBounds,
  NodeEngineCoordinateSpace,
  NodeEngineNodeStatus,
  NodeEnginePortAnchor,
  NodeEngineRenderContext,
  NodeEngineStyleDeclaration,
  PortSide,
} from './common.js'
import type {
  NodeEngineDomFieldKind,
  NodeEngineDomImageFieldFit,
  NodeEngineDomNodeDefinition,
  NodeEngineDomNodeFieldSource,
} from './dom.js'

import type { EdgeTypeDefinition, NodeTypeDefinition } from './extensions.js'

export interface NodeEngineCanvasNodeTheme {
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

export interface NodeEngineCanvasNodeLayoutContext {
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  ports: GraphPort[]
  selected: boolean
  dragging: boolean
  readonly: boolean
  context: NodeEngineRenderContext
}

export interface NodeEngineCanvasPortLayout {
  portId: string
  x: number
  y: number
  side?: PortSide
  radius?: number
}

export interface NodeEngineCanvasNodeRenderContext {
  ctx: CanvasRenderingContext2D
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  bounds: NodeEngineBounds
  selected: boolean
  dragging: boolean
  readonly: boolean
  zoom: number
  inputs: NodeEnginePortAnchor[]
  outputs: NodeEnginePortAnchor[]
  connectionSource?: GraphEndpoint
  connectionTarget?: GraphEndpoint
  theme: NodeEngineCanvasNodeTheme
  context: NodeEngineRenderContext
}

export interface NodeEngineCanvasNodeHitTestContext extends NodeEngineCanvasNodeRenderContext {
  point: XYPosition
}

export interface NodeEngineCanvasNodeRenderer {
  measure?: (
    context: NodeEngineCanvasNodeLayoutContext,
  ) => { width?: number; height?: number } | void
  getPortLayout?: (
    context: NodeEngineCanvasNodeLayoutContext,
  ) => NodeEngineCanvasPortLayout[] | void
  draw?: (context: NodeEngineCanvasNodeRenderContext) => void
  hitTestNode?: (context: NodeEngineCanvasNodeHitTestContext) => boolean
}

export type NodeEngineDomNodeRendererMode = 'replace' | 'overlay'
export type NodeEngineDomNodePointerEvents = 'none' | 'auto'
export type NodeEngineDomNodeClassValue = string | string[] | Record<string, boolean>

export interface NodeEngineDomNodeRenderContext {
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  bounds: NodeEngineBounds
  screenBounds: NodeEngineBounds
  selected: boolean
  dragging: boolean
  /** The node's entry of the `nodeStatus` editor option. */
  status?: NodeEngineNodeStatus
  readonly: boolean
  zoom: number
  inputs: NodeEnginePortAnchor[]
  outputs: NodeEnginePortAnchor[]
  connectionSource?: GraphEndpoint
  connectionTarget?: GraphEndpoint
  theme: NodeEngineCanvasNodeTheme
  context: NodeEngineRenderContext
}

export interface NodeEngineDomNodeSizeConstraints {
  minWidth: number
  minHeight: number
}

export interface NodeEngineResolvedDomNodeLayout extends NodeEngineDomNodeSizeConstraints {
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

export interface NodeEngineResolvedDomNodePort {
  key: string
  id: string
  side: PortSide
  label: string
  color: string
  top: number
  active?: boolean
  connectable?: boolean | null
  connectionValidation?: ConnectionValidationResult | null
  anchor: NodeEnginePortAnchor
  port: GraphPort
}

export interface NodeEngineResolvedDomFieldDriveSource {
  edgeId: string
  source: GraphEndpoint
  target: GraphEndpoint
  sourcePort?: GraphPort
}

export interface NodeEngineResolvedDomNodeField {
  key: string
  label: string
  description?: string
  kind: NodeEngineDomFieldKind
  inputPortId?: string
  inputPort?: NodeEngineResolvedDomNodePort
  top: number
  height: number
  value: unknown
  textValue: string
  resolvedValue: unknown
  resolvedTextValue: string
  driven: boolean
  driveSource?: NodeEngineResolvedDomFieldDriveSource
  placeholder?: string
  highlighted: boolean
  /** The parameter's own options. */
  options?: NodeParameterOption[]
  min?: number
  max?: number
  step?: number
  aspectRatio?: number
  fit?: NodeEngineDomImageFieldFit
  downloadable?: boolean
  openable?: boolean
  emptyHint?: string
}

export interface NodeEngineResolvedDomNodeModel {
  title: string
  subtitle?: string
  /** Accent colour of the node (`meta.accent`, then the node type's `accent`). */
  accent?: string
  fieldSource: NodeEngineDomNodeFieldSource
  layout: NodeEngineResolvedDomNodeLayout
  minWidth: number
  minHeight: number
  fieldsTop: number
  maxVisibleFields: number
  inputs: NodeEngineResolvedDomNodePort[]
  outputs: NodeEngineResolvedDomNodePort[]
  fields: NodeEngineResolvedDomNodeField[]
}

export type NodeEngineDomNodeResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

export interface NodeEngineDomNodeApi {
  getNode: () => GraphNode | undefined
  getSchema: () => NodeDefinition | undefined
  getDefinition: () => NodeTypeDefinition | undefined
  getBounds: (space?: NodeEngineCoordinateSpace) => NodeEngineBounds | null
  getContext: () => NodeEngineDomNodeRenderContext | null
  getModel: () => NodeEngineResolvedDomNodeModel | null
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
    get: (portId: string, space?: NodeEngineCoordinateSpace) => NodeEnginePortAnchor | null
    startConnection: (portId: string, event: PointerEvent) => boolean
    finishConnection: (portId: string, event: PointerEvent) => boolean
    previewConnection: (portId: string | null) => boolean
  }
  resize: {
    get: () => { width: number; height: number } | null
    getConstraints: () => NodeEngineDomNodeSizeConstraints | null
    start: (event: PointerEvent, handle?: NodeEngineDomNodeResizeHandle) => boolean
  }
}

export type NodeEngineDomNodeServicesValue = Record<string, unknown>
export type NodeEngineDomNodeActionsValue = Record<string, unknown>

/** Everything a DOM node component receives, independent of the UI framework rendering it. */
export interface NodeEngineDomNodeProps extends NodeEngineDomNodeRenderContext {
  domModel: NodeEngineResolvedDomNodeModel
  domApi: NodeEngineDomNodeApi
  domServices: NodeEngineDomNodeServicesValue
  domActions: NodeEngineDomNodeActionsValue
}

export interface NodeEngineDomNodeRenderer {
  /**
   * Key of the DOM node component registered with the UI adapter. Defaults to the adapter's
   * built-in default node component (`NODE_ENGINE_DEFAULT_DOM_COMPONENT`).
   */
  component?: string
  mode?: NodeEngineDomNodeRendererMode
  defaults?:
    | Partial<NodeEngineDomNodeDefinition>
    | ((
        context: NodeEngineDomNodeRenderContext,
      ) => Partial<NodeEngineDomNodeDefinition> | undefined | void)
  visible?: (context: NodeEngineDomNodeRenderContext) => boolean
  pointerEvents?:
    | NodeEngineDomNodePointerEvents
    | ((context: NodeEngineDomNodeRenderContext) => NodeEngineDomNodePointerEvents | undefined)
  className?:
    | NodeEngineDomNodeClassValue
    | ((context: NodeEngineDomNodeRenderContext) => NodeEngineDomNodeClassValue | undefined)
  style?:
    | NodeEngineStyleDeclaration
    | ((context: NodeEngineDomNodeRenderContext) => NodeEngineStyleDeclaration | undefined | void)
  services?:
    | NodeEngineDomNodeServicesValue
    | ((
        context: NodeEngineDomNodeRenderContext,
      ) => NodeEngineDomNodeServicesValue | undefined | void)
  actions?:
    | NodeEngineDomNodeActionsValue
    | ((
        context: NodeEngineDomNodeRenderContext,
      ) => NodeEngineDomNodeActionsValue | undefined | void)
  props?: (context: NodeEngineDomNodeRenderContext) => Record<string, unknown> | undefined | void
}

export type NodeEngineDomNodeRendererDefinition = false | NodeEngineDomNodeRenderer

export interface NodeEngineCanvasEdgeTheme {
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

export interface NodeEngineCanvasEdgeRenderContext {
  ctx: CanvasRenderingContext2D
  edge: GraphEdge
  schema?: EdgeDefinition
  definition?: EdgeTypeDefinition
  selected: boolean
  readonly: boolean
  source?: NodeEnginePortAnchor
  target?: NodeEnginePortAnchor
  stroke: string
  strokeWidth: number
  zoom: number
  theme: NodeEngineCanvasEdgeTheme
  context: NodeEngineRenderContext
}

export interface NodeEngineCanvasEdgeHitTestContext extends NodeEngineCanvasEdgeRenderContext {
  point: XYPosition
}

export interface NodeEngineCanvasEdgeRenderer {
  draw?: (context: NodeEngineCanvasEdgeRenderContext) => void
  hitTest?: (context: NodeEngineCanvasEdgeHitTestContext) => boolean
}

export interface NodeEngineCanvasGroupTheme {
  background: string
  border: string
  label: string
}

export interface NodeEngineCanvasGroupRenderContext {
  ctx: CanvasRenderingContext2D
  group: GraphGroup
  bounds: NodeEngineBounds
  headerHeight: number
  collapsed: boolean
  readonly: boolean
  zoom: number
  borderColor: string
  backgroundColor: string
  labelColor: string
  theme: NodeEngineCanvasGroupTheme
  context: NodeEngineRenderContext
}

export interface NodeEngineCanvasGroupHitTestContext extends NodeEngineCanvasGroupRenderContext {
  point: XYPosition
}

export type NodeEngineCanvasGroupHitAreaKind = 'body' | 'drag-handle' | 'action' | 'resize-handle'

export interface NodeEngineCanvasGroupHitArea {
  id: string
  kind?: NodeEngineCanvasGroupHitAreaKind
}

export interface NodeEngineCanvasGroupRenderer {
  draw?: (context: NodeEngineCanvasGroupRenderContext) => void
  hitTest?: (context: NodeEngineCanvasGroupHitTestContext) => boolean
  hitAreaAt?: (
    context: NodeEngineCanvasGroupHitTestContext,
  ) => NodeEngineCanvasGroupHitArea | null | void
}

export interface NodeEngineCanvasRenderers {
  node?: NodeEngineCanvasNodeRenderer
  edge?: NodeEngineCanvasEdgeRenderer
  group?: NodeEngineCanvasGroupRenderer
}
