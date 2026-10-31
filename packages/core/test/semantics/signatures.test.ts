import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import { compileGraph } from '@node-wright/core/runtime'
import {
  createFunctionDefinition,
  createSubgraphDefinition,
  validateFunctionSignature,
  validateSubgraphSignature,
} from '@node-wright/core/semantics'

const emptyGraph: GraphSnapshot = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  groups: [],
  meta: {},
}

describe('function and subgraph signatures', () => {
  it('accepts unique input and output ids', () => {
    expect(
      validateFunctionSignature({
        id: 'format',
        inputs: [{ id: 'value' }],
        outputs: [{ id: 'text' }],
      }),
    ).toEqual([])
    expect(validateSubgraphSignature({ id: 'wrap' })).toEqual([])
  })

  it('locates an output that reuses an input id, because both become call node ports', () => {
    expect(
      validateFunctionSignature(
        { id: 'format', inputs: [{ id: 'value' }], outputs: [{ id: 'value' }] },
        'functionDefinitions.2',
      ),
    ).toEqual([
      {
        code: 'FUNCTION_SIGNATURE_PORT_ID_DUPLICATE',
        severity: 'error',
        message:
          'Function "format" output "value" reuses the port id of input 0; inputs and outputs become ports of one call node and need unique ids.',
        source: 'semantics:function-signature',
        portId: 'value',
        path: 'functionDefinitions.2.outputs.0.id',
      },
    ])
    expect(
      validateSubgraphSignature({
        id: 'wrap',
        inputs: [{ id: 'a' }, { id: 'b' }, { id: 'a' }],
        outputs: [{ id: 'b' }],
      }).map(({ code, path }) => [code, path]),
    ).toEqual([
      ['SUBGRAPH_SIGNATURE_PORT_ID_DUPLICATE', 'inputs.2.id'],
      ['SUBGRAPH_SIGNATURE_PORT_ID_DUPLICATE', 'outputs.0.id'],
    ])
  })

  it('reserves the execution port ids of the call node', () => {
    expect(
      validateFunctionSignature({ id: 'format', inputs: [{ id: 'exec:in' }] }).map(
        ({ code, path }) => [code, path],
      ),
    ).toEqual([['FUNCTION_SIGNATURE_PORT_ID_RESERVED', 'inputs.0.id']])
  })

  it('rejects invalid signatures when definitions are created', () => {
    expect(() =>
      createFunctionDefinition({ id: ' format ', inputs: [{ id: 'x' }], outputs: [{ id: 'x' }] }),
    ).toThrow(
      'Function "format" has an invalid signature:\n- outputs.0.id: Function "format" output "x" reuses the port id of input 0',
    )
    expect(() =>
      createSubgraphDefinition({
        id: 'wrap',
        graph: emptyGraph,
        inputs: [{ id: 'x' }],
        outputs: [{ id: 'x' }],
      }),
    ).toThrow('Subgraph "wrap" has an invalid signature:\n- outputs.0.id:')
  })

  it('reports registered signatures before a run when compiling', () => {
    const compiled = compileGraph({
      graph: { ...emptyGraph, nodes: [{ id: 'start', type: 'start', x: 0, y: 0 }] },
      entryNodeId: 'start',
      definitions: [{ type: 'start' }],
      handlers: { start: () => undefined },
      functionDefinitions: [
        { id: 'ok', outputs: [{ id: 'result' }] },
        { id: 'broken', inputs: [{ id: 'value' }], outputs: [{ id: 'value' }] },
      ],
      subgraphDefinitions: [
        { id: 'wrap', graph: emptyGraph, inputs: [{ id: 'x' }], outputs: [{ id: 'x' }] },
      ],
    })

    expect(compiled.valid).toBe(false)
    expect(compiled.diagnostics.map(({ code, path }) => [code, path])).toEqual([
      ['FUNCTION_SIGNATURE_PORT_ID_DUPLICATE', 'functionDefinitions.1.outputs.0.id'],
      ['SUBGRAPH_SIGNATURE_PORT_ID_DUPLICATE', 'subgraphDefinitions.0.outputs.0.id'],
    ])
  })
})
