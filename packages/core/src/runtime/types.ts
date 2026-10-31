import type { GraphDiagnostic, GraphNode, GraphSnapshot } from '../protocol/index.js'
import type {
  FunctionDefinition,
  FunctionReferenceInput,
  SemanticNodeDefinition,
  SubgraphDefinition,
  SubgraphReferenceInput,
} from '../semantics/index.js'
import type {
  NodeWrightRuntimeInitialVariables,
  NodeWrightRuntimeVariableApi,
  NodeWrightRuntimeVariableInput,
  NodeWrightRuntimeVariableSnapshot,
} from './variables.js'

export type NodeWrightRuntimePortValues = Record<string, unknown>

export type NodeWrightRuntimeSchedulePhase = 'data' | 'exec'
export type NodeWrightRuntimeTraceKind = 'node' | 'data' | 'function' | 'subgraph'
export type NodeWrightRuntimeCallFrameKind = 'node' | 'function' | 'subgraph'

export interface NodeWrightRuntimeTaskAttempt {
  attempt: number
  signal: AbortSignal
}

export interface NodeWrightRuntimeScheduledTask<T = unknown> {
  id: string
  label?: string
  retryable: boolean
  run: (attempt: NodeWrightRuntimeTaskAttempt) => Promise<T>
}

export interface NodeWrightRuntimeSchedulerContext {
  runId: string
  graph: GraphSnapshot
  signal: AbortSignal
  phase: NodeWrightRuntimeSchedulePhase
  node?: GraphNode
}

export interface NodeWrightRuntimeScheduler {
  schedule: <T>(
    context: NodeWrightRuntimeSchedulerContext,
    tasks: Array<NodeWrightRuntimeScheduledTask<T>>,
  ) => Promise<T[]>
}

export interface NodeWrightRuntimeCallFrame {
  id: string
  kind: NodeWrightRuntimeCallFrameKind
  name: string
  parentId?: string
  nodeId?: string
  functionId?: string
  subgraphId?: string
  depth: number
  startedAt: number
  endedAt?: number
  durationMs?: number
  status: NodeWrightRuntimeNodeStatus
}

export type NodeWrightRuntimeStepMode = 'into' | 'over' | 'out'

export interface NodeWrightRuntimeDebugOptions {
  captureInputs?: boolean
  captureOutputs?: boolean
  captureCallStack?: boolean
}

export interface NodeWrightRuntimeFunctionResult {
  values?: NodeWrightRuntimePortValues
  data?: unknown
}

export type NodeWrightRuntimeCallFunction = (
  reference: FunctionReferenceInput,
  values?: NodeWrightRuntimePortValues,
) => Promise<NodeWrightRuntimeFunctionResult>

export interface NodeWrightRuntimeSubgraphResult {
  values?: NodeWrightRuntimePortValues
  data?: unknown
}

export type NodeWrightRuntimeCallSubgraph = (
  reference: SubgraphReferenceInput,
  values?: NodeWrightRuntimePortValues,
) => Promise<NodeWrightRuntimeSubgraphResult>

export type NodeWrightRuntimeSubgraphDefinition = SubgraphDefinition

export interface NodeWrightRuntimeFunctionContext {
  functionDefinition: FunctionDefinition
  graph: GraphSnapshot
  values: NodeWrightRuntimePortValues
  variables: NodeWrightRuntimeVariableSnapshot
  variable: NodeWrightRuntimeVariableApi
  getVariable: (reference: NodeWrightRuntimeVariableInput) => unknown
  setVariable: (reference: NodeWrightRuntimeVariableInput, value: unknown) => void
  callFunction: NodeWrightRuntimeCallFunction
  callSubgraph: NodeWrightRuntimeCallSubgraph
  callStack: NodeWrightRuntimeCallFrame[]
  runId: string
  signal: AbortSignal
}

export type NodeWrightRuntimeFunctionHandler = (
  context: NodeWrightRuntimeFunctionContext,
) => NodeWrightRuntimeFunctionResult | void | Promise<NodeWrightRuntimeFunctionResult | void>

export interface NodeWrightRuntimeFunctionDefinition extends FunctionDefinition {
  handler?: NodeWrightRuntimeFunctionHandler
}

export interface NodeWrightRuntimeNodeContext {
  node: GraphNode
  definition?: SemanticNodeDefinition
  graph: GraphSnapshot
  input: unknown
  values: NodeWrightRuntimePortValues
  params: NodeWrightRuntimePortValues
  variables: NodeWrightRuntimeVariableSnapshot
  variable: NodeWrightRuntimeVariableApi
  getVariable: (reference: NodeWrightRuntimeVariableInput) => unknown
  setVariable: (reference: NodeWrightRuntimeVariableInput, value: unknown) => void
  callFunction: NodeWrightRuntimeCallFunction
  callSubgraph: NodeWrightRuntimeCallSubgraph
  callStack: NodeWrightRuntimeCallFrame[]
  runId: string
  signal: AbortSignal
}

export interface NodeWrightRuntimeNodeResult {
  output?: string
  outputs?: string[]
  values?: NodeWrightRuntimePortValues
  data?: unknown
}

export type NodeWrightRuntimeNodeHandler = (
  context: NodeWrightRuntimeNodeContext,
) => NodeWrightRuntimeNodeResult | void | Promise<NodeWrightRuntimeNodeResult | void>

export interface NodeWrightRuntimeNodeDefinition {
  type: string
  handler?: NodeWrightRuntimeNodeHandler
  cacheable?: boolean
  idempotent?: boolean
}

export type NodeWrightRuntimeNodeStatus =
  'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export type NodeWrightRunStatus = 'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'

export interface NodeWrightBreakpointContext {
  run: NodeWrightRuntimeRunState
  node?: GraphNode
  functionDefinition?: FunctionDefinition
  subgraphDefinition?: SubgraphDefinition
  frame?: NodeWrightRuntimeCallFrame
}

export interface NodeWrightBreakpoint {
  id?: string
  nodeId?: string
  functionId?: string
  subgraphId?: string
  enabled?: boolean
  condition?: (context: NodeWrightBreakpointContext) => boolean | Promise<boolean>
}

export interface NodeWrightRuntimeTraceEntry {
  id?: string
  kind?: NodeWrightRuntimeTraceKind
  frameId?: string
  depth?: number
  callStack?: NodeWrightRuntimeCallFrame[]
  nodeId?: string
  functionId?: string
  subgraphId?: string
  type: string
  status: NodeWrightRuntimeNodeStatus
  startedAt: number
  endedAt?: number
  durationMs?: number
  inputSummary?: unknown
  inputValues?: NodeWrightRuntimePortValues
  outputSummary?: unknown
  outputValues?: NodeWrightRuntimePortValues
  error?: unknown
}

export interface NodeWrightRuntimeNodeState {
  nodeId: string
  status: NodeWrightRuntimeNodeStatus
  startedAt?: number
  endedAt?: number
  durationMs?: number
  error?: unknown
  inputValues?: NodeWrightRuntimePortValues
  outputValues?: NodeWrightRuntimePortValues
  values?: NodeWrightRuntimePortValues
  frameId?: string
  callStack?: NodeWrightRuntimeCallFrame[]
}

export interface NodeWrightRunResult {
  runId: string
  status: NodeWrightRunStatus
  trace: NodeWrightRuntimeTraceEntry[]
  callFrames: NodeWrightRuntimeCallFrame[]
  nodeStates: Record<string, NodeWrightRuntimeNodeState>
  variables: NodeWrightRuntimeVariableSnapshot
  listenerErrors: unknown[]
  error?: unknown
}

export interface NodeWrightRuntimeRunState extends NodeWrightRunResult {
  currentNodeId?: string
}

export interface NodeWrightRuntimeEvent {
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
  run: NodeWrightRuntimeRunState
  node?: GraphNode
  functionDefinition?: FunctionDefinition
  subgraphDefinition?: SubgraphDefinition
  frame?: NodeWrightRuntimeCallFrame
  trace?: NodeWrightRuntimeTraceEntry
}

export type NodeWrightRuntimeListener = (event: NodeWrightRuntimeEvent) => void

export interface NodeWrightRuntimeOptions {
  graph?: GraphSnapshot | (() => GraphSnapshot)
  definitions?: SemanticNodeDefinition[]
  getNodeDefinition?: (type: string) => SemanticNodeDefinition | undefined
  runtimeDefinitions?: NodeWrightRuntimeNodeDefinition[]
  handlers?: Record<string, NodeWrightRuntimeNodeHandler>
  functionDefinitions?: NodeWrightRuntimeFunctionDefinition[]
  functionHandlers?: Record<string, NodeWrightRuntimeFunctionHandler>
  subgraphDefinitions?: NodeWrightRuntimeSubgraphDefinition[]
  scheduler?: NodeWrightRuntimeScheduler
  debug?: NodeWrightRuntimeDebugOptions
  initialVariables?: NodeWrightRuntimeInitialVariables
  maxSteps?: number
  maxLoopIterations?: number
  summarizeValue?: (value: unknown) => unknown
  onEvent?: NodeWrightRuntimeListener
}

export interface NodeWrightCompileOptions {
  graph: GraphSnapshot
  entryNodeId?: string
  definitions?: SemanticNodeDefinition[]
  getNodeDefinition?: (type: string) => SemanticNodeDefinition | undefined
  runtimeDefinitions?: NodeWrightRuntimeNodeDefinition[]
  handlers?: Record<string, NodeWrightRuntimeNodeHandler>
  functionDefinitions?: NodeWrightRuntimeFunctionDefinition[]
  subgraphDefinitions?: NodeWrightRuntimeSubgraphDefinition[]
  diagnostics?: GraphDiagnostic[]
}

export type {
  GraphDiagnostic,
  NodeWrightCompileResult,
  NodeWrightExecutionPlan,
} from '../protocol/index.js'
