import { describe, expect, it } from 'vitest'
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'
import {
  NodeWrightRuntime,
  compileGraph,
  type NodeWrightRuntimeNodeDefinition,
} from '../../src/runtime/index'

const definitions: SemanticNodeDefinition[] = [
  {
    type: 'event',
    ports: [{ id: 'then', direction: 'output', kind: 'exec' }],
    capabilities: ['event'],
  },
  {
    type: 'step',
    ports: [
      { id: 'in', direction: 'input', kind: 'exec' },
      { id: 'then', direction: 'output', kind: 'exec' },
    ],
  },
  { type: 'sink', ports: [{ id: 'in', direction: 'input', kind: 'exec' }] },
]

function makeChainGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'start', type: 'event', x: 0, y: 0 },
      { id: 'mid', type: 'step', x: 100, y: 0 },
      { id: 'end', type: 'sink', x: 200, y: 0 },
    ],
    edges: [
      {
        id: 'e1',
        kind: 'exec',
        source: { nodeId: 'start', portId: 'then' },
        target: { nodeId: 'mid', portId: 'in' },
      },
      {
        id: 'e2',
        kind: 'exec',
        source: { nodeId: 'mid', portId: 'then' },
        target: { nodeId: 'end', portId: 'in' },
      },
    ],
    groups: [],
    meta: {},
  }
}

const runtimeDefinitions: NodeWrightRuntimeNodeDefinition[] = [
  { type: 'event', handler: () => ({ output: 'then' }) },
  { type: 'step', handler: () => ({ output: 'then' }) },
  { type: 'sink', handler: () => ({}) },
]

describe('@node-wright/core/runtime debugger', () => {
  it('pauses on a breakpoint and resumes after manual resume', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })
    expect(compiled.valid).toBe(true)

    const pausedAt: string[] = []
    let runIdSeen: string | undefined

    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        if (event.type === 'run:pause') {
          pausedAt.push(event.node?.id ?? '')
          runIdSeen = event.run.runId
          queueMicrotask(() => runtime.resume(runIdSeen!))
        }
      },
    })

    runtime.setBreakpoint({ nodeId: 'mid' })

    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('success')
    expect(pausedAt).toEqual(['mid'])
    expect(result.nodeStates.end?.status).toBe('success')
  })

  it('cancel during pause yields a cancelled run', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })

    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        if (event.type === 'run:pause') {
          queueMicrotask(() => runtime.cancel(event.run.runId))
        }
      },
    })

    runtime.setBreakpoint({ nodeId: 'mid' })

    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('cancelled')
    expect(result.nodeStates.end).toBeUndefined()
  })

  it('disabled breakpoint does not pause the run', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })

    let paused = false
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        if (event.type === 'run:pause') paused = true
      },
    })

    runtime.setBreakpoint({ nodeId: 'mid', enabled: false })

    const result = await runtime.run(compiled.plan!)

    expect(paused).toBe(false)
    expect(result.status).toBe('success')
  })

  it('conditional breakpoint pauses only when condition returns true', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })

    let pauses = 0
    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions,
      onEvent: (event) => {
        if (event.type === 'run:pause') {
          pauses += 1
          queueMicrotask(() => runtime.resume(event.run.runId))
        }
      },
    })

    runtime.setBreakpoint({
      nodeId: 'mid',
      condition: () => false,
    })

    const result = await runtime.run(compiled.plan!)

    expect(pauses).toBe(0)
    expect(result.status).toBe('success')
  })

  it('captures call frames and trace entries for every executed node', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions,
    })

    const runtime = new NodeWrightRuntime({ definitions, runtimeDefinitions })
    const result = await runtime.run(compiled.plan!)

    expect(
      result.trace
        .map((entry) => entry.nodeId)
        .filter(Boolean)
        .sort(),
    ).toEqual(['end', 'mid', 'start'])
    expect(result.callFrames.length).toBeGreaterThanOrEqual(3)
    expect(result.callFrames.every((frame) => frame.status === 'success')).toBe(true)
  })

  it('handler that throws produces an error status and surfaces the error', async () => {
    const compiled = compileGraph({
      graph: makeChainGraph(),
      entryNodeId: 'start',
      definitions,
      runtimeDefinitions: [
        { type: 'event', handler: () => ({ output: 'then' }) },
        {
          type: 'step',
          handler: () => {
            throw new Error('boom')
          },
        },
        { type: 'sink', handler: () => ({}) },
      ],
    })

    const runtime = new NodeWrightRuntime({
      definitions,
      runtimeDefinitions: [
        { type: 'event', handler: () => ({ output: 'then' }) },
        {
          type: 'step',
          handler: () => {
            throw new Error('boom')
          },
        },
        { type: 'sink', handler: () => ({}) },
      ],
    })
    const result = await runtime.run(compiled.plan!)

    expect(result.status).toBe('error')
    expect(result.nodeStates.mid?.status).toBe('error')
    expect(String(result.error)).toMatch(/boom/)
    expect(result.nodeStates.end).toBeUndefined()
  })
})
