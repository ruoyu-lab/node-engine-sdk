import { createGraphStore, type GraphStore } from '../../store/index.js'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  snapshotEquals,
  type GraphEdge,
  type GraphSnapshot,
  type GraphStoreEvent,
} from '../../protocol/index.js'
import { signal, type ReadonlySignal } from '../reactive.js'
import type { NodeEngineEventSink } from '../types/index.js'
import type { ResolvedEditorOptions } from './options.js'

/**
 * Owns the editor's current `GraphStore`: creates an internal store from the store-owned options
 * (graph and registries) or binds a provided one, mirrors its snapshots into signals, and replaces
 * it when the options change. Only internally created stores are disposed by the editor.
 */
export interface StoreBinding {
  readonly store: ReadonlySignal<GraphStore>
  readonly graph: ReadonlySignal<GraphSnapshot>
  /** Increments whenever node structure may have changed (not for viewport/selection commands). */
  readonly schemaRevision: ReadonlySignal<number>
  applyOptions: (previous: ResolvedEditorOptions, next: ResolvedEditorOptions) => void
  /** Runs before the current store is replaced (cancel gestures, drop per-store caches). */
  onBeforeReplace: (listener: () => void) => void
  /** Runs after a store was bound, with its initial snapshot. */
  onBind: (listener: (graph: GraphSnapshot) => void) => void
  /** Runs for every store event with the new snapshot. */
  onSnapshot: (listener: (graph: GraphSnapshot) => void) => void
  /** Runs after `graph:changed`, before the `command` event is emitted. */
  onGraphChanged: (listener: (graph: GraphSnapshot) => void) => void
  dispose: () => void
}

interface StoreBindingHooks {
  beforeReplace: Array<() => void>
  bind: Array<(graph: GraphSnapshot) => void>
  snapshot: Array<(graph: GraphSnapshot) => void>
  graphChanged: Array<(graph: GraphSnapshot) => void>
}

export function createStoreBinding(options: {
  initial: ResolvedEditorOptions
  emit: NodeEngineEventSink
}): StoreBinding {
  const hooks: StoreBindingHooks = { beforeReplace: [], bind: [], snapshot: [], graphChanged: [] }
  let ownsStore = !options.initial.store
  const initialStore =
    options.initial.store ??
    createGraphStore(
      options.initial.graph ?? createEmptyGraph(),
      resolveStoreOptions(options.initial),
    )
  const store = signal(initialStore)
  const graph = signal(initialStore.getSnapshot())
  const schemaRevision = signal(0)
  let unbind = bind(initialStore)

  function bind(target: GraphStore): () => void {
    let previousSnapshot = target.getSnapshot()
    let schemaChangeHint: boolean | null = null

    graph.value = previousSnapshot
    schemaRevision.value += 1

    for (const listener of hooks.bind) {
      listener(previousSnapshot)
    }

    return target.subscribe((event) => {
      const nextSnapshot = event.snapshot
      graph.value = nextSnapshot

      for (const listener of hooks.snapshot) {
        listener(nextSnapshot)
      }

      if (event.type === 'command:executed') {
        schemaChangeHint = changesNodeStructure(event)

        if (event.command.id === 'edge.connect') {
          const edge = findCreatedEdge(previousSnapshot, nextSnapshot)

          if (edge) {
            options.emit('connect', { edge })
          }
        }
      }

      if (event.type === 'graph:changed') {
        if (schemaChangeHint ?? hasGraphStructureChanged(previousSnapshot, nextSnapshot)) {
          schemaRevision.value += 1
        }

        schemaChangeHint = null
        options.emit('graph-change', nextSnapshot)

        for (const listener of hooks.graphChanged) {
          listener(nextSnapshot)
        }

        previousSnapshot = nextSnapshot
      }

      options.emit('command', event)
    })
  }

  function replace(nextStore: GraphStore, nextOwnsStore: boolean): void {
    const currentStore = store.peek()

    if (currentStore === nextStore && ownsStore === nextOwnsStore) {
      return
    }

    for (const listener of hooks.beforeReplace) {
      listener()
    }

    unbind()

    if (ownsStore) {
      currentStore.dispose()
    }

    ownsStore = nextOwnsStore
    store.value = nextStore
    unbind = bind(nextStore)
  }

  function createInternalStore(
    next: ResolvedEditorOptions,
    initialGraph: GraphSnapshot,
  ): GraphStore {
    return createGraphStore(initialGraph, resolveStoreOptions(next))
  }

  return {
    store,
    graph,
    schemaRevision,
    applyOptions(previous, next) {
      if (next.store !== previous.store) {
        // A new owned store starts from the graph option, else from the graph shown so far.
        replace(next.store ?? createInternalStore(next, next.graph ?? graph.peek()), !next.store)
        return
      }

      // A provided store owns its graph and registries; `resolveEditorOptions` rejects both.
      if (next.store) {
        return
      }

      if (next.graph !== previous.graph && next.graph && next.graph !== graph.peek()) {
        store.peek().replaceGraph(next.graph, { source: 'options' })
      }

      if (definesDifferentRegistry(previous, next)) {
        replace(createInternalStore(next, graph.peek()), true)
      }
    },
    onBeforeReplace: (listener) => hooks.beforeReplace.push(listener),
    onBind: (listener) => hooks.bind.push(listener),
    onSnapshot: (listener) => hooks.snapshot.push(listener),
    onGraphChanged: (listener) => hooks.graphChanged.push(listener),
    dispose() {
      unbind()

      if (ownsStore) {
        store.peek().dispose()
      }
    },
  }
}

function createEmptyGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
  }
}

export function findCreatedEdge(
  before: GraphSnapshot,
  after: GraphSnapshot,
): GraphEdge | undefined {
  const beforeIds = new Set(before.edges.map((edge) => edge.id))

  return after.edges.find((edge) => !beforeIds.has(edge.id))
}

function resolveStoreOptions(options: ResolvedEditorOptions) {
  return {
    validators: options.connectionValidator ? [options.connectionValidator] : [],
    plugins: [...options.plugins],
    commands: [...options.commands],
    nodeDefinitions: [...options.nodeDefinitions],
    edgeDefinitions: [...options.edgeDefinitions],
  }
}

function definesDifferentRegistry(
  previous: ResolvedEditorOptions,
  next: ResolvedEditorOptions,
): boolean {
  return (
    previous.connectionValidator !== next.connectionValidator ||
    previous.plugins !== next.plugins ||
    previous.commands !== next.commands ||
    previous.nodeDefinitions !== next.nodeDefinitions ||
    previous.edgeDefinitions !== next.edgeDefinitions
  )
}

function changesNodeStructure(event: Extract<GraphStoreEvent, { type: 'command:executed' }>) {
  return event.command.category !== 'viewport' && event.command.category !== 'selection'
}

function hasGraphStructureChanged(previous: GraphSnapshot, next: GraphSnapshot): boolean {
  return !snapshotEquals({ ...previous, meta: {} }, { ...next, meta: {} })
}
