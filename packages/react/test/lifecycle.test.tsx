import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import { createGraphStore } from '@node-wright/core/store'
import type { NodeWrightEditorController } from '@node-wright/core/view'
import { createRef, StrictMode, useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NodeWright, type NodeWrightHandle, type NodeWrightProps } from '../src/index'
import { render, type Rendered } from './harness'

interface ControllerRecord {
  controller: NodeWrightEditorController
  calls: string[]
  destroyed: boolean
}

const tracked = vi.hoisted(() => ({ controllers: [] as ControllerRecord[] }))

vi.mock('@node-wright/core/view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@node-wright/core/view')>()
  const methods = ['update', 'mount', 'unmount', 'destroy', 'subscribe', 'getSnapshot'] as const

  return {
    ...actual,
    /** Records every controller method call, marking the ones made after `destroy()`. */
    createEditorController: vi.fn(
      (options: Parameters<typeof actual.createEditorController>[0]) => {
        const controller = actual.createEditorController(options)
        const record: ControllerRecord = { controller, calls: [], destroyed: false }

        for (const method of methods) {
          const original = controller[method] as (...args: unknown[]) => unknown

          Object.assign(controller, {
            [method]: (...args: unknown[]) => {
              record.calls.push(record.destroyed ? `${method} after destroy` : method)
              const result = original(...args)
              record.destroyed ||= method === 'destroy'
              return result
            },
          })
        }

        tracked.controllers.push(record)
        return controller
      },
    ),
    resolveDomNodeHeaderStyle: vi.fn(actual.resolveDomNodeHeaderStyle),
  }
})

const { resolveDomNodeHeaderStyle } = await import('@node-wright/core/view')

function createGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'prompt', type: 'prompt', x: 0, y: 0, data: { params: { text: 'a' } } },
      { id: 'second', type: 'prompt', x: 300, y: 0, data: { params: { text: 'b' } } },
    ],
    edges: [],
    groups: [],
    meta: {},
  }
}

const nodeDefinitions = [
  {
    type: 'prompt',
    label: 'Prompt',
    parameters: [
      {
        key: 'text',
        kind: 'select' as const,
        label: 'Text',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    ],
  },
]

let rendered: Rendered | null = null

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  tracked.controllers.length = 0
  vi.mocked(resolveDomNodeHeaderStyle).mockClear()
  vi.restoreAllMocks()
})

function rootListenerBalance(add: { mock: { contexts: unknown[] } }, remove: typeof add) {
  return (root: Element) =>
    add.mock.contexts.filter((target) => target === root).length -
    remove.mock.contexts.filter((target) => target === root).length
}

describe('React NodeWright lifecycle', () => {
  it('creates, mounts and destroys one controller per mount', async () => {
    rendered = await render(<NodeWright graph={createGraph()} nodeDefinitions={nodeDefinitions} />)

    expect(tracked.controllers).toHaveLength(1)
    expect(tracked.controllers[0]!.calls).toContain('mount')
    expect(tracked.controllers[0]!.destroyed).toBe(false)

    await rendered.unmount()
    rendered = null

    expect(tracked.controllers[0]!.calls.filter((call) => call === 'destroy')).toHaveLength(1)
  })

  it('replaces the controller of a StrictMode double mount and never uses a destroyed one', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const balance = rootListenerBalance(add, remove)
    const editor = createRef<NodeWrightHandle>()
    const onGraphChange = vi.fn()
    const graph = createGraph()
    const element = (readonly: boolean) => (
      <StrictMode>
        <NodeWright
          ref={editor}
          graph={graph}
          nodeDefinitions={nodeDefinitions}
          readonly={readonly}
          onGraphChange={onGraphChange}
        />
      </StrictMode>
    )

    rendered = await render(element(false))

    const [first, second] = tracked.controllers
    const root = rendered.host.querySelector('.nw-root')!

    expect(tracked.controllers).toHaveLength(2)
    expect(first!.calls).toEqual(['mount', 'destroy'])
    expect(second!.destroyed).toBe(false)
    expect(editor.current).toBe(second!.controller.api)
    expect(balance(root)).toBe(4)
    expect(rendered.host.querySelectorAll('.nw-default-dom-node')).toHaveLength(2)

    await rendered.rerender(element(true))
    await rendered.act(() => editor.current!.nodes.params.update('prompt', 'text', 'b'))

    expect(second!.calls).toContain('update')
    expect(second!.controller.getSnapshot().readonly).toBe(true)
    expect(onGraphChange).toHaveBeenCalledOnce()

    await rendered.unmount()
    rendered = null

    expect(balance(root)).toBe(0)
    expect(second!.destroyed).toBe(true)
    expect(tracked.controllers.flatMap((record) => record.calls)).not.toContainEqual(
      expect.stringContaining('after destroy'),
    )
  })

  it('keeps exactly one subscription to a provided store in StrictMode', async () => {
    const store = createGraphStore(createGraph(), { nodeDefinitions })
    const subscribe = store.subscribe.bind(store)
    const dispose = vi.spyOn(store, 'dispose')
    const onGraphChange = vi.fn()
    let active = 0

    store.subscribe = (listener) => {
      const unsubscribe = subscribe(listener)

      active += 1
      return () => {
        active -= 1
        unsubscribe()
      }
    }

    rendered = await render(
      <StrictMode>
        <NodeWright store={store} onGraphChange={onGraphChange} />
      </StrictMode>,
    )

    expect(active).toBe(1)

    await rendered.act(() => {
      store.updateNode('prompt', { x: 50 })
    })

    expect(onGraphChange).toHaveBeenCalledOnce()
    expect(rendered.host.querySelector<HTMLElement>('.nw-dom-node')!.style.transform).toContain(
      'translate3d(50px, 0px, 0)',
    )

    await rendered.unmount()
    rendered = null

    expect(active).toBe(0)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('updates the controller only when an option changes identity', async () => {
    const graph = createGraph()
    const theme = { background: '#101010' }
    const element = (props: Partial<NodeWrightProps>) => (
      <NodeWright graph={graph} nodeDefinitions={nodeDefinitions} theme={theme} {...props} />
    )

    rendered = await render(element({}))

    const [record] = tracked.controllers
    const updates = () => record!.calls.filter((call) => call === 'update').length

    await rendered.rerender(element({ onSelectionChange: () => undefined, ariaLabel: 'Graph' }))
    await rendered.rerender(element({ onSelectionChange: () => undefined, ariaLabel: 'Graph' }))
    expect(updates()).toBe(0)

    await rendered.rerender(element({ theme: { background: '#202020' } }))
    expect(updates()).toBe(1)
    expect(rendered.host.querySelector('.nw-root')!.getAttribute('style')).toContain('#202020')
  })

  it('keeps undo history while a controlled parent echoes the emitted graph', async () => {
    const editor = createRef<NodeWrightHandle>()

    function Parent(): ReactElement {
      const [graph, setGraph] = useState(createGraph)

      return (
        <NodeWright
          ref={editor}
          graph={graph}
          nodeDefinitions={nodeDefinitions}
          onGraphChange={setGraph}
        />
      )
    }

    rendered = await render(
      <StrictMode>
        <Parent />
      </StrictMode>,
    )

    await rendered.act(() => editor.current!.nodes.move(['prompt'], { x: 10, y: 0 }))
    await rendered.act(() => editor.current!.nodes.move(['prompt'], { x: 10, y: 0 }))

    const live = tracked.controllers.at(-1)!

    expect(live.calls.filter((call) => call === 'update')).toHaveLength(2)
    expect(editor.current!.history.canUndo()).toBe(true)

    await rendered.act(() => editor.current!.history.undo())
    await rendered.act(() => editor.current!.history.undo())

    expect(editor.current!.nodes.get('prompt')?.x).toBe(0)
    expect(editor.current!.history.canUndo()).toBe(false)
  })

  it('re-renders the default DOM node only when its own props change', async () => {
    const editor = createRef<NodeWrightHandle>()
    const renders = () => vi.mocked(resolveDomNodeHeaderStyle).mock.calls.length

    rendered = await render(
      <NodeWright ref={editor} graph={createGraph()} nodeDefinitions={nodeDefinitions} />,
    )

    const initial = renders()
    const layer = rendered.host.querySelector<HTMLElement>('.nw-dom-node-layer')!

    expect(initial).toBe(2)

    await rendered.act(() => editor.current!.view.set({ x: 120, y: 40, zoom: 1.5 }))

    expect(layer.style.transform).toContain('translate(120px, 40px) scale(1.5)')
    expect(renders()).toBe(initial)

    await rendered.act(() => editor.current!.selection.nodes(['second']))

    expect(renders()).toBe(initial + 1)
  })

  it('remounts the default node controls under StrictMode', async () => {
    rendered = await render(
      <StrictMode>
        <NodeWright graph={createGraph()} nodeDefinitions={nodeDefinitions} />
      </StrictMode>,
    )

    const trigger = rendered.host.querySelector<HTMLButtonElement>(
      '.nw-default-dom-node__field-select-trigger',
    )!

    await rendered.act(() => trigger.click())
    expect(rendered.host.querySelector('.nw-default-dom-node__field-select-menu')).toBeTruthy()

    await rendered.act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(rendered.host.querySelector('.nw-default-dom-node__field-select-menu')).toBeNull()
  })
})
