import {
  GraphIndex,
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  cloneGraph,
  cloneValue,
  resolveNodePorts,
} from '../protocol/index.js'
import type {
  GraphEdge,
  GraphEndpoint,
  GraphGroup,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  NodeDefinition,
} from '../protocol/index.js'

/**
 * The committed graph and its lookup index, rebuilt together on every replacement. Queries return
 * detached copies; `current` is the committed snapshot itself and must never be mutated.
 */
export class GraphState {
  private snapshot: GraphSnapshot
  private index: GraphIndex

  constructor(graph?: GraphSnapshot) {
    this.snapshot = graph ? cloneGraph(graph) : createEmptyGraph()
    this.index = new GraphIndex(this.snapshot)
  }

  get current(): GraphSnapshot {
    return this.snapshot
  }

  replace(graph: GraphSnapshot): void {
    this.snapshot = graph
    this.index = new GraphIndex(graph)
  }

  detach(): GraphSnapshot {
    return cloneGraph(this.snapshot)
  }

  getNode(nodeId: string): GraphNode | undefined {
    return cloneDefined(this.index.nodes.get(nodeId))
  }

  getEdge(edgeId: string): GraphEdge | undefined {
    return cloneDefined(this.index.edges.get(edgeId))
  }

  getGroup(groupId: string): GraphGroup | undefined {
    return cloneDefined(this.index.groups.get(groupId))
  }

  listGroups(): GraphGroup[] {
    return cloneValue(this.snapshot.groups)
  }

  getPort(
    endpoint: GraphEndpoint,
    getDefinition: (type: string) => NodeDefinition | undefined,
  ): GraphPort | undefined {
    const node = this.index.nodes.get(endpoint.nodeId)

    return cloneDefined(resolveEndpointPort(node, endpoint.portId, getDefinition))
  }

  /** Whether a node, edge, or group of the committed graph uses the id. */
  hasId(id: string): boolean {
    return this.index.hasId(id)
  }
}

/** The port `portId` of `node`, resolved through the definition registered for its type. */
export function resolveEndpointPort(
  node: GraphNode | undefined,
  portId: string,
  getDefinition: (type: string) => NodeDefinition | undefined,
): GraphPort | undefined {
  if (!node) {
    return undefined
  }

  const definition = getDefinition(node.type)

  return resolveNodePorts(node, definition ? [definition] : []).find((port) => port.id === portId)
}

/** Default id factory: `prefix-N` from a per-store counter, skipping ids the graph already uses. */
export function createSequentialIdFactory(
  hasId: (id: string) => boolean,
): (prefix?: string) => string {
  let sequence = 0

  return (prefix = 'id') => {
    let candidate = `${prefix}-${++sequence}`

    while (hasId(candidate)) {
      candidate = `${prefix}-${++sequence}`
    }

    return candidate
  }
}

function createEmptyGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
  }
}

function cloneDefined<T>(value: T | undefined): T | undefined {
  return value ? cloneValue(value) : undefined
}
