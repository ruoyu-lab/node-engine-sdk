import { describe, expect, it } from 'vitest'
import type { GraphNode, GraphPort } from '@node-engine-sdk/core/protocol'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'
import {
  readStoredPortValue,
  readSubgraphInputValues,
  resolveNodeParameterValues,
} from '../../src/runtime/node-values'

const definition: SemanticNodeDefinition = {
  type: 'demo',
  parameters: [
    { key: 'prompt', kind: 'string', input: true },
    { key: 'steps', kind: 'number', input: { portId: 'steps-in' } },
    { key: 'seed', kind: 'number', dataPath: 'settings.seed' },
    { key: 'mode', kind: 'string' },
    { key: 'missing', kind: 'string', dataPath: 'settings.none.deeper' },
  ],
}

function node(data: GraphNode['data']): GraphNode {
  return { id: 'node', type: 'demo', x: 0, y: 0, data }
}

describe('@node-engine-sdk/core/runtime node values', () => {
  it('reads parameters from params, data paths, and data, and lets connected inputs win', () => {
    const params = { prompt: 'stored prompt', steps: 4, extra: { nested: true } }
    const source = node({ params, settings: { seed: 7 }, mode: 'fast' })
    const connected = new Set(['field:prompt'])

    const resolved = resolveNodeParameterValues(
      source,
      definition,
      { 'field:prompt': 'connected prompt', 'steps-in': 12 },
      (portId) => connected.has(portId),
    )

    expect(resolved).toEqual({
      prompt: 'connected prompt',
      steps: 4,
      extra: { nested: true },
      seed: 7,
      mode: 'fast',
    })
    expect(resolved.extra).not.toBe(params.extra)
  })

  it('returns an empty record for a node without stored params or parameters', () => {
    expect(resolveNodeParameterValues(node(undefined), undefined, {}, () => true)).toEqual({})
  })

  it('reads a stored port value by name, then id, from params before data', () => {
    const port: GraphPort = { id: 'port-id', name: 'portName', direction: 'input' }

    expect(readStoredPortValue(node({ params: { 'port-id': 1 }, portName: 2 }), port)).toBe(1)
    expect(readStoredPortValue(node({ params: { portName: 1, 'port-id': 2 } }), port)).toBe(1)
    expect(readStoredPortValue(node({ 'port-id': 3 }), port)).toBe(3)
    expect(readStoredPortValue(node({ params: 'not a record' }), port)).toBeUndefined()
  })

  it('maps subgraph call inputs onto the data outputs of the input boundary node', () => {
    const ports: GraphPort[] = [
      { id: 'a', name: 'alpha', direction: 'output', kind: 'data' },
      { id: 'b', direction: 'output' },
      { id: 'c', name: 'gamma', direction: 'output' },
      { id: 'next', direction: 'output', kind: 'exec' },
      { id: 'in', direction: 'input', kind: 'data' },
    ]

    expect(readSubgraphInputValues(ports, { alpha: 1, a: 'ignored', b: 2, c: 3 })).toEqual({
      a: 1,
      b: 2,
      c: 3,
    })
    expect(readSubgraphInputValues(ports, undefined)).toEqual({
      a: undefined,
      b: undefined,
      c: undefined,
    })
  })
})
