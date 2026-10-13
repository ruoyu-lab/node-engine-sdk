import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import type { NodeEngineApi, NodeEngineDomNodeProps } from '@node-engine-sdk/core/view'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NodeEngine } from '../src/index'

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

let app: App | null = null
let host: HTMLElement | null = null

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = null
  host = null
  vi.restoreAllMocks()
})

function mount(props: Record<string, unknown>) {
  const api = ref<NodeEngineApi | null>(null)
  const graph = ref(createGraph())
  const events: Array<[string, unknown[]]> = []
  const Root = defineComponent({
    setup: () => () =>
      h(NodeEngine, {
        ref: api,
        graph: graph.value,
        'onUpdate:graph': (next: GraphSnapshot) => {
          graph.value = next
          events.push(['update:graph', [next]])
        },
        onSelectionChange: (...args: unknown[]) => events.push(['selection-change', args]),
        nodeDefinitions,
        nodeTypes: { sketch: { dom: false } },
        ...props,
      }),
  })

  host = document.createElement('div')
  document.body.append(host)
  app = createApp(Root)
  app.mount(host)

  return { api, graph, events, host }
}

describe('Vue NodeEngine adapter', () => {
  it('renders the controller snapshot with the default DOM node component', () => {
    const { host } = mount({ ariaLabel: 'Workflow' })
    const root = host.querySelector('.ne-root')!

    expect(root.getAttribute('aria-label')).toBe('Workflow')
    expect(root.querySelectorAll('canvas')).toHaveLength(2)
    expect(host.querySelectorAll('.ne-default-dom-node')).toHaveLength(1)
    expect(host.querySelector('.ne-default-dom-node__title')?.textContent).toBe('Prompt')
    expect(host.querySelector('.ne-default-dom-node__field-input')).toBeTruthy()
    expect(host.querySelector('.ne-accessible-node')?.textContent?.trim()).toBe(
      'Sketch (canvas-only)',
    )
  })

  it('exposes the editor API and keeps v-model:graph in sync', async () => {
    const { api, graph, events, host } = mount({})

    api.value!.nodes.move(['prompt'], { x: 30, y: 0 })
    await nextTick()

    expect(graph.value.nodes[0]?.x).toBe(30)
    expect(events.filter(([name]) => name === 'update:graph')).toHaveLength(1)
    expect(api.value!.history.canUndo()).toBe(true)

    const article = host.querySelector<HTMLElement>('.ne-dom-node')!
    expect(article.style.transform).toContain('translate3d(30px, 0px, 0)')

    api.value!.selection.nodes(['prompt'])
    await nextTick()

    expect(events.at(-1)?.[0]).toBe('selection-change')
    expect(host.querySelector('.ne-default-dom-node--selected')).toBeTruthy()
  })

  it('edits parameters through the default node fields', async () => {
    const { api, host } = mount({})
    const input = host.querySelector<HTMLInputElement>('.ne-default-dom-node__field-input')!

    input.value = 'world'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(api.value!.nodes.get('prompt')?.data?.params).toEqual({ text: 'world' })
  })

  it('renders registered DOM components and reports unknown component keys', () => {
    const Custom = defineComponent({
      props: { node: { type: Object, required: true } },
      setup: (props) => () =>
        h('span', { class: 'custom-node' }, (props.node as NodeEngineDomNodeProps['node']).id),
    })
    const { host } = mount({
      nodeTypes: { sketch: { dom: false }, prompt: { dom: { component: 'custom' } } },
      domComponents: { custom: Custom },
    })

    expect(host.querySelector('.custom-node')?.textContent).toBe('prompt')

    app?.unmount()
    host.remove()
    app = null

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => mount({ nodeTypes: { prompt: { dom: { component: 'missing' } } } })).toThrow(
      /no DOM node component registered as "missing"/u,
    )
    warn.mockRestore()
    app = null
  })

  it('applies prop updates and detaches from the host when unmounted', async () => {
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const gridVisible = ref(true)
    const Root = defineComponent({
      setup: () => () =>
        h(NodeEngine, { graph: createGraph(), nodeDefinitions, gridVisible: gridVisible.value }),
    })

    host = document.createElement('div')
    document.body.append(host)
    app = createApp(Root)
    app.mount(host)

    const grid = host.querySelector<HTMLCanvasElement>('.ne-grid-surface')!
    expect(grid.style.display).toBe('')

    gridVisible.value = false
    await nextTick()
    await nextTick()

    expect(grid.style.display).toBe('none')

    app.unmount()
    app = null

    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['keydown', 'wheel', 'pointerdown', 'contextmenu']),
    )
  })

  it('passes the grid state, not a second visibility flag, to its slots', async () => {
    const slotProps: Array<Record<string, unknown>> = []
    const Root = defineComponent({
      setup: () => () =>
        h(
          NodeEngine,
          { graph: createGraph(), nodeDefinitions, gridVisible: false },
          {
            background: (props: Record<string, unknown>) => {
              slotProps.push(props)
              return null
            },
            overlay: (props: Record<string, unknown>) => {
              slotProps.push(props)
              return null
            },
          },
        ),
    })

    host = document.createElement('div')
    document.body.append(host)
    app = createApp(Root)
    app.mount(host)
    await nextTick()

    expect(slotProps.length).toBeGreaterThanOrEqual(2)

    for (const props of slotProps) {
      expect(props).toHaveProperty('gridState.visible', false)
      expect(props).not.toHaveProperty('gridVisible')
      expect(props).not.toHaveProperty('grid-visible')
    }
  })
})
