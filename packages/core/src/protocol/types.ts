/*
 * The graph document model: snapshots, ports, node and edge definitions, diagnostics, and
 * execution plans.
 */

export const NODE_WRIGHT_GRAPH_SCHEMA_VERSION = '1.0.0'

export type GraphPrimitive = string | number | boolean | null
export type GraphValue = GraphPrimitive | GraphValue[] | { [key: string]: GraphValue }
export type GraphMetadata = Record<string, GraphValue>

export interface XYPosition {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type PortDirection = 'input' | 'output'

/** Kind of a port that does not declare one. */
export const DEFAULT_PORT_KIND = 'data'

export interface GraphPort {
  id: string
  name?: string
  label?: string
  direction: PortDirection
  /** Port kind such as `'data'` or `'exec'`; defaults to `DEFAULT_PORT_KIND`. */
  kind?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  capacity?: number | 'many'
  required?: boolean
  dataType?: string
  accepts?: string[]
  data?: GraphMetadata
  meta?: GraphMetadata
}

export interface GraphNode {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  locked?: boolean
  ports?: GraphPort[]
  data?: GraphMetadata
  meta?: GraphMetadata
}

export type GraphNodePatch = Partial<
  Pick<GraphNode, 'x' | 'y' | 'width' | 'height' | 'locked' | 'ports' | 'data' | 'meta'>
>

export interface GraphEndpoint {
  nodeId: string
  portId: string
}

export interface GraphEdge {
  id: string
  source: GraphEndpoint
  target: GraphEndpoint
  /**
   * Kind of the connection: always the kind of its source port. The store derives it when it
   * creates or reconnects an edge, and graph validation rejects an edge whose kind differs.
   */
  kind: string
  type?: string
  label?: string
  data?: GraphMetadata
  meta?: GraphMetadata
}

export type GraphEdgePatch = Partial<Pick<GraphEdge, 'type' | 'label' | 'data' | 'meta'>>

export interface GraphEdgeReconnect {
  source?: GraphEndpoint
  target?: GraphEndpoint
}

export interface GraphGroup {
  id: string
  label?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  nodeIds?: string[]
  data?: GraphMetadata
  meta?: GraphMetadata
}

export type GraphGroupPatch = Partial<
  Pick<GraphGroup, 'label' | 'x' | 'y' | 'width' | 'height' | 'color' | 'nodeIds' | 'data' | 'meta'>
>

export interface GraphSnapshot {
  schemaVersion: typeof NODE_WRIGHT_GRAPH_SCHEMA_VERSION
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups: GraphGroup[]
  meta: GraphMetadata
}

export type NodeParameterKind =
  'string' | 'number' | 'boolean' | 'select' | 'json' | 'code' | 'file'

export interface NodeParameterOption {
  label: string
  value: string | number | boolean | null
}

export interface NodeParameterInputDefinition {
  enabled?: boolean
  portId?: string
  label?: string
  kind?: string
  side?: GraphPort['side']
  capacity?: GraphPort['capacity']
  required?: boolean
  dataType?: string
  accepts?: string[]
  data?: GraphMetadata
  meta?: GraphMetadata
}

export type NodeParameterInputPolicy = boolean | NodeParameterInputDefinition

export interface NodeParameterDefinition {
  key: string
  kind: NodeParameterKind
  label?: string
  defaultValue?: GraphValue
  required?: boolean
  options?: NodeParameterOption[]
  input?: NodeParameterInputPolicy
  dataPath?: string
  ui?: GraphMetadata
}

export interface NodeDefinition {
  type: string
  label?: string
  description?: string
  category?: string
  width?: number
  height?: number
  ports?: GraphPort[]
  parameterInputs?: boolean
  parameters?: NodeParameterDefinition[]
  dataDefaults?: GraphMetadata | (() => GraphMetadata)
  metaDefaults?: GraphMetadata | (() => GraphMetadata)
  tags?: string[]
}

export interface EdgeDefinition {
  type: string
  label?: string
  description?: string
  dataDefaults?: GraphMetadata | (() => GraphMetadata)
  metaDefaults?: GraphMetadata | (() => GraphMetadata)
  tags?: string[]
}

export interface ConnectionContext {
  graph: GraphSnapshot
  source: GraphEndpoint
  target: GraphEndpoint
  /** Kind of the validated edge: the kind of its source port (see `GraphEdge.kind`). */
  kind: string
  sourceNode?: GraphNode
  targetNode?: GraphNode
  sourcePort?: GraphPort
  targetPort?: GraphPort
}

export interface ConnectionValidationResult {
  valid: boolean
  code?: string
  reason?: string
}

export type ConnectionValidator = (context: ConnectionContext) => ConnectionValidationResult | void

export type GraphDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface GraphDiagnostic {
  code: string
  severity: GraphDiagnosticSeverity
  message: string
  source: string
  nodeId?: string
  edgeId?: string
  groupId?: string
  portId?: string
  path?: string
}

export interface GraphValidationResult {
  valid: boolean
  diagnostics: GraphDiagnostic[]
}

export interface GraphDiagnosticContext {
  graph: GraphSnapshot
  nodeDefinitions?: NodeDefinition[]
  edgeDefinitions?: EdgeDefinition[]
}

export type GraphDiagnosticProvider = (
  context: GraphDiagnosticContext,
) => GraphDiagnostic[] | GraphValidationResult | void

export interface GraphRepairResult {
  graph: GraphSnapshot
  diagnostics: GraphDiagnostic[]
  validation: GraphValidationResult
}

export interface NodeWrightExecutionPlan {
  id: string
  schemaVersion: typeof NODE_WRIGHT_GRAPH_SCHEMA_VERSION
  graph: GraphSnapshot
  entryNodeId: string
  nodeOrder: string[]
  diagnostics: GraphDiagnostic[]
}

export interface NodeWrightCompileResult {
  valid: boolean
  diagnostics: GraphDiagnostic[]
  plan?: NodeWrightExecutionPlan
}

export interface ValidateGraphOptions {
  nodeDefinitions?: NodeDefinition[]
  edgeDefinitions?: EdgeDefinition[]
  providers?: GraphDiagnosticProvider[]
}

export type RepairGraphOptions = ValidateGraphOptions
