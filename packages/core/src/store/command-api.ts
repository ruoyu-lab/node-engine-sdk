import { findEdge, findGroup, findNode } from '../protocol/index.js'
import type {
  EdgeDefinition,
  GraphCommandApi,
  GraphSnapshot,
  NodeDefinition,
} from '../protocol/index.js'
import { resolveEndpointPort } from './graph-state.js'

/** Store services a command uses besides its draft. */
export interface CommandServices {
  createId: (prefix?: string) => string
  getNodeDefinition: (type: string) => NodeDefinition | undefined
  getEdgeDefinition: (type: string) => EdgeDefinition | undefined
}

/** The `GraphCommandApi` of one draft: lookups return the draft's own objects, ready to edit. */
export function createCommandApi(draft: GraphSnapshot, services: CommandServices): GraphCommandApi {
  return {
    createId: (prefix) => services.createId(prefix),
    getNode: (nodeId) => findNode(draft, nodeId),
    getEdge: (edgeId) => findEdge(draft, edgeId),
    getGroup: (groupId) => findGroup(draft, groupId),
    getPort: (endpoint) =>
      resolveEndpointPort(findNode(draft, endpoint.nodeId), endpoint.portId, (type) =>
        services.getNodeDefinition(type),
      ),
    getNodeDefinition: (type) => services.getNodeDefinition(type),
    getEdgeDefinition: (type) => services.getEdgeDefinition(type),
    ensureNode: (nodeId) => {
      const node = findNode(draft, nodeId)

      if (!node) {
        throw new Error(`Node "${nodeId}" was not found.`)
      }

      return node
    },
    ensureEdge: (edgeId) => {
      const edge = findEdge(draft, edgeId)

      if (!edge) {
        throw new Error(`Edge "${edgeId}" was not found.`)
      }

      return edge
    },
    ensureGroup: (groupId) => {
      const group = findGroup(draft, groupId)

      if (!group) {
        throw new Error(`Group "${groupId}" was not found.`)
      }

      return group
    },
  }
}
