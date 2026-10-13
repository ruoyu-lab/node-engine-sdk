import { snapshotEquals } from '../protocol/index.js'
import type { GraphChangeOptions, GraphSnapshot } from '../protocol/index.js'
import type { GraphDiagnostics } from './diagnostics.js'
import type { GraphState } from './graph-state.js'
import type { GraphHistory } from './history.js'
import type { StoreEvents } from './store-events.js'

interface ActiveTransaction {
  before: GraphSnapshot
  id: string
  label?: string
  source?: string
  failure?: Error
}

export interface GraphTransactionsDependencies {
  state: GraphState
  history: GraphHistory
  diagnostics: GraphDiagnostics
  events: StoreEvents
  createId: (prefix?: string) => string
}

/**
 * Atomic groups of changes. Inside a transaction commands write straight to the graph; the
 * transaction validates once at the end and commits a single history entry, or restores the graph
 * it started from when the operation throws, a command fails, or final validation fails.
 */
export class GraphTransactions {
  private active?: ActiveTransaction

  constructor(private readonly dependencies: GraphTransactionsDependencies) {}

  get isActive(): boolean {
    return this.active !== undefined
  }

  /** Rejects operations that would break the atomicity of an active transaction. */
  assertOutside(operation: string): void {
    if (this.active) {
      throw new Error(`Cannot ${operation} inside a graph transaction.`)
    }
  }

  /** Marks the active transaction as failed; the first failure wins. */
  recordFailure(reason: string): void {
    if (this.active && !this.active.failure) {
      this.active.failure = new Error(reason)
    }
  }

  run(
    label: string | undefined,
    operation: () => void,
    options: GraphChangeOptions,
  ): GraphSnapshot {
    if (this.active) {
      throw new Error('Nested graph transactions are not supported.')
    }

    const { state, history, diagnostics, events } = this.dependencies
    const transaction: ActiveTransaction = {
      id: this.dependencies.createId('tx'),
      label,
      before: state.current,
      source: options.source,
    }
    this.active = transaction

    try {
      const result: unknown = operation()

      if (isPromiseLike(result)) {
        throw new Error('Graph transactions must be synchronous.')
      }

      if (transaction.failure) {
        throw transaction.failure
      }

      const prepared = diagnostics.prepare(state.current)

      if (snapshotEquals(transaction.before, prepared.graph)) {
        state.replace(transaction.before)
        this.active = undefined
        return state.detach()
      }

      this.active = undefined
      const entry = history.commit(transaction.before, prepared.graph, {
        id: transaction.id,
        label: transaction.label,
        diagnostics: prepared.diagnostics,
      })
      const snapshot = state.detach()
      events.emit({ type: 'history:commit', entry, snapshot, source: transaction.source })
      events.emit({ type: 'graph:changed', snapshot, source: transaction.source })
      return snapshot
    } catch (error) {
      state.replace(transaction.before)
      this.active = undefined
      throw error
    }
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}
