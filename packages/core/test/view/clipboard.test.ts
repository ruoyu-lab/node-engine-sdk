import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } from '@node-wright/core/protocol'
import { createEditorController } from '@node-wright/core/view'
import { describe, expect, it, vi } from 'vitest'
import { canvasOnlyNodeTypes, createConnectableGraph, createGraph } from './editor-harness'

function createClipboardGraph() {
  const graph = createConnectableGraph()

  return createGraph({
    ...graph,
    edges: [
      {
        id: 'edge',
        kind: 'data',
        source: { nodeId: 'source', portId: 'out' },
        target: { nodeId: 'target', portId: 'in' },
      },
    ],
    groups: [{ id: 'group', x: -20, y: -20, width: 260, height: 180, nodeIds: ['source'] }],
  })
}

describe('editor clipboard', () => {
  it('copies the selection and pastes it with fresh ids, remapped edges and a new selection', () => {
    const controller = createEditorController({
      graph: createClipboardGraph(),
      nodeTypes: canvasOnlyNodeTypes,
    })
    const { api } = controller

    expect(api.clipboard.paste()).toBeNull()

    api.selection.all()
    const clipboard = api.clipboard.copy()

    expect(clipboard?.nodes.map((node) => node.id)).toEqual(['source', 'target'])
    expect(clipboard?.edges.map((edge) => edge.id)).toEqual(['edge'])
    expect(clipboard?.groups.map((group) => group.id)).toEqual(['group'])

    api.clipboard.paste({ x: 1000, y: 500 })
    const graph = api.graph.get()
    const pasted = graph.nodes.slice(2)
    const pastedEdge = graph.edges[1]!

    expect(pasted.map((node) => ({ x: node.x, y: node.y }))).toEqual([
      { x: 1000, y: 500 },
      { x: 1400, y: 500 },
    ])
    expect(pasted.every((node) => !['source', 'target'].includes(node.id))).toBe(true)
    expect(pastedEdge.source.nodeId).toBe(pasted[0]!.id)
    expect(pastedEdge.target.nodeId).toBe(pasted[1]!.id)
    expect(graph.groups[1]?.nodeIds).toEqual([pasted[0]!.id])
    expect(api.selection.get()).toEqual({
      nodes: pasted.map((node) => node.id),
      edges: [pastedEdge.id],
    })
    controller.destroy()
  })

  it('duplicates the selection with an offset and drops edges to unselected nodes', () => {
    const controller = createEditorController({ graph: createClipboardGraph() })
    const { api } = controller

    api.selection.nodes(['source'])
    api.clipboard.duplicate({ x: 10, y: 20 })

    const graph = api.graph.get()

    expect(graph.nodes).toHaveLength(3)
    expect(graph.nodes[2]).toMatchObject({ x: 10, y: 20, type: 'task' })
    expect(graph.edges).toHaveLength(1)
    controller.destroy()
  })

  it('copies and pastes with the keyboard shortcuts', () => {
    const controller = createEditorController({ graph: createClipboardGraph() })
    const root = document.createElement('div')
    const canvas = document.createElement('canvas')
    const gridCanvas = document.createElement('canvas')

    controller.mount({ root, canvas, gridCanvas })
    controller.api.selection.nodes(['target'])

    const paste = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true })
    root.dispatchEvent(paste)
    expect(paste.defaultPrevented).toBe(false)

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true, cancelable: true }))
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', metaKey: true, cancelable: true }))

    expect(controller.api.graph.get().nodes).toHaveLength(3)
    controller.destroy()
  })

  it('imports and exports through the serialization hooks', () => {
    const afterImport = vi.fn()
    const onEvent = vi.fn()
    const controller = createEditorController({
      graph: createClipboardGraph(),
      serializeGraph: (graph) => ({ ...graph, meta: { exported: true } }),
      deserializeGraph: (input) => JSON.parse(String(input)),
      beforeImport: (graph) => ({ ...graph, meta: { imported: true } }),
      afterImport,
      onEvent,
    })
    const { api } = controller

    expect(api.graph.export().meta).toEqual({ exported: true })

    const imported = api.graph.import(
      JSON.stringify({
        schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'only', type: 'task', x: 0, y: 0 }],
        edges: [],
        groups: [],
        meta: {},
      }),
    )

    expect(imported.nodes.map((node) => node.id)).toEqual(['only'])
    expect(imported.meta).toEqual({ imported: true })
    expect(afterImport).toHaveBeenCalledOnce()
    expect(onEvent.mock.calls.map(([name]) => name)).toContain('imported')
    expect(() => api.graph.import('{"nodes": []}')).toThrow()
    controller.destroy()
  })

  it('cancels an import when the before-import hook rejects it', () => {
    const controller = createEditorController({
      graph: createClipboardGraph(),
      beforeImport: () => false,
    })

    const graph = controller.api.graph.import(createGraph())

    expect(graph.nodes).toHaveLength(2)
    controller.destroy()
  })
})
