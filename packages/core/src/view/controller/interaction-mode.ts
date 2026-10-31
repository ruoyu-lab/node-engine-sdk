import { cloneValue } from '../../protocol/index.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import type {
  NodeWrightInteractionState,
  NodeWrightPerformanceMode,
  ViewportState,
} from '../types/index.js'
import type { InteractionState } from './interaction-state.js'

/** Summary of what the user is doing right now, and the canvas cursor that goes with it. */
export interface InteractionMode {
  readonly mode: ReadonlySignal<NodeWrightPerformanceMode>
  readonly interaction: ReadonlySignal<NodeWrightInteractionState>
  readonly cursor: ReadonlySignal<string>
  getState: () => NodeWrightInteractionState
}

export function createInteractionMode(options: {
  state: InteractionState
  liveViewport: ReadonlySignal<ViewportState>
  editingNodeId: ReadonlySignal<string | null>
}): InteractionMode {
  const { state } = options

  const mode = computed<NodeWrightPerformanceMode>(() => {
    const source = state.viewportSource.value

    if (state.nodeResize.value || state.groupResize.value || state.drag.value) {
      return 'drag'
    }

    if (state.pan.value || source === 'pan' || source === 'wheel.pan' || source === 'minimap') {
      return 'pan'
    }

    if (source === 'wheel.zoom') {
      return 'zoom'
    }

    if (state.connection.value) {
      return 'connect'
    }

    return state.marquee.value ? 'marquee' : 'idle'
  })

  const interaction = computed<NodeWrightInteractionState>(() => {
    const drag = state.drag.value
    const nodeResize = state.nodeResize.value
    const groupResize = state.groupResize.value

    return {
      mode: mode.value,
      spacePressed: state.spacePressed.value,
      marqueeActive: Boolean(state.marquee.value),
      draggingNodeIds: drag ? [...drag.nodeIds] : [],
      resizingNodeIds: nodeResize ? [nodeResize.nodeId] : [],
      draggingGroupIds: drag ? [...drag.groupIds] : [],
      resizingGroupIds: groupResize ? [groupResize.groupId] : [],
      editingNodeId: options.editingNodeId.value,
      viewport: cloneValue(options.liveViewport.value),
      viewportSource: state.viewportSource.value,
      dragDelta: drag ? cloneValue(drag.lastDelta) : null,
    }
  })

  const cursor = computed(() => {
    if (state.groupResize.value) {
      return 'nwse-resize'
    }

    if (
      state.nodeResize.value ||
      state.drag.value ||
      state.pan.value ||
      state.marquee.value ||
      state.connection.value
    ) {
      return 'grabbing'
    }

    const target = state.hoverTarget.value

    if (target.kind === 'group' && target.areaKind === 'resize-handle') {
      return 'nwse-resize'
    }

    return target.kind === 'group' && target.areaKind === 'drag-handle' ? 'grab' : 'default'
  })

  return {
    mode,
    interaction,
    cursor,
    getState: () => cloneValue(interaction.peek()),
  }
}
