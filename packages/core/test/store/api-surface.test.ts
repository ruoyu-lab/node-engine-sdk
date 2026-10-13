import { describe, expect, it } from 'vitest'
import * as store from '../../src/store/index'

const graphStoreMethods = [
  'getSnapshot',
  'replaceGraph',
  'applyGraph',
  'subscribe',
  'use',
  'hasPlugin',
  'dispose',
  'createId',
  'addConnectionValidator',
  'registerDiagnosticProvider',
  'registerCommand',
  'getCommand',
  'listCommands',
  'dispatchCommand',
  'registerNodeDefinition',
  'getNodeDefinition',
  'listNodeDefinitions',
  'registerEdgeDefinition',
  'getEdgeDefinition',
  'listEdgeDefinitions',
  'validateGraph',
  'repairGraph',
  'listDiagnostics',
  'validateConnection',
  'execute',
  'mutate',
  'transaction',
  'undo',
  'redo',
  'addNode',
  'updateNode',
  'moveNodes',
  'removeNode',
  'addEdge',
  'updateEdge',
  'removeEdge',
  'connect',
  'reconnectEdge',
  'addGroup',
  'updateGroup',
  'removeGroup',
  'getNode',
  'getEdge',
  'getGroup',
  'listGroups',
  'getPort',
] as const

describe('@node-engine-sdk/core/store API surface', () => {
  it('exports the store, its factory, and the command factories, and nothing internal', () => {
    expect(Object.keys(store).sort()).toEqual([
      'GraphStore',
      'addEdgeCommand',
      'addGroupCommand',
      'addNodeCommand',
      'composeValidationResults',
      'connectPortsCommand',
      'createGraphStore',
      'moveNodesCommand',
      'reconnectEdgeCommand',
      'removeEdgeCommand',
      'removeGroupCommand',
      'removeNodeCommand',
      'updateEdgeCommand',
      'updateGroupCommand',
      'updateNodeCommand',
    ])
  })

  it('keeps every public GraphStore entry point', () => {
    const graphStore = store.createGraphStore()

    for (const method of graphStoreMethods) {
      expect(typeof graphStore[method], method).toBe('function')
    }

    expect([graphStore.canUndo, graphStore.canRedo]).toEqual([false, false])
    graphStore.dispose()
  })
})
