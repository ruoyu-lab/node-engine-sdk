import {
  GraphIndex,
  type GraphEdge,
  type GraphEndpoint,
  type GraphNode,
  type GraphSnapshot,
} from '../protocol/index.js'
import type { EdgeKind } from './types.js'

/**
 * Cyclic edge ids per index and per edge `kind`. The cache lives exactly as long as
 * the index, so diagnosing every edge of a graph runs the O(V + E) strongly connected component
 * pass once per edge kind instead of once per edge.
 */
const cyclicEdgeCache = new WeakMap<GraphIndex, Map<string, ReadonlySet<string>>>()

/**
 * Whether adding `edge` (or keeping the existing `ignoredEdgeId` edge) closes a cycle among edges
 * of `kind`. New connections use an iterative O(V + E) reachability walk.
 */
export function wouldCreateCycle(
  index: GraphIndex,
  edge: Pick<GraphEdge, 'source' | 'target'>,
  kind: EdgeKind,
  ignoredEdgeId?: string,
): boolean {
  if (ignoredEdgeId) {
    const existing = index.edges.get(ignoredEdgeId)

    if (
      existing &&
      sameEndpoint(existing.source, edge.source) &&
      sameEndpoint(existing.target, edge.target) &&
      existing.kind === kind
    ) {
      return getCyclicEdgeIds(index, kind).has(ignoredEdgeId)
    }
  }

  if (edge.source.nodeId === edge.target.nodeId) {
    return true
  }

  const visited = new Set([edge.target.nodeId])
  const stack = [edge.target.nodeId]

  while (stack.length > 0) {
    const nodeId = stack.pop()!

    for (const outgoing of index.listNodeOutgoingEdges(nodeId)) {
      if (outgoing.id === ignoredEdgeId || outgoing.kind !== kind) {
        continue
      }

      const nextNodeId = outgoing.target.nodeId

      if (nextNodeId === edge.source.nodeId) {
        return true
      }

      if (!visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        stack.push(nextNodeId)
      }
    }
  }

  return false
}

export function hasCycleForKind(
  graph: GraphSnapshot,
  edge: Pick<GraphEdge, 'source' | 'target'>,
  kind: EdgeKind,
): boolean {
  return wouldCreateCycle(new GraphIndex(graph), edge, kind)
}

function getCyclicEdgeIds(index: GraphIndex, kind: EdgeKind): ReadonlySet<string> {
  let cache = cyclicEdgeCache.get(index)

  if (!cache) {
    cache = new Map()
    cyclicEdgeCache.set(index, cache)
  }

  const cached = cache.get(kind)

  if (cached) {
    return cached
  }

  const { graph } = index
  const matchingEdges = graph.edges.filter((edge) => edge.kind === kind)
  const adjacency = createAdjacency(graph.nodes, matchingEdges, false)
  const reverse = createAdjacency(graph.nodes, matchingEdges, true)
  const order = createFinishingOrder(graph.nodes, adjacency)
  const componentByNode = new Map<string, number>()
  const componentSizes: number[] = []

  for (const start of order.slice().reverse()) {
    if (componentByNode.has(start)) {
      continue
    }

    const componentId = componentSizes.length
    let size = 0
    const stack = [start]
    componentByNode.set(start, componentId)

    while (stack.length > 0) {
      const nodeId = stack.pop()!
      size += 1

      for (const nextNodeId of reverse.get(nodeId) ?? []) {
        if (!componentByNode.has(nextNodeId)) {
          componentByNode.set(nextNodeId, componentId)
          stack.push(nextNodeId)
        }
      }
    }

    componentSizes.push(size)
  }

  const result = new Set<string>()

  for (const edge of matchingEdges) {
    const sourceComponent = componentByNode.get(edge.source.nodeId)
    const targetComponent = componentByNode.get(edge.target.nodeId)
    const componentSize =
      sourceComponent === undefined ? undefined : componentSizes[sourceComponent]

    if (
      sourceComponent !== undefined &&
      sourceComponent === targetComponent &&
      componentSize !== undefined &&
      (componentSize > 1 || edge.source.nodeId === edge.target.nodeId)
    ) {
      result.add(edge.id)
    }
  }

  cache.set(kind, result)
  return result
}

function sameEndpoint(left: GraphEndpoint, right: GraphEndpoint): boolean {
  return left.nodeId === right.nodeId && left.portId === right.portId
}

function createAdjacency(
  nodes: GraphNode[],
  edges: GraphEdge[],
  reverse: boolean,
): Map<string, string[]> {
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]))

  for (const edge of edges) {
    const source = reverse ? edge.target.nodeId : edge.source.nodeId
    const target = reverse ? edge.source.nodeId : edge.target.nodeId
    const neighbors = adjacency.get(source)

    if (neighbors) {
      neighbors.push(target)
    }
  }

  return adjacency
}

function createFinishingOrder(nodes: GraphNode[], adjacency: Map<string, string[]>): string[] {
  const visited = new Set<string>()
  const order: string[] = []

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue
    }

    const stack: Array<{ nodeId: string; nextIndex: number }> = [{ nodeId: node.id, nextIndex: 0 }]
    visited.add(node.id)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]

      if (!frame) {
        break
      }

      const neighbors = adjacency.get(frame.nodeId) ?? []

      if (frame.nextIndex >= neighbors.length) {
        order.push(frame.nodeId)
        stack.pop()
        continue
      }

      const nextNodeId = neighbors[frame.nextIndex]
      frame.nextIndex += 1

      if (nextNodeId !== undefined && !visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        stack.push({ nodeId: nextNodeId, nextIndex: 0 })
      }
    }
  }

  return order
}
