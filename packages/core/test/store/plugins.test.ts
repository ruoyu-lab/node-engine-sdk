import { describe, expect, it } from 'vitest'
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import type { GraphPluginContext, GraphStoreEvent } from '@node-engine-sdk/core/protocol'
import { GraphStore } from '../../src/store/index'

function createStore(): GraphStore {
  return new GraphStore({
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [{ id: 'a', type: 'demo', x: 0, y: 0, ports: [{ id: 'out', direction: 'output' }] }],
    edges: [],
    groups: [],
    meta: {},
  })
}

describe('@node-engine-sdk/core/store plugins', () => {
  it('hands setup a context whose store API acts on the store', () => {
    const store = createStore()
    let context: GraphPluginContext | undefined

    store.use({
      name: 'probe',
      setup: (pluginContext) => {
        context = pluginContext
      },
    })

    const api = context!.store
    const result = api.dispatchCommand('node.add', {
      node: { id: api.createId('node'), type: 'demo', x: 100, y: 0 },
    })

    expect(result.applied).toBe(true)
    expect(api.getSnapshot().nodes.map((node) => node.id)).toEqual(['a', 'node-1'])
    expect(api.getNode('node-1')?.x).toBe(100)
    expect(api.getEdge('missing')).toBeUndefined()
    expect(api.getGroup('missing')).toBeUndefined()
    expect(api.listGroups()).toEqual([])
    expect(api.getPort({ nodeId: 'a', portId: 'out' })?.direction).toBe('output')
    expect(api.validateGraph().valid).toBe(true)
    expect(api.repairGraph().validation.valid).toBe(true)
    expect(api.listDiagnostics().map((diagnostic) => diagnostic.code)).toEqual([
      'NODE_TYPE_UNKNOWN',
      'NODE_TYPE_UNKNOWN',
    ])
    expect(api.getCommand('node.add')?.id).toBe('node.add')
    expect(api.listCommands().some((command) => command.id === 'node.remove')).toBe(true)
    expect(api.getNodeDefinition('demo')).toBeUndefined()
    expect(api.listNodeDefinitions()).toEqual([])
    expect(api.getEdgeDefinition('demo')).toBeUndefined()
    expect(api.listEdgeDefinitions()).toEqual([])
  })

  it('undoes contributions and setup registrations of a disposed plugin in reverse order', () => {
    const store = createStore()
    const events: string[] = []
    store.subscribe((event: GraphStoreEvent) => {
      if ('key' in event) {
        events.push(`${event.type} ${event.key}`)
      }
    })

    const dispose = store.use({
      name: 'contributor',
      contributes: {
        nodeDefinitions: [{ type: 'demo', label: 'Demo' }],
        edgeDefinitions: [{ type: 'link' }],
        commands: [{ id: 'demo.noop', execute: () => undefined }],
        diagnostics: [function demoDiagnostics() {}],
      },
      setup: ({ addConnectionValidator, registerNodeDefinition }) => {
        const removeValidator = addConnectionValidator(() => ({ valid: false, reason: 'No.' }))
        const removeDefinition = registerNodeDefinition({ type: 'demo', label: 'Override' })

        return () => {
          removeDefinition()
          removeValidator()
        }
      },
    })

    expect(store.hasPlugin(' contributor ')).toBe(true)
    expect(store.getNodeDefinition('demo')?.label).toBe('Override')

    events.length = 0
    dispose()
    dispose()

    expect(store.hasPlugin('contributor')).toBe(false)
    expect(store.getNodeDefinition('demo')).toBeUndefined()
    expect(store.getEdgeDefinition('link')).toBeUndefined()
    expect(store.getCommand('demo.noop')).toBeUndefined()
    expect(events).toEqual([
      'registry:node-definition-registered demo',
      'registry:diagnostic-provider-unregistered demoDiagnostics',
      'registry:edge-definition-unregistered link',
      'registry:node-definition-unregistered demo',
      'registry:command-unregistered demo.noop',
    ])
  })

  it('disposes every plugin with the store', () => {
    const store = createStore()
    const disposed: string[] = []

    store.use({ name: 'first', setup: () => () => disposed.push('first') })
    store.use({ name: 'second', setup: () => () => disposed.push('second') })
    store.dispose()

    expect(disposed).toEqual(['first', 'second'])
    expect([store.hasPlugin('first'), store.hasPlugin('second')]).toEqual([false, false])
  })
})
