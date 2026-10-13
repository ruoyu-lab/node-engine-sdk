/**
 * Minimal synchronous signal graph that keeps the editor controller framework-independent.
 *
 * - `signal` holds a value; writes that change the value (per `equals`) mark dependents stale.
 * - `computed` derives a value lazily, re-running only when a source version changed, and keeps
 *   its previous value (and identity) when the result is `equals` to it.
 * - `effect` re-runs eagerly after the outermost write or `batch` completes.
 *
 * Complexity: a write marks each transitive dependent once (O(dependents)); a read re-validates
 * only the stale part of the graph.
 */

export interface ReadonlySignal<T> {
  readonly value: T
  /** Reads the current value without tracking it as a dependency. */
  peek: () => T
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T
}

type Equals<T> = (left: T, right: T) => boolean

interface Source {
  version: number
  readonly observers: Set<Observer>
  refresh: () => void
}

interface Observer {
  readonly sources: Map<Source, number>
  markStale: () => void
}

let activeObserver: Observer | null = null
let batchDepth = 0
let flushing = false
const pendingEffects = new Set<EffectNode>()

class SignalNode<T> implements Source, Signal<T> {
  version = 0
  readonly observers = new Set<Observer>()

  constructor(
    private current: T,
    private readonly equals: Equals<T>,
  ) {}

  get value(): T {
    track(this)
    return this.current
  }

  set value(next: T) {
    if (this.equals(this.current, next)) {
      return
    }

    this.current = next
    this.version += 1
    notify(this.observers)
  }

  peek(): T {
    return this.current
  }

  refresh(): void {}
}

class ComputedNode<T> implements Source, Observer, ReadonlySignal<T> {
  version = 0
  readonly observers = new Set<Observer>()
  sources = new Map<Source, number>()
  private stale = true
  private initialized = false
  private computing = false
  private current: T | undefined

  constructor(
    private readonly compute: () => T,
    private readonly equals: Equals<T>,
  ) {}

  get value(): T {
    this.refresh()
    track(this)
    return this.current as T
  }

  peek(): T {
    this.refresh()
    return this.current as T
  }

  markStale(): void {
    if (this.stale) {
      return
    }

    this.stale = true

    for (const observer of [...this.observers]) {
      observer.markStale()
    }
  }

  refresh(): void {
    if (!this.stale) {
      return
    }

    if (this.computing) {
      throw new Error('Cyclic computed dependency detected.')
    }

    if (this.initialized && !haveSourcesChanged(this.sources)) {
      this.stale = false
      return
    }

    let next: T
    this.computing = true

    try {
      next = runTracked(this, this.compute)
    } finally {
      this.computing = false
    }

    this.stale = false

    if (!this.initialized || !this.equals(this.current as T, next)) {
      this.current = next
      this.version += 1
    }

    this.initialized = true
  }
}

class EffectNode implements Observer {
  sources = new Map<Source, number>()
  private initialized = false
  private disposed = false

  constructor(private readonly run: () => void) {}

  markStale(): void {
    if (!this.disposed) {
      pendingEffects.add(this)
    }
  }

  execute(): void {
    if (this.disposed || (this.initialized && !haveSourcesChanged(this.sources))) {
      return
    }

    this.initialized = true
    runTracked(this, this.run)
  }

  dispose(): void {
    this.disposed = true
    pendingEffects.delete(this)
    unsubscribe(this)
  }
}

export function signal<T>(initial: T, equals: Equals<T> = Object.is): Signal<T> {
  return new SignalNode(initial, equals)
}

export function computed<T>(compute: () => T, equals: Equals<T> = Object.is): ReadonlySignal<T> {
  return new ComputedNode(compute, equals)
}

/** Runs `run` now and again after every batch in which one of its dependencies changed. */
export function effect(run: () => void): () => void {
  const node = new EffectNode(run)

  batch(() => node.execute())
  return () => node.dispose()
}

/** Defers effects until `operation` (and any enclosing batch) completes. */
export function batch<T>(operation: () => T): T {
  batchDepth += 1

  try {
    return operation()
  } finally {
    batchDepth -= 1

    if (batchDepth === 0) {
      flushEffects()
    }
  }
}

/** Reads signals inside `operation` without making them dependencies of the active observer. */
export function untracked<T>(operation: () => T): T {
  const previous = activeObserver
  activeObserver = null

  try {
    return operation()
  } finally {
    activeObserver = previous
  }
}

function track(source: Source): void {
  if (!activeObserver) {
    return
  }

  activeObserver.sources.set(source, source.version)
  source.observers.add(activeObserver)
}

function notify(observers: Set<Observer>): void {
  batch(() => {
    for (const observer of [...observers]) {
      observer.markStale()
    }
  })
}

function haveSourcesChanged(sources: Map<Source, number>): boolean {
  for (const [source, version] of sources) {
    source.refresh()

    if (source.version !== version) {
      return true
    }
  }

  return false
}

function unsubscribe(observer: Observer): void {
  for (const source of observer.sources.keys()) {
    source.observers.delete(observer)
  }

  observer.sources.clear()
}

function runTracked<T>(observer: Observer, operation: () => T): T {
  const previous = activeObserver

  unsubscribe(observer)
  activeObserver = observer

  try {
    return operation()
  } finally {
    activeObserver = previous
  }
}

function flushEffects(): void {
  if (flushing) {
    return
  }

  flushing = true
  const errors: unknown[] = []

  try {
    while (pendingEffects.size > 0) {
      const [next] = pendingEffects

      pendingEffects.delete(next!)

      try {
        batchDepth += 1
        next!.execute()
      } catch (error) {
        errors.push(error)
      } finally {
        batchDepth -= 1
      }
    }
  } finally {
    flushing = false
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, 'Multiple editor effects failed.')
  }
}
