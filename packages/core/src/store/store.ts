import type {
  ConnectionValidationResult,
  ConnectionValidator,
  EdgeDefinition,
  GraphChangeOptions,
  GraphCommand,
  GraphCommandDispatchResult,
  GraphCommandRegistryEntry,
  GraphDiagnostic,
  GraphDiagnosticProvider,
  GraphEdge,
  GraphEdgePatch,
  GraphEdgeReconnect,
  GraphEndpoint,
  GraphGroup,
  GraphGroupPatch,
  GraphNode,
  GraphNodePatch,
  GraphPlugin,
  GraphPort,
  GraphRepairResult,
  GraphSnapshot,
  GraphStoreListener,
  GraphStoreOptions,
  GraphValidationResult,
  NodeDefinition,
} from '../protocol/index.js'
import { createBuiltInCommands } from './builtin-commands.js'
import { createCommandApi } from './command-api.js'
import { CommandDispatcher } from './command-dispatch.js'
import { ConnectionValidation } from './connections.js'
import { GraphDiagnostics } from './diagnostics.js'
import { GraphState, createSequentialIdFactory } from './graph-state.js'
import { GraphWriter } from './graph-writer.js'
import { GraphHistory } from './history.js'
import { PluginHost } from './plugins.js'
import { LayeredRegistry, type RegistryEventType } from './registry.js'
import { createPluginContext, createStoreApi } from './store-api.js'
import { StoreEvents } from './store-events.js'
import { GraphTransactions } from './transactions.js'

/**
 * The editable graph: one committed snapshot, changed only through validated commands,
 * transactions, and history. `GraphStore` wires its collaborators together and keeps every public
 * entry point; the behavior lives in the collaborators.
 */
export class GraphStore {
  private readonly state: GraphState
  private readonly events = new StoreEvents()
  private readonly history: GraphHistory
  private readonly diagnostics: GraphDiagnostics
  private readonly connections: ConnectionValidation
  private readonly transactions: GraphTransactions
  private readonly writer: GraphWriter
  private readonly dispatcher: CommandDispatcher
  private readonly plugins: PluginHost
  private readonly commands: LayeredRegistry<GraphCommandRegistryEntry>
  private readonly nodeDefinitions: LayeredRegistry<NodeDefinition>
  private readonly edgeDefinitions: LayeredRegistry<EdgeDefinition>
  private readonly idFactory: (prefix?: string) => string

  constructor(graph?: GraphSnapshot, options: GraphStoreOptions = {}) {
    const notify = (type: RegistryEventType, key: string) =>
      this.events.emit({ type, key, snapshot: this.getSnapshot() })
    const createId = (prefix?: string) => this.createId(prefix)

    this.state = new GraphState(graph)
    this.history = new GraphHistory(this.state, options.historyLimit ?? 100)
    this.idFactory = options.idFactory ?? createSequentialIdFactory((id) => this.state.hasId(id))
    this.commands = new LayeredRegistry('command', notify)
    this.nodeDefinitions = new LayeredRegistry('node-definition', notify)
    this.edgeDefinitions = new LayeredRegistry('edge-definition', notify)
    this.diagnostics = new GraphDiagnostics(
      {
        listNodeDefinitions: () => this.listNodeDefinitions(),
        listEdgeDefinitions: () => this.listEdgeDefinitions(),
      },
      notify,
    )
    this.connections = new ConnectionValidation({
      getSnapshot: () => this.getSnapshot(),
      getPort: (endpoint) => this.getPort(endpoint),
    })
    this.transactions = new GraphTransactions({
      state: this.state,
      history: this.history,
      diagnostics: this.diagnostics,
      events: this.events,
      createId,
    })

    const commandApi = (draft: GraphSnapshot) =>
      createCommandApi(draft, {
        createId,
        getNodeDefinition: (type) => this.getNodeDefinition(type),
        getEdgeDefinition: (type) => this.getEdgeDefinition(type),
      })

    this.writer = new GraphWriter({
      state: this.state,
      history: this.history,
      diagnostics: this.diagnostics,
      events: this.events,
      transactions: this.transactions,
      createCommandApi: commandApi,
    })
    this.dispatcher = new CommandDispatcher({
      getCommand: (commandId) => this.getCommand(commandId),
      execute: (command, changeOptions) => this.execute(command, changeOptions),
      getSnapshot: () => this.getSnapshot(),
      storeApi: () => createStoreApi(this),
      onReject: (reason) => this.transactions.recordFailure(reason),
    })
    this.plugins = new PluginHost(
      () => createPluginContext(this),
      (pluginName) =>
        this.events.emit({ type: 'plugin:registered', pluginName, snapshot: this.getSnapshot() }),
    )

    const builtInCommands = createBuiltInCommands({
      createCommandApi: commandApi,
      getEdge: (edgeId) => this.getEdge(edgeId),
      validateConnection: (source, target, connectionOptions) =>
        this.validateConnection(source, target, connectionOptions),
    })

    for (const command of builtInCommands) {
      this.commands.register(command.id, command, { silent: true })
    }

    try {
      for (const command of options.commands ?? []) {
        this.registerCommand(command)
      }

      for (const definition of options.nodeDefinitions ?? []) {
        this.registerNodeDefinition(definition)
      }

      for (const definition of options.edgeDefinitions ?? []) {
        this.registerEdgeDefinition(definition)
      }

      for (const validator of options.validators ?? []) {
        this.addConnectionValidator(validator)
      }

      for (const provider of options.diagnosticProviders ?? []) {
        this.registerDiagnosticProvider(provider)
      }

      for (const plugin of options.plugins ?? []) {
        this.use(plugin)
      }

      this.diagnostics.assertValid(this.state.current)
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  getSnapshot(): GraphSnapshot {
    return this.state.detach()
  }

  replaceGraph(graph: GraphSnapshot, options: GraphChangeOptions = {}): GraphSnapshot {
    return this.writer.replace(graph, options)
  }

  applyGraph(graph: GraphSnapshot, options: GraphChangeOptions = {}): GraphSnapshot {
    return this.writer.apply(graph, options)
  }

  subscribe(listener: GraphStoreListener): () => void {
    return this.events.subscribe(listener)
  }

  use(plugin: GraphPlugin): () => void {
    return this.plugins.use(plugin)
  }

  /** Whether a plugin with this name is registered (by `options.plugins` or `use()`). */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name)
  }

  dispose(): void {
    this.plugins.dispose()
    this.events.clear()
    this.connections.clear()
    this.diagnostics.clear()
    this.commands.clear()
    this.nodeDefinitions.clear()
    this.edgeDefinitions.clear()
  }

  createId(prefix?: string): string {
    return this.idFactory(prefix)
  }

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  addConnectionValidator(validator: ConnectionValidator): () => void {
    return this.connections.add(validator)
  }

  registerDiagnosticProvider(provider: GraphDiagnosticProvider): () => void {
    return this.diagnostics.register(provider)
  }

  registerCommand(command: GraphCommandRegistryEntry): () => void {
    return this.commands.register(command.id, command)
  }

  getCommand(commandId: string): GraphCommandRegistryEntry | undefined {
    return this.commands.get(commandId)
  }

  listCommands(): GraphCommandRegistryEntry[] {
    return this.commands.list()
  }

  dispatchCommand(
    commandId: string,
    payload?: unknown,
    options: GraphChangeOptions = {},
  ): GraphCommandDispatchResult {
    return this.dispatcher.dispatch(commandId, payload, options)
  }

  registerNodeDefinition(definition: NodeDefinition): () => void {
    return this.nodeDefinitions.register(definition.type, definition)
  }

  getNodeDefinition(type: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(type)
  }

  listNodeDefinitions(): NodeDefinition[] {
    return this.nodeDefinitions.list()
  }

  registerEdgeDefinition(definition: EdgeDefinition): () => void {
    return this.edgeDefinitions.register(definition.type, definition)
  }

  getEdgeDefinition(type: string): EdgeDefinition | undefined {
    return this.edgeDefinitions.get(type)
  }

  listEdgeDefinitions(): EdgeDefinition[] {
    return this.edgeDefinitions.list()
  }

  validateGraph(): GraphValidationResult {
    return this.diagnostics.analyze(this.state.current)
  }

  repairGraph(): GraphRepairResult {
    return this.writer.repair()
  }

  listDiagnostics(): GraphDiagnostic[] {
    return this.validateGraph().diagnostics
  }

  validateConnection(
    source: GraphEndpoint,
    target: GraphEndpoint,
    options: { ignoreEdgeId?: string } = {},
  ): ConnectionValidationResult {
    return this.connections.validate(source, target, options)
  }

  execute(command: GraphCommand, options: GraphChangeOptions = {}): GraphSnapshot {
    return this.writer.execute(command, options)
  }

  mutate(
    label: string,
    recipe: (draft: GraphSnapshot) => void,
    options: GraphChangeOptions = {},
  ): GraphSnapshot {
    return this.execute({ id: 'graph.mutate', label, execute: recipe }, options)
  }

  transaction(
    label: string | undefined,
    operation: () => void,
    options: GraphChangeOptions = {},
  ): GraphSnapshot {
    return this.transactions.run(label, operation, options)
  }

  undo(): GraphSnapshot {
    return this.writer.undo()
  }

  redo(): GraphSnapshot {
    return this.writer.redo()
  }

  addNode(node: GraphNode, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('node.add', { node }, options)
  }

  updateNode(nodeId: string, patch: GraphNodePatch, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('node.update', { nodeId, patch }, options)
  }

  moveNodes(
    nodeIds: string[],
    delta: { x: number; y: number },
    options?: GraphChangeOptions,
  ): GraphSnapshot {
    return this.dispatchSnapshot('node.move', { nodeIds, delta }, options)
  }

  removeNode(nodeId: string, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('node.remove', { nodeId }, options)
  }

  addEdge(edge: GraphEdge, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('edge.add', { edge }, options)
  }

  updateEdge(edgeId: string, patch: GraphEdgePatch, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('edge.update', { edgeId, patch }, options)
  }

  removeEdge(edgeId: string, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('edge.remove', { edgeId }, options)
  }

  connect(
    source: GraphEndpoint,
    target: GraphEndpoint,
    options?: {
      edgeId?: string
      edgeType?: string
      data?: GraphEdge['data']
      change?: GraphChangeOptions
    },
  ): ConnectionValidationResult {
    return toConnectionResult(
      this.dispatchCommand(
        'edge.connect',
        {
          source,
          target,
          edgeId: options?.edgeId,
          edgeType: options?.edgeType,
          data: options?.data,
        },
        options?.change,
      ),
    )
  }

  reconnectEdge(
    edgeId: string,
    reconnect: GraphEdgeReconnect,
    options?: GraphChangeOptions,
  ): ConnectionValidationResult {
    return toConnectionResult(
      this.dispatchCommand('edge.reconnect', { edgeId, reconnect }, options),
    )
  }

  addGroup(group: GraphGroup, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('group.add', { group }, options)
  }

  updateGroup(
    groupId: string,
    patch: GraphGroupPatch,
    options?: GraphChangeOptions,
  ): GraphSnapshot {
    return this.dispatchSnapshot('group.update', { groupId, patch }, options)
  }

  removeGroup(groupId: string, options?: GraphChangeOptions): GraphSnapshot {
    return this.dispatchSnapshot('group.remove', { groupId }, options)
  }

  getNode(nodeId: string): GraphNode | undefined {
    return this.state.getNode(nodeId)
  }

  getEdge(edgeId: string): GraphEdge | undefined {
    return this.state.getEdge(edgeId)
  }

  getGroup(groupId: string): GraphGroup | undefined {
    return this.state.getGroup(groupId)
  }

  listGroups(): GraphGroup[] {
    return this.state.listGroups()
  }

  getPort(endpoint: GraphEndpoint): GraphPort | undefined {
    return this.state.getPort(endpoint, (type) => this.getNodeDefinition(type))
  }

  /** Dispatches a built-in command and throws instead of returning a rejected result. */
  private dispatchSnapshot(
    commandId: string,
    payload: unknown,
    options?: GraphChangeOptions,
  ): GraphSnapshot {
    const result = this.dispatchCommand(commandId, payload, options)

    if (!result.applied) {
      throw new Error(result.reason ?? `Command "${commandId}" failed to execute.`)
    }

    return result.snapshot
  }
}

export function createGraphStore(graph?: GraphSnapshot, options?: GraphStoreOptions): GraphStore {
  return new GraphStore(graph, options)
}

function toConnectionResult(result: GraphCommandDispatchResult): ConnectionValidationResult {
  if (!result.applied) {
    return (
      result.validation ?? {
        valid: false,
        reason: result.reason,
      }
    )
  }

  return { valid: true }
}
