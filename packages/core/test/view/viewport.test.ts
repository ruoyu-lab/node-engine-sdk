import { createGraphStore } from '@node-wright/core/store'
import { createEditorController } from '@node-wright/core/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createViewportModel } from '../../src/view/controller/viewport'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

/** happy-dom's WheelEvent ignores the mouse-event part of its init dictionary. */
function wheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })

  Object.defineProperties(event, {
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    shiftKey: { value: init.shiftKey ?? false },
    ctrlKey: { value: init.ctrlKey ?? false },
  })
  target.dispatchEvent(event)
  return event
}

const graph = createGraph({
  nodes: [
    { id: 'a', type: 'task', x: 100, y: 100, width: 100, height: 50 },
    { id: 'b', type: 'task', x: 300, y: 300, width: 100, height: 50 },
  ],
})

describe('viewport model', () => {
  it('normalizes zoom into range and only emits real changes', () => {
    const emit = vi.fn()
    const store = createGraphStore(graph)
    const viewport = createViewportModel({
      initial: { zoom: 9 },
      getZoomRange: () => ({ minZoom: 0.25, maxZoom: 2 }),
      getStore: () => store,
      emit,
    })

    expect(viewport.get()).toEqual({ x: 0, y: 0, zoom: 2, minZoom: 0.25, maxZoom: 2 })

    viewport.set({ zoom: 2 }, 'test')
    expect(emit).not.toHaveBeenCalled()

    viewport.set({ x: 40, zoom: 0.01 }, 'test')
    expect(emit).toHaveBeenCalledWith(
      'viewport-change',
      { x: 40, y: 0, zoom: 0.25, minZoom: 0.25, maxZoom: 2 },
      'test',
    )
  })
})

describe('viewport interactions', () => {
  it('zooms with the wheel around the pointer and commits once the wheel settles', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes, wheelInertia: false })
    const { controller, root } = harness

    const event = wheel(root, { deltaY: -100, clientX: 200, clientY: 100 })
    const live = controller.api.view.getLive()

    expect(event.defaultPrevented).toBe(true)
    expect(live.zoom).toBeCloseTo(Math.exp(0.18))
    expect(controller.api.coordinates.screenToGraph({ x: 200, y: 100 })).toEqual({
      x: expect.closeTo(200),
      y: expect.closeTo(100),
    })
    expect(controller.api.view.get().zoom).toBe(1)
    expect(controller.getSnapshot().interaction.mode).toBe('zoom')
    expect(controller.getSnapshot().domLayer.composited).toBe(true)

    vi.advanceTimersByTime(100)

    expect(controller.api.view.get().zoom).toBeCloseTo(Math.exp(0.18))
    expect(controller.getSnapshot().interaction.mode).toBe('idle')
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining([
        'viewport-interaction-start',
        'viewport-interaction',
        'viewport-change',
        'viewport-interaction-end',
      ]),
    )
    vi.useRealTimers()
  })

  it('pans with the wheel in pan mode and with shift in mixed mode', () => {
    harness = mountEditor({ graph, wheelBehavior: 'mixed', wheelInertia: false })
    const { controller, root } = harness

    wheel(root, { deltaX: 0, deltaY: 30, shiftKey: true })
    expect(controller.api.view.getLive()).toMatchObject({ x: 0, y: -30, zoom: 1 })

    controller.update({ graph, wheelBehavior: 'pan', wheelInertia: false })
    wheel(root, { deltaX: 10, deltaY: 0, deltaMode: 1 })
    expect(controller.api.view.getLive()).toMatchObject({ x: -160, y: -30 })
  })

  it('eases wheel zoom over animation frames when inertia is enabled', () => {
    harness = mountEditor({ graph })
    const { controller, root, frames } = harness

    wheel(root, { deltaY: -200, clientX: 0, clientY: 0 })
    expect(controller.api.view.getLive().zoom).toBe(1)

    frames.flush(16)
    const firstStep = controller.api.view.getLive().zoom
    expect(firstStep).toBeGreaterThan(1)

    for (let frame = 2; frame < 60; frame += 1) {
      frames.flush(frame * 16)
    }

    expect(controller.api.view.get().zoom).toBeCloseTo(Math.exp(0.36), 2)
  })

  it('pans by dragging the background and clears the selection on a plain click', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas } = harness

    controller.api.selection.nodes(['a'])
    harness.drag({ x: 600, y: 500 }, { x: 640, y: 530 })

    expect(controller.api.view.get()).toMatchObject({ x: 40, y: 30 })
    expect(controller.api.selection.get().nodes).toEqual(['a'])
    expect(harness.eventsNamed('viewport-change').at(-1)?.[1]).toBe('pan')

    harness.pointer(canvas, 'pointerdown', { x: 600, y: 500 })
    harness.pointer(window, 'pointerup', { x: 601, y: 501 })

    expect(controller.api.selection.get().nodes).toEqual([])
  })

  it('fits, centres and zooms relative to the host size', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes }, { width: 400, height: 300 })
    const { controller } = harness

    controller.api.view.fit.graph(0)
    const fitted = controller.api.view.get()

    expect(fitted.zoom).toBeCloseTo(Math.min(400 / 300, 300 / 250))
    expect(controller.api.coordinates.graphToScreen({ x: 250, y: 225 })).toEqual({
      x: expect.closeTo(200),
      y: expect.closeTo(150),
    })

    controller.api.view.zoom.to(10)
    expect(controller.api.view.get().zoom).toBe(2.5)
    expect(controller.api.coordinates.graphToScreen({ x: 250, y: 225 })).toEqual({
      x: expect.closeTo(200),
      y: expect.closeTo(150),
    })

    controller.api.view.center.node('a')
    expect(controller.api.coordinates.graphToScreen({ x: 150, y: 125 })).toEqual({
      x: expect.closeTo(200),
      y: expect.closeTo(150),
    })
  })

  it('fits the graph with its groups into the area left inside per-side padding', () => {
    harness = mountEditor(
      {
        graph: { ...graph, groups: [{ id: 'g', x: 50, y: 50, width: 400, height: 350 }] },
        nodeTypes: canvasOnlyNodeTypes,
      },
      { width: 800, height: 600 },
    )
    const { controller } = harness

    // The group (50..450 × 50..400) encloses both nodes, so it is the fitted box.
    controller.api.view.fit.graph({ left: 200, top: 100, right: 100 })

    expect(controller.api.view.get().zoom).toBeCloseTo(Math.min(500 / 400, 500 / 350))
    expect(controller.api.coordinates.graphToScreen({ x: 250, y: 225 })).toEqual({
      x: expect.closeTo(200 + 500 / 2),
      y: expect.closeTo(100 + 500 / 2),
    })
    expect(harness.eventsNamed('viewport-change').at(-1)?.[1]).toBe('fit-view')

    controller.api.view.fit.nodes(['a'], 50)
    expect(controller.api.coordinates.graphToScreen({ x: 150, y: 125 })).toEqual({
      x: expect.closeTo(400),
      y: expect.closeTo(300),
    })
  })

  it('zooms programmatically around the viewport centre, unlike the pointer-anchored wheel', () => {
    harness = mountEditor(
      { graph, nodeTypes: canvasOnlyNodeTypes, initialViewport: { x: 40, y: -20, zoom: 1 } },
      { width: 400, height: 300 },
    )
    const { controller } = harness
    const centre = controller.api.coordinates.screenToGraph({ x: 200, y: 150 })

    controller.api.view.zoom.to(2)

    expect(controller.api.view.get()).toMatchObject({ zoom: 2, x: -120, y: -190 })
    expect(controller.api.coordinates.graphToScreen(centre)).toEqual({
      x: expect.closeTo(200),
      y: expect.closeTo(150),
    })
    expect(harness.eventsNamed('viewport-change').at(-1)?.[1]).toBe('zoom-to')
  })

  it('anchors programmatic zoom at the screen origin while the editor has no viewport size', () => {
    const controller = createEditorController({
      graph,
      initialViewport: { x: 40, y: -20, zoom: 1 },
    })

    controller.api.view.zoom.to(2)
    expect(controller.api.view.get()).toMatchObject({ zoom: 2, x: 80, y: -40 })
    controller.destroy()
  })

  it('reports a fit as a no-op before the editor is mounted', () => {
    const controller = createEditorController({ graph })

    controller.api.view.fit.graph()
    expect(controller.api.view.get()).toMatchObject({ x: 0, y: 0, zoom: 1 })
    controller.destroy()
  })
})
