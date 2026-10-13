import { GraphIndex } from '../protocol/index.js'
import type { GraphNode, GraphSnapshot } from '../protocol/index.js'
import { cloneRuntimeValue } from './snapshot.js'
import type {
  NodeEngineRunResult,
  NodeEngineRuntimeCallFrame,
  NodeEngineRuntimePortValues,
  NodeEngineRuntimeRunState,
  NodeEngineRuntimeSchedulePhase,
  NodeEngineRuntimeSchedulerContext,
  NodeEngineRuntimeStepMode,
} from './types.js'
import {
  createRuntimeVariableSnapshot,
  type NodeEngineRuntimeInitialVariables,
  type NodeEngineRuntimeVariableSnapshot,
} from './variables.js'

/** Why a run paused: a breakpoint, an explicit `pause()`, or a finished step. */
export type RunPauseMode = 'breakpoint' | 'manual' | 'step'

/** Mutable state of one active run. Callers only ever see copies made by `toRunResult`. */
export interface RunSession extends NodeEngineRuntimeRunState {
  controller: AbortController
  /** Releases the run from its current pause. */
  resume?: () => void
  stepRequested: boolean
  stepMode?: NodeEngineRuntimeStepMode
  stepTargetDepth?: number
  pauseMode?: RunPauseMode
  steps: number
  visits: Map<string, number>
  graph: GraphSnapshot
  graphIndex: GraphIndex
  dataEvaluations: Map<string, Promise<NodeEngineRuntimePortValues>>
  variables: NodeEngineRuntimeVariableSnapshot
  pausedCallStack: NodeEngineRuntimeCallFrame[]
  cancelEmitted: boolean
}

/**
 * The graph a node executes in: the run's graph, or the graph of a subgraph call with its own
 * data evaluation cache and boundary inputs.
 */
export interface ExecutionScope {
  graph: GraphSnapshot
  graphIndex: GraphIndex
  dataEvaluations: Map<string, Promise<NodeEngineRuntimePortValues>>
  signal: AbortSignal
  callStack: NodeEngineRuntimeCallFrame[]
  subgraphInputs?: NodeEngineRuntimePortValues
}

export function createRunSession(
  graph: GraphSnapshot,
  initialVariables: NodeEngineRuntimeInitialVariables | undefined,
): RunSession {
  return {
    runId: createRuntimeId('run'),
    status: 'running',
    trace: [],
    callFrames: [],
    nodeStates: {},
    controller: new AbortController(),
    stepRequested: false,
    steps: 0,
    visits: new Map(),
    graph,
    graphIndex: new GraphIndex(graph),
    dataEvaluations: new Map(),
    variables: createRuntimeVariableSnapshot(initialVariables),
    pausedCallStack: [],
    cancelEmitted: false,
    listenerErrors: [],
  }
}

export function createRootScope(run: RunSession): ExecutionScope {
  return {
    graph: run.graph,
    graphIndex: run.graphIndex,
    dataEvaluations: run.dataEvaluations,
    signal: run.controller.signal,
    callStack: [],
  }
}

/** The context a scheduler receives for the tasks of one phase in `scope`. */
export function createSchedulerContext(
  run: RunSession,
  scope: ExecutionScope,
  phase: NodeEngineRuntimeSchedulePhase,
  node: GraphNode,
): NodeEngineRuntimeSchedulerContext {
  return {
    runId: run.runId,
    graph: scope.graph,
    signal: scope.signal,
    phase,
    node,
  }
}

/** A detached copy of the public part of a run. */
export function toRunResult(run: RunSession): NodeEngineRunResult {
  return {
    runId: run.runId,
    status: run.status,
    trace: cloneRuntimeValue(run.trace),
    callFrames: cloneRuntimeValue(run.callFrames),
    nodeStates: cloneRuntimeValue(run.nodeStates),
    variables: cloneRuntimeValue(run.variables),
    listenerErrors: cloneRuntimeValue(run.listenerErrors),
    error: cloneRuntimeValue(run.error),
  }
}

export function isRunCancelled(run: RunSession): boolean {
  return run.controller.signal.aborted || run.status === 'cancelled'
}

/** Throws the cancellation reason once the run or the scope's signal is cancelled. */
export function assertRunnable(run: RunSession, signal: AbortSignal): void {
  if (isRunCancelled(run) || signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error(`Run "${run.runId}" was cancelled.`)
  }
}

export function createRuntimeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
