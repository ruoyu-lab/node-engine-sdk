import type { GraphDiagnostic, GraphNode, GraphSnapshot } from '../protocol/index.js'
import type {
  FunctionDefinition,
  FunctionReferenceInput,
  SemanticNodeDefinition,
  SubgraphDefinition,
  SubgraphReferenceInput,
} from '../semantics/index.js'
import type {
  NodeEngineRuntimeInitialVariables,
  NodeEngineRuntimeVariableApi,
  NodeEngineRuntimeVariableInput,
  NodeEngineRuntimeVariableSnapshot,
} from './variables.js'

export type NodeEngineRuntimePortValues = Record<string, unknown>

export type NodeEngineRuntimeSchedulePhase = 'data' | 'exec'
export type NodeEngineRuntimeTraceKind = 'node' | 'data' | 'function' | 'subgraph'
export type NodeEngineRuntimeCallFrameKind = 'node' | 'function' | 'subgraph'

export interface NodeEngineRuntimeTaskAttempt {
  attempt: number
  signal: AbortSignal
}

export interface NodeEngineRuntimeScheduledTask<T = unknown> {
  id: string
  label?: string
  retryable: boolean
  run: (attempt: NodeEngineRuntimeTaskAttempt) => Promise<T>
}

export interface NodeEngineRuntimeSchedulerContext {
  runId: string
  graph: GraphSnapshot
  signal: AbortSignal
  phase: NodeEngineRuntimeSchedulePhase
  node?: GraphNode
}

export interface NodeEngineRuntimeScheduler {
  schedule: <T>(
    context: NodeEngineRuntimeSchedulerContext,
    tasks: Array<NodeEngineRuntimeScheduledTask<T>>,
  ) => Promise<T[]>
}

export interface NodeEngineRuntimeCallFrame {
  id: string
  kind: NodeEngineRuntimeCallFrameKind
  name: string
  parentId?: string
  nodeId?: string
  functionId?: string
  subgraphId?: string
  depth: number
  startedAt: number
  endedAt?: number
  durationMs?: number
  status: NodeEngineRuntimeNodeStatus
}

export type NodeEngineRuntimeStepMode = 'into' | 'over' | 'out'

export interface NodeEngineRuntimeDebugOptions {
  captureInputs?: boolean
  captureOutputs?: boolean
  captureCallStack?: boolean
}

export interface NodeEngineRuntimeFunctionResult {
  values?: NodeEngineRuntimePortValues
  data?: unknown
}

export type NodeEngineRuntimeCallFunction = (
  reference: FunctionReferenceInput,
  values?: NodeEngineRuntimePortValues,
) => Promise<NodeEngineRuntimeFunctionResult>

export interface NodeEngineRuntimeSubgraphResult {
  values?: NodeEngineRuntimePortValues
  data?: unknown
}

export type NodeEngineRuntimeCallSubgraph = (
  reference: SubgraphReferenceInput,
  values?: NodeEngineRuntimePortValues,
) => Promise<NodeEngineRuntimeSubgraphResult>

export type NodeEngineRuntimeSubgraphDefinition = SubgraphDefinition

export interface NodeEngineRuntimeFunctionContext {
  functionDefinition: FunctionDefinition
  graph: GraphSnapshot
  values: NodeEngineRuntimePortValues
  variables: NodeEngineRuntimeVariableSnapshot
  variable: NodeEngineRuntimeVariableApi
  getVariable: (reference: NodeEngineRuntimeVariableInput) => unknown
  setVariable: (reference: NodeEngineRuntimeVariableInput, value: unknown) => void
  callFunction: NodeEngineRuntimeCallFunction
  callSubgraph: NodeEngineRuntimeCallSubgraph
  callStack: NodeEngineRuntimeCallFrame[]
  runId: string
  signal: AbortSignal
}

export type NodeEngineRuntimeFunctionHandler = (
  context: NodeEngineRuntimeFunctionContext,
) => NodeEngineRuntimeFunctionResult | void | Promise<NodeEngineRuntimeFunctionResult | void>

export interface NodeEngineRuntimeFunctionDefinition extends FunctionDefinition {
  handler?: NodeEngineRuntimeFunctionHandler
}

export interface NodeEngineRuntimeNodeContext {
  node: GraphNode
  definition?: SemanticNodeDefinition
  graph: GraphSnapshot
  input: unknown
  values: NodeEngineRuntimePortValues
  params: NodeEngineRuntimePortValues
  variables: NodeEngineRuntimeVariableSnapshot
  variable: NodeEngineRuntimeVariableApi
  getVariable: (reference: NodeEngineRuntimeVariableInput) => unknown
  setVariable: (reference: NodeEngineRuntimeVariableInput, value: unknown) => void
  callFunction: NodeEngineRuntimeCallFunction
  callSubgraph: NodeEngineRuntimeCallSubgraph
  callStack: NodeEngineRuntimeCallFrame[]
  runId: string
  signal: AbortSignal
}

export interface NodeEngineRuntimeNodeResult {
  output?: string
  outputs?: string[]
  values?: NodeEngineRuntimePortValues
  data?: unknown
}

export type NodeEngineRuntimeNodeHandler = (
  context: NodeEngineRuntimeNodeContext,
) => NodeEngineRuntimeNodeResult | void | Promise<NodeEngineRuntimeNodeResult | void>

export interface NodeEngineRuntimeNodeDefinition {
  type: string
  handler?: NodeEngineRuntimeNodeHandler
  cacheable?: boolean
  idempotent?: boolean
}

export type NodeEngineRuntimeNodeStatus =
  'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export type NodeEngineRunStatus = 'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export interface NodeEngineBreakpointContext {
  run: NodeEngineRuntimeRunState
  node?: GraphNode
  functionDefinition?: FunctionDefinition
  subgraphDefinition?: SubgraphDefinition
  frame?: NodeEngineRuntimeCallFrame
}

export interface NodeEngineBreakpoint {
  id?: string
  nodeId?: string
  functionId?: string
  subgraphId?: string
  enabled?: boolean
  condition?: (context: NodeEngineBreakpointContext) => boolean | Promise<boolean>
}

export interface NodeEngineRuntimeTraceEntry {
  id?: string
  kind?: NodeEngineRuntimeTraceKind
  frameId?: string
  depth?: number
  callStack?: NodeEngineRuntimeCallFrame[]
  nodeId?: string
  functionId?: string
  subgraphId?: string
  type: string
  status: NodeEngineRuntimeNodeStatus
  startedAt: number
  endedAt?: number
  durationMs?: number
  inputSummary?: unknown
  inputValues?: NodeEngineRuntimePortValues
  outputSummary?: unknown
  outputValues?: NodeEngineRuntimePortValues
  error?: unknown
}

export interface NodeEngineRuntimeNodeState {
  nodeId: string
  status: NodeEngineRuntimeNodeStatus
  startedAt?: number
  endedAt?: number
  durationMs?: number
  error?: unknown
  inputValues?: NodeEngineRuntimePortValues
  outputValues?: NodeEngineRuntimePortValues
  values?: NodeEngineRuntimePortValues
  frameId?: string
  callStack?: NodeEngineRuntimeCallFrame[]
}

export interface NodeEngineRunResult {
  runId: string
  status: NodeEngineRunStatus
  trace: NodeEngineRuntimeTraceEntry[]
  callFrames: NodeEngineRuntimeCallFrame[]
  nodeStates: Record<string, NodeEngineRuntimeNodeState>
  variables: NodeEngineRuntimeVariableSnapshot
  listenerErrors: unknown[]
  error?: unknown
}

export interface NodeEngineRuntimeRunState extends NodeEngineRunResult {
  currentNodeId?: string
}

export interface NodeEngineRuntimeEvent {
  type:
    | 'run:start'
    | 'run:pause'
    | 'run:resume'
    | 'run:step'
    | 'run:cancel'
    | 'run:success'
    | 'run:error'
    | 'node:start'
    | 'node:success'
    | 'node:cancel'
    | 'node:error'
    | 'function:start'
    | 'function:success'
    | 'function:error'
    | 'subgraph:start'
    | 'subgraph:success'
    | 'subgraph:error'
  run: NodeEngineRuntimeRunState
  node?: GraphNode
  functionDefinition?: FunctionDefinition
  subgraphDefinition?: SubgraphDefinition
  frame?: NodeEngineRuntimeCallFrame
  trace?: NodeEngineRuntimeTraceEntry
}

export type NodeEngineRuntimeListener = (event: NodeEngineRuntimeEvent) => void

export interface NodeEngineRuntimeOptions {
  graph?: GraphSnapshot | (() => GraphSnapshot)
  definitions?: SemanticNodeDefinition[]
  getNodeDefinition?: (type: string) => SemanticNodeDefinition | undefined
  runtimeDefinitions?: NodeEngineRuntimeNodeDefinition[]
  handlers?: Record<string, NodeEngineRuntimeNodeHandler>
  functionDefinitions?: NodeEngineRuntimeFunctionDefinition[]
  functionHandlers?: Record<string, NodeEngineRuntimeFunctionHandler>
  subgraphDefinitions?: NodeEngineRuntimeSubgraphDefinition[]
  scheduler?: NodeEngineRuntimeScheduler
  debug?: NodeEngineRuntimeDebugOptions
  initialVariables?: NodeEngineRuntimeInitialVariables
  maxSteps?: number
  maxLoopIterations?: number
  summarizeValue?: (value: unknown) => unknown
  onEvent?: NodeEngineRuntimeListener
}

export interface NodeEngineCompileOptions {
  graph: GraphSnapshot
  entryNodeId?: string
  definitions?: SemanticNodeDefinition[]
  getNodeDefinition?: (type: string) => SemanticNodeDefinition | undefined
  runtimeDefinitions?: NodeEngineRuntimeNodeDefinition[]
  handlers?: Record<string, NodeEngineRuntimeNodeHandler>
  functionDefinitions?: NodeEngineRuntimeFunctionDefinition[]
  subgraphDefinitions?: NodeEngineRuntimeSubgraphDefinition[]
  diagnostics?: GraphDiagnostic[]
}

export type {
  GraphDiagnostic,
  NodeEngineCompileResult,
  NodeEngineExecutionPlan,
} from '../protocol/index.js'
