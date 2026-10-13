import { afterEach, describe, expect, it } from 'vitest'
import { createDragPreview } from '../../src/view/controller/interactions/drag'
import { signal } from '../../src/view/reactive'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

const graph = createGraph({
  nodes: [
    { id: 'first', type: 'task', x: 10, y: 20, width: 80, height: 40 },
    { id: 'second', type: 'task', x: 300, y: 20, width: 80, height: 40 },
  ],
  groups: [{ id: 'group', x: 280, y: 0, width: 200, height: 160, nodeIds: ['second'] }],
})

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('drag preview', () => {
  it('keeps previews immutable and snaps each entity from its own origin', () => {
    const preview = createDragPreview({
      drag: signal({
        kind: 'node',
        pointerStart: { x: 0, y: 0 },
        nodeOrigin: { first: { x: 10, y: 20 } },
        groupOrigin: {},
        nodeIds: ['first'],
        groupIds: [],
        lastDelta: { x: 6, y: 7 },
      }),
      getSnapping: () => ({ enabled: true, size: 10 }),
    })
    const node = graph.nodes[0]!
    const moved = preview.applyToNode(node)

    expect(moved).not.toBe(node)
    expect(moved).toMatchObject({ x: 20, y: 30 })
    expect(node).toMatchObject({ x: 10, y: 20 })
    expect(preview.applyToNode(graph.nodes[1]!)).toBe(graph.nodes[1])
  })
})

describe('node and group dragging', () => {
  it('previews a node drag per frame and commits one undoable move on release', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes, snapToGrid: true, gridSize: 10 })
    const { controller, canvas, frames } = harness

    harness.pointer(canvas, 'pointerdown', { x: 20, y: 30 })
    harness.pointer(window, 'pointermove', { x: 44, y: 41 })

    expect(controller.api.nodes.getLive('first')).toMatchObject({ x: 10, y: 20 })

    frames.flush()

    expect(controller.api.nodes.getLive('first')).toMatchObject({ x: 30, y: 30 })
    expect(controller.api.nodes.get('first')).toMatchObject({ x: 10, y: 20 })
    expect(controller.getSnapshot().interaction).toMatchObject({
      mode: 'drag',
      draggingNodeIds: ['first'],
      dragDelta: { x: 24, y: 11 },
    })

    harness.pointer(window, 'pointerup', { x: 44, y: 41 })

    expect(controller.api.nodes.get('first')).toMatchObject({ x: 30, y: 30 })
    expect(controller.getSnapshot().interaction.mode).toBe('idle')
    expect(harness.eventNames().filter((name) => name.startsWith('node-drag'))).toEqual([
      'node-drag-start',
      'node-drag',
      'node-drag',
      'node-drag-end',
    ])
    expect(harness.eventsNamed('node-drag-end')[0]?.[0].liveGraph.nodes[0]).toMatchObject({
      x: 30,
      y: 30,
    })

    controller.api.history.undo()
    expect(controller.api.nodes.get('first')).toMatchObject({ x: 10, y: 20 })
  })

  it('does not commit a drag that the system cancels', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas, frames } = harness

    harness.pointer(canvas, 'pointerdown', { x: 20, y: 30 })
    harness.pointer(window, 'pointermove', { x: 80, y: 90 })
    frames.flush()
    harness.pointer(window, 'pointercancel', { x: 80, y: 90 })

    expect(controller.api.nodes.get('first')).toMatchObject({ x: 10, y: 20 })
    expect(controller.api.history.canUndo()).toBe(false)
  })

  it('drags a group by its header together with its member nodes', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness

    harness.drag({ x: 300, y: 10 }, { x: 340, y: 60 })

    expect(controller.api.groups.get('group')).toMatchObject({ x: 320, y: 50 })
    expect(controller.api.nodes.get('second')).toMatchObject({ x: 340, y: 70 })
    expect(controller.api.nodes.get('first')).toMatchObject({ x: 10, y: 20 })
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining(['group-click', 'group-drag-start', 'group-drag', 'group-drag-end']),
    )
  })

  it('resizes a group from its resize handle', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness

    harness.drag({ x: 470, y: 150 }, { x: 530, y: 210 })

    expect(controller.api.groups.get('group')).toMatchObject({ width: 260, height: 220 })
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining(['group-resize-start', 'group-resize', 'group-resize-end']),
    )
  })
})
