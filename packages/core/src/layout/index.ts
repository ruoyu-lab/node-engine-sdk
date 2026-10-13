import type {
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphSnapshot,
  Size,
  XYPosition,
} from '../protocol/index.js'
import { cloneValue } from '../protocol/index.js'

export type GraphLayoutDirection = 'LR' | 'RL' | 'TB' | 'BT'

export interface GraphLayoutOptions {
  direction?: GraphLayoutDirection
  edgeKinds?: string[]
  rankSpacing?: number
  nodeSpacing?: number
  origin?: XYPosition
  defaultNodeSize?: Size
  groupPadding?: number
  includeDisconnected?: boolean
}

export interface GraphNodeLayoutPatch extends XYPosition {
  id: string
}

export interface GraphGroupLayoutPatch extends XYPosition, Size {
  id: string
}

export interface GraphLayoutBounds extends XYPosition, Size {}

export interface GraphLayoutResult {
  nodes: GraphNodeLayoutPatch[]
  groups: GraphGroupLayoutPatch[]
  bounds: GraphLayoutBounds
}

interface ResolvedLayoutOptions {
  direction: GraphLayoutDirection
  edgeKinds?: Set<string>
  rankSpacing: number
  nodeSpacing: number
  origin: XYPosition
  defaultNodeSize: Size
  groupPadding: number
  includeDisconnected: boolean
}

export function layoutGraph(
  graph: GraphSnapshot,
  options: GraphLayoutOptions = {},
): GraphLayoutResult {
  const resolved = resolveLayoutOptions(options)
  const nodes = graph.nodes.filter(
    (node) => resolved.includeDisconnected || isConnected(graph, node, resolved),
  )
  const ranks = assignRanks(nodes, graph.edges, resolved)
  const patches = positionRanks(ranks, resolved)
  const groupPatches = layoutGroups(graph.groups, patches, graph.nodes, resolved)
  const bounds = measureBounds(patches, groupPatches, nodes, resolved)

  return {
    nodes: patches,
    groups: groupPatches,
    bounds,
  }
}

export function applyGraphLayout(graph: GraphSnapshot, layout: GraphLayoutResult): GraphSnapshot {
  const nodePatches = new Map(layout.nodes.map((node) => [node.id, node]))
  const groupPatches = new Map(layout.groups.map((group) => [group.id, group]))

  return {
    ...cloneValue(graph),
    nodes: graph.nodes.map((node) => {
      const patch = nodePatches.get(node.id)

      return patch
        ? {
            ...node,
            x: patch.x,
            y: patch.y,
          }
        : cloneValue(node)
    }),
    groups: graph.groups.map((group) => {
      const patch = groupPatches.get(group.id)

      return patch
        ? {
            ...group,
            x: patch.x,
            y: patch.y,
            width: patch.width,
            height: patch.height,
          }
        : cloneValue(group)
    }),
  }
}

export function createDagLayout(
  options: GraphLayoutOptions = {},
): (graph: GraphSnapshot) => GraphLayoutResult {
  return (graph) => layoutGraph(graph, options)
}

function resolveLayoutOptions(options: GraphLayoutOptions): ResolvedLayoutOptions {
  return {
    direction: options.direction ?? 'LR',
    edgeKinds: options.edgeKinds ? new Set(options.edgeKinds) : undefined,
    rankSpacing: Math.max(40, options.rankSpacing ?? 280),
    nodeSpacing: Math.max(24, options.nodeSpacing ?? 96),
    origin: options.origin ?? { x: 80, y: 80 },
    defaultNodeSize: options.defaultNodeSize ?? { width: 240, height: 160 },
    groupPadding: Math.max(0, options.groupPadding ?? 40),
    includeDisconnected: options.includeDisconnected !== false,
  }
}

function assignRanks(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ResolvedLayoutOptions,
): GraphNode[][] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const node of nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source.nodeId) || !nodeIds.has(edge.target.nodeId)) {
      continue
    }

    if (options.edgeKinds && !options.edgeKinds.has(edge.kind)) {
      continue
    }

    outgoing.get(edge.source.nodeId)!.push(edge.target.nodeId)
    incoming.set(edge.target.nodeId, incoming.get(edge.target.nodeId)! + 1)
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id)
  const ranks = new Map<string, number>()

  for (const nodeId of queue) {
    ranks.set(nodeId, 0)
  }

  while (queue.length) {
    const nodeId = queue.shift() as string
    const nextRank = ranks.get(nodeId)! + 1

    for (const target of outgoing.get(nodeId)!) {
      ranks.set(target, Math.max(ranks.get(target) ?? 0, nextRank))
      incoming.set(target, incoming.get(target)! - 1)

      if (incoming.get(target)! <= 0) {
        queue.push(target)
      }
    }
  }

  for (const node of nodes) {
    if (!ranks.has(node.id)) {
      ranks.set(node.id, 0)
    }
  }

  const grouped = new Map<number, GraphNode[]>()

  for (const [nodeId, rank] of ranks) {
    const node = byId.get(nodeId)

    if (!node) {
      continue
    }

    grouped.set(rank, [...(grouped.get(rank) ?? []), node])
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, rankNodes]) => rankNodes.sort((left, right) => left.id.localeCompare(right.id)))
}

function positionRanks(
  ranks: GraphNode[][],
  options: ResolvedLayoutOptions,
): GraphNodeLayoutPatch[] {
  const patches: GraphNodeLayoutPatch[] = []

  for (const [rankIndex, rank] of ranks.entries()) {
    let crossAxis = 0

    for (const node of rank) {
      const size = nodeSize(node, options)
      const mainAxis = rankIndex * options.rankSpacing
      const position = mapPosition(mainAxis, crossAxis, options)

      patches.push({
        id: node.id,
        x: position.x,
        y: position.y,
      })

      crossAxis += isHorizontal(options.direction)
        ? size.height + options.nodeSpacing
        : size.width + options.nodeSpacing
    }
  }

  return patches
}

function layoutGroups(
  groups: GraphGroup[],
  patches: GraphNodeLayoutPatch[],
  nodes: GraphNode[],
  options: ResolvedLayoutOptions,
): GraphGroupLayoutPatch[] {
  const patchMap = new Map(patches.map((patch) => [patch.id, patch]))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  return groups.flatMap((group) => {
    const nodeBounds = (group.nodeIds ?? [])
      .map((nodeId) => {
        const patch = patchMap.get(nodeId)
        const node = nodeMap.get(nodeId)

        if (!patch || !node) {
          return undefined
        }

        const size = nodeSize(node, options)

        return {
          x: patch.x,
          y: patch.y,
          width: size.width,
          height: size.height,
        }
      })
      .filter((value): value is GraphLayoutBounds => Boolean(value))

    if (!nodeBounds.length) {
      return []
    }

    const bounds = mergeBounds(nodeBounds)

    return [
      {
        id: group.id,
        x: bounds.x - options.groupPadding,
        y: bounds.y - options.groupPadding,
        width: bounds.width + options.groupPadding * 2,
        height: bounds.height + options.groupPadding * 2,
      },
    ]
  })
}

function measureBounds(
  patches: GraphNodeLayoutPatch[],
  groups: GraphGroupLayoutPatch[],
  nodes: GraphNode[],
  options: ResolvedLayoutOptions,
): GraphLayoutBounds {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const bounds = [
    ...patches.map((patch) => {
      const size = nodeSize(nodeMap.get(patch.id), options)

      return {
        x: patch.x,
        y: patch.y,
        width: size.width,
        height: size.height,
      }
    }),
    ...groups,
  ]

  return bounds.length
    ? mergeBounds(bounds)
    : { x: options.origin.x, y: options.origin.y, width: 0, height: 0 }
}

function mergeBounds(bounds: GraphLayoutBounds[]): GraphLayoutBounds {
  const minX = Math.min(...bounds.map((bound) => bound.x))
  const minY = Math.min(...bounds.map((bound) => bound.y))
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width))
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function mapPosition(
  mainAxis: number,
  crossAxis: number,
  options: ResolvedLayoutOptions,
): XYPosition {
  const horizontal = isHorizontal(options.direction)
  const main = options.direction === 'RL' || options.direction === 'BT' ? -mainAxis : mainAxis

  return horizontal
    ? { x: options.origin.x + main, y: options.origin.y + crossAxis }
    : { x: options.origin.x + crossAxis, y: options.origin.y + main }
}

function isHorizontal(direction: GraphLayoutDirection): boolean {
  return direction === 'LR' || direction === 'RL'
}

function nodeSize(node: GraphNode | undefined, options: ResolvedLayoutOptions): Size {
  return {
    width: node?.width ?? options.defaultNodeSize.width,
    height: node?.height ?? options.defaultNodeSize.height,
  }
}

function isConnected(
  graph: GraphSnapshot,
  node: GraphNode,
  options: ResolvedLayoutOptions,
): boolean {
  return graph.edges.some((edge) => {
    if (options.edgeKinds && !options.edgeKinds.has(edge.kind)) {
      return false
    }

    return edge.source.nodeId === node.id || edge.target.nodeId === node.id
  })
}
