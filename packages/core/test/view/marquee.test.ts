import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMarqueeGesture } from '../../src/view/controller/interactions/marquee'
import { signal } from '../../src/view/reactive'
import type { SelectionState } from '@node-wright/core/view'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

const graph = createGraph({
  nodes: [
    { id: 'first', type: 'task', x: 10, y: 20, width: 80, height: 40 },
    { id: 'second', type: 'task', x: 300, y: 20, width: 80, height: 40 },
    { id: 'third', type: 'task', x: 300, y: 300, width: 80, height: 40 },
  ],
})

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('marquee selection', () => {
  it('preserves existing edges for additive rectangle selection when edges are excluded', () => {
    let selection: SelectionState = { nodes: [], edges: ['existing-edge'] }
    const sources: string[] = []
    const marquee = createMarqueeGesture({
      marquee: signal(null),
      getGestures: () => ['shift-left'],
      getDefaultMode: () => 'replace',
      isSpacePressed: () => false,
      getGraph: () => graph,
      getSelection: () => selection,
      getNodes: () =>
        graph.nodes.map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          width: node.width ?? 0,
          height: node.height ?? 0,
        })),
      getEdgeIdsInRect: () => ['new-edge'],
      setSelection(next, source) {
        selection = { nodes: next.nodes ?? selection.nodes, edges: next.edges ?? selection.edges }
        sources.push(source)
        return graph
      },
      emit: vi.fn(),
    })

    marquee.selectInRect(
      { x: 0, y: 0, width: 120, height: 100 },
      { mode: 'add', includeEdges: false },
    )

    expect(selection).toEqual({ nodes: ['first'], edges: ['existing-edge'] })
    expect(sources).toEqual(['api.select-in-rect'])
  })

  it('selects nodes inside a space + drag rectangle and shows the marquee box', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas, root, frames } = harness

    harness.key(' ')
    expect(controller.getSnapshot().interaction.spacePressed).toBe(true)

    harness.pointer(canvas, 'pointerdown', { x: 250, y: 0 })
    harness.pointer(window, 'pointermove', { x: 420, y: 100 })
    frames.flush()

    expect(controller.getSnapshot().interaction.mode).toBe('marquee')
    expect(controller.getSnapshot().marqueeStyle).toEqual({
      left: '250px',
      top: '0px',
      width: '170px',
      height: '100px',
    })

    harness.pointer(window, 'pointerup', { x: 420, y: 100 })
    root.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))

    expect(controller.api.selection.get().nodes).toEqual(['second'])
    expect(controller.getSnapshot().marqueeStyle).toBeNull()
    expect(controller.getSnapshot().interaction.spacePressed).toBe(false)
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining(['marquee-start', 'marquee', 'marquee-end']),
    )
  })

  it('subtracts with alt and uses the middle button gesture', () => {
    harness = mountEditor({ graph, nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas } = harness

    controller.api.selection.all()
    harness.pointer(canvas, 'pointerdown', { x: 250, y: 0 }, { button: 1, altKey: true })
    harness.pointer(window, 'pointerup', { x: 420, y: 400 }, { button: 1, altKey: true })

    expect(controller.api.selection.get().nodes).toEqual(['first'])
  })

  it('selects nodes and edges in a rectangle through the API', () => {
    harness = mountEditor({
      graph: createGraph({
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          ports: [
            { id: 'in', direction: 'input' as const },
            { id: 'out', direction: 'output' as const },
          ],
        })),
        edges: [
          {
            id: 'edge',
            kind: 'data',
            source: { nodeId: 'second', portId: 'out' },
            target: { nodeId: 'third', portId: 'in' },
          },
        ],
      }),
      nodeTypes: canvasOnlyNodeTypes,
    })

    harness.controller.api.selection.rect(
      { x: 250, y: 0, width: 300, height: 400 },
      { includeEdges: true },
    )

    expect(harness.controller.api.selection.get()).toEqual({
      nodes: ['second', 'third'],
      edges: ['edge'],
    })
  })
})
