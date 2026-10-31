import type { GraphStore } from '../../store/index.js'
import type {
  ConnectionValidator,
  EdgeDefinition,
  GraphCommandRegistryEntry,
  GraphSnapshot,
  NodeDefinition,
} from '../../protocol/index.js'
import type {
  EdgeTypeRegistry,
  NodeWrightAfterImportHook,
  NodeWrightBeforeImportHook,
  NodeWrightBehaviors,
  NodeWrightCanvasRenderers,
  NodeWrightContextMenuItem,
  NodeWrightDeserializeHook,
  NodeWrightEdgeRendererContribution,
  NodeWrightEditorOptions,
  NodeWrightEventListener,
  NodeWrightGroupRendererContribution,
  NodeWrightHotkey,
  NodeWrightMinimapOptions,
  NodeWrightNodeEditorRegistry,
  NodeWrightNodeStatus,
  NodeWrightPerformanceOptions,
  NodeWrightPlugin,
  NodeWrightResolvePortValueHook,
  NodeWrightSerializeHook,
  NodeWrightTheme,
  NodeWrightToolbarItem,
  NodeWrightWheelBehavior,
  NodeTypeRegistry,
  SelectionState,
  ViewportState,
} from '../types/index.js'

/**
 * Editor options with every default applied. Defaults for collections are shared frozen values
 * so that an omitted option keeps the same identity across `update()` calls.
 */
export interface ResolvedEditorOptions {
  graph?: GraphSnapshot
  store?: GraphStore
  initialViewport?: Partial<ViewportState>
  initialSelection?: Partial<SelectionState>
  nodeTypes: NodeTypeRegistry
  nodeEditors: NodeWrightNodeEditorRegistry
  edgeTypes: EdgeTypeRegistry
  renderers: Partial<NodeWrightCanvasRenderers>
  nodeDefinitions: readonly NodeDefinition[]
  edgeDefinitions: readonly EdgeDefinition[]
  commands: readonly GraphCommandRegistryEntry[]
  plugins: readonly NodeWrightPlugin[]
  groupRenderers: readonly NodeWrightGroupRendererContribution[]
  edgeRenderers: readonly NodeWrightEdgeRendererContribution[]
  toolbarItems: readonly NodeWrightToolbarItem[]
  contextMenuItems: readonly NodeWrightContextMenuItem[]
  hotkeys: readonly NodeWrightHotkey[]
  connectionValidator?: ConnectionValidator
  theme: Partial<NodeWrightTheme>
  nodeStatus: Readonly<Record<string, NodeWrightNodeStatus>>
  behaviors: Partial<NodeWrightBehaviors>
  performance: Partial<NodeWrightPerformanceOptions>
  canvasBackground: string
  readonly: boolean
  gridVisible: boolean
  gridColor: string
  gridSize: number
  snapToGrid: boolean
  minZoom: number
  maxZoom: number
  connectionPreview: boolean
  wheelBehavior: NodeWrightWheelBehavior
  wheelInertia: boolean
  /** `null` while the minimap is off. */
  minimap: ResolvedMinimapOptions | null
  resolvePortValue?: NodeWrightResolvePortValueHook
  serializeGraph?: NodeWrightSerializeHook
  deserializeGraph?: NodeWrightDeserializeHook
  beforeImport?: NodeWrightBeforeImportHook
  afterImport?: NodeWrightAfterImportHook
  onEvent?: NodeWrightEventListener
}

export type ResolvedMinimapOptions = Readonly<Required<NodeWrightMinimapOptions>>

const NONE: readonly never[] = Object.freeze([])
const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({})

const DEFAULT_GRID_SIZE = 24
const DEFAULT_MIN_ZOOM = 0.2
const DEFAULT_MAX_ZOOM = 2.5
const DEFAULT_MINIMAP: ResolvedMinimapOptions = Object.freeze({
  width: 200,
  height: 136,
  padding: 8,
})

/** Options a `GraphStore` owns; the editor only builds a store from them when none is given. */
const STORE_OWNED_OPTIONS = [
  'graph',
  'nodeDefinitions',
  'edgeDefinitions',
  'commands',
  'connectionValidator',
] as const satisfies ReadonlyArray<keyof NodeWrightEditorOptions>

export function resolveEditorOptions(input: NodeWrightEditorOptions): ResolvedEditorOptions {
  assertStoreLayering(input)

  return {
    graph: input.graph,
    store: input.store,
    initialViewport: input.initialViewport,
    initialSelection: input.initialSelection,
    nodeTypes: input.nodeTypes ?? EMPTY_RECORD,
    nodeEditors: input.nodeEditors ?? EMPTY_RECORD,
    edgeTypes: input.edgeTypes ?? EMPTY_RECORD,
    renderers: input.renderers ?? EMPTY_RECORD,
    nodeDefinitions: input.nodeDefinitions ?? NONE,
    edgeDefinitions: input.edgeDefinitions ?? NONE,
    commands: input.commands ?? NONE,
    plugins: input.plugins ?? NONE,
    groupRenderers: input.groupRenderers ?? NONE,
    edgeRenderers: input.edgeRenderers ?? NONE,
    toolbarItems: input.toolbarItems ?? NONE,
    contextMenuItems: input.contextMenuItems ?? NONE,
    hotkeys: input.hotkeys ?? NONE,
    connectionValidator: input.connectionValidator,
    theme: input.theme ?? EMPTY_RECORD,
    nodeStatus: input.nodeStatus ?? EMPTY_RECORD,
    behaviors: input.behaviors ?? EMPTY_RECORD,
    performance: input.performance ?? EMPTY_RECORD,
    canvasBackground: input.canvasBackground ?? '',
    readonly: input.readonly ?? false,
    gridVisible: input.gridVisible ?? true,
    gridColor: input.gridColor ?? '',
    gridSize: input.gridSize ?? DEFAULT_GRID_SIZE,
    snapToGrid: input.snapToGrid ?? false,
    minZoom: input.minZoom ?? DEFAULT_MIN_ZOOM,
    maxZoom: input.maxZoom ?? DEFAULT_MAX_ZOOM,
    connectionPreview: input.connectionPreview ?? true,
    wheelBehavior: input.wheelBehavior ?? 'zoom',
    wheelInertia: input.wheelInertia ?? true,
    minimap: resolveMinimapOptions(input.minimap),
    resolvePortValue: input.resolvePortValue,
    serializeGraph: input.serializeGraph,
    deserializeGraph: input.deserializeGraph,
    beforeImport: input.beforeImport,
    afterImport: input.afterImport,
    onEvent: input.onEvent,
  }
}

/** `true` uses the default size; a missing or invalid size falls back to its default. */
function resolveMinimapOptions(
  input: NodeWrightEditorOptions['minimap'],
): ResolvedMinimapOptions | null {
  if (!input) {
    return null
  }

  if (input === true) {
    return DEFAULT_MINIMAP
  }

  return {
    width: isPositive(input.width) ? input.width : DEFAULT_MINIMAP.width,
    height: isPositive(input.height) ? input.height : DEFAULT_MINIMAP.height,
    padding:
      input.padding !== undefined && Number.isFinite(input.padding) && input.padding >= 0
        ? input.padding
        : DEFAULT_MINIMAP.padding,
  }
}

function isPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

/**
 * A provided `store` owns the graph and every registry, so the editor never registers into it:
 * passing a store-owned option next to `store` is an error instead of a silently ignored value.
 * Plugins still contribute their editor `components`; a plugin that also contributes to the store
 * (`contributes` / `setup`) must already be registered in the provided store.
 */
function assertStoreLayering(input: NodeWrightEditorOptions): void {
  const store = input.store

  if (!store) {
    return
  }

  const ownedOptions = STORE_OWNED_OPTIONS.filter((key) => input[key] !== undefined)
  const unregisteredPlugins = (input.plugins ?? []).filter(
    (plugin) =>
      (plugin.contributes !== undefined || plugin.setup !== undefined) &&
      !store.hasPlugin(plugin.name),
  )
  const problems = [
    ...(ownedOptions.length
      ? [
          `${ownedOptions.join(', ')} belong to the provided store; pass them to createGraphStore() instead.`,
        ]
      : []),
    ...unregisteredPlugins.map(
      (plugin) =>
        `plugin "${plugin.name}" contributes to the store but is not registered in the provided store.`,
    ),
  ]

  if (problems.length) {
    throw new Error(`Invalid editor options with an external store: ${problems.join(' ')}`)
  }
}
