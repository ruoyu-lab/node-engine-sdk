import type { GraphGroup, GraphSnapshot, XYPosition } from '../../protocol/index.js'
import { resolveNodeAccent } from '../dom-model/definition.js'
import {
  batch,
  computed,
  effect,
  signal,
  untracked,
  type ReadonlySignal,
  type Signal,
} from '../reactive.js'
import { getViewportGraphBounds, isPointInRect, type GraphRect } from '../rendering/geometry.js'
import type { GraphCanvasTheme } from '../rendering/graph-canvas.js'
import {
  paintMinimap,
  type MinimapColors,
  type MinimapGroupRect,
  type MinimapNodeRect,
  type MinimapPaintFrame,
  type MinimapScene,
} from '../rendering/minimap-canvas.js'
import {
  fitMinimapTransform,
  graphRectToMinimap,
  minimapToGraph,
  minimapTransformEquals,
  resolveMinimapWorld,
  type MinimapTransform,
} from '../rendering/minimap-geometry.js'
import type { ResolvedNodeView } from '../rendering/node-layout.js'
import type {
  NodeWrightMinimapHost,
  NodeWrightMinimapState,
  NodeWrightStyleDeclaration,
  NodeTypeRegistry,
  ViewportState,
} from '../types/index.js'
import { createWindowScheduler } from './frame-scheduler.js'
import { getGroupBoundsRect, resolveCollapsedGroupNodeIds } from './groups.js'
import type { ViewportInteraction } from './interactions/viewport-gestures.js'
import type { ResolvedEditorOptions, ResolvedMinimapOptions } from './options.js'
import { viewportEquals } from './viewport.js'
import type { RenderSurface } from './visibility.js'

/** Viewport interaction and `viewport-change` source of minimap clicks and drags. */
export const MINIMAP_SOURCE = 'minimap'
/** `viewport-change` source of arrow-key panning on the focused minimap. */
export const MINIMAP_KEYBOARD_SOURCE = 'minimap.keyboard'

/** An arrow key pans by this share of the visible area; Shift multiplies it. */
const KEYBOARD_STEP = 0.1
const KEYBOARD_FAST_FACTOR = 4

const ARROW_DIRECTIONS: ReadonlyMap<string, XYPosition> = new Map([
  ['ArrowLeft', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }],
  ['ArrowUp', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }],
])

/**
 * The minimap: a scaled overview of groups and nodes with the visible area on top. Clicking
 * centres the viewport on the clicked point and dragging pans it; like a background pan, the drag
 * only previews the viewport and commits it once on release. Arrow keys pan the viewport while
 * the minimap has focus.
 *
 * The overview follows the committed graph: node and group rectangles are rebuilt when the graph,
 * node definitions or node types change, never during gesture previews or viewport changes. A
 * paint is scheduled in an animation frame only when a paint input changed, so panning within the
 * world only moves the viewport rectangle. While the option is off nothing is computed.
 */
export interface Minimap {
  readonly state: ReadonlySignal<NodeWrightMinimapState | null>
  mount: (host: NodeWrightMinimapHost) => () => void
  /** Detaches the attached minimap, if any. */
  unmount: () => void
}

interface DragSession {
  pointerId: number
  /** Pointer position relative to the centre of the viewport rectangle, in minimap pixels. */
  offset: XYPosition
  /** Transform at the start of the drag; the minimap keeps it until the drag ends. */
  transform: MinimapTransform
  /** Pointer position not yet applied to the preview. */
  pending: XYPosition | null
  frame: number | null
}

export function createMinimap(options: {
  options: ReadonlySignal<ResolvedEditorOptions>
  graph: ReadonlySignal<GraphSnapshot>
  schemaRevision: ReadonlySignal<number>
  nodeTypes: ReadonlySignal<NodeTypeRegistry>
  nodeRenderer: ReadonlySignal<unknown>
  /**
   * Resolved node views. They are read untracked: they also follow the live viewport and gesture
   * previews, while the overview only follows committed geometry.
   */
  resolvedNodes: () => readonly ResolvedNodeView[]
  groupHeaderHeight: ReadonlySignal<number>
  selectedNodeIds: ReadonlySignal<ReadonlySet<string>>
  graphTheme: ReadonlySignal<GraphCanvasTheme>
  surface: ReadonlySignal<RenderSurface>
  liveViewport: ReadonlySignal<ViewportState>
  /** Viewport preview of a minimap drag. */
  preview: Signal<ViewportState | null>
  getViewport: () => ViewportState
  setViewport: (patch: Partial<ViewportState>, source: string) => void
  interaction: ViewportInteraction
  /** False while a canvas gesture owns the viewport. */
  canStart: () => boolean
  /** Settles other viewport input (a wheel in progress) and closes transient UI. */
  prepare: () => void
  /** Paints the editor canvases immediately (inside an animation frame). */
  drawNow: (timestamp: number) => void
}): Minimap {
  const settings = computed(() => options.options.value.minimap, sameMinimapOptions)
  const nodeTypes = computed(() => options.nodeTypes.value, sameEntries)
  const colors = computed<MinimapColors>(() => {
    const theme = options.graphTheme.value

    return {
      node: theme.minimapNodeColor,
      selection: theme.selectionColor,
      group: theme.groupBorderColor,
    }
  }, sameEntries)
  const scene = computed<MinimapScene>(() => {
    const graph = options.graph.value
    void options.schemaRevision.value
    void nodeTypes.value
    void options.nodeRenderer.value

    return createMinimapScene({
      nodes: untracked(options.resolvedNodes),
      groups: graph.groups,
      headerHeight: options.groupHeaderHeight.value,
      hiddenNodeIds: resolveCollapsedGroupNodeIds(graph),
    })
  })
  const visibleArea = computed<GraphRect | null>(() => {
    const surface = options.surface.value

    return surface.width > 0 && surface.height > 0
      ? getViewportGraphBounds(options.liveViewport.value, surface)
      : null
  })
  /** Set while dragging, so that the overview does not rescale under the pointer. */
  const frozenTransform = signal<MinimapTransform | null>(null)
  const transform = computed<MinimapTransform | null>(() => {
    const frozen = frozenTransform.value
    const size = settings.value

    if (frozen || !size) {
      return frozen
    }

    const world = resolveMinimapWorld(scene.value.bounds, visibleArea.value)

    return world ? fitMinimapTransform(world, size, size.padding) : null
  }, minimapTransformEquals)
  const viewportStyle = computed<NodeWrightStyleDeclaration | null>(() => {
    const area = visibleArea.value
    const current = area ? transform.value : null

    if (!area || !current) {
      return null
    }

    const box = graphRectToMinimap(current, area)

    return {
      transform: `translate(${round(box.x)}px, ${round(box.y)}px)`,
      width: `${round(box.width)}px`,
      height: `${round(box.height)}px`,
    }
  }, sameStyle)
  const containerStyle = computed<NodeWrightStyleDeclaration | null>(() => {
    const size = settings.value

    return size ? { width: `${size.width}px`, height: `${size.height}px` } : null
  })
  const dragging = signal(false)
  const state = computed<NodeWrightMinimapState | null>(() => {
    const style = containerStyle.value

    return style ? { style, viewportStyle: viewportStyle.value, dragging: dragging.value } : null
  })
  /** Device pixel ratio of the minimap's window until the editor itself is mounted. */
  const hostDpr = signal(1)
  const dpr = computed(() => {
    const surface = options.surface.value

    return surface.width > 0 ? surface.dpr : hostDpr.value
  })
  const paintFrame = computed<MinimapPaintFrame | null>(() => {
    const size = settings.value

    return size
      ? {
          width: size.width,
          height: size.height,
          dpr: dpr.value,
          transform: transform.value,
          scene: scene.value,
          selectedNodeIds: options.selectedNodeIds.value,
          colors: colors.value,
        }
      : null
  })
  let detach: (() => void) | null = null

  function attach(host: NodeWrightMinimapHost): () => void {
    const view = host.canvas.ownerDocument.defaultView

    if (!view) {
      throw new Error('NodeWright minimap host must belong to a document with a window.')
    }

    // Hoisted handlers below do not see the narrowing of `view`.
    const hostWindow: Window = view
    const scheduler = createWindowScheduler(hostWindow)
    let paintHandle: number | null = null
    let painted: MinimapPaintFrame | null = null
    let drag: DragSession | null = null
    /** Every DOM callback runs as one signal batch. */
    const listen = <Payload extends Event>(
      target: EventTarget,
      type: string,
      handler: (event: Payload) => void,
      config?: AddEventListenerOptions,
    ) => {
      const listener = (event: Event) => batch(() => handler(event as Payload))

      target.addEventListener(type, listener, config)
      return () => target.removeEventListener(type, listener, config)
    }

    function paint(): void {
      const frame = paintFrame.peek()
      const ctx = frame ? host.canvas.getContext('2d') : null
      painted = frame

      if (frame && ctx) {
        paintMinimap(ctx, frame)
      }
    }

    /** Converts a client position to minimap pixels, also when a CSS transform scales the minimap. */
    function toMinimapPoint(event: MouseEvent, size: ResolvedMinimapOptions): XYPosition {
      const rect = host.canvas.getBoundingClientRect()

      return {
        x: (event.clientX - rect.left) * (rect.width > 0 ? size.width / rect.width : 1),
        y: (event.clientY - rect.top) * (rect.height > 0 ? size.height / rect.height : 1),
      }
    }

    /** Previews the viewport whose centre lies under `point` minus the drag offset. */
    function previewAt(session: DragSession, point: XYPosition): void {
      const surface = options.surface.peek()

      if (!surface.width || !surface.height) {
        return
      }

      const center = minimapToGraph(session.transform, {
        x: point.x - session.offset.x,
        y: point.y - session.offset.y,
      })
      const viewport = options.liveViewport.peek()

      options.preview.value = {
        ...viewport,
        x: surface.width / 2 - center.x * viewport.zoom,
        y: surface.height / 2 - center.y * viewport.zoom,
      }
      options.interaction.update(MINIMAP_SOURCE)
    }

    function flush(session: DragSession, timestamp?: number): void {
      const point = session.pending
      session.pending = null

      if (point) {
        previewAt(session, point)

        if (timestamp !== undefined) {
          options.drawNow(timestamp)
        }
      }
    }

    function finish(commit: boolean): void {
      const session = drag

      if (!session) {
        return
      }

      drag = null
      unbindDragListeners()

      if (session.frame !== null) {
        scheduler.cancelFrame(session.frame)
      }

      if (host.root.hasPointerCapture(session.pointerId)) {
        host.root.releasePointerCapture(session.pointerId)
      }

      if (commit) {
        flush(session)
      }

      const preview = options.preview.peek()

      if (commit && preview && !viewportEquals(preview, options.getViewport())) {
        options.setViewport(preview, MINIMAP_SOURCE)
      }

      options.interaction.end(MINIMAP_SOURCE)
      options.preview.value = null
      frozenTransform.value = null
      dragging.value = false
    }

    function pointerDown(event: PointerEvent): void {
      event.stopPropagation()

      const size = settings.peek()

      if (event.button !== 0 || drag || !size || !options.canStart()) {
        return
      }

      options.prepare()

      const current = transform.peek()
      const area = visibleArea.peek()

      if (!current || !area) {
        return
      }

      const point = toMinimapPoint(event, size)
      const box = graphRectToMinimap(current, area)
      const inside = isPointInRect(point, box)
      const session: DragSession = {
        pointerId: event.pointerId,
        offset: inside
          ? { x: point.x - (box.x + box.width / 2), y: point.y - (box.y + box.height / 2) }
          : { x: 0, y: 0 },
        transform: current,
        pending: null,
        frame: null,
      }

      drag = session
      frozenTransform.value = current
      dragging.value = true
      host.root.setPointerCapture(event.pointerId)
      bindDragListeners()
      options.interaction.begin(MINIMAP_SOURCE)

      if (!inside) {
        previewAt(session, point)
      }
    }

    function pointerMove(event: PointerEvent): void {
      const session = drag
      const size = settings.peek()

      if (!session || !size || event.pointerId !== session.pointerId) {
        return
      }

      session.pending = toMinimapPoint(event, size)
      session.frame ??= scheduler.requestFrame((timestamp) => {
        session.frame = null

        if (drag === session) {
          flush(session, timestamp)
        }
      })
    }

    function pointerUp(event: PointerEvent): void {
      const session = drag
      const size = settings.peek()

      if (!session || event.pointerId !== session.pointerId) {
        return
      }

      event.stopPropagation()

      if (size) {
        session.pending = toMinimapPoint(event, size)
      }

      finish(true)
    }

    function pointerCancel(event: PointerEvent): void {
      if (drag && event.pointerId === drag.pointerId) {
        event.stopPropagation()
        finish(false)
      }
    }

    function keyDown(event: KeyboardEvent): void {
      const direction = ARROW_DIRECTIONS.get(event.key)

      if (!direction || event.ctrlKey || event.metaKey || event.altKey || !settings.peek()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const surface = options.surface.peek()

      if (drag || !surface.width || !surface.height) {
        return
      }

      options.prepare()

      const step = KEYBOARD_STEP * (event.shiftKey ? KEYBOARD_FAST_FACTOR : 1)
      const viewport = options.getViewport()

      options.setViewport(
        {
          x: viewport.x - direction.x * surface.width * step,
          y: viewport.y - direction.y * surface.height * step,
        },
        MINIMAP_KEYBOARD_SOURCE,
      )
    }

    /** The minimap owns its wheel input: it neither zooms the canvas nor scrolls the page. */
    function swallowWheel(event: WheelEvent): void {
      event.preventDefault()
      event.stopPropagation()
    }

    let dragListeners: Array<() => void> = []

    /**
     * Window listeners of a drag. With pointer capture every event targets the minimap, whose own
     * listeners stop it; these only see input that escaped the minimap. Wheel input is held back
     * so that it cannot move the viewport underneath the drag.
     */
    function bindDragListeners(): void {
      dragListeners = [
        listen(hostWindow, 'pointermove', pointerMove),
        listen(hostWindow, 'pointerup', pointerUp),
        listen(hostWindow, 'pointercancel', pointerCancel),
        listen(hostWindow, 'blur', () => finish(false)),
        listen(hostWindow, 'wheel', swallowWheel, { capture: true, passive: false }),
      ]
    }

    function unbindDragListeners(): void {
      for (const remove of dragListeners) {
        remove()
      }

      dragListeners = []
    }

    hostDpr.value = hostWindow.devicePixelRatio || 1

    const removeListeners = [
      listen(host.root, 'pointerdown', pointerDown),
      listen<PointerEvent>(host.root, 'pointermove', (event) => {
        event.stopPropagation()
        pointerMove(event)
      }),
      listen(host.root, 'pointerup', pointerUp),
      listen(host.root, 'pointercancel', pointerCancel),
      listen(host.root, 'wheel', swallowWheel, { passive: false }),
      listen(host.root, 'keydown', keyDown),
    ]
    const stopPainting = effect(() => {
      const frame = paintFrame.value

      if (frame && frame !== painted && paintHandle === null) {
        paintHandle = scheduler.requestFrame(() => {
          paintHandle = null
          paint()
        })
      }
    })
    const stopDisabledDrag = effect(() => {
      if (!settings.value) {
        finish(false)
      }
    })

    return () => {
      finish(false)
      stopPainting()
      stopDisabledDrag()

      if (paintHandle !== null) {
        scheduler.cancelFrame(paintHandle)
        paintHandle = null
      }

      for (const remove of removeListeners) {
        remove()
      }
    }
  }

  return {
    state,
    mount(host) {
      if (detach) {
        throw new Error('NodeWright minimap is already mounted.')
      }

      const current = batch(() => attach(host))
      detach = current

      return () => {
        if (detach === current) {
          detach = null
          batch(current)
        }
      }
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

/**
 * Minimap rectangles of the committed graph: every group (collapsed groups shrink to their
 * header) and every node outside a collapsed group, with nodes bucketed by accent colour.
 */
export function createMinimapScene(input: {
  nodes: readonly ResolvedNodeView[]
  groups: readonly GraphGroup[]
  headerHeight: number
  hiddenNodeIds: ReadonlySet<string>
}): MinimapScene {
  const groups: MinimapGroupRect[] = []
  const nodesByColor = new Map<string | undefined, MinimapNodeRect[]>()
  const nodesById = new Map<string, MinimapNodeRect>()
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  function include(rect: GraphRect): void {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }

  for (const group of input.groups) {
    const bounds = getGroupBoundsRect(group, input.headerHeight)

    groups.push({ ...bounds, color: group.color })
    include(bounds)
  }

  for (const node of input.nodes) {
    if (input.hiddenNodeIds.has(node.id)) {
      continue
    }

    const color = resolveNodeAccent(node, node.definition)
    const rect: MinimapNodeRect = {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      color,
    }
    const bucket = nodesByColor.get(color)

    if (bucket) {
      bucket.push(rect)
    } else {
      nodesByColor.set(color, [rect])
    }

    nodesById.set(node.id, rect)
    include(rect)
  }

  return {
    groups,
    nodesByColor,
    nodesById,
    bounds: left <= right ? { x: left, y: top, width: right - left, height: bottom - top } : null,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function sameMinimapOptions(
  left: ResolvedMinimapOptions | null,
  right: ResolvedMinimapOptions | null,
): boolean {
  return left === right || (left !== null && right !== null && sameEntries(left, right))
}

function sameStyle(
  left: NodeWrightStyleDeclaration | null,
  right: NodeWrightStyleDeclaration | null,
): boolean {
  return left === right || (left !== null && right !== null && sameEntries(left, right))
}

/** Same keys with identical values. */
function sameEntries<T extends object>(left: T, right: T): boolean {
  if (left === right) {
    return true
  }

  const leftEntries = Object.entries(left)

  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(
      ([key, value]) =>
        Object.hasOwn(right, key) && (right as Record<string, unknown>)[key] === value,
    )
  )
}
