import type {
  GraphDiagnostic,
  GraphEdge,
  GraphSnapshot,
  GraphRepairResult,
  RepairGraphOptions,
} from './types.js'
import { getInvalidEdgeDiagnostic, validateGraph } from './validate.js'
import { cloneGraph } from './values.js'

/**
 * Drops broken references instead of rejecting the graph: edges whose nodes or ports are missing
 * or whose kind differs from their source port, and missing nodes listed by groups. Every removal
 * is reported as a `REPAIRED_*` warning, followed by the diagnostics of the repaired graph.
 */
export function repairGraph(
  graph: GraphSnapshot,
  options: RepairGraphOptions = {},
): GraphRepairResult {
  const before = cloneGraph(graph)
  const nodeMap = new Map(before.nodes.map((node) => [node.id, node]))
  const nodeDefinitions = new Map(
    (options.nodeDefinitions ?? []).map((definition) => [definition.type, definition]),
  )
  const diagnostics: GraphDiagnostic[] = []
  const edges: GraphEdge[] = []

  for (const [index, edge] of before.edges.entries()) {
    const issue = getInvalidEdgeDiagnostic(edge, index, nodeMap, nodeDefinitions)

    if (issue) {
      diagnostics.push({
        ...issue,
        severity: 'warning',
        code: `REPAIRED_${issue.code}`,
        message: `Removed edge "${edge.id}" because ${issue.message.toLowerCase()}`,
        source: 'protocol:repair',
      })
      continue
    }

    edges.push(edge)
  }

  const groups = before.groups.map((group, groupIndex) => {
    if (!group.nodeIds?.length) {
      return group
    }

    const nodeIds = group.nodeIds.filter((nodeId, nodeIndex) => {
      const valid = nodeMap.has(nodeId)

      if (!valid) {
        diagnostics.push({
          code: 'REPAIRED_GROUP_NODE_MISSING',
          severity: 'warning',
          message: `Removed missing node "${nodeId}" from group "${group.id}".`,
          source: 'protocol:repair',
          groupId: group.id,
          nodeId,
          path: `groups.${groupIndex}.nodeIds.${nodeIndex}`,
        })
      }

      return valid
    })

    return {
      ...group,
      nodeIds,
    }
  })

  const repaired: GraphSnapshot = {
    ...before,
    edges,
    groups,
  }
  const validation = validateGraph(repaired, options)

  return {
    graph: repaired,
    diagnostics: [...diagnostics, ...validation.diagnostics],
    validation,
  }
}
