import { describe, expect, it } from 'vitest'
import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  cloneGraph,
  snapshotEquals,
  type GraphMetadata,
  type GraphSnapshot,
} from '@node-wright/core/protocol'

function createGraph(meta: GraphMetadata = {}): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [{ id: 'a', type: 'demo', x: 0, y: 0, data: { tags: ['x', 'y'] } }],
    edges: [],
    groups: [],
    meta,
  }
}

describe('@node-wright/core/protocol snapshot equality', () => {
  it('compares snapshots structurally', () => {
    const graph = createGraph({ nested: { list: [1, { deep: true }] } })

    expect(snapshotEquals(graph, cloneGraph(graph))).toBe(true)
    expect(snapshotEquals(graph, createGraph({ nested: { list: [1, { deep: false }] } }))).toBe(
      false,
    )
    expect(snapshotEquals(graph, createGraph({ nested: { list: [1] } }))).toBe(false)
    expect(snapshotEquals(graph, createGraph({ nested: { list: { 0: 1 } } }))).toBe(false)
    expect(snapshotEquals(graph, createGraph({ nested: null }))).toBe(false)
    expect(snapshotEquals(createGraph({ a: 1 }), createGraph({ b: 1 }))).toBe(false)
    expect(snapshotEquals(createGraph({ a: 1 }), createGraph({ a: 1, b: 2 }))).toBe(false)
  })

  it('compares deeply nested metadata without recursion', () => {
    const deep = (): GraphMetadata => {
      let value: GraphMetadata = { leaf: true }

      for (let depth = 0; depth < 20_000; depth += 1) {
        value = { child: value }
      }

      return value
    }

    expect(snapshotEquals(createGraph(deep()), createGraph(deep()))).toBe(true)
  })
})
