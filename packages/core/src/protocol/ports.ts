import {
  DEFAULT_PORT_KIND,
  type GraphNode,
  type GraphPort,
  type NodeDefinition,
  type NodeParameterDefinition,
  type NodeParameterInputDefinition,
  type NodeParameterKind,
} from './types.js'
import { cloneValue } from './values.js'

/**
 * Ports of a node: its own ports, or those of its definition when it declares none, followed by
 * the definition's parameter input ports.
 */
export function resolveNodePorts(node: GraphNode, definitions: NodeDefinition[] = []): GraphPort[] {
  return resolveDefinedNodePorts(
    node,
    definitions.find((entry) => entry.type === node.type),
  )
}

/** `resolveNodePorts` for a node whose definition is already known. */
export function resolveDefinedNodePorts(
  node: GraphNode,
  definition: NodeDefinition | undefined,
): GraphPort[] {
  return mergeParameterInputPorts(resolveBasePorts(node, definition), definition)
}

/** Ports declared on the node, falling back to the definition's ports. */
export function resolveBasePorts(
  node: GraphNode,
  definition: NodeDefinition | undefined,
): GraphPort[] {
  return node.ports?.length ? node.ports : (definition?.ports ?? [])
}

/** The kind of a port, `DEFAULT_PORT_KIND` when it declares none. */
export function resolvePortKind(port: Pick<GraphPort, 'kind'>): string {
  return port.kind ?? DEFAULT_PORT_KIND
}

export function getNodeParameterDefinitions(
  definition: NodeDefinition | undefined,
): NodeParameterDefinition[] {
  return definition?.parameters ?? []
}

export function resolveNodeParameterInputPorts(
  definition: NodeDefinition | undefined,
): GraphPort[] {
  if (!definition) {
    return []
  }

  return (definition.parameters ?? []).flatMap((parameter) => {
    const input = resolveNodeParameterInput(definition, parameter)

    return input ? [parameterToInputPort(parameter, input)] : []
  })
}

export function mergeParameterInputPorts(
  ports: GraphPort[],
  definition: NodeDefinition | undefined,
): GraphPort[] {
  const basePorts = cloneValue(ports)
  const parameterPorts = resolveNodeParameterInputPorts(definition)

  return [...basePorts, ...parameterPorts]
}

export function resolveNodeParameterInput(
  definition: NodeDefinition | undefined,
  parameter: NodeParameterDefinition,
): NodeParameterInputDefinition | null {
  const policy = parameter.input

  if (policy === false) {
    return null
  }

  if (policy === true) {
    return {}
  }

  if (policy && typeof policy === 'object') {
    return policy.enabled === false ? null : policy
  }

  return definition?.parameterInputs === true ? {} : null
}

export function resolveNodeParameterInputPortId(
  definition: NodeDefinition | undefined,
  parameter: NodeParameterDefinition,
): string | undefined {
  const input = resolveNodeParameterInput(definition, parameter)

  return input ? parameterInputPortId(parameter, input) : undefined
}

function parameterInputPortId(
  parameter: NodeParameterDefinition,
  input: NodeParameterInputDefinition,
): string {
  return input.portId ?? `field:${parameter.key}`
}

function parameterToInputPort(
  parameter: NodeParameterDefinition,
  input: NodeParameterInputDefinition,
): GraphPort {
  return {
    id: parameterInputPortId(parameter, input),
    name: parameter.key,
    label: input.label ?? parameter.label ?? parameter.key,
    direction: 'input',
    kind: input.kind ?? DEFAULT_PORT_KIND,
    side: input.side ?? 'left',
    capacity: input.capacity ?? 1,
    required: input.required ?? false,
    dataType: input.dataType ?? parameterKindToPortDataType(parameter.kind),
    accepts: input.accepts,
    data: {
      ...(input.data ?? {}),
      parameter: true,
      parameterKey: parameter.key,
    },
    meta: input.meta,
  }
}

function parameterKindToPortDataType(kind: NodeParameterKind): string {
  switch (kind) {
    case 'string':
    case 'code':
    case 'file':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'json':
    case 'select':
    default:
      return 'any'
  }
}
