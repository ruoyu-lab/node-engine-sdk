import { describe, expect, it } from 'vitest'
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import { GraphState } from '../../src/store/graph-state'
import { GraphHistory } from '../../src/store/history'

function graphWith(...nodeIds: string[]): GraphSnapshot {
  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes: nodeIds.map((id, index) => ({ id, type: 'demo', x: index * 100, y: 0 })),
    edges: [],
    groups: [],
    meta: {},
  }
}

function nodeIds(state: GraphState): string[] {
  return state.current.nodes.map((node) => node.id)
}

function commit(history: GraphHistory, state: GraphState, id: string, ...ids: string[]): void {
  history.commit(state.current, graphWith(...ids), { id, label: id, diagnostics: [] })
}

describe('@node-engine-sdk/core/store GraphHistory', () => {
  it('moves the committed graph through commit, undo, and redo', () => {
    const state = new GraphState(graphWith('a'))
    const history = new GraphHistory(state, 10)
    const before = state.current
    const after = graphWith('a', 'b')

    const entry = history.commit(before, after, {
      id: 'add-b',
      label: 'Add b',
      diagnostics: [],
    })

    expect(entry).toMatchObject({ id: 'add-b', label: 'Add b', before, after, diagnostics: [] })
    expect(state.current).toBe(after)
    expect([history.canUndo, history.canRedo]).toEqual([true, false])

    expect(history.undo()?.id).toBe('add-b')
    expect(nodeIds(state)).toEqual(['a'])
    expect([history.canUndo, history.canRedo]).toEqual([false, true])

    expect(history.redo()?.id).toBe('add-b')
    expect(nodeIds(state)).toEqual(['a', 'b'])
    expect([history.canUndo, history.canRedo]).toEqual([true, false])
  })

  it('leaves the graph alone when there is nothing to undo or redo', () => {
    const state = new GraphState(graphWith('a'))
    const history = new GraphHistory(state, 10)
    const current = state.current

    expect(history.undo()).toBeUndefined()
    expect(history.redo()).toBeUndefined()
    expect(state.current).toBe(current)
  })

  it('clears redo on a new commit and drops the oldest entries beyond the limit', () => {
    const state = new GraphState(graphWith())
    const history = new GraphHistory(state, 2)

    commit(history, state, 'one', 'a')
    commit(history, state, 'two', 'a', 'b')
    commit(history, state, 'three', 'a', 'b', 'c')

    expect(history.undo()?.id).toBe('three')
    expect(history.undo()?.id).toBe('two')
    expect(history.undo()).toBeUndefined()
    expect(nodeIds(state)).toEqual(['a'])

    commit(history, state, 'four', 'a', 'd')

    expect(history.canRedo).toBe(false)
    expect(history.undo()?.id).toBe('four')
    expect(nodeIds(state)).toEqual(['a'])
  })

  it('records a detached copy of each entry', () => {
    const state = new GraphState(graphWith('a'))
    const history = new GraphHistory(state, 10)
    const entry = history.commit(state.current, graphWith('a', 'b'), {
      id: 'add-b',
      label: 'Add b',
      diagnostics: [],
    })

    entry.label = 'Changed'
    entry.before.nodes.push({ id: 'injected', type: 'demo', x: 0, y: 0 })

    const undone = history.undo()

    expect(undone?.label).toBe('Add b')
    expect(nodeIds(state)).toEqual(['a'])
  })

  it('clears both stacks', () => {
    const state = new GraphState(graphWith())
    const history = new GraphHistory(state, 10)

    commit(history, state, 'one', 'a')
    commit(history, state, 'two', 'a', 'b')
    history.undo()
    history.clear()

    expect([history.canUndo, history.canRedo]).toEqual([false, false])
    expect(nodeIds(state)).toEqual(['a'])
  })
})
