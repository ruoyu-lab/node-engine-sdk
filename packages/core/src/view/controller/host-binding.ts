import { batch, type Signal } from '../reactive.js'
import type { NodeWrightEditorHost } from '../types/index.js'
import type { CanvasGestures } from './canvas-gestures.js'
import { createWindowScheduler, type FrameScheduler } from './frame-scheduler.js'
import type { KeyboardController } from './hotkeys.js'
import type { InteractionFrame } from './interactions/interaction-frame.js'
import type { WheelGesture } from './interactions/wheel.js'
import type { RenderScheduler } from './render-scheduler.js'

/**
 * Attaches the editor to the elements an adapter rendered: keyboard and wheel input on the
 * root, pointer input on the canvas, window-level pointer sessions, timers and painting.
 * Every DOM callback runs as one signal batch.
 */
export interface HostBinding {
  readonly scheduler: () => FrameScheduler | null
  mount: (target: NodeWrightEditorHost) => void
  unmount: () => void
}

export function createHostBinding(options: {
  host: Signal<NodeWrightEditorHost | null>
  keyboard: KeyboardController
  wheel: WheelGesture
  gestures: CanvasGestures
  frame: InteractionFrame
  getRenderScheduler: () => RenderScheduler
}): HostBinding {
  let scheduler: FrameScheduler | null = null
  let detach: (() => void) | null = null

  function attach(target: NodeWrightEditorHost): () => void {
    const view = target.root.ownerDocument.defaultView

    if (!view) {
      throw new Error('NodeWright editor host must belong to a document with a window.')
    }

    const windowScheduler = createWindowScheduler(view)
    const listen = <Type extends keyof HTMLElementEventMap>(
      element: HTMLElement,
      type: Type,
      handler: (event: HTMLElementEventMap[Type]) => void,
      config?: AddEventListenerOptions,
    ) => {
      const listener = (event: HTMLElementEventMap[Type]) => batch(() => handler(event))

      element.addEventListener(type, listener, config)
      return () => element.removeEventListener(type, listener, config)
    }

    scheduler = windowScheduler
    options.host.value = target
    options.gestures.attach(view)

    const removeListeners = [
      listen(target.root, 'keydown', options.keyboard.keydown),
      listen(target.root, 'keyup', options.keyboard.keyup),
      listen(target.root, 'blur', options.keyboard.blur),
      listen(target.root, 'wheel', (event) => options.wheel.handleWheel(event, target.root), {
        passive: false,
      }),
      listen(target.canvas, 'pointerdown', options.gestures.pointerDown),
      listen(target.canvas, 'pointermove', options.gestures.pointerMove),
      listen(target.canvas, 'pointerleave', options.gestures.pointerLeave),
      listen(target.canvas, 'contextmenu', options.gestures.contextMenu),
    ]
    const stopRendering = options.getRenderScheduler().mount(target, windowScheduler)

    return () => {
      options.wheel.cancel({ commit: false })
      options.gestures.detach()
      options.frame.cancel()

      for (const remove of removeListeners) {
        remove()
      }

      stopRendering()
      options.host.value = null
      scheduler = null
    }
  }

  return {
    scheduler: () => scheduler,
    mount(target) {
      if (detach) {
        throw new Error('NodeWright editor controller is already mounted.')
      }

      batch(() => {
        detach = attach(target)
      })
    },
    unmount() {
      const current = detach

      if (current) {
        detach = null
        batch(current)
      }
    },
  }
}
