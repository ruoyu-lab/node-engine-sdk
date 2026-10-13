import type { XYPosition } from '../../protocol/index.js'
import { signal, type ReadonlySignal } from '../reactive.js'
import type {
  NodeEngineContextMenuContext,
  NodeEngineContextMenuItem,
  NodeEngineContextMenuState,
  NodeEngineContextTarget,
  NodeEngineEventSink,
  NodeEngineRenderContext,
  NodeEngineResolvedContextMenuItem,
  NodeEngineResolvedToolbarItem,
  NodeEngineToolbarItem,
} from '../types/index.js'

/**
 * Context menu state and the resolution of toolbar and context menu contributions against the
 * current render context. The editor tracks which menu is open; adapters render it.
 */
export interface ContextMenuModel {
  readonly state: ReadonlySignal<NodeEngineContextMenuState | null>
  open: (target: NodeEngineContextTarget, position: XYPosition) => void
  close: () => void
  getState: () => NodeEngineContextMenuState | null
  resolveToolbar: () => NodeEngineResolvedToolbarItem[]
  resolveContext: (
    target: NodeEngineContextTarget,
    position: XYPosition,
  ) => NodeEngineResolvedContextMenuItem[]
}

export function createContextMenuModel(options: {
  renderContext: ReadonlySignal<NodeEngineRenderContext>
  toolbarItems: ReadonlySignal<NodeEngineToolbarItem[]>
  contextMenuItems: ReadonlySignal<NodeEngineContextMenuItem[]>
  screenToGraph: (point: XYPosition) => XYPosition
  createDefaultEvent: () => MouseEvent
  emit: NodeEngineEventSink
}): ContextMenuModel {
  const state = signal<NodeEngineContextMenuState | null>(null)

  function createContext(
    target: NodeEngineContextTarget,
    position: XYPosition,
  ): NodeEngineContextMenuContext {
    return {
      ...options.renderContext.peek(),
      position,
      graphPosition: options.screenToGraph(position),
      target,
    }
  }

  function visibleItems(context: NodeEngineContextMenuContext): NodeEngineContextMenuItem[] {
    return options.contextMenuItems
      .peek()
      .filter((item) => (item.visible ? item.visible(context) : true))
  }

  function getState(): NodeEngineContextMenuState | null {
    const current = state.peek()

    if (!current) {
      return null
    }

    return {
      graphPosition: { ...current.graphPosition },
      position: { ...current.position },
      items: [...current.items],
      target: current.target,
    }
  }

  return {
    state,
    open(target, position) {
      const context = createContext(target, position)
      const items = visibleItems(context)

      if (!items.length) {
        state.value = null
        return
      }

      const next: NodeEngineContextMenuState = {
        position,
        graphPosition: context.graphPosition,
        items,
        target,
      }

      state.value = next
      options.emit('context-menu-open', next)
    },
    close() {
      const previous = getState()
      state.value = null
      options.emit('context-menu-close', previous)
    },
    getState,
    resolveToolbar() {
      const context = options.renderContext.peek()
      const isDisabled = (item: NodeEngineToolbarItem) =>
        item.disabled ? item.disabled(options.renderContext.peek()) : false

      return options.toolbarItems
        .peek()
        .filter((item) => (item.visible ? item.visible(context) : true))
        .map((item) => ({
          id: item.id,
          label: item.label,
          title: item.title,
          order: item.order,
          kind: item.kind,
          disabled: isDisabled(item),
          run: (event) => {
            if (!isDisabled(item)) {
              item.run(options.renderContext.peek(), event ?? options.createDefaultEvent())
            }
          },
        }))
    },
    resolveContext(target, position) {
      const context = createContext(target, position)

      return visibleItems(context).map((item) => ({
        id: item.id,
        label: item.label,
        title: item.title,
        order: item.order,
        disabled: item.disabled ? item.disabled(context) : false,
        run: (event) => item.run(context, event ?? options.createDefaultEvent()),
      }))
    },
  }
}
