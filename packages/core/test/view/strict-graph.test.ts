import { parseGraph, validateGraph, type NodeDefinition } from '@node-engine-sdk/core/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { mountEditor, type EditorHarness } from './editor-harness'

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

/** A node whose parameter `b` takes a link too, through a port of its own. */
const definitions: NodeDefinition[] = [
  {
    type: 'test:add',
    ports: [
      { id: 'a', direction: 'input', kind: 'data', dataType: 'number' },
      { id: 'sum', direction: 'output', kind: 'data', dataType: 'number' },
    ],
    parameters: [{ key: 'b', kind: 'number', defaultValue: 0, input: { portId: 'b' } }],
  },
]

describe('graphs the editor makes', () => {
  it('stay graphs the protocol takes: nodes it creates, links it draws', () => {
    harness = mountEditor({ nodeDefinitions: definitions })
    const { api } = harness.controller
    const first = api.nodes.create('test:add', { x: 0, y: 0 })
    const second = api.nodes.create('test:add', { x: 320, y: 0 })

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(
      api.edges.connect({ nodeId: first!.id, portId: 'sum' }, { nodeId: second!.id, portId: 'b' })
        .valid,
    ).toBe(true)

    // Copied and pasted, links and all.
    api.selection.nodes([first!.id, second!.id])
    expect(api.clipboard.duplicate()).not.toBeNull()

    const graph = api.graph.get()

    expect(graph.nodes).toHaveLength(4)
    expect(graph.edges).toHaveLength(2)
    expect(validateGraph(graph, { nodeDefinitions: definitions }).diagnostics).toEqual([])
    expect(parseGraph(graph)).toEqual(graph)
    // The definition's ports, and its parameters' ports, are the definition's: not copied.
    expect(graph.nodes.every((node) => !('ports' in node))).toBe(true)
  })
})
