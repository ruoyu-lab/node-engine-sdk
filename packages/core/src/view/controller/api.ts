import { cloneValue } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { batch, type ReadonlySignal, type Signal } from '../reactive.js'
import type {
  NodeWrightApi,
  NodeWrightEventSink,
  NodeWrightGridState,
  NodeWrightPerformanceSample,
} from '../types/index.js'
import type { ClipboardModel } from './clipboard.js'
import type { EditorCoordinates } from './coordinates.js'
import type { ContextMenuModel } from './context-menu.js'
import type { EdgeCommands } from './edge-commands.js'
import type { GeometryQueries } from './geometry-queries.js'
import type { GroupCommands } from './group-commands.js'
import { isGroupCollapsed } from './groups.js'
import type { InteractionMode } from './interaction-mode.js'
import type { MarqueeGesture } from './interactions/marquee.js'
import type { LivePreview } from './live-preview.js'
import type { NodeCommands } from './node-commands.js'
import type { NodeEditorModel } from './node-editor.js'
import type { SelectionModel } from './selection.js'
import type { ViewportCommands } from './viewport-commands.js'
import type { ViewportModel } from './viewport.js'

/** Assembles the imperative editor API. Every method runs as one signal batch. */
export function createEditorApi(options: {
  getStore: () => GraphStore
  viewport: ViewportModel
  viewportCommands: ViewportCommands
  coordinates: EditorCoordinates
  selection: SelectionModel
  marquee: MarqueeGesture
  nodes: NodeCommands
  edges: EdgeCommands
  groups: GroupCommands
  geometry: GeometryQueries
  live: LivePreview
  clipboard: ClipboardModel
  nodeEditor: NodeEditorModel
  contextMenu: ContextMenuModel
  interaction: InteractionMode
  gridVisible: Signal<boolean>
  gridState: ReadonlySignal<NodeWrightGridState>
  performanceSample: ReadonlySignal<NodeWrightPerformanceSample | null>
  emit: NodeWrightEventSink
}): NodeWrightApi {
  const store = options.getStore
  const { selection, contextMenu } = options

  const api: NodeWrightApi = {
    runtime: {
      ids: { create: (prefix) => store().createId(prefix) },
      store: { get: store },
      performance: {
        get: () => {
          const sample = options.performanceSample.peek()
          return sample ? cloneValue(sample) : null
        },
      },
    },
    graph: {
      get: () => store().getSnapshot(),
      getLive: options.live.getGraph,
      set(graph) {
        contextMenu.close()
        return store().replaceGraph(graph, { source: 'api.set-graph' })
      },
      apply(graph) {
        contextMenu.close()
        return store().applyGraph(graph, { source: 'api.apply-graph' })
      },
      export: options.clipboard.serialize,
      import: options.clipboard.importGraph,
      validate: () => store().validateGraph(),
      repair: () => store().repairGraph(),
    },
    view: {
      get: options.viewport.get,
      getLive: options.live.getViewport,
      set: (patch) => options.viewport.set(patch, 'api.set-viewport'),
      fit: {
        graph: options.viewportCommands.fitGraph,
        selection: options.viewportCommands.fitSelection,
        nodes: options.viewportCommands.fitNodes,
      },
      center: {
        node: options.viewportCommands.centerNode,
        selection: options.viewportCommands.centerSelection,
      },
      zoom: { to: options.viewportCommands.zoomTo },
      grid: {
        setVisible: (visible) => {
          options.gridVisible.value = visible
        },
        toggle: () => {
          options.gridVisible.value = !options.gridVisible.peek()
        },
        state: () => cloneValue(options.gridState.peek()),
      },
    },
    coordinates: {
      screenToGraph: options.coordinates.screenToGraph,
      clientToGraph: options.coordinates.clientToGraph,
      graphToScreen: options.coordinates.graphToScreen,
      graphRectToScreenRect: options.coordinates.graphRectToScreenRect,
    },
    selection: {
      get: selection.get,
      set: (patch) => selection.set(patch, 'api.set-selection'),
      clear: () => selection.clear('api.clear-selection'),
      all: () => {
        const graph = store().getSnapshot()

        return selection.set(
          { nodes: graph.nodes.map((node) => node.id), edges: graph.edges.map((edge) => edge.id) },
          'api.select-all',
        )
      },
      nodes: (nodeIds) => selection.set({ nodes: [...nodeIds], edges: [] }, 'api.select-nodes'),
      edges: (edgeIds) => selection.set({ nodes: [], edges: [...edgeIds] }, 'api.select-edges'),
      rect: options.marquee.selectInRect,
      remove() {
        const current = selection.selection.peek()
        const graph = store().transaction(
          'Remove selection',
          () => {
            for (const nodeId of current.nodes) {
              store().removeNode(nodeId, { source: 'selection.remove' })
            }

            for (const edgeId of current.edges) {
              if (store().getEdge(edgeId)) {
                store().removeEdge(edgeId, { source: 'selection.remove' })
              }
            }
          },
          { source: 'selection.remove' },
        )

        selection.clear('selection.remove')
        return graph
      },
    },
    history: {
      canUndo: () => store().canUndo,
      canRedo: () => store().canRedo,
      undo: () => store().undo(),
      redo: () => store().redo(),
    },
    nodes: {
      create: options.nodes.create,
      add: options.nodes.add,
      get: (nodeId) => store().getNode(nodeId),
      getLive: options.live.getNode,
      update: options.nodes.update,
      move: options.nodes.move,
      remove: options.nodes.remove,
      bounds: options.geometry.nodeBounds,
      params: {
        update: options.nodes.updateParam,
        set: options.nodes.setParams,
      },
      editor: {
        open: options.nodeEditor.open,
        close: options.nodeEditor.close,
        state: options.nodeEditor.getState,
      },
    },
    edges: {
      add: options.edges.add,
      get: (edgeId) => store().getEdge(edgeId),
      update: options.edges.update,
      reconnect: options.edges.reconnect,
      disconnect: options.edges.disconnect,
      remove: options.edges.remove,
      connect: options.edges.connect,
      validate: options.edges.validate,
    },
    groups: {
      add: options.groups.add,
      get: (groupId) => store().getGroup(groupId),
      getLive: options.live.getGroup,
      update: options.groups.update,
      move: options.groups.move,
      resize: options.groups.resize,
      collapse: (groupId) => options.groups.setCollapsed(groupId, true),
      expand: (groupId) => options.groups.setCollapsed(groupId, false),
      toggleCollapsed: options.groups.toggleCollapsed,
      isCollapsed: (groupId) => isGroupCollapsed(store().getGroup(groupId)),
      remove: options.groups.remove,
      list: () => store().listGroups(),
      bounds: options.geometry.groupBounds,
    },
    ports: {
      get: (endpoint) => store().getPort(endpoint),
      anchor: options.geometry.portAnchor,
    },
    clipboard: {
      copy: options.clipboard.copySelection,
      paste: options.clipboard.pasteAt,
      duplicate: options.clipboard.duplicateSelection,
    },
    commands: {
      dispatch(commandId, payload) {
        const result = store().dispatchCommand(commandId, payload, { source: 'api' })

        if (!result.applied) {
          options.emit('command-error', {
            commandId,
            payload,
            reason: result.reason,
            validation: result.validation,
            snapshot: result.snapshot,
          })
        }

        return result
      },
      get: (commandId) => store().getCommand(commandId),
      list: () => store().listCommands(),
    },
    definitions: {
      nodes: {
        get: (type) => store().getNodeDefinition(type),
        list: () => store().listNodeDefinitions(),
      },
      edges: {
        get: (type) => store().getEdgeDefinition(type),
        list: () => store().listEdgeDefinitions(),
      },
    },
    diagnostics: {
      list: () => store().listDiagnostics(),
    },
    transactions: {
      mutate: (label, recipe) => store().mutate(label, recipe, { source: 'api.mutate' }),
      run: (label, operation) =>
        store().transaction(label, operation, { source: 'api.transaction' }),
    },
    menu: {
      open: contextMenu.open,
      close: contextMenu.close,
      state: contextMenu.getState,
      resolve: {
        toolbar: contextMenu.resolveToolbar,
        context: contextMenu.resolveContext,
      },
    },
    interaction: {
      state: options.interaction.getState,
    },
  }

  return batchMethods(api)
}

/** Returns a copy of `api` in which every method runs inside one signal batch. */
function batchMethods<T extends object>(api: T): T {
  return Object.fromEntries(
    Object.entries(api).map(([key, value]: [string, unknown]) => [
      key,
      typeof value === 'function'
        ? (...args: unknown[]) => batch(() => (value as (...input: unknown[]) => unknown)(...args))
        : value && typeof value === 'object'
          ? batchMethods(value)
          : value,
    ]),
  ) as T
}
