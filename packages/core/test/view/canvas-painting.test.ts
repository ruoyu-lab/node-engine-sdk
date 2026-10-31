import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawGraphCanvas } from '../../src/view/rendering/graph-canvas'
import { drawCanvasNodes } from '../../src/view/rendering/node-canvas'
import type { NodeWrightCanvasNodeTheme, NodeWrightRenderContext } from '@node-wright/core/view'
import {
  canvasOnlyNodeTypes,
  createConnectableGraph,
  createGraph,
  mountEditor,
  type EditorHarness,
} from './editor-harness'

interface RecordingContext {
  ctx: CanvasRenderingContext2D
  calls: string[]
  texts: string[]
  reset: () => void
}

/** A 2D context stand-in that records every drawing call. */
function createRecordingContext(canvas: { width: number; height: number; style: object }) {
  const calls: string[] = []
  const texts: string[] = []
  const gradient = { addColorStop: () => undefined }
  const target = {
    canvas,
    measureText: (text: string) => ({ width: text.length * 7 }),
    fillText: (text: string) => {
      calls.push('fillText')
      texts.push(text)
    },
  }
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property as keyof typeof object]
      }

      return () => {
        calls.push(String(property))
        return gradient
      }
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D

  return {
    ctx,
    calls,
    texts,
    reset() {
      calls.length = 0
      texts.length = 0
    },
  } satisfies RecordingContext
}

const theme: NodeWrightCanvasNodeTheme = {
  background: '#161B22',
  border: '#30363D',
  borderSelected: '#2EA043',
  shadow: '#010409',
  title: '#E6EDF3',
  subtitle: '#8B949E',
  meta: '#6E7681',
  portFill: '#0D1117',
  portStroke: '#484F58',
  portLabel: '#C9D1D9',
  portActive: '#3FB950',
  portActiveFill: '#FFFFFF',
  portConnected: '#2F81F7',
  portConnectedDot: '#FFFFFF',
}

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
  vi.restoreAllMocks()
})

describe('canvas painters', () => {
  it('paints groups, edges and the draft edge in graph space', () => {
    const recording = createRecordingContext({ width: 0, height: 0, style: {} })

    drawGraphCanvas({
      ctx: recording.ctx,
      width: 400,
      height: 300,
      dpr: 2,
      viewport: { x: 10, y: 20, zoom: 1.5 },
      theme: {
        edgeColor: '#30363D',
        edgeActiveColor: '#2ECC71',
        draftEdgeColor: '#58A6FF',
        draftEdgeGlowColor: 'rgba(88, 166, 255, 0.26)',
        groupBackground: '#090C10',
        groupBorderColor: '#21262D',
        groupLabelColor: '#8B949E',
      },
      groups: [
        {
          id: 'group',
          group: { id: 'group', x: 0, y: 0, width: 300, height: 200, label: 'Pipeline' },
          bounds: { x: 0, y: 0, width: 300, height: 200 },
          headerHeight: 40,
          collapsed: true,
          showCloseButton: true,
          showCollapseButton: true,
          resizable: true,
          borderColor: '#abc',
          backgroundColor: '#090C10',
          labelColor: '#8B949E',
        },
      ],
      edges: [
        {
          id: 'edge',
          start: { x: 0, y: 0, side: 'right' },
          end: { x: 200, y: 100, side: 'left' },
          stroke: '#30363D',
          strokeWidth: 2,
          selected: false,
        },
      ],
      draftEdge: {
        start: { x: 0, y: 0, side: 'right' },
        end: { x: 50, y: 50 },
        color: '#58A6FF',
        targetDirection: 'input',
      },
    })

    expect(recording.texts).toEqual(['Pipeline'])
    expect(recording.calls.filter((call) => call === 'bezierCurveTo')).toHaveLength(2)
    expect(recording.calls).toContain('arcTo')
    expect(recording.calls).toContain('arc')
  })

  it('paints default canvas nodes with less detail as the zoom drops', () => {
    const recording = createRecordingContext({ width: 0, height: 0, style: {} })
    const node = {
      id: 'node',
      type: 'task',
      x: 0,
      y: 0,
      data: { title: 'Load data', summary: 'Reads the input file', category: 'io' },
      meta: { accent: '#7ab497' },
    }
    const port = {
      endpoint: { nodeId: 'node', portId: 'out' },
      x: 200,
      y: 60,
      side: 'right' as const,
      port: { id: 'out', direction: 'output' as const, label: 'Output', kind: 'exec' },
      connectionCount: 1,
    }
    const entry = {
      node,
      bounds: { x: 0, y: 0, width: 200, height: 120 },
      inputs: [
        {
          ...port,
          endpoint: { nodeId: 'node', portId: 'in' },
          x: 0,
          side: 'left' as const,
          port: { id: 'in', direction: 'input' as const },
        },
      ],
      outputs: [port],
      selected: true,
      dragging: false,
    }
    const paint = (zoom: number) => {
      recording.reset()
      drawCanvasNodes(recording.ctx, [entry], {
        zoom,
        readonly: false,
        theme,
        connectionSource: port.endpoint,
        context: {} as NodeWrightRenderContext,
      })
      return { calls: [...recording.calls], texts: [...recording.texts] }
    }

    const full = paint(1)
    const reduced = paint(0.4)
    const compact = paint(0.25)
    const ultraCompact = paint(0.1)

    expect(full.texts).toEqual(expect.arrayContaining(['Load data', 'Output']))
    expect(full.calls.length).toBeGreaterThan(reduced.calls.length)
    expect(reduced.texts).toContain('Load data')
    expect(compact.texts).not.toContain('Output')
    expect(ultraCompact.texts).toEqual([])

    const custom = vi.fn()
    drawCanvasNodes(recording.ctx, [{ ...entry, definition: { canvas: { draw: custom } } }], {
      zoom: 1,
      readonly: false,
      theme,
      context: {} as NodeWrightRenderContext,
    })
    expect(custom).toHaveBeenCalledWith(expect.objectContaining({ node, zoom: 1, selected: true }))
  })
})

describe('editor painting', () => {
  it('paints once per frame and only when the painted state changed', () => {
    const contexts = new Map<HTMLCanvasElement, RecordingContext>()

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      let recording = contexts.get(this)

      if (!recording) {
        recording = createRecordingContext(this)
        contexts.set(this, recording)
      }

      return recording.ctx
    } as HTMLCanvasElement['getContext'])

    harness = mountEditor({
      graph: createGraph({
        ...createConnectableGraph(),
        edges: [
          {
            id: 'edge',
            kind: 'data',
            source: { nodeId: 'source', portId: 'out' },
            target: { nodeId: 'target', portId: 'in' },
          },
        ],
        groups: [{ id: 'group', x: -40, y: -60, width: 700, height: 260, label: 'All' }],
      }),
      nodeTypes: canvasOnlyNodeTypes,
      performance: { enabled: true },
    })
    const { controller, canvas, gridCanvas, frames } = harness

    expect(contexts.size).toBe(0)
    frames.flush()

    const graphPaint = contexts.get(canvas)!
    const gridPaint = contexts.get(gridCanvas)!

    expect(canvas.width).toBe(800)
    expect(graphPaint.calls).toContain('bezierCurveTo')
    expect(graphPaint.texts).toEqual(expect.arrayContaining(['All']))
    // The default dot grid fills one path per grid level.
    expect(gridPaint.calls).toContain('fill')

    graphPaint.reset()
    gridPaint.reset()
    frames.flush()
    expect(graphPaint.calls).toEqual([])
    expect(gridPaint.calls).toEqual([])

    controller.api.view.set({ x: 15 })
    expect(frames.size).toBeGreaterThan(0)
    frames.flush()
    expect(graphPaint.calls).toContain('setTransform')
    expect(gridPaint.calls).toContain('fill')

    graphPaint.reset()
    harness.pointer(canvas, 'pointerdown', { x: 700, y: 500 })
    harness.pointer(window, 'pointermove', { x: 720, y: 520 })
    frames.flush()

    const paintedDuringPan = graphPaint.calls.length
    expect(paintedDuringPan).toBeGreaterThan(0)
    expect(controller.getSnapshot().domLayer.composited).toBe(true)

    harness.pointer(window, 'pointerup', { x: 720, y: 520 })
    expect(controller.api.view.get()).toMatchObject({ x: 35, y: 20 })
    expect(harness.eventsNamed('performance-sample').length).toBeGreaterThan(0)
  })

  it('shows the performance overlay until it is dismissed', () => {
    harness = mountEditor({
      graph: createGraph(),
      performance: { overlay: true, overlayDismissible: true },
    })
    const { controller } = harness

    expect(controller.getSnapshot().performance).toMatchObject({
      visible: true,
      dismissible: true,
      sample: expect.objectContaining({ renderMode: 'canvas', totalNodes: 0 }),
    })

    controller.hidePerformanceOverlay()
    expect(controller.getSnapshot().performance.visible).toBe(false)
    expect(controller.api.runtime.performance.get()).toBeNull()
  })
})
