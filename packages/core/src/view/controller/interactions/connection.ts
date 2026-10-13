import type {
  ConnectionValidationResult,
  GraphEndpoint,
  GraphPort,
  XYPosition,
} from '../../../protocol/index.js'
import type { GraphStore } from '../../../store/index.js'
import type { PortLayout } from '../../rendering/node-layout.js'
import type { NodeEngineEventSink } from '../../types/index.js'
import type { InteractionState } from '../interaction-state.js'
import { findCreatedEdge } from '../store-binding.js'

export interface ConnectionCandidate {
  source: GraphEndpoint
  target: GraphEndpoint
  validation: ConnectionValidationResult
}

/**
 * Dragging a new edge out of a port. Edges can start from either side: dragging from an input
 * looks for an output, and the pair is always validated as source → target.
 */
export interface ConnectionGesture {
  targetDirection: () => GraphPort['direction'] | null
  /** Validates connecting the dragged port with `target`; null when no connection is pending. */
  validateTarget: (target: GraphEndpoint) => ConnectionCandidate | null
  start: (
    source: GraphEndpoint,
    originDirection: GraphPort['direction'],
    point: XYPosition,
    event: PointerEvent,
  ) => boolean
  update: (point: XYPosition, target: PortLayout | null) => void
  previewTarget: (target: PortLayout | null) => boolean
  /** Connects the dragged port to `target`; false when it has the wrong direction. */
  finish: (target: PortLayout) => boolean
  /** Ends the gesture on pointer release, connecting the snapped target when committing. */
  complete: (screenPoint: XYPosition, commit: boolean) => void
}

export function createConnectionGesture(options: {
  state: InteractionState
  getStore: () => GraphStore
  readonly: () => boolean
  beginPointerSession: (event: PointerEvent) => void
  emit: NodeEngineEventSink
}): ConnectionGesture {
  const { connection, connectionTarget } = options.state

  function targetDirection(): GraphPort['direction'] | null {
    const state = connection.value

    if (!state) {
      return null
    }

    return state.originDirection === 'output' ? 'input' : 'output'
  }

  function pair(anchor: GraphEndpoint, direction: GraphPort['direction'], other: GraphEndpoint) {
    return direction === 'output'
      ? { source: anchor, target: other }
      : { source: other, target: anchor }
  }

  function validateTarget(target: GraphEndpoint): ConnectionCandidate | null {
    const state = connection.value

    if (!state) {
      return null
    }

    const endpoints = pair(state.source, state.originDirection, target)

    return {
      ...endpoints,
      validation: options.getStore().validateConnection(endpoints.source, endpoints.target),
    }
  }

  function emitPreview(): void {
    const state = connection.peek()
    const direction = targetDirection()

    if (!state || !direction) {
      return
    }

    const target = connectionTarget.peek()?.endpoint

    options.emit('connection-preview', {
      source: state.source,
      target,
      originDirection: state.originDirection,
      targetDirection: direction,
      point: state.current,
      validation: target ? validateTarget(target)?.validation : undefined,
      graph: options.getStore().getSnapshot(),
    })
  }

  function clear(): void {
    connection.value = null
    connectionTarget.value = null
  }

  function finish(targetPort: PortLayout): boolean {
    const state = connection.peek()

    if (!state || options.readonly() || targetPort.port.direction !== targetDirection()) {
      return false
    }

    const { source, target } = pair(state.source, state.originDirection, targetPort.endpoint)
    const store = options.getStore()
    const before = store.getSnapshot()
    const validation = store.connect(source, target)
    const after = store.getSnapshot()

    if (validation.valid) {
      options.emit('connection-end', {
        source,
        target,
        edge: findCreatedEdge(before, after),
        validation,
        graph: after,
      })
    } else {
      options.emit('connection-invalid', { source, target, validation, graph: after })
    }

    clear()
    return true
  }

  return {
    targetDirection,
    validateTarget,
    start(source, originDirection, point, event) {
      if (event.button !== 0 || options.readonly()) {
        return false
      }

      options.beginPointerSession(event)
      connection.value = { source, originDirection, start: { ...point }, current: { ...point } }
      connectionTarget.value = null

      const store = options.getStore()

      options.emit('connection-start', {
        source,
        sourceNode: store.getNode(source.nodeId),
        sourcePort: store.getPort(source),
        originDirection,
        targetDirection: originDirection === 'output' ? 'input' : 'output',
        point: { ...point },
        graph: store.getSnapshot(),
      })
      return true
    },
    update(point, target) {
      const state = connection.peek()

      if (!state) {
        return
      }

      connection.value = { ...state, current: point }
      connectionTarget.value = target
      emitPreview()
    },
    previewTarget(target) {
      const state = connection.peek()

      if (!state || (target && target.port.direction !== targetDirection())) {
        return false
      }

      connectionTarget.value = target

      if (target) {
        connection.value = { ...state, current: { x: target.x, y: target.y } }
      }

      emitPreview()
      return true
    },
    finish,
    complete(screenPoint, commit) {
      const target = connectionTarget.peek()
      const committed = commit && target !== null && finish(target)
      const state = connection.peek()
      const direction = targetDirection()

      if (!committed && state && direction) {
        const store = options.getStore()

        options.emit('connection-cancel', {
          source: state.source,
          sourceNode: store.getNode(state.source.nodeId),
          sourcePort: store.getPort(state.source),
          originDirection: state.originDirection,
          targetDirection: direction,
          startPoint: state.start,
          point: state.current,
          screenPoint,
          dragDistance: Math.hypot(
            state.current.x - state.start.x,
            state.current.y - state.start.y,
          ),
          graph: store.getSnapshot(),
        })
      }

      clear()
    },
  }
}
