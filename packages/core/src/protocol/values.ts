import type { GraphSnapshot } from './types.js'

/** Deep copy of plain data: arrays, `Date`s, and own enumerable properties of objects. */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  const clone: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneValue(entry)
  }

  return clone as T
}

export function cloneGraph(snapshot: GraphSnapshot): GraphSnapshot {
  return cloneValue(snapshot)
}

/** Structural equality of two snapshots, iterative so deep metadata cannot overflow the stack. */
export function snapshotEquals(left: GraphSnapshot, right: GraphSnapshot): boolean {
  const pending: Array<[unknown, unknown]> = [[left, right]]

  while (pending.length > 0) {
    const [leftValue, rightValue] = pending.pop()!

    if (Object.is(leftValue, rightValue)) {
      continue
    }

    if (
      leftValue === null ||
      rightValue === null ||
      typeof leftValue !== 'object' ||
      typeof rightValue !== 'object'
    ) {
      return false
    }

    const leftArray = Array.isArray(leftValue)
    const rightArray = Array.isArray(rightValue)

    if (leftArray || rightArray) {
      if (!leftArray || !rightArray || leftValue.length !== rightValue.length) {
        return false
      }

      for (let index = 0; index < leftValue.length; index += 1) {
        pending.push([leftValue[index], rightValue[index]])
      }

      continue
    }

    const leftRecord = leftValue as Record<string, unknown>
    const rightRecord = rightValue as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord)
    const rightKeys = Object.keys(rightRecord)

    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) {
        return false
      }

      pending.push([leftRecord[key], rightRecord[key]])
    }
  }

  return true
}
