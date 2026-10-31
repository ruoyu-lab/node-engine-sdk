import type { GraphSnapshot } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import type { NodeWrightDomNodeApi } from '../types/index.js'
import type { CanvasGestures } from './canvas-gestures.js'
import type { DomLayer } from './dom-layer.js'
import type { EditorExtensions } from './extensions.js'
import type { GeometryQueries } from './geometry-queries.js'
import type { ResizePreview } from './interactions/resize.js'
import type { NodeCommands } from './node-commands.js'
import type { NodeEditorModel } from './node-editor.js'
import type { NodeViews } from './node-views.js'
import type { SelectionModel } from './selection.js'
import type { ViewportCommands } from './viewport-commands.js'

/**
 * The API a DOM node component uses to talk to its editor, bound to one node. One instance per
 * node id is kept so components receive a stable reference.
 */
export interface DomNodeApis {
  get: (nodeId: string) => NodeWrightDomNodeApi
  prune: (graph: GraphSnapshot) => void
}

export function createDomNodeApis(options: {
  getStore: () => GraphStore
  extensions: EditorExtensions
  nodeViews: NodeViews
  getDomLayer: () => DomLayer
  geometry: GeometryQueries
  gestures: CanvasGestures
  selection: SelectionModel
  viewportCommands: ViewportCommands
  nodes: NodeCommands
  nodeEditor: NodeEditorModel
  resizePreview: ResizePreview
}): DomNodeApis {
  const apis = new Map<string, NodeWrightDomNodeApi>()

  function create(nodeId: string): NodeWrightDomNodeApi {
    const store = options.getStore

    return {
      getNode: () => store().getNode(nodeId),
      getSchema: () => {
        const node = store().getNode(nodeId)
        return node ? store().getNodeDefinition(node.type) : undefined
      },
      getDefinition: () => {
        const node = store().getNode(nodeId)
        return node ? options.extensions.resolveNodeType(node.type) : undefined
      },
      getBounds: (space = 'graph') => {
        const context = options.getDomLayer().getContext(nodeId)

        if (!context) {
          return null
        }

        return space === 'screen' ? context.screenBounds : context.bounds
      },
      getContext: () => options.getDomLayer().getContext(nodeId),
      getModel: () => options.getDomLayer().getModel(nodeId),
      focus: options.gestures.focus,
      interaction: {
        pointerDown: (event) => options.gestures.domNodePointerDown(nodeId, event),
      },
      select(config) {
        options.gestures.focus()
        options.gestures.raiseNode(nodeId)

        if (config?.add) {
          const current = options.selection.selection.peek()

          return options.selection.set(
            { nodes: [...new Set([...current.nodes, nodeId])], edges: current.edges },
            'dom.node.select.add',
          )
        }

        return options.selection.set({ nodes: [nodeId], edges: [] }, 'dom.node.select')
      },
      center: () => options.viewportCommands.centerNode(nodeId),
      fit: (padding) => options.viewportCommands.fitNodes([nodeId], padding),
      update: (patch) => options.nodes.update(nodeId, patch),
      remove: () => options.nodes.remove(nodeId),
      editor: {
        open: () => {
          options.nodeEditor.open(nodeId)
        },
        close: () => options.nodeEditor.closeFor(nodeId),
      },
      params: {
        update: (key, value, config) => options.nodes.updateParam(nodeId, key, value, config),
        set: (params, config) => options.nodes.setParams(nodeId, params, config),
      },
      ports: {
        get: (portId, space = 'graph') => options.geometry.portAnchor({ nodeId, portId }, space),
        startConnection: (portId, event) =>
          options.gestures.startPortConnection(nodeId, portId, event),
        finishConnection: (portId, event) =>
          options.gestures.finishPortConnection(nodeId, portId, event),
        previewConnection: (portId) => options.gestures.previewPortConnection(nodeId, portId),
      },
      resize: {
        get: () => {
          const preview = options.resizePreview.getNodeSize(nodeId)
          const node = options.nodeViews.findNode(nodeId)

          return preview ?? (node ? { width: node.width, height: node.height } : null)
        },
        getConstraints: () => options.getDomLayer().getResizeConstraints(nodeId),
        start: (event, handle = 'se') =>
          options.gestures.nodeResizePointerDown(nodeId, event, handle),
      },
    }
  }

  return {
    get(nodeId) {
      let api = apis.get(nodeId)

      if (!api) {
        api = create(nodeId)
        apis.set(nodeId, api)
      }

      return api
    },
    prune(graph) {
      const nodeIds = new Set(graph.nodes.map((node) => node.id))

      for (const nodeId of apis.keys()) {
        if (!nodeIds.has(nodeId)) {
          apis.delete(nodeId)
        }
      }
    },
  }
}
