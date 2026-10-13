import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import {
  createEditorController,
  type NodeEngineEditorController,
  type NodeEngineEditorOptions,
  type NodeEngineEventMap,
  type NodeEngineEventName,
} from '@node-engine-sdk/core/view'
import { vi } from 'vitest'

export type RecordedEvent = {
  [Name in NodeEngineEventName]: { name: Name; args: NodeEngineEventMap[Name] }
}[NodeEngineEventName]

/** Animation frames are queued and only run when a test flushes them. */
export interface FrameQueue {
  flush: (timestamp?: number) => void
  readonly size: number
}

export function installFrameQueue(): FrameQueue {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextHandle = 1
  let clock = 0

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle++
    callbacks.set(handle, callback)
    return handle
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    callbacks.delete(handle)
  })

  return {
    flush(timestamp) {
      clock = timestamp ?? clock + 16
      const pending = [...callbacks.values()]
      callbacks.clear()

      for (const callback of pending) {
        callback(clock)
      }
    },
    get size() {
      return callbacks.size
    },
  }
}

export interface EditorHarness {
  controller: NodeEngineEditorController
  events: RecordedEvent[]
  root: HTMLElement
  canvas: HTMLCanvasElement
  gridCanvas: HTMLCanvasElement
  frames: FrameQueue
  eventNames: () => string[]
  eventsNamed: <Name extends NodeEngineEventName>(name: Name) => NodeEngineEventMap[Name][]
  pointer: (
    target: EventTarget,
    type: string,
    point: { x: number; y: number },
    init?: PointerEventInit,
  ) => PointerEvent
  /** Presses on the canvas, moves in frames and releases, like a user drag. */
  drag: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    init?: PointerEventInit,
  ) => void
  key: (key: string, init?: KeyboardEventInit) => KeyboardEvent
  destroy: () => void
}

export function mountEditor(
  options: NodeEngineEditorOptions = {},
  size: { width: number; height: number } = { width: 800, height: 600 },
): EditorHarness {
  const frames = installFrameQueue()
  const events: RecordedEvent[] = []
  const root = document.createElement('div')
  const canvas = document.createElement('canvas')
  const gridCanvas = document.createElement('canvas')

  Object.defineProperty(root, 'clientWidth', { configurable: true, value: size.width })
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: size.height })
  root.append(gridCanvas, canvas)
  document.body.append(root)

  const controller = createEditorController({
    ...options,
    onEvent: (name, ...args) => {
      events.push({ name, args } as RecordedEvent)
    },
  })

  controller.mount({ root, canvas, gridCanvas })

  function pointer(
    target: EventTarget,
    type: string,
    point: { x: number; y: number },
    init: PointerEventInit = {},
  ): PointerEvent {
    const event = new PointerEvent(type, {
      pointerId: 1,
      button: 0,
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      ...init,
    })

    target.dispatchEvent(event)
    return event
  }

  return {
    controller,
    events,
    root,
    canvas,
    gridCanvas,
    frames,
    eventNames: () => events.map((event) => event.name),
    eventsNamed: <Name extends NodeEngineEventName>(name: Name) =>
      events
        .filter((event) => event.name === name)
        .map((event) => event.args as NodeEngineEventMap[Name]),
    pointer,
    drag(from, to, init = {}) {
      pointer(canvas, 'pointerdown', from, init)
      pointer(window, 'pointermove', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, init)
      frames.flush()
      pointer(window, 'pointermove', to, init)
      frames.flush()
      pointer(window, 'pointerup', to, init)
    },
    key(key, init = {}) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
      root.dispatchEvent(event)
      return event
    },
    destroy() {
      controller.destroy()
      root.remove()
      vi.restoreAllMocks()
    },
  }
}

export function createGraph(partial: Partial<GraphSnapshot> = {}): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...partial,
  }
}

/** Two canvas-only nodes with one output and one input port each. */
export function createConnectableGraph(): GraphSnapshot {
  return createGraph({
    nodes: [
      {
        id: 'source',
        type: 'task',
        x: 0,
        y: 0,
        width: 200,
        height: 120,
        ports: [
          { id: 'in', direction: 'input' },
          { id: 'out', direction: 'output' },
        ],
      },
      {
        id: 'target',
        type: 'task',
        x: 400,
        y: 0,
        width: 200,
        height: 120,
        ports: [
          { id: 'in', direction: 'input' },
          { id: 'out', direction: 'output' },
        ],
      },
    ],
  })
}

export const canvasOnlyNodeTypes = { task: { dom: false as const } }
