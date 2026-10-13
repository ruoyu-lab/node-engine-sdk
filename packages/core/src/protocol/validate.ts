import {
  resolveBasePorts,
  resolveDefinedNodePorts,
  resolveNodeParameterInputPortId,
  resolveNodeParameterInputPorts,
  resolvePortKind,
} from './ports.js'
import type {
  GraphDiagnostic,
  GraphEdge,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  GraphValidationResult,
  NodeDefinition,
  ValidateGraphOptions,
} from './types.js'

/** Structural diagnostics of a typed snapshot, followed by those of `options.providers`. */
export function validateGraph(
  graph: GraphSnapshot,
  options: ValidateGraphOptions = {},
): GraphValidationResult {
  const diagnostics = [
    ...validateGraphStructure(graph, options),
    ...runDiagnosticProviders(graph, options),
  ]

  return createGraphValidationResult(diagnostics)
}

export function createGraphValidationResult(diagnostics: GraphDiagnostic[]): GraphValidationResult {
  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    diagnostics,
  }
}

export function mergeGraphValidationResults(
  ...results: Array<GraphValidationResult | GraphDiagnostic[] | void>
): GraphValidationResult {
  const diagnostics = results.flatMap((result) => {
    if (!result) {
      return []
    }

    return Array.isArray(result) ? result : result.diagnostics
  })

  return createGraphValidationResult(diagnostics)
}

/**
 * The first broken reference of an edge: a missing node or port, or a kind that differs from its
 * source port. Ports are only checked on nodes whose ports are known.
 */
export function getInvalidEdgeDiagnostic(
  edge: GraphEdge,
  edgeIndex: number,
  nodeMap: Map<string, GraphNode>,
  nodeDefinitions: Map<string, NodeDefinition>,
): GraphDiagnostic | undefined {
  const sourceNode = nodeMap.get(edge.source.nodeId)
  const targetNode = nodeMap.get(edge.target.nodeId)

  if (!sourceNode) {
    return {
      code: 'EDGE_SOURCE_NODE_MISSING',
      severity: 'error',
      message: `Edge "${edge.id}" source node "${edge.source.nodeId}" does not exist.`,
      source: 'protocol:structure',
      edgeId: edge.id,
      nodeId: edge.source.nodeId,
      path: `edges.${edgeIndex}.source.nodeId`,
    }
  }

  if (!targetNode) {
    return {
      code: 'EDGE_TARGET_NODE_MISSING',
      severity: 'error',
      message: `Edge "${edge.id}" target node "${edge.target.nodeId}" does not exist.`,
      source: 'protocol:structure',
      edgeId: edge.id,
      nodeId: edge.target.nodeId,
      path: `edges.${edgeIndex}.target.nodeId`,
    }
  }

  const sourcePorts = resolveKnownPorts(sourceNode, nodeDefinitions)
  const sourcePort = sourcePorts?.find((port) => port.id === edge.source.portId)

  if (sourcePorts && !sourcePort) {
    return {
      code: 'EDGE_SOURCE_PORT_MISSING',
      severity: 'error',
      message: `Edge "${edge.id}" source port "${edge.source.portId}" does not exist.`,
      source: 'protocol:structure',
      edgeId: edge.id,
      nodeId: sourceNode.id,
      portId: edge.source.portId,
      path: `edges.${edgeIndex}.source.portId`,
    }
  }

  const targetPorts = resolveKnownPorts(targetNode, nodeDefinitions)

  if (targetPorts && !targetPorts.some((port) => port.id === edge.target.portId)) {
    return {
      code: 'EDGE_TARGET_PORT_MISSING',
      severity: 'error',
      message: `Edge "${edge.id}" target port "${edge.target.portId}" does not exist.`,
      source: 'protocol:structure',
      edgeId: edge.id,
      nodeId: targetNode.id,
      portId: edge.target.portId,
      path: `edges.${edgeIndex}.target.portId`,
    }
  }

  if (sourcePort && resolvePortKind(sourcePort) !== edge.kind) {
    return {
      code: 'EDGE_KIND_MISMATCH',
      severity: 'error',
      message: `Edge "${edge.id}" kind "${edge.kind}" differs from the kind "${resolvePortKind(sourcePort)}" of its source port "${edge.source.portId}".`,
      source: 'protocol:structure',
      edgeId: edge.id,
      nodeId: sourceNode.id,
      portId: edge.source.portId,
      path: `edges.${edgeIndex}.kind`,
    }
  }

  return undefined
}

function validateGraphStructure(
  graph: GraphSnapshot,
  options: ValidateGraphOptions,
): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [...validateNodeDefinitions(options.nodeDefinitions ?? [])]
  const nodeDefinitions = new Map(
    (options.nodeDefinitions ?? []).map((definition) => [definition.type, definition]),
  )
  const edgeDefinitions = new Map(
    (options.edgeDefinitions ?? []).map((definition) => [definition.type, definition]),
  )
  const nodeMap = new Map<string, GraphNode>()

  for (const [index, node] of graph.nodes.entries()) {
    if (nodeMap.has(node.id)) {
      diagnostics.push({
        code: 'NODE_ID_DUPLICATE',
        severity: 'error',
        message: `Node id "${node.id}" is duplicated.`,
        source: 'protocol:structure',
        nodeId: node.id,
        path: `nodes.${index}.id`,
      })
    }

    nodeMap.set(node.id, node)

    if (options.nodeDefinitions && !nodeDefinitions.has(node.type)) {
      diagnostics.push({
        code: 'NODE_TYPE_UNKNOWN',
        severity: 'warning',
        message: `Node type "${node.type}" is not registered.`,
        source: 'protocol:structure',
        nodeId: node.id,
        path: `nodes.${index}.type`,
      })
    }

    diagnostics.push(...validateNodePorts(node, index, nodeDefinitions.get(node.type)))
  }

  diagnostics.push(...validateDuplicateIds(graph.edges, 'EDGE_ID_DUPLICATE', 'edges'))
  diagnostics.push(...validateDuplicateIds(graph.groups, 'GROUP_ID_DUPLICATE', 'groups'))

  for (const [index, edge] of graph.edges.entries()) {
    const issue = getInvalidEdgeDiagnostic(edge, index, nodeMap, nodeDefinitions)

    if (issue) {
      diagnostics.push(issue)
    }

    if (edge.type && options.edgeDefinitions && !edgeDefinitions.has(edge.type)) {
      diagnostics.push({
        code: 'EDGE_TYPE_UNKNOWN',
        severity: 'warning',
        message: `Edge type "${edge.type}" is not registered.`,
        source: 'protocol:structure',
        edgeId: edge.id,
        path: `edges.${index}.type`,
      })
    }
  }

  for (const [groupIndex, group] of graph.groups.entries()) {
    for (const [nodeIndex, nodeId] of (group.nodeIds ?? []).entries()) {
      if (!nodeMap.has(nodeId)) {
        diagnostics.push({
          code: 'GROUP_NODE_MISSING',
          severity: 'error',
          message: `Group "${group.id}" references missing node "${nodeId}".`,
          source: 'protocol:structure',
          groupId: group.id,
          nodeId,
          path: `groups.${groupIndex}.nodeIds.${nodeIndex}`,
        })
      }
    }
  }

  return diagnostics
}

function validateDuplicateIds<T extends { id: string }>(
  items: T[],
  code: string,
  pathPrefix: string,
): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const seen = new Set<string>()

  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      diagnostics.push({
        code,
        severity: 'error',
        message: `${pathPrefix.slice(0, -1)} id "${item.id}" is duplicated.`,
        source: 'protocol:structure',
        edgeId: pathPrefix === 'edges' ? item.id : undefined,
        groupId: pathPrefix === 'groups' ? item.id : undefined,
        path: `${pathPrefix}.${index}.id`,
      })
    }

    seen.add(item.id)
  }

  return diagnostics
}

function validateNodeDefinitions(definitions: NodeDefinition[]): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const types = new Set<string>()

  for (const [definitionIndex, definition] of definitions.entries()) {
    if (types.has(definition.type)) {
      diagnostics.push({
        code: 'NODE_DEFINITION_TYPE_DUPLICATE',
        severity: 'error',
        message: `Node definition type "${definition.type}" is duplicated.`,
        source: 'protocol:structure',
        path: `nodeDefinitions.${definitionIndex}.type`,
      })
    }

    types.add(definition.type)
    const portIds = new Set<string>()

    for (const [portIndex, port] of (definition.ports ?? []).entries()) {
      if (portIds.has(port.id)) {
        diagnostics.push({
          code: 'NODE_DEFINITION_PORT_ID_DUPLICATE',
          severity: 'error',
          message: `Node definition "${definition.type}" has duplicated port id "${port.id}".`,
          source: 'protocol:structure',
          portId: port.id,
          path: `nodeDefinitions.${definitionIndex}.ports.${portIndex}.id`,
        })
      }

      portIds.add(port.id)
    }

    const parameterPortIds = new Set<string>()

    for (const parameter of definition.parameters ?? []) {
      const portId = resolveNodeParameterInputPortId(definition, parameter)

      if (!portId) {
        continue
      }

      if (portIds.has(portId)) {
        diagnostics.push({
          code: 'NODE_PARAMETER_PORT_ID_CONFLICT',
          severity: 'error',
          message: `Node definition "${definition.type}" parameter "${parameter.key}" conflicts with port id "${portId}".`,
          source: 'protocol:structure',
          portId,
          path: `nodeDefinitions.${definitionIndex}.parameters.${parameter.key}.input`,
        })
      } else if (parameterPortIds.has(portId)) {
        diagnostics.push({
          code: 'NODE_PARAMETER_PORT_ID_DUPLICATE',
          severity: 'error',
          message: `Node definition "${definition.type}" has duplicated parameter port id "${portId}".`,
          source: 'protocol:structure',
          portId,
          path: `nodeDefinitions.${definitionIndex}.parameters.${parameter.key}.input`,
        })
      }

      parameterPortIds.add(portId)
    }
  }

  return diagnostics
}

function validateNodePorts(
  node: GraphNode,
  nodeIndex: number,
  definition: NodeDefinition | undefined,
): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const seen = new Set<string>()
  const basePorts = resolveBasePorts(node, definition)

  for (const [portIndex, port] of basePorts.entries()) {
    if (seen.has(port.id)) {
      diagnostics.push({
        code: 'PORT_ID_DUPLICATE',
        severity: 'error',
        message: `Node "${node.id}" has duplicated port id "${port.id}".`,
        source: 'protocol:structure',
        nodeId: node.id,
        portId: port.id,
        path: `nodes.${nodeIndex}.ports.${portIndex}.id`,
      })
    }

    seen.add(port.id)
  }

  if (node.ports?.length) {
    for (const parameterPort of resolveNodeParameterInputPorts(definition)) {
      if (seen.has(parameterPort.id)) {
        diagnostics.push({
          code: 'NODE_PARAMETER_PORT_ID_CONFLICT',
          severity: 'error',
          message: `Node "${node.id}" parameter port id "${parameterPort.id}" conflicts with a node port.`,
          source: 'protocol:structure',
          nodeId: node.id,
          portId: parameterPort.id,
          path: `nodes.${nodeIndex}.ports`,
        })
      }

      seen.add(parameterPort.id)
    }
  }

  return diagnostics
}

/** Ports a node is known to have, or `undefined` when neither the node nor a definition lists any. */
function resolveKnownPorts(
  node: GraphNode,
  nodeDefinitions: Map<string, NodeDefinition>,
): GraphPort[] | undefined {
  const definition = nodeDefinitions.get(node.type)

  if (node.ports === undefined && !definition) {
    return undefined
  }

  return resolveDefinedNodePorts(node, definition)
}

function runDiagnosticProviders(
  graph: GraphSnapshot,
  options: ValidateGraphOptions,
): GraphDiagnostic[] {
  return (options.providers ?? []).flatMap((provider) => {
    const result = provider({
      graph,
      nodeDefinitions: options.nodeDefinitions,
      edgeDefinitions: options.edgeDefinitions,
    })

    if (!result) {
      return []
    }

    return Array.isArray(result) ? result : result.diagnostics
  })
}
