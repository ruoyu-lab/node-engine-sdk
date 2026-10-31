import { createEditorController, NODE_WRIGHT_DEFAULT_DOM_COMPONENT } from '@node-wright/core/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGraph, mountEditor, type EditorHarness } from './editor-harness'

const nodeDefinitions = [
  {
    type: 'prompt',
    label: 'Prompt',
    ports: [{ id: 'text', direction: 'output' as const, dataType: 'string' }],
    parameters: [{ key: 'text', kind: 'string' as const, label: 'Text' }],
  },
  {
    type: 'preview',
    label: 'Preview',
    parameters: [
      { key: 'image', kind: 'string' as const, label: 'Image', input: { portId: 'image' } },
    ],
  },
]

const graph = createGraph({
  nodes: [
    { id: 'prompt', type: 'prompt', x: 0, y: 0, data: { params: { text: 'a lake' } } },
    { id: 'preview', type: 'preview', x: 400, y: 0, data: { params: { image: '' } } },
  ],
  edges: [
    {
      id: 'edge',
      kind: 'data',
      source: { nodeId: 'prompt', portId: 'text' },
      target: { nodeId: 'preview', portId: 'image' },
    },
  ],
})

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('DOM node layer', () => {
  it('describes every DOM node with its component key, model, API and placement', () => {
    const controller = createEditorController({
      graph,
      nodeDefinitions,
      nodeTypes: {
        preview: {
          dom: {
            component: 'image-preview',
            className: 'preview-node',
            style: { transform: 'rotate(1deg)', opacity: 0.5 },
            props: () => ({ extra: true }),
            defaults: { fields: [{ key: 'image', kind: 'image' }] },
          },
        },
      },
    })
    const [prompt, preview] = controller.getSnapshot().domLayer.nodes

    expect(prompt).toMatchObject({ id: 'prompt', component: NODE_WRIGHT_DEFAULT_DOM_COMPONENT })
    expect(prompt!.props.domModel.fields.map((field) => field.key)).toEqual(['text'])
    expect(preview).toMatchObject({
      id: 'preview',
      component: 'image-preview',
      className: 'preview-node',
      style: {
        transform: 'translate3d(400px, 0px, 0) rotate(1deg)',
        opacity: 0.5,
        pointerEvents: 'none',
      },
    })
    expect(preview!.props.extra).toBe(true)
    expect(preview!.props.domModel.fields[0]).toMatchObject({
      kind: 'image',
      driven: true,
      resolvedValue: 'a lake',
    })
    expect(preview!.props.domApi).toBe(controller.getSnapshot().domLayer.nodes[1]!.props.domApi)
    controller.destroy()
  })

  it.each([
    ['without', {}],
    ['with', { node: { draw: () => undefined } }],
  ])(
    'keeps DOM models across viewport and selection changes %s a global node renderer',
    (_, renderers) => {
      const controller = createEditorController({ graph, nodeDefinitions, renderers })
      const entryOf = (nodeId: string) =>
        controller.getSnapshot().domLayer.nodes.find((entry) => entry.id === nodeId)!
      const before = entryOf('prompt').props.domModel

      controller.api.view.set({ x: 120, zoom: 1.5 })
      controller.api.selection.nodes(['preview'])

      expect(entryOf('prompt').props.screenBounds.x).toBe(120)
      expect(entryOf('prompt').props.domModel).toBe(before)

      controller.api.nodes.params.update('prompt', 'text', 'a forest')

      expect(entryOf('prompt').props.domModel).not.toBe(before)
      expect(entryOf('prompt').props.domModel.fields[0]?.value).toBe('a forest')
      controller.destroy()
    },
  )

  it('resolves driven field values through the resolvePortValue option', () => {
    const resolvePortValue = vi.fn(() => 'https://example.test/result.png')
    const controller = createEditorController({ graph, nodeDefinitions, resolvePortValue })
    const preview = controller.getSnapshot().domLayer.nodes[1]!

    expect(preview.props.domModel.fields[0]?.resolvedValue).toBe('https://example.test/result.png')
    expect(resolvePortValue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: { nodeId: 'prompt', portId: 'text' },
        api: controller.api,
      }),
    )
    controller.destroy()
  })

  it('keeps the stable DOM node API in sync with the editor', () => {
    harness = mountEditor({ graph, nodeDefinitions })
    const { controller } = harness
    const api = controller.getSnapshot().domLayer.nodes[0]!.props.domApi

    api.params.update('text', 'a forest')
    expect(controller.api.nodes.get('prompt')?.data?.params).toEqual({ text: 'a forest' })
    expect(harness.eventsNamed('node-param-change')[0]?.[0]).toMatchObject({
      key: 'text',
      value: 'a forest',
      previousValue: 'a lake',
    })
    expect(
      controller.getSnapshot().domLayer.nodes[1]!.props.domModel.fields[0]?.resolvedValue,
    ).toBe('a forest')

    api.select()
    expect(controller.api.selection.get().nodes).toEqual(['prompt'])
    expect(api.getModel()?.title).toBe('Prompt')
    expect(api.getBounds('screen')).toMatchObject({ x: 0, y: 0 })
    expect(api.ports.get('text')).toMatchObject({ endpoint: { nodeId: 'prompt', portId: 'text' } })
    expect(api.resize.getConstraints()?.minWidth).toBeGreaterThan(0)

    api.remove()
    expect(controller.api.nodes.get('prompt')).toBeUndefined()
    expect(controller.getSnapshot().domLayer.nodes.map((entry) => entry.id)).toEqual(['preview'])
  })

  it('selects and drags a DOM node from its chrome', () => {
    harness = mountEditor({ graph, nodeDefinitions })
    const { controller, frames } = harness
    const api = controller.getSnapshot().domLayer.nodes[1]!.props.domApi
    const down = new PointerEvent('pointerdown', {
      pointerId: 1,
      button: 0,
      clientX: 420,
      clientY: 20,
    })

    expect(api.interaction.pointerDown(down)).toBe(true)
    expect(controller.api.selection.get().nodes).toEqual(['preview'])

    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 470, clientY: 70 }),
    )
    frames.flush()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 470, clientY: 70 }))

    expect(controller.api.nodes.get('preview')).toMatchObject({ x: 450, y: 50 })
  })

  it('resizes a DOM node from a corner handle within its minimum size', () => {
    harness = mountEditor({ graph, nodeDefinitions })
    const { controller, frames } = harness
    const api = controller.getSnapshot().domLayer.nodes[0]!.props.domApi
    const before = api.resize.get()!

    api.resize.start(
      new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 }),
      'nw',
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: -40, clientY: -30 }),
    )
    frames.flush()

    expect(api.resize.get()).toEqual({ width: before.width + 40, height: before.height + 30 })

    window.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: -40, clientY: -30 }),
    )

    expect(controller.api.nodes.get('prompt')).toMatchObject({
      x: -40,
      y: -30,
      width: before.width + 40,
      height: before.height + 30,
    })
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining(['node-resize-start', 'node-resize-end']),
    )
  })
})
