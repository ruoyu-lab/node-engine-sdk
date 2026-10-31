import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } from '@node-wright/core/protocol'
import type { GraphSnapshot, GraphStoreEvent } from '@node-wright/core/protocol'
import { GraphStore } from '../../src/store/index'

function createStore(): { store: GraphStore; events: GraphStoreEvent['type'][] } {
  const store = new GraphStore({
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
    edges: [],
    groups: [],
    meta: {},
  })
  const events: GraphStoreEvent['type'][] = []

  store.subscribe((event) => events.push(event.type))

  return { store, events }
}

function nodeIds(snapshot: GraphSnapshot): string[] {
  return snapshot.nodes.map((node) => node.id)
}

describe('@node-wright/core/store transactions', () => {
  it('commits one undoable entry with the transaction label and source', () => {
    const { store, events } = createStore()
    const commits: GraphStoreEvent[] = []
    store.subscribe((event) => {
      if (event.type === 'history:commit') {
        commits.push(event)
      }
    })

    store.transaction(
      'Add two nodes',
      () => {
        store.addNode({ id: 'b', type: 'demo', x: 100, y: 0 })
        store.addNode({ id: 'c', type: 'demo', x: 200, y: 0 })
      },
      { source: 'test' },
    )

    expect(events).toEqual(['history:commit', 'graph:changed'])
    expect(commits[0]).toMatchObject({ source: 'test', entry: { label: 'Add two nodes' } })
    expect(nodeIds(store.undo())).toEqual(['a'])
    expect(store.canUndo).toBe(false)
  })

  it('commits nothing when the transaction leaves the graph unchanged', () => {
    const { store, events } = createStore()

    store.transaction('Round trip', () => {
      store.moveNodes(['a'], { x: 10, y: 0 })
      store.moveNodes(['a'], { x: -10, y: 0 })
    })

    expect(events).toEqual([])
    expect(store.canUndo).toBe(false)
  })

  it('fails and rolls back when a command inside it is rejected', () => {
    const { store, events } = createStore()

    expect(() =>
      store.transaction('Partial', () => {
        store.addNode({ id: 'b', type: 'demo', x: 100, y: 0 })
        store.dispatchCommand('missing.command')
      }),
    ).toThrow('Command "missing.command" is not registered.')

    expect(nodeIds(store.getSnapshot())).toEqual(['a'])
    expect(events).toEqual([])
  })

  it('rejects nested and asynchronous transactions and restores the graph', () => {
    const { store } = createStore()

    expect(() =>
      store.transaction('Outer', () => {
        store.addNode({ id: 'b', type: 'demo', x: 100, y: 0 })
        store.transaction('Inner', () => undefined)
      }),
    ).toThrow('Nested graph transactions are not supported.')
    expect(nodeIds(store.getSnapshot())).toEqual(['a'])

    expect(() =>
      store.transaction('Async', (async () => {
        store.addNode({ id: 'c', type: 'demo', x: 200, y: 0 })
      }) as () => void),
    ).toThrow('Graph transactions must be synchronous.')
    expect(nodeIds(store.getSnapshot())).toEqual(['a'])
  })

  it('refuses history and whole-graph writes inside a transaction', () => {
    const { store } = createStore()
    const graph = store.getSnapshot()
    const writes: Array<[string, () => unknown]> = [
      ['undo history', () => store.undo()],
      ['redo history', () => store.redo()],
      ['replace a graph', () => store.replaceGraph(graph)],
      ['apply a graph', () => store.applyGraph(graph)],
      ['repair a graph', () => store.repairGraph()],
    ]

    for (const [operation, write] of writes) {
      expect(() => store.transaction(operation, write)).toThrow(
        `Cannot ${operation} inside a graph transaction.`,
      )
    }

    expect(store.canUndo).toBe(false)
  })
})
