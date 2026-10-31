import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeDefinition } from '@node-wright/core/protocol'
import type {
  NodeWrightApi,
  NodeWrightMinimapOptions,
  NodeWrightNodeStatus,
  NodeWrightTheme,
  NodeTypeRegistry,
} from '@node-wright/core/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFrameQueue, type FrameQueue } from './editor-harness'

/**
 * The behavior every UI adapter must share, because all of it comes from one
 * `createEditorController` contract. Each adapter runs this suite with a driver that mounts its
 * framework's `NodeWright` inside a host component holding the graph (Vue: `v-model:graph`,
 * React: `graph` + `onGraphChange`).
 */

/** Host props a driver translates to its framework's `NodeWright`. */
export interface AdapterContractProps {
  graph: GraphSnapshot
  ariaLabel?: string
  gridVisible?: boolean
  nodeTypes?: NodeTypeRegistry
  minimap?: boolean | NodeWrightMinimapOptions
  theme?: Partial<NodeWrightTheme>
  nodeStatus?: Readonly<Record<string, NodeWrightNodeStatus>>
}

export type AdapterContractEvent = 'graph-change' | 'selection-change' | 'connect' | 'mount'

export interface MountedAdapter {
  host: HTMLElement
  api: () => NodeWrightApi
  /** The graph the host holds; the host adopts every `graph-change`. */
  graph: () => GraphSnapshot
  /** Event arguments the host received, by core event name. */
  events: (name: AdapterContractEvent) => unknown[][]
  /** Replaces host props (the graph included) and waits until the adapter rendered them. */
  update: (props: Partial<AdapterContractProps>) => Promise<void>
  /** Runs a user or API interaction and waits until the adapter rendered its result. */
  act: (interaction: () => void) => Promise<void>
  unmount: () => Promise<void>
}

export interface AdapterDriver {
  /**
   * Mounts the adapter with `nodeDefinitions: contractNodeDefinitions` and a DOM component
   * registered as `contract-node` that renders `<span class="contract-node">{node.id}</span>`.
   * Rejects with the error when rendering throws.
   */
  mount: (props: AdapterContractProps) => Promise<MountedAdapter>
}

export const contractNodeDefinitions: NodeDefinition[] = [
  {
    type: 'prompt',
    label: 'Prompt',
    ports: [{ id: 'text', direction: 'output', dataType: 'string' }],
    parameters: [{ key: 'text', kind: 'string', label: 'Text' }],
  },
  {
    type: 'settings',
    label: 'Settings',
    height: 240,
    parameters: [
      { key: 'steps', kind: 'number', label: 'Steps' },
      { key: 'enabled', kind: 'boolean', label: 'Enabled' },
      {
        key: 'mode',
        kind: 'select',
        label: 'Mode',
        options: [
          { label: 'Fast', value: 'fast' },
          { label: 'Best', value: 'best' },
        ],
      },
    ],
  },
  {
    type: 'preview',
    label: 'Preview',
    parameters: [{ key: 'image', kind: 'string', label: 'Image', input: { portId: 'image' } }],
  },
  {
    type: 'media',
    label: 'Media',
    height: 360,
    parameters: [
      { key: 'start', kind: 'string', label: 'Start' },
      { key: 'strength', kind: 'number', label: 'Strength' },
      { key: 'image', kind: 'string', label: 'Result' },
    ],
  },
  { type: 'sketch', label: 'Sketch' },
]

/** DOM hints that render the `media` parameters as time, range and image fields. */
export const contractMediaNodeType: NodeTypeRegistry = {
  media: {
    dom: {
      defaults: {
        fields: [
          { key: 'start', kind: 'time' },
          { key: 'strength', kind: 'range', min: 0, max: 10, step: 1 },
          { key: 'image', kind: 'image', downloadable: true, openable: true },
        ],
      },
    },
  },
}

export function createContractGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'prompt', type: 'prompt', x: 0, y: 0, data: { params: { text: 'hello' } } },
      {
        id: 'settings',
        type: 'settings',
        x: 0,
        y: 400,
        data: { params: { steps: 4, enabled: false, mode: 'fast' } },
      },
      { id: 'preview', type: 'preview', x: 400, y: 0, data: { params: { image: '' } } },
      { id: 'canvas-only', type: 'sketch', x: 800, y: 0 },
    ],
    edges: [],
    groups: [],
    meta: {},
  }
}

const canvasOnlySketch: NodeTypeRegistry = { sketch: { dom: false } }

function pointer(target: EventTarget, type: string, point = { x: 0, y: 0 }): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      button: 0,
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    }),
  )
}

/** Sets a form control value through the native setter, like typing, and fires `input`. */
function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function nodeElement(host: HTMLElement, title: string): HTMLElement {
  const node = [...host.querySelectorAll<HTMLElement>('.nw-default-dom-node')].find(
    (element) => element.querySelector('.nw-default-dom-node__title')?.textContent === title,
  )

  if (!node) {
    throw new Error(`No default DOM node titled "${title}".`)
  }

  return node
}

function fieldRow(node: HTMLElement, label: string): HTMLElement {
  const row = [...node.querySelectorAll<HTMLElement>('.nw-default-dom-node__field')].find(
    (element) => element.querySelector('.nw-default-dom-node__field-label')?.textContent === label,
  )

  if (!row) {
    throw new Error(`No field labelled "${label}".`)
  }

  return row
}

export function describeAdapterContract(adapterName: string, driver: AdapterDriver): void {
  describe(`${adapterName} adapter contract`, () => {
    let frames: FrameQueue
    let mounted: MountedAdapter | null = null

    async function mount(props: Partial<AdapterContractProps> = {}): Promise<MountedAdapter> {
      mounted = await driver.mount({
        graph: createContractGraph(),
        nodeTypes: canvasOnlySketch,
        ...props,
      })
      return mounted
    }

    beforeEach(() => {
      frames = installFrameQueue()
    })

    afterEach(async () => {
      await mounted?.unmount()
      mounted = null
      vi.restoreAllMocks()
    })

    it('renders the shell, default DOM nodes and accessible canvas-only nodes', async () => {
      const { host } = await mount({ ariaLabel: 'Workflow' })
      const root = host.querySelector('.nw-root')!

      expect(root.getAttribute('role')).toBe('application')
      expect(root.getAttribute('aria-label')).toBe('Workflow')
      expect(root.getAttribute('tabindex')).toBe('0')
      expect(
        root.querySelectorAll('canvas.nw-grid-surface, canvas.nw-canvas-surface'),
      ).toHaveLength(2)
      expect(
        [...host.querySelectorAll('.nw-default-dom-node__title')].map((title) => title.textContent),
      ).toEqual(['Prompt', 'Settings', 'Preview'])
      expect(host.querySelector('.nw-accessible-node')?.textContent?.trim()).toBe(
        'Sketch (canvas-only)',
      )
    })

    it('exposes the API through its ref and reports each graph change once', async () => {
      const editor = await mount()

      await editor.act(() => editor.api().nodes.move(['prompt'], { x: 30, y: 0 }))

      expect(editor.graph().nodes[0]?.x).toBe(30)
      expect(editor.events('graph-change')).toHaveLength(1)
      expect(editor.host.querySelector<HTMLElement>('.nw-dom-node')!.style.transform).toContain(
        'translate3d(30px, 0px, 0)',
      )

      await editor.act(() => editor.api().selection.nodes(['prompt']))

      expect(editor.events('selection-change').at(-1)?.[0]).toEqual({
        nodes: ['prompt'],
        edges: [],
      })
      expect(nodeElement(editor.host, 'Prompt').className).toContain(
        'nw-default-dom-node--selected',
      )
    })

    it('keeps undo history when the host passes the emitted graph back', async () => {
      const editor = await mount()

      await editor.act(() => editor.api().nodes.move(['prompt'], { x: 30, y: 0 }))

      expect(editor.api().history.canUndo()).toBe(true)

      await editor.act(() => editor.api().history.undo())

      expect(editor.graph().nodes[0]?.x).toBe(0)
      expect(editor.api().history.canRedo()).toBe(true)
      expect(editor.events('graph-change')).toHaveLength(2)
    })

    it('replaces the graph and clears history when the host provides a new graph', async () => {
      const editor = await mount()

      await editor.act(() => editor.api().nodes.move(['prompt'], { x: 30, y: 0 }))
      await editor.update({ graph: createContractGraph() })

      expect(editor.api().nodes.get('prompt')?.x).toBe(0)
      expect(editor.api().history.canUndo()).toBe(false)
    })

    it('selects and drags a DOM node from its header', async () => {
      const editor = await mount()
      const header = nodeElement(editor.host, 'Preview').querySelector(
        '.nw-default-dom-node__header',
      )!

      await editor.act(() => pointer(header, 'pointerdown', { x: 420, y: 10 }))

      expect(editor.api().selection.get().nodes).toEqual(['preview'])
      expect(nodeElement(editor.host, 'Preview').className).toContain(
        'nw-default-dom-node--selected',
      )

      await editor.act(() => {
        pointer(window, 'pointermove', { x: 470, y: 60 })
        frames.flush()
        pointer(window, 'pointerup', { x: 470, y: 60 })
      })

      expect(editor.graph().nodes.find((node) => node.id === 'preview')).toMatchObject({
        x: 450,
        y: 50,
      })
      expect(editor.events('graph-change')).toHaveLength(1)
    })

    it('connects ports by dragging from an output to a parameter input port', async () => {
      const editor = await mount()
      const output = nodeElement(editor.host, 'Prompt').querySelector(
        '.nw-default-dom-node__port--right .nw-default-dom-node__port-dot',
      )!

      await editor.act(() => pointer(output, 'pointerdown'))

      const input = fieldRow(nodeElement(editor.host, 'Preview'), 'Image').querySelector(
        '.nw-default-dom-node__field-port-hit',
      )!

      await editor.act(() => pointer(input, 'pointerup'))

      expect(editor.graph().edges).toMatchObject([
        {
          source: { nodeId: 'prompt', portId: 'text' },
          target: { nodeId: 'preview', portId: 'image' },
        },
      ])
      expect(editor.events('connect')).toHaveLength(1)
    })

    it('edits text, number, boolean and select fields of the default node', async () => {
      const editor = await mount()
      const params = (nodeId: string) => editor.api().nodes.get(nodeId)?.data?.params
      const settings = () => nodeElement(editor.host, 'Settings')
      const text = fieldRow(nodeElement(editor.host, 'Prompt'), 'Text').querySelector('input')!

      await editor.act(() => typeInto(text, 'world'))
      expect(params('prompt')).toEqual({ text: 'world' })
      expect(text.value).toBe('world')

      const [, increment] = fieldRow(settings(), 'Steps').querySelectorAll(
        '.nw-default-dom-node__field-number-step',
      )

      await editor.act(() => pointer(increment!, 'pointerdown'))
      expect(params('settings')).toMatchObject({ steps: 5 })

      const number = fieldRow(settings(), 'Steps').querySelector<HTMLInputElement>(
        '.nw-default-dom-node__field-input--number',
      )!

      await editor.act(() => {
        number.focus()
        typeInto(number, '12')
      })
      expect(number.value).toBe('12')
      expect(params('settings')).toMatchObject({ steps: 5 })

      await editor.act(() => number.blur())
      expect(params('settings')).toMatchObject({ steps: 12 })

      await editor.act(() =>
        fieldRow(settings(), 'Enabled')
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!
          .click(),
      )
      expect(params('settings')).toMatchObject({ enabled: true })
      expect(
        fieldRow(settings(), 'Enabled').querySelector('.nw-default-dom-node__field-switch--on'),
      ).toBeTruthy()

      await editor.act(() =>
        fieldRow(settings(), 'Mode')
          .querySelector<HTMLButtonElement>('.nw-default-dom-node__field-select-trigger')!
          .click(),
      )

      const best = [
        ...fieldRow(settings(), 'Mode').querySelectorAll<HTMLButtonElement>(
          '.nw-default-dom-node__field-select-option',
        ),
      ].find((option) => option.textContent?.trim() === 'Best')!

      await editor.act(() => best.click())
      expect(params('settings')).toMatchObject({ mode: 'best' })
      expect(
        fieldRow(settings(), 'Mode').querySelector('.nw-default-dom-node__field-select-menu'),
      ).toBeNull()
    })

    it('scrubs numbers and edits time, range and image fields', async () => {
      const editor = await mount()
      const params = () => editor.api().nodes.get('settings')?.data?.params
      const number = fieldRow(
        nodeElement(editor.host, 'Settings'),
        'Steps',
      ).querySelector<HTMLInputElement>('.nw-default-dom-node__field-input--number')!

      await editor.act(() => pointer(number, 'pointerdown', { x: 100, y: 0 }))
      await editor.act(() => pointer(window, 'pointermove', { x: 130, y: 0 }))

      expect(params()).toMatchObject({ steps: 6 })
      expect(number.value).toBe('6')
      expect(document.body.style.cursor).toBe('ew-resize')

      await editor.act(() => pointer(window, 'pointerup', { x: 130, y: 0 }))
      expect(document.body.style.cursor).toBe('')

      await editor.update({
        nodeTypes: { ...canvasOnlySketch, ...contractMediaNodeType },
        graph: {
          ...createContractGraph(),
          nodes: [
            {
              id: 'media',
              type: 'media',
              x: 0,
              y: 0,
              data: {
                params: { start: '08:30', strength: 3, image: 'https://example.test/a.png' },
              },
            },
          ],
        },
      })

      const media = () => nodeElement(editor.host, 'Media')
      const mediaParams = () => editor.api().nodes.get('media')?.data?.params
      const [hours] = fieldRow(media(), 'Start').querySelectorAll<HTMLInputElement>(
        '.nw-default-dom-node__field-time-segment',
      )

      expect(hours!.value).toBe('08')
      await editor.act(() => {
        hours!.focus()
        typeInto(hours!, '9')
      })
      expect(hours!.value).toBe('9')
      await editor.act(() => hours!.blur())
      expect(mediaParams()).toMatchObject({ start: '09:30' })

      const range = fieldRow(media(), 'Strength').querySelector<HTMLInputElement>(
        'input[type="range"]',
      )!

      await editor.act(() => typeInto(range, '7'))
      expect(mediaParams()).toMatchObject({ strength: 7 })
      expect(fieldRow(media(), 'Strength').textContent).toContain('7')

      const result = media().querySelector('.nw-default-dom-node__field--image')!
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      const download = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined)
      const hostClick = vi.fn()
      const [downloadButton, openButton] = result.querySelectorAll<HTMLButtonElement>(
        '.nw-default-dom-node__field-image-action',
      )

      expect(result.querySelector('img')?.getAttribute('src')).toBe('https://example.test/a.png')
      editor.host.addEventListener('click', hostClick)
      await editor.act(() => {
        downloadButton!.click()
        openButton!.click()
      })

      expect(download).toHaveBeenCalledOnce()
      expect(open).toHaveBeenCalledWith('https://example.test/a.png', '_blank', 'noopener')
      expect(hostClick).not.toHaveBeenCalled()
    })

    it('captures the pointer on the element that starts a gesture', async () => {
      const capture = vi.spyOn(Element.prototype, 'setPointerCapture')
      const editor = await mount()
      const corner = nodeElement(editor.host, 'Preview').querySelector(
        '.nw-default-dom-node__resize-corner--se',
      )!

      await editor.act(() => pointer(corner, 'pointerdown', { x: 600, y: 120 }))
      expect(capture.mock.contexts).toEqual([corner])
      await editor.act(() => pointer(window, 'pointerup', { x: 600, y: 120 }))

      await editor.act(() =>
        pointer(
          nodeElement(editor.host, 'Preview').querySelector('.nw-default-dom-node__header')!,
          'pointerdown',
          { x: 420, y: 10 },
        ),
      )
      expect(capture.mock.contexts.at(-1)).toBe(nodeElement(editor.host, 'Preview'))
      await editor.act(() => pointer(window, 'pointerup', { x: 420, y: 10 }))
    })

    it('stops pointer events of field controls before they reach the host', async () => {
      const editor = await mount()
      const hostPointerDown = vi.fn()
      const text = fieldRow(nodeElement(editor.host, 'Prompt'), 'Text').querySelector('input')!

      editor.host.addEventListener('pointerdown', hostPointerDown)
      await editor.act(() => pointer(text, 'pointerdown'))

      expect(hostPointerDown).not.toHaveBeenCalled()
      expect(editor.api().selection.get().nodes).toEqual(['prompt'])
      expect(editor.api().interaction.state().mode).toBe('idle')
    })

    it('renders registered DOM components and rejects unknown component keys', async () => {
      const editor = await mount({
        nodeTypes: { ...canvasOnlySketch, preview: { dom: { component: 'contract-node' } } },
      })

      expect(editor.host.querySelector('.contract-node')?.textContent).toBe('preview')
      await editor.unmount()
      mounted = null

      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      await expect(
        driver.mount({
          graph: createContractGraph(),
          nodeTypes: { ...canvasOnlySketch, preview: { dom: { component: 'missing' } } },
        }),
      ).rejects.toThrow(/no DOM node component registered as "missing"/u)
    })

    it('renders the colour scheme, node accents, subtitles, status badges and port states', async () => {
      const editor = await mount({
        nodeTypes: {
          ...canvasOnlySketch,
          prompt: { accent: '#2f8fef', dom: { defaults: { subtitle: 'Source text' } } },
        },
        nodeStatus: { prompt: 'success', settings: 'running' },
      })
      const root = editor.host.querySelector('.nw-root')!
      const prompt = nodeElement(editor.host, 'Prompt')
      const output = prompt.querySelector(
        '.nw-default-dom-node__port--right .nw-default-dom-node__port-dot',
      )!

      expect(root.getAttribute('data-color-scheme')).toBe('dark')
      expect(prompt.style.getPropertyValue('--nw-node-accent')).toBe('#2f8fef')
      expect(prompt.querySelector('.nw-default-dom-node__subtitle')?.textContent?.trim()).toBe(
        'Source text',
      )
      expect(prompt.className).toContain('nw-default-dom-node--success')
      expect(prompt.querySelector('.nw-default-dom-node__status--success')).toBeTruthy()
      expect(nodeElement(editor.host, 'Settings').className).toContain(
        'nw-default-dom-node--running',
      )
      expect(
        nodeElement(editor.host, 'Preview').querySelector('.nw-default-dom-node__status'),
      ).toBeNull()
      expect(output.getAttribute('style')).toContain('--nw-port-color')
      expect(output.className).not.toContain('nw-default-dom-node__port-dot--connected')

      await editor.update({ theme: { colorScheme: 'light' }, nodeStatus: {} })

      expect(root.getAttribute('data-color-scheme')).toBe('light')
      expect(nodeElement(editor.host, 'Prompt').className).not.toContain(
        'nw-default-dom-node--success',
      )

      await editor.act(() => pointer(output, 'pointerdown'))

      const imageInput = fieldRow(nodeElement(editor.host, 'Preview'), 'Image').querySelector(
        '.nw-default-dom-node__field-port-dot',
      )!

      expect(output.className).toContain('nw-default-dom-node__port-dot--active')
      expect(imageInput.className).toContain('nw-default-dom-node__field-port-dot--compatible')

      await editor.act(() =>
        pointer(
          fieldRow(nodeElement(editor.host, 'Preview'), 'Image').querySelector(
            '.nw-default-dom-node__field-port-hit',
          )!,
          'pointerup',
        ),
      )

      expect(
        nodeElement(editor.host, 'Prompt').querySelector(
          '.nw-default-dom-node__port-dot--connected',
        ),
      ).toBeTruthy()
    })

    it('reports each mount with the editor API', async () => {
      const editor = await mount()

      expect(editor.events('mount')).toEqual([[editor.api()]])
    })

    it('applies prop updates through the controller', async () => {
      const editor = await mount({ gridVisible: true })
      const grid = editor.host.querySelector<HTMLCanvasElement>('.nw-grid-surface')!

      expect(grid.style.display).toBe('')

      await editor.update({ gridVisible: false })

      expect(grid.style.display).toBe('none')
      expect(editor.api().view.grid.state().visible).toBe(false)
    })

    it('renders the minimap and pans the viewport from it', async () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
      const editor = await mount({ minimap: true })
      const root = editor.host.querySelector('.nw-root')!
      const minimap = root.querySelector<HTMLElement>(':scope > .nw-minimap')!

      expect(root.lastElementChild).toBe(minimap)
      expect(minimap.getAttribute('role')).toBe('group')
      expect(minimap.getAttribute('aria-label')).toBe('Minimap')
      expect(minimap.getAttribute('tabindex')).toBe('0')
      expect([minimap.style.width, minimap.style.height]).toEqual(['200px', '136px'])
      expect(
        minimap.querySelector(':scope > canvas.nw-minimap__canvas')?.getAttribute('aria-hidden'),
      ).toBe('true')
      expect(
        minimap.querySelector<HTMLElement>(':scope > .nw-minimap__viewport')?.style.transform,
      ).toMatch(/^translate\(/u)

      // Pressing outside the viewport rectangle centres the viewport on that point.
      await editor.act(() => pointer(minimap, 'pointerdown', { x: 1, y: 1 }))
      expect(minimap.classList.contains('nw-minimap--dragging')).toBe(true)

      await editor.act(() => pointer(minimap, 'pointerup', { x: 1, y: 1 }))
      expect(minimap.classList.contains('nw-minimap--dragging')).toBe(false)

      const center = editor.api().coordinates.screenToGraph({ x: 400, y: 300 })

      expect(center.x).toBeLessThan(0)
      expect(center.y).toBeLessThan(0)
      expect(editor.api().view.get()).toEqual(editor.api().view.getLive())
    })

    it('attaches the minimap while it is on and detaches it when turned off or unmounted', async () => {
      const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
      const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
      const editor = await mount()
      const listenersOf = (spy: typeof add, target: Element) =>
        spy.mock.contexts.filter((context) => context === target).length

      expect(editor.host.querySelector('.nw-minimap')).toBeNull()

      await editor.update({ minimap: true })
      const first = editor.host.querySelector('.nw-minimap')!

      expect(listenersOf(add, first)).toBeGreaterThan(0)

      await editor.update({ minimap: false })
      expect(editor.host.querySelector('.nw-minimap')).toBeNull()
      expect(listenersOf(remove, first)).toBe(listenersOf(add, first))

      await editor.update({ minimap: { width: 160, height: 100 } })
      const second = editor.host.querySelector<HTMLElement>('.nw-minimap')!

      expect([second.style.width, second.style.height]).toEqual(['160px', '100px'])

      await editor.unmount()
      mounted = null

      expect(listenersOf(add, second)).toBeGreaterThan(0)
      expect(listenersOf(remove, second)).toBe(listenersOf(add, second))
    })

    it('detaches from its elements when unmounted', async () => {
      const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
      const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
      const editor = await mount()
      const root = editor.host.querySelector('.nw-root')!
      const listenersOf = (spy: typeof add, target: Element) =>
        spy.mock.contexts.filter((context) => context === target).length

      expect(listenersOf(add, root)).toBeGreaterThan(0)

      await editor.unmount()
      mounted = null

      expect(listenersOf(remove, root)).toBe(listenersOf(add, root))
      expect(remove.mock.calls.map(([type]) => type)).toEqual(
        expect.arrayContaining(['keydown', 'wheel', 'pointerdown', 'contextmenu']),
      )
    })
  })
}
