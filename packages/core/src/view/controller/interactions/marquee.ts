import type { GraphSnapshot, XYPosition } from '../../../protocol/index.js'
import type { Signal } from '../../reactive.js'
import { normalizeRect, rectIntersects, type GraphRect } from '../../rendering/geometry.js'
import type {
  NodeWrightEventSink,
  NodeWrightMarqueeGesture,
  NodeWrightSelectionMode,
  SelectionState,
} from '../../types/index.js'
import type { MarqueeState } from '../interaction-state.js'
import { applySelectionMode } from '../selection.js'

/**
 * Rectangle selection, started by the configured gestures (space + drag, middle button, shift +
 * drag). Alt subtracts, Shift/Ctrl/Meta add, otherwise the configured mode applies.
 */
export interface MarqueeGesture {
  shouldStart: (event: PointerEvent) => boolean
  start: (point: XYPosition, event: PointerEvent) => void
  update: (point: XYPosition) => void
  finish: (commit: boolean) => void
  selectInRect: (
    bounds: GraphRect,
    config?: { mode?: NodeWrightSelectionMode; includeEdges?: boolean },
  ) => GraphSnapshot
}

export function createMarqueeGesture(options: {
  marquee: Signal<MarqueeState | null>
  getGestures: () => NodeWrightMarqueeGesture[]
  getDefaultMode: () => NodeWrightSelectionMode
  isSpacePressed: () => boolean
  getGraph: () => GraphSnapshot
  getSelection: () => SelectionState
  getNodes: () => Array<GraphRect & { id: string }>
  getEdgeIdsInRect: (bounds: GraphRect) => string[]
  setSelection: (selection: Partial<SelectionState>, source: string) => GraphSnapshot
  emit: NodeWrightEventSink
}): MarqueeGesture {
  function emit(event: 'marquee-start' | 'marquee' | 'marquee-end', state: MarqueeState): void {
    options.emit(event, {
      start: state.start,
      current: state.current,
      mode: state.mode,
      graph: options.getGraph(),
    })
  }

  function nodeIdsIn(bounds: GraphRect): string[] {
    return options
      .getNodes()
      .filter((node) => rectIntersects(bounds, node))
      .map((node) => node.id)
  }

  function resolveMode(event: PointerEvent): NodeWrightSelectionMode {
    if (event.altKey) {
      return 'subtract'
    }

    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      return 'add'
    }

    return options.getDefaultMode()
  }

  return {
    shouldStart(event) {
      const gestures = new Set(options.getGestures())

      if (event.button === 1) {
        return gestures.has('middle')
      }

      if (event.button !== 0) {
        return false
      }

      if (options.isSpacePressed() && gestures.has('space-left')) {
        return true
      }

      return event.shiftKey && gestures.has('shift-left')
    },
    start(point, event) {
      const state: MarqueeState = { start: point, current: point, mode: resolveMode(event) }

      options.marquee.value = state
      emit('marquee-start', state)
    },
    update(point) {
      const state = options.marquee.peek()

      if (state) {
        const next = { ...state, current: point }
        options.marquee.value = next
        emit('marquee', next)
      }
    },
    finish(commit) {
      const state = options.marquee.peek()

      if (!state) {
        return
      }

      if (commit) {
        const selection = options.getSelection()

        options.setSelection(
          {
            nodes: applySelectionMode(
              selection.nodes,
              nodeIdsIn(normalizeRect(state.start, state.current)),
              state.mode,
            ),
            edges: state.mode === 'replace' ? [] : [...selection.edges],
          },
          'marquee',
        )
      }

      emit('marquee-end', state)
      options.marquee.value = null
    },
    selectInRect(bounds, config) {
      const mode = config?.mode ?? 'replace'
      const selection = options.getSelection()

      return options.setSelection(
        {
          nodes: applySelectionMode(selection.nodes, nodeIdsIn(bounds), mode),
          edges: config?.includeEdges
            ? applySelectionMode(selection.edges, options.getEdgeIdsInRect(bounds), mode)
            : mode === 'replace'
              ? []
              : [...selection.edges],
        },
        'api.select-in-rect',
      )
    },
  }
}
