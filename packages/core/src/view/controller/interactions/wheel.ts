import type { XYPosition } from '../../../protocol/index.js'
import { clamp } from '../../rendering/geometry.js'
import type { NodeEngineWheelBehavior, ViewportState } from '../../types/index.js'
import type { FrameScheduler } from '../frame-scheduler.js'
import type { InteractionState } from '../interaction-state.js'
import { viewportEquals } from '../viewport.js'
import type { ViewportInteraction } from './viewport-gestures.js'

type WheelSource = 'wheel.pan' | 'wheel.zoom'

const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
const LINE_HEIGHT_PX = 16
const ZOOM_SENSITIVITY = 0.0018
const ZOOM_EASING = 0.72
const PAN_DECAY = 0.82
const MAX_PAN_VELOCITY = 96
const SETTLE_DELAY_MS = 96
const FRAME_MS = 16.667

/**
 * Wheel zoom (anchored at the pointer) and wheel pan. With inertia the wheel eases toward its
 * target; the preview lives in `wheelViewport` and is committed once the wheel settles. Wheel
 * input during a background pan re-bases the pan instead.
 */
export interface WheelGesture {
  handleWheel: (event: WheelEvent, root: HTMLElement) => void
  /** Stops the animation; commits the previewed viewport unless `commit` is false. */
  cancel: (config?: { commit?: boolean }) => void
}

export function createWheelGesture(options: {
  state: InteractionState
  getViewport: () => ViewportState
  getLiveViewport: () => ViewportState
  getZoomRange: () => { minZoom: number; maxZoom: number }
  getBehavior: () => NodeEngineWheelBehavior
  getInertia: () => boolean
  hasActiveGesture: () => boolean
  getScreenPoint: (event: WheelEvent) => XYPosition
  screenToGraph: (point: XYPosition) => XYPosition
  setViewport: (viewport: ViewportState, source: string) => void
  interaction: ViewportInteraction
  getScheduler: () => FrameScheduler | null
  /** Paints the current preview immediately in this animation frame. */
  drawNow: (timestamp: number) => void
  closeContextMenu: () => void
}): WheelGesture {
  const { wheelViewport, pan } = options.state
  let animationFrame: number | null = null
  let animationTimestamp = 0
  let zoomTarget: number | null = null
  let zoomAnchor: { pointer: XYPosition; graphPoint: XYPosition } | null = null
  let commitSource: WheelSource | null = null
  let settleTimeout: number | null = null
  const panVelocity = { x: 0, y: 0 }

  function baseViewport(): ViewportState {
    return wheelViewport.peek() ?? options.getViewport()
  }

  function zoomAround(
    viewport: ViewportState,
    zoom: number,
    pointer: XYPosition,
    graphPoint: XYPosition,
  ): ViewportState {
    const range = options.getZoomRange()
    const nextZoom = clamp(zoom, range.minZoom, range.maxZoom)

    return {
      ...viewport,
      zoom: nextZoom,
      x: pointer.x - graphPoint.x * nextZoom,
      y: pointer.y - graphPoint.y * nextZoom,
    }
  }

  function applyPreview(viewport: ViewportState, source: WheelSource, timestamp?: number): void {
    wheelViewport.value = viewport
    commitSource = source

    if (timestamp !== undefined) {
      options.drawNow(timestamp)
    }

    options.interaction.update(source)
    scheduleSettle()
  }

  function cancel(config: { commit?: boolean } = {}): void {
    const scheduler = options.getScheduler()

    if (animationFrame !== null) {
      scheduler?.cancelFrame(animationFrame)
      animationFrame = null
    }

    clearSettle()
    const preview = wheelViewport.peek()
    const source = commitSource ?? 'wheel.zoom'

    animationTimestamp = 0
    zoomTarget = null
    zoomAnchor = null
    commitSource = null
    panVelocity.x = 0
    panVelocity.y = 0

    if (config.commit !== false && preview && !viewportEquals(preview, options.getViewport())) {
      options.setViewport(preview, source)
    }

    wheelViewport.value = null
    options.interaction.end('wheel.pan')
    options.interaction.end('wheel.zoom')
  }

  function scheduleAnimation(): void {
    const scheduler = options.getScheduler()

    if (animationFrame === null && scheduler) {
      animationFrame = scheduler.requestFrame(runAnimationFrame)
    }
  }

  function runAnimationFrame(timestamp: number): void {
    animationFrame = null
    const frameDelta = animationTimestamp
      ? Math.min((timestamp - animationTimestamp) / FRAME_MS, 3)
      : 1
    animationTimestamp = timestamp
    let next = baseViewport()
    let source: WheelSource | null = null
    let animating = false

    if (zoomTarget !== null && zoomAnchor) {
      const easing = 1 - Math.pow(ZOOM_EASING, frameDelta)
      const zoom =
        Math.abs(zoomTarget - next.zoom) < 0.001
          ? zoomTarget
          : next.zoom + (zoomTarget - next.zoom) * easing

      next = zoomAround(next, zoom, zoomAnchor.pointer, zoomAnchor.graphPoint)
      source = 'wheel.zoom'
      animating = Math.abs(zoomTarget - next.zoom) >= 0.001

      if (!animating) {
        zoomTarget = null
        zoomAnchor = null
      }
    }

    if (Math.abs(panVelocity.x) >= 0.01 || Math.abs(panVelocity.y) >= 0.01) {
      next = {
        ...next,
        x: next.x + panVelocity.x * frameDelta,
        y: next.y + panVelocity.y * frameDelta,
      }
      source ??= 'wheel.pan'
      const decay = Math.pow(PAN_DECAY, frameDelta)
      panVelocity.x *= decay
      panVelocity.y *= decay
      animating = true
    }

    if (source) {
      applyPreview(next, source, timestamp)
    }

    if (animating) {
      scheduleAnimation()
      return
    }

    cancel()
  }

  function resolveIntent(event: WheelEvent): 'zoom' | 'pan' {
    const behavior = options.getBehavior()

    if (behavior === 'mixed') {
      return event.shiftKey ? 'pan' : 'zoom'
    }

    return behavior
  }

  function normalizeDelta(event: WheelEvent, root: HTMLElement): XYPosition {
    if (event.deltaMode === DOM_DELTA_LINE) {
      return { x: event.deltaX * LINE_HEIGHT_PX, y: event.deltaY * LINE_HEIGHT_PX }
    }

    if (event.deltaMode === DOM_DELTA_PAGE) {
      return { x: event.deltaX * root.clientWidth, y: event.deltaY * root.clientHeight }
    }

    return { x: event.deltaX, y: event.deltaY }
  }

  /** Wheel input while dragging the background re-bases the pan at the current pointer. */
  function applyDuringPan(intent: 'zoom' | 'pan', event: WheelEvent, root: HTMLElement): boolean {
    const state = pan.peek()

    if (!state) {
      return false
    }

    cancel({ commit: false })

    const delta = normalizeDelta(event, root)
    const live = options.getLiveViewport()
    const pointer = options.getScreenPoint(event)
    const viewportStart =
      intent === 'pan'
        ? { ...live, x: live.x - delta.x, y: live.y - delta.y }
        : zoomAround(
            live,
            live.zoom * Math.exp(-delta.y * ZOOM_SENSITIVITY),
            pointer,
            options.screenToGraph(pointer),
          )

    pan.value = { ...state, viewportStart, pointerStart: { ...state.current } }
    options.drawNow(now())
    options.interaction.update('pan')
    return true
  }

  function scheduleSettle(): void {
    const scheduler = options.getScheduler()

    clearSettle()

    if (!scheduler) {
      return
    }

    settleTimeout = scheduler.setTimeout(() => {
      settleTimeout = null

      if (animationFrame === null) {
        cancel()
      }
    }, SETTLE_DELAY_MS)
  }

  function clearSettle(): void {
    if (settleTimeout !== null) {
      options.getScheduler()?.clearTimeout(settleTimeout)
      settleTimeout = null
    }
  }

  function now(): number {
    return options.getScheduler()?.now() ?? 0
  }

  return {
    handleWheel(event, root) {
      event.preventDefault()
      options.closeContextMenu()

      if (event.ctrlKey) {
        cancel()
        return
      }

      const intent = resolveIntent(event)
      const gestureActive = options.hasActiveGesture()

      if (applyDuringPan(intent, event, root)) {
        return
      }

      options.interaction.begin(intent === 'pan' ? 'wheel.pan' : 'wheel.zoom')
      const delta = normalizeDelta(event, root)

      if (intent === 'pan') {
        if (options.getInertia() && !gestureActive) {
          panVelocity.x = clamp(panVelocity.x - delta.x, -MAX_PAN_VELOCITY, MAX_PAN_VELOCITY)
          panVelocity.y = clamp(panVelocity.y - delta.y, -MAX_PAN_VELOCITY, MAX_PAN_VELOCITY)
          scheduleAnimation()
        } else {
          const base = baseViewport()
          applyPreview({ ...base, x: base.x - delta.x, y: base.y - delta.y }, 'wheel.pan', now())
        }

        return
      }

      const pointer = options.getScreenPoint(event)
      const graphPoint = options.screenToGraph(pointer)
      const range = options.getZoomRange()
      const zoom = clamp(
        (zoomTarget ?? baseViewport().zoom) * Math.exp(-delta.y * ZOOM_SENSITIVITY),
        range.minZoom,
        range.maxZoom,
      )

      if (options.getInertia() && !gestureActive) {
        zoomTarget = zoom
        zoomAnchor = { pointer, graphPoint }
        scheduleAnimation()
        return
      }

      applyPreview(zoomAround(baseViewport(), zoom, pointer, graphPoint), 'wheel.zoom', now())
    },
    cancel,
  }
}
