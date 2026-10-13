import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGraph, mountEditor, type EditorHarness } from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

/** Counts the drawing calls `canvas` receives; other canvases keep their (absent) context. */
function countCanvasCalls(canvas: HTMLCanvasElement): Map<string, number> {
  const counts = new Map<string, number>()
  const ctx = new Proxy(
    { canvas },
    {
      get: (target, property) =>
        property === 'canvas'
          ? target.canvas
          : () => counts.set(String(property), (counts.get(String(property)) ?? 0) + 1),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D
  const original = HTMLCanvasElement.prototype.getContext

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    ...args: Parameters<HTMLCanvasElement['getContext']>
  ) {
    return this === canvas ? ctx : original.apply(this, args)
  } as HTMLCanvasElement['getContext'])

  return counts
}

/** A 100 × 50 grid of 5,000 DOM nodes spaced 200 × 150 graph units apart. */
function createLargeGraph() {
  return createGraph({
    nodes: Array.from({ length: 5000 }, (_, index) => ({
      id: `node-${index}`,
      type: 'task',
      x: (index % 100) * 200,
      y: Math.floor(index / 100) * 150,
      width: 160,
      height: 100,
    })),
  })
}

describe('editor view at scale', () => {
  it('culls 5,000 nodes to the viewport and keeps viewport updates incremental', () => {
    const started = performance.now()
    harness = mountEditor(
      { graph: createLargeGraph(), performance: { cullPadding: 0 } },
      { width: 800, height: 600 },
    )
    const { controller } = harness
    const visible = controller.getSnapshot().domLayer.nodes

    // Columns 0–4 and rows 0–4 intersect the 800 × 600 viewport (edges are inclusive).
    expect(visible.length).toBe(25)
    expect(controller.getSnapshot().graph.nodes).toHaveLength(5000)

    controller.api.view.set({ x: -2000, y: -1500 })
    const moved = controller.getSnapshot().domLayer.nodes

    expect(moved.map((entry) => entry.id)).toContain('node-1010')
    expect(moved.map((entry) => entry.id)).not.toContain('node-0')
    expect(moved.length).toBe(25)

    controller.api.selection.all()
    expect(controller.getSnapshot().selection.nodes).toHaveLength(5000)
    expect(performance.now() - started).toBeLessThan(5000)
  })

  it('keeps a 5,000-node minimap out of viewport updates', () => {
    harness = mountEditor(
      { graph: createLargeGraph(), performance: { cullPadding: 0 }, minimap: true },
      { width: 800, height: 600 },
    )
    const { controller, frames } = harness
    const root = document.createElement('div')
    const canvas = document.createElement('canvas')
    const calls = countCanvasCalls(canvas)

    root.append(canvas)
    harness.root.append(root)
    controller.mountMinimap({ root, canvas })

    const paintStarted = performance.now()
    frames.flush()
    const paintMs = performance.now() - paintStarted

    // One path segment per node, without rounded corners at this size.
    expect(calls.get('clearRect')).toBe(1)
    expect(calls.get('rect')).toBe(5000)
    expect(calls.get('roundRect')).toBeUndefined()
    expect(paintMs).toBeLessThan(250)

    // The world is the 20,000 × 7,500 content, so panning inside it never repaints the minimap.
    const before = controller.getSnapshot().minimap?.viewportStyle

    for (let step = 1; step <= 20; step += 1) {
      controller.api.view.set({ x: -step * 400, y: -step * 150 })
      void controller.getSnapshot()
      frames.flush()
    }

    expect(controller.getSnapshot().minimap?.viewportStyle).not.toEqual(before)
    expect(calls.get('clearRect')).toBe(1)
    expect(calls.get('rect')).toBe(5000)
  })
})
