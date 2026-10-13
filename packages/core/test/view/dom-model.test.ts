import type { GraphNode, NodeDefinition } from '@node-engine-sdk/core/protocol'
import {
  applyDomConnectionState,
  applyDomFieldDriveState,
  buildDomNodePortSignature,
  resolveDefaultConnectedPortValue,
  resolveDomNodeModel,
  resolveDomNodeSizeConstraints,
  resolveDomPortAnchorPoints,
  type NodeEngineCanvasNodeTheme,
  type NodeEngineDomNodeRenderContext,
  type NodeEnginePortAnchor,
  type NodeTypeDefinition,
} from '@node-engine-sdk/core/view'
import { describe, expect, it } from 'vitest'
import { createGraph } from './editor-harness'

const theme = { portStroke: '#484F58' } as NodeEngineCanvasNodeTheme

const schema: NodeDefinition = {
  type: 'generate',
  label: 'Generate',
  ports: [
    { id: 'prompt', direction: 'input', dataType: 'string' },
    { id: 'image', direction: 'output', dataType: 'image' },
  ],
  parameters: [
    { key: 'seed', kind: 'number', label: 'Seed', input: { portId: 'seed' } },
    { key: 'result', kind: 'string', label: 'Result' },
  ],
}

const definition: NodeTypeDefinition = {
  dom: {
    defaults: {
      title: 'Generator',
      fieldSource: 'params',
      fields: [{ key: 'result', kind: 'image', emptyHint: 'Nothing yet' }],
      layout: { headerHeight: 40 },
    },
  },
}

function anchor(node: GraphNode, portId: string, direction: 'input' | 'output', y = 0) {
  return {
    endpoint: { nodeId: node.id, portId },
    x: node.x,
    y: node.y + y,
    side: direction === 'input' ? 'left' : 'right',
    port: { id: portId, direction },
  } satisfies NodeEnginePortAnchor
}

function createContext(height = 420): NodeEngineDomNodeRenderContext {
  const node: GraphNode = {
    id: 'node',
    type: 'generate',
    x: 100,
    y: 50,
    data: { params: { seed: 7, result: 'https://example.test/image.png' } },
  }

  return {
    node,
    schema,
    definition,
    bounds: { x: 100, y: 50, width: 320, height },
    screenBounds: { x: 100, y: 50, width: 320, height },
    selected: false,
    dragging: false,
    readonly: false,
    zoom: 1,
    inputs: [anchor(node, 'prompt', 'input'), anchor(node, 'seed', 'input')],
    outputs: [anchor(node, 'image', 'output')],
    theme,
    context: {} as NodeEngineDomNodeRenderContext['context'],
  }
}

describe('DOM node model', () => {
  it('binds parameter fields to their input ports and stacks the rows below the ports', () => {
    const model = resolveDomNodeModel(createContext())

    expect(model.title).toBe('Generator')
    expect(model.inputs.map((port) => port.id)).toEqual(['prompt'])
    expect(model.outputs.map((port) => port.id)).toEqual(['image'])
    expect(model.fields.map((field) => [field.key, field.kind, field.inputPort?.id])).toEqual([
      ['seed', 'number', 'seed'],
      ['result', 'image', undefined],
    ])
    expect(model.fieldsTop).toBeGreaterThanOrEqual(model.inputs[0]!.top)
    expect(model.fields[1]!.top).toBeGreaterThan(model.fields[0]!.top)
    expect(model.fields[1]!.emptyHint).toBe('Nothing yet')
    expect(model.fields[1]!.height).toBeGreaterThan(220)
  })

  it('hides fields that do not fit and reports the size that would fit them', () => {
    const compact = resolveDomNodeModel(createContext(120))
    const constraints = resolveDomNodeSizeConstraints(createContext(120))

    expect(compact.fields.length).toBeLessThan(2)
    expect(constraints.minHeight).toBeGreaterThan(120)
    expect(constraints.minWidth).toBeGreaterThanOrEqual(240)
  })

  it('anchors DOM ports where the node component draws them', () => {
    const model = resolveDomNodeModel(createContext())
    const points = resolveDomPortAnchorPoints({ x: 100, y: 50, width: 320 }, model)
    const seedField = model.fields[0]!

    expect(points.get('prompt')).toEqual({
      x: 100 + model.layout.portInset + 0.5,
      y: 50 + model.inputs[0]!.top + 1,
    })
    expect(points.get('image')?.x).toBe(100 + 320 - model.layout.portInset - 0.5)
    expect(points.get('seed')).toEqual({
      x: 100 + model.layout.portInset,
      y: 50 + seedField.top + seedField.height / 2,
    })
  })
})

describe('DOM node live state', () => {
  it('drives field values through connected input ports and restores them when disconnected', () => {
    const model = resolveDomNodeModel(createContext())
    const graph = createGraph({
      nodes: [
        { id: 'source', type: 'value', x: 0, y: 0, data: { params: { value: 42 } } },
        createContext().node,
      ],
      edges: [
        {
          id: 'edge',
          kind: 'data',
          source: { nodeId: 'source', portId: 'value' },
          target: { nodeId: 'node', portId: 'seed' },
        },
      ],
    })
    const driven = applyDomFieldDriveState(
      model,
      graph,
      (endpoint) => ({ id: endpoint.portId, direction: 'output' }),
      (current, endpoint, port) =>
        resolveDefaultConnectedPortValue(
          current.nodes.find((node) => node.id === endpoint.nodeId),
          port,
        ),
    )

    expect(driven.fields[0]).toMatchObject({
      driven: true,
      resolvedValue: 42,
      resolvedTextValue: '42',
      driveSource: { edgeId: 'edge' },
    })
    expect(driven.fields[1]).toBe(model.fields[1])

    const restored = applyDomFieldDriveState(
      driven,
      { ...graph, edges: [] },
      () => undefined,
      () => undefined,
    )

    expect(restored.fields[0]).toMatchObject({ driven: false, resolvedValue: 7 })
    expect(
      applyDomFieldDriveState(
        model,
        { ...graph, edges: [] },
        () => undefined,
        () => 0,
      ),
    ).toBe(model)
  })

  it('marks connectable ports while a connection is pending', () => {
    const model = resolveDomNodeModel(createContext())
    const highlighted = applyDomConnectionState(model, {
      source: { nodeId: 'other', portId: 'out' },
      targetDirection: 'input',
      validate: (endpoint) => ({ validation: { valid: endpoint.portId === 'prompt' } }),
    })

    expect(highlighted.inputs[0]).toMatchObject({ connectable: true, active: false })
    expect(highlighted.fields[0]!.inputPort).toMatchObject({ connectable: false })
    expect(highlighted.outputs[0]).toMatchObject({ connectable: null })
    expect(applyDomConnectionState(model, { targetDirection: null, validate: () => null })).toBe(
      model,
    )
  })

  it('reads connected values from explicit port data, value keys and parameters', () => {
    const node: GraphNode = {
      id: 'n',
      type: 't',
      x: 0,
      y: 0,
      data: { label: 'from data', params: { text: 'hello', value: 'fallback' } },
    }

    expect(
      resolveDefaultConnectedPortValue(node, { id: 'p', direction: 'output', data: { value: 1 } }),
    ).toBe(1)
    expect(
      resolveDefaultConnectedPortValue(node, {
        id: 'p',
        direction: 'output',
        data: { valueKey: 'label' },
      }),
    ).toBe('from data')
    expect(resolveDefaultConnectedPortValue(node, { id: 'text', direction: 'output' })).toBe(
      'hello',
    )
    expect(resolveDefaultConnectedPortValue(node, { id: 'other', direction: 'output' })).toBe(
      'fallback',
    )
    expect(resolveDefaultConnectedPortValue(undefined, undefined)).toBeUndefined()
  })

  it('signs the parts of port anchors that affect the DOM model', () => {
    const node = createContext().node
    const ports = [anchor(node, 'prompt', 'input', 20)]

    expect(buildDomNodePortSignature(ports, node.y)).toBe('left:prompt::::20')
    expect(buildDomNodePortSignature([{ ...ports[0]!, connectionColor: '#fff' }], node.y)).not.toBe(
      buildDomNodePortSignature(ports, node.y),
    )
  })
})
