import {
  createEditorController,
  type NodeWrightEditorController,
  type NodeWrightEditorOptions,
  type NodeWrightEventSink,
  type NodeWrightViewSnapshot,
} from '@node-wright/core/view'
import {
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toRaw,
  watch,
  type Ref,
  type ShallowRef,
} from 'vue'
import type { NodeWrightProps } from '../types'

export interface NodeWrightElements {
  root: Ref<HTMLElement | null>
  canvas: Ref<HTMLCanvasElement | null>
  gridCanvas: Ref<HTMLCanvasElement | null>
}

/**
 * Binds a framework-independent editor controller to a Vue component: props flow into
 * `update()`, controller snapshots into a shallow ref, and the rendered elements into `mount()`.
 */
export function useNodeWrightEditor(
  props: NodeWrightProps,
  forward: NodeWrightEventSink,
  elements: NodeWrightElements,
): { controller: NodeWrightEditorController; view: ShallowRef<NodeWrightViewSnapshot> } {
  const controller = createEditorController(resolveOptions(props, forward))
  const view = shallowRef(controller.getSnapshot())
  const unsubscribe = controller.subscribe(() => {
    view.value = controller.getSnapshot()
  })

  watch(
    () => resolveOptions(props, forward),
    (options) => controller.update(options),
  )

  onMounted(() => {
    const { root, canvas, gridCanvas } = elements

    if (!root.value || !canvas.value || !gridCanvas.value) {
      throw new Error('NodeWright rendered without its root and canvas elements.')
    }

    controller.mount({ root: root.value, canvas: canvas.value, gridCanvas: gridCanvas.value })
  })

  onBeforeUnmount(() => {
    unsubscribe()
    controller.destroy()
  })

  return { controller, view }
}

function resolveOptions(
  props: NodeWrightProps,
  forward: NodeWrightEventSink,
): NodeWrightEditorOptions {
  const { ariaLabel: _ariaLabel, domComponents: _domComponents, ...options } = props

  return { ...unwrapProxies(options), onEvent: forward }
}

/**
 * Props hold reactive proxies of parent state, while the controller detects option changes by
 * identity (for example the graph it emitted itself), so every prop value is passed raw.
 */
function unwrapProxies<T extends object>(options: T): T {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]: [string, unknown]) => [
      key,
      value !== null && typeof value === 'object' ? toRaw(value) : value,
    ]),
  ) as T
}
