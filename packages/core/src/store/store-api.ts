import type { GraphPluginContext, GraphStoreLike } from '../protocol/index.js'
import type { GraphStore } from './store.js'

/** The store surface handed to command definitions and plugins, bound to `store`. */
export function createStoreApi(store: GraphStore): GraphStoreLike {
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    createId: (prefix) => store.createId(prefix),
    getNode: (nodeId) => store.getNode(nodeId),
    getEdge: (edgeId) => store.getEdge(edgeId),
    getGroup: (groupId) => store.getGroup(groupId),
    listGroups: () => store.listGroups(),
    getPort: (endpoint) => store.getPort(endpoint),
    validateGraph: () => store.validateGraph(),
    repairGraph: () => store.repairGraph(),
    addConnectionValidator: (validator) => store.addConnectionValidator(validator),
    registerCommand: (command) => store.registerCommand(command),
    dispatchCommand: (commandId, payload, options) =>
      store.dispatchCommand(commandId, payload, options),
    getCommand: (commandId) => store.getCommand(commandId),
    listCommands: () => store.listCommands(),
    registerNodeDefinition: (definition) => store.registerNodeDefinition(definition),
    getNodeDefinition: (type) => store.getNodeDefinition(type),
    listNodeDefinitions: () => store.listNodeDefinitions(),
    registerEdgeDefinition: (definition) => store.registerEdgeDefinition(definition),
    getEdgeDefinition: (type) => store.getEdgeDefinition(type),
    listEdgeDefinitions: () => store.listEdgeDefinitions(),
    registerDiagnosticProvider: (provider) => store.registerDiagnosticProvider(provider),
    listDiagnostics: () => store.listDiagnostics(),
  }
}

/** The context a plugin's `setup` receives. */
export function createPluginContext(store: GraphStore): GraphPluginContext {
  return {
    store: createStoreApi(store),
    addConnectionValidator: (validator) => store.addConnectionValidator(validator),
    createId: (prefix) => store.createId(prefix),
    registerCommand: (command) => store.registerCommand(command),
    registerNodeDefinition: (definition) => store.registerNodeDefinition(definition),
    registerEdgeDefinition: (definition) => store.registerEdgeDefinition(definition),
    registerDiagnosticProvider: (provider) => store.registerDiagnosticProvider(provider),
  }
}
