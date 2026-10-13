import type {
  NodeEngineRuntimeCallFrame,
  NodeEngineRuntimeNodeState,
  NodeEngineRuntimeTraceEntry,
  NodeEngineRunResult,
} from '../runtime/index.js'

export interface NodeEngineDebugSummary {
  status: NodeEngineRunResult['status']
  totalNodes: number
  failedNodes: string[]
  pausedNodes: string[]
  durationMs: number
  totalTraceEntries: number
  totalCallFrames: number
}

export function summarizeRunDebugState(run: NodeEngineRunResult): NodeEngineDebugSummary {
  const states = Object.values(run.nodeStates)

  return {
    status: run.status,
    totalNodes: states.length,
    failedNodes: states.filter((state) => state.status === 'error').map((state) => state.nodeId),
    pausedNodes: states.filter((state) => state.status === 'paused').map((state) => state.nodeId),
    durationMs: sumTraceDuration(run.trace),
    totalTraceEntries: run.trace.length,
    totalCallFrames: run.callFrames.length,
  }
}

export function getCurrentDebugNode(
  run: NodeEngineRunResult,
): NodeEngineRuntimeNodeState | undefined {
  return Object.values(run.nodeStates).find(
    (state) => state.status === 'running' || state.status === 'paused',
  )
}

export function getFailedTraceEntries(run: NodeEngineRunResult): NodeEngineRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.status === 'error')
}

export function getTraceEntriesByKind(
  run: NodeEngineRunResult,
  kind: NonNullable<NodeEngineRuntimeTraceEntry['kind']>,
): NodeEngineRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.kind === kind)
}

export function getActiveCallStack(run: NodeEngineRunResult): NodeEngineRuntimeCallFrame[] {
  return run.callFrames.filter((frame) => frame.status === 'running')
}

export function getFailedCallFrames(run: NodeEngineRunResult): NodeEngineRuntimeCallFrame[] {
  return run.callFrames.filter((frame) => frame.status === 'error')
}

export function getTraceForFrame(
  run: NodeEngineRunResult,
  frameId: string,
): NodeEngineRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.frameId === frameId)
}

function sumTraceDuration(trace: NodeEngineRuntimeTraceEntry[]): number {
  return trace.reduce((total, entry) => total + (entry.durationMs ?? 0), 0)
}
