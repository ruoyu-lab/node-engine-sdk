import { cloneValue } from '../protocol/index.js'
import type { GraphRegistryEvent } from '../protocol/index.js'

export type RegistryEventType = GraphRegistryEvent['type']

/** What a registry holds; it names the registry's `registry:<subject>-*` events. */
export type RegistrySubject = 'command' | 'node-definition' | 'edge-definition'

/**
 * Keyed registry where a later registration shadows an earlier one under the same key. Removing
 * the top registration reveals the previous one again, so plugins can override a command or a
 * definition and restore it on disposal. Stored values and query results are detached copies.
 */
export class LayeredRegistry<T> {
  private readonly layers = new Map<string, T[]>()

  constructor(
    private readonly subject: RegistrySubject,
    private readonly notify: (type: RegistryEventType, key: string) => void,
  ) {}

  /**
   * Registers `value` on top of `key` and returns a function that removes exactly this
   * registration. A silent registration does not notify; its removal always does.
   */
  register(key: string, value: T, options: { silent?: boolean } = {}): () => void {
    const storedValue = cloneValue(value)
    const layers = this.layers.get(key) ?? []
    layers.push(storedValue)
    this.layers.set(key, layers)

    if (!options.silent) {
      this.notify(`registry:${this.subject}-registered`, key)
    }

    return () => this.unregister(key, storedValue)
  }

  get(key: string): T | undefined {
    const value = this.layers.get(key)?.at(-1)
    return value ? cloneValue(value) : undefined
  }

  list(): T[] {
    return cloneValue(
      [...this.layers.values()]
        .map((layers) => layers.at(-1))
        .filter((value): value is T => Boolean(value)),
    )
  }

  clear(): void {
    this.layers.clear()
  }

  private unregister(key: string, storedValue: T): void {
    const layers = this.layers.get(key)

    if (!layers) {
      return
    }

    const index = layers.lastIndexOf(storedValue)

    if (index === -1) {
      return
    }

    layers.splice(index, 1)

    if (layers.length === 0) {
      this.layers.delete(key)
      this.notify(`registry:${this.subject}-unregistered`, key)
      return
    }

    this.notify(`registry:${this.subject}-registered`, key)
  }
}
