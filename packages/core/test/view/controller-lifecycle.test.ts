import { createGraphStore } from '@node-wright/core/store'
import { createEditorController } from '@node-wright/core/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

function createGroupGraph(groupId: string, x: number) {
  return createGraph({ groups: [{ id: groupId, x, y: 20, width: 300, height: 180 }] })
}

function createNodeGraph() {
  return createGraph({ nodes: [{ id: 'node', type: 'demo', x: 10, y: 20 }] })
}

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('editor controller store lifecycle', () => {
  it('switches every service to a replacement store without disposing provided stores', () => {
    const firstStore = createGraphStore(createGroupGraph('first', 10))
    const secondStore = createGraphStore(createGroupGraph('second', 90))
    const firstDispose = vi.spyOn(firstStore, 'dispose')
    const secondDispose = vi.spyOn(secondStore, 'dispose')
    const controller = createEditorController({ store: firstStore })

    expect(controller.api.groups.bounds('first')?.x).toBe(10)

    controller.update({ store: secondStore })

    expect(controller.api.runtime.store.get()).toBe(secondStore)
    expect(controller.api.groups.bounds('first')).toBeNull()
    expect(controller.api.groups.bounds('second')?.x).toBe(90)
    expect(controller.getSnapshot().graph.groups[0]?.id).toBe('second')
    expect(firstDispose).not.toHaveBeenCalled()

    firstStore.replaceGraph(createGroupGraph('stale', 200))
    expect(controller.api.graph.get().groups[0]?.id).toBe('second')

    controller.destroy()
    expect(secondDispose).not.toHaveBeenCalled()
  })

  it('disposes an internally owned store when an external store replaces it', () => {
    const controller = createEditorController()
    const ownedStore = controller.api.runtime.store.get()
    const ownedDispose = vi.spyOn(ownedStore, 'dispose')
    const externalStore = createGraphStore(createGroupGraph('external', 40))
    const externalDispose = vi.spyOn(externalStore, 'dispose')

    controller.update({ store: externalStore })

    expect(ownedDispose).toHaveBeenCalledOnce()
    expect(controller.api.groups.bounds('external')?.x).toBe(40)

    controller.destroy()
    expect(externalDispose).not.toHaveBeenCalled()
  })

  it('recreates the owned store when registries change and keeps the current graph', () => {
    const graph = createNodeGraph()
    const controller = createEditorController({ graph })
    const ownedStore = controller.api.runtime.store.get()
    const ownedDispose = vi.spyOn(ownedStore, 'dispose')

    controller.update({ graph, nodeDefinitions: [{ type: 'demo', label: 'Demo' }] })

    expect(ownedDispose).toHaveBeenCalledOnce()
    expect(controller.api.runtime.store.get()).not.toBe(ownedStore)
    expect(controller.api.definitions.nodes.get('demo')?.label).toBe('Demo')
    expect(controller.api.nodes.get('node')?.id).toBe('node')
    controller.destroy()
  })

  it('rejects store-owned options next to a provided store instead of ignoring them', () => {
    const store = createGraphStore(createNodeGraph())
    const graph = createNodeGraph()

    expect(() =>
      createEditorController({
        store,
        graph,
        nodeDefinitions: [{ type: 'demo' }],
        connectionValidator: () => ({ valid: true }),
      }),
    ).toThrow(
      'Invalid editor options with an external store: graph, nodeDefinitions, connectionValidator belong to the provided store; pass them to createGraphStore() instead.',
    )

    const controller = createEditorController({ store })

    expect(() => controller.update({ store, commands: [] })).toThrow(
      'commands belong to the provided store',
    )
    expect(() => controller.update({ store, edgeDefinitions: [] })).toThrow(
      'edgeDefinitions belong to the provided store',
    )
    expect(controller.api.runtime.store.get()).toBe(store)
    controller.destroy()
  })

  it('takes plugin components with a provided store only from plugins registered in it', () => {
    const storePlugin = {
      name: 'demo:rules',
      contributes: { nodeDefinitions: [{ type: 'demo', label: 'Demo' }] },
      components: { nodeTypes: { demo: { dom: false as const } } },
    }
    const viewPlugin = {
      name: 'demo:view',
      components: { nodeTypes: { other: { dom: false as const } } },
    }

    expect(() =>
      createEditorController({
        store: createGraphStore(createNodeGraph()),
        plugins: [storePlugin],
      }),
    ).toThrow(
      'plugin "demo:rules" contributes to the store but is not registered in the provided store.',
    )

    const store = createGraphStore(createNodeGraph(), { plugins: [storePlugin] })
    const controller = createEditorController({ store, plugins: [storePlugin, viewPlugin] })

    expect(controller.api.definitions.nodes.get('demo')?.label).toBe('Demo')
    expect(controller.getSnapshot().domLayer.nodes).toEqual([])
    expect(controller.getSnapshot().accessibleNodes.map((node) => node.id)).toEqual(['node'])
    controller.destroy()
  })

  it('never writes graph options into a provided store when switching stores', () => {
    const external = createGraphStore(createGroupGraph('external', 40))
    const controller = createEditorController({ store: external })

    controller.update({ graph: createGroupGraph('owned', 90) })

    expect(controller.api.runtime.store.get()).not.toBe(external)
    expect(controller.api.graph.get().groups[0]?.id).toBe('owned')
    expect(external.getSnapshot().groups[0]?.id).toBe('external')
    controller.destroy()
  })

  it('treats viewport and selection options as initial state and keeps built-in hotkeys', () => {
    const store = createGraphStore(createNodeGraph())
    const options = {
      store,
      initialViewport: { x: 25, y: 35, zoom: 1.5 },
      initialSelection: { nodes: ['node'] },
    }

    harness = mountEditor(options)
    const { controller } = harness

    expect(controller.api.view.get()).toMatchObject({ x: 25, y: 35, zoom: 1.5 })
    expect(controller.api.selection.get().nodes).toEqual(['node'])

    controller.update({
      ...options,
      initialViewport: { x: 900, y: 900, zoom: 2 },
      initialSelection: { nodes: [] },
    })

    expect(controller.api.view.get().x).toBe(25)
    expect(controller.api.selection.get().nodes).toEqual(['node'])

    harness.key('Delete')
    expect(controller.api.nodes.get('node')).toBeUndefined()

    harness.key('z', { ctrlKey: true })
    expect(controller.api.nodes.get('node')?.id).toBe('node')
  })

  it('exposes keyboard-selectable structure only for canvas-only nodes', () => {
    const controller = createEditorController({
      graph: createNodeGraph(),
      nodeTypes: { demo: { dom: false } },
    })

    expect(controller.getSnapshot().accessibleNodes).toEqual([
      { id: 'node', label: 'demo (node)', selected: false },
    ])
    expect(controller.getSnapshot().domLayer.nodes).toEqual([])

    controller.selectAccessibleNode('node')
    expect(controller.api.selection.get().nodes).toEqual(['node'])
    expect(controller.getSnapshot().accessibleNodes[0]?.selected).toBe(true)
    controller.destroy()
  })

  it('ignores the graph it emitted itself, keeping undo history intact', () => {
    let emitted = createNodeGraph()
    const onEvent = vi.fn((name: string, ...args: unknown[]) => {
      if (name === 'graph-change') {
        emitted = args[0] as typeof emitted
      }
    })
    const controller = createEditorController({ graph: emitted, onEvent })

    controller.api.nodes.move(['node'], { x: 5, y: 0 })
    controller.update({ graph: emitted, onEvent })

    expect(controller.api.history.canUndo()).toBe(true)

    controller.update({ graph: createNodeGraph(), onEvent })

    expect(controller.api.history.canUndo()).toBe(false)
    expect(controller.api.nodes.get('node')?.x).toBe(10)
    controller.destroy()
  })
})

describe('editor controller snapshots', () => {
  it('returns a stable snapshot until state changes and notifies once per batch', () => {
    const controller = createEditorController({
      graph: createNodeGraph(),
      nodeTypes: canvasOnlyNodeTypes,
    })
    const listener = vi.fn()
    const first = controller.getSnapshot()

    expect(controller.getSnapshot()).toBe(first)

    const unsubscribe = controller.subscribe(listener)

    controller.api.selection.nodes(['node'])
    expect(listener).toHaveBeenCalledTimes(1)

    const selected = controller.getSnapshot()
    expect(selected).not.toBe(first)
    expect(selected.selection.nodes).toEqual(['node'])
    expect(controller.getSnapshot()).toBe(selected)

    controller.api.clipboard.duplicate()
    expect(listener).toHaveBeenCalledTimes(2)

    controller.api.selection.nodes(controller.api.selection.get().nodes)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    controller.api.selection.clear()
    expect(listener).toHaveBeenCalledTimes(2)
    controller.destroy()
  })

  it('applies option updates through one entry point', () => {
    const controller = createEditorController({ graph: createNodeGraph() })
    const listener = vi.fn()

    controller.subscribe(listener)
    controller.update({ graph: controller.api.graph.get(), readonly: true, gridVisible: false })

    const snapshot = controller.getSnapshot()
    expect(snapshot.readonly).toBe(true)
    expect(snapshot.gridState.visible).toBe(false)
    expect(snapshot).not.toHaveProperty('gridVisible')
    expect(snapshot.renderContext.readonly).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    controller.destroy()
  })
})

describe('editor controller host lifecycle', () => {
  it('removes every listener, observer and frame when destroyed', () => {
    const rootAdd = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const rootRemove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const windowAdd = vi.spyOn(window, 'addEventListener')
    const windowRemove = vi.spyOn(window, 'removeEventListener')
    const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect')

    harness = mountEditor({ graph: createNodeGraph(), nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas, frames } = harness

    expect(frames.size).toBeGreaterThan(0)
    harness.pointer(canvas, 'pointerdown', { x: 700, y: 500 })

    const added = rootAdd.mock.calls.length
    const windowAdded = windowAdd.mock.calls.length
    expect(windowAdded).toBeGreaterThan(0)

    controller.destroy()

    expect(rootRemove.mock.calls.length).toBe(added)
    expect(windowRemove.mock.calls.length).toBe(windowAdded)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
    expect(() => controller.mount(harness!)).toThrow(/destroyed/u)
    expect(() => controller.update({})).toThrow(/destroyed/u)
    controller.destroy()
  })

  it('can be unmounted and mounted again, but not mounted twice', () => {
    harness = mountEditor({ graph: createNodeGraph() })
    const { controller, root, canvas, gridCanvas } = harness

    expect(() => controller.mount({ root, canvas, gridCanvas })).toThrow(/already mounted/u)

    controller.unmount()
    expect(harness.frames.size).toBe(0)
    expect(controller.getSnapshot().renderContext.rootElement).toBeNull()

    controller.mount({ root, canvas, gridCanvas })
    expect(controller.getSnapshot().renderContext.rootElement).toBe(root)
  })
})
