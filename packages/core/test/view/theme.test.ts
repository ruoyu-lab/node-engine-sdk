import type { GraphSnapshot } from '@node-wright/core/protocol'
import { resolveColorScheme, resolveNodeAccent } from '@node-wright/core/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveCanvasNodeTheme,
  resolveGraphCanvasTheme,
  resolveGridColors,
  resolveRootStyle,
} from '../../src/view/controller/theme'
import { drawGraphCanvas } from '../../src/view/rendering/graph-canvas'
import { createGraph, mountEditor, type EditorHarness } from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

const execGraph: GraphSnapshot = createGraph({
  nodes: [
    {
      id: 'start',
      type: 'step',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
    },
    {
      id: 'next',
      type: 'step',
      x: 300,
      y: 0,
      width: 160,
      height: 80,
      ports: [{ id: 'run', direction: 'input', kind: 'exec' }],
    },
  ],
  edges: [
    {
      id: 'flow',
      kind: 'exec',
      source: { nodeId: 'start', portId: 'then' },
      target: { nodeId: 'next', portId: 'run' },
    },
  ],
})

/** Records each stroke with the style it was painted in. */
function createStrokeRecorder() {
  const strokes: Array<{ strokeStyle: unknown; lineWidth: number }> = []
  const state = { strokeStyle: '' as unknown, lineWidth: 1 }
  const target = {
    canvas: { width: 0, height: 0, style: {} },
    stroke: () => strokes.push({ strokeStyle: state.strokeStyle, lineWidth: state.lineWidth }),
  }
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property as keyof typeof object]
      }

      if (property === 'strokeStyle' || property === 'lineWidth') {
        return state[property]
      }

      return () => undefined
    },
    set(_object, property, value) {
      if (property === 'strokeStyle' || property === 'lineWidth') {
        Object.assign(state, { [property]: value })
      }

      return true
    },
  }) as unknown as CanvasRenderingContext2D

  return { ctx, strokes }
}

describe('editor themes', () => {
  it('selects the built-in palette from theme.colorScheme and lets theme keys override it', () => {
    const dark = resolveGraphCanvasTheme({})
    const light = resolveGraphCanvasTheme({ colorScheme: 'light' })

    expect(resolveColorScheme(undefined)).toBe('dark')
    expect(resolveColorScheme({ colorScheme: 'light' })).toBe('light')
    expect(light.execEdgeColor).not.toBe(dark.execEdgeColor)
    expect(light.selectionColor).not.toBe(dark.selectionColor)
    expect(
      resolveGraphCanvasTheme({ colorScheme: 'light', execEdgeColor: '#123456' }).execEdgeColor,
    ).toBe('#123456')
    expect(resolveCanvasNodeTheme({ colorScheme: 'light' }).exec).toBe(light.execEdgeColor)
    expect(resolveRootStyle({ canvasBackground: '', theme: { colorScheme: 'light' } })).toEqual({
      '--nw-background': '#f5f6f8',
      '--nw-marquee': expect.any(String),
      '--nw-marquee-border': expect.any(String),
    })
    expect(resolveGridColors({ gridColor: '', theme: { colorScheme: 'light' } })).toEqual({
      minor: '#dcdfe5',
      major: '#c9cdd5',
    })
    expect(resolveGridColors({ gridColor: '#202020', theme: {} })).toEqual({
      minor: '#202020',
      major: 'rgba(32, 32, 32, 0.12)',
    })
  })

  it('renders the palette as the snapshot colour scheme and paints exec ports with it', () => {
    harness = mountEditor({ graph: execGraph, nodeTypes: { step: { dom: false } } })
    const { controller } = harness
    const anchor = () =>
      controller.api.ports.anchor({ nodeId: 'start', portId: 'then' })?.connectionColor

    expect(controller.getSnapshot().colorScheme).toBe('dark')
    expect(anchor()).toBe(resolveGraphCanvasTheme({}).execEdgeColor)

    controller.update({
      graph: controller.api.graph.get(),
      nodeTypes: { step: { dom: false } },
      theme: { colorScheme: 'light' },
    })

    expect(controller.getSnapshot()).toMatchObject({
      colorScheme: 'light',
      rootStyle: { '--nw-background': '#f5f6f8' },
    })
    expect(anchor()).toBe(resolveGraphCanvasTheme({ colorScheme: 'light' }).execEdgeColor)
  })

  it('paints a halo under selected and hovered edges', () => {
    const { ctx, strokes } = createStrokeRecorder()
    const theme = resolveGraphCanvasTheme({})
    const edge = (id: string, selected: boolean) => ({
      id,
      start: { x: 0, y: 0, side: 'right' as const },
      end: { x: 200, y: 0, side: 'left' as const },
      stroke: '#3b8ae6',
      strokeWidth: 2,
      selected,
    })

    drawGraphCanvas({
      ctx,
      width: 400,
      height: 300,
      dpr: 1,
      viewport: { x: 0, y: 0, zoom: 2 },
      theme,
      edges: [edge('plain', false), edge('selected', true), edge('hovered', false)],
      groups: [],
      hoveredEdgeId: 'hovered',
    })

    expect(strokes).toEqual([
      { strokeStyle: '#3b8ae6', lineWidth: 2 },
      { strokeStyle: 'rgba(139, 147, 255, 0.42)', lineWidth: 5.5 },
      { strokeStyle: '#3b8ae6', lineWidth: 2.75 },
      { strokeStyle: 'rgba(139, 147, 255, 0.22)', lineWidth: 5.5 },
      { strokeStyle: '#3b8ae6', lineWidth: 2.75 },
    ])
  })

  it('takes a node accent from its meta before its node type', () => {
    expect(resolveNodeAccent({ meta: { accent: '#111111' } }, { accent: '#222222' })).toBe(
      '#111111',
    )
    expect(resolveNodeAccent({ meta: {} }, { accent: '#222222' })).toBe('#222222')
    expect(resolveNodeAccent({}, undefined)).toBeUndefined()
  })
})
