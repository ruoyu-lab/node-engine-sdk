export type PointerSessionCancelReason =
  'pointercancel' | 'lostpointercapture' | 'window-blur' | 'replaced' | 'manual' | 'dispose'

export interface PointerSessionCallbacks {
  move: (event: PointerEvent) => void
  finish: (event: PointerEvent) => void
  cancel: (event: PointerEvent, reason: PointerSessionCancelReason) => void
}

type PointerCaptureTarget = EventTarget & {
  setPointerCapture?: (pointerId: number) => void
  releasePointerCapture?: (pointerId: number) => void
  hasPointerCapture?: (pointerId: number) => boolean
}

export interface PointerSession {
  readonly pointerId: number | null
  readonly active: boolean
  matches: (event: PointerEvent) => boolean
  start: (event: PointerEvent) => void
  cancel: (reason?: PointerSessionCancelReason) => void
  dispose: () => void
}

export function createPointerSession(
  eventTarget: EventTarget,
  callbacks: PointerSessionCallbacks,
): PointerSession {
  let activePointerId: number | null = null
  let captureTarget: PointerCaptureTarget | null = null
  let lastEvent: PointerEvent | null = null

  const onPointerMove: EventListener = (event) => {
    if (!isActivePointerEvent(event)) {
      return
    }

    lastEvent = event
    callbacks.move(event)
  }

  const onPointerUp: EventListener = (event) => {
    if (!isActivePointerEvent(event)) {
      return
    }

    lastEvent = event
    complete(event)
  }

  const onPointerCancel: EventListener = (event) => {
    if (!isActivePointerEvent(event)) {
      return
    }

    lastEvent = event
    cancel('pointercancel')
  }

  const onLostPointerCapture: EventListener = (event) => {
    if (!isActivePointerEvent(event)) {
      return
    }

    lastEvent = event
    cancel('lostpointercapture', false)
  }

  const onWindowBlur: EventListener = () => {
    cancel('window-blur')
  }

  function isActivePointerEvent(event: Event): event is PointerEvent {
    return activePointerId !== null && 'pointerId' in event && event.pointerId === activePointerId
  }

  function bind(): void {
    eventTarget.addEventListener('pointermove', onPointerMove)
    eventTarget.addEventListener('pointerup', onPointerUp)
    eventTarget.addEventListener('pointercancel', onPointerCancel)
    eventTarget.addEventListener('blur', onWindowBlur)
    captureTarget?.addEventListener('lostpointercapture', onLostPointerCapture)
  }

  function unbind(releaseCapture: boolean): void {
    const pointerId = activePointerId
    const target = captureTarget

    eventTarget.removeEventListener('pointermove', onPointerMove)
    eventTarget.removeEventListener('pointerup', onPointerUp)
    eventTarget.removeEventListener('pointercancel', onPointerCancel)
    eventTarget.removeEventListener('blur', onWindowBlur)
    target?.removeEventListener('lostpointercapture', onLostPointerCapture)

    activePointerId = null
    captureTarget = null
    lastEvent = null

    if (
      releaseCapture &&
      pointerId !== null &&
      target?.releasePointerCapture &&
      target.hasPointerCapture?.(pointerId)
    ) {
      target.releasePointerCapture(pointerId)
    }
  }

  function complete(event: PointerEvent): void {
    unbind(true)
    callbacks.finish(event)
  }

  function cancel(reason: PointerSessionCancelReason = 'manual', releaseCapture = true): void {
    if (activePointerId === null || !lastEvent) {
      return
    }

    const event = lastEvent
    unbind(releaseCapture)
    callbacks.cancel(event, reason)
  }

  return {
    get pointerId() {
      return activePointerId
    },
    get active() {
      return activePointerId !== null
    },
    matches(event) {
      return event.pointerId === activePointerId
    },
    start(event) {
      if (activePointerId !== null) {
        cancel('replaced')
      }

      activePointerId = event.pointerId
      lastEvent = event
      captureTarget = isPointerCaptureTarget(event.currentTarget) ? event.currentTarget : null
      bind()
      captureTarget?.setPointerCapture?.(event.pointerId)
    },
    cancel,
    dispose() {
      cancel('dispose')
    },
  }
}

function isPointerCaptureTarget(value: EventTarget | null): value is PointerCaptureTarget {
  return Boolean(
    value &&
    typeof value.addEventListener === 'function' &&
    typeof value.removeEventListener === 'function',
  )
}
