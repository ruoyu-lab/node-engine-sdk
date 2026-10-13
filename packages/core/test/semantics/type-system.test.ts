import { describe, expect, it } from 'vitest'
import { GraphStore } from '@node-engine-sdk/core/store'
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import {
  createDataflowPlugin,
  isValueTypeCompatible,
  resolvePortAcceptedValueTypes,
  resolvePortValueType,
  validateValueType,
  type SemanticNodeDefinition,
  type ValueTypeSchema,
} from '../../src/semantics/index'

describe('@node-engine-sdk/core/semantics capacity and value types', () => {
  it('uses the shared incoming-edge index for capacity diagnostics', () => {
    const definitions: SemanticNodeDefinition[] = [
      {
        type: 'source',
        ports: [{ id: 'out', direction: 'output', kind: 'data' }],
      },
      {
        type: 'target',
        ports: [
          {
            id: 'in',
            direction: 'input',
            kind: 'data',
            capacity: 1,
          },
        ],
      },
    ]
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'a', type: 'source', x: 0, y: 0 },
          { id: 'b', type: 'source', x: 0, y: 100 },
          { id: 'target', type: 'target', x: 200, y: 0 },
        ],
        edges: [
          {
            id: 'a-target',
            kind: 'data',
            source: { nodeId: 'a', portId: 'out' },
            target: { nodeId: 'target', portId: 'in' },
          },
          {
            id: 'b-target',
            kind: 'data',
            source: { nodeId: 'b', portId: 'out' },
            target: { nodeId: 'target', portId: 'in' },
          },
        ],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions: definitions,
        plugins: [createDataflowPlugin({ preventCycles: false })],
      },
    )

    expect(
      store
        .listDiagnostics()
        .filter((diagnostic) => diagnostic.code === 'TARGET_PORT_CAPACITY_REACHED')
        .map((diagnostic) => diagnostic.edgeId)
        .sort(),
    ).toEqual(['a-target', 'b-target'])
  })

  it('checks structured assignability and reports nested validation paths', () => {
    const source: ValueTypeSchema = {
      kind: 'object',
      properties: {
        id: 'string',
        count: 'integer',
      },
      required: ['id', 'count'],
    }
    const target: ValueTypeSchema = {
      kind: 'object',
      properties: {
        id: 'string',
        count: 'number',
      },
      required: ['id'],
    }

    expect(isValueTypeCompatible(source, target)).toBe(true)
    expect(isValueTypeCompatible({ kind: 'object', properties: { count: 'number' } }, target)).toBe(
      false,
    )
    expect(
      validateValueType(
        { id: 'ok', values: [1, 'bad'] },
        {
          kind: 'object',
          required: ['id', 'values'],
          properties: {
            id: 'string',
            values: { kind: 'array', items: 'number' },
          },
        },
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'VALUE_TYPE_MISMATCH',
        path: '$.values[1]',
        actual: 'string',
      }),
    ])
  })

  it('uses one structured port type entry and top-level accepts', () => {
    const port = {
      id: 'payload',
      direction: 'input' as const,
      dataType: 'object',
      accepts: ['record', 'record'],
      data: {
        type: {
          kind: 'object',
          required: ['id'],
          properties: { id: 'string' },
        },
      },
      meta: {
        type: 'string',
        accepts: ['string'],
      },
    }

    expect(resolvePortValueType(port)).toEqual(port.data.type)
    expect(resolvePortAcceptedValueTypes(port)).toEqual(['record'])
  })
})
