import { describe, expect, it, vi } from 'vitest'
import { GraphStore } from '../../src/store/index'
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import type { GraphSnapshot, GraphStoreEvent } from '@node-engine-sdk/core/protocol'

function createGraph(patch: Partial<Omit<GraphSnapshot, 'schemaVersion'>> = {}): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
    ...patch,
  }
}

describe('@node-engine-sdk/core/store GraphStore', () => {
  it('isolates internal state from constructor inputs and returned snapshots', () => {
    const graph = {
      schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
      nodes: [
        {
          id: 'a',
          type: 'demo',
          x: 0,
          y: 0,
          data: { nested: { value: 1 } },
        },
      ],
      edges: [],
      groups: [],
      meta: { nested: { value: 2 } },
    }
    const store = new GraphStore(graph)

    graph.nodes[0].data.nested.value = 10
    graph.meta.nested.value = 20

    const returned = store.getSnapshot()
    const returnedNodeData = returned.nodes[0].data as { nested: { value: number } }
    const returnedMetadata = returned.meta as { nested: { value: number } }
    returnedNodeData.nested.value = 30
    returnedMetadata.nested.value = 40

    const current = store.getSnapshot()

    expect(current.nodes[0].data).toEqual({ nested: { value: 1 } })
    expect(current.meta).toEqual({ nested: { value: 2 } })
  })

  it('isolates internal state from snapshots delivered to subscribers', () => {
    const store = new GraphStore()

    store.subscribe((event) => {
      event.snapshot.nodes.push({ id: 'injected', type: 'demo', x: 0, y: 0 })
      event.snapshot.meta.injected = true
    })

    store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })

    expect(store.getSnapshot().nodes.map((node) => node.id)).toEqual(['a'])
    expect(store.getSnapshot().meta).toEqual({})
  })

  it('returns detached node, edge, group, and port query values', () => {
    const store = new GraphStore(
      createGraph({
        nodes: [
          {
            id: 'source',
            type: 'source',
            x: 0,
            y: 0,
            data: { nested: { value: 1 } },
          },
          { id: 'target', type: 'target', x: 200, y: 0 },
        ],
        edges: [
          {
            id: 'edge',
            kind: 'data',
            source: { nodeId: 'source', portId: 'out' },
            target: { nodeId: 'target', portId: 'in' },
            data: { nested: { value: 2 } },
          },
        ],
        groups: [
          {
            id: 'group',
            x: -20,
            y: -20,
            width: 300,
            height: 160,
            nodeIds: ['source', 'target'],
            data: { nested: { value: 3 } },
          },
        ],
      }),
      {
        nodeDefinitions: [
          {
            type: 'source',
            ports: [
              {
                id: 'out',
                direction: 'output',
                data: { nested: { value: 4 } },
              },
            ],
          },
          {
            type: 'target',
            ports: [{ id: 'in', direction: 'input' }],
          },
        ],
      },
    )

    const node = store.getNode('source')!
    const edge = store.getEdge('edge')!
    const group = store.getGroup('group')!
    const port = store.getPort({ nodeId: 'source', portId: 'out' })!

    ;(node.data!.nested as { value: number }).value = 10
    ;(edge.data!.nested as { value: number }).value = 20
    ;(group.data!.nested as { value: number }).value = 30
    ;(port.data!.nested as { value: number }).value = 40

    expect(store.getNode('source')?.data).toEqual({ nested: { value: 1 } })
    expect(store.getEdge('edge')?.data).toEqual({ nested: { value: 2 } })
    expect(store.getGroup('group')?.data).toEqual({ nested: { value: 3 } })
    expect(store.getPort({ nodeId: 'source', portId: 'out' })?.data).toEqual({
      nested: { value: 4 },
    })
  })

  it('validates the initial graph during construction', () => {
    expect(
      () =>
        new GraphStore(
          createGraph({
            nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
            edges: [
              {
                id: 'bad',
                kind: 'data',
                source: { nodeId: 'missing', portId: 'out' },
                target: { nodeId: 'a', portId: 'in' },
              },
            ],
          }),
        ),
    ).toThrow(/Graph validation failed/)
  })

  it('rejects structurally invalid graph imports by default', () => {
    const store = new GraphStore()

    expect(() =>
      store.replaceGraph({
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
        edges: [
          {
            id: 'bad',
            kind: 'data',
            source: { nodeId: 'missing', portId: 'out' },
            target: { nodeId: 'a', portId: 'in' },
          },
        ],
        groups: [],
        meta: {},
      }),
    ).toThrow(/Graph validation failed/)
  })

  it('rejects duplicate plugin names and keeps disposal identity-safe', () => {
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const store = new GraphStore()
    const disposeFirst = store.use({
      name: 'example',
      setup: () => firstCleanup,
    })

    expect(() => store.use({ name: 'example', setup: () => secondCleanup })).toThrow(
      /already registered/,
    )
    expect(firstCleanup).not.toHaveBeenCalled()
    expect(secondCleanup).not.toHaveBeenCalled()

    expect(store.hasPlugin(' example ')).toBe(true)
    disposeFirst()
    expect(store.hasPlugin('example')).toBe(false)
    const disposeSecond = store.use({
      name: 'example',
      setup: () => secondCleanup,
    })

    disposeFirst()
    expect(secondCleanup).not.toHaveBeenCalled()
    expect(store.hasPlugin('example')).toBe(true)
    disposeSecond()
    disposeSecond()
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })

  it('rolls back plugin contributions when setup fails', () => {
    const store = new GraphStore()

    expect(() =>
      store.use({
        name: 'broken',
        contributes: {
          commands: [
            {
              id: 'broken.command',
              execute: () => {},
            },
          ],
        },
        setup: () => {
          throw new Error('setup failed')
        },
      }),
    ).toThrow('setup failed')
    expect(store.getCommand('broken.command')).toBeUndefined()

    const dispose = store.use({ name: 'broken' })
    expect(dispose).toBeTypeOf('function')
  })

  it('isolates registry values from registration inputs and query results', () => {
    const store = new GraphStore()
    const definition = {
      type: 'demo',
      ports: [
        {
          id: 'in',
          direction: 'input' as const,
          data: { nested: { value: 1 } },
        },
      ],
    }
    store.registerNodeDefinition(definition)

    ;(definition.ports[0].data.nested as { value: number }).value = 10
    const returned = store.getNodeDefinition('demo')!
    ;(returned.ports![0].data!.nested as { value: number }).value = 20

    expect(store.getNodeDefinition('demo')?.ports?.[0].data).toEqual({
      nested: { value: 1 },
    })
  })

  it('runs a transaction atomically with one diagnostic and change notification', () => {
    const provider = vi.fn(() => [])
    const store = new GraphStore(undefined, {
      diagnosticProviders: [provider],
    })
    const events: GraphStoreEvent[] = []
    store.subscribe((event) => events.push(event))
    provider.mockClear()

    store.transaction(
      'Add pair',
      () => {
        store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })
        store.addNode({ id: 'b', type: 'demo', x: 200, y: 0 })
      },
      { source: 'test.transaction' },
    )

    expect(provider).toHaveBeenCalledTimes(1)
    expect(events.map((event) => event.type)).toEqual(['history:commit', 'graph:changed'])
    expect(events.every((event) => event.source === 'test.transaction')).toBe(true)
    expect(store.getSnapshot().nodes.map((node) => node.id)).toEqual(['a', 'b'])

    store.undo()
    expect(store.getSnapshot().nodes).toEqual([])
  })

  it('runs diagnostic providers once for a command commit', () => {
    const provider = vi.fn(() => [])
    const store = new GraphStore(undefined, {
      diagnosticProviders: [provider],
    })

    store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })

    expect(provider).toHaveBeenCalledTimes(1)
  })

  it('rolls a transaction back without history or events when final validation fails', () => {
    const store = new GraphStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() =>
      store.transaction('Invalid batch', () => {
        store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })
        store.addEdge({
          id: 'invalid',
          kind: 'data',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'missing', portId: 'in' },
        })
      }),
    ).toThrow(/Graph validation failed/)

    expect(store.getSnapshot()).toEqual(createGraph())
    expect(store.canUndo).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('separates history-clearing replacement from undoable graph application', () => {
    const store = new GraphStore()
    store.addNode({ id: 'old', type: 'demo', x: 0, y: 0 })

    store.replaceGraph(
      createGraph({
        nodes: [{ id: 'base', type: 'demo', x: 0, y: 0 }],
      }),
    )
    expect(store.canUndo).toBe(false)

    store.applyGraph(
      createGraph({
        nodes: [{ id: 'applied', type: 'demo', x: 0, y: 0 }],
      }),
    )
    expect(store.canUndo).toBe(true)

    store.undo()
    expect(store.getSnapshot().nodes.map((node) => node.id)).toEqual(['base'])
  })

  it('keeps group membership valid when a grouped node is removed', () => {
    const store = new GraphStore(
      createGraph({
        nodes: [{ id: 'a', type: 'demo', x: 0, y: 0 }],
        groups: [
          {
            id: 'group',
            x: 0,
            y: 0,
            width: 200,
            height: 120,
            nodeIds: ['a'],
          },
        ],
      }),
    )

    store.removeNode('a')

    expect(store.getGroup('group')?.nodeIds).toEqual([])
    expect(store.validateGraph().valid).toBe(true)
  })

  it('throws from convenience mutations instead of returning a false-success snapshot', () => {
    const store = new GraphStore()
    store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })

    expect(() => store.addNode({ id: 'a', type: 'demo', x: 100, y: 100 })).toThrow(/already exists/)
    expect(() => store.updateNode('missing', { x: 10 })).toThrow(/not found/)
    expect(() => store.removeNode('missing')).toThrow(/not found/)
    expect(store.getNode('a')).toEqual(expect.objectContaining({ x: 0, y: 0 }))
  })

  it('does not let event listeners mutate history entries', () => {
    const store = new GraphStore()
    store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })
    store.subscribe((event) => {
      if (event.type === 'history:undo') {
        event.entry.after.nodes[0].id = 'corrupted'
        event.snapshot.nodes.push({ id: 'injected', type: 'demo', x: 0, y: 0 })
      }
    })

    store.undo()
    store.redo()

    expect(store.getSnapshot().nodes.map((node) => node.id)).toEqual(['a'])
  })

  it('tracks command history and exposes diagnostics from providers', () => {
    const store = new GraphStore(undefined, {
      diagnosticProviders: [
        () => [
          {
            code: 'TEST_DIAGNOSTIC',
            severity: 'warning',
            message: 'test diagnostic',
            source: 'test',
          },
        ],
      ],
    })

    store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })

    expect(store.canUndo).toBe(true)
    expect(store.listDiagnostics().map((diagnostic) => diagnostic.code)).toContain(
      'TEST_DIAGNOSTIC',
    )

    store.undo()

    expect(store.getNode('a')).toBeUndefined()
    expect(store.canRedo).toBe(true)
  })

  it('resolves parameter input ports through the store API and commands', () => {
    const store = new GraphStore(
      {
        schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'source', type: 'source', x: 0, y: 0 },
          { id: 'target', type: 'target', x: 180, y: 0 },
        ],
        edges: [],
        groups: [],
        meta: {},
      },
      {
        nodeDefinitions: [
          {
            type: 'source',
            ports: [
              {
                id: 'value',
                direction: 'output',
                kind: 'data',
                dataType: 'number',
              },
            ],
          },
          {
            type: 'target',
            parameters: [
              {
                key: 'seed',
                kind: 'number',
                input: { portId: 'seed' },
              },
            ],
          },
        ],
      },
    )

    expect(store.getPort({ nodeId: 'target', portId: 'seed' })).toEqual(
      expect.objectContaining({
        id: 'seed',
        direction: 'input',
        data: expect.objectContaining({ parameter: true }),
      }),
    )

    const validation = store.connect(
      { nodeId: 'source', portId: 'value' },
      { nodeId: 'target', portId: 'seed' },
    )

    expect(validation.valid).toBe(true)
    expect(store.getSnapshot().edges).toEqual([
      expect.objectContaining({
        source: { nodeId: 'source', portId: 'value' },
        target: { nodeId: 'target', portId: 'seed' },
      }),
    ])
  })
})
