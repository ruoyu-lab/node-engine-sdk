import { describe, expect, it } from 'vitest'
import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  findEdge,
  findGroup,
  findNode,
  findPort,
  type GraphSnapshot,
  type NodeDefinition,
} from '@node-wright/core/protocol'

const graph: GraphSnapshot = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [
    { id: 'own', type: 'demo', x: 0, y: 0, ports: [{ id: 'out', direction: 'output' }] },
    { id: 'defined', type: 'demo', x: 100, y: 0 },
  ],
  edges: [
    {
      id: 'edge',
      kind: 'data',
      source: { nodeId: 'own', portId: 'out' },
      target: { nodeId: 'defined', portId: 'in' },
    },
  ],
  groups: [{ id: 'group', x: 0, y: 0, width: 200, height: 100, nodeIds: ['own'] }],
  meta: {},
}

const definitions: NodeDefinition[] = [
  {
    type: 'demo',
    ports: [{ id: 'in', direction: 'input' }],
    parameters: [{ key: 'label', kind: 'string', input: true }],
  },
]

describe('@node-wright/core/protocol lookups', () => {
  it('finds nodes, edges, and groups of a snapshot by id', () => {
    expect(findNode(graph, 'own')).toBe(graph.nodes[0])
    expect(findEdge(graph, 'edge')).toBe(graph.edges[0])
    expect(findGroup(graph, 'group')).toBe(graph.groups[0])
    expect([
      findNode(graph, 'missing'),
      findEdge(graph, 'missing'),
      findGroup(graph, 'missing'),
    ]).toEqual([undefined, undefined, undefined])
  })

  it('finds ports declared on the node, by its definition, or as parameter inputs', () => {
    expect(findPort(graph, { nodeId: 'own', portId: 'out' }, definitions)?.direction).toBe('output')
    expect(findPort(graph, { nodeId: 'own', portId: 'in' }, definitions)).toBeUndefined()
    expect(findPort(graph, { nodeId: 'defined', portId: 'in' }, definitions)?.direction).toBe(
      'input',
    )
    expect(
      findPort(graph, { nodeId: 'defined', portId: 'field:label' }, definitions),
    ).toMatchObject({ name: 'label', direction: 'input' })
    expect(findPort(graph, { nodeId: 'defined', portId: 'in' })).toBeUndefined()
    expect(findPort(graph, { nodeId: 'missing', portId: 'in' }, definitions)).toBeUndefined()
  })
})
