import type {
  GraphCommand,
  GraphCommandApi,
  GraphEndpoint,
  GraphEdge,
  GraphEdgePatch,
  GraphEdgeReconnect,
  GraphGroup,
  GraphGroupPatch,
  GraphNode,
  GraphNodePatch,
  GraphPort,
} from '../protocol/index.js'
import { cloneValue, resolvePortKind } from '../protocol/index.js'

const GRAPH_NODE_PATCH_FIELDS: Array<keyof GraphNodePatch> = [
  'x',
  'y',
  'width',
  'height',
  'locked',
  'ports',
  'data',
  'meta',
]

const GRAPH_EDGE_PATCH_FIELDS: Array<keyof GraphEdgePatch> = ['type', 'label', 'data', 'meta']

const GRAPH_GROUP_PATCH_FIELDS: Array<keyof GraphGroupPatch> = [
  'label',
  'x',
  'y',
  'width',
  'height',
  'color',
  'nodeIds',
  'data',
  'meta',
]

export function addNodeCommand(node: GraphNode): GraphCommand {
  return {
    id: 'node.add',
    label: `Add node ${node.id}`,
    execute(draft, api) {
      if (api.getNode(node.id)) {
        throw new Error(`Node "${node.id}" already exists.`)
      }

      draft.nodes = [...draft.nodes, cloneValue(node)]
    },
  }
}

export function updateNodeCommand(nodeId: string, patch: GraphNodePatch): GraphCommand {
  return {
    id: 'node.update',
    label: `Update node ${nodeId}`,
    execute(_draft, api) {
      const node = api.ensureNode(nodeId)
      Object.assign(node, sanitizeNodePatch(patch))
    },
  }
}

export function moveNodesCommand(nodeIds: string[], delta: { x: number; y: number }): GraphCommand {
  return {
    id: 'node.move',
    label: `Move ${nodeIds.length} node(s)`,
    execute(draft, api) {
      const movedNodeIds = new Set(nodeIds)

      for (const nodeId of movedNodeIds) {
        api.ensureNode(nodeId)
      }

      draft.nodes = draft.nodes.map((node) =>
        movedNodeIds.has(node.id)
          ? {
              ...node,
              x: node.x + delta.x,
              y: node.y + delta.y,
            }
          : node,
      )
    },
  }
}

export function removeNodeCommand(nodeId: string): GraphCommand {
  return {
    id: 'node.remove',
    label: `Remove node ${nodeId}`,
    execute(draft, api) {
      api.ensureNode(nodeId)
      draft.nodes = draft.nodes.filter((node) => node.id !== nodeId)
      draft.edges = draft.edges.filter(
        (edge) => edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId,
      )
      draft.groups = draft.groups.map((group) =>
        group.nodeIds?.includes(nodeId)
          ? {
              ...group,
              nodeIds: group.nodeIds.filter((id) => id !== nodeId),
            }
          : group,
      )
    },
  }
}

export function addEdgeCommand(edge: GraphEdge): GraphCommand {
  return {
    id: 'edge.add',
    label: `Add edge ${edge.id}`,
    execute(draft, api) {
      if (api.getEdge(edge.id)) {
        throw new Error(`Edge "${edge.id}" already exists.`)
      }

      draft.edges = [...draft.edges, cloneValue(edge)]
    },
  }
}

export function updateEdgeCommand(edgeId: string, patch: GraphEdgePatch): GraphCommand {
  return {
    id: 'edge.update',
    label: `Update edge ${edgeId}`,
    execute(_draft, api) {
      const edge = api.ensureEdge(edgeId)
      Object.assign(edge, sanitizeEdgePatch(patch))
    },
  }
}

/** Moves an edge endpoint; a new source port also gives the edge that port's kind. */
export function reconnectEdgeCommand(edgeId: string, reconnect: GraphEdgeReconnect): GraphCommand {
  return {
    id: 'edge.reconnect',
    label: `Reconnect edge ${edgeId}`,
    execute(_draft, api) {
      const edge = api.ensureEdge(edgeId)

      if (reconnect.source) {
        edge.source = cloneValue(reconnect.source)
        edge.kind = resolvePortKind(ensureSourcePort(api, edge.source))
      }

      if (reconnect.target) {
        edge.target = cloneValue(reconnect.target)
      }
    },
  }
}

export function removeEdgeCommand(edgeId: string): GraphCommand {
  return {
    id: 'edge.remove',
    label: `Remove edge ${edgeId}`,
    execute(draft, api) {
      api.ensureEdge(edgeId)
      draft.edges = draft.edges.filter((edge) => edge.id !== edgeId)
    },
  }
}

export function addGroupCommand(group: GraphGroup): GraphCommand {
  return {
    id: 'group.add',
    label: `Add group ${group.id}`,
    execute(draft, api) {
      if (api.getGroup(group.id)) {
        throw new Error(`Group "${group.id}" already exists.`)
      }

      draft.groups = [...draft.groups, cloneValue(group)]
    },
  }
}

export function updateGroupCommand(groupId: string, patch: GraphGroupPatch): GraphCommand {
  return {
    id: 'group.update',
    label: `Update group ${groupId}`,
    execute(_draft, api) {
      const group = api.ensureGroup(groupId)
      Object.assign(group, sanitizeGroupPatch(patch))
    },
  }
}

export function removeGroupCommand(groupId: string): GraphCommand {
  return {
    id: 'group.remove',
    label: `Remove group ${groupId}`,
    execute(draft, api) {
      api.ensureGroup(groupId)
      draft.groups = draft.groups.filter((group) => group.id !== groupId)
    },
  }
}

/** Adds an edge whose kind is the kind of its source port. */
export function connectPortsCommand(options: {
  edgeId?: string
  source: GraphEndpoint
  target: GraphEndpoint
  edgeType?: string
  data?: GraphEdge['data']
}): GraphCommand {
  return {
    id: 'edge.connect',
    label: `Connect ${options.source.nodeId}:${options.source.portId} -> ${options.target.nodeId}:${options.target.portId}`,
    execute(draft, api) {
      const edge: GraphEdge = {
        id: options.edgeId ?? api.createId('edge'),
        source: cloneValue(options.source),
        target: cloneValue(options.target),
        kind: resolvePortKind(ensureSourcePort(api, options.source)),
        type: options.edgeType,
        data: cloneValue(options.data),
      }

      draft.edges = [...draft.edges, edge]
    },
  }
}

function ensureSourcePort(api: GraphCommandApi, endpoint: GraphEndpoint): GraphPort {
  const port = api.getPort(endpoint)

  if (!port) {
    throw new Error(`Source port "${endpoint.portId}" of node "${endpoint.nodeId}" was not found.`)
  }

  return port
}

function sanitizeNodePatch(patch: GraphNodePatch): GraphNodePatch {
  const next: GraphNodePatch = {}

  for (const key of GRAPH_NODE_PATCH_FIELDS) {
    if (key in patch) {
      next[key] = cloneValue(patch[key]) as never
    }
  }

  return next
}

function sanitizeEdgePatch(patch: GraphEdgePatch): GraphEdgePatch {
  const next: GraphEdgePatch = {}

  for (const key of GRAPH_EDGE_PATCH_FIELDS) {
    if (key in patch) {
      next[key] = cloneValue(patch[key]) as never
    }
  }

  return next
}

function sanitizeGroupPatch(patch: GraphGroupPatch): GraphGroupPatch {
  const next: GraphGroupPatch = {}

  for (const key of GRAPH_GROUP_PATCH_FIELDS) {
    if (key in patch) {
      next[key] = cloneValue(patch[key]) as never
    }
  }

  return next
}
