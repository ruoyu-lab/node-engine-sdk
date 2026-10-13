import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import {
  createConnectionRulesDiagnosticProvider,
  createDataflowConnectionRules,
  hasCycleForKind,
  type SemanticNodeDefinition,
} from '../../src/semantics/index'

describe('@node-engine-sdk/core/semantics large graphs', () => {
  it('detects a cycle in a 5,000-node chain without recursive overflow', () => {
    const size = 5_000
    const graph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: Array.from({ length: size }, (_, index) => ({
        id: `node-${index}`,
        type: 'data',
        x: index,
        y: 0,
      })),
      edges: Array.from({ length: size - 1 }, (_, index) => ({
        id: `edge-${index}`,
        kind: 'data',
        source: { nodeId: `node-${index}`, portId: 'output' },
        target: { nodeId: `node-${index + 1}`, portId: 'input' },
      })),
      groups: [],
      meta: {},
    }

    expect(
      hasCycleForKind(
        graph,
        {
          kind: 'data',
          source: { nodeId: `node-${size - 1}`, portId: 'output' },
          target: { nodeId: 'node-0', portId: 'input' },
        },
        'data',
      ),
    ).toBe(true)
  })

  it('diagnoses a 5,000-node graph with one shared iterative index', () => {
    const size = 5_000
    const definition: SemanticNodeDefinition = {
      type: 'data',
      ports: [
        { id: 'input', direction: 'input', kind: 'data' },
        { id: 'output', direction: 'output', kind: 'data' },
      ],
    }
    const graph: GraphSnapshot = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: Array.from({ length: size }, (_, index) => ({
        id: `node-${index}`,
        type: definition.type,
        x: index,
        y: 0,
      })),
      edges: Array.from({ length: size - 1 }, (_, index) => ({
        id: `edge-${index}`,
        kind: 'data',
        source: { nodeId: `node-${index}`, portId: 'output' },
        target: { nodeId: `node-${index + 1}`, portId: 'input' },
      })),
      groups: [],
      meta: {},
    }
    const provider = createConnectionRulesDiagnosticProvider(createDataflowConnectionRules())

    expect(provider({ graph, nodeDefinitions: [definition] })).toEqual([])
  })
})
