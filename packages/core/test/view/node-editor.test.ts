import type { NodeDefinition } from '@node-engine-sdk/core/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { canvasOnlyNodeTypes, createGraph, mountEditor, type EditorHarness } from './editor-harness'

const definition: NodeDefinition = {
  type: 'task',
  parameters: [
    { key: 'title', kind: 'string', label: 'Title', ui: { placeholder: 'Untitled' } },
    {
      key: 'mode',
      kind: 'select',
      label: 'Mode',
      options: [
        { label: 'Fast', value: 'fast' },
        { label: 'Off', value: null },
      ],
    },
    { key: 'count', kind: 'number' },
    { key: 'notes', kind: 'json' },
  ],
}

const graph = createGraph({
  nodes: [
    {
      id: 'task',
      type: 'task',
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      data: { params: { title: 'Ship', mode: 'fast', count: 2, raw: 'not a parameter' } },
    },
    {
      id: 'plain',
      type: 'plain',
      x: 300,
      y: 0,
      width: 200,
      height: 120,
      data: { params: { raw: 'not a parameter' } },
    },
  ],
})

let harness: EditorHarness | null = null

afterEach(() => {
  harness?.destroy()
  harness = null
})

describe('inline node editor fields', () => {
  it('edits exactly the node definition parameters with their own options', () => {
    harness = mountEditor({
      graph,
      nodeDefinitions: [definition],
      nodeTypes: { ...canvasOnlyNodeTypes, plain: { dom: false } },
    })
    const { controller } = harness

    controller.api.selection.set({ nodes: ['task'] })
    const state = controller.api.nodes.editor.state()

    expect(state?.nodeId).toBe('task')
    expect(state?.fields.map((field) => [field.key, field.type, field.label, field.value])).toEqual(
      [
        ['title', 'text', 'Title', 'Ship'],
        ['mode', 'select', 'Mode', 'fast'],
        ['count', 'number', 'count', 2],
        ['notes', 'textarea', 'notes', undefined],
      ],
    )
    expect(state?.fields[0]?.placeholder).toBe('Untitled')
    expect(state?.fields[1]?.options).toEqual(definition.parameters![1]!.options)
  })

  it('never infers editable fields from raw node params', () => {
    harness = mountEditor({
      graph,
      nodeDefinitions: [definition],
      nodeTypes: { ...canvasOnlyNodeTypes, plain: { dom: false } },
      nodeEditors: { plain: { fields: [{ key: 'raw', label: 'Raw' }] } },
    })
    const { controller } = harness

    controller.api.selection.set({ nodes: ['plain'] })

    expect(controller.api.nodes.editor.state()).toBeNull()
    expect(controller.api.nodes.editor.open('plain')).toBe(false)
  })

  it('applies editor fields as display hints matched by parameter key', () => {
    harness = mountEditor({
      graph,
      nodeDefinitions: [definition],
      nodeTypes: canvasOnlyNodeTypes,
      nodeEditors: {
        task: {
          activateOn: 'manual',
          maxFields: 3,
          fields: [
            { key: 'raw', label: 'Not a parameter' },
            { key: 'count', label: 'Count', type: 'text', min: 1, step: 2 },
            { key: 'mode', visible: () => false },
            { key: 'title', disabled: ({ value }) => value === 'Ship', rows: 2 },
          ],
        },
      },
    })
    const { controller } = harness

    controller.api.selection.set({ nodes: ['task'] })
    expect(controller.api.nodes.editor.state()).toBeNull()

    expect(controller.api.nodes.editor.open('task')).toBe(true)
    const fields = controller.api.nodes.editor.state()?.fields ?? []

    expect(fields.map((field) => field.key)).toEqual(['title', 'count', 'notes'])
    expect(fields[0]).toMatchObject({ label: 'Title', disabled: true, rows: 2 })
    expect(fields[1]).toMatchObject({ label: 'Count', type: 'text', min: 1, step: 2 })
    expect(fields[1]).not.toHaveProperty('visible')
  })

  it('disables the editor for a node type', () => {
    harness = mountEditor({
      graph,
      nodeDefinitions: [definition],
      nodeTypes: { task: { dom: false, editor: { enabled: false } } },
    })

    expect(harness.controller.api.nodes.editor.open('task')).toBe(false)
  })
})
