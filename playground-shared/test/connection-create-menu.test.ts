import {
  createEditorController,
  type NodeEngineConnectionCancelEvent,
} from '@node-engine-sdk/core/view'
import { describe, expect, it } from 'vitest'
import {
  createNodeFromConnectionMenu,
  openConnectionCreateMenu,
  resolveConnectionCreateMenuStyle,
} from '../src/app/connection-create-menu'
import { getDemoScenario } from '../src/demo/scenarios'

const scenario = getDemoScenario('ai-image')
const screen = { width: 1024, height: 768 }

function createEditor() {
  return createEditorController({
    graph: scenario.graph(),
    nodeDefinitions: scenario.preset.nodeDefinitions,
    nodeTypes: scenario.preset.nodeTypes,
    plugins: scenario.preset.plugins,
  })
}

function cancelEvent(
  overrides: Partial<NodeEngineConnectionCancelEvent>,
): NodeEngineConnectionCancelEvent {
  const graph = scenario.graph()

  return {
    source: { nodeId: 'prompt', portId: 'prompt' },
    sourcePort: { id: 'prompt', direction: 'output', kind: 'data', dataType: 'string' },
    originDirection: 'output',
    targetDirection: 'input',
    startPoint: { x: 400, y: 200 },
    point: { x: 400, y: 500 },
    screenPoint: { x: 2000, y: -40 },
    dragDistance: 300,
    graph,
    ...overrides,
  }
}

describe('connection create menu', () => {
  it('opens only for real drags and offers business and standard nodes', () => {
    expect(openConnectionCreateMenu(cancelEvent({ dragDistance: 4 }), screen, scenario)).toBeNull()

    const consumers = openConnectionCreateMenu(cancelEvent({}), screen, scenario)

    expect(consumers?.options.map((option) => option.id)).toEqual([
      'image-generate-target',
      'data-preview-target',
    ])
    expect(consumers && resolveConnectionCreateMenuStyle(consumers)).toEqual({
      left: '784px',
      top: '12px',
    })

    const providers = openConnectionCreateMenu(
      cancelEvent({
        source: { nodeId: 'image-display', portId: 'imageUrl' },
        sourcePort: { id: 'imageUrl', direction: 'input', kind: 'data', dataType: 'string' },
        originDirection: 'input',
        targetDirection: 'output',
      }),
      screen,
      scenario,
    )

    expect(providers?.options.map((option) => option.id)).toEqual([
      'image-generate-source',
      'data-source',
    ])
  })

  it('offers only node types the scenario registers, and data nodes only for data ports', () => {
    const execflow = getDemoScenario('execflow')
    const dataflow = getDemoScenario('dataflow')
    const fromLog = cancelEvent({
      source: { nodeId: 'exec-log-approved', portId: 'message' },
      sourcePort: { id: 'message', direction: 'input', kind: 'data', dataType: 'any' },
      originDirection: 'input',
      targetDirection: 'output',
    })
    const fromExecOutput = cancelEvent({
      source: { nodeId: 'exec-start', portId: 'exec:then' },
      sourcePort: { id: 'exec:then', direction: 'output', kind: 'exec' },
    })

    // The execflow preset registers no data source or preview, so a data port offers nothing.
    expect(openConnectionCreateMenu(fromLog, screen, execflow)).toBeNull()
    expect(openConnectionCreateMenu(fromExecOutput, screen, execflow)).toBeNull()
    expect(openConnectionCreateMenu(fromExecOutput, screen, scenario)).toBeNull()
    // AI business nodes stay out of a scenario that does not register them.
    expect(
      openConnectionCreateMenu(cancelEvent({}), screen, dataflow)?.options.map(
        (option) => option.id,
      ),
    ).toEqual(['data-preview-target'])
  })

  it('creates the chosen node, connects it and selects it', () => {
    const editor = createEditor()
    const menu = openConnectionCreateMenu(cancelEvent({}), screen, scenario)
    const option = menu?.options.find((entry) => entry.id === 'data-preview-target')

    if (!menu || !option) {
      throw new Error('The connection menu offers no data preview.')
    }

    const result = createNodeFromConnectionMenu(editor.api, menu, option)

    if (!('nodeId' in result)) {
      throw new Error(result.error)
    }

    const graph = editor.api.graph.get()

    expect(graph.nodes).toHaveLength(5)
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: { nodeId: 'prompt', portId: 'prompt' },
        target: { nodeId: result.nodeId, portId: 'value' },
      }),
    )
    expect(editor.api.selection.get().nodes).toEqual([result.nodeId])
    editor.destroy()
  })

  it('replaces the single upstream edge of an input with the created provider', () => {
    const editor = createEditor()
    const menu = openConnectionCreateMenu(
      cancelEvent({
        source: { nodeId: 'image-generate', portId: 'prompt' },
        sourcePort: { id: 'prompt', direction: 'input', kind: 'data', dataType: 'string' },
        originDirection: 'input',
        targetDirection: 'output',
      }),
      screen,
      scenario,
    )
    const option = menu?.options.find((entry) => entry.id === 'prompt-source')

    if (!menu || !option) {
      throw new Error('The connection menu offers no prompt provider.')
    }

    const result = createNodeFromConnectionMenu(editor.api, menu, option)

    if (!('nodeId' in result)) {
      throw new Error(result.error)
    }

    const upstream = editor.api.graph
      .get()
      .edges.filter(
        (edge) => edge.target.nodeId === 'image-generate' && edge.target.portId === 'prompt',
      )

    expect(upstream.map((edge) => edge.source.nodeId)).toEqual([result.nodeId])
    editor.destroy()
  })
})
