import { cloneValue, resolveNodeParameterInputPortId, resolvePortKind } from '../protocol/index.js'
import type { GraphMetadata, GraphNode, GraphPort } from '../protocol/index.js'
import type { SemanticNodeDefinition } from '../semantics/index.js'
import type { NodeWrightRuntimePortValues } from './types.js'

/*
 * Values a node provides without evaluating the graph: values stored in its data, parameters, and
 * the inputs a subgraph call passes to its input boundary node.
 */

interface ValueLookup {
  found: boolean
  value: unknown
}

const NOT_FOUND: ValueLookup = Object.freeze({ found: false, value: undefined })

/**
 * Handler params of a node: a copy of `data.params`, each parameter read from its `dataPath` or
 * its stored value, and overridden by its parameter input port when that port is connected.
 */
export function resolveNodeParameterValues(
  node: GraphNode,
  definition: SemanticNodeDefinition | undefined,
  values: NodeWrightRuntimePortValues,
  isPortConnected: (portId: string) => boolean,
): NodeWrightRuntimePortValues {
  const storedParams = readStoredParams(node)
  const params: NodeWrightRuntimePortValues = storedParams ? cloneValue(storedParams) : {}

  for (const parameter of definition?.parameters ?? []) {
    const localValue = readParameterValue(node, parameter.key, parameter.dataPath)

    if (localValue.found) {
      params[parameter.key] = localValue.value
    }

    const portId = resolveNodeParameterInputPortId(definition, parameter)

    if (portId && hasOwn(values, portId) && isPortConnected(portId)) {
      params[parameter.key] = values[portId]
    }
  }

  return params
}

/**
 * The stored value of an unconnected input port: looked up by port name, then id, first in
 * `data.params` and then in `data`. `undefined` when the node stores none.
 */
export function readStoredPortValue(node: GraphNode, port: GraphPort): unknown {
  const keys = [port.name ?? port.id, port.id]

  for (const source of [readStoredParams(node), node.data ?? {}]) {
    for (const key of keys) {
      const value = readOwnValue(source, key)

      if (value.found) {
        return value.value
      }
    }
  }

  return undefined
}

/**
 * Output values of a subgraph input boundary node: each data output port reads the call input of
 * the same name, falling back to its id.
 */
export function readSubgraphInputValues(
  ports: GraphPort[],
  inputs: NodeWrightRuntimePortValues | undefined,
): NodeWrightRuntimePortValues {
  const values: NodeWrightRuntimePortValues = {}

  for (const port of ports) {
    if (port.direction === 'output' && resolvePortKind(port) === 'data') {
      const named = readOwnValue(inputs, port.name ?? port.id)
      values[port.id] = named.found ? named.value : readOwnValue(inputs, port.id).value
    }
  }

  return values
}

function readStoredParams(node: GraphNode): Record<string, unknown> | undefined {
  const params = node.data?.params

  return typeof params === 'object' && params ? (params as Record<string, unknown>) : undefined
}

function readParameterValue(
  node: GraphNode,
  key: string,
  dataPath: string | undefined,
): ValueLookup {
  if (dataPath) {
    return readPathValue(node.data, dataPath)
  }

  const params = readStoredParams(node)

  if (params && hasOwn(params, key)) {
    return { found: true, value: params[key] }
  }

  const data: GraphMetadata = node.data ?? {}

  return hasOwn(data, key) ? { found: true, value: data[key] } : NOT_FOUND
}

function readPathValue(source: unknown, path: string): ValueLookup {
  let current = source

  for (const segment of path.split('.').filter(Boolean)) {
    if (!current || typeof current !== 'object') {
      return NOT_FOUND
    }

    const value = readOwnValue(current, segment)

    if (!value.found) {
      return value
    }

    current = value.value
  }

  return { found: true, value: current }
}

function readOwnValue(source: unknown, key: string): ValueLookup {
  if (source && typeof source === 'object' && hasOwn(source, key)) {
    return { found: true, value: (source as Record<string, unknown>)[key] }
  }

  return NOT_FOUND
}

function hasOwn(source: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key)
}
