import { cloneValue } from '../protocol/index.js'
import type { GraphDiagnostic, GraphHistoryEntry, GraphSnapshot } from '../protocol/index.js'
import type { GraphState } from './graph-state.js'

/**
 * Undo and redo stacks of committed changes. Committing, undoing, and redoing move the committed
 * graph of `state`; the oldest entries are dropped beyond `limit`.
 */
export class GraphHistory {
  private undoStack: GraphHistoryEntry[] = []
  private redoStack: GraphHistoryEntry[] = []

  constructor(
    private readonly state: GraphState,
    private readonly limit: number,
  ) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Commits `after` as the graph and records the change as one undo step; clears redo. */
  commit(
    before: GraphSnapshot,
    after: GraphSnapshot,
    change: { id: string; label?: string; diagnostics: GraphDiagnostic[] },
  ): GraphHistoryEntry {
    this.state.replace(after)

    const entry: GraphHistoryEntry = {
      id: change.id,
      label: change.label,
      before,
      after,
      timestamp: Date.now(),
      diagnostics: change.diagnostics,
    }

    this.undoStack.push(cloneValue(entry))
    this.redoStack = []

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift()
    }

    return entry
  }

  /** Restores the graph before the newest change; `undefined` when there is nothing to undo. */
  undo(): GraphHistoryEntry | undefined {
    const entry = this.undoStack.pop()

    if (!entry) {
      return undefined
    }

    this.redoStack.push(entry)
    this.state.replace(entry.before)
    return entry
  }

  /** Reapplies the newest undone change; `undefined` when there is nothing to redo. */
  redo(): GraphHistoryEntry | undefined {
    const entry = this.redoStack.pop()

    if (!entry) {
      return undefined
    }

    this.undoStack.push(entry)
    this.state.replace(entry.after)
    return entry
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
