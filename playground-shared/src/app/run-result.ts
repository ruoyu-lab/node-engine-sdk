import type { GraphMetadata, GraphSnapshot, GraphValue } from '@node-engine-sdk/core/protocol'
import type { NodeEngineRunResult } from '@node-engine-sdk/core/runtime'
import type { NodeEngineNodeStatus } from '@node-engine-sdk/core/view'
import { AI_IMAGE_DISPLAY_NODE_TYPE } from '../business/ai-image'

/**
 * Writes the image URL every display node received during a run into its `imageUrl` parameter,
 * so the image field shows the result. Returns the same graph when no display node received one.
 */
export function applyRunResultToGraph(
  graph: GraphSnapshot,
  result: NodeEngineRunResult,
): GraphSnapshot {
  const updates = new Map<string, string>()

  for (const node of graph.nodes) {
    const url = result.nodeStates[node.id]?.inputValues?.imageUrl

    if (node.type === AI_IMAGE_DISPLAY_NODE_TYPE && typeof url === 'string' && url.length > 0) {
      updates.set(node.id, url)
    }
  }

  if (updates.size === 0) {
    return graph
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const url = updates.get(node.id)

      if (!url) {
        return node
      }

      const data = node.data ?? {}
      const params = isMetadataRecord(data.params) ? data.params : {}

      return {
        ...node,
        data: {
          ...data,
          params: { ...params, imageUrl: url },
        },
      }
    }),
  }
}

function isMetadataRecord(value: GraphValue | undefined): value is GraphMetadata {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const NO_NODE_STATUS: Readonly<Record<string, NodeEngineNodeStatus>> = Object.freeze({})

/** The editor's `nodeStatus` for a run: every node the run reached, by its runtime status. */
export function resolveRunNodeStatus(
  result: NodeEngineRunResult | null,
): Readonly<Record<string, NodeEngineNodeStatus>> {
  if (!result) {
    return NO_NODE_STATUS
  }

  return Object.fromEntries(
    Object.values(result.nodeStates)
      .filter((state) => state.status !== 'idle')
      .map((state) => [state.nodeId, state.status]),
  )
}
