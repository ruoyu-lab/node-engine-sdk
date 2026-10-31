import {
  cloneValue,
  type GraphMetadata,
  type GraphNode,
  type GraphNodePatch,
  type GraphSnapshot,
  type GraphValue,
  type NodeDefinition,
  type XYPosition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { DEFAULT_DOM_MIN_HEIGHT, DEFAULT_DOM_MIN_WIDTH } from '../dom-model/layout.js'
import { snap, type GraphRect } from '../rendering/geometry.js'
import type { NodeWrightEventSink } from '../types/index.js'
import type { EditorExtensions } from './extensions.js'
import { syncGroupMembership } from './groups.js'
import type { GridSnapping } from './interactions/drag.js'
import type { ResizePreview } from './interactions/resize.js'
import type { NodeViews } from './node-views.js'
import { getNodeParams } from './values.js'

type NodeInput = Omit<GraphNode, 'id'> & { id?: string }

/** Node mutations. Every geometry change re-syncs the membership of affected groups. */
export interface NodeCommands {
  create: (type: string, patch?: Partial<Omit<GraphNode, 'id' | 'type'>>) => GraphNode | null
  add: (node: NodeInput) => GraphNode
  update: (nodeId: string, patch: GraphNodePatch) => GraphSnapshot
  move: (nodeIds: string[], delta: XYPosition) => GraphSnapshot
  /** Commits a drag: each node moves from its origin by `delta`, snapped to the grid. */
  moveFromOrigins: (origins: Record<string, XYPosition>, delta: XYPosition) => void
  resize: (nodeId: string, size: Partial<GraphRect>) => GraphSnapshot
  remove: (nodeId: string) => GraphSnapshot
  updateParam: (
    nodeId: string,
    key: string,
    value: GraphValue,
    options?: { source?: string },
  ) => GraphSnapshot
  setParams: (
    nodeId: string,
    params: GraphMetadata,
    options?: { replace?: boolean; source?: string },
  ) => GraphSnapshot
}

export function createNodeCommands(options: {
  getStore: () => GraphStore
  extensions: EditorExtensions
  nodeViews: NodeViews
  resizePreview: ResizePreview
  getSnapping: () => GridSnapping
  emit: NodeWrightEventSink
}): NodeCommands {
  const store = options.getStore

  /**
   * The node as the graph keeps it, every field it has a value of and no other, so that the graph
   * stays one `parseGraph` takes. It keeps ports of its own alone: those of its definition, and of
   * its parameters, resolve from the definition; the default ports of a node type without a
   * definition are copied, as nothing else resolves them.
   */
  function instantiate(node: NodeInput): GraphNode {
    const definition = options.extensions.resolveNodeType(node.type)
    const schema = store().getNodeDefinition(node.type)
    const width = node.width ?? schema?.width ?? definition?.width
    const height = node.height ?? schema?.height ?? definition?.height
    const ports = node.ports ?? (schema ? undefined : definition?.ports)
    const data = withParameterDefaults(
      schema,
      mergeMetadata(resolveMetadata(schema?.dataDefaults), node.data),
    )
    const meta = mergeMetadata(resolveMetadata(schema?.metaDefaults), node.meta)
    const next: GraphNode = {
      id: node.id ?? store().createId('node'),
      type: node.type,
      x: node.x,
      y: node.y,
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
      ...(node.locked === undefined ? {} : { locked: node.locked }),
      ...(ports === undefined ? {} : { ports: cloneValue(ports) }),
      ...(data === undefined ? {} : { data }),
      ...(meta === undefined ? {} : { meta }),
    }

    return options.nodeViews.applyDomContentSize(next, definition, schema)
  }

  function add(node: NodeInput): GraphNode {
    const next = instantiate(node)

    store().mutate(
      'Add node',
      (draft) => {
        draft.nodes = [...draft.nodes, next]
        syncGroupMembership(draft, new Set([next.id]))
      },
      { source: 'api.add-node' },
    )
    return next
  }

  function update(nodeId: string, patch: GraphNodePatch): GraphSnapshot {
    const affectsBounds =
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.width !== undefined ||
      patch.height !== undefined

    if (!affectsBounds) {
      return store().updateNode(nodeId, patch, { source: 'api.update-node' })
    }

    return store().mutate(
      'Update node',
      (draft) => {
        draft.nodes = draft.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
        syncGroupMembership(draft, new Set([nodeId]))
      },
      { source: 'api.update-node' },
    )
  }

  return {
    create(type, patch = {}) {
      return type ? add({ type, x: patch.x ?? 0, y: patch.y ?? 0, ...patch }) : null
    },
    add,
    update,
    move(nodeIds, delta) {
      if (!nodeIds.length || (delta.x === 0 && delta.y === 0)) {
        return store().getSnapshot()
      }

      const moved = new Set(nodeIds)

      return store().mutate(
        `Move ${nodeIds.length} node(s)`,
        (draft) => {
          draft.nodes = draft.nodes.map((node) =>
            moved.has(node.id) ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node,
          )
          syncGroupMembership(draft, moved)
        },
        { source: 'api.move-nodes' },
      )
    },
    moveFromOrigins(origins, delta) {
      const snapping = options.getSnapping()
      const resolve = (value: number) => (snapping.enabled ? snap(value, snapping.size) : value)
      const moved = new Set(Object.keys(origins))

      store().mutate(
        `Move ${moved.size} node(s)`,
        (draft) => {
          draft.nodes = draft.nodes.map((node) => {
            const origin = origins[node.id]

            return origin
              ? { ...node, x: resolve(origin.x + delta.x), y: resolve(origin.y + delta.y) }
              : node
          })
          syncGroupMembership(draft, moved)
        },
        { source: 'drag' },
      )
    },
    resize(nodeId, size) {
      const node = store().getNode(nodeId)

      if (!node) {
        return store().getSnapshot()
      }

      const bounds = options.resizePreview.resolveNodeBounds({
        nodeId,
        handle: 'se',
        origin: {
          x: size.x ?? node.x,
          y: size.y ?? node.y,
          width: size.width ?? node.width ?? DEFAULT_DOM_MIN_WIDTH,
          height: size.height ?? node.height ?? DEFAULT_DOM_MIN_HEIGHT,
        },
        deltaX: 0,
        deltaY: 0,
      })

      return update(nodeId, bounds)
    },
    remove: (nodeId) => store().removeNode(nodeId, { source: 'api.remove-node' }),
    updateParam(nodeId, key, value, config) {
      const node = store().getNode(nodeId)

      if (!node) {
        return store().getSnapshot()
      }

      const params = getNodeParams(node)
      const graph = store().updateNode(
        nodeId,
        { data: { ...node.data, params: { ...params, [key]: value } } },
        { source: config?.source ?? 'api.update-node-param' },
      )
      const nextNode = store().getNode(nodeId)

      if (nextNode) {
        options.emit('node-param-change', {
          nodeId,
          key,
          value,
          previousValue: params[key],
          node: nextNode,
          graph,
        })
      }

      return graph
    },
    setParams(nodeId, params, config) {
      const node = store().getNode(nodeId)

      if (!node) {
        return store().getSnapshot()
      }

      return store().updateNode(
        nodeId,
        {
          data: {
            ...node.data,
            params: config?.replace
              ? cloneValue(params)
              : { ...getNodeParams(node), ...cloneValue(params) },
          },
        },
        { source: config?.source ?? 'api.set-node-params' },
      )
    },
  }
}

function resolveMetadata(
  metadata: GraphMetadata | (() => GraphMetadata) | undefined,
): GraphMetadata | undefined {
  return typeof metadata === 'function' ? metadata() : metadata
}

function mergeMetadata(base?: GraphMetadata, patch?: GraphMetadata): GraphMetadata | undefined {
  return base || patch ? { ...base, ...patch } : undefined
}

/** Adds the `defaultValue` of every parameter missing from `data.params`. */
function withParameterDefaults(
  schema: NodeDefinition | undefined,
  data: GraphMetadata | undefined,
): GraphMetadata | undefined {
  if (!schema?.parameters?.length) {
    return data
  }

  const next: GraphMetadata = { ...data }
  const params: GraphMetadata =
    typeof next.params === 'object' && next.params ? { ...(next.params as GraphMetadata) } : {}

  for (const parameter of schema.parameters) {
    if (parameter.defaultValue !== undefined && !(parameter.key in params)) {
      params[parameter.key] = cloneValue(parameter.defaultValue)
    }
  }

  return { ...next, params }
}
