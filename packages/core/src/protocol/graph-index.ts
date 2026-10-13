import { resolveDefinedNodePorts } from './ports.js'
import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  NodeDefinition,
} from './types.js'

interface GraphAdjacency {
  incoming: Map<string, GraphEdge[]>
  outgoing: Map<string, GraphEdge[]>
  outgoingByNode: Map<string, GraphEdge[]>
}

const NO_EDGES: readonly GraphEdge[] = Object.freeze([])

/**
 * Read-only lookup index for one graph snapshot; it never outlives the snapshot that owns it.
 *
 * Id lookups are built eagerly in O(V + E + G). Edge adjacency is built on first use in O(E),
 * and resolved ports are cached per node on first use, so callers that only need id lookups do
 * not pay for adjacency or port resolution.
 */
export class GraphIndex {
  readonly nodes: ReadonlyMap<string, GraphNode>
  readonly edges: ReadonlyMap<string, GraphEdge>
  readonly groups: ReadonlyMap<string, GraphGroup>

  private readonly definitions: ReadonlyMap<string, NodeDefinition>
  private readonly ports = new Map<string, ReadonlyMap<string, GraphPort>>()
  private adjacency?: GraphAdjacency

  constructor(
    readonly graph: GraphSnapshot,
    nodeDefinitions: NodeDefinition[] = [],
  ) {
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]))
    this.edges = new Map(graph.edges.map((edge) => [edge.id, edge]))
    this.groups = new Map(graph.groups.map((group) => [group.id, group]))
    this.definitions = new Map(nodeDefinitions.map((definition) => [definition.type, definition]))
  }

  /** Whether a node, edge, or group already uses the id. */
  hasId(id: string): boolean {
    return this.nodes.has(id) || this.edges.has(id) || this.groups.has(id)
  }

  getPort(endpoint: GraphEndpoint): GraphPort | undefined {
    return this.getNodePorts(endpoint.nodeId)?.get(endpoint.portId)
  }

  listPorts(nodeId: string): GraphPort[] {
    return [...(this.getNodePorts(nodeId)?.values() ?? [])]
  }

  /** Edges whose target is the endpoint, in graph order. */
  listIncomingEdges(endpoint: GraphEndpoint): readonly GraphEdge[] {
    return this.getAdjacency().incoming.get(endpointKey(endpoint)) ?? NO_EDGES
  }

  /** Edges whose source is the endpoint, in graph order. */
  listOutgoingEdges(endpoint: GraphEndpoint): readonly GraphEdge[] {
    return this.getAdjacency().outgoing.get(endpointKey(endpoint)) ?? NO_EDGES
  }

  /** Edges leaving any port of the node, in graph order. */
  listNodeOutgoingEdges(nodeId: string): readonly GraphEdge[] {
    return this.getAdjacency().outgoingByNode.get(nodeId) ?? NO_EDGES
  }

  countIncoming(endpoint: GraphEndpoint, ignoredEdgeId?: string): number {
    const edges = this.listIncomingEdges(endpoint)

    if (!ignoredEdgeId) {
      return edges.length
    }

    return edges.reduce((count, edge) => count + (edge.id === ignoredEdgeId ? 0 : 1), 0)
  }

  private getNodePorts(nodeId: string): ReadonlyMap<string, GraphPort> | undefined {
    const cached = this.ports.get(nodeId)

    if (cached) {
      return cached
    }

    const node = this.nodes.get(nodeId)

    if (!node) {
      return undefined
    }

    const ports = new Map(
      resolveDefinedNodePorts(node, this.definitions.get(node.type)).map((port) => [port.id, port]),
    )

    this.ports.set(nodeId, ports)
    return ports
  }

  private getAdjacency(): GraphAdjacency {
    if (this.adjacency) {
      return this.adjacency
    }

    const adjacency: GraphAdjacency = {
      incoming: new Map(),
      outgoing: new Map(),
      outgoingByNode: new Map(),
    }

    for (const edge of this.graph.edges) {
      append(adjacency.incoming, endpointKey(edge.target), edge)
      append(adjacency.outgoing, endpointKey(edge.source), edge)
      append(adjacency.outgoingByNode, edge.source.nodeId, edge)
    }

    this.adjacency = adjacency
    return adjacency
  }
}

function endpointKey(endpoint: GraphEndpoint): string {
  return `${endpoint.nodeId}\u0000${endpoint.portId}`
}

function append(map: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void {
  const edges = map.get(key)

  if (edges) {
    edges.push(edge)
  } else {
    map.set(key, [edge])
  }
}
