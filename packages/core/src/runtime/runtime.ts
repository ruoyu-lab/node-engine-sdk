import { cloneValue } from '../protocol/index.js'
import type { GraphSnapshot, NodeWrightExecutionPlan } from '../protocol/index.js'
import { compileGraph } from './compiler.js'
import { RuntimeDebugger } from './debugger.js'
import { RuntimeDefinitions } from './definitions.js'
import { RuntimeEventDispatcher } from './events.js'
import { GraphExecutor } from './executor.js'
import { RunRecorder } from './recorder.js'
import { createRunSession, toRunResult, type RunSession } from './run-session.js'
import { createSequentialScheduler } from './scheduler.js'
import { deepFreeze } from './snapshot.js'
import type {
  NodeWrightBreakpoint,
  NodeWrightRunResult,
  NodeWrightRuntimeOptions,
} from './types.js'

/**
 * Compiles graphs into execution plans and runs them. Each `run()` executes a frozen copy of its
 * plan's graph; active runs can be paused, stepped, resumed, and cancelled by id. The runtime
 * wires its collaborators together: definitions, the executor, the run recorder, the debugger,
 * and event delivery.
 */
export class NodeWrightRuntime {
  private readonly options: NodeWrightRuntimeOptions
  private readonly definitions: RuntimeDefinitions
  private readonly debugger: RuntimeDebugger
  private readonly executor: GraphExecutor
  private readonly runs = new Map<string, RunSession>()

  constructor(options: NodeWrightRuntimeOptions) {
    const events = new RuntimeEventDispatcher(options)

    this.options = options
    this.definitions = new RuntimeDefinitions(options)
    this.debugger = new RuntimeDebugger(events)
    this.executor = new GraphExecutor({
      options,
      definitions: this.definitions,
      scheduler: options.scheduler ?? createSequentialScheduler(),
      recorder: new RunRecorder(options),
      debugger: this.debugger,
      events,
    })
  }

  compile(entryNodeId?: string, graph = this.getGraph()): ReturnType<typeof compileGraph> {
    return compileGraph({ graph, entryNodeId, ...this.definitions.compileOptions() })
  }

  async run(plan: NodeWrightExecutionPlan, input?: unknown): Promise<NodeWrightRunResult> {
    const graph = deepFreeze(cloneValue(plan.graph))
    const entryNode = graph.nodes.find((node) => node.id === plan.entryNodeId)

    if (!entryNode) {
      throw new Error(`Execution plan entry node "${plan.entryNodeId}" was not found.`)
    }

    const run = createRunSession(graph, this.options.initialVariables)
    this.runs.set(run.runId, run)

    try {
      await this.executor.execute(run, entryNode, input)
    } finally {
      this.runs.delete(run.runId)
    }

    return toRunResult(run)
  }

  pause(runId: string): void {
    this.debugger.pause(this.ensureRun(runId))
  }

  resume(runId: string): void {
    this.debugger.resume(this.ensureRun(runId))
  }

  async step(runId: string): Promise<void> {
    await this.stepInto(runId)
  }

  async stepInto(runId: string): Promise<void> {
    this.debugger.step(this.ensureRun(runId), 'into')
  }

  async stepOver(runId: string): Promise<void> {
    this.debugger.step(this.ensureRun(runId), 'over')
  }

  async stepOut(runId: string): Promise<void> {
    this.debugger.step(this.ensureRun(runId), 'out')
  }

  cancel(runId: string): void {
    this.debugger.cancel(this.ensureRun(runId))
  }

  setBreakpoint(target: NodeWrightBreakpoint): void {
    this.debugger.setBreakpoint(target)
  }

  clearBreakpoint(id: string): void {
    this.debugger.clearBreakpoint(id)
  }

  getRun(runId: string): NodeWrightRunResult | undefined {
    const run = this.runs.get(runId)

    return run ? toRunResult(run) : undefined
  }

  private getGraph(): GraphSnapshot {
    if (!this.options.graph) {
      throw new Error(
        'Runtime graph is required for compile(). Pass a graph to compile or the runtime constructor.',
      )
    }

    return cloneValue(
      typeof this.options.graph === 'function' ? this.options.graph() : this.options.graph,
    )
  }

  private ensureRun(runId: string): RunSession {
    const run = this.runs.get(runId)

    if (!run) {
      throw new Error(`Run "${runId}" was not found.`)
    }

    return run
  }
}
