import {
  cloneValue,
  type ConnectionValidationResult,
  type GraphEdge,
  type GraphEdgePatch,
  type GraphEdgeReconnect,
  type GraphEndpoint,
  type GraphSnapshot,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import type { NodeEngineEventSink } from '../types/index.js'

/** Edge mutations; invalid connections are reported through `connection-invalid`. */
export interface EdgeCommands {
  add: (edge: Omit<GraphEdge, 'id'> & { id?: string }) => GraphEdge
  update: (edgeId: string, patch: GraphEdgePatch) => GraphSnapshot
  reconnect: (edgeId: string, reconnect: GraphEdgeReconnect) => ConnectionValidationResult
  remove: (edgeId: string) => GraphSnapshot
  disconnect: (edgeId: string, reason?: string) => GraphSnapshot
  connect: (
    source: GraphEndpoint,
    target: GraphEndpoint,
    options?: {
      edgeId?: string
      edgeType?: string
      data?: GraphEdge['data']
    },
  ) => ConnectionValidationResult
  validate: (source: GraphEndpoint, target: GraphEndpoint) => ConnectionValidationResult
}

export function createEdgeCommands(options: {
  getStore: () => GraphStore
  emit: NodeEngineEventSink
}): EdgeCommands {
  const store = options.getStore

  return {
    add(edge) {
      const next: GraphEdge = {
        ...edge,
        id: edge.id ?? store().createId('edge'),
        source: cloneValue(edge.source),
        target: cloneValue(edge.target),
        kind: edge.kind,
        data: cloneValue(edge.data),
        meta: cloneValue(edge.meta),
      }

      store().addEdge(next, { source: 'api.add-edge' })
      return next
    },
    update: (edgeId, patch) => store().updateEdge(edgeId, patch, { source: 'api.update-edge' }),
    reconnect: (edgeId, reconnect) =>
      store().reconnectEdge(edgeId, reconnect, { source: 'api.reconnect-edge' }),
    remove: (edgeId) => store().removeEdge(edgeId, { source: 'api.remove-edge' }),
    disconnect(edgeId, reason = 'api.disconnect-edge') {
      const edge = store().getEdge(edgeId)
      const graph = store().removeEdge(edgeId, { source: reason })

      if (edge) {
        options.emit('edge-disconnect', { edge, graph, reason })
      }

      return graph
    },
    connect(source, target, config) {
      const validation = store().connect(source, target, {
        ...config,
        change: { source: 'api.connect' },
      })

      if (!validation.valid) {
        options.emit('connection-invalid', {
          source,
          target,
          validation,
          graph: store().getSnapshot(),
        })
      }

      return validation
    },
    validate: (source, target) => store().validateConnection(source, target),
  }
}
