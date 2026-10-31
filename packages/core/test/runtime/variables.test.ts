import { describe, expect, it } from 'vitest'
import { createRuntimeVariableApi, createRuntimeVariableSnapshot } from '../../src/runtime/index'

describe('@node-wright/core/runtime variables', () => {
  it('defaults writes to run scope', () => {
    const snapshot = createRuntimeVariableSnapshot()
    const api = createRuntimeVariableApi(snapshot)

    api.set({ name: 'x' }, 42)

    expect(snapshot.run.x).toBe(42)
    expect(snapshot.graph).toEqual({})
  })

  it('isolates graph, run, and node scopes', () => {
    const snapshot = createRuntimeVariableSnapshot()
    const api = createRuntimeVariableApi(snapshot)

    api.set({ name: 'shared', scope: 'run' }, 'r')
    api.set({ name: 'shared', scope: 'graph' }, 'g')
    api.set({ name: 'shared', scope: 'node', nodeId: 'n1' }, 'n')

    expect(api.get({ name: 'shared', scope: 'run' })).toBe('r')
    expect(api.get({ name: 'shared', scope: 'graph' })).toBe('g')
    expect(api.get({ name: 'shared', scope: 'node', nodeId: 'n1' })).toBe('n')
    expect(api.get({ name: 'shared', scope: 'node', nodeId: 'other' })).toBeUndefined()
  })

  it('has and delete behave consistently', () => {
    const snapshot = createRuntimeVariableSnapshot()
    const api = createRuntimeVariableApi(snapshot)

    api.set({ name: 'k' }, 1)
    expect(api.has({ name: 'k' })).toBe(true)
    expect(api.delete({ name: 'k' })).toBe(true)
    expect(api.has({ name: 'k' })).toBe(false)
    expect(api.delete({ name: 'k' })).toBe(false)
  })

  it('node-scoped write without nodeId throws', () => {
    const api = createRuntimeVariableApi(createRuntimeVariableSnapshot())

    expect(() => api.set({ name: 'k', scope: 'node' }, 1)).toThrow(/nodeId/)
  })

  it('supports custom scope names via "scopes" bucket', () => {
    const snapshot = createRuntimeVariableSnapshot()
    const api = createRuntimeVariableApi(snapshot)

    api.set({ name: 'a', scope: 'session' }, 'value')

    expect(snapshot.scopes.session?.a).toBe('value')
  })

  it('snapshot returns a deep clone — mutations do not leak back', () => {
    const snapshot = createRuntimeVariableSnapshot({ run: { keep: 'me' } })
    const api = createRuntimeVariableApi(snapshot)
    const clone = api.snapshot()

    clone.run.keep = 'changed'

    expect(snapshot.run.keep).toBe('me')
  })

  it('seeds initial values from createRuntimeVariableSnapshot', () => {
    const snapshot = createRuntimeVariableSnapshot({
      run: { greeting: 'hi' },
      graph: { version: 1 },
      nodes: { n1: { local: true } },
    })

    expect(snapshot.run.greeting).toBe('hi')
    expect(snapshot.graph.version).toBe(1)
    expect(snapshot.nodes.n1.local).toBe(true)
  })
})
