import { describe, expect, it } from 'vitest'
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import type { GraphCommandDefinition, GraphStoreEvent } from '@node-engine-sdk/core/protocol'
import { GraphStore } from '../../src/store/index'

interface RenamePayload {
  nodeId: string
  name: string
}

function createStore(): GraphStore {
  return new GraphStore({
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
    edges: [],
    groups: [],
    meta: {},
  })
}

function command(
  definition: Partial<GraphCommandDefinition<RenamePayload>>,
): GraphCommandDefinition<RenamePayload> {
  return {
    id: 'demo.rename',
    execute: () => undefined,
    ...definition,
  }
}

describe('@node-engine-sdk/core/store command dispatch', () => {
  it('runs a registered command with its payload, draft, command API, and store', () => {
    const store = createStore()
    const executed: GraphStoreEvent[] = []
    store.subscribe((event) => {
      if (event.type === 'command:executed') {
        executed.push(event)
      }
    })
    store.registerCommand(
      command({
        label: ({ name }) => `Rename to ${name}`,
        category: 'node',
        validate: ({ nodeId }, storeApi) => storeApi.getNode(nodeId) !== undefined,
        execute: ({ nodeId, name }, _draft, api, storeApi) => {
          api.ensureNode(nodeId).data = { name, total: storeApi.getSnapshot().nodes.length }
        },
      }) as GraphCommandDefinition<never>,
    )

    const result = store.dispatchCommand('demo.rename', { nodeId: 'a', name: 'Alpha' })

    expect(result.applied).toBe(true)
    expect(result.snapshot.nodes[0]?.data).toEqual({ name: 'Alpha', total: 1 })
    expect(executed[0]).toMatchObject({
      command: { id: 'demo.rename', label: 'Rename to Alpha', category: 'node' },
    })
  })

  it('reports each kind of rejection in the result instead of throwing', () => {
    const store = createStore()
    const dispatch = (definition: Partial<GraphCommandDefinition<RenamePayload>>) => {
      const remove = store.registerCommand(command(definition) as GraphCommandDefinition<never>)
      const result = store.dispatchCommand('demo.rename', { nodeId: 'a', name: 'Alpha' })
      remove()
      return result
    }

    expect(store.dispatchCommand('demo.missing')).toMatchObject({
      applied: false,
      reason: 'Command "demo.missing" is not registered.',
    })
    expect(dispatch({ validate: () => false })).toMatchObject({
      applied: false,
      reason: 'Command "demo.rename" refused to execute.',
    })
    expect(
      dispatch({
        validate: () => ({
          valid: false,
          diagnostics: [
            { code: 'NAME_TAKEN', severity: 'error', message: 'Name is taken.', source: 'test' },
          ],
        }),
      }),
    ).toMatchObject({
      applied: false,
      diagnostics: [expect.objectContaining({ code: 'NAME_TAKEN' })],
      reason: 'Graph validation failed: Name is taken.',
    })
    expect(
      dispatch({ validate: () => ({ valid: false, code: 'NO', reason: 'Not now.' }) }),
    ).toMatchObject({
      applied: false,
      validation: { valid: false, code: 'NO', reason: 'Not now.' },
      reason: 'Not now.',
    })
    expect(
      dispatch({
        execute: () => {
          throw new Error('Rename failed.')
        },
      }),
    ).toMatchObject({ applied: false, reason: 'Rename failed.' })
    expect(
      dispatch({
        execute: () => {
          throw 'not an error'
        },
      }),
    ).toMatchObject({ applied: false, reason: 'Command "demo.rename" failed to execute.' })
    expect(store.getSnapshot().nodes[0]?.data).toBeUndefined()
    expect(store.canUndo).toBe(false)
  })

  it('lets a later registration override a built-in command until it is removed', () => {
    const store = createStore()
    const remove = store.registerCommand({
      id: 'node.remove',
      execute: () => {
        throw new Error('Nodes are protected.')
      },
    })

    expect(() => store.removeNode('a')).toThrow('Nodes are protected.')

    remove()

    expect(store.removeNode('a').nodes).toEqual([])
  })

  it('reports connection failures through connect and reconnectEdge', () => {
    const store = new GraphStore({
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        { id: 'a', type: 'demo', x: 0, y: 0, ports: [{ id: 'out', direction: 'output' }] },
        { id: 'b', type: 'demo', x: 100, y: 0, ports: [{ id: 'in', direction: 'input' }] },
        { id: 'c', type: 'demo', x: 200, y: 0, ports: [{ id: 'out', direction: 'output' }] },
      ],
      edges: [],
      groups: [],
      meta: {},
    })

    expect(store.connect({ nodeId: 'a', portId: 'out' }, { nodeId: 'a', portId: 'out' })).toEqual({
      valid: false,
      code: 'SELF_CONNECTION',
      reason: 'A port cannot connect to itself.',
    })
    expect(
      store.connect(
        { nodeId: 'a', portId: 'out' },
        { nodeId: 'b', portId: 'in' },
        { edgeId: 'edge' },
      ),
    ).toEqual({ valid: true })
    expect(store.reconnectEdge('missing', { target: { nodeId: 'b', portId: 'in' } })).toEqual({
      valid: false,
      code: 'MISSING_EDGE',
      reason: 'Edge "missing" was not found.',
    })
    expect(store.reconnectEdge('edge', { target: { nodeId: 'c', portId: 'out' } })).toMatchObject({
      valid: false,
      code: 'TARGET_NOT_INPUT',
    })
    expect(store.getEdge('edge')?.target).toEqual({ nodeId: 'b', portId: 'in' })
  })
})
