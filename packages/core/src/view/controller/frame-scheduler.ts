import { batch } from '../reactive.js'

/**
 * Timers of the window the editor is mounted in. Every callback runs inside a signal batch, so
 * the state changes it makes reach subscribers as one notification.
 */
export interface FrameScheduler {
  requestFrame: (callback: (timestamp: number) => void) => number
  cancelFrame: (handle: number) => void
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (handle: number) => void
  setInterval: (callback: () => void, delay: number) => number
  clearInterval: (handle: number) => void
  now: () => number
}

export function createWindowScheduler(view: Window): FrameScheduler {
  return {
    requestFrame: (callback) =>
      view.requestAnimationFrame((timestamp) => batch(() => callback(timestamp))),
    cancelFrame: (handle) => view.cancelAnimationFrame(handle),
    setTimeout: (callback, delay) => view.setTimeout(() => batch(callback), delay),
    clearTimeout: (handle) => view.clearTimeout(handle),
    setInterval: (callback, delay) => view.setInterval(() => batch(callback), delay),
    clearInterval: (handle) => view.clearInterval(handle),
    now: () => view.performance.now(),
  }
}
