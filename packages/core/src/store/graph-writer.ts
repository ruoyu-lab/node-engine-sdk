import { cloneGraph, cloneValue, snapshotEquals } from '../protocol/index.js'
import type {
  GraphChangeOptions,
  GraphCommand,
  GraphCommandApi,
  GraphRepairResult,
  GraphSnapshot,
} from '../protocol/index.js'
import type { GraphDiagnostics } from './diagnostics.js'
import type { GraphState } from './graph-state.js'
import type { GraphHistory } from './history.js'
import type { StoreEvents } from './store-events.js'
import type { GraphTransactions } from './transactions.js'

export interface GraphWriterDependencies {
  state: GraphState
  history: GraphHistory
  diagnostics: GraphDiagnostics
  events: StoreEvents
  transactions: GraphTransactions
  createCommandApi: (draft: GraphSnapshot) => GraphCommandApi
}

/**
 * Every write to the committed graph outside a transaction: validation before commit, one history
 * entry per change, and change events. A write that leaves the graph equal commits nothing.
 */
export class GraphWriter {
  constructor(private readonly dependencies: GraphWriterDependencies) {}

  /** Replaces the graph and clears history; the replacement itself cannot be undone. */
  replace(graph: GraphSnapshot, options: GraphChangeOptions): GraphSnapshot {
    const { state, history, diagnostics, events, transactions } = this.dependencies
    transactions.assertOutside('replace a graph')
    const before = state.current
    const prepared = diagnostics.prepare(graph)

    history.clear()

    if (snapshotEquals(before, prepared.graph)) {
      return state.detach()
    }

    state.replace(prepared.graph)
    const snapshot = state.detach()
    events.emit({ type: 'graph:changed', snapshot, source: options.source })
    return snapshot
  }

  /** Replaces the graph as one undoable change. */
  apply(graph: GraphSnapshot, options: GraphChangeOptions): GraphSnapshot {
    const { state, history, diagnostics, events, transactions } = this.dependencies
    transactions.assertOutside('apply a graph')
    const before = state.current
    const prepared = diagnostics.prepare(graph)

    if (snapshotEquals(before, prepared.graph)) {
      return state.detach()
    }

    const entry = history.commit(before, prepared.graph, {
      id: 'graph.apply',
      label: 'Apply graph',
      diagnostics: prepared.diagnostics,
    })
    const snapshot = state.detach()
    events.emit({ type: 'history:commit', entry, snapshot, source: options.source })
    events.emit({ type: 'graph:changed', snapshot, source: options.source })
    return snapshot
  }

  /** Repairs broken references as one undoable change. */
  repair(): GraphRepairResult {
    const { state, history, diagnostics, events, transactions } = this.dependencies
    transactions.assertOutside('repair a graph')
    const before = state.current
    const result = diagnostics.repair(before)
    const repaired = cloneGraph(result.graph)

    if (snapshotEquals(before, result.graph)) {
      state.replace(repaired)
    } else {
      history.commit(before, repaired, {
        id: 'graph.repair',
        label: 'Repair graph',
        diagnostics: result.diagnostics,
      })
      events.emit({ type: 'graph:changed', snapshot: state.detach(), source: 'graph.repair' })
    }

    return cloneValue({
      graph: state.current,
      diagnostics: result.diagnostics,
      validation: result.validation,
    })
  }

  /**
   * Runs a command against a draft of the graph. Inside a transaction the draft is written
   * directly and the transaction commits it later.
   */
  execute(command: GraphCommand, options: GraphChangeOptions): GraphSnapshot {
    const { state, history, diagnostics, events, transactions } = this.dependencies
    const before = state.current
    const draft = cloneGraph(before)

    command.execute(draft, this.dependencies.createCommandApi(draft))

    if (transactions.isActive) {
      state.replace(cloneGraph(draft))
      return state.detach()
    }

    const prepared = diagnostics.prepare(draft)

    if (snapshotEquals(before, prepared.graph)) {
      return state.detach()
    }

    history.commit(before, prepared.graph, {
      id: command.id,
      label: command.label,
      diagnostics: prepared.diagnostics,
    })
    const snapshot = state.detach()
    events.emit({
      type: 'command:executed',
      command: {
        id: command.id,
        label: command.label,
        category: command.category,
        shortcut: command.shortcut,
        icon: command.icon,
        when: command.when,
      },
      snapshot,
      source: options.source,
      diagnostics: prepared.diagnostics,
    })
    events.emit({ type: 'graph:changed', snapshot, source: options.source })
    return snapshot
  }

  undo(): GraphSnapshot {
    const { state, history, events, transactions } = this.dependencies
    transactions.assertOutside('undo history')
    const entry = history.undo()
    const snapshot = state.detach()

    if (entry) {
      events.emit({ type: 'history:undo', entry, snapshot })
      events.emit({ type: 'graph:changed', snapshot })
    }

    return snapshot
  }

  redo(): GraphSnapshot {
    const { state, history, events, transactions } = this.dependencies
    transactions.assertOutside('redo history')
    const entry = history.redo()
    const snapshot = state.detach()

    if (entry) {
      events.emit({ type: 'history:redo', entry, snapshot })
      events.emit({ type: 'graph:changed', snapshot })
    }

    return snapshot
  }
}
