import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PORT_KIND,
  getNodeParameterDefinitions,
  mergeParameterInputPorts,
  resolveNodeParameterInput,
  resolveNodeParameterInputPortId,
  resolveNodeParameterInputPorts,
  resolveNodePorts,
  resolvePortKind,
  type GraphPort,
  type NodeDefinition,
} from '@node-wright/core/protocol'

describe('@node-wright/core/protocol ports', () => {
  it('derives parameter input ports from the parameter kind and input policy', () => {
    const definition: NodeDefinition = {
      type: 'demo',
      parameterInputs: true,
      parameters: [
        { key: 'text', kind: 'string' },
        { key: 'script', kind: 'code' },
        { key: 'upload', kind: 'file' },
        { key: 'count', kind: 'number' },
        { key: 'enabled', kind: 'boolean' },
        { key: 'config', kind: 'json' },
        { key: 'choice', kind: 'select' },
        { key: 'hidden', kind: 'string', input: { enabled: false } },
        { key: 'local', kind: 'string', input: false },
      ],
    }

    expect(
      resolveNodeParameterInputPorts(definition).map((port) => [port.id, port.dataType]),
    ).toEqual([
      ['field:text', 'string'],
      ['field:script', 'string'],
      ['field:upload', 'string'],
      ['field:count', 'number'],
      ['field:enabled', 'boolean'],
      ['field:config', 'any'],
      ['field:choice', 'any'],
    ])
    expect(resolveNodeParameterInputPorts(undefined)).toEqual([])
    expect(getNodeParameterDefinitions(definition)).toHaveLength(9)
    expect(getNodeParameterDefinitions(undefined)).toEqual([])
  })

  it('applies an explicit input policy to the parameter port', () => {
    const parameter = {
      key: 'prompt',
      kind: 'string' as const,
      label: 'Prompt',
      input: {
        portId: 'prompt-in',
        label: 'Prompt input',
        kind: 'text',
        side: 'top' as const,
        capacity: 'many' as const,
        required: true,
        dataType: 'markdown',
        accepts: ['string'],
        data: { hint: 'free text' },
        meta: { order: 1 },
      },
    }
    const definition: NodeDefinition = { type: 'demo', parameters: [parameter] }

    expect(resolveNodeParameterInput(definition, parameter)).toBe(parameter.input)
    expect(resolveNodeParameterInputPortId(definition, parameter)).toBe('prompt-in')
    expect(resolveNodeParameterInputPorts(definition)).toEqual([
      {
        id: 'prompt-in',
        name: 'prompt',
        label: 'Prompt input',
        direction: 'input',
        kind: 'text',
        side: 'top',
        capacity: 'many',
        required: true,
        dataType: 'markdown',
        accepts: ['string'],
        data: { hint: 'free text', parameter: true, parameterKey: 'prompt' },
        meta: { order: 1 },
      },
    ])
    expect(
      resolveNodeParameterInputPortId(definition, { key: 'other', kind: 'string' }),
    ).toBeUndefined()
  })

  it('prefers node ports over definition ports and returns detached copies', () => {
    const definition: NodeDefinition = {
      type: 'demo',
      ports: [{ id: 'defined', direction: 'input' }],
      parameters: [{ key: 'text', kind: 'string', input: true }],
    }
    const ownPorts: GraphPort[] = [{ id: 'own', direction: 'output', kind: 'exec' }]
    const node = { id: 'node', type: 'demo', x: 0, y: 0, ports: ownPorts }

    const ports = resolveNodePorts(node, [definition])
    ports[0]!.id = 'changed'

    expect(resolveNodePorts(node, [definition]).map((port) => port.id)).toEqual([
      'own',
      'field:text',
    ])
    expect(resolveNodePorts({ ...node, ports: [] }, [definition]).map((port) => port.id)).toEqual([
      'defined',
      'field:text',
    ])
    expect(mergeParameterInputPorts(ownPorts, undefined)).toEqual(ownPorts)
    expect(resolvePortKind(ownPorts[0]!)).toBe('exec')
    expect(resolvePortKind({})).toBe(DEFAULT_PORT_KIND)
  })
})
