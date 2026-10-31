import type {
  ConnectionValidationResult,
  ConnectionValidator,
  EdgeDefinition,
  GraphDiagnostic,
  GraphDiagnosticProvider,
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphRepairResult,
  GraphSnapshot,
  GraphValidationResult,
  NodeDefinition,
} from './types.js'

/*
 * Contracts of graph editing: commands, history entries, store events, and the plugin surface.
 * Other modules program against these without depending on the store implementation.
 */

export interface GraphCommandMetadata {
  category?: string
  shortcut?: string | string[]
  icon?: string
  when?: string
}

export interface GraphCommand extends GraphCommandMetadata {
  id: string
  label?: string
  execute: (draft: GraphSnapshot, api: GraphCommandApi) => void
}

export interface GraphCommandDefinition<TPayload = unknown> extends GraphCommandMetadata {
  id: string
  label?: string | ((payload: TPayload) => string)
  validate?: (
    payload: TPayload,
    store: GraphStoreLike,
  ) => boolean | ConnectionValidationResult | GraphValidationResult | void
  execute: (
    payload: TPayload,
    draft: GraphSnapshot,
    api: GraphCommandApi,
    store: GraphStoreLike,
  ) => void
}

/** A command stored without exposing its payload type. Dispatch validates the unknown payload at runtime. */
export type GraphCommandRegistryEntry = GraphCommandDefinition<never>

export interface GraphCommandDispatchResult {
  applied: boolean
  snapshot: GraphSnapshot
  validation?: ConnectionValidationResult
  diagnostics?: GraphDiagnostic[]
  reason?: string
}

export interface GraphHistoryEntry {
  id: string
  label?: string
  before: GraphSnapshot
  after: GraphSnapshot
  timestamp: number
  diagnostics?: GraphDiagnostic[]
}

export interface GraphChangeOptions {
  source?: string
}

export interface GraphStoreEventBase {
  snapshot: GraphSnapshot
  source?: string
}

export interface GraphChangedEvent extends GraphStoreEventBase {
  type: 'graph:changed'
}

export interface GraphCommandEvent extends GraphStoreEventBase {
  type: 'command:executed'
  command: Pick<GraphCommand, 'id' | 'label' | 'category' | 'shortcut' | 'icon' | 'when'>
  diagnostics?: GraphDiagnostic[]
}

export interface GraphHistoryEvent extends GraphStoreEventBase {
  type: 'history:undo' | 'history:redo' | 'history:commit'
  entry: GraphHistoryEntry
}

export interface GraphPluginEvent extends GraphStoreEventBase {
  type: 'plugin:registered'
  pluginName: string
}

export interface GraphRegistryEvent extends GraphStoreEventBase {
  type:
    | 'registry:command-registered'
    | 'registry:command-unregistered'
    | 'registry:node-definition-registered'
    | 'registry:node-definition-unregistered'
    | 'registry:edge-definition-registered'
    | 'registry:edge-definition-unregistered'
    | 'registry:diagnostic-provider-registered'
    | 'registry:diagnostic-provider-unregistered'
  key: string
}

export type GraphStoreEvent =
  GraphChangedEvent | GraphCommandEvent | GraphHistoryEvent | GraphPluginEvent | GraphRegistryEvent

export type GraphStoreListener = (event: GraphStoreEvent) => void

export interface GraphCommandApi {
  createId: (prefix?: string) => string
  getNode: (nodeId: string) => GraphNode | undefined
  getEdge: (edgeId: string) => GraphEdge | undefined
  getGroup: (groupId: string) => GraphGroup | undefined
  getPort: (endpoint: GraphEndpoint) => GraphPort | undefined
  getNodeDefinition: (type: string) => NodeDefinition | undefined
  getEdgeDefinition: (type: string) => EdgeDefinition | undefined
  ensureNode: (nodeId: string) => GraphNode
  ensureEdge: (edgeId: string) => GraphEdge
  ensureGroup: (groupId: string) => GraphGroup
}

export interface GraphStoreLike {
  getSnapshot: () => GraphSnapshot
  subscribe: (listener: GraphStoreListener) => () => void
  createId: (prefix?: string) => string
  getNode: (nodeId: string) => GraphNode | undefined
  getEdge: (edgeId: string) => GraphEdge | undefined
  getGroup: (groupId: string) => GraphGroup | undefined
  listGroups: () => GraphGroup[]
  getPort: (endpoint: GraphEndpoint) => GraphPort | undefined
  validateGraph: () => GraphValidationResult
  repairGraph: () => GraphRepairResult
  addConnectionValidator: (validator: ConnectionValidator) => () => void
  registerCommand: (command: GraphCommandRegistryEntry) => () => void
  dispatchCommand: (
    commandId: string,
    payload?: unknown,
    options?: GraphChangeOptions,
  ) => GraphCommandDispatchResult
  getCommand: (commandId: string) => GraphCommandRegistryEntry | undefined
  listCommands: () => GraphCommandRegistryEntry[]
  registerNodeDefinition: (definition: NodeDefinition) => () => void
  getNodeDefinition: (type: string) => NodeDefinition | undefined
  listNodeDefinitions: () => NodeDefinition[]
  registerEdgeDefinition: (definition: EdgeDefinition) => () => void
  getEdgeDefinition: (type: string) => EdgeDefinition | undefined
  listEdgeDefinitions: () => EdgeDefinition[]
  registerDiagnosticProvider: (provider: GraphDiagnosticProvider) => () => void
  listDiagnostics: () => GraphDiagnostic[]
}

export interface GraphPluginContext {
  store: GraphStoreLike
  addConnectionValidator: (validator: ConnectionValidator) => () => void
  createId: (prefix?: string) => string
  registerCommand: (command: GraphCommandRegistryEntry) => () => void
  registerNodeDefinition: (definition: NodeDefinition) => () => void
  registerEdgeDefinition: (definition: EdgeDefinition) => () => void
  registerDiagnosticProvider: (provider: GraphDiagnosticProvider) => () => void
}

export interface NodeWrightExtensionContributions {
  diagnostics?: GraphDiagnosticProvider[]
  nodeDefinitions?: NodeDefinition[]
  edgeDefinitions?: EdgeDefinition[]
  commands?: GraphCommandRegistryEntry[]
}

export interface NodeWrightExtensionManifest {
  name: string
  contributes?: NodeWrightExtensionContributions
}

export interface GraphPlugin extends NodeWrightExtensionManifest {
  setup?: (context: GraphPluginContext) => void | (() => void)
}

export interface GraphStoreOptions {
  validators?: ConnectionValidator[]
  plugins?: GraphPlugin[]
  commands?: GraphCommandRegistryEntry[]
  nodeDefinitions?: NodeDefinition[]
  edgeDefinitions?: EdgeDefinition[]
  diagnosticProviders?: GraphDiagnosticProvider[]
  idFactory?: (prefix?: string) => string
  historyLimit?: number
}
