import {
  cloneValue,
  resolveNodePorts as resolveDefinitionPorts,
  type GraphNode,
  type GraphPort,
  type GraphSnapshot,
  type NodeDefinition,
} from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { resolveDomPortAnchorPoints } from '../dom-model/anchors.js'
import { resolveDomNodeModel, resolveDomNodeSizeConstraints } from '../dom-model/model.js'
import { resolveDomNodeRenderer } from '../dom-model/renderer.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import { applyCanvasMeasureToNode } from '../rendering/entries.js'
import type { GraphRect } from '../rendering/geometry.js'
import {
  createPortLayouts,
  endpointKey,
  resolveNodeView,
  type PortLayout,
  type ResolvedNodeView,
} from '../rendering/node-layout.js'
import type {
  NodeEngineCanvasNodeLayoutContext,
  NodeEngineRenderContext,
  NodeTypeDefinition,
} from '../types/index.js'
import type { DomContextFactory } from './dom-contexts.js'
import type { EndpointStyles } from './endpoint-styles.js'
import type { EditorExtensions } from './extensions.js'
import type { DragPreview } from './interactions/drag.js'
import type { ResizePreview } from './interactions/resize.js'

export interface NodePortLayouts {
  all: PortLayout[]
  inputs: PortLayout[]
  outputs: PortLayout[]
}

/**
 * Resolved geometry of every node: size (explicit, measured by the canvas renderer, or derived
 * from the DOM model), ports (definition ports plus parameter input ports) and port anchors.
 */
export interface NodeViews {
  readonly resolvedNodes: ReadonlySignal<ResolvedNodeView[]>
  readonly nodePortLayouts: ReadonlySignal<Map<string, NodePortLayouts>>
  readonly portLayouts: ReadonlySignal<Map<string, PortLayout>>
  readonly nodeBounds: ReadonlySignal<Map<string, GraphRect>>
  findNode: (nodeId: string) => ResolvedNodeView | undefined
  /** Resolves the size and ports of any node, including nodes that are not in the graph. */
  resolve: (node: GraphNode) => ResolvedNodeView
  resolvePorts: (
    node: GraphNode,
    schema: NodeDefinition | undefined,
    definition: NodeTypeDefinition | undefined,
  ) => GraphPort[]
  /** Fills a missing width/height from the DOM model's minimum size. */
  applyDomContentSize: (
    node: GraphNode,
    definition: NodeTypeDefinition | undefined,
    schema: NodeDefinition | undefined,
  ) => GraphNode
}

export function createNodeViews(options: {
  graph: ReadonlySignal<GraphSnapshot>
  schemaRevision: ReadonlySignal<number>
  getStore: () => GraphStore
  extensions: EditorExtensions
  readonly: () => boolean
  selectedNodeIds: ReadonlySignal<ReadonlySet<string>>
  drag: DragPreview
  resize: ResizePreview
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  domContexts: DomContextFactory
  endpointStyles: EndpointStyles
}): NodeViews {
  function resolvePorts(
    node: GraphNode,
    schema: NodeDefinition | undefined,
    definition: NodeTypeDefinition | undefined,
  ): GraphPort[] {
    // The protocol resolves definition ports together with parameter input ports.
    if (schema) {
      return resolveDefinitionPorts(node, [schema])
    }

    return cloneValue(node.ports?.length ? node.ports : (definition?.ports ?? []))
  }

  function applyDomContentSize(
    node: GraphNode,
    definition: NodeTypeDefinition | undefined,
    schema: NodeDefinition | undefined,
  ): GraphNode {
    if (definition?.dom === false) {
      return node
    }

    const hasWidth =
      node.width !== undefined || schema?.width !== undefined || definition?.width !== undefined
    const hasHeight =
      node.height !== undefined || schema?.height !== undefined || definition?.height !== undefined

    if (hasWidth && hasHeight) {
      return node
    }

    const constraints = resolveDomNodeSizeConstraints(
      options.domContexts.createStatic(resolveNodeView(node, definition, schema)),
    )

    return {
      ...node,
      ...(hasWidth ? {} : { width: constraints.minWidth }),
      ...(hasHeight ? {} : { height: constraints.minHeight }),
    }
  }

  /**
   * Node definitions of the current store snapshot by type. `GraphStore.getNodeDefinition()`
   * returns an isolated copy per call; one copy per snapshot keeps `schema` identity-stable
   * between store events (registry changes arrive as store events with a new snapshot).
   */
  const schemaResolver = computed(() => {
    void options.graph.value
    const store = options.getStore()
    const schemas = new Map<string, NodeDefinition | undefined>()

    return (type: string): NodeDefinition | undefined => {
      if (!schemas.has(type)) {
        schemas.set(type, store.getNodeDefinition(type))
      }

      return schemas.get(type)
    }
  })

  function resolveRuntimeNode(node: GraphNode): ResolvedNodeView {
    const definition = options.extensions.resolveNodeType(node.type)
    const schema = schemaResolver.value(node.type)
    const sized = applyDomContentSize(
      { ...node, ports: resolvePorts(node, schema, definition) },
      definition,
      schema,
    )

    return resolveNodeView(sized, definition, schema)
  }

  function applyDomMinimumSize(node: ResolvedNodeView): ResolvedNodeView {
    const context = options.domContexts.createStatic(node)

    if (!resolveDomNodeRenderer(node.definition, context)) {
      return node
    }

    const constraints = resolveDomNodeSizeConstraints(context)
    const width = Math.max(node.width, constraints.minWidth)
    const height = Math.max(node.height, constraints.minHeight)

    return width === node.width && height === node.height ? node : { ...node, width, height }
  }

  function createLayoutContext(node: ResolvedNodeView): NodeEngineCanvasNodeLayoutContext {
    return {
      node,
      schema: node.schema,
      definition: node.definition,
      ports: node.ports,
      selected: options.selectedNodeIds.value.has(node.id),
      dragging: options.drag.isNodeDragging(node.id),
      readonly: options.readonly(),
      context: options.renderContext.value,
    }
  }

  /** Moves left/right ports of DOM-rendered nodes onto the rows the DOM model draws them at. */
  function alignPortsWithDomModel(node: ResolvedNodeView, layouts: PortLayout[]): PortLayout[] {
    const keepPosition = (port: PortLayout) => port
    const context = options.domContexts.create({
      node,
      schema: node.schema,
      definition: node.definition,
      bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      selected: options.selectedNodeIds.value.has(node.id),
      dragging: options.drag.isNodeDragging(node.id),
      inputs: options.endpointStyles.decorate(
        layouts.filter((port) => port.port.direction === 'input'),
        keepPosition,
      ),
      outputs: options.endpointStyles.decorate(
        layouts.filter((port) => port.port.direction === 'output'),
        keepPosition,
      ),
    })

    if (!resolveDomNodeRenderer(node.definition, context)) {
      return layouts
    }

    const points = resolveDomPortAnchorPoints(node, resolveDomNodeModel(context))

    if (!points.size) {
      return layouts
    }

    return layouts.map((port) => {
      const point = points.get(port.port.id)
      return point ? { ...port, x: point.x, y: point.y } : port
    })
  }

  const resolvedNodes = computed(() => {
    void options.schemaRevision.value

    return options.graph.value.nodes.map((node) => {
      const resolved = resolveRuntimeNode(node)

      return options.resize.applyToNode(
        applyDomMinimumSize(applyCanvasMeasureToNode(resolved, createLayoutContext(resolved))),
      )
    })
  })

  const nodePortLayouts = computed(() => {
    const entries = new Map<string, NodePortLayouts>()

    for (const node of resolvedNodes.value) {
      const layouts = alignPortsWithDomModel(
        node,
        createPortLayouts(node, createLayoutContext(node)),
      )

      entries.set(node.id, {
        all: layouts,
        inputs: layouts.filter((port) => port.port.direction === 'input'),
        outputs: layouts.filter((port) => port.port.direction === 'output'),
      })
    }

    return entries
  })

  const portLayouts = computed(() => {
    const entries = new Map<string, PortLayout>()

    for (const layout of nodePortLayouts.value.values()) {
      for (const port of layout.all) {
        entries.set(endpointKey(port.endpoint), port)
      }
    }

    return entries
  })

  const nodeBounds = computed(() => {
    const entries = new Map<string, GraphRect>()

    for (const node of resolvedNodes.value) {
      entries.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height })
    }

    return entries
  })

  return {
    resolvedNodes,
    nodePortLayouts,
    portLayouts,
    nodeBounds,
    findNode: (nodeId) => resolvedNodes.value.find((node) => node.id === nodeId),
    resolve: resolveRuntimeNode,
    resolvePorts,
    applyDomContentSize,
  }
}
