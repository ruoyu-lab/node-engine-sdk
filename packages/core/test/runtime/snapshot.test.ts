import { describe, expect, it } from 'vitest'
import { cloneRuntimeValue, deepFreeze } from '../../src/runtime/snapshot'

describe('@node-wright/core/runtime snapshots', () => {
  it('copies errors with their cause and own properties', () => {
    const cause = new Error('Root cause')
    const error = Object.assign(new Error('Request failed', { cause }), {
      status: 503,
      details: { retry: true },
    })
    error.name = 'RequestError'

    const copy = cloneRuntimeValue(error)

    expect(copy).not.toBe(error)
    expect(copy).toBeInstanceOf(Error)
    expect([copy.name, copy.message, copy.stack]).toEqual([error.name, error.message, error.stack])
    expect(copy.cause).not.toBe(cause)
    expect((copy.cause as Error).message).toBe('Root cause')
    expect(copy.status).toBe(503)
    expect(copy.details).toEqual({ retry: true })
    expect(copy.details).not.toBe(error.details)
  })

  it('copies maps, sets, dates, and cyclic references', () => {
    const shared = { label: 'shared' }
    const value: Record<string, unknown> = {
      map: new Map([['key', shared]]),
      set: new Set([shared]),
      date: new Date(0),
      list: [shared, shared],
    }
    value.self = value

    const copy = cloneRuntimeValue(value)
    const copiedShared = (copy.list as unknown[])[0]

    expect(copy).not.toBe(value)
    expect(copy.self).toBe(copy)
    expect(copiedShared).toEqual(shared)
    expect(copiedShared).not.toBe(shared)
    expect((copy.list as unknown[])[1]).toBe(copiedShared)
    expect((copy.map as Map<string, unknown>).get('key')).toBe(copiedShared)
    expect((copy.set as Set<unknown>).has(copiedShared)).toBe(true)
    expect(copy.date).toEqual(new Date(0))
    expect(copy.date).not.toBe(value.date)
    expect(cloneRuntimeValue('text')).toBe('text')
    expect(cloneRuntimeValue(null)).toBeNull()
  })

  it('freezes nested values, maps, and sets in place', () => {
    const value = {
      nested: { list: [{ id: 1 }] },
      map: new Map([['key', { id: 2 }]]),
      set: new Set([{ id: 3 }]),
    }
    const cyclic: Record<string, unknown> = { value }
    ;(value as Record<string, unknown>).cyclic = cyclic

    const frozen = deepFreeze(value)

    expect(frozen).toBe(value)
    expect(Object.isFrozen(value.nested.list[0])).toBe(true)
    expect(Object.isFrozen(cyclic)).toBe(true)
    expect(Object.isFrozen(value.map.get('key'))).toBe(true)
    expect(() => value.map.set('other', { id: 4 })).toThrow(
      'Runtime event snapshots are immutable.',
    )
    expect(() => value.map.clear()).toThrow(TypeError)
    expect(() => value.set.add({ id: 5 })).toThrow('Runtime event snapshots are immutable.')
    expect(() => value.set.delete([...value.set][0]!)).toThrow(TypeError)
    expect(deepFreeze(undefined)).toBeUndefined()
  })
})
