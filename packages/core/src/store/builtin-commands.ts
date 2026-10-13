import type {
  ConnectionValidationResult,
  GraphCommandApi,
  GraphCommandRegistryEntry,
  GraphEdge,
  GraphEdgePatch,
  GraphEdgeReconnect,
  GraphEndpoint,
  GraphGroup,
  GraphGroupPatch,
  GraphNode,
  GraphNodePatch,
  GraphSnapshot,
} from '../protocol/index.js'
import {
  addEdgeCommand,
  addGroupCommand,
  addNodeCommand,
  connectPortsCommand,
  moveNodesCommand,
  reconnectEdgeCommand,
  removeEdgeCommand,
  removeGroupCommand,
  removeNodeCommand,
  updateEdgeCommand,
  updateGroupCommand,
  updateNodeCommand,
} from './commands.js'

interface NodeAddCommandPayload {
  node: GraphNode
}

interface NodeUpdateCommandPayload {
  nodeId: string
  patch: GraphNodePatch
}

interface NodeMoveCommandPayload {
  nodeIds: string[]
  delta: { x: number; y: number }
}

interface NodeRemoveCommandPayload {
  nodeId: string
}

interface EdgeAddCommandPayload {
  edge: GraphEdge
}

interface EdgeUpdateCommandPayload {
  edgeId: string
  patch: GraphEdgePatch
}

interface EdgeRemoveCommandPayload {
  edgeId: string
}

interface EdgeConnectCommandPayload {
  source: GraphEndpoint
  target: GraphEndpoint
  edgeId?: string
  edgeType?: string
  data?: GraphEdge['data']
}

interface EdgeReconnectCommandPayload {
  edgeId: string
  reconnect: GraphEdgeReconnect
}

interface GroupAddCommandPayload {
  group: GraphGroup
}

interface GroupUpdateCommandPayload {
  groupId: string
  patch: GraphGroupPatch
}

interface GroupRemoveCommandPayload {
  groupId: string
}

/** Store services the built-in commands depend on. */
export interface BuiltInCommandServices {
  createCommandApi: (draft: GraphSnapshot) => GraphCommandApi
  getEdge: (edgeId: string) => GraphEdge | undefined
  validateConnection: (
    source: GraphEndpoint,
    target: GraphEndpoint,
    options?: { ignoreEdgeId?: string },
  ) => ConnectionValidationResult
}

/**
 * The commands every store registers: node, edge, and group edits by payload. Connecting and
 * reconnecting validate the connection before they run.
 */
export function createBuiltInCommands(
  services: BuiltInCommandServices,
): GraphCommandRegistryEntry[] {
  const api = (draft: GraphSnapshot) => services.createCommandApi(draft)

  return [
    {
      id: 'node.add',
      category: 'node',
      label: ({ node }: NodeAddCommandPayload) => `Add node ${node.id}`,
      execute: ({ node }: NodeAddCommandPayload, draft) => {
        addNodeCommand(node).execute(draft, api(draft))
      },
    },
    {
      id: 'node.update',
      category: 'node',
      label: ({ nodeId }: NodeUpdateCommandPayload) => `Update node ${nodeId}`,
      execute: ({ nodeId, patch }: NodeUpdateCommandPayload, draft) => {
        updateNodeCommand(nodeId, patch).execute(draft, api(draft))
      },
    },
    {
      id: 'node.move',
      category: 'node',
      label: ({ nodeIds }: NodeMoveCommandPayload) => `Move ${nodeIds.length} node(s)`,
      execute: ({ nodeIds, delta }: NodeMoveCommandPayload, draft) => {
        moveNodesCommand(nodeIds, delta).execute(draft, api(draft))
      },
    },
    {
      id: 'node.remove',
      category: 'node',
      label: ({ nodeId }: NodeRemoveCommandPayload) => `Remove node ${nodeId}`,
      execute: ({ nodeId }: NodeRemoveCommandPayload, draft) => {
        removeNodeCommand(nodeId).execute(draft, api(draft))
      },
    },
    {
      id: 'edge.add',
      category: 'edge',
      label: ({ edge }: EdgeAddCommandPayload) => `Add edge ${edge.id}`,
      execute: ({ edge }: EdgeAddCommandPayload, draft) => {
        addEdgeCommand(edge).execute(draft, api(draft))
      },
    },
    {
      id: 'edge.update',
      category: 'edge',
      label: ({ edgeId }: EdgeUpdateCommandPayload) => `Update edge ${edgeId}`,
      execute: ({ edgeId, patch }: EdgeUpdateCommandPayload, draft) => {
        updateEdgeCommand(edgeId, patch).execute(draft, api(draft))
      },
    },
    {
      id: 'edge.remove',
      category: 'edge',
      label: ({ edgeId }: EdgeRemoveCommandPayload) => `Remove edge ${edgeId}`,
      execute: ({ edgeId }: EdgeRemoveCommandPayload, draft) => {
        removeEdgeCommand(edgeId).execute(draft, api(draft))
      },
    },
    {
      id: 'edge.connect',
      category: 'edge',
      label: ({ source, target }: EdgeConnectCommandPayload) =>
        `Connect ${source.nodeId}:${source.portId} -> ${target.nodeId}:${target.portId}`,
      validate: (payload: EdgeConnectCommandPayload) =>
        services.validateConnection(payload.source, payload.target),
      execute: ({ source, target, edgeId, edgeType, data }: EdgeConnectCommandPayload, draft) => {
        connectPortsCommand({
          source,
          target,
          edgeId,
          edgeType,
          data,
        }).execute(draft, api(draft))
      },
    },
    {
      id: 'edge.reconnect',
      category: 'edge',
      label: ({ edgeId }: EdgeReconnectCommandPayload) => `Reconnect edge ${edgeId}`,
      validate: ({ edgeId, reconnect }: EdgeReconnectCommandPayload) => {
        const edge = services.getEdge(edgeId)

        if (!edge) {
          return {
            valid: false,
            code: 'MISSING_EDGE',
            reason: `Edge "${edgeId}" was not found.`,
          }
        }

        return services.validateConnection(
          reconnect.source ?? edge.source,
          reconnect.target ?? edge.target,
          { ignoreEdgeId: edgeId },
        )
      },
      execute: ({ edgeId, reconnect }: EdgeReconnectCommandPayload, draft) => {
        reconnectEdgeCommand(edgeId, reconnect).execute(draft, api(draft))
      },
    },
    {
      id: 'group.add',
      category: 'group',
      label: ({ group }: GroupAddCommandPayload) => `Add group ${group.id}`,
      execute: ({ group }: GroupAddCommandPayload, draft) => {
        addGroupCommand(group).execute(draft, api(draft))
      },
    },
    {
      id: 'group.update',
      category: 'group',
      label: ({ groupId }: GroupUpdateCommandPayload) => `Update group ${groupId}`,
      execute: ({ groupId, patch }: GroupUpdateCommandPayload, draft) => {
        updateGroupCommand(groupId, patch).execute(draft, api(draft))
      },
    },
    {
      id: 'group.remove',
      category: 'group',
      label: ({ groupId }: GroupRemoveCommandPayload) => `Remove group ${groupId}`,
      execute: ({ groupId }: GroupRemoveCommandPayload, draft) => {
        removeGroupCommand(groupId).execute(draft, api(draft))
      },
    },
  ]
}
