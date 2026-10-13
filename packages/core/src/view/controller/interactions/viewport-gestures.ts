import type { XYPosition } from '../../../protocol/index.js'
import type { Signal } from '../../reactive.js'
import type {
  NodeEngineEventSink,
  NodeEngineViewportInteractionEvent,
  SelectionState,
  ViewportState,
} from '../../types/index.js'
import { resolvePanViewport, type PanState } from '../interaction-state.js'
import { viewportEquals } from '../viewport.js'

const CLICK_TOLERANCE_PX = 3

/**
 * Lifecycle of a continuous viewport interaction (`pan`, `wheel.zoom`, `wheel.pan`): exactly one
 * source is active, and it is announced with start, update and end events.
 */
export interface ViewportInteraction {
  begin: (source: string) => void
  update: (source: string) => void
  end: (source: string) => void
}

export function createViewportInteraction(options: {
  source: Signal<string | null>
  emit: NodeEngineEventSink
  buildEvent: (source: string) => NodeEngineViewportInteractionEvent
}): ViewportInteraction {
  function begin(source: string): void {
    const active = options.source.peek()

    if (active === source) {
      return
    }

    if (active) {
      end(active)
    }

    options.source.value = source
    options.emit('viewport-interaction-start', options.buildEvent(source))
  }

  function end(source: string): void {
    if (options.source.peek() !== source) {
      return
    }

    options.emit('viewport-interaction-end', options.buildEvent(source))
    options.source.value = null
  }

  return {
    begin,
    update(source) {
      if (options.source.peek() !== source) {
        begin(source)
      }

      options.emit('viewport-interaction', options.buildEvent(source))
    },
    end,
  }
}

/** Dragging the background pans the viewport; a click without movement clears the selection. */
export interface PanGesture {
  start: (pointer: XYPosition, clearSelectionSource: string | null) => void
  update: (pointer: XYPosition) => void
  finish: (commit: boolean) => void
}

export function createPanGesture(options: {
  pan: Signal<PanState | null>
  getViewport: () => ViewportState
  setViewport: (viewport: ViewportState, source: string) => void
  getSelection: () => SelectionState
  clearSelection: (source: string) => void
  interaction: ViewportInteraction
}): PanGesture {
  return {
    start(pointer, clearSelectionSource) {
      const selection = options.getSelection()

      options.pan.value = {
        pointerStart: pointer,
        current: pointer,
        viewportStart: options.getViewport(),
        clearSelectionOnClick:
          clearSelectionSource !== null &&
          (selection.nodes.length > 0 || selection.edges.length > 0),
        clearSelectionSource,
      }
      options.interaction.begin('pan')
    },
    update(pointer) {
      const state = options.pan.peek()

      if (state) {
        options.pan.value = { ...state, current: pointer }
        options.interaction.update('pan')
      }
    },
    finish(commit) {
      const state = options.pan.peek()

      if (!state) {
        return
      }

      const isClick =
        Math.abs(state.current.x - state.pointerStart.x) <= CLICK_TOLERANCE_PX &&
        Math.abs(state.current.y - state.pointerStart.y) <= CLICK_TOLERANCE_PX
      const preview = resolvePanViewport(state)

      if (commit && isClick && state.clearSelectionOnClick && state.clearSelectionSource) {
        options.clearSelection(state.clearSelectionSource)
      }

      if (commit && !viewportEquals(preview, options.getViewport())) {
        options.setViewport(preview, 'pan')
      }

      options.interaction.end('pan')
      options.pan.value = null
    },
  }
}
