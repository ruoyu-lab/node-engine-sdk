import { describe, expect, it } from 'vitest'
import { createRuntimeVariableSnapshot, type NodeWrightRunResult } from '@node-wright/core/runtime'
import {
  getActiveCallStack,
  getCurrentDebugNode,
  getFailedCallFrames,
  getFailedTraceEntries,
  getTraceEntriesByKind,
  getTraceForFrame,
  summarizeRunDebugState,
} from '../../src/debug/index'

const run: NodeWrightRunResult = {
  runId: 'run-1',
  status: 'error',
  trace: [
    {
      id: 'trace-node',
      kind: 'node',
      frameId: 'frame-running',
      nodeId: 'running',
      type: 'demo',
      status: 'success',
      startedAt: 1,
      durationMs: 4,
    },
    {
      id: 'trace-function',
      kind: 'function',
      frameId: 'frame-failed',
      functionId: 'format',
      type: 'format',
      status: 'error',
      startedAt: 5,
      durationMs: 6,
    },
  ],
  callFrames: [
    {
      id: 'frame-running',
      kind: 'node',
      name: 'running',
      nodeId: 'running',
      depth: 0,
      startedAt: 1,
      status: 'running',
    },
    {
      id: 'frame-failed',
      kind: 'function',
      name: 'format',
      functionId: 'format',
      depth: 1,
      startedAt: 5,
      endedAt: 11,
      durationMs: 6,
      status: 'error',
    },
  ],
  nodeStates: {
    running: { nodeId: 'running', status: 'running' },
    paused: { nodeId: 'paused', status: 'paused' },
    failed: { nodeId: 'failed', status: 'error' },
  },
  variables: createRuntimeVariableSnapshot(),
  listenerErrors: [],
}

describe('@node-wright/core/debug', () => {
  it('summarizes node, trace, frame, and duration state', () => {
    expect(summarizeRunDebugState(run)).toEqual({
      status: 'error',
      totalNodes: 3,
      failedNodes: ['failed'],
      pausedNodes: ['paused'],
      durationMs: 10,
      totalTraceEntries: 2,
      totalCallFrames: 2,
    })
  })

  it('filters current, failed, typed, and frame-scoped debug records', () => {
    expect(getCurrentDebugNode(run)?.nodeId).toBe('running')
    expect(getFailedTraceEntries(run).map((entry) => entry.id)).toEqual(['trace-function'])
    expect(getTraceEntriesByKind(run, 'function').map((entry) => entry.id)).toEqual([
      'trace-function',
    ])
    expect(getActiveCallStack(run).map((frame) => frame.id)).toEqual(['frame-running'])
    expect(getFailedCallFrames(run).map((frame) => frame.id)).toEqual(['frame-failed'])
    expect(getTraceForFrame(run, 'frame-running').map((entry) => entry.id)).toEqual(['trace-node'])
  })
})
