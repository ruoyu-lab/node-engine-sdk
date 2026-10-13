import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphEdge,
  type GraphGroup,
  type GraphMetadata,
  type GraphNode,
  type GraphPort,
  type GraphSnapshot,
  type XYPosition,
} from '@node-engine-sdk/core/protocol'

/** Builders shared by the primitive scenario graphs; every scenario node shows its title. */

export interface PrimitiveNodeOptions {
  title: string
  position: XYPosition
  width: number
  height: number
  params?: GraphMetadata
  ports?: GraphPort[]
}

export type PortEndpoint = readonly [nodeId: string, portId: string]

export function primitiveNode(id: string, type: string, options: PrimitiveNodeOptions): GraphNode {
  return {
    id,
    type,
    x: options.position.x,
    y: options.position.y,
    width: options.width,
    height: options.height,
    ...(options.ports ? { ports: options.ports } : {}),
    data: options.params
      ? { title: options.title, params: options.params }
      : { title: options.title },
  }
}

/** An edge between data ports; its kind matches the data source port. */
export function dataEdge(id: string, source: PortEndpoint, target: PortEndpoint): GraphEdge {
  return edge(id, 'data', source, target)
}

/** An edge between execution ports; its kind matches the exec source port. */
export function execEdge(id: string, source: PortEndpoint, target: PortEndpoint): GraphEdge {
  return edge(id, 'exec', source, target)
}

export function groupOf(
  id: string,
  label: string,
  bounds: { x: number; y: number; width: number; height: number },
  nodes: readonly GraphNode[],
): GraphGroup {
  return { id, label, ...bounds, nodeIds: nodes.map((node) => node.id) }
}

export function snapshotOf(
  meta: GraphMetadata,
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups: GraphGroup[] = [],
): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes,
    edges,
    groups,
    meta,
  }
}

function edge(id: string, kind: string, source: PortEndpoint, target: PortEndpoint): GraphEdge {
  return {
    id,
    kind,
    source: { nodeId: source[0], portId: source[1] },
    target: { nodeId: target[0], portId: target[1] },
  }
}
