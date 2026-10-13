import { resolvePortKind } from '../protocol/index.js'
import type { GraphEdge, GraphIndex, GraphNode } from '../protocol/index.js'
import { EXEC_ERROR_PORT_ID, EXEC_THEN_PORT_ID } from '../semantics/index.js'
import { RuntimeCalls } from './calls.js'
import { DataEvaluator } from './data-evaluator.js'
import type { RuntimeDebugger } from './debugger.js'
import type { RuntimeDefinitions } from './definitions.js'
import type { RuntimeEventDispatcher } from './events.js'
import type { NodeOutcome, RecordedCall, RunRecorder } from './recorder.js'
import {
  assertRunnable,
  createRootScope,
  createSchedulerContext,
  isRunCancelled,
  type ExecutionScope,
  type RunSession,
} from './run-session.js'
import type {
  NodeEngineRuntimeNodeResult,
  NodeEngineRuntimeOptions,
  NodeEngineRuntimePortValues,
  NodeEngineRuntimeScheduledTask,
  NodeEngineRuntimeScheduler,
} from './types.js'

export interface GraphExecutorDependencies {
  options: Pick<NodeEngineRuntimeOptions, 'maxSteps' | 'maxLoopIterations'>
  definitions: RuntimeDefinitions
  scheduler: NodeEngineRuntimeScheduler
  recorder: RunRecorder
  debugger: RuntimeDebugger
  events: RuntimeEventDispatcher
}

interface NormalizedNodeResult {
  output?: string
  outputs?: string[]
  values: NodeEngineRuntimePortValues
  data: unknown
}

/**
 * The exec flow of a run. A node runs once control reaches it over an exec edge: the debugger may
 * pause it, its data inputs are evaluated, its handler runs, and control continues along the exec
 * outputs the handler selected, or along its `error` output when the handler throws. The nodes
 * behind one output are handed to the scheduler as tasks.
 */
export class GraphExecutor {
  private readonly calls: RuntimeCalls
  private readonly data: DataEvaluator

  constructor(private readonly dependencies: GraphExecutorDependencies) {
    const { definitions, scheduler, recorder, events } = dependencies

    this.calls = new RuntimeCalls({
      definitions,
      recorder,
      debugger: dependencies.debugger,
      events,
      evaluateInputs: (run, scope, node) => this.data.evaluateInputs(run, scope, node),
    })
    this.data = new DataEvaluator({
      definitions,
      scheduler,
      recorder,
      handlerServices: (run, scope, nodeId) => this.calls.createHandlerServices(run, scope, nodeId),
    })
  }

  /** Runs a plan from its entry node and settles the run as success, error, or cancelled. */
  async execute(run: RunSession, entryNode: GraphNode, input: unknown): Promise<void> {
    const { events } = this.dependencies
    events.emit({ type: 'run:start', run })

    try {
      await this.executeNode(run, createRootScope(run), entryNode, input)

      if (run.status !== 'cancelled') {
        run.status = 'success'
        events.emit({ type: 'run:success', run })
      }
    } catch (error) {
      if (isRunCancelled(run)) {
        run.status = 'cancelled'
        events.emitCancel(run)
      } else {
        run.error = error
        run.status = 'error'
        events.emit({ type: 'run:error', run })
      }
    } finally {
      run.dataEvaluations.clear()
    }
  }

  private async executeNode(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    input: unknown,
  ): Promise<void> {
    const { definitions, recorder, events } = this.dependencies
    assertRunnable(run, scope.signal)
    await this.dependencies.debugger.beforeNode(run, node, scope.callStack)
    assertRunnable(run, scope.signal)
    this.guardStep(run, node)

    const definition = definitions.getNodeDefinition(node.type)
    const call = recorder.startNode(run, node, scope.callStack)
    events.emit({ type: 'node:start', run, node, frame: call.frame, trace: call.trace })
    const nodeScope: ExecutionScope = { ...scope, callStack: call.callStack }
    const startedAt = call.trace.startedAt

    try {
      const values = await this.data.evaluateInputs(run, nodeScope, node)
      assertRunnable(run, scope.signal)
      const params = this.data.resolveParams(scope, node, definition, values)
      recorder.recordNodeInputs(call.trace, values)
      const handler = definitions.getHandler(node)

      if (!handler) {
        throw new Error(`Node "${node.id}" of type "${node.type}" does not have a runtime handler.`)
      }

      const result = await handler({
        node,
        definition,
        graph: scope.graph,
        input,
        values,
        params,
        ...this.calls.createHandlerServices(run, nodeScope, node.id),
      })

      assertRunnable(run, scope.signal)
      const normalized = normalizeNodeResult(result)
      this.finishNode(run, node, call, {
        status: 'success',
        inputValues: values,
        values: normalized.values,
        outputSummary: normalized,
        startedAt,
      })

      await this.dependencies.debugger.afterNode(run, node, scope.callStack)

      await this.followExec(
        run,
        scope,
        node,
        normalized.outputs ?? normalized.output,
        normalized.data,
      )
    } catch (error) {
      this.finishNode(run, node, call, {
        status: isRunCancelled(run) ? 'cancelled' : 'error',
        error,
        startedAt,
      })

      if (isRunCancelled(run) || scope.signal.aborted) {
        throw error
      }

      const handled = await this.followExec(run, scope, node, EXEC_ERROR_PORT_ID, error)

      if (!handled) {
        throw error
      }
    }
  }

  private finishNode(
    run: RunSession,
    node: GraphNode,
    call: RecordedCall,
    outcome: NodeOutcome,
  ): void {
    this.dependencies.recorder.finishNode(run, node, call, outcome)
    this.dependencies.events.emit({
      type:
        outcome.status === 'error'
          ? 'node:error'
          : outcome.status === 'cancelled'
            ? 'node:cancel'
            : 'node:success',
      run,
      node,
      frame: call.frame,
      trace: call.trace,
    })
  }

  /** Schedules the nodes behind the exec ports; resolves whether any edge was followed. */
  private async followExec(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    outputPortId: string | string[] | undefined,
    input: unknown,
  ): Promise<boolean> {
    const ports = Array.isArray(outputPortId)
      ? outputPortId
      : outputPortId
        ? [outputPortId]
        : this.resolveDefaultExecOutputs(node)
    let followed = false
    const tasks: Array<NodeEngineRuntimeScheduledTask<void>> = []

    for (const portId of ports) {
      for (const edge of listOutgoingExecEdges(scope.graphIndex, node.id, portId)) {
        const next = scope.graphIndex.nodes.get(edge.target.nodeId)

        if (!next) {
          continue
        }

        followed = true
        tasks.push({
          id: `${edge.id}:${next.id}`,
          label: next.id,
          retryable: this.dependencies.definitions.isNodeRetryable(next),
          run: ({ signal }) =>
            this.executeNode(
              run,
              { ...scope, signal, callStack: [...scope.callStack] },
              next,
              input,
            ),
        })
      }
    }

    await this.dependencies.scheduler.schedule(
      createSchedulerContext(run, scope, 'exec', node),
      tasks,
    )

    return followed
  }

  /** Enforces `maxSteps` per run and `maxLoopIterations` per node. */
  private guardStep(run: RunSession, node: GraphNode): void {
    const { options } = this.dependencies
    run.steps += 1

    if (run.steps > (options.maxSteps ?? 1000)) {
      throw new Error(`Runtime step limit exceeded for run "${run.runId}".`)
    }

    const visits = (run.visits.get(node.id) ?? 0) + 1
    run.visits.set(node.id, visits)

    if (visits > (options.maxLoopIterations ?? 100)) {
      throw new Error(`Runtime loop limit exceeded at node "${node.id}".`)
    }
  }

  /** The `then` exec output, or else the first exec output, when a handler selects none. */
  private resolveDefaultExecOutputs(node: GraphNode): string[] {
    const outputs = this.dependencies.definitions
      .getNodePorts(node)
      .filter((port) => port.direction === 'output' && resolvePortKind(port) === 'exec')
    const then = outputs.find((port) => port.id === EXEC_THEN_PORT_ID)

    return then ? [then.id] : outputs.slice(0, 1).map((port) => port.id)
  }
}

function normalizeNodeResult(result: NodeEngineRuntimeNodeResult | void): NormalizedNodeResult {
  return {
    output: result?.output,
    outputs: result?.outputs,
    values: result?.values ?? {},
    data: result?.data,
  }
}

/** Exec edges leaving the port, in graph order; O(outgoing edges of the port). */
function listOutgoingExecEdges(index: GraphIndex, nodeId: string, portId: string): GraphEdge[] {
  return index.listOutgoingEdges({ nodeId, portId }).filter((edge) => edge.kind === 'exec')
}
