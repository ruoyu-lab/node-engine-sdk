/*
 * Detached and immutable copies of runtime values. Run results, handler call stacks, and listener
 * events never share objects with a live run.
 */

/**
 * Deep copy that, unlike the protocol's `cloneValue`, keeps `Error`s (with `cause` and own
 * properties), `Map`s, `Set`s, and cyclic references.
 */
export function cloneRuntimeValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const existing = seen.get(value)

  if (existing) {
    return existing as T
  }

  if (value instanceof Error) {
    const error = new Error(value.message)
    error.name = value.name
    error.stack = value.stack
    seen.set(value, error)

    if (value.cause !== undefined) {
      Object.defineProperty(error, 'cause', {
        configurable: true,
        value: cloneRuntimeValue(value.cause, seen),
      })
    }

    const errorRecord = error as unknown as Record<string, unknown>

    for (const [key, entry] of Object.entries(value)) {
      errorRecord[key] = cloneRuntimeValue(entry, seen)
    }

    return error as T
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  if (Array.isArray(value)) {
    const result: unknown[] = []
    seen.set(value, result)

    for (const entry of value) {
      result.push(cloneRuntimeValue(entry, seen))
    }

    return result as T
  }

  if (value instanceof Map) {
    const result = new Map<unknown, unknown>()
    seen.set(value, result)

    for (const [key, entry] of value) {
      result.set(cloneRuntimeValue(key, seen), cloneRuntimeValue(entry, seen))
    }

    return result as T
  }

  if (value instanceof Set) {
    const result = new Set<unknown>()
    seen.set(value, result)

    for (const entry of value) {
      result.add(cloneRuntimeValue(entry, seen))
    }

    return result as T
  }

  const result: Record<string, unknown> = {}
  seen.set(value, result)

  for (const [key, entry] of Object.entries(value)) {
    result[key] = cloneRuntimeValue(entry, seen)
  }

  return result as T
}

/** Freezes `value` in place, including the entries of `Map`s and `Set`s and their mutators. */
export function deepFreeze<T>(value: T, visited = new WeakSet()): T {
  if (!value || typeof value !== 'object' || visited.has(value)) {
    return value
  }

  visited.add(value)

  if (value instanceof Map) {
    for (const [key, entry] of value) {
      deepFreeze(key, visited)
      deepFreeze(entry, visited)
    }
    defineImmutableCollectionMethods(value, ['set', 'delete', 'clear'])
    return Object.freeze(value)
  }

  if (value instanceof Set) {
    for (const entry of value) {
      deepFreeze(entry, visited)
    }
    defineImmutableCollectionMethods(value, ['add', 'delete', 'clear'])
    return Object.freeze(value)
  }

  for (const entry of Object.values(value)) {
    deepFreeze(entry, visited)
  }

  return Object.freeze(value)
}

function defineImmutableCollectionMethods(
  collection: Map<unknown, unknown> | Set<unknown>,
  methods: string[],
): void {
  for (const method of methods) {
    Object.defineProperty(collection, method, {
      configurable: false,
      value: () => {
        throw new TypeError('Runtime event snapshots are immutable.')
      },
      writable: false,
    })
  }
}
