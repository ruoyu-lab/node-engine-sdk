import type { GraphStore } from '../../store/index.js'
import type {
  ConnectionValidator,
  EdgeDefinition,
  GraphCommandRegistryEntry,
  GraphSnapshot,
  NodeDefinition,
} from '../../protocol/index.js'

import type {
  NodeEngineBehaviors,
  NodeEngineGridState,
  NodeEngineColorScheme,
  NodeEngineInteractionState,
  NodeEngineNodeStatus,
  NodeEnginePerformanceOptions,
  NodeEnginePerformanceSample,
  NodeEngineRenderContext,
  NodeEngineStyleDeclaration,
  NodeEngineTheme,
  NodeEngineWheelBehavior,
  SelectionState,
  ViewportState,
} from './common.js'
import type { NodeEngineNodeEditorRegistry, NodeEngineNodeEditorState } from './editor.js'
import type { NodeEngineContextMenuState, NodeEngineEventListener } from './events.js'
import type {
  EdgeTypeRegistry,
  NodeEngineAfterImportHook,
  NodeEngineBeforeImportHook,
  NodeEngineContextMenuItem,
  NodeEngineDeserializeHook,
  NodeEngineEdgeRendererContribution,
  NodeEngineGroupRendererContribution,
  NodeEngineHotkey,
  NodeEnginePlugin,
  NodeEngineResolvePortValueHook,
  NodeEngineSerializeHook,
  NodeEngineToolbarItem,
  NodeTypeRegistry,
} from './extensions.js'
import type {
  NodeEngineCanvasRenderers,
  NodeEngineDomNodeClassValue,
  NodeEngineDomNodeProps,
} from './render.js'
import type { NodeEngineApi } from './api.js'

/**
 * Everything that configures an editor. Adapters pass the complete, current options object to
 * `controller.update()` whenever any of them change; `initialViewport` and `initialSelection` are
 * only read when the controller is created.
 */
export interface NodeEngineEditorOptions {
  /** Graph of the editor's own store. Store-owned like the registries below. */
  graph?: GraphSnapshot
  /**
   * An external store. It owns the graph and every registry, so `graph`, `nodeDefinitions`,
   * `edgeDefinitions`, `commands` and `connectionValidator` must be omitted, and plugins that
   * contribute to the store must be registered in it; the editor only reads plugin `components`.
   */
  store?: GraphStore
  initialViewport?: Partial<ViewportState>
  initialSelection?: Partial<SelectionState>
  nodeTypes?: NodeTypeRegistry
  nodeEditors?: NodeEngineNodeEditorRegistry
  edgeTypes?: EdgeTypeRegistry
  renderers?: Partial<NodeEngineCanvasRenderers>
  nodeDefinitions?: NodeDefinition[]
  edgeDefinitions?: EdgeDefinition[]
  commands?: GraphCommandRegistryEntry[]
  plugins?: NodeEnginePlugin[]
  groupRenderers?: NodeEngineGroupRendererContribution[]
  edgeRenderers?: NodeEngineEdgeRendererContribution[]
  toolbarItems?: NodeEngineToolbarItem[]
  contextMenuItems?: NodeEngineContextMenuItem[]
  hotkeys?: NodeEngineHotkey[]
  connectionValidator?: ConnectionValidator
  theme?: Partial<NodeEngineTheme>
  /**
   * Execution status per node id, e.g. from a runtime run. Shown by the default DOM node and
   * passed to DOM renderers as `status`; nodes without an entry are idle. View state only: it
   * never enters the graph or its history.
   */
  nodeStatus?: Readonly<Record<string, NodeEngineNodeStatus>>
  behaviors?: Partial<NodeEngineBehaviors>
  performance?: Partial<NodeEnginePerformanceOptions>
  canvasBackground?: string
  readonly?: boolean
  gridVisible?: boolean
  gridColor?: string
  gridSize?: number
  snapToGrid?: boolean
  minZoom?: number
  maxZoom?: number
  connectionPreview?: boolean
  wheelBehavior?: NodeEngineWheelBehavior
  wheelInertia?: boolean
  /**
   * Shows a minimap of the graph and the visible area: `true` for the default size, or its size
   * options. Off by default; adapters render `snapshot.minimap` and attach it with
   * `mountMinimap()`.
   */
  minimap?: boolean | NodeEngineMinimapOptions
  resolvePortValue?: NodeEngineResolvePortValueHook
  serializeGraph?: NodeEngineSerializeHook
  deserializeGraph?: NodeEngineDeserializeHook
  beforeImport?: NodeEngineBeforeImportHook
  afterImport?: NodeEngineAfterImportHook
  /** Receives every editor event (see `NodeEngineEventMap`). */
  onEvent?: NodeEngineEventListener
}

/** Size of the minimap (see the `minimap` editor option). */
export interface NodeEngineMinimapOptions {
  /** CSS width in pixels; default `200`. */
  width?: number
  /** CSS height in pixels; default `136`. */
  height?: number
  /** Space between the minimap edge and its content, in minimap pixels; default `8`. */
  padding?: number
}

/** The DOM elements an adapter renders for `snapshot.minimap` and hands to `mountMinimap()`. */
export interface NodeEngineMinimapHost {
  /** Focusable minimap container (`ne-minimap`); receives pointer, wheel and keyboard input. */
  root: HTMLElement
  /** Canvas (`ne-minimap__canvas`) the controller paints groups and nodes on. */
  canvas: HTMLCanvasElement
}

/** Minimap view state; adapters render it while the `minimap` option is on. */
export interface NodeEngineMinimapState {
  /** Inline style of the `ne-minimap` container: its CSS `width` and `height`. */
  style: NodeEngineStyleDeclaration
  /**
   * Inline style of `ne-minimap__viewport`, the visible area: a `transform` translation plus
   * `width` and `height`, in minimap pixels. `null` while the editor is not mounted.
   */
  viewportStyle: NodeEngineStyleDeclaration | null
  /** True while the user drags in the minimap; adapters add `ne-minimap--dragging`. */
  dragging: boolean
}

/** The DOM elements an adapter renders and hands to `controller.mount()`. */
export interface NodeEngineEditorHost {
  /** Focusable root element; receives keyboard and wheel input. */
  root: HTMLElement
  /** Interactive canvas that paints edges, groups and canvas nodes. */
  canvas: HTMLCanvasElement
  /** Non-interactive canvas behind `canvas` that paints the grid. */
  gridCanvas: HTMLCanvasElement
}

export interface NodeEngineDomNodeEntry {
  id: string
  /** Key of the DOM node component the adapter renders for this node. */
  component: string
  props: NodeEngineDomNodeProps & Record<string, unknown>
  className?: NodeEngineDomNodeClassValue
  style: NodeEngineStyleDeclaration
}

export interface NodeEngineAccessibleNode {
  id: string
  label: string
  selected: boolean
}

export interface NodeEngineDomLayerState {
  /** True while the viewport is moving; adapters promote the layer to its own compositor layer. */
  composited: boolean
  style: NodeEngineStyleDeclaration
  nodes: NodeEngineDomNodeEntry[]
}

export interface NodeEnginePerformanceOverlayState {
  visible: boolean
  dismissible: boolean
  sample: NodeEnginePerformanceSample | null
}

/**
 * Immutable view state for adapters. `getSnapshot()` returns the same object until something an
 * adapter renders changes, so it can back React's `useSyncExternalStore` or a Vue `shallowRef`.
 */
export interface NodeEngineViewSnapshot {
  graph: GraphSnapshot
  selection: SelectionState
  readonly: boolean
  /** Palette of `theme.colorScheme`; adapters render it as the root's `data-color-scheme`. */
  colorScheme: NodeEngineColorScheme
  /** Grid visibility, steps and style; `gridState.visible` drives the grid canvas. */
  gridState: NodeEngineGridState
  interaction: NodeEngineInteractionState
  nodeEditor: NodeEngineNodeEditorState | null
  contextMenu: NodeEngineContextMenuState | null
  renderContext: NodeEngineRenderContext
  rootStyle: NodeEngineStyleDeclaration
  canvasCursor: string
  domLayer: NodeEngineDomLayerState
  accessibleNodes: NodeEngineAccessibleNode[]
  marqueeStyle: NodeEngineStyleDeclaration | null
  performance: NodeEnginePerformanceOverlayState
  /** Minimap state; `null` while the `minimap` option is off. */
  minimap: NodeEngineMinimapState | null
}

export interface NodeEngineEditorController {
  /** Imperative editor API (graph, view, selection, history, clipboard, menus, ...). */
  readonly api: NodeEngineApi
  getSnapshot: () => NodeEngineViewSnapshot
  /** Notifies after every batch of state changes that may produce a new snapshot. */
  subscribe: (listener: () => void) => () => void
  /** Replaces the complete options object; only changed fields take effect. */
  update: (options: NodeEngineEditorOptions) => void
  /** Attaches input listeners, size observation and canvas painting to the host elements. */
  mount: (host: NodeEngineEditorHost) => void
  /** Detaches from the host elements; the controller can be mounted again. */
  unmount: () => void
  /** Unmounts and releases the controller; it must not be used afterwards. */
  destroy: () => void
  /**
   * Attaches minimap painting and input to the elements an adapter rendered for
   * `snapshot.minimap`, before or after `mount()`. Returns the function that detaches them again;
   * one minimap is attached at a time and `destroy()` detaches it as well.
   */
  mountMinimap: (host: NodeEngineMinimapHost) => () => void
  selectAccessibleNode: (nodeId: string) => void
  hidePerformanceOverlay: () => void
}
