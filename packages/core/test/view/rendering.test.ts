import type { GraphPort } from '@node-engine-sdk/core/protocol'
import { describe, expect, it, vi } from 'vitest'
import {
  getBezierCurve,
  getEdgeBounds,
  isPointNearEdge,
} from '../../src/view/rendering/edge-canvas'
import { getDraftEdgeEntry, resolveEdgeRenderer } from '../../src/view/rendering/entries'
import { drawGridCanvas } from '../../src/view/rendering/grid-canvas'
import { createPerformanceSample } from '../../src/view/rendering/performance'
import type { PortLayout } from '../../src/view/rendering/node-layout'

describe('edge rendering', () => {
  it('orients bezier controls from endpoint sides', () => {
    const inputDragCurve = getBezierCurve(
      { x: 100, y: 100, side: 'left' },
      { x: 20, y: 100, side: 'right' },
    )

    expect(inputDragCurve.controlA.x).toBeLessThan(inputDragCurve.start.x)
    expect(inputDragCurve.controlB.x).toBeGreaterThan(inputDragCurve.end.x)

    const outputDragCurve = getBezierCurve(
      { x: 100, y: 100, side: 'right' },
      { x: 180, y: 100, side: 'left' },
    )

    expect(outputDragCurve.controlA.x).toBeGreaterThan(outputDragCurve.start.x)
    expect(outputDragCurve.controlB.x).toBeLessThan(outputDragCurve.end.x)
  })

  it('uses final port-side bezier controls for draft edges', () => {
    const inputPort = createPortLayout({ nodeId: 'target', portId: 'seed', direction: 'input' })
    const draft = getDraftEdgeEntry({
      connection: {
        source: inputPort.endpoint,
        originDirection: 'input',
        current: { x: 20, y: 100 },
      },
      source: inputPort,
      color: '#5b8def',
    })

    expect(draft?.targetDirection).toBe('output')
    expect(draft?.looseEndpoint).toBe('start')
    expect(draft?.start.side).toBe('right')
    expect(draft?.start.tangent).toBeUndefined()
    expect(draft?.end).toBe(inputPort)

    const diagonalDraft = getDraftEdgeEntry({
      connection: {
        source: inputPort.endpoint,
        originDirection: 'input',
        current: { x: 20, y: 60 },
      },
      source: inputPort,
      color: '#5b8def',
    })
    const diagonalCurve = getBezierCurve(diagonalDraft!.start, diagonalDraft!.end)

    expect(diagonalCurve.controlA.x).toBeGreaterThan(diagonalCurve.start.x)
    expect(diagonalCurve.controlA.y).toBe(diagonalCurve.start.y)
    expect(diagonalCurve.controlB.x).toBeLessThan(diagonalCurve.end.x)
    expect(diagonalCurve.controlB.y).toBe(diagonalCurve.end.y)

    expect(getDraftEdgeEntry({ connection: null, source: inputPort, color: '#fff' })).toBeNull()
  })

  it('hit tests and bounds edges along the curve', () => {
    const start = { x: 0, y: 0, side: 'right' as const }
    const end = { x: 200, y: 0, side: 'left' as const }
    const edge = { start, end, strokeWidth: 2 }

    expect(isPointNearEdge({ x: 100, y: 2 }, edge, 1)).toBe(true)
    expect(isPointNearEdge({ x: 100, y: 40 }, edge, 1)).toBe(false)
    expect(isPointNearEdge({ x: 100, y: 40 }, { ...edge, hitTest: () => true }, 1)).toBe(true)
    expect(getEdgeBounds(start, end)).toMatchObject({ x: 0, width: 200 })
  })

  it('lets later edge renderer contributions win and falls back to type definitions', () => {
    const edge = {
      id: 'edge',
      kind: 'data',
      type: 'flow',
      source: { nodeId: 'a', portId: 'out' },
      target: { nodeId: 'b', portId: 'in' },
    }
    const typed = { draw: vi.fn() }
    const first = { draw: vi.fn() }
    const second = { draw: vi.fn() }

    expect(resolveEdgeRenderer(edge, undefined, { canvas: typed }, [], undefined)).toBe(typed)
    expect(
      resolveEdgeRenderer(
        edge,
        undefined,
        { canvas: typed },
        [
          { id: 'first', renderer: first },
          { id: 'second', type: 'other', renderer: second },
        ],
        undefined,
      ),
    ).toBe(first)
  })
})

describe('grid and performance rendering', () => {
  it('resizes the grid canvas to the device pixel ratio before painting', () => {
    const ctx = createRecordingContext()

    drawGridCanvas({
      ctx,
      width: 100,
      height: 50,
      dpr: 2,
      viewport: { x: 5, y: 5, zoom: 1 },
      grid: { visible: true, pixelStep: 20, majorPixelStep: 80, style: 'dot' },
      minorColor: '#111',
      majorColor: '#222',
    })

    expect(ctx.canvas.width).toBe(200)
    expect(ctx.canvas.height).toBe(100)
    expect(ctx.calls).toContain('arc')
  })

  it('derives fps from the average frame time', () => {
    const sample = createPerformanceSample({
      renderMode: 'dom',
      mode: 'idle',
      frameMs: 16.666,
      avgFrameMs: 20,
      drawMs: 1.234,
      avgDrawMs: 1,
      totalNodes: 2,
      visibleNodes: 1,
      totalEdges: 0,
      visibleEdges: 0,
      totalGroups: 0,
      visibleGroups: 0,
    })

    expect(sample).toMatchObject({ fps: 50, frameMs: 16.67, drawMs: 1.23 })
  })
})

function createPortLayout(options: {
  nodeId: string
  portId: string
  direction: GraphPort['direction']
}): PortLayout {
  return {
    endpoint: { nodeId: options.nodeId, portId: options.portId },
    x: 100,
    y: 100,
    side: 'left',
    port: { id: options.portId, direction: options.direction, side: 'left' },
  }
}

function createRecordingContext(): CanvasRenderingContext2D & { calls: string[] } {
  const calls: string[] = []
  const canvas = { width: 0, height: 0, style: {} as CSSStyleDeclaration }

  return new Proxy(
    { canvas, calls },
    {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target]
        }

        return (..._args: unknown[]) => {
          calls.push(String(property))
        }
      },
      set() {
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D & { calls: string[] }
}
