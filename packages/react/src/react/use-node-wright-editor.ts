import {
  createEditorController,
  type NodeWrightEditorController,
  type NodeWrightEditorOptions,
  type NodeWrightEventName,
  type NodeWrightEventSink,
  type NodeWrightViewSnapshot,
} from '@node-wright/core/view'
import {
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ForwardedRef,
  type RefObject,
} from 'react'
import type { NodeWrightEventHandlerName, NodeWrightHandle, NodeWrightProps } from '../types.js'
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect.js'

type EditorOptionValues = Omit<NodeWrightEditorOptions, 'onEvent'>
type EditorOptionKey = keyof EditorOptionValues

/** Every editor option a prop can carry; `satisfies` keeps the list complete. */
const EDITOR_OPTION_KEYS = Object.keys({
  graph: true,
  store: true,
  initialViewport: true,
  initialSelection: true,
  nodeTypes: true,
  nodeEditors: true,
  edgeTypes: true,
  renderers: true,
  nodeDefinitions: true,
  edgeDefinitions: true,
  commands: true,
  plugins: true,
  groupRenderers: true,
  edgeRenderers: true,
  toolbarItems: true,
  contextMenuItems: true,
  hotkeys: true,
  connectionValidator: true,
  theme: true,
  nodeStatus: true,
  behaviors: true,
  performance: true,
  canvasBackground: true,
  readonly: true,
  gridVisible: true,
  gridColor: true,
  gridSize: true,
  snapToGrid: true,
  minZoom: true,
  maxZoom: true,
  connectionPreview: true,
  wheelBehavior: true,
  wheelInertia: true,
  minimap: true,
  resolvePortValue: true,
  serializeGraph: true,
  deserializeGraph: true,
  beforeImport: true,
  afterImport: true,
} satisfies Record<EditorOptionKey, true>) as EditorOptionKey[]

const NO_EDITOR = {
  subscribe: () => () => undefined,
  getSnapshot: (): NodeWrightViewSnapshot | null => null,
}

export interface NodeWrightEditorBinding {
  /** `null` until the first commit and during server rendering. */
  controller: NodeWrightEditorController | null
  view: NodeWrightViewSnapshot | null
  rootRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  gridCanvasRef: RefObject<HTMLCanvasElement | null>
}

/**
 * Binds a framework-independent editor controller to the `NodeWright` component.
 *
 * The controller is created, mounted and destroyed in one layout effect: it is an external
 * resource, so it is never created while rendering, where React may discard the result (a
 * discarded controller would stay subscribed to a provided store). StrictMode's simulated
 * remount therefore destroys the first controller and creates the next one; nothing touches a
 * destroyed controller, and server rendering only renders the empty editor shell. Props reach
 * the controller through `update()` whenever an option changed identity, which also ignores a
 * graph that the controller itself emitted through `onGraphChange`. The snapshot is read with
 * `useSyncExternalStore`, the ref exposes the API from the same commit on.
 */
export function useNodeWrightEditor(
  props: NodeWrightProps,
  ref: ForwardedRef<NodeWrightHandle>,
): NodeWrightEditorBinding {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const propsRef = useRef(props)
  const controllerRef = useRef<NodeWrightEditorController | null>(null)
  const appliedOptionsRef = useRef<EditorOptionValues>({})
  const [controller, setController] = useState<NodeWrightEditorController | null>(null)
  const [forward] = useState(() => createEventForwarder(() => propsRef.current))

  useIsomorphicLayoutEffect(() => {
    propsRef.current = props
  })

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const gridCanvas = gridCanvasRef.current

    if (!root || !canvas || !gridCanvas) {
      throw new Error('NodeWright rendered without its root and canvas elements.')
    }

    const options = pickEditorOptions(propsRef.current)
    const created = createEditorController({ ...options, onEvent: forward })

    created.mount({ root, canvas, gridCanvas })
    controllerRef.current = created
    appliedOptionsRef.current = options
    setController(created)

    return () => {
      controllerRef.current = null
      created.destroy()
    }
  }, [forward])

  useIsomorphicLayoutEffect(() => {
    const options = pickEditorOptions(props)

    if (haveSameOptions(options, appliedOptionsRef.current)) {
      return
    }

    appliedOptionsRef.current = options
    requireController(controllerRef.current).update({ ...options, onEvent: forward })
  })

  // The handle reads the ref: the controller state only catches up in the render after the
  // creation effect, while the parent's effects of the same commit already use the API. The
  // `controller` dependency re-exposes the API whenever a new controller replaced the previous one.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate dependency, see above
  useImperativeHandle(ref, () => requireController(controllerRef.current).api, [controller])

  const source = controller ?? NO_EDITOR
  const view = useSyncExternalStore(source.subscribe, source.getSnapshot, NO_EDITOR.getSnapshot)

  return { controller, view, rootRef, canvasRef, gridCanvasRef }
}

/** Layout effects run in declaration order, after the one that creates the controller. */
function requireController(
  controller: NodeWrightEditorController | null,
): NodeWrightEditorController {
  if (!controller) {
    throw new Error('NodeWright editor controller is not mounted.')
  }

  return controller
}

function pickEditorOptions(props: NodeWrightProps): EditorOptionValues {
  const options: EditorOptionValues = {}

  for (const key of EDITOR_OPTION_KEYS) {
    copyOption(options, props, key)
  }

  return options
}

function copyOption<Key extends EditorOptionKey>(
  target: EditorOptionValues,
  source: EditorOptionValues,
  key: Key,
): void {
  if (source[key] !== undefined) {
    target[key] = source[key]
  }
}

function haveSameOptions(left: EditorOptionValues, right: EditorOptionValues): boolean {
  return EDITOR_OPTION_KEYS.every((key) => left[key] === right[key])
}

const handlerNames = new Map<NodeWrightEventName, string>()

function toEventHandlerName<Name extends NodeWrightEventName>(
  name: Name,
): NodeWrightEventHandlerName<Name> {
  let handlerName = handlerNames.get(name)

  if (!handlerName) {
    handlerName = `on${name
      .split('-')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join('')}`
    handlerNames.set(name, handlerName)
  }

  return handlerName as NodeWrightEventHandlerName<Name>
}

/** Forwards every editor event to the callback prop of the latest render. */
function createEventForwarder(getProps: () => NodeWrightProps): NodeWrightEventSink {
  return (event, ...args) => {
    const handler = getProps()[toEventHandlerName(event)] as
      ((...input: typeof args) => void) | undefined

    handler?.(...args)
  }
}
