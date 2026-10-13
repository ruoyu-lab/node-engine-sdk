import type { XYPosition } from '../../../protocol/index.js'
import type { PortLayout } from '../../rendering/node-layout.js'
import type { FrameScheduler } from '../frame-scheduler.js'
import type { InteractionState } from '../interaction-state.js'
import type { ConnectionGesture } from './connection.js'
import type { DragGesture } from './drag.js'
import type { MarqueeGesture } from './marquee.js'
import type { ResizeGesture } from './resize.js'
import type { PanGesture } from './viewport-gestures.js'

/**
 * Coalesces pointer moves of the active gesture into one update per animation frame. Moves only
 * record the latest pointer; the frame applies it, emits the gesture event and paints. Releasing
 * the pointer flushes the pending update before the gesture finishes.
 */
export interface InteractionFrame {
  /** Records the pointer of the active gesture; false when no gesture is active. */
  queue: (screenPoint: XYPosition) => boolean
  /** Applies the pending update now and finishes every active gesture. */
  finish: (screenPoint: XYPosition, commit: boolean) => void
  cancel: () => void
}

type PendingUpdate =
  | { kind: 'resize'; point: XYPosition }
  | { kind: 'pan'; point: XYPosition }
  | { kind: 'marquee'; point: XYPosition }
  | { kind: 'connection'; point: XYPosition; target: PortLayout | null }
  | { kind: 'drag'; point: XYPosition }

export function createInteractionFrame(options: {
  state: InteractionState
  screenToGraph: (point: XYPosition) => XYPosition
  findConnectionTarget: (screenPoint: XYPosition) => PortLayout | null
  drag: DragGesture
  resize: ResizeGesture
  pan: PanGesture
  marquee: MarqueeGesture
  connection: ConnectionGesture
  getScheduler: () => FrameScheduler | null
  drawNow: (timestamp: number) => void
}): InteractionFrame {
  const { state } = options
  let frame: number | null = null
  let pending: PendingUpdate | null = null

  function resolvePending(screenPoint: XYPosition): PendingUpdate | null {
    if (state.nodeResize.peek() || state.groupResize.peek()) {
      return { kind: 'resize', point: options.screenToGraph(screenPoint) }
    }

    if (state.pan.peek()) {
      return { kind: 'pan', point: screenPoint }
    }

    if (state.marquee.peek()) {
      return { kind: 'marquee', point: options.screenToGraph(screenPoint) }
    }

    if (state.connection.peek()) {
      const target = options.findConnectionTarget(screenPoint)

      return {
        kind: 'connection',
        point: target ? { x: target.x, y: target.y } : options.screenToGraph(screenPoint),
        target,
      }
    }

    if (state.drag.peek()) {
      return { kind: 'drag', point: options.screenToGraph(screenPoint) }
    }

    return null
  }

  function apply(timestamp: number | undefined): void {
    const update = pending
    pending = null

    switch (update?.kind) {
      case 'resize':
        options.resize.update(update.point)
        break
      case 'pan':
        options.pan.update(update.point)

        if (timestamp !== undefined) {
          options.drawNow(timestamp)
        }
        break
      case 'marquee':
        options.marquee.update(update.point)
        break
      case 'connection':
        options.connection.update(update.point, update.target)
        break
      case 'drag':
        options.drag.update(update.point)
        break
      case undefined:
        break
    }
  }

  function cancelFrame(): void {
    if (frame !== null) {
      options.getScheduler()?.cancelFrame(frame)
      frame = null
    }
  }

  return {
    queue(screenPoint) {
      pending = resolvePending(screenPoint)

      if (!pending) {
        return false
      }

      const scheduler = options.getScheduler()

      if (frame === null && scheduler) {
        frame = scheduler.requestFrame((timestamp) => {
          frame = null
          apply(timestamp)
        })
      }

      return true
    },
    finish(screenPoint, commit) {
      if (commit) {
        pending = resolvePending(screenPoint)
      }

      cancelFrame()
      apply(options.getScheduler()?.now())
      options.resize.finish(commit)
      options.drag.finish(commit)
      options.marquee.finish(commit)
      options.connection.complete(screenPoint, commit)
      options.pan.finish(commit)
      pending = null
    },
    cancel() {
      cancelFrame()
      pending = null
    },
  }
}
