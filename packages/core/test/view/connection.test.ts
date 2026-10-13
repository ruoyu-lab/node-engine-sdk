import { afterEach, describe, expect, it } from 'vitest'
import {
  canvasOnlyNodeTypes,
  createConnectableGraph,
  mountEditor,
  type EditorHarness,
} from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

function anchor(nodeId: string, portId: string) {
  const point = harness!.controller.api.ports.anchor({ nodeId, portId }, 'screen')

  if (!point) {
    throw new Error(`Port ${nodeId}:${portId} has no anchor.`)
  }

  return { x: point.x, y: point.y }
}

describe('connection gestures', () => {
  it('connects an output to an input, snapping to the nearest valid port', () => {
    harness = mountEditor({ graph: createConnectableGraph(), nodeTypes: canvasOnlyNodeTypes })
    const { controller } = harness
    const target = anchor('target', 'in')

    harness.drag(anchor('source', 'out'), { x: target.x + 12, y: target.y - 6 })

    expect(controller.api.graph.get().edges).toEqual([
      expect.objectContaining({
        source: { nodeId: 'source', portId: 'out' },
        target: { nodeId: 'target', portId: 'in' },
      }),
    ])
    expect(harness.eventNames()).toEqual(
      expect.arrayContaining([
        'connection-start',
        'connection-preview',
        'connection-end',
        'connect',
      ]),
    )
    expect(harness.eventsNamed('connection-preview').at(-1)?.[0]).toMatchObject({
      target: { nodeId: 'target', portId: 'in' },
      validation: { valid: true },
    })
    expect(controller.getSnapshot().interaction.mode).toBe('idle')
  })

  it('connects when dragging from an input back to an output', () => {
    harness = mountEditor({ graph: createConnectableGraph(), nodeTypes: canvasOnlyNodeTypes })

    harness.drag(anchor('target', 'in'), anchor('source', 'out'))

    expect(harness.controller.api.graph.get().edges[0]).toMatchObject({
      source: { nodeId: 'source', portId: 'out' },
      target: { nodeId: 'target', portId: 'in' },
    })
  })

  it('reports connections rejected by validation without creating an edge', () => {
    harness = mountEditor({
      graph: createConnectableGraph(),
      nodeTypes: canvasOnlyNodeTypes,
      connectionValidator: () => ({ valid: false, code: 'BLOCKED', reason: 'blocked' }),
    })

    harness.drag(anchor('source', 'out'), anchor('target', 'in'))

    expect(harness.controller.api.graph.get().edges).toEqual([])
    expect(harness.eventsNamed('connection-invalid')[0]?.[0].validation).toMatchObject({
      valid: false,
      code: 'BLOCKED',
    })
    expect(harness.eventsNamed('connection-preview').at(-1)?.[0].validation?.valid).toBe(false)
  })

  it('cancels a connection released away from any port with the drag distance', () => {
    harness = mountEditor({ graph: createConnectableGraph(), nodeTypes: canvasOnlyNodeTypes })
    const start = anchor('source', 'out')

    harness.drag(start, { x: start.x + 30, y: start.y + 40 })

    expect(harness.controller.api.graph.get().edges).toEqual([])
    expect(harness.eventsNamed('connection-cancel')[0]?.[0]).toMatchObject({
      source: { nodeId: 'source', portId: 'out' },
      targetDirection: 'input',
      dragDistance: 50,
    })
  })

  it('draws the draft edge while connecting and never connects in readonly mode', () => {
    harness = mountEditor({ graph: createConnectableGraph(), nodeTypes: canvasOnlyNodeTypes })
    const { controller, canvas, frames } = harness
    const start = anchor('source', 'out')

    harness.pointer(canvas, 'pointerdown', start)
    harness.pointer(window, 'pointermove', { x: start.x + 100, y: start.y })
    frames.flush()

    expect(controller.getSnapshot().interaction.mode).toBe('connect')
    expect(controller.getSnapshot().canvasCursor).toBe('grabbing')

    harness.pointer(window, 'pointerup', { x: start.x + 100, y: start.y })
    controller.update({
      graph: controller.api.graph.get(),
      readonly: true,
      nodeTypes: canvasOnlyNodeTypes,
    })
    harness.drag(anchor('source', 'out'), anchor('target', 'in'))

    expect(controller.api.graph.get().edges).toEqual([])
    expect(harness.eventsNamed('connection-start')).toHaveLength(1)
  })

  it('validates and connects through the API', () => {
    harness = mountEditor({ graph: createConnectableGraph(), nodeTypes: canvasOnlyNodeTypes })
    const { api } = harness.controller

    expect(
      api.edges.validate({ nodeId: 'source', portId: 'out' }, { nodeId: 'source', portId: 'out' }),
    ).toMatchObject({ valid: false, code: 'SELF_CONNECTION' })

    const result = api.edges.connect(
      { nodeId: 'source', portId: 'out' },
      { nodeId: 'target', portId: 'missing' },
    )

    expect(result.valid).toBe(false)
    expect(harness.eventsNamed('connection-invalid')).toHaveLength(1)

    api.edges.connect({ nodeId: 'source', portId: 'out' }, { nodeId: 'target', portId: 'in' })
    const edge = api.graph.get().edges[0]!

    api.edges.disconnect(edge.id)
    expect(api.graph.get().edges).toEqual([])
    expect(harness.eventsNamed('edge-disconnect')[0]?.[0]).toMatchObject({
      reason: 'api.disconnect-edge',
    })
  })
})
