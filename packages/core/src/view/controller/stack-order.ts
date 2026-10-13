import type { GraphSnapshot } from '../../protocol/index.js'
import { signal } from '../reactive.js'

/**
 * Paint order of nodes. Nodes keep their graph order until the user interacts with them, which
 * raises them above every other node.
 */
export interface NodeStackOrder {
  raise: (nodeId: string) => void
  resolve: (nodeId: string, defaultIndex: number) => number
  /** Forgets nodes that no longer exist. */
  prune: (graph: GraphSnapshot) => void
  reset: () => void
}

export function createNodeStackOrder(getGraph: () => GraphSnapshot): NodeStackOrder {
  const order = signal<Readonly<Record<string, number>>>({})
  let highest = 0

  return {
    raise(nodeId) {
      const current = order.peek()
      highest = Math.max(highest, ...Object.values(current), getGraph().nodes.length) + 1
      order.value = { ...current, [nodeId]: highest }
    },
    resolve: (nodeId, defaultIndex) => order.value[nodeId] ?? defaultIndex,
    prune(graph) {
      const entries = Object.entries(order.peek())

      if (!entries.length) {
        return
      }

      const nodeIds = new Set(graph.nodes.map((node) => node.id))
      const kept = entries.filter(([nodeId]) => nodeIds.has(nodeId))

      if (kept.length !== entries.length) {
        order.value = Object.fromEntries(kept)
      }
    },
    reset() {
      order.value = {}
      highest = 0
    },
  }
}
