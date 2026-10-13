import { cloneValue } from '../protocol/index.js'
import type { GraphStoreEvent, GraphStoreListener } from '../protocol/index.js'

/** Store listeners; every listener receives its own copy of each event. */
export class StoreEvents {
  private readonly listeners = new Set<GraphStoreListener>()

  subscribe(listener: GraphStoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: GraphStoreEvent): void {
    for (const listener of this.listeners) {
      listener(cloneValue(event))
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
