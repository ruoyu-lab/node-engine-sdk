<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect, type Component } from 'vue'
import type { GraphNode, GraphSnapshot, NodeDefinition } from '@node-wright/core/protocol'
import type { NodeWrightRunResult } from '@node-wright/core/runtime'
import type {
  NodeWrightApi,
  NodeWrightConnectionCancelEvent,
  NodeWrightNodeStatus,
  NodeWrightResolvePortValueContext,
  SelectionState,
  ViewportState,
} from '@node-wright/core/view'
import { NodeWright } from '@node-wright/vue'
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
import AiImageDisplayNode from '../business/ai-image/AiImageDisplayNode.vue'
import DemoRuntimePanel from '../components/DemoRuntimePanel.vue'
import DemoSidebar from '../components/DemoSidebar.vue'
import EditorToolbar from '../components/EditorToolbar.vue'
import StatusBar from '../components/StatusBar.vue'
import ZoomControls from '../components/ZoomControls.vue'

const domComponents: Record<string, Component> = {
  [AI_IMAGE_DISPLAY_DOM_COMPONENT]: AiImageDisplayNode,
}

const initialLayout = resolveInitialShellLayout(window)
const activeScenarioId = ref<DemoScenarioId>('ai-image')
const activeScenario = computed(() => getDemoScenario(activeScenarioId.value))
const graph = shallowRef<GraphSnapshot>(activeScenario.value.graph())
const graphApi = shallowRef<NodeWrightApi | null>(null)
const selection = shallowRef<SelectionState>(EMPTY_SELECTION)
const runtimeResult = shallowRef<NodeWrightRunResult | null>(null)
const runtimeEvents = shallowRef<DemoRuntimeLogEntry[]>([])
const nodeStatus = shallowRef<Readonly<Record<string, NodeWrightNodeStatus>>>(NO_NODE_STATUS)
const errorMessage = ref<string | null>(null)
const runtimeRunning = ref(false)
const connectionCreateMenu = shallowRef<ConnectionCreateMenu | null>(null)
const themeId = ref<CanvasThemeId>(resolveInitialTheme(window))
const navExpanded = ref(initialLayout.navExpanded)
const panelOpen = ref(initialLayout.panelOpen)
const shortcutsOpen = ref(false)
const performanceOverlay = ref(false)
const zoom = ref(1)
const history = shallowRef<HistoryAvailability>(NO_HISTORY)

const nodeDefinitions = computed<NodeDefinition[]>(
  () => activeScenario.value.preset.nodeDefinitions,
)
const selectedNode = computed<GraphNode | null>(() => {
  const selectedNodeId = selection.value.nodes[0]

  return graph.value.nodes.find((node) => node.id === selectedNodeId) ?? null
})
const selectedDefinition = computed<NodeDefinition | null>(() => {
  const node = selectedNode.value

  return node
    ? (nodeDefinitions.value.find((definition) => definition.type === node.type) ?? null)
    : null
})
const canRun = computed(() => canRunScenario(activeScenario.value))
// A new hook per run result makes the editor re-resolve connected fields after each run.
const resolvePortValue = computed(() => {
  const result = runtimeResult.value
  const scenario = activeScenario.value

  return (context: NodeWrightResolvePortValueContext): unknown =>
    resolveDemoPortValue(context, result, scenario)
})

watchEffect(() => applyDocumentTheme(document, themeId.value))

function requireApi(): NodeWrightApi {
  if (!graphApi.value) {
    throw new Error('The playground editor is not mounted.')
  }

  return graphApi.value
}

function canvasArea(): CanvasArea {
  return measureCanvasArea(document)
}

/**
 * Each scenario mounts its own editor: it starts fitted into the area the panels leave free, and
 * the toolbar reads zoom and history from it.
 */
function onEditorMount(api: NodeWrightApi): void {
  fitGraph(api, canvasArea())
  zoom.value = api.view.get().zoom
  history.value = readHistory(api)
}

function clearRunState(): void {
  runtimeResult.value = null
  runtimeEvents.value = []
  nodeStatus.value = NO_NODE_STATUS
  errorMessage.value = null
}

/** Another scenario remounts the editor with its graph; the active one is reset in place. */
function selectScenario(id: DemoScenarioId): void {
  if (id === activeScenarioId.value) {
    resetScenario()
    return
  }

  closeConnectionCreateMenu()
  clearRunState()
  activeScenarioId.value = id
  graph.value = activeScenario.value.graph()
  selection.value = EMPTY_SELECTION
}

function resetScenario(): void {
  closeConnectionCreateMenu()
  clearRunState()
  resetScenarioGraph(requireApi(), activeScenario.value, canvasArea())
}

function layoutScenario(): void {
  applyScenarioLayout(requireApi(), activeScenario.value, canvasArea())
}

function fitScenario(): void {
  fitGraph(requireApi(), canvasArea())
}

async function runScenario(): Promise<void> {
  if (!canRun.value || runtimeRunning.value) {
    return
  }

  runtimeRunning.value = true
  errorMessage.value = null
  nodeStatus.value = NO_NODE_STATUS

  try {
    const run = await runDemoScenario(
      activeScenario.value,
      graph.value,
      nodeDefinitions.value,
      (status) => {
        nodeStatus.value = status
      },
    )
    runtimeResult.value = run.result
    runtimeEvents.value = run.events
    nodeStatus.value = resolveRunNodeStatus(run.result)
    graph.value = applyRunResultToGraph(graph.value, run.result)
  } catch (error) {
    runtimeResult.value = null
    nodeStatus.value = NO_NODE_STATUS
    errorMessage.value = describeRunError(error)
  } finally {
    runtimeRunning.value = false
  }
}

function onGraphChange(nextGraph: GraphSnapshot): void {
  graph.value = nextGraph
  history.value = readHistory(requireApi())
}

function onViewportChange(viewport: ViewportState): void {
  zoom.value = viewport.zoom
}

function onSelectionChange(nextSelection: SelectionState): void {
  selection.value = nextSelection
}

function onConnectionCancel(event: NodeWrightConnectionCancelEvent): void {
  connectionCreateMenu.value = openConnectionCreateMenu(
    event,
    { width: window.innerWidth, height: window.innerHeight },
    activeScenario.value,
  )
}

function closeConnectionCreateMenu(): void {
  connectionCreateMenu.value = null
}

function createNodeFromMenu(menu: ConnectionCreateMenu, option: ConnectionCreateOption): void {
  const result = createNodeFromConnectionMenu(requireApi(), menu, option)

  errorMessage.value = 'error' in result ? result.error : null
  closeConnectionCreateMenu()
}

function toggleTheme(): void {
  themeId.value = toggleCanvasTheme(themeId.value)
}

function exportGraph(): void {
  downloadGraphFile(requireApi().graph.export(), activeScenario.value)
}

async function importGraph(file: File): Promise<void> {
  try {
    requireApi().graph.import(parseGraphFile(await file.text()))
    errorMessage.value = null
    fitScenario()
  } catch (error) {
    errorMessage.value = describeImportError(error)
  }
}
</script>

<template>
  <main
    class="app-shell"
    :class="{
      'app-shell--nav-collapsed': !navExpanded,
      'app-shell--panel-collapsed': !panelOpen,
    }"
    :data-theme="themeId"
    @pointerdown="closeConnectionCreateMenu"
  >
    <NodeWright
      :key="activeScenario.id"
      ref="graphApi"
      class="app-shell__graph"
      aria-label="节点编辑器"
      :graph="graph"
      :node-definitions="nodeDefinitions"
      :node-types="activeScenario.preset.nodeTypes"
      :plugins="activeScenario.preset.plugins"
      :initial-viewport="activeScenario.preset.initialViewport"
      :theme="canvasThemes[themeId].theme"
      :node-status="nodeStatus"
      :minimap="PLAYGROUND_MINIMAP"
      :performance="
        performanceOverlay ? PLAYGROUND_PERFORMANCE.overlay : PLAYGROUND_PERFORMANCE.sampling
      "
      :resolve-port-value="resolvePortValue"
      :wheel-behavior="PLAYGROUND_WHEEL_BEHAVIOR"
      :dom-components="domComponents"
      @mount="onEditorMount"
      @update:graph="onGraphChange"
      @viewport-change="onViewportChange"
      @selection-change="onSelectionChange"
      @node-click="closeConnectionCreateMenu"
      @connection-start="closeConnectionCreateMenu"
      @connection-cancel="onConnectionCancel"
    />

    <DemoSidebar
      :scenarios="demoScenarios"
      :active-id="activeScenario.id"
      :expanded="navExpanded"
      @select="selectScenario"
      @toggle="navExpanded = !navExpanded"
    />

    <EditorToolbar
      :can-run="canRun"
      :running="runtimeRunning"
      :history="history"
      :theme="themeId"
      @run="runScenario"
      @layout="layoutScenario"
      @fit="fitScenario"
      @reset="resetScenario"
      @undo="requireApi().history.undo()"
      @redo="requireApi().history.redo()"
      @import="importGraph"
      @export="exportGraph"
      @toggle-theme="toggleTheme"
    />

    <DemoRuntimePanel
      :scenario="activeScenario"
      :graph="graph"
      :selected-node="selectedNode"
      :selected-definition="selectedDefinition"
      :result="runtimeResult"
      :events="runtimeEvents"
      :error="errorMessage"
      :running="runtimeRunning"
      :can-run="canRun"
      :open="panelOpen"
      @toggle="panelOpen = !panelOpen"
    />

    <ZoomControls :zoom="zoom" @zoom-out="zoomOut(requireApi())" @zoom-in="zoomIn(requireApi())" />

    <StatusBar
      :shortcuts-open="shortcutsOpen"
      :performance-overlay="performanceOverlay"
      @toggle-shortcuts="shortcutsOpen = !shortcutsOpen"
      @toggle-performance="performanceOverlay = !performanceOverlay"
    />

    <div
      v-if="connectionCreateMenu"
      class="connection-create-menu"
      role="group"
      aria-label="新建并连接节点"
      :style="resolveConnectionCreateMenuStyle(connectionCreateMenu)"
      @pointerdown.stop
      @click.stop
    >
      <span class="connection-create-menu__title" aria-hidden="true">新建并连接</span>
      <button
        v-for="option in connectionCreateMenu.options"
        :key="option.id"
        type="button"
        class="connection-create-menu__item"
        @click="createNodeFromMenu(connectionCreateMenu, option)"
      >
        <span>{{ option.label }}</span>
        <small>{{ option.description }}</small>
      </button>
    </div>
  </main>
</template>
