import type { GraphSnapshot } from '@node-wright/core/protocol'
import { createEditorController, type NodeWrightMinimapHost } from '@node-wright/core/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMinimap, createMinimapScene } from '../../src/view/controller/minimap'
import { resolveEditorOptions } from '../../src/view/controller/options'
import { resolveGraphCanvasTheme } from '../../src/view/controller/theme'
import { signal } from '../../src/view/reactive'
import { MINIMAP_ROUNDED_NODE_LIMIT, paintMinimap } from '../../src/view/rendering/minimap-canvas'
import {
  fitMinimapTransform,
  graphRectToMinimap,
  graphToMinimap,
  minimapToGraph,
  minimapTransformEquals,
  resolveMinimapWorld,
  unionRects,
} from '../../src/view/rendering/minimap-geometry'
import type { ResolvedNodeView } from '../../src/view/rendering/node-layout'
import {
  canvasOnlyNodeTypes,
  createGraph,
  installFrameQueue,
  mountEditor,
  type EditorHarness,
} from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
  vi.restoreAllMocks()
})

const theme = {
  minimapNodeColor: '#00ff00',
  selectionColor: '#ff0000',
  groupBorderColor: '#0000ff',
}

/**
 * Content spans (0, 0)–(2000, 1500), so the 800 × 600 viewport at the origin lies inside it and
 * the minimap (200 × 136, padding 8) shows exactly the content: scale 0.08, offset (20, 8).
 */
function createMinimapGraph(): GraphSnapshot {
  return createGraph({
    nodes: [
      { id: 'a', type: 'task', x: 0, y: 0, width: 200, height: 100 },
      {
        id: 'b',
        type: 'task',
        x: 1800,
        y: 1400,
        width: 200,
        height: 100,
        meta: { accent: '#123456' },
      },
    ],
  })
}

const SCALE = 0.08

function mountWithMinimap(
  options: Parameters<typeof mountEditor>[0] = {},
): EditorHarness & { minimap: NodeWrightMinimapHost; unmountMinimap: () => void } {
  harness = mountEditor({
    graph: createMinimapGraph(),
    nodeTypes: canvasOnlyNodeTypes,
    theme,
    minimap: true,
    ...options,
  })

  const minimap = createMinimapHost(harness.root)

  return { ...harness, minimap, unmountMinimap: harness.controller.mountMinimap(minimap) }
}

function createMinimapHost(parent: HTMLElement): NodeWrightMinimapHost {
  const root = document.createElement('div')
  const canvas = document.createElement('canvas')

  root.append(canvas)
  parent.append(root)
  return { root, canvas }
}

interface RecordedCall {
  name: string
  args: unknown[]
}

/** A 2D context stand-in that records drawing calls and property writes, in order. */
function createRecordingContext(canvas: HTMLCanvasElement) {
  const calls: RecordedCall[] = []
  const target: Record<string, unknown> = { canvas }
  const ctx = new Proxy(target, {
    get(object, property) {
      if (typeof property === 'string' && property in object) {
        return object[property]
      }

      return (...args: unknown[]) => {
        calls.push({ name: String(property), args })
      }
    },
    set(_object, property, value) {
      calls.push({ name: `set:${String(property)}`, args: [value] })
      return true
    },
  }) as unknown as CanvasRenderingContext2D

  return {
    ctx,
    calls,
    count: (name: string) => calls.filter((call) => call.name === name).length,
    /** Fill colours in the order they were set. */
    fillStyles: () =>
      calls.filter((call) => call.name === 'set:fillStyle').map((call) => call.args[0]),
    reset: () => {
      calls.length = 0
    },
  }
}

/** Routes `getContext('2d')` of `canvas` to a recording context; other canvases are unchanged. */
function recordCanvas(canvas: HTMLCanvasElement) {
  const recording = createRecordingContext(canvas)
  const original = HTMLCanvasElement.prototype.getContext

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    ...args: Parameters<HTMLCanvasElement['getContext']>
  ) {
    return this === canvas ? recording.ctx : original.apply(this, args)
  } as HTMLCanvasElement['getContext'])

  return recording
}

function resolvedNode(node: Partial<ResolvedNodeView> & { id: string }): ResolvedNodeView {
  return { type: 'task', x: 0, y: 0, width: 100, height: 50, ports: [], title: node.id, ...node }
}

describe('minimap geometry', () => {
  it('scales the world uniformly into the padded minimap and centres it', () => {
    const transform = fitMinimapTransform(
      { x: 0, y: 0, width: 400, height: 100 },
      { width: 200, height: 136 },
      8,
    )

    expect(transform.scale).toBeCloseTo(0.46)
    expect(transform.x).toBeCloseTo(8)
    expect(transform.y).toBeCloseTo(45)
    expect(graphToMinimap(transform, { x: 200, y: 50 })).toEqual({
      x: expect.closeTo(100),
      y: expect.closeTo(68),
    })
    expect(minimapToGraph(transform, graphToMinimap(transform, { x: 37, y: -12 }))).toEqual({
      x: expect.closeTo(37),
      y: expect.closeTo(-12),
    })
    expect(graphRectToMinimap(transform, { x: 0, y: 0, width: 400, height: 100 })).toEqual({
      x: expect.closeTo(8),
      y: expect.closeTo(45),
      width: expect.closeTo(184),
      height: expect.closeTo(46),
    })
  })

  it('keeps a degenerate world finite', () => {
    const transform = fitMinimapTransform(
      { x: 50, y: 50, width: 0, height: 0 },
      { width: 10, height: 10 },
      20,
    )

    expect(transform).toEqual({ scale: 1, x: -45, y: -45 })
  })

  it('unites the content with the visible area, or uses the visible area of an empty graph', () => {
    const content = { x: 0, y: 0, width: 100, height: 100 }
    const viewport = { x: 50, y: -50, width: 200, height: 100 }

    expect(resolveMinimapWorld(content, viewport)).toEqual({
      x: 0,
      y: -50,
      width: 250,
      height: 150,
    })
    expect(resolveMinimapWorld(null, viewport)).toBe(viewport)
    expect(resolveMinimapWorld(content, null)).toBe(content)
    expect(unionRects(null, null)).toBeNull()
  })

  it('compares transforms by value', () => {
    const transform = { scale: 1, x: 2, y: 3 }

    expect(minimapTransformEquals(transform, { ...transform })).toBe(true)
    expect(minimapTransformEquals(transform, { ...transform, y: 4 })).toBe(false)
    expect(minimapTransformEquals(null, null)).toBe(true)
    expect(minimapTransformEquals(transform, null)).toBe(false)
  })
})

describe('minimap scene', () => {
  it('buckets nodes by accent, shrinks collapsed groups and hides their members', () => {
    const scene = createMinimapScene({
      nodes: [
        resolvedNode({ id: 'plain', x: 0, y: 0 }),
        resolvedNode({ id: 'typed', x: 200, y: 0, definition: { accent: '#abcdef' } }),
        resolvedNode({
          id: 'own',
          x: 400,
          y: 0,
          meta: { accent: '#123456' },
          definition: { accent: '#abcdef' },
        }),
        resolvedNode({ id: 'hidden', x: 5000, y: 5000 }),
      ],
      groups: [
        { id: 'open', x: -100, y: -100, width: 300, height: 300, color: '#ff00ff' },
        { id: 'closed', x: 600, y: 0, width: 300, height: 300, data: { collapsed: true } },
      ],
      headerHeight: 40,
      hiddenNodeIds: new Set(['hidden']),
    })

    expect([...scene.nodesByColor.keys()]).toEqual([undefined, '#abcdef', '#123456'])
    expect(scene.nodesById.has('hidden')).toBe(false)
    expect(scene.groups).toEqual([
      { x: -100, y: -100, width: 300, height: 300, color: '#ff00ff' },
      { x: 600, y: 0, width: 300, height: 40, color: undefined },
    ])
    expect(scene.bounds).toEqual({ x: -100, y: -100, width: 1000, height: 300 })
  })

  it('has no bounds for an empty graph', () => {
    expect(
      createMinimapScene({ nodes: [], groups: [], headerHeight: 40, hiddenNodeIds: new Set() })
        .bounds,
    ).toBeNull()
  })
})

describe('minimap painting', () => {
  const colors = { node: '#00ff00', selection: '#ff0000', group: '#0000ff' }

  function sceneOf(count: number) {
    return createMinimapScene({
      nodes: Array.from({ length: count }, (_, index) =>
        resolvedNode({ id: `node-${index}`, x: index * 150 }),
      ),
      groups: [{ id: 'group', x: 0, y: 0, width: 400, height: 200 }],
      headerHeight: 40,
      hiddenNodeIds: new Set(),
    })
  }

  it('sizes the canvas to the device pixels and paints groups, nodes and the selection', () => {
    const canvas = document.createElement('canvas')
    const recording = createRecordingContext(canvas)

    paintMinimap(recording.ctx, {
      width: 200,
      height: 100,
      dpr: 2,
      transform: { scale: 0.5, x: 0, y: 0 },
      scene: sceneOf(2),
      selectedNodeIds: new Set(['node-1', 'missing']),
      colors,
    })

    expect([canvas.width, canvas.height]).toEqual([400, 200])
    expect(recording.calls[0]).toEqual({ name: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
    expect(recording.fillStyles()).toEqual(['#0000ff', '#00ff00', '#ff0000'])
    expect(recording.count('fillRect')).toBe(1)
    expect(recording.count('roundRect')).toBe(3)
    expect(recording.count('fill')).toBe(2)
  })

  it('paints large graphs as plain rectangles in one path per colour', () => {
    const canvas = document.createElement('canvas')
    const recording = createRecordingContext(canvas)
    const count = MINIMAP_ROUNDED_NODE_LIMIT + 1

    paintMinimap(recording.ctx, {
      width: 200,
      height: 100,
      dpr: 1,
      transform: { scale: 0.001, x: 0, y: 0 },
      scene: sceneOf(count),
      selectedNodeIds: new Set(),
      colors,
    })

    expect(recording.count('rect')).toBe(count)
    expect(recording.count('roundRect')).toBe(0)
    expect(recording.count('fill')).toBe(1)

    // Nodes stay at least one pixel in size.
    const [, , width, height] = recording.calls.find((call) => call.name === 'rect')!.args

    expect([width, height]).toEqual([1, 1])
  })

  it('only clears the canvas when there is nothing to show', () => {
    const canvas = document.createElement('canvas')
    const recording = createRecordingContext(canvas)

    paintMinimap(recording.ctx, {
      width: 200,
      height: 100,
      dpr: 1,
      transform: null,
      scene: sceneOf(1),
      selectedNodeIds: new Set(),
      colors,
    })

    expect(recording.calls.map((call) => call.name)).toEqual(['setTransform', 'clearRect'])
  })
})

describe('minimap state', () => {
  it('is off by default and costs nothing', () => {
    harness = mountEditor({ graph: createMinimapGraph(), nodeTypes: canvasOnlyNodeTypes })

    expect(harness.controller.getSnapshot().minimap).toBeNull()
  })

  it('normalizes the option and keeps its state stable across unrelated updates', () => {
    harness = mountEditor({ graph: createMinimapGraph(), nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness
    const graph = controller.getSnapshot().graph

    controller.update({ graph, nodeTypes: canvasOnlyNodeTypes, minimap: true })

    const enabled = controller.getSnapshot().minimap

    expect(enabled).toEqual({
      style: { width: '200px', height: '136px' },
      viewportStyle: { transform: 'translate(20px, 8px)', width: '64px', height: '48px' },
      dragging: false,
    })

    controller.update({ graph, nodeTypes: canvasOnlyNodeTypes, minimap: {}, readonly: true })
    expect(controller.getSnapshot().minimap).toBe(enabled)

    controller.update({
      graph,
      nodeTypes: canvasOnlyNodeTypes,
      minimap: { width: 240, height: -1, padding: Number.NaN },
    })
    expect(controller.getSnapshot().minimap?.style).toEqual({ width: '240px', height: '136px' })

    controller.update({ graph, nodeTypes: canvasOnlyNodeTypes, minimap: false })
    expect(controller.getSnapshot().minimap).toBeNull()
  })

  it('has no viewport rectangle until the editor is mounted', () => {
    installFrameQueue()
    const controller = createEditorController({
      graph: createMinimapGraph(),
      nodeTypes: canvasOnlyNodeTypes,
      minimap: { width: 100, height: 100, padding: 0 },
    })

    expect(controller.getSnapshot().minimap).toEqual({
      style: { width: '100px', height: '100px' },
      viewportStyle: null,
      dragging: false,
    })
    controller.destroy()
  })

  it('follows the viewport and the graph', () => {
    const editor = mountWithMinimap()
    const viewportStyle = () => editor.controller.getSnapshot().minimap?.viewportStyle

    editor.controller.api.view.set({ x: -100, y: -50 })
    expect(viewportStyle()).toEqual({
      transform: 'translate(28px, 12px)',
      width: '64px',
      height: '48px',
    })

    // A node far to the left widens the world, so the overview shrinks.
    editor.controller.api.nodes.move(['a'], { x: -2000, y: 0 })
    expect(viewportStyle()?.width).toBe('36.8px')
  })
})

describe('minimap painting schedule', () => {
  it('paints in an animation frame and repaints only when a paint input changed', () => {
    harness = mountEditor({
      graph: createMinimapGraph(),
      nodeTypes: canvasOnlyNodeTypes,
      theme,
      minimap: true,
    })
    const host = createMinimapHost(harness.root)
    const recording = recordCanvas(host.canvas)
    const { controller, frames } = harness

    controller.mountMinimap(host)
    expect(recording.count('clearRect')).toBe(0)

    frames.flush()
    expect(recording.count('clearRect')).toBe(1)
    expect(recording.fillStyles()).toEqual(['#00ff00', '#123456'])

    // Panning inside the world only moves the viewport rectangle.
    controller.api.view.set({ x: -100, y: -50 })
    frames.flush()
    expect(recording.count('clearRect')).toBe(1)

    // Leaving the content changes the world and with it the overview.
    controller.api.view.set({ x: 500, y: 0 })
    frames.flush()
    expect(recording.count('clearRect')).toBe(2)

    recording.reset()
    controller.api.selection.nodes(['a'])
    frames.flush()
    expect(recording.fillStyles()).toEqual(['#00ff00', '#123456', '#ff0000'])

    recording.reset()
    controller.update({
      graph: controller.getSnapshot().graph,
      nodeTypes: canvasOnlyNodeTypes,
      theme,
      minimap: true,
      readonly: true,
    })
    frames.flush()
    expect(recording.calls).toEqual([])

    controller.update({
      graph: controller.getSnapshot().graph,
      nodeTypes: canvasOnlyNodeTypes,
      theme: { ...theme, minimapNodeColor: '#999999' },
      minimap: true,
    })
    frames.flush()
    expect(recording.fillStyles()[0]).toBe('#999999')
  })

  it('stops painting while the option is off', () => {
    harness = mountEditor({
      graph: createMinimapGraph(),
      nodeTypes: canvasOnlyNodeTypes,
      minimap: true,
    })
    const host = createMinimapHost(harness.root)
    const recording = recordCanvas(host.canvas)
    const { controller, frames } = harness
    const graph = controller.getSnapshot().graph

    controller.mountMinimap(host)
    controller.update({ graph, nodeTypes: canvasOnlyNodeTypes, minimap: false })
    frames.flush()
    expect(recording.calls).toEqual([])

    controller.update({ graph, nodeTypes: canvasOnlyNodeTypes, minimap: true })
    frames.flush()
    expect(recording.count('clearRect')).toBe(1)
  })

  it('rebuilds the rectangles on graph changes only, not on viewport changes', () => {
    const nodes = Array.from({ length: 5000 }, (_, index) =>
      resolvedNode({
        id: `node-${index}`,
        x: (index % 100) * 200,
        y: Math.floor(index / 100) * 150,
      }),
    )
    const graph = signal(createGraph())
    const liveViewport = signal({ x: 0, y: 0, zoom: 1 })
    let builds = 0
    const minimap = createMinimap({
      options: signal(resolveEditorOptions({ minimap: true })),
      graph,
      schemaRevision: signal(0),
      nodeTypes: signal({}),
      nodeRenderer: signal(undefined),
      resolvedNodes: () => {
        builds += 1
        return nodes
      },
      groupHeaderHeight: signal(40),
      selectedNodeIds: signal(new Set<string>()),
      graphTheme: signal(resolveGraphCanvasTheme({})),
      surface: signal({ width: 800, height: 600, dpr: 1 }),
      liveViewport,
      preview: signal(null),
      getViewport: () => liveViewport.peek(),
      setViewport: () => undefined,
      interaction: { begin: () => undefined, update: () => undefined, end: () => undefined },
      canStart: () => true,
      prepare: () => undefined,
      drawNow: () => undefined,
    })

    const first = minimap.state.value

    for (let step = 1; step <= 20; step += 1) {
      liveViewport.value = { x: -step * 100, y: -step * 50, zoom: 1 }
      void minimap.state.value
    }

    expect(builds).toBe(1)
    expect(minimap.state.value).not.toBe(first)

    graph.value = createGraph()
    void minimap.state.value
    expect(builds).toBe(2)
  })
})

describe('minimap interaction', () => {
  function pointer(
    editor: EditorHarness,
    target: EventTarget,
    type: string,
    point: { x: number; y: number },
    init: PointerEventInit = {},
  ): PointerEvent {
    return editor.pointer(target, type, point, init)
  }

  it('centres the viewport on a clicked point and commits it once on release', () => {
    const editor = mountWithMinimap()
    const { controller, minimap } = editor
    const editorPointerDown = vi.fn()

    editor.root.addEventListener('pointerdown', editorPointerDown)
    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })

    const expected = { x: 400 - (150 - 20) / SCALE, y: 300 - (100 - 8) / SCALE }

    expect(editorPointerDown).not.toHaveBeenCalled()
    expect(controller.api.view.getLive()).toMatchObject({
      x: expect.closeTo(expected.x),
      y: expect.closeTo(expected.y),
    })
    expect(controller.api.view.get()).toMatchObject({ x: 0, y: 0 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(true)
    expect(controller.getSnapshot().interaction).toMatchObject({
      mode: 'pan',
      viewportSource: 'minimap',
    })
    expect(controller.getSnapshot().domLayer.composited).toBe(true)

    pointer(editor, minimap.root, 'pointerup', { x: 150, y: 100 })

    expect(controller.api.view.get()).toMatchObject({
      x: expect.closeTo(expected.x),
      y: expect.closeTo(expected.y),
    })
    expect(editor.eventsNamed('viewport-change')).toEqual([
      [expect.objectContaining({ x: expect.closeTo(expected.x) }), 'minimap'],
    ])
    expect(editor.eventNames().filter((name) => name.startsWith('viewport'))).toEqual([
      'viewport-interaction-start',
      'viewport-interaction',
      'viewport-interaction',
      'viewport-change',
      'viewport-interaction-end',
    ])
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)
    expect(controller.getSnapshot().interaction.viewportSource).toBeNull()
  })

  it('drags the viewport rectangle with the pointer offset and commits once', () => {
    const editor = mountWithMinimap()
    const { controller, minimap, frames } = editor
    const viewportStyle = () => controller.getSnapshot().minimap?.viewportStyle

    pointer(editor, minimap.root, 'pointerdown', { x: 40, y: 30 })
    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })

    pointer(editor, minimap.root, 'pointermove', { x: 60, y: 40 })
    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })

    frames.flush()
    expect(controller.api.view.getLive()).toMatchObject({
      x: expect.closeTo(-250),
      y: expect.closeTo(-125),
    })
    expect(viewportStyle()?.transform).toBe('translate(40px, 18px)')

    // The overview keeps its scale during the drag, even beyond the content.
    pointer(editor, window, 'pointermove', { x: 200, y: 130 })
    frames.flush()
    expect(viewportStyle()?.transform).toBe('translate(180px, 108px)')

    pointer(editor, window, 'pointerup', { x: 80, y: 50 })

    expect(controller.api.view.get()).toMatchObject({
      x: expect.closeTo(-500),
      y: expect.closeTo(-250),
    })
    expect(editor.eventsNamed('viewport-change')).toHaveLength(1)
    expect(editor.eventsNamed('viewport-interaction-start')).toHaveLength(1)
    expect(editor.eventsNamed('viewport-interaction-end')).toHaveLength(1)
    expect(editor.eventsNamed('viewport-interaction').length).toBeGreaterThanOrEqual(2)
    expect(editor.eventsNamed('viewport-interaction')[0]?.[0]).toMatchObject({
      source: 'minimap',
    })
  })

  it('does not commit a press without movement, and cancels without committing', () => {
    const editor = mountWithMinimap()
    const { controller, minimap, frames } = editor

    pointer(editor, minimap.root, 'pointerdown', { x: 40, y: 30 })
    pointer(editor, minimap.root, 'pointerup', { x: 40, y: 30 })
    expect(editor.eventsNamed('viewport-change')).toHaveLength(0)
    expect(minimap.root.hasPointerCapture(1)).toBe(false)

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })
    pointer(editor, minimap.root, 'pointermove', { x: 160, y: 110 })
    pointer(editor, minimap.root, 'pointercancel', { x: 160, y: 110 })
    frames.flush()

    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })
    expect(editor.eventsNamed('viewport-change')).toHaveLength(0)
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })
    window.dispatchEvent(new Event('blur'))
    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })
  })

  it('ignores secondary buttons, other pointers and presses during canvas gestures', () => {
    const editor = mountWithMinimap()
    const { controller, minimap, canvas } = editor

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 }, { button: 2 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)

    // A background pan owns the viewport until it ends.
    pointer(editor, canvas, 'pointerdown', { x: 400, y: 300 })
    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 }, { pointerId: 2 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)
    pointer(editor, window, 'pointerup', { x: 400, y: 300 })

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })
    pointer(editor, minimap.root, 'pointermove', { x: 10, y: 10 }, { pointerId: 2 })
    pointer(editor, minimap.root, 'pointerup', { x: 10, y: 10 }, { pointerId: 2 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(true)
    pointer(editor, minimap.root, 'pointerup', { x: 150, y: 100 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)
  })

  it('keeps wheel input away from the canvas', () => {
    const editor = mountWithMinimap()
    const { controller, minimap } = editor
    const wheel = (target: EventTarget) => {
      const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
      target.dispatchEvent(event)
      return event
    }

    expect(wheel(minimap.root).defaultPrevented).toBe(true)
    expect(controller.api.view.getLive().zoom).toBe(1)

    // While dragging, wheel input anywhere is held back.
    pointer(editor, minimap.root, 'pointerdown', { x: 40, y: 30 })
    expect(wheel(editor.canvas).defaultPrevented).toBe(true)
    expect(controller.api.view.getLive().zoom).toBe(1)
    pointer(editor, minimap.root, 'pointerup', { x: 40, y: 30 })

    wheel(editor.canvas)
    editor.frames.flush()
    expect(controller.api.view.getLive().zoom).not.toBe(1)
  })

  it('pans by a tenth of the visible area per arrow key, four times with Shift', () => {
    const editor = mountWithMinimap()
    const { controller, minimap } = editor
    const editorKeyDown = vi.fn()
    const key = (name: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
        ...init,
      })
      minimap.root.dispatchEvent(event)
      return event
    }

    editor.root.addEventListener('keydown', editorKeyDown)

    expect(key('ArrowRight').defaultPrevented).toBe(true)
    expect(controller.api.view.get()).toMatchObject({ x: -80, y: 0 })

    key('ArrowDown', { shiftKey: true })
    expect(controller.api.view.get()).toMatchObject({ x: -80, y: -240 })

    key('ArrowLeft')
    key('ArrowUp')
    expect(controller.api.view.get()).toMatchObject({ x: 0, y: -180 })
    expect(editor.eventsNamed('viewport-change').at(-1)?.[1]).toBe('minimap.keyboard')
    expect(editorKeyDown).not.toHaveBeenCalled()

    expect(key('ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key('a').defaultPrevented).toBe(false)
    expect(editorKeyDown).toHaveBeenCalledTimes(2)

    // Arrow keys do nothing while the minimap is dragged.
    pointer(editor, minimap.root, 'pointerdown', { x: 40, y: 30 })
    key('ArrowRight')
    pointer(editor, minimap.root, 'pointerup', { x: 40, y: 30 })
    expect(controller.api.view.get()).toMatchObject({ x: 0, y: -180 })
  })

  it('maps pointer positions through a CSS scale of the minimap', () => {
    const editor = mountWithMinimap()
    const { controller, minimap } = editor

    // Shown at half its size, 10 px from the client origin.
    vi.spyOn(minimap.canvas, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 10, y: 10, width: 100, height: 68 }),
    )
    pointer(editor, minimap.root, 'pointerdown', { x: 85, y: 60 })
    pointer(editor, minimap.root, 'pointerup', { x: 85, y: 60 })

    expect(controller.api.view.get()).toMatchObject({
      x: expect.closeTo(400 - (150 - 20) / SCALE),
      y: expect.closeTo(300 - (100 - 8) / SCALE),
    })
  })

  it('keeps the preview while the editor is not mounted during a drag', () => {
    const editor = mountWithMinimap()
    const { controller, minimap, frames } = editor

    pointer(editor, minimap.root, 'pointerdown', { x: 40, y: 30 })
    controller.unmount()
    pointer(editor, minimap.root, 'pointermove', { x: 60, y: 40 })
    frames.flush()
    pointer(editor, minimap.root, 'pointerup', { x: 60, y: 40 })

    expect(controller.api.view.get()).toMatchObject({ x: 0, y: 0 })
    expect(editor.eventsNamed('viewport-change')).toHaveLength(0)
  })

  it('cancels a drag when the option is turned off', () => {
    const editor = mountWithMinimap()
    const { controller, minimap } = editor

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })
    controller.update({
      graph: controller.getSnapshot().graph,
      nodeTypes: canvasOnlyNodeTypes,
      minimap: false,
    })

    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })
    expect(controller.getSnapshot().interaction.viewportSource).toBeNull()
    expect(minimap.root.hasPointerCapture(1)).toBe(false)

    pointer(editor, minimap.root, 'pointerdown', { x: 150, y: 100 })
    expect(controller.getSnapshot().interaction.viewportSource).toBeNull()
  })
})

describe('minimap lifecycle', () => {
  it('works before the editor is mounted', () => {
    const frames = installFrameQueue()
    const root = document.createElement('div')
    const canvas = document.createElement('canvas')
    const gridCanvas = document.createElement('canvas')
    const host = createMinimapHost(root)
    const recording = recordCanvas(host.canvas)
    const controller = createEditorController({
      graph: createMinimapGraph(),
      nodeTypes: canvasOnlyNodeTypes,
      minimap: true,
    })

    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 600 })
    root.append(gridCanvas, canvas)
    document.body.append(root)

    controller.mountMinimap(host)
    frames.flush()
    expect(recording.count('roundRect')).toBe(2)

    // Without a visible area there is nothing to pan.
    host.root.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, button: 0, bubbles: true }),
    )
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)
    host.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(controller.api.view.get()).toMatchObject({ x: 0, y: 0 })

    controller.mount({ root, canvas, gridCanvas })
    expect(controller.getSnapshot().minimap?.viewportStyle).not.toBeNull()

    controller.destroy()
    root.remove()
  })

  it('detaches its listeners and queued frames when unmounted', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const addToWindow = vi.spyOn(window, 'addEventListener')
    const removeFromWindow = vi.spyOn(window, 'removeEventListener')
    const editor = mountWithMinimap()
    const { controller, minimap, frames } = editor
    const recording = recordCanvas(minimap.canvas)
    const listenersOf = (spy: typeof add, target: EventTarget) =>
      spy.mock.contexts.filter((context) => context === target).length

    expect(listenersOf(add, minimap.root)).toBeGreaterThan(0)

    pointer(minimap.root, 'pointerdown', { x: 150, y: 100 })
    expect(addToWindow.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'blur', 'wheel']),
    )

    editor.unmountMinimap()

    expect(listenersOf(remove, minimap.root)).toBe(listenersOf(add, minimap.root))
    expect(removeFromWindow.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: 0 })
    expect(controller.getSnapshot().minimap?.dragging).toBe(false)

    frames.flush()
    expect(recording.calls).toEqual([])

    // A second call is a no-op; the minimap can be attached again.
    editor.unmountMinimap()
    const detach = controller.mountMinimap(minimap)

    expect(() => controller.mountMinimap(minimap)).toThrow(/already mounted/u)
    editor.unmountMinimap()
    expect(() => controller.mountMinimap(minimap)).toThrow(/already mounted/u)
    detach()

    function pointer(target: EventTarget, type: string, point: { x: number; y: number }) {
      editor.pointer(target, type, point)
    }
  })

  it('is detached by destroy()', () => {
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const editor = mountWithMinimap()
    const { controller, minimap } = editor

    controller.destroy()

    expect(remove.mock.contexts).toContain(minimap.root)
    expect(() => editor.unmountMinimap()).not.toThrow()
    expect(() => controller.mountMinimap(minimap)).toThrow(/destroyed/u)
  })

  it('requires a host inside a window', () => {
    harness = mountEditor({ minimap: true })
    const detached = document.implementation.createHTMLDocument('detached')
    const canvas = detached.createElement('canvas')

    Object.defineProperty(detached, 'defaultView', { value: null })
    expect(() =>
      harness!.controller.mountMinimap({ root: detached.createElement('div'), canvas }),
    ).toThrow(/document with a window/u)
  })
})
