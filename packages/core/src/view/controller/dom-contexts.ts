import { cloneValue, type GraphNode, type NodeDefinition } from '../../protocol/index.js'
import type { ReadonlySignal } from '../reactive.js'
import type { GraphRect } from '../rendering/geometry.js'
import type { ResolvedNodeView } from '../rendering/node-layout.js'
import type {
  NodeEngineCanvasNodeTheme,
  NodeEngineDomNodeRenderContext,
  NodeEngineNodeStatus,
  NodeEnginePortAnchor,
  NodeEngineRenderContext,
  NodeTypeDefinition,
} from '../types/index.js'
import type { EditorCoordinates } from './coordinates.js'
import type { DragPreview } from './interactions/drag.js'
import type { InteractionState } from './interaction-state.js'

export interface DomContextInput {
  node: GraphNode
  schema?: NodeDefinition
  definition?: NodeTypeDefinition
  bounds: GraphRect
  selected: boolean
  dragging: boolean
  inputs: NodeEnginePortAnchor[]
  outputs: NodeEnginePortAnchor[]
}

/** Builds the render contexts passed to DOM renderer callbacks and DOM node components. */
export interface DomContextFactory {
  create: (input: DomContextInput) => NodeEngineDomNodeRenderContext
  /** Context for sizing before port positions are known: every port anchors at the origin. */
  createStatic: (node: ResolvedNodeView) => NodeEngineDomNodeRenderContext
}

export function createDomContextFactory(options: {
  readonly: () => boolean
  nodeStatus: () => Readonly<Record<string, NodeEngineNodeStatus>>
  coordinates: EditorCoordinates
  state: InteractionState
  theme: ReadonlySignal<NodeEngineCanvasNodeTheme>
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  selectedNodeIds: ReadonlySignal<ReadonlySet<string>>
  drag: DragPreview
}): DomContextFactory {
  function create(input: DomContextInput): NodeEngineDomNodeRenderContext {
    return {
      node: input.node,
      schema: input.schema,
      definition: input.definition,
      bounds: cloneValue(input.bounds),
      screenBounds: options.coordinates.graphRectToScreenRect(input.bounds),
      selected: input.selected,
      dragging: input.dragging,
      status: options.nodeStatus()[input.node.id],
      readonly: options.readonly(),
      zoom: options.coordinates.liveViewport.value.zoom,
      inputs: cloneValue(input.inputs),
      outputs: cloneValue(input.outputs),
      connectionSource: options.state.connection.value?.source,
      connectionTarget: options.state.connectionTarget.value?.endpoint,
      theme: cloneValue(options.theme.value),
      context: options.renderContext.value,
    }
  }

  return {
    create,
    createStatic(node) {
      const inputs: NodeEnginePortAnchor[] = []
      const outputs: NodeEnginePortAnchor[] = []

      for (const port of node.ports) {
        const anchor: NodeEnginePortAnchor = {
          endpoint: { nodeId: node.id, portId: port.id },
          x: node.x,
          y: node.y,
          side: port.side ?? (port.direction === 'input' ? 'left' : 'right'),
          port,
        }

        if (port.direction === 'input') {
          inputs.push(anchor)
        } else {
          outputs.push(anchor)
        }
      }

      return create({
        node,
        schema: node.schema,
        definition: node.definition,
        bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
        selected: options.selectedNodeIds.value.has(node.id),
        dragging: options.drag.isNodeDragging(node.id),
        inputs,
        outputs,
      })
    },
  }
}
