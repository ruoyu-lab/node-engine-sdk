import { createGraphStore } from '@node-engine-sdk/core/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSelectionModel } from '../../src/view/controller/selection'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

const graph = createGraph({
  nodes: [
    { id: 'first', type: 'task', x: 10, y: 20, width: 80, height: 40 },
    { id: 'second', type: 'task', x: 300, y: 20, width: 80, height: 40 },
  ],
  edges: [],
})

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('selection model', () => {
  it('normalizes ids against the graph and only emits real changes', () => {
    const store = createGraphStore(graph)
    const emit = vi.fn()
    const selection = createSelectionModel({
      initial: { nodes: ['first', 'missing', 'first'] },
      graph: store.getSnapshot(),
      getStore: () => store,
      emit,
    })

    expect(selection.get()).toEqual({ nodes: ['first'], edges: [] })

    selection.set({ nodes: ['first'] }, 'test')
    expect(emit).not.toHaveBeenCalled()

    selection.toggleNode('second', 'test')
    expect(selection.get().nodes).toEqual(['first', 'second'])
    expect(emit).toHaveBeenCalledWith(
      'selection-change',
      { nodes: ['first', 'second'], edges: [] },
      expect.objectContaining({ nodes: expect.any(Array) }),
      'test',
    )
  })
})

describe('selection interactions', () => {
  it('selects on click, toggles with shift and clears on background click', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas } = harness

    harness.pointer(canvas, 'pointerdown', { x: 20, y: 30 })
    harness.pointer(window, 'pointerup', { x: 20, y: 30 })
    expect(controller.api.selection.get().nodes).toEqual(['first'])
    expect(harness.eventsNamed('node-click')).toHaveLength(1)

    harness.pointer(canvas, 'pointerdown', { x: 310, y: 30 }, { shiftKey: true })
    expect(controller.api.selection.get().nodes).toEqual(['first', 'second'])

    harness.pointer(canvas, 'pointerdown', { x: 310, y: 30 }, { shiftKey: true })
    expect(controller.api.selection.get().nodes).toEqual(['first'])

    harness.pointer(canvas, 'pointerdown', { x: 600, y: 400 })
    harness.pointer(window, 'pointerup', { x: 600, y: 400 })
    expect(controller.api.selection.get()).toEqual({ nodes: [], edges: [] })
    expect(harness.eventsNamed('selection-change').at(-1)?.[2]).toBe(
      'background.click-clear-selection',
    )
  })

  it('drops removed nodes from the selection', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness

    controller.api.selection.all()
    controller.api.nodes.remove('first')

    expect(controller.api.selection.get().nodes).toEqual(['second'])
    expect(controller.getSnapshot().selection.nodes).toEqual(['second'])
  })

  it('removes the selection with the delete hotkeys unless the editor is readonly', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness

    controller.api.selection.nodes(['first'])
    harness.key('Backspace')
    expect(controller.api.nodes.get('first')).toBeUndefined()

    controller.update({ graph: controller.api.graph.get(), readonly: true })
    controller.api.selection.nodes(['second'])
    const event = harness.key('Delete')

    expect(controller.api.nodes.get('second')).toBeDefined()
    expect(event.defaultPrevented).toBe(false)
  })
})
