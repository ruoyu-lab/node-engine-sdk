import type { GraphSnapshot } from '../../protocol/index.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import type {
  NodeWrightAccessibleNode,
  NodeWrightColorScheme,
  NodeWrightContextMenuState,
  NodeWrightDomNodeEntry,
  NodeWrightGridState,
  NodeWrightInteractionState,
  NodeWrightMinimapState,
  NodeWrightNodeEditorState,
  NodeWrightPerformanceSample,
  NodeWrightRenderContext,
  NodeWrightStyleDeclaration,
  NodeWrightViewSnapshot,
  SelectionState,
  ViewportState,
} from '../types/index.js'
import type { InteractionState } from './interaction-state.js'

/** Composes the immutable snapshot adapters render; it changes identity only when an input does. */
export function createViewSnapshot(options: {
  graph: ReadonlySignal<GraphSnapshot>
  selection: ReadonlySignal<SelectionState>
  readonly: ReadonlySignal<boolean>
  colorScheme: ReadonlySignal<NodeWrightColorScheme>
  gridState: ReadonlySignal<NodeWrightGridState>
  interaction: ReadonlySignal<NodeWrightInteractionState>
  nodeEditor: ReadonlySignal<NodeWrightNodeEditorState | null>
  contextMenu: ReadonlySignal<NodeWrightContextMenuState | null>
  renderContext: ReadonlySignal<NodeWrightRenderContext>
  rootStyle: ReadonlySignal<NodeWrightStyleDeclaration>
  cursor: ReadonlySignal<string>
  liveViewport: ReadonlySignal<ViewportState>
  state: InteractionState
  domNodes: ReadonlySignal<NodeWrightDomNodeEntry[]>
  accessibleNodes: ReadonlySignal<NodeWrightAccessibleNode[]>
  marqueeStyle: ReadonlySignal<NodeWrightStyleDeclaration | null>
  overlayVisible: ReadonlySignal<boolean>
  overlayDismissible: ReadonlySignal<boolean>
  performanceSample: ReadonlySignal<NodeWrightPerformanceSample | null>
  minimap: ReadonlySignal<NodeWrightMinimapState | null>
}): ReadonlySignal<NodeWrightViewSnapshot> {
  /** The DOM layer is promoted to its own compositor layer while the viewport moves. */
  const composited = computed(() => {
    const source = options.state.viewportSource.value

    return Boolean(
      options.state.pan.value ||
      options.state.wheelViewport.value ||
      options.state.minimapViewport.value ||
      source === 'wheel.zoom' ||
      source === 'wheel.pan',
    )
  })

  const domLayer = computed(() => {
    const viewport = options.liveViewport.value
    const isComposited = composited.value

    return {
      composited: isComposited,
      style: {
        transform: isComposited
          ? `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale3d(${viewport.zoom}, ${viewport.zoom}, 1)`
          : `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        willChange: isComposited ? 'transform' : 'auto',
      },
      nodes: options.domNodes.value,
    }
  })

  const performance = computed(() => ({
    visible: options.overlayVisible.value,
    dismissible: options.overlayDismissible.value,
    sample: options.performanceSample.value,
  }))

  return computed<NodeWrightViewSnapshot>(() => ({
    graph: options.graph.value,
    selection: options.selection.value,
    readonly: options.readonly.value,
    colorScheme: options.colorScheme.value,
    gridState: options.gridState.value,
    interaction: options.interaction.value,
    nodeEditor: options.nodeEditor.value,
    contextMenu: options.contextMenu.value,
    renderContext: options.renderContext.value,
    rootStyle: options.rootStyle.value,
    canvasCursor: options.cursor.value,
    domLayer: domLayer.value,
    accessibleNodes: options.accessibleNodes.value,
    marqueeStyle: options.marqueeStyle.value,
    performance: performance.value,
    minimap: options.minimap.value,
  }))
}
