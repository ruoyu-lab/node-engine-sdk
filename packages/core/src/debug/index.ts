import type {
  NodeWrightRuntimeCallFrame,
  NodeWrightRuntimeNodeState,
  NodeWrightRuntimeTraceEntry,
  NodeWrightRunResult,
} from '../runtime/index.js'

export interface NodeWrightDebugSummary {
  status: NodeWrightRunResult['status']
  totalNodes: number
  failedNodes: string[]
  pausedNodes: string[]
  durationMs: number
  totalTraceEntries: number
  totalCallFrames: number
}

export function summarizeRunDebugState(run: NodeWrightRunResult): NodeWrightDebugSummary {
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
  run: NodeWrightRunResult,
): NodeWrightRuntimeNodeState | undefined {
  return Object.values(run.nodeStates).find(
    (state) => state.status === 'running' || state.status === 'paused',
  )
}

export function getFailedTraceEntries(run: NodeWrightRunResult): NodeWrightRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.status === 'error')
}

export function getTraceEntriesByKind(
  run: NodeWrightRunResult,
  kind: NonNullable<NodeWrightRuntimeTraceEntry['kind']>,
): NodeWrightRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.kind === kind)
}

export function getActiveCallStack(run: NodeWrightRunResult): NodeWrightRuntimeCallFrame[] {
  return run.callFrames.filter((frame) => frame.status === 'running')
}

export function getFailedCallFrames(run: NodeWrightRunResult): NodeWrightRuntimeCallFrame[] {
  return run.callFrames.filter((frame) => frame.status === 'error')
}

export function getTraceForFrame(
  run: NodeWrightRunResult,
  frameId: string,
): NodeWrightRuntimeTraceEntry[] {
  return run.trace.filter((entry) => entry.frameId === frameId)
}

function sumTraceDuration(trace: NodeWrightRuntimeTraceEntry[]): number {
  return trace.reduce((total, entry) => total + (entry.durationMs ?? 0), 0)
}
