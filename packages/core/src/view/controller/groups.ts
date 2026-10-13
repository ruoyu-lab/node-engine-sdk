import type { GraphGroup, GraphNode, GraphSnapshot } from '../../protocol/index.js'
import type { GraphRect } from '../rendering/geometry.js'
import { isRecord } from './values.js'

/** Group membership and collapse rules shared by commands, culling and hit testing. */

export function isGroupCollapsed(group: GraphGroup | undefined): boolean {
  return Boolean(group && isRecord(group.data) && group.data.collapsed === true)
}

/** Collapsed groups shrink to their header. */
export function getGroupBoundsRect(group: GraphGroup, headerHeight: number): GraphRect {
  return {
    x: group.x,
    y: group.y,
    width: group.width,
    height: isGroupCollapsed(group) ? Math.min(headerHeight, group.height) : group.height,
  }
}

function isNodeWithinGroup(node: GraphNode, group: GraphGroup): boolean {
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    node.x + (node.width ?? 0) <= group.x + group.width &&
    node.y + (node.height ?? 0) <= group.y + group.height
  )
}

/** Explicit `nodeIds` that still exist, otherwise the nodes geometrically inside the group. */
export function resolveGroupNodeIds(graph: GraphSnapshot, group: GraphGroup): string[] {
  if (group.nodeIds?.length) {
    const nodeIds = new Set(graph.nodes.map((node) => node.id))
    return group.nodeIds.filter((nodeId) => nodeIds.has(nodeId))
  }

  return graph.nodes.filter((node) => isNodeWithinGroup(node, group)).map((node) => node.id)
}

export function resolveCollapsedGroupNodeIds(graph: GraphSnapshot): Set<string> {
  const nodeIds = new Set<string>()

  for (const group of graph.groups) {
    if (isGroupCollapsed(group)) {
      for (const nodeId of resolveGroupNodeIds(graph, group)) {
        nodeIds.add(nodeId)
      }
    }
  }

  return nodeIds
}

/**
 * Recomputes `nodeIds` of every group whose members or area may have changed: all groups when
 * `movedNodeIds` is omitted, otherwise the groups that contained or now contain a moved node.
 */
export function syncGroupMembership(
  draft: GraphSnapshot,
  movedNodeIds?: ReadonlySet<string>,
): void {
  draft.groups = draft.groups.map((group) => {
    const affected =
      !movedNodeIds ||
      (group.nodeIds ?? []).some((nodeId) => movedNodeIds.has(nodeId)) ||
      draft.nodes.some((node) => movedNodeIds.has(node.id) && isNodeWithinGroup(node, group))

    if (!affected) {
      return group
    }

    return {
      ...group,
      nodeIds: draft.nodes.filter((node) => isNodeWithinGroup(node, group)).map((node) => node.id),
    }
  })
}
