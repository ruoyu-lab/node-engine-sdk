import type {
  GraphEndpoint,
  GraphNode,
  GraphPort,
  GraphSnapshot,
  NodeDefinition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import {
  applyDomConnectionState,
  applyDomFieldDriveState,
  buildDomNodePortSignature,
  resolveDefaultConnectedPortValue,
} from '../dom-model/drive-state.js'
import { DEFAULT_DOM_MIN_HEIGHT, DEFAULT_DOM_MIN_WIDTH } from '../dom-model/layout.js'
import { resolveDomNodeModel, resolveDomNodeSizeConstraints } from '../dom-model/model.js'
import {
  resolveDomNodeClassName,
  resolveDomNodePointerEvents,
  resolveDomNodeRecord,
  resolveDomNodeRenderer,
  resolveDomNodeRenderMode,
  resolveDomNodeStyle,
} from '../dom-model/renderer.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import type { CanvasNodeEntry } from '../rendering/node-canvas.js'
import type {
  NodeEngineAccessibleNode,
  NodeEngineApi,
  NodeEngineDomNodeApi,
  NodeEngineDomNodeEntry,
  NodeEngineDomNodeRenderContext,
  NodeEngineDomNodeRenderer,
  NodeEngineDomNodeSizeConstraints,
  NodeEngineResolvePortValueHook,
  NodeEngineResolvedDomNodeModel,
  NodeTypeDefinition,
} from '../types/index.js'
import type { DomContextFactory } from './dom-contexts.js'
import type { EditorExtensions } from './extensions.js'
import type { ConnectionGesture } from './interactions/connection.js'
import type { InteractionState } from './interaction-state.js'
import type { NodeViews } from './node-views.js'

/** Component key adapters register their built-in default DOM node under. */
export const NODE_ENGINE_DEFAULT_DOM_COMPONENT = 'node-engine.default'

interface DomRenderEntry {
  entry: CanvasNodeEntry
  context: NodeEngineDomNodeRenderContext
  renderer: NodeEngineDomNodeRenderer | null
}

interface CachedDomNodeModel {
  sourceNode: GraphNode | undefined
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  width: number
  height: number
  portStroke: string
  inputsSignature: string
  outputsSignature: string
  model: NodeEngineResolvedDomNodeModel
}

/**
 * The DOM node layer: which visible nodes render as DOM (replacing or overlaying the canvas
 * painting), their models with live field and connection state, and accessible fallbacks for
 * canvas-only nodes. Static DOM models are cached per node until an input of the model changes.
 */
export interface DomLayer {
  readonly paintedNodes: ReadonlySignal<CanvasNodeEntry[]>
  readonly nodes: ReadonlySignal<NodeEngineDomNodeEntry[]>
  readonly accessibleNodes: ReadonlySignal<NodeEngineAccessibleNode[]>
  getContext: (nodeId: string) => NodeEngineDomNodeRenderContext | null
  getModel: (nodeId: string) => NodeEngineResolvedDomNodeModel | null
  getResizeConstraints: (nodeId: string) => NodeEngineDomNodeSizeConstraints
  prune: (graph: GraphSnapshot) => void
  reset: () => void
}

export function createDomLayer(options: {
  graph: ReadonlySignal<GraphSnapshot>
  getStore: () => GraphStore
  visibleNodes: ReadonlySignal<CanvasNodeEntry[]>
  nodeViews: NodeViews
  extensions: EditorExtensions
  domContexts: DomContextFactory
  state: InteractionState
  connection: ConnectionGesture
  getResolvePortValue: () => NodeEngineResolvePortValueHook | undefined
  getApi: () => NodeEngineApi
  getDomApi: (nodeId: string) => NodeEngineDomNodeApi
}): DomLayer {
  let modelCache = new Map<string, CachedDomNodeModel>()
  /**
   * Committed nodes of the current snapshot by id. They keep their identity until the store
   * changes, unlike `GraphStore.getNode()`, which returns an isolated copy on every call, so they
   * can key the model cache across viewport, selection and interaction updates.
   */
  const committedNodes = computed(
    () => new Map(options.graph.value.nodes.map((node) => [node.id, node])),
  )

  function contextOf(entry: CanvasNodeEntry): NodeEngineDomNodeRenderContext {
    return options.domContexts.create(entry)
  }

  const renderEntries = computed<DomRenderEntry[]>(() =>
    options.visibleNodes.value.map((entry) => {
      const context = contextOf(entry)
      return { entry, context, renderer: resolveDomNodeRenderer(entry.definition, context) }
    }),
  )

  function findGraphPort(graph: GraphSnapshot, endpoint: GraphEndpoint): GraphPort | undefined {
    const node = graph.nodes.find((candidate) => candidate.id === endpoint.nodeId)

    if (!node) {
      return undefined
    }

    const ports = options.nodeViews.resolvePorts(
      node,
      options.getStore().getNodeDefinition(node.type),
      options.extensions.resolveNodeType(node.type),
    )

    return ports.find((port) => port.id === endpoint.portId)
  }

  function resolveConnectedValue(
    graph: GraphSnapshot,
    endpoint: GraphEndpoint,
    port: GraphPort | undefined,
  ): unknown {
    const node = graph.nodes.find((candidate) => candidate.id === endpoint.nodeId)
    const resolvePortValue = options.getResolvePortValue()

    if (resolvePortValue) {
      return resolvePortValue({
        graph,
        endpoint,
        port,
        node,
        schema: node ? options.getStore().getNodeDefinition(node.type) : undefined,
        definition: node ? options.extensions.nodeTypes.value[node.type] : undefined,
        api: options.getApi(),
      })
    }

    return resolveDefaultConnectedPortValue(node, port)
  }

  function resolveStaticModel(
    entry: CanvasNodeEntry,
    context: NodeEngineDomNodeRenderContext,
    renderer: NodeEngineDomNodeRenderer,
  ): NodeEngineResolvedDomNodeModel {
    if (typeof renderer.defaults === 'function') {
      return resolveDomNodeModel(context)
    }

    const nodeId = entry.node.id
    const sourceNode = committedNodes.value.get(nodeId) ?? entry.node
    const inputsSignature = buildDomNodePortSignature(entry.inputs, entry.bounds.y)
    const outputsSignature = buildDomNodePortSignature(entry.outputs, entry.bounds.y)
    const cached = modelCache.get(nodeId)

    if (
      cached &&
      cached.sourceNode === sourceNode &&
      cached.schema === entry.schema &&
      cached.definition === entry.definition &&
      cached.width === entry.bounds.width &&
      cached.height === entry.bounds.height &&
      cached.portStroke === context.theme.portStroke &&
      cached.inputsSignature === inputsSignature &&
      cached.outputsSignature === outputsSignature
    ) {
      return cached.model
    }

    const model = resolveDomNodeModel(context)

    modelCache.set(nodeId, {
      sourceNode,
      schema: entry.schema,
      definition: entry.definition,
      width: entry.bounds.width,
      height: entry.bounds.height,
      portStroke: context.theme.portStroke,
      inputsSignature,
      outputsSignature,
      model,
    })

    return model
  }

  function resolveModel(item: DomRenderEntry & { renderer: NodeEngineDomNodeRenderer }) {
    const graph = options.graph.value
    const model = applyDomFieldDriveState(
      resolveStaticModel(item.entry, item.context, item.renderer),
      graph,
      (endpoint) => findGraphPort(graph, endpoint),
      resolveConnectedValue,
    )

    return applyDomConnectionState(model, {
      source: options.state.connection.value?.source,
      target: options.state.connectionTarget.value?.endpoint,
      targetDirection: options.connection.targetDirection(),
      validate: options.connection.validateTarget,
    })
  }

  const nodes = computed<NodeEngineDomNodeEntry[]>(() =>
    renderEntries.value.flatMap((item, index) => {
      const { renderer, context } = item

      if (!renderer) {
        return []
      }

      const {
        left: _left,
        top: _top,
        transform: customTransform,
        transformOrigin: customTransformOrigin,
        willChange: customWillChange,
        ...customStyle
      } = resolveDomNodeStyle(renderer.style, context)
      const transform = [
        `translate3d(${context.bounds.x}px, ${context.bounds.y}px, 0)`,
        typeof customTransform === 'string' ? customTransform.trim() : '',
      ]
        .filter(Boolean)
        .join(' ')
      const transformOrigin =
        typeof customTransformOrigin === 'string' && customTransformOrigin.trim()
          ? customTransformOrigin
          : 'top left'
      const willChange = context.dragging ? 'transform' : customWillChange

      return [
        {
          id: item.entry.node.id,
          component: renderer.component ?? NODE_ENGINE_DEFAULT_DOM_COMPONENT,
          props: {
            ...context,
            domModel: resolveModel({ ...item, renderer }),
            domApi: options.getDomApi(item.entry.node.id),
            domServices: resolveDomNodeRecord(renderer.services, context),
            domActions: resolveDomNodeRecord(renderer.actions, context),
            ...(renderer.props?.(context) ?? {}),
          },
          className: resolveDomNodeClassName(renderer.className, context),
          style: {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: `${context.bounds.width}px`,
            height: `${context.bounds.height}px`,
            boxSizing: 'border-box',
            zIndex: index + 1,
            pointerEvents: resolveDomNodePointerEvents(renderer.pointerEvents, context),
            ...customStyle,
            transform,
            transformOrigin,
            ...(willChange === undefined ? {} : { willChange }),
          },
        },
      ]
    }),
  )

  function findEntry(nodeId: string): DomRenderEntry | undefined {
    return renderEntries.value.find((item) => item.entry.node.id === nodeId)
  }

  return {
    paintedNodes: computed(() =>
      renderEntries.value
        .filter((item) => !item.renderer || resolveDomNodeRenderMode(item.renderer) === 'overlay')
        .map((item) => item.entry),
    ),
    nodes,
    accessibleNodes: computed(() =>
      renderEntries.value
        .filter((item) => !item.renderer)
        .map(({ entry }) => ({
          id: entry.node.id,
          label: `${entry.schema?.label ?? entry.definition?.label ?? entry.node.type} (${entry.node.id})`,
          selected: entry.selected,
        })),
    ),
    getContext: (nodeId) => {
      const item = findEntry(nodeId)
      return item ? contextOf(item.entry) : null
    },
    getModel(nodeId) {
      const item = findEntry(nodeId)
      return item?.renderer ? resolveModel({ ...item, renderer: item.renderer }) : null
    },
    getResizeConstraints(nodeId) {
      const item = findEntry(nodeId)

      if (!item?.renderer) {
        return { minWidth: DEFAULT_DOM_MIN_WIDTH, minHeight: DEFAULT_DOM_MIN_HEIGHT }
      }

      return resolveDomNodeSizeConstraints(contextOf(item.entry))
    },
    prune(graph) {
      if (!modelCache.size) {
        return
      }

      const nodeIds = new Set(graph.nodes.map((node) => node.id))

      for (const nodeId of modelCache.keys()) {
        if (!nodeIds.has(nodeId)) {
          modelCache.delete(nodeId)
        }
      }
    },
    reset() {
      modelCache = new Map()
    },
  }
}
