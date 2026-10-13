import * as protocol from '@node-engine-sdk/core/protocol'
import { describe, expect, it } from 'vitest'

describe('@node-engine-sdk/core/protocol API surface', () => {
  it('exports exactly the public protocol values', () => {
    expect(Object.keys(protocol).sort()).toEqual([
      'DEFAULT_PORT_KIND',
      'GraphIndex',
      'GraphParseError',
      'NODE_ENGINE_GRAPH_SCHEMA_VERSION',
      'cloneGraph',
      'cloneValue',
      'createGraphValidationResult',
      'findEdge',
      'findGroup',
      'findNode',
      'findPort',
      'getNodeParameterDefinitions',
      'mergeGraphValidationResults',
      'mergeParameterInputPorts',
      'parseGraph',
      'repairGraph',
      'resolveNodeParameterInput',
      'resolveNodeParameterInputPortId',
      'resolveNodeParameterInputPorts',
      'resolveNodePorts',
      'resolvePortKind',
      'snapshotEquals',
      'validateGraph',
    ])
  })
})
