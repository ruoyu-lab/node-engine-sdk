import type { GraphSnapshot, NodeDefinition } from '@node-wright/core/protocol'
import type { NodeWrightRunResult } from '@node-wright/core/runtime'
import type {
  NodeWrightConnectionCancelEvent,
  NodeWrightNodeStatus,
  NodeWrightResolvePortValueContext,
  SelectionState,
  ViewportState,
} from '@node-wright/core/view'
import { NodeWright, type NodeWrightDomComponent, type NodeWrightHandle } from '@node-wright/react'
import { measureCanvasArea, type CanvasArea } from '@playground/shared/app/canvas-insets'
import {
  applyDocumentTheme,
  canvasThemes,
  resolveInitialTheme,
  toggleCanvasTheme,
  type CanvasThemeId,
} from '@playground/shared/app/canvas-themes'
import {
  createNodeFromConnectionMenu,
  openConnectionCreateMenu,
  resolveConnectionCreateMenuStyle,
  type ConnectionCreateMenu,
  type ConnectionCreateOption,
} from '@playground/shared/app/connection-create-menu'
import {
  EMPTY_SELECTION,
  NO_HISTORY,
  PLAYGROUND_MINIMAP,
  PLAYGROUND_PERFORMANCE,
  PLAYGROUND_WHEEL_BEHAVIOR,
  applyScenarioLayout,
  fitGraph,
  readHistory,
  resetScenarioGraph,
  zoomIn,
  zoomOut,
  type HistoryAvailability,
} from '@playground/shared/app/editor-commands'
import {
  describeImportError,
  downloadGraphFile,
  parseGraphFile,
} from '@playground/shared/app/graph-file'
import { resolveDemoPortValue } from '@playground/shared/app/port-values'
import {
  NO_NODE_STATUS,
  applyRunResultToGraph,
  resolveRunNodeStatus,
} from '@playground/shared/app/run-result'
import { resolveInitialShellLayout } from '@playground/shared/app/shell-layout'
import { AI_IMAGE_DISPLAY_DOM_COMPONENT } from '@playground/shared/business/ai-image'
import {
  canRunScenario,
  describeRunError,
  runDemoScenario,
  type DemoRuntimeLogEntry,
} from '@playground/shared/demo/runtime'
import {
  demoScenarios,
  getDemoScenario,
  type DemoScenarioId,
} from '@playground/shared/demo/scenarios'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react'
import { AiImageDisplayNode } from '../business/ai-image/AiImageDisplayNode'
import { DemoRuntimePanel } from '../components/DemoRuntimePanel'
import { DemoSidebar } from '../components/DemoSidebar'
import { EditorToolbar } from '../components/EditorToolbar'
import { StatusBar } from '../components/StatusBar'
import { ZoomControls } from '../components/ZoomControls'

const domComponents: Readonly<Record<string, NodeWrightDomComponent>> = {
  [AI_IMAGE_DISPLAY_DOM_COMPONENT]: AiImageDisplayNode,
}

type EditorRef = RefObject<NodeWrightHandle | null>

function requireApi(editor: EditorRef): NodeWrightHandle {
  if (!editor.current) {
    throw new Error('The playground editor is not mounted.')
  }

  return editor.current
}

function canvasArea(): CanvasArea {
  return measureCanvasArea(document)
}

export function App(): ReactElement {
  const editor = useRef<NodeWrightHandle>(null)
  const [initialLayout] = useState(() => resolveInitialShellLayout(window))
  const [activeScenarioId, setActiveScenarioId] = useState<DemoScenarioId>('ai-image')
  const activeScenario = getDemoScenario(activeScenarioId)
  const [graph, setGraph] = useState<GraphSnapshot>(() => activeScenario.graph())
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION)
  const [runtimeResult, setRuntimeResult] = useState<NodeWrightRunResult | null>(null)
  const [runtimeEvents, setRuntimeEvents] = useState<DemoRuntimeLogEntry[]>([])
  const [nodeStatus, setNodeStatus] =
    useState<Readonly<Record<string, NodeWrightNodeStatus>>>(NO_NODE_STATUS)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [runtimeRunning, setRuntimeRunning] = useState(false)
  const [connectionCreateMenu, setConnectionCreateMenu] = useState<ConnectionCreateMenu | null>(
    null,
  )
  const [themeId, setThemeId] = useState<CanvasThemeId>(() => resolveInitialTheme(window))
  const [navExpanded, setNavExpanded] = useState(initialLayout.navExpanded)
  const [panelOpen, setPanelOpen] = useState(initialLayout.panelOpen)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [performanceOverlay, setPerformanceOverlay] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<HistoryAvailability>(NO_HISTORY)

  const nodeDefinitions: NodeDefinition[] = activeScenario.preset.nodeDefinitions
  const selectedNodeId = selection.nodes[0]
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedDefinition = selectedNode
    ? (nodeDefinitions.find((definition) => definition.type === selectedNode.type) ?? null)
    : null
  const canRun = canRunScenario(activeScenario)

  useLayoutEffect(() => applyDocumentTheme(document, themeId), [themeId])

  const resolvePortValue = useCallback(
    (context: NodeWrightResolvePortValueContext) =>
      resolveDemoPortValue(context, runtimeResult, activeScenario),
    [runtimeResult, activeScenario],
  )

  /**
   * Each scenario mounts its own editor: it starts fitted into the area the panels leave free, and
   * the toolbar reads zoom and history from it. StrictMode's simulated remount mounts a second
   * editor, which is fitted the same way.
   */
  function onEditorMount(api: NodeWrightHandle): void {
    fitGraph(api, canvasArea())
    setZoom(api.view.get().zoom)
    setHistory(readHistory(api))
  }

  function clearRunState(): void {
    setRuntimeResult(null)
    setRuntimeEvents([])
    setNodeStatus(NO_NODE_STATUS)
    setErrorMessage(null)
  }

  /** Another scenario remounts the editor with its graph; the active one is reset in place. */
  function selectScenario(id: DemoScenarioId): void {
    if (id === activeScenarioId) {
      resetScenario()
      return
    }

    setConnectionCreateMenu(null)
    clearRunState()
    setActiveScenarioId(id)
    setGraph(getDemoScenario(id).graph())
    setSelection(EMPTY_SELECTION)
  }

  function resetScenario(): void {
    setConnectionCreateMenu(null)
    clearRunState()
    resetScenarioGraph(requireApi(editor), activeScenario, canvasArea())
  }

  function layoutScenario(): void {
    applyScenarioLayout(requireApi(editor), activeScenario, canvasArea())
  }

  function fitScenario(): void {
    fitGraph(requireApi(editor), canvasArea())
  }

  async function runScenario(): Promise<void> {
    if (!canRun || runtimeRunning) {
      return
    }

    setRuntimeRunning(true)
    setErrorMessage(null)
    setNodeStatus(NO_NODE_STATUS)

    try {
      const run = await runDemoScenario(activeScenario, graph, nodeDefinitions, setNodeStatus)
      setRuntimeResult(run.result)
      setRuntimeEvents(run.events)
      setNodeStatus(resolveRunNodeStatus(run.result))
      setGraph((current) => applyRunResultToGraph(current, run.result))
    } catch (error) {
      setRuntimeResult(null)
      setNodeStatus(NO_NODE_STATUS)
      setErrorMessage(describeRunError(error))
    } finally {
      setRuntimeRunning(false)
    }
  }

  function onGraphChange(nextGraph: GraphSnapshot): void {
    setGraph(nextGraph)
    setHistory(readHistory(requireApi(editor)))
  }

  function onViewportChange(viewport: ViewportState): void {
    setZoom(viewport.zoom)
  }

  function onConnectionCancel(event: NodeWrightConnectionCancelEvent): void {
    setConnectionCreateMenu(
      openConnectionCreateMenu(
        event,
        { width: window.innerWidth, height: window.innerHeight },
        activeScenario,
      ),
    )
  }

  function closeConnectionCreateMenu(): void {
    setConnectionCreateMenu(null)
  }

  function createNodeFromMenu(menu: ConnectionCreateMenu, option: ConnectionCreateOption): void {
    const result = createNodeFromConnectionMenu(requireApi(editor), menu, option)

    setErrorMessage('error' in result ? result.error : null)
    setConnectionCreateMenu(null)
  }

  function exportGraph(): void {
    downloadGraphFile(requireApi(editor).graph.export(), activeScenario)
  }

  async function importGraph(file: File): Promise<void> {
    try {
      requireApi(editor).graph.import(parseGraphFile(await file.text()))
      setErrorMessage(null)
      fitScenario()
    } catch (error) {
      setErrorMessage(describeImportError(error))
    }
  }

  const shellClassName = [
    'app-shell',
    navExpanded ? '' : 'app-shell--nav-collapsed',
    panelOpen ? '' : 'app-shell--panel-collapsed',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={shellClassName} data-theme={themeId} onPointerDown={closeConnectionCreateMenu}>
      <NodeWright
        key={activeScenario.id}
        ref={editor}
        className="app-shell__graph"
        ariaLabel="节点编辑器"
        graph={graph}
        nodeDefinitions={nodeDefinitions}
        nodeTypes={activeScenario.preset.nodeTypes}
        plugins={activeScenario.preset.plugins}
        initialViewport={activeScenario.preset.initialViewport}
        theme={canvasThemes[themeId].theme}
        nodeStatus={nodeStatus}
        minimap={PLAYGROUND_MINIMAP}
        performance={
          performanceOverlay ? PLAYGROUND_PERFORMANCE.overlay : PLAYGROUND_PERFORMANCE.sampling
        }
        resolvePortValue={resolvePortValue}
        wheelBehavior={PLAYGROUND_WHEEL_BEHAVIOR}
        domComponents={domComponents}
        onMount={onEditorMount}
        onGraphChange={onGraphChange}
        onViewportChange={onViewportChange}
        onSelectionChange={setSelection}
        onNodeClick={closeConnectionCreateMenu}
        onConnectionStart={closeConnectionCreateMenu}
        onConnectionCancel={onConnectionCancel}
      />

      <DemoSidebar
        scenarios={demoScenarios}
        activeId={activeScenario.id}
        expanded={navExpanded}
        onSelect={selectScenario}
        onToggle={() => setNavExpanded((expanded) => !expanded)}
      />

      <EditorToolbar
        canRun={canRun}
        running={runtimeRunning}
        history={history}
        theme={themeId}
        onRun={() => void runScenario()}
        onLayout={layoutScenario}
        onFit={fitScenario}
        onReset={resetScenario}
        onUndo={() => requireApi(editor).history.undo()}
        onRedo={() => requireApi(editor).history.redo()}
        onImport={(file) => void importGraph(file)}
        onExport={exportGraph}
        onToggleTheme={() => setThemeId(toggleCanvasTheme)}
      />

      <DemoRuntimePanel
        scenario={activeScenario}
        graph={graph}
        selectedNode={selectedNode}
        selectedDefinition={selectedDefinition}
        result={runtimeResult}
        events={runtimeEvents}
        error={errorMessage}
        running={runtimeRunning}
        canRun={canRun}
        open={panelOpen}
        onToggle={() => setPanelOpen((open) => !open)}
      />

      <ZoomControls
        zoom={zoom}
        onZoomOut={() => zoomOut(requireApi(editor))}
        onZoomIn={() => zoomIn(requireApi(editor))}
      />

      <StatusBar
        shortcutsOpen={shortcutsOpen}
        performanceOverlay={performanceOverlay}
        onToggleShortcuts={() => setShortcutsOpen((open) => !open)}
        onTogglePerformance={() => setPerformanceOverlay((overlay) => !overlay)}
      />

      {connectionCreateMenu ? (
        <div
          className="connection-create-menu"
          role="group"
          aria-label="新建并连接节点"
          style={resolveConnectionCreateMenuStyle(connectionCreateMenu)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="connection-create-menu__title" aria-hidden="true">
            新建并连接
          </span>
          {connectionCreateMenu.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="connection-create-menu__item"
              onClick={() => createNodeFromMenu(connectionCreateMenu, option)}
            >
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </main>
  )
}
