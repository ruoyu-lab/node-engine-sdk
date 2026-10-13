import { createEditorController } from '@node-engine-sdk/core/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEditorExtensions } from '../../src/view/controller/extensions'
import { hotkeyMatches, normalizeKey } from '../../src/view/controller/hotkeys'
import { resolveEditorOptions } from '../../src/view/controller/options'
import { signal } from '../../src/view/reactive'
import { createGraph, mountEditor, type EditorHarness } from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('hotkey matching', () => {
  it('normalizes key aliases and requires exact modifiers', () => {
    expect(normalizeKey(' Del ')).toBe('delete')
    expect(normalizeKey(' ')).toBe('space')
    expect(normalizeKey('Spacebar')).toBe('space')

    const hotkey = { id: 'save', key: 'S', ctrl: true, run: vi.fn() }
    const modifiers = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }

    expect(hotkeyMatches(hotkey, modifiers, 's')).toBe(true)
    expect(hotkeyMatches(hotkey, { ...modifiers, shiftKey: true }, 's')).toBe(false)
  })

  it('applies direct extension contributions after plugins and sorts hotkeys by priority', () => {
    const options = signal(
      resolveEditorOptions({
        plugins: [
          {
            name: 'plugin',
            components: {
              nodeTypes: { task: { label: 'Plugin task' } },
              toolbarItems: [{ id: 'inspect', label: 'Plugin inspect', run: vi.fn() }],
              hotkeys: [{ id: 'inspect', key: 'i', priority: 1, run: vi.fn() }],
            },
          },
        ],
        nodeTypes: { task: { label: 'Direct task' } },
        toolbarItems: [{ id: 'inspect', label: 'Direct inspect', order: 2, run: vi.fn() }],
        hotkeys: [{ id: 'direct', key: 'd', priority: 20, run: vi.fn() }],
      }),
    )
    const extensions = createEditorExtensions({
      options,
      builtInHotkeys: [{ id: 'built-in', key: 'b', priority: 10, run: vi.fn() }],
    })

    expect(extensions.nodeTypes.value.task?.label).toBe('Direct task')
    expect(extensions.toolbarItems.value.map((item) => item.label)).toEqual(['Direct inspect'])
    expect(extensions.hotkeys.value.map((item) => item.id)).toEqual([
      'direct',
      'built-in',
      'inspect',
    ])

    options.value = resolveEditorOptions({ hotkeys: [] })
    expect(extensions.hotkeys.value.map((item) => item.id)).toEqual(['built-in'])
  })
})

describe('keyboard input', () => {
  it('runs the highest priority visible hotkey with the render context', () => {
    const low = vi.fn()
    const high = vi.fn()
    harness = mountEditor({
      graph: createGraph(),
      hotkeys: [
        { id: 'low', key: 'k', priority: 1, run: low },
        { id: 'hidden', key: 'k', priority: 50, visible: () => false, run: vi.fn() },
        { id: 'high', key: 'k', priority: 10, preventDefault: false, run: high },
      ],
    })

    const event = harness.key('K')

    expect(high).toHaveBeenCalledOnce()
    expect(high.mock.calls[0]?.[0]).toMatchObject({ readonly: false, graph: expect.any(Object) })
    expect(low).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves keys typed into form controls to those controls', () => {
    const run = vi.fn()
    harness = mountEditor({ graph: createGraph(), hotkeys: [{ id: 'x', key: 'x', run }] })
    const input = document.createElement('input')

    harness.root.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))

    expect(run).not.toHaveBeenCalled()
    expect(harness.controller.getSnapshot().interaction.spacePressed).toBe(false)
  })

  it('undoes and redoes with the history shortcuts', () => {
    harness = mountEditor({
      graph: createGraph({ nodes: [{ id: 'a', type: 'task', x: 0, y: 0 }] }),
    })
    const { controller } = harness

    controller.api.nodes.move(['a'], { x: 10, y: 0 })
    harness.key('z', { metaKey: true })
    expect(controller.api.nodes.get('a')?.x).toBe(0)

    harness.key('z', { metaKey: true, shiftKey: true })
    expect(controller.api.nodes.get('a')?.x).toBe(10)

    harness.key('z', { ctrlKey: true })
    harness.key('y', { ctrlKey: true })
    expect(controller.api.nodes.get('a')?.x).toBe(10)
  })

  it('resolves toolbar and context menu contributions against the current context', () => {
    const run = vi.fn()
    const controller = createEditorController({
      graph: createGraph(),
      toolbarItems: [
        { id: 'save', label: 'Save', disabled: ({ readonly }) => readonly, run },
        { id: 'hidden', label: 'Hidden', visible: () => false, run },
      ],
      contextMenuItems: [{ id: 'add', label: 'Add', run }],
    })

    const toolbar = controller.api.menu.resolve.toolbar()
    expect(toolbar.map((item) => item.id)).toEqual(['save'])
    toolbar[0]!.run()
    expect(run).toHaveBeenCalledOnce()

    controller.api.menu.open({ kind: 'canvas' }, { x: 10, y: 20 })
    expect(controller.getSnapshot().contextMenu).toMatchObject({
      position: { x: 10, y: 20 },
      graphPosition: { x: 10, y: 20 },
    })

    const [item] = controller.api.menu.resolve.context({ kind: 'canvas' }, { x: 0, y: 0 })
    item!.run()
    expect(run.mock.calls[1]?.[0]).toMatchObject({ target: { kind: 'canvas' } })

    controller.api.menu.close()
    expect(controller.getSnapshot().contextMenu).toBeNull()
    controller.destroy()
  })
})
