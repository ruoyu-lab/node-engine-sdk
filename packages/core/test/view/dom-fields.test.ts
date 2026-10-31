import { describe, expect, it } from 'vitest'
import { resolveNodePorts, type NodeDefinition } from '@node-wright/core/protocol'
import { resolveDomNodeFields, type NodeWrightDomFieldDefinition } from '@node-wright/core/view'

const node = { id: 'node', type: 'demo', x: 0, y: 0 }

describe('DOM node parameter fields', () => {
  it('uses NodeDefinition.parameters as the only field source', () => {
    const fields = resolveDomNodeFields(
      {
        node: {
          id: 'node',
          type: 'demo',
          x: 0,
          y: 0,
          data: {
            params: {
              prompt: 'hello',
              hidden: 'raw',
            },
          },
        },
        schema: {
          type: 'demo',
          parameters: [
            { key: 'prompt', kind: 'string', label: 'Prompt' },
            { key: 'steps', kind: 'number', defaultValue: 20 },
          ],
        },
      },
      { fieldSource: 'params' },
    )

    expect(fields.map((field) => field.key)).toEqual(['prompt', 'steps'])
    expect(fields[0].label).toBe('Prompt')
    expect(fields[1].kind).toBe('number')
  })

  it('does not generate fields from raw node data without parameters', () => {
    const fields = resolveDomNodeFields(
      {
        node: {
          id: 'node',
          type: 'demo',
          x: 0,
          y: 0,
          data: {
            params: {
              prompt: 'hello',
            },
          },
        },
        schema: {
          type: 'demo',
        },
      },
      { fieldSource: 'params' },
    )

    expect(fields).toEqual([])
  })

  it('uses DOM field definitions only as display hints for parameters', () => {
    const fields = resolveDomNodeFields(
      {
        node: {
          id: 'node',
          type: 'demo',
          x: 0,
          y: 0,
          data: {
            params: {
              prompt: 'hello',
              hidden: 'raw',
            },
          },
        },
        schema: {
          type: 'demo',
          parameters: [{ key: 'prompt', kind: 'string', label: 'Prompt' }],
        },
      },
      {
        fieldSource: 'params',
        fields: [
          { key: 'prompt', label: 'Display prompt', highlighted: true },
          { key: 'hidden', label: 'Hidden raw field' },
        ],
      },
    )

    expect(fields.map((field) => field.key)).toEqual(['prompt'])
    expect(fields[0].label).toBe('Display prompt')
    expect(fields[0].highlighted).toBe(true)
  })

  it('takes the value domain from the parameter, never from a display hint', () => {
    const parameterOptions = [
      { label: 'Pass', value: 'pass' },
      { label: 'None', value: null },
    ]
    const hintWithOptions = {
      key: 'operation',
      label: 'Operation',
      options: [{ label: 'Other', value: 'other' }],
    } as NodeWrightDomFieldDefinition
    const [field] = resolveDomNodeFields(
      {
        node: { ...node, data: { params: { operation: 'pass' } } },
        schema: {
          type: 'demo',
          parameters: [
            { key: 'operation', kind: 'select', label: 'Transform', options: parameterOptions },
          ],
        },
      },
      { fieldSource: 'params', fields: [hintWithOptions] },
    )

    expect(field!.label).toBe('Operation')
    expect(field!.kind).toBe('select')
    expect(field!.options).toEqual(parameterOptions)
  })

  it('derives control kind, label and placeholder from the parameter without hints', () => {
    const fields = resolveDomNodeFields(
      {
        node,
        schema: {
          type: 'demo',
          parameters: [
            { key: 'name', kind: 'string', ui: { placeholder: 'Name', description: 'Who' } },
            { key: 'config', kind: 'json' },
            { key: 'script', kind: 'code' },
            { key: 'enabled', kind: 'boolean' },
            { key: 'count', kind: 'number' },
            { key: 'mode', kind: 'select', options: [{ label: 'A', value: 'a' }] },
            { key: 'upload', kind: 'file' },
          ],
        },
      },
      { fieldSource: 'params' },
    )

    expect(fields.map((field) => [field.key, field.kind])).toEqual([
      ['name', 'text'],
      ['config', 'textarea'],
      ['script', 'textarea'],
      ['enabled', 'boolean'],
      ['count', 'number'],
      ['mode', 'select'],
      ['upload', 'text'],
    ])
    expect(fields[0]).toMatchObject({
      label: 'name',
      placeholder: 'Name',
      textValue: 'Name',
      description: 'Who',
    })
  })

  it('binds a field to the input port the protocol resolves for its parameter', () => {
    const definition: NodeDefinition = {
      type: 'demo',
      parameters: [
        { key: 'seed', kind: 'number', label: 'Seed', input: { portId: 'seed' } },
        { key: 'steps', kind: 'number', label: 'Steps' },
      ],
    }
    const fields = resolveDomNodeFields({ node, schema: definition }, { fieldSource: 'params' })
    const ports = resolveNodePorts(node, [definition])

    expect(ports).toEqual([
      expect.objectContaining({ id: 'seed', name: 'seed', direction: 'input', dataType: 'number' }),
    ])
    expect(fields.map((field) => [field.key, field.inputPortId])).toEqual([
      ['seed', 'seed'],
      ['steps', undefined],
    ])
  })
})
