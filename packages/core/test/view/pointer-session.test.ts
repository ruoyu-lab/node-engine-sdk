import { describe, expect, it, vi } from 'vitest'
import {
  createPointerSession,
  type PointerSession,
} from '../../src/view/controller/interactions/pointer-session'

class PointerCaptureTarget extends EventTarget {
  readonly captured = new Set<number>()

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }
}

function pointerEvent(type: string, pointerId: number, clientX = 0, clientY = 0): PointerEvent {
  const event = new Event(type)

  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })

  return event as PointerEvent
}

function startOnTarget(session: PointerSession, target: EventTarget, event: PointerEvent): void {
  const start = (receivedEvent: Event) => {
    session.start(receivedEvent as PointerEvent)
  }

  target.addEventListener('pointerdown', start, { once: true })
  target.dispatchEvent(event)
}

describe('PointerSession', () => {
  it('tracks only the active pointer and completes exactly once', () => {
    const host = new EventTarget()
    const capture = new PointerCaptureTarget()
    const move = vi.fn()
    const finish = vi.fn()
    const cancel = vi.fn()
    const session = createPointerSession(host, { move, finish, cancel })

    startOnTarget(session, capture, pointerEvent('pointerdown', 7, 10, 20))

    expect(session.pointerId).toBe(7)
    expect(capture.captured.has(7)).toBe(true)

    host.dispatchEvent(pointerEvent('pointermove', 8, 30, 40))
    host.dispatchEvent(pointerEvent('pointermove', 7, 50, 60))
    host.dispatchEvent(pointerEvent('pointerup', 7, 70, 80))
    host.dispatchEvent(pointerEvent('pointerup', 7, 90, 100))

    expect(move).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledTimes(1)
    expect(cancel).not.toHaveBeenCalled()
    expect(session.active).toBe(false)
    expect(capture.captured.has(7)).toBe(false)
  })

  it.each([
    ['pointercancel', 'pointercancel'],
    ['lostpointercapture', 'lostpointercapture'],
  ] as const)('cancels on %s', (eventType, reason) => {
    const host = new EventTarget()
    const capture = new PointerCaptureTarget()
    const cancel = vi.fn()
    const session = createPointerSession(host, {
      move: vi.fn(),
      finish: vi.fn(),
      cancel,
    })

    startOnTarget(session, capture, pointerEvent('pointerdown', 3))
    const target = eventType === 'lostpointercapture' ? capture : host
    target.dispatchEvent(pointerEvent(eventType, 3))

    expect(cancel).toHaveBeenCalledOnce()
    expect(cancel.mock.calls[0][1]).toBe(reason)
    expect(session.active).toBe(false)
  })

  it('cancels on blur, replacement, and disposal without leaking listeners', () => {
    const host = new EventTarget()
    const firstCapture = new PointerCaptureTarget()
    const secondCapture = new PointerCaptureTarget()
    const move = vi.fn()
    const cancel = vi.fn()
    const session = createPointerSession(host, {
      move,
      finish: vi.fn(),
      cancel,
    })

    startOnTarget(session, firstCapture, pointerEvent('pointerdown', 1))
    startOnTarget(session, secondCapture, pointerEvent('pointerdown', 2))
    host.dispatchEvent(new Event('blur'))

    startOnTarget(session, firstCapture, pointerEvent('pointerdown', 3))
    session.dispose()
    host.dispatchEvent(pointerEvent('pointermove', 3))

    expect(cancel.mock.calls.map((call) => call[1])).toEqual(['replaced', 'window-blur', 'dispose'])
    expect(move).not.toHaveBeenCalled()
    expect(session.active).toBe(false)
  })
})
