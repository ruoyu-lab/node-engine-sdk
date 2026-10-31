import { cloneValue } from '../protocol/index.js'
import type { GraphNode } from '../protocol/index.js'
import { createRuntimeId, type RunSession } from './run-session.js'
import { cloneRuntimeValue } from './snapshot.js'
import type {
  NodeWrightRuntimeCallFrame,
  NodeWrightRuntimeNodeState,
  NodeWrightRuntimeOptions,
  NodeWrightRuntimePortValues,
  NodeWrightRuntimeTraceEntry,
} from './types.js'

type RecordedStatus = NodeWrightRuntimeNodeState['status']

/** A node, function, or subgraph invocation that owns a call frame and a trace entry. */
export interface RecordedCall {
  frame: NodeWrightRuntimeCallFrame
  trace: NodeWrightRuntimeTraceEntry
  /** The caller's call stack with `frame` on top. */
  callStack: NodeWrightRuntimeCallFrame[]
}

export interface NodeOutcome {
  status: RecordedStatus
  startedAt: number
  inputValues?: NodeWrightRuntimePortValues
  values?: NodeWrightRuntimePortValues
  outputSummary?: unknown
  error?: unknown
}

export interface DataEvaluationOutcome {
  status: RecordedStatus
  inputValues?: NodeWrightRuntimePortValues
  values?: NodeWrightRuntimePortValues
  callStack: NodeWrightRuntimeCallFrame[]
  error?: unknown
}

/**
 * Records what a run did into its trace, call frames, and node states. `options.debug` decides
 * which values are captured; `options.summarizeValue` shapes the summaries.
 */
export class RunRecorder {
  constructor(
    private readonly options: Pick<NodeWrightRuntimeOptions, 'debug' | 'summarizeValue'>,
  ) {}

  startNode(
    run: RunSession,
    node: GraphNode,
    callStack: NodeWrightRuntimeCallFrame[],
  ): RecordedCall {
    const frame = this.openFrame(run, callStack, {
      kind: 'node',
      name: node.id,
      nodeId: node.id,
    })
    const frameStack = [...callStack, frame]
    const trace: NodeWrightRuntimeTraceEntry = {
      id: createRuntimeId('trace'),
      kind: 'node',
      frameId: frame.id,
      depth: frame.depth,
      nodeId: node.id,
      type: node.type,
      status: 'running',
      startedAt: Date.now(),
      callStack: this.captureCallStack(frameStack),
    }

    run.currentNodeId = node.id
    run.nodeStates[node.id] = {
      nodeId: node.id,
      status: 'running',
      startedAt: trace.startedAt,
      frameId: frame.id,
      callStack: this.captureCallStack(frameStack),
    }
    run.trace.push(trace)

    return { frame, trace, callStack: frameStack }
  }

  /** Records the input values a running node received. */
  recordNodeInputs(trace: NodeWrightRuntimeTraceEntry, values: NodeWrightRuntimePortValues): void {
    trace.inputSummary = this.summarize(values)

    if (this.shouldCaptureInputs()) {
      trace.inputValues = cloneValue(values)
    }
  }

  finishNode(run: RunSession, node: GraphNode, call: RecordedCall, outcome: NodeOutcome): void {
    const { trace } = call
    const endedAt = Date.now()
    const durationMs = endedAt - outcome.startedAt
    trace.status = outcome.status
    trace.endedAt = endedAt
    trace.durationMs = durationMs
    trace.outputSummary = this.summarize(outcome.outputSummary)
    if (this.shouldCaptureOutputs()) {
      trace.outputValues = cloneValue(outcome.values ?? {})
    }
    trace.error = outcome.error

    run.nodeStates[node.id] = {
      nodeId: node.id,
      status: outcome.status,
      startedAt: outcome.startedAt,
      endedAt,
      durationMs,
      inputValues: this.captureInputs(outcome.inputValues),
      outputValues: this.captureOutputs(outcome.values),
      values: outcome.values,
      error: outcome.error,
      frameId: trace.frameId,
      callStack: trace.callStack,
    }
    this.closeFrame(call.frame, outcome.status)
  }

  /** Records one evaluation of a data node, which runs without a frame of its own. */
  recordDataEvaluation(
    run: RunSession,
    node: GraphNode,
    startedAt: number,
    outcome: DataEvaluationOutcome,
  ): void {
    const endedAt = Date.now()

    run.trace.push({
      id: createRuntimeId('trace'),
      kind: 'data',
      nodeId: node.id,
      type: node.type,
      status: outcome.status,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      inputSummary: this.summarize(outcome.inputValues ?? {}),
      inputValues: this.captureInputs(outcome.inputValues),
      outputSummary: this.summarize(outcome.values ?? {}),
      outputValues: this.captureOutputs(outcome.values),
      error: outcome.error,
      callStack: this.captureCallStack(outcome.callStack),
    })

    run.nodeStates[node.id] = {
      nodeId: node.id,
      status: outcome.status,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      inputValues: this.captureInputs(outcome.inputValues),
      outputValues: this.captureOutputs(outcome.values),
      values: outcome.values,
      error: outcome.error,
      callStack: this.captureCallStack(outcome.callStack),
    }
  }

  /** Opens the frame and trace entry of a function or subgraph call. */
  startCall(
    run: RunSession,
    callStack: NodeWrightRuntimeCallFrame[],
    call: { kind: 'function' | 'subgraph'; id: string; inputValues: NodeWrightRuntimePortValues },
  ): RecordedCall {
    const frame = this.openFrame(run, callStack, {
      kind: call.kind,
      name: call.id,
      functionId: call.kind === 'function' ? call.id : undefined,
      subgraphId: call.kind === 'subgraph' ? call.id : undefined,
    })
    const frameStack = [...callStack, frame]
    const trace: NodeWrightRuntimeTraceEntry = {
      id: createRuntimeId('trace'),
      kind: call.kind,
      frameId: frame.id,
      depth: frame.depth,
      functionId: frame.functionId,
      subgraphId: frame.subgraphId,
      type: call.id,
      status: 'running',
      startedAt: Date.now(),
      inputSummary: this.summarize(call.inputValues),
      inputValues: this.captureInputs(call.inputValues),
      callStack: this.captureCallStack(frameStack),
    }

    run.trace.push(trace)

    return { frame, trace, callStack: frameStack }
  }

  finishCall(
    call: RecordedCall,
    status: RecordedStatus,
    outputValues?: NodeWrightRuntimePortValues,
    error?: unknown,
  ): void {
    const { trace } = call
    const endedAt = Date.now()

    trace.status = status
    trace.endedAt = endedAt
    trace.durationMs = endedAt - trace.startedAt
    trace.outputSummary = this.summarize(outputValues ?? {})
    trace.outputValues = this.captureOutputs(outputValues)
    trace.error = error

    this.closeFrame(call.frame, status)
  }

  private openFrame(
    run: RunSession,
    callStack: NodeWrightRuntimeCallFrame[],
    frame: Pick<
      NodeWrightRuntimeCallFrame,
      'kind' | 'name' | 'nodeId' | 'functionId' | 'subgraphId'
    >,
  ): NodeWrightRuntimeCallFrame {
    const opened: NodeWrightRuntimeCallFrame = {
      id: createRuntimeId('frame'),
      kind: frame.kind,
      name: frame.name,
      parentId: callStack[callStack.length - 1]?.id,
      nodeId: frame.nodeId,
      functionId: frame.functionId,
      subgraphId: frame.subgraphId,
      depth: callStack.length,
      startedAt: Date.now(),
      status: 'running',
    }

    run.callFrames.push(opened)

    return opened
  }

  private closeFrame(frame: NodeWrightRuntimeCallFrame, status: RecordedStatus): void {
    const endedAt = Date.now()

    frame.status = status
    frame.endedAt = endedAt
    frame.durationMs = endedAt - frame.startedAt
  }

  private captureInputs(
    values: NodeWrightRuntimePortValues | undefined,
  ): NodeWrightRuntimePortValues | undefined {
    return this.shouldCaptureInputs() ? cloneValue(values ?? {}) : undefined
  }

  private captureOutputs(
    values: NodeWrightRuntimePortValues | undefined,
  ): NodeWrightRuntimePortValues | undefined {
    return this.shouldCaptureOutputs() ? cloneValue(values ?? {}) : undefined
  }

  private captureCallStack(
    callStack: NodeWrightRuntimeCallFrame[],
  ): NodeWrightRuntimeCallFrame[] | undefined {
    return this.options.debug?.captureCallStack !== false ? cloneRuntimeValue(callStack) : undefined
  }

  private shouldCaptureInputs(): boolean {
    return this.options.debug?.captureInputs !== false
  }

  private shouldCaptureOutputs(): boolean {
    return this.options.debug?.captureOutputs !== false
  }

  private summarize(value: unknown): unknown {
    return this.options.summarizeValue ? this.options.summarizeValue(value) : value
  }
}
