import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { applyGraphLayout, layoutGraph } from '../../src/layout/index'

function makeGraph(partial: Partial<GraphSnapshot>): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...partial,
  }
}

describe('@node-engine-sdk/core/layout layoutGraph', () => {
  it('ranks a linear chain by edge depth', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
        { id: 'c', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
        {
          id: 'bc',
          kind: 'data',
          source: { nodeId: 'b', portId: 'out' },
          target: { nodeId: 'c', portId: 'in' },
        },
      ],
    })

    const result = layoutGraph(graph, { direction: 'LR', rankSpacing: 100, origin: { x: 0, y: 0 } })
    const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]))

    expect(byId.a.x).toBe(0)
    expect(byId.b.x).toBe(100)
    expect(byId.c.x).toBe(200)
    expect(byId.a.y).toBe(byId.b.y)
  })

  it('flips axis on RL/BT and swaps main axis on TB', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
    })

    const tb = layoutGraph(graph, { direction: 'TB', rankSpacing: 100, origin: { x: 0, y: 0 } })
    const tbById = Object.fromEntries(tb.nodes.map((n) => [n.id, n]))
    expect(tbById.a.y).toBe(0)
    expect(tbById.b.y).toBe(100)

    const rl = layoutGraph(graph, { direction: 'RL', rankSpacing: 100, origin: { x: 0, y: 0 } })
    const rlById = Object.fromEntries(rl.nodes.map((n) => [n.id, n]))
    expect(rlById.a.x).toBe(0)
    expect(rlById.b.x).toBe(-100)
  })

  it('filters edges by kind so data and exec rank independently', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
        { id: 'c', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'exec',
          source: { nodeId: 'a', portId: 'then' },
          target: { nodeId: 'b', portId: 'in' },
        },
        {
          id: 'cb',
          kind: 'data',
          source: { nodeId: 'c', portId: 'out' },
          target: { nodeId: 'b', portId: 'value' },
        },
      ],
    })

    const result = layoutGraph(graph, {
      direction: 'LR',
      edgeKinds: ['exec'],
      rankSpacing: 100,
      origin: { x: 0, y: 0 },
    })
    const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]))

    expect(byId.a.x).toBe(0)
    expect(byId.b.x).toBe(100)
    expect(byId.c.x).toBe(0)
  })

  it('drops disconnected nodes when includeDisconnected is false', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
        { id: 'orphan', type: 'demo', x: 999, y: 999 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
    })

    const result = layoutGraph(graph, { includeDisconnected: false })

    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('wraps group bounds around its member nodes with padding', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0, width: 100, height: 50 },
        { id: 'b', type: 'demo', x: 0, y: 0, width: 100, height: 50 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
      groups: [{ id: 'g', x: 0, y: 0, width: 0, height: 0, nodeIds: ['a', 'b'] }],
    })

    const result = layoutGraph(graph, {
      direction: 'LR',
      rankSpacing: 200,
      nodeSpacing: 60,
      origin: { x: 0, y: 0 },
      groupPadding: 20,
    })

    expect(result.groups).toHaveLength(1)
    const group = result.groups[0]
    expect(group.x).toBe(-20)
    expect(group.y).toBe(-20)
    expect(group.width).toBeGreaterThan(100)
    expect(group.height).toBeGreaterThan(50)
  })

  it('does not blow up on cycles — every node still receives a rank', () => {
    const graph = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
        {
          id: 'ba',
          kind: 'data',
          source: { nodeId: 'b', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
        },
      ],
    })

    const result = layoutGraph(graph)

    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })
})

describe('@node-engine-sdk/core/layout applyGraphLayout', () => {
  it('writes layout patches back into a graph snapshot without mutating the original', () => {
    const original = makeGraph({
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0 },
        { id: 'b', type: 'demo', x: 0, y: 0 },
      ],
      edges: [
        {
          id: 'ab',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
      ],
    })

    const layout = layoutGraph(original, {
      direction: 'LR',
      rankSpacing: 100,
      origin: { x: 50, y: 50 },
    })
    const updated = applyGraphLayout(original, layout)

    expect(updated.nodes.find((n) => n.id === 'b')?.x).toBe(150)
    expect(original.nodes[1].x).toBe(0)
  })
})
