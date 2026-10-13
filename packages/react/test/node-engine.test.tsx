import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import type { NodeEngineContextMenuItem, NodeEngineToolbarItem } from '@node-engine-sdk/core/view'
import {
  act,
  createRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type RefObject,
} from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NodeEngine,
  useNodeEngineApi,
  type NodeEngineHandle,
  type NodeEngineOverlayRenderProps,
  type NodeEngineProps,
} from '../src/index'
import { render, type Rendered } from './harness'

function createGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'prompt', type: 'prompt', x: 0, y: 0, data: { params: { text: 'hello' } } },
      { id: 'canvas-only', type: 'sketch', x: 400, y: 0 },
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
    parameters: [{ key: 'text', kind: 'string' as const, label: 'Text' }],
  },
  { type: 'sketch', label: 'Sketch' },
]
const nodeTypes = { sketch: { dom: false as const } }

let rendered: Rendered | null = null

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  vi.restoreAllMocks()
})

function Editor(
  props: Partial<NodeEngineProps> & { editorRef?: RefObject<NodeEngineHandle | null> },
): ReactElement {
  const { editorRef, ...rest } = props

  return (
    <NodeEngine
      ref={editorRef}
      graph={createGraph()}
      nodeDefinitions={nodeDefinitions}
      nodeTypes={nodeTypes}
      {...rest}
    />
  )
}

describe('React NodeEngine', () => {
  it('exposes the API to the parent in its first layout effect and effect', async () => {
    const seen: string[] = []

    function Parent(): ReactElement {
      const editor = useRef<NodeEngineHandle>(null)

      useLayoutEffect(() => {
        seen.push(`layout:${editor.current?.nodes.get('prompt')?.id}`)
      }, [])
      useEffect(() => {
        seen.push(`effect:${editor.current?.graph.get().nodes.length}`)
      }, [])

      return <Editor editorRef={editor} />
    }

    rendered = await render(<Parent />)

    expect(seen).toEqual(['layout:prompt', 'effect:2'])
  })

  it('forwards every editor event to its camelCase callback prop', async () => {
    const editor = createRef<NodeEngineHandle>()
    const onViewportChange = vi.fn()
    const onNodeParamChange = vi.fn()
    const onImported = vi.fn()
    const onGraphChange = vi.fn()

    rendered = await render(
      <Editor
        editorRef={editor}
        onViewportChange={onViewportChange}
        onNodeParamChange={onNodeParamChange}
        onImported={onImported}
        onGraphChange={onGraphChange}
      />,
    )

    await rendered.act(() => {
      editor.current!.view.set({ x: 40 })
      editor.current!.nodes.params.update('prompt', 'text', 'world')
      editor.current!.graph.import(createGraph())
    })

    expect(onViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 40 }),
      'api.set-viewport',
    )
    expect(onNodeParamChange.mock.calls[0]?.[0]).toMatchObject({ key: 'text', value: 'world' })
    expect(onImported).toHaveBeenCalledOnce()
    expect(onGraphChange).toHaveBeenCalledTimes(2)
    expect(onGraphChange.mock.calls.at(-1)?.[0]).toEqual(editor.current!.graph.get())
  })

  it('renders background and overlay render props from the snapshot', async () => {
    const editor = createRef<NodeEngineHandle>()
    const overlays: NodeEngineOverlayRenderProps[] = []

    function SelectionBadge(): ReactElement {
      const api = useNodeEngineApi()

      return <output className="selection-badge">{api.selection.get().nodes.join(',')}</output>
    }

    rendered = await render(
      <Editor
        editorRef={editor}
        readonly
        renderBackground={({ readonly, gridState, toggleGrid }) => (
          <button
            className="background-toggle"
            type="button"
            data-readonly={readonly}
            data-grid={gridState.visible}
            onClick={toggleGrid}
          />
        )}
        renderOverlay={(props) => {
          overlays.push(props)
          return <SelectionBadge />
        }}
      />,
    )

    const toggle = rendered.host.querySelector<HTMLButtonElement>('.background-toggle')!

    expect(toggle.dataset).toMatchObject({ readonly: 'true', grid: 'true' })
    expect(overlays.at(-1)?.api).toBe(editor.current)
    expect(overlays.at(-1)).not.toHaveProperty('gridVisible')

    await rendered.act(() => toggle.click())
    expect(toggle.dataset.grid).toBe('false')

    await rendered.act(() => editor.current!.selection.nodes(['prompt']))
    expect(overlays.at(-1)?.selection.nodes).toEqual(['prompt'])
    expect(rendered.host.querySelector('.selection-badge')?.textContent).toBe('prompt')

    const layers = [...rendered.host.querySelector('.ne-root')!.children].map(
      (element) => element.className,
    )

    expect(layers).toEqual([
      'ne-grid-surface',
      'ne-canvas-surface',
      'background-toggle',
      'ne-dom-node-layer',
      'ne-accessible-nodes',
      'selection-badge',
    ])
  })

  it('rejects useNodeEngineApi outside a NodeEngine', async () => {
    function Orphan(): ReactElement {
      useNodeEngineApi()
      return <span />
    }

    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(render(<Orphan />)).rejects.toThrow(/inside NodeEngine render props/u)
  })

  it('resolves toolbar and context menu items for overlays', async () => {
    const editor = createRef<NodeEngineHandle>()
    const run = vi.fn()
    const toolbarItems: NodeEngineToolbarItem[] = [{ id: 'fit', label: 'Fit', run }]
    const contextMenuItems: NodeEngineContextMenuItem[] = [{ id: 'delete', label: 'Delete', run }]

    rendered = await render(
      <Editor
        editorRef={editor}
        toolbarItems={toolbarItems}
        contextMenuItems={contextMenuItems}
        renderOverlay={({ api, contextMenuState }) => (
          <>
            <nav className="toolbar">
              {api.menu.resolve.toolbar().map((item) => (
                <span key={item.id}>{item.label}</span>
              ))}
            </nav>
            {contextMenuState ? (
              <menu className="context-menu">
                {contextMenuState.items.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </menu>
            ) : null}
          </>
        )}
      />,
    )

    expect(rendered.host.querySelector('.toolbar')?.textContent).toContain('Fit')
    expect(rendered.host.querySelector('.context-menu')).toBeNull()

    await rendered.act(() => editor.current!.menu.open({ kind: 'canvas' }, { x: 10, y: 10 }))

    expect(rendered.host.querySelector('.context-menu')?.textContent).toContain('Delete')

    await rendered.act(() => editor.current!.menu.close())

    expect(rendered.host.querySelector('.context-menu')).toBeNull()
  })

  it('runs hotkeys from props on the editor root', async () => {
    const run = vi.fn()

    rendered = await render(<Editor hotkeys={[{ id: 'save', key: 's', ctrl: true, run }]} />)
    await rendered.act(() => {
      rendered!.host
        .querySelector('.ne-root')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
    })

    expect(run).toHaveBeenCalledOnce()
  })

  it('merges className and style with the themed root style', async () => {
    rendered = await render(
      <Editor
        className="app-graph"
        style={{ height: '320px' }}
        canvasBackground="rgb(1, 2, 3)"
        ariaLabel="Workflow"
      />,
    )

    const root = rendered.host.querySelector<HTMLElement>('.ne-root')!

    expect(root.className).toBe('ne-root app-graph')
    expect(root.style.height).toBe('320px')
    expect(root.getAttribute('style')).toContain('rgb(1, 2, 3)')
  })

  it('selects canvas-only nodes from their accessible fallback and applies renderer classes', async () => {
    const editor = createRef<NodeEngineHandle>()

    rendered = await render(
      <Editor
        editorRef={editor}
        nodeTypes={{ ...nodeTypes, prompt: { dom: { className: ['task', 'task--wide'] } } }}
      />,
    )

    const button = rendered.host.querySelector<HTMLButtonElement>('.ne-accessible-node')!

    expect(rendered.host.querySelector('.ne-dom-node')?.className).toBe(
      'ne-dom-node task task--wide',
    )
    expect(button.getAttribute('aria-pressed')).toBe('false')

    await rendered.act(() => button.click())

    expect(editor.current!.selection.get().nodes).toEqual(['canvas-only'])
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a dismissible performance overlay', async () => {
    const editor = createRef<NodeEngineHandle>()

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    rendered = await render(
      <Editor
        editorRef={editor}
        performance={{ enabled: true, overlay: true, overlayDismissible: true, sampleWindow: 1 }}
      />,
    )

    await vi.waitFor(async () => {
      await rendered!.act(() => undefined)
      expect(rendered!.host.querySelector('.ne-performance')).toBeTruthy()
    })
    expect(rendered.host.querySelector('.ne-performance')?.textContent).toContain('fps')

    await rendered.act(() =>
      rendered!.host.querySelector<HTMLButtonElement>('.ne-performance__close')!.click(),
    )

    expect(rendered.host.querySelector('.ne-performance')).toBeNull()
  })

  it('hydrates server markup without mismatches and then mounts the editor', async () => {
    const editor = createRef<NodeEngineHandle>()
    const host = document.createElement('div')
    const onRecoverableError = vi.fn()
    let root: Root | null = null

    host.innerHTML = renderToString(<Editor ariaLabel="Hydrated" />)
    document.body.append(host)

    expect(host.querySelector('.ne-root')?.getAttribute('aria-label')).toBe('Hydrated')
    expect(host.querySelector('.ne-default-dom-node')).toBeNull()

    await act(async () => {
      root = hydrateRoot(host, <Editor editorRef={editor} ariaLabel="Hydrated" />, {
        onRecoverableError,
      })
    })

    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(host.querySelectorAll('.ne-default-dom-node')).toHaveLength(1)
    expect(editor.current?.nodes.get('prompt')?.id).toBe('prompt')

    await act(async () => root!.unmount())
    host.remove()
  })
})
