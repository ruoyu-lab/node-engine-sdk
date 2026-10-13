import { cloneValue, type GraphSnapshot } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { computed, signal, type ReadonlySignal } from '../reactive.js'
import type {
  NodeEngineEventSink,
  NodeEngineSelectionMode,
  SelectionState,
} from '../types/index.js'

/**
 * Selected node and edge ids. Selections only ever reference entities of the current graph:
 * they are normalized on every write and whenever the graph changes.
 */
export interface SelectionModel {
  readonly selection: ReadonlySignal<SelectionState>
  readonly selectedNodeIds: ReadonlySignal<ReadonlySet<string>>
  set: (selection: Partial<SelectionState>, source: string) => GraphSnapshot
  clear: (source: string) => GraphSnapshot
  /** Selects only `nodeId` unless it is already selected. */
  ensureNode: (nodeId: string, source: string) => void
  toggleNode: (nodeId: string, source: string) => GraphSnapshot
  get: () => SelectionState
  /** Drops ids missing from `graph`; emits `selection-change` when that changes the selection. */
  reconcile: (graph: GraphSnapshot) => void
  /** Drops ids missing from a newly bound store's graph without emitting. */
  rebase: (graph: GraphSnapshot) => void
}

export function createSelectionModel(options: {
  initial: Partial<SelectionState> | undefined
  graph: GraphSnapshot
  getStore: () => GraphStore
  emit: NodeEngineEventSink
}): SelectionModel {
  const selection = signal(normalizeSelection(options.initial, options.graph), selectionEquals)
  const selectedNodeIds = computed<ReadonlySet<string>>(() => new Set(selection.value.nodes))

  function set(patch: Partial<SelectionState>, source: string): GraphSnapshot {
    const graph = options.getStore().getSnapshot()
    const current = selection.peek()
    const next = normalizeSelection(
      { nodes: patch.nodes ?? current.nodes, edges: patch.edges ?? current.edges },
      graph,
    )

    if (!selectionEquals(current, next)) {
      selection.value = next
      options.emit('selection-change', cloneValue(next), graph, source)
    }

    return graph
  }

  return {
    selection,
    selectedNodeIds,
    set,
    clear: (source) => set({ nodes: [], edges: [] }, source),
    ensureNode(nodeId, source) {
      if (!selectedNodeIds.peek().has(nodeId)) {
        set({ nodes: [nodeId], edges: [] }, source)
      }
    },
    toggleNode(nodeId, source) {
      const nodes = selection.peek().nodes

      return set(
        {
          nodes: nodes.includes(nodeId)
            ? nodes.filter((value) => value !== nodeId)
            : [...nodes, nodeId],
          edges: [],
        },
        source,
      )
    },
    get: () => cloneValue(selection.peek()),
    reconcile(graph) {
      const next = normalizeSelection(selection.peek(), graph)

      if (!selectionEquals(selection.peek(), next)) {
        selection.value = next
        options.emit('selection-change', cloneValue(next), graph)
      }
    },
    rebase(graph) {
      selection.value = normalizeSelection(selection.peek(), graph)
    },
  }
}

function normalizeSelection(
  selection: Partial<SelectionState> | undefined,
  graph: GraphSnapshot,
): SelectionState {
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const edgeIds = new Set(graph.edges.map((edge) => edge.id))

  return {
    nodes: [...new Set(selection?.nodes ?? [])].filter((nodeId) => nodeIds.has(nodeId)),
    edges: [...new Set(selection?.edges ?? [])].filter((edgeId) => edgeIds.has(edgeId)),
  }
}

function selectionEquals(left: SelectionState, right: SelectionState): boolean {
  return (
    left.nodes.length === right.nodes.length &&
    left.edges.length === right.edges.length &&
    left.nodes.every((value, index) => value === right.nodes[index]) &&
    left.edges.every((value, index) => value === right.edges[index])
  )
}

export function applySelectionMode(
  current: string[],
  next: string[],
  mode: NodeEngineSelectionMode,
): string[] {
  if (mode === 'replace') {
    return [...next]
  }

  if (mode === 'add') {
    return [...new Set([...current, ...next])]
  }

  const selected = new Set(next)
  return current.filter((value) => !selected.has(value))
}

export function hasSelection(selection: SelectionState): boolean {
  return selection.nodes.length > 0 || selection.edges.length > 0
}
