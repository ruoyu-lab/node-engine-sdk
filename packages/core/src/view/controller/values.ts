import type { GraphMetadata, GraphNode } from '../../protocol/index.js'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Parameter values of a node live in `node.data.params`. */
export function getNodeParams(node: GraphNode): GraphMetadata {
  return isRecord(node.data?.params) ? node.data.params : {}
}
