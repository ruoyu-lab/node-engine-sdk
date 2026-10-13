import { resolveNodePorts } from './ports.js'
import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  NodeDefinition,
} from './types.js'

/*
 * Linear lookups on a snapshot. Callers that query the same snapshot repeatedly use `GraphIndex`.
 */

export function findNode(graph: GraphSnapshot, nodeId: string): GraphNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId)
}

export function findEdge(graph: GraphSnapshot, edgeId: string): GraphEdge | undefined {
  return graph.edges.find((edge) => edge.id === edgeId)
}

export function findGroup(graph: GraphSnapshot, groupId: string): GraphGroup | undefined {
  return graph.groups.find((group) => group.id === groupId)
}

export function findPort(
  graph: GraphSnapshot,
  endpoint: GraphEndpoint,
  definitions: NodeDefinition[] = [],
): GraphPort | undefined {
  const node = findNode(graph, endpoint.nodeId)

  if (!node) {
    return undefined
  }

  return resolveNodePorts(node, definitions).find((port) => port.id === endpoint.portId)
}
