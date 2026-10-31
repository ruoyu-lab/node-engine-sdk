import { resolveNodeAccent } from '../dom-model/definition.js'
import { batch, computed, effect, signal } from '../reactive.js'
import { getGraphBounds } from '../rendering/node-layout.js'
import type {
  NodeWrightApi,
  NodeWrightEditorController,
  NodeWrightEditorHost,
  NodeWrightEditorOptions,
  NodeWrightHistoryState,
  NodeWrightRenderContext,
} from '../types/index.js'
import { createEditorApi } from './api.js'
import { createCanvasGestures } from './canvas-gestures.js'
import { createCanvasLayers } from './canvas-layers.js'
import { createClipboardModel } from './clipboard.js'
import { createContextMenuModel } from './context-menu.js'
import { createEditorCoordinates } from './coordinates.js'
import { createDomContextFactory } from './dom-contexts.js'
import { createDomLayer, type DomLayer } from './dom-layer.js'
import { createDomNodeApis } from './dom-node-api.js'
import { createEdgeCommands } from './edge-commands.js'
import { createEndpointStyles } from './endpoint-styles.js'
import { createEventEmitter } from './events.js'
import { createEditorExtensions } from './extensions.js'
import { createGeometryQueries } from './geometry-queries.js'
import { createEditorGestures } from './gestures.js'
import { createGroupCommands } from './group-commands.js'
import { createCanvasHitTester } from './hit-test.js'
import { createBuiltInHotkeys, createKeyboardController } from './hotkeys.js'
import { createInteractionMode, type InteractionMode } from './interaction-mode.js'
import { createInteractionState, hasActiveGesture } from './interaction-state.js'
import { createConnectionGesture } from './interactions/connection.js'
import { createDragPreview } from './interactions/drag.js'
import { createResizePreview } from './interactions/resize.js'
import { createViewportInteraction } from './interactions/viewport-gestures.js'
import { createLivePreview } from './live-preview.js'
import { createMinimap } from './minimap.js'
import { createNodeCommands } from './node-commands.js'
import { createNodeEditorModel } from './node-editor.js'
import { createNodeViews } from './node-views.js'
import { resolveEditorOptions } from './options.js'
import { createEditorSettings } from './editor-settings.js'
import { createHostBinding } from './host-binding.js'
import { createRenderScheduler, type RenderScheduler } from './render-scheduler.js'
import { createSelectionModel } from './selection.js'
import { createNodeStackOrder } from './stack-order.js'
import { createStoreBinding } from './store-binding.js'
import { resolveGridState } from './theme.js'
import { createViewSnapshot } from './view-snapshot.js'
import { createViewportCommands } from './viewport-commands.js'
import { createViewportModel } from './viewport.js'
import { createEditorVisibility, type RenderSurface } from './visibility.js'

/**
 * Creates a framework-independent node editor. The controller owns all editor state and input
 * handling; UI adapters render `getSnapshot()`, re-render on `subscribe`, pass their props to
 * `update()` and hand the rendered elements to `mount()`.
 */
export function createEditorController(
  input: NodeWrightEditorOptions = {},
): NodeWrightEditorController {
  const settings = createEditorSettings(input)
  const { options, readonly, isReadonly, behaviors, groupBehaviors, getSnapping, getZoomRange } =
    settings
  const { graphTheme, nodeTheme, edgeTheme, groupTheme } = settings
  const emit = createEventEmitter(() => options.peek().onEvent)
  const host = signal<NodeWrightEditorHost | null>(null)
  const getScheduler = () => hostBinding.scheduler()

  const binding = createStoreBinding({ initial: options.peek(), emit })
  const getStore = () => binding.store.value
  const viewport = createViewportModel({
    initial: options.peek().initialViewport,
    getZoomRange,
    getStore,
    emit,
  })
  const selection = createSelectionModel({
    initial: options.peek().initialSelection,
    graph: binding.graph.peek(),
    getStore,
    emit,
  })
  const state = createInteractionState()
  const gridVisible = signal(options.peek().gridVisible)
  const surface = signal<RenderSurface>({ width: 0, height: 0, dpr: 1 })
  const coordinates = createEditorCoordinates({ viewport: viewport.viewport, state, host })
  const { liveViewport } = coordinates

  const clipboard = createClipboardModel({
    selection: selection.selection,
    getStore,
    getHooks: () => options.peek(),
    getBounds: (nodes) => getGraphBounds(nodes.map(nodeViews.resolve)),
    setSelection: selection.set,
    closeContextMenu: () => contextMenu.close(),
    emit,
  })
  const extensions = createEditorExtensions({
    options,
    builtInHotkeys: createBuiltInHotkeys(clipboard.hasContent),
  })
  const history = computed<NodeWrightHistoryState>(() => {
    void binding.graph.value
    const store = getStore()

    return { canUndo: store.canUndo, canRedo: store.canRedo }
  })
  const renderContext = computed<NodeWrightRenderContext>(() => ({
    graph: binding.graph.value,
    selection: selection.selection.value,
    viewport: liveViewport.value,
    readonly: readonly.value,
    api,
    history: history.value,
    rootElement: host.value?.root ?? null,
    screenToGraph: coordinates.screenToGraph,
    clientToGraph: coordinates.clientToGraph,
    graphToScreen: coordinates.graphToScreen,
  }))

  const dragPreview = createDragPreview({ drag: state.drag, getSnapping })
  const resizePreview = createResizePreview({
    nodeResize: state.nodeResize,
    groupResize: state.groupResize,
    getSnapping,
    getNodeConstraints: (nodeId) => domLayer.getResizeConstraints(nodeId),
  })
  const live = createLivePreview({
    getStore,
    liveViewport,
    drag: dragPreview,
    resize: resizePreview,
    getInteractionState: () => interactionMode.getState(),
  })
  const domContexts = createDomContextFactory({
    readonly: isReadonly,
    nodeStatus: () => settings.nodeStatus.value,
    coordinates,
    state,
    theme: nodeTheme,
    renderContext,
    selectedNodeIds: selection.selectedNodeIds,
    drag: dragPreview,
  })
  const endpointStyles = createEndpointStyles({
    graph: binding.graph,
    getStore,
    defaultStroke: computed(() => edgeTheme.value.stroke),
    execStroke: computed(() => edgeTheme.value.execStroke),
    resolveAccent: (node) => resolveNodeAccent(node, extensions.resolveNodeType(node.type)),
  })
  const nodeViews = createNodeViews({
    graph: binding.graph,
    schemaRevision: binding.schemaRevision,
    getStore,
    extensions,
    readonly: isReadonly,
    selectedNodeIds: selection.selectedNodeIds,
    drag: dragPreview,
    resize: resizePreview,
    renderContext,
    domContexts,
    endpointStyles,
  })
  const stackOrder = createNodeStackOrder(() => binding.graph.peek())
  const visibility = createEditorVisibility({
    graph: binding.graph,
    schemaRevision: binding.schemaRevision,
    getStore,
    surface,
    liveViewport,
    cullPadding: computed(() => settings.performance.value.cullPadding),
    selection: selection.selection,
    selectedNodeIds: selection.selectedNodeIds,
    nodeViews,
    extensions,
    endpointStyles,
    drag: dragPreview,
    live,
    stackOrder,
    groupBehaviors,
    graphTheme,
    edgeTheme,
  })

  const nodes = createNodeCommands({
    getStore,
    extensions,
    nodeViews,
    resizePreview,
    getSnapping,
    emit,
  })
  const edges = createEdgeCommands({ getStore, emit })
  const groups = createGroupCommands({
    getStore,
    getSnapping,
    getMinimumSize: settings.getGroupMinimumSize,
  })
  const connection = createConnectionGesture({
    state,
    getStore,
    readonly: isReadonly,
    beginPointerSession: (event) => gestures.beginPointerSession(event),
    emit,
  })
  const domLayer: DomLayer = createDomLayer({
    graph: binding.graph,
    getStore,
    visibleNodes: visibility.nodes,
    nodeViews,
    extensions,
    domContexts,
    state,
    connection,
    getResolvePortValue: () => options.peek().resolvePortValue,
    getApi: () => api,
    getDomApi: (nodeId) => domNodeApis.get(nodeId),
  })
  const getCanvasContext = () => {
    const ctx = host.peek()?.canvas.getContext('2d')

    if (!ctx) {
      throw new Error('NodeWright canvas has no 2D rendering context.')
    }

    return ctx
  }
  const gridState = computed(() =>
    resolveGridState({
      viewport: liveViewport.value,
      gridVisible: gridVisible.value,
      gridSize: options.value.gridSize,
      behavior: behaviors.value.grid,
    }),
  )
  const canvasLayers = createCanvasLayers({
    surface,
    liveViewport,
    gridState,
    gridColors: settings.gridColors,
    visibleEdges: visibility.edges,
    visibleGroups: visibility.groups,
    paintedNodes: domLayer.paintedNodes,
    portLayouts: nodeViews.portLayouts,
    state,
    readonly: isReadonly,
    connectionPreview: () => options.value.connectionPreview,
    graphTheme,
    edgeTheme,
    groupTheme,
    nodeTheme,
    renderContext,
    endpointStyles,
    live,
    getCanvasContext,
  })
  const geometry = createGeometryQueries({
    getStore,
    nodeViews,
    coordinates,
    endpointStyles,
    drag: dragPreview,
    live,
    headerHeight: computed(() => groupBehaviors.value.headerHeight),
  })
  const hitTester = createCanvasHitTester({
    screenToGraph: coordinates.screenToGraph,
    zoom: () => liveViewport.value.zoom,
    nodes: visibility.nodes,
    groups: visibility.groups,
    edges: canvasLayers.edges,
    getStore,
    state,
    readonly: isReadonly,
    groupBehaviors,
    nodeTheme,
    groupTheme,
    renderContext,
    getCanvasContext,
    connectionTargetDirection: connection.targetDirection,
    validateConnectionTarget: connection.validateTarget,
  })
  const nodeEditor = createNodeEditorModel({
    graph: binding.graph,
    getStore,
    extensions,
    behavior: settings.editorBehavior,
    readonly: isReadonly,
    selection: selection.selection,
    renderContext,
    getScreenBounds: (nodeId) => geometry.nodeBounds(nodeId, 'screen'),
    emit,
  })
  const contextMenu = createContextMenuModel({
    renderContext,
    toolbarItems: extensions.toolbarItems,
    contextMenuItems: extensions.contextMenuItems,
    screenToGraph: coordinates.screenToGraph,
    createDefaultEvent: () => new MouseEvent('click'),
    emit,
  })
  const interactionMode: InteractionMode = createInteractionMode({
    state,
    liveViewport,
    editingNodeId: computed(() => nodeEditor.active.value?.nodeId ?? nodeEditor.manualNodeId.value),
  })

  const { pan, wheel, marquee, drag, resize, frame } = createEditorGestures({
    state,
    settings,
    getStore,
    viewport,
    coordinates,
    selection,
    nodeViews,
    visibleEdges: visibility.edges,
    live,
    nodes,
    groups,
    resizePreview,
    connection,
    findConnectionTarget: hitTester.findConnectionTarget,
    getScheduler,
    drawNow: (timestamp) => renderScheduler.drawNow(timestamp),
    closeContextMenu: () => contextMenu.close(),
    emit,
  })
  const gestures = createCanvasGestures({
    host,
    state,
    getStore,
    readonly: isReadonly,
    behaviors,
    getScreenPoint: coordinates.getScreenPoint,
    screenToGraph: coordinates.screenToGraph,
    hitTester,
    nodeViews,
    geometry,
    selection,
    stackOrder,
    nodeEditor,
    contextMenu,
    edges,
    groups,
    drag,
    resize,
    marquee,
    connection,
    pan,
    wheel,
    frame,
    emit,
  })
  const viewportCommands = createViewportCommands({
    host,
    viewport,
    geometry,
    getSelection: () => selection.selection.peek(),
    getStore,
    getZoomRange,
  })
  const domNodeApis = createDomNodeApis({
    getStore,
    extensions,
    nodeViews,
    getDomLayer: () => domLayer,
    geometry,
    gestures,
    selection,
    viewportCommands,
    nodes,
    nodeEditor,
    resizePreview,
  })
  const renderScheduler: RenderScheduler = createRenderScheduler({
    surface,
    performanceOptions: settings.performance,
    gridFrame: canvasLayers.gridFrame,
    canvasFrame: canvasLayers.canvasFrame,
    getMetrics: () => {
      const graph = binding.graph.peek()
      const domNodeCount = domLayer.nodes.peek().length
      const paintedNodeCount = domLayer.paintedNodes.peek().length

      return {
        renderMode: domNodeCount && paintedNodeCount ? 'hybrid' : domNodeCount ? 'dom' : 'canvas',
        mode: interactionMode.mode.peek(),
        totalNodes: graph.nodes.length,
        visibleNodes: visibility.nodes.peek().length,
        totalEdges: graph.edges.length,
        visibleEdges: visibility.edges.peek().length,
        totalGroups: graph.groups.length,
        visibleGroups: visibility.groups.peek().length,
      }
    },
    emit,
  })
  const api: NodeWrightApi = createEditorApi({
    getStore,
    viewport,
    viewportCommands,
    coordinates,
    selection,
    marquee,
    nodes,
    edges,
    groups,
    geometry,
    live,
    clipboard,
    nodeEditor,
    contextMenu,
    interaction: interactionMode,
    gridVisible,
    gridState,
    performanceSample: renderScheduler.performanceSample,
    emit,
  })
  const keyboard = createKeyboardController({
    spacePressed: state.spacePressed,
    hotkeys: extensions.hotkeys,
    renderContext,
  })
  const minimap = createMinimap({
    options,
    graph: binding.graph,
    schemaRevision: binding.schemaRevision,
    nodeTypes: extensions.nodeTypes,
    nodeRenderer: computed(() => extensions.renderers.value.node),
    resolvedNodes: () => nodeViews.resolvedNodes.value,
    groupHeaderHeight: computed(() => groupBehaviors.value.headerHeight),
    selectedNodeIds: selection.selectedNodeIds,
    graphTheme,
    surface,
    liveViewport,
    preview: state.minimapViewport,
    getViewport: () => viewport.viewport.peek(),
    setViewport: (patch, source) => {
      viewport.set(patch, source)
    },
    interaction: createViewportInteraction({
      source: state.viewportSource,
      emit,
      buildEvent: live.viewportEvent,
    }),
    canStart: () => !hasActiveGesture(state),
    prepare: () => {
      wheel.cancel()
      contextMenu.close()
    },
    drawNow: (timestamp) => renderScheduler.drawNow(timestamp),
  })
  const viewSnapshot = createViewSnapshot({
    graph: binding.graph,
    selection: selection.selection,
    readonly,
    colorScheme: settings.colorScheme,
    gridState,
    interaction: interactionMode.interaction,
    nodeEditor: nodeEditor.active,
    contextMenu: contextMenu.state,
    renderContext,
    rootStyle: settings.rootStyle,
    cursor: interactionMode.cursor,
    liveViewport,
    state,
    domNodes: domLayer.nodes,
    accessibleNodes: domLayer.accessibleNodes,
    marqueeStyle: computed(() => {
      const marqueeState = state.marquee.value
      return marqueeState ? coordinates.toScreenBox(marqueeState.start, marqueeState.current) : null
    }),
    overlayVisible: renderScheduler.overlayVisible,
    overlayDismissible: computed(() => settings.performance.value.overlayDismissible),
    performanceSample: renderScheduler.performanceSample,
    minimap: minimap.state,
  })

  binding.onBeforeReplace(() => {
    gestures.cancelSession()
    domLayer.reset()
    stackOrder.reset()
  })
  binding.onBind((graph) => {
    selection.rebase(graph)
    contextMenu.close()
  })
  binding.onSnapshot((graph) => {
    domLayer.prune(graph)
    stackOrder.prune(graph)
    domNodeApis.prune(graph)
  })
  binding.onGraphChanged((graph) => selection.reconcile(graph))
  const stopNodeEditor = nodeEditor.start()

  const hostBinding = createHostBinding({
    host,
    keyboard,
    wheel,
    gestures,
    frame,
    getRenderScheduler: () => renderScheduler,
  })
  const listeners = new Set<() => void>()
  let stopNotifications: (() => void) | null = null
  let destroyed = false

  function assertUsable(action: string): void {
    if (destroyed) {
      throw new Error(`Cannot ${action} a destroyed NodeWright editor controller.`)
    }
  }

  /** Notifies subscribers once per batch in which the snapshot changed. */
  function startNotifications(): () => void {
    let initialized = false

    return effect(() => {
      void viewSnapshot.value

      if (initialized) {
        for (const listener of [...listeners]) {
          listener()
        }
      }

      initialized = true
    })
  }

  return {
    api,
    getSnapshot: () => viewSnapshot.peek(),
    subscribe(listener) {
      listeners.add(listener)
      stopNotifications ??= startNotifications()

      return () => {
        listeners.delete(listener)

        if (!listeners.size && stopNotifications) {
          stopNotifications()
          stopNotifications = null
        }
      }
    },
    update(next) {
      assertUsable('update')
      batch(() => {
        const previous = options.peek()
        const resolved = resolveEditorOptions(next)

        options.value = resolved
        binding.applyOptions(previous, resolved)

        if (resolved.gridVisible !== previous.gridVisible) {
          gridVisible.value = resolved.gridVisible
        }
      })
    },
    mount(target) {
      assertUsable('mount')
      hostBinding.mount(target)
      emit('mount', api)
    },
    unmount: hostBinding.unmount,
    destroy() {
      if (destroyed) {
        return
      }

      minimap.unmount()
      hostBinding.unmount()
      stopNodeEditor()
      stopNotifications?.()
      stopNotifications = null
      listeners.clear()
      binding.dispose()
      destroyed = true
    },
    mountMinimap(target) {
      assertUsable('mount the minimap of')
      return minimap.mount(target)
    },
    selectAccessibleNode(nodeId) {
      batch(() => {
        selection.set({ nodes: [nodeId], edges: [] }, 'accessibility.node.select')
      })
    },
    hidePerformanceOverlay() {
      batch(() => renderScheduler.hideOverlay())
    },
  }
}
