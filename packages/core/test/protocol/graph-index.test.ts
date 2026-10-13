import { describe, expect, it } from 'vitest'
import {
  GraphIndex,
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
  type NodeDefinition,
} from '../../src/protocol/index'

describe('@node-engine-sdk/core/protocol GraphIndex', () => {
  it('looks up nodes, edges, and groups by id across all entity kinds', () => {
    const index = new GraphIndex(createGraph())

    expect(index.nodes.get('a')?.type).toBe('source')
    expect(index.edges.get('a-b')?.target.nodeId).toBe('b')
    expect(index.groups.get('group')?.nodeIds).toEqual(['a', 'b'])
    expect(['a', 'a-b', 'group'].map((id) => index.hasId(id))).toEqual([true, true, true])
    expect(index.hasId('missing')).toBe(false)
  })

  it('lists incoming and outgoing edges per endpoint and per node in graph order', () => {
    const index = new GraphIndex(createGraph())

    expect(index.listIncomingEdges({ nodeId: 'b', portId: 'in' }).map(({ id }) => id)).toEqual([
      'a-b',
      'c-b',
    ])
    expect(index.listOutgoingEdges({ nodeId: 'a', portId: 'out' }).map(({ id }) => id)).toEqual([
      'a-b',
    ])
    expect(index.listNodeOutgoingEdges('a').map(({ id }) => id)).toEqual(['a-b', 'a-c'])
    expect(index.listIncomingEdges({ nodeId: 'a', portId: 'in' })).toEqual([])
    expect(index.countIncoming({ nodeId: 'b', portId: 'in' })).toBe(2)
    expect(index.countIncoming({ nodeId: 'b', portId: 'in' }, 'c-b')).toBe(1)
  })

  it('resolves node ports through definitions, including parameter input ports', () => {
    const definitions: NodeDefinition[] = [
      {
        type: 'source',
        ports: [{ id: 'out', direction: 'output' }],
        parameters: [{ key: 'value', kind: 'number', input: true }],
      },
    ]
    const index = new GraphIndex(createGraph(), definitions)

    expect(index.listPorts('a').map(({ id }) => id)).toEqual(['out', 'field:value'])
    expect(index.getPort({ nodeId: 'a', portId: 'field:value' })?.direction).toBe('input')
    expect(index.getPort({ nodeId: 'b', portId: 'in' })?.direction).toBe('input')
    expect(index.getPort({ nodeId: 'missing', portId: 'in' })).toBeUndefined()
    expect(index.listPorts('missing')).toEqual([])
  })
})

function createGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'a', type: 'source', x: 0, y: 0 },
      {
        id: 'b',
        type: 'target',
        x: 200,
        y: 0,
        ports: [{ id: 'in', direction: 'input' }],
      },
      { id: 'c', type: 'relay', x: 100, y: 100 },
    ],
    edges: [
      {
        id: 'a-b',
        kind: 'data',
        source: { nodeId: 'a', portId: 'out' },
        target: { nodeId: 'b', portId: 'in' },
      },
      {
        id: 'a-c',
        kind: 'data',
        source: { nodeId: 'a', portId: 'other' },
        target: { nodeId: 'c', portId: 'in' },
      },
      {
        id: 'c-b',
        kind: 'data',
        source: { nodeId: 'c', portId: 'out' },
        target: { nodeId: 'b', portId: 'in' },
      },
    ],
    groups: [{ id: 'group', nodeIds: ['a', 'b'], x: 0, y: 0, width: 400, height: 200 }],
    meta: {},
  }
}
