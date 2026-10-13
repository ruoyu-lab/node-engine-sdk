import { describe, expect, it, vi } from 'vitest'
import { batch, computed, effect, signal, untracked } from '../../src/view/reactive'

describe('editor signal graph', () => {
  it('derives lazily, caches results and keeps identity until a source changes', () => {
    const count = signal(1)
    const compute = vi.fn(() => ({ doubled: count.value * 2 }))
    const doubled = computed(compute)

    expect(compute).not.toHaveBeenCalled()

    const first = doubled.value
    expect(first).toEqual({ doubled: 2 })
    expect(doubled.value).toBe(first)
    expect(compute).toHaveBeenCalledOnce()

    count.value = 1
    expect(doubled.value).toBe(first)

    count.value = 2
    expect(doubled.value).toEqual({ doubled: 4 })
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it('skips dependents when an intermediate result is unchanged', () => {
    const value = signal(3)
    const parity = computed(() => value.value % 2)
    const label = vi.fn(() => (parity.value ? 'odd' : 'even'))
    const described = computed(label)

    expect(described.value).toBe('odd')

    value.value = 5
    expect(described.value).toBe('odd')
    expect(label).toHaveBeenCalledOnce()
  })

  it('evaluates diamond dependencies once per change', () => {
    const source = signal(1)
    const left = computed(() => source.value + 1)
    const right = computed(() => source.value * 10)
    const join = vi.fn(() => left.value + right.value)
    const total = computed(join)
    const seen: number[] = []
    const stop = effect(() => {
      seen.push(total.value)
    })

    source.value = 2

    expect(seen).toEqual([12, 23])
    expect(join).toHaveBeenCalledTimes(2)
    stop()
  })

  it('runs effects after the outermost batch and stops after disposal', () => {
    const first = signal('a')
    const second = signal('b')
    const run = vi.fn(() => `${first.value}${second.value}`)
    const stop = effect(() => {
      run()
    })

    batch(() => {
      first.value = 'x'
      batch(() => {
        second.value = 'y'
      })
      expect(run).toHaveBeenCalledOnce()
    })

    expect(run).toHaveBeenCalledTimes(2)

    stop()
    first.value = 'z'
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('tracks only dependencies read in the latest run', () => {
    const toggle = signal(true)
    const left = signal(1)
    const right = signal(2)
    const read = computed(() => (toggle.value ? left.value : right.value))
    const run = vi.fn(() => read.value)
    const stop = effect(() => {
      run()
    })

    toggle.value = false
    left.value = 10
    expect(run).toHaveBeenCalledTimes(2)

    right.value = 20
    expect(run).toHaveBeenCalledTimes(3)
    stop()
  })

  it('does not track reads inside untracked or peek', () => {
    const tracked = signal(1)
    const ignored = signal(1)
    const run = vi.fn(() => tracked.value + untracked(() => ignored.value) + ignored.peek())
    const stop = effect(() => {
      run()
    })

    ignored.value = 2
    expect(run).toHaveBeenCalledOnce()

    tracked.value = 2
    expect(run).toHaveBeenCalledTimes(2)
    stop()
  })

  it('reports cyclic computeds and effect failures', () => {
    const cycle: { value: number } = computed((): number => cycle.value + 1)
    expect(() => cycle.value).toThrow(/Cyclic/u)

    const trigger = signal(0)
    const stop = effect(() => {
      if (trigger.value > 0) {
        throw new Error('effect failed')
      }
    })

    expect(() => {
      trigger.value = 1
    }).toThrow('effect failed')
    stop()
  })

  it('recomputes after a failed computation instead of caching the failure', () => {
    const input = signal(0)
    const guarded = computed(() => {
      if (input.value === 0) {
        throw new Error('not ready')
      }

      return input.value
    })

    expect(() => guarded.value).toThrow('not ready')

    input.value = 4
    expect(guarded.value).toBe(4)
  })
})
