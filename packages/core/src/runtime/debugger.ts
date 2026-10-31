import type { GraphNode } from '../protocol/index.js'
import type { FunctionDefinition, SubgraphDefinition } from '../semantics/index.js'
import type { RuntimeEventDispatcher } from './events.js'
import { toRunResult, type RunPauseMode, type RunSession } from './run-session.js'
import type {
  NodeWrightBreakpoint,
  NodeWrightRuntimeCallFrame,
  NodeWrightRuntimeStepMode,
} from './types.js'

/** What a breakpoint is matched against. */
export interface BreakpointTarget {
  node?: GraphNode
  functionDefinition?: FunctionDefinition
  subgraphDefinition?: SubgraphDefinition
  frame?: NodeWrightRuntimeCallFrame
}

/**
 * Breakpoints and run control: pausing, resuming, stepping, and cancelling active runs. The
 * executor calls the `before*` and `after*` hooks at every node and call boundary; a paused run
 * waits inside the hook until it is resumed, stepped, or cancelled.
 */
export class RuntimeDebugger {
  private readonly breakpoints = new Map<string, NodeWrightBreakpoint>()

  constructor(private readonly events: RuntimeEventDispatcher) {}

  setBreakpoint(target: NodeWrightBreakpoint): void {
    const id = target.id ?? target.nodeId ?? target.functionId ?? target.subgraphId

    if (!id) {
      throw new Error('Breakpoint requires nodeId, functionId, subgraphId, or id.')
    }

    this.breakpoints.set(id, { ...target, id })
  }

  clearBreakpoint(id: string): void {
    this.breakpoints.delete(id)
  }

  pause(run: RunSession): void {
    run.pauseMode = 'manual'
    run.status = 'paused'
    this.events.emit({ type: 'run:pause', run })
  }

  resume(run: RunSession): void {
    run.pauseMode = undefined
    run.stepMode = undefined
    run.stepTargetDepth = undefined
    run.status = 'running'
    run.stepRequested = false
    run.resume?.()
    this.events.emit({ type: 'run:resume', run })
  }

  /**
   * Resumes a run until the next step boundary: the next node (`into`), the next node at the
   * paused depth or above (`over`), or the next node above the paused depth (`out`).
   */
  step(run: RunSession, mode: NodeWrightRuntimeStepMode): void {
    run.stepRequested = true
    run.stepMode = mode
    run.stepTargetDepth =
      mode === 'over'
        ? run.pausedCallStack.length
        : mode === 'out'
          ? Math.max(0, run.pausedCallStack.length - 1)
          : undefined
    run.pauseMode = 'step'
    run.status = 'running'
    run.resume?.()
    this.events.emit({ type: 'run:step', run })
  }

  cancel(run: RunSession): void {
    run.status = 'cancelled'
    run.controller.abort(new Error(`Run "${run.runId}" was cancelled.`))
    run.resume?.()
    this.events.emitCancel(run)
  }

  /** Pauses before a node runs when the run was paused manually or a breakpoint matches. */
  async beforeNode(
    run: RunSession,
    node: GraphNode,
    callStack: NodeWrightRuntimeCallFrame[],
  ): Promise<void> {
    const shouldPause = run.pauseMode === 'manual' || (await this.matchesBreakpoint(run, { node }))

    if (!shouldPause) {
      return
    }

    await this.pauseRun(run, {
      node,
      reason: run.pauseMode ?? 'breakpoint',
      callStack,
    })
  }

  /** Pauses after a node completed when a pending step ends at its depth. */
  async afterNode(
    run: RunSession,
    node: GraphNode,
    callStack: NodeWrightRuntimeCallFrame[],
  ): Promise<void> {
    if (!run.stepRequested || run.status === 'cancelled') {
      return
    }

    const shouldPause =
      run.stepMode === 'into' ||
      (run.stepMode === 'over' && callStack.length <= (run.stepTargetDepth ?? 0)) ||
      (run.stepMode === 'out' && callStack.length <= (run.stepTargetDepth ?? 0))

    if (!shouldPause) {
      return
    }

    run.stepRequested = false
    await this.pauseRun(run, { node, reason: 'step', callStack })
  }

  /** Pauses at the start of a function or subgraph call when a breakpoint matches it. */
  async beforeCall(
    run: RunSession,
    target: BreakpointTarget,
    callStack: NodeWrightRuntimeCallFrame[],
  ): Promise<void> {
    if (await this.matchesBreakpoint(run, target)) {
      await this.pauseRun(run, { reason: 'breakpoint', callStack })
    }
  }

  private async matchesBreakpoint(run: RunSession, target: BreakpointTarget): Promise<boolean> {
    for (const breakpoint of this.breakpoints.values()) {
      if (breakpoint.enabled === false) {
        continue
      }

      const matches =
        (breakpoint.nodeId && breakpoint.nodeId === target.node?.id) ||
        (breakpoint.functionId && breakpoint.functionId === target.functionDefinition?.id) ||
        (breakpoint.subgraphId && breakpoint.subgraphId === target.subgraphDefinition?.id)

      if (!matches) {
        continue
      }

      if (!breakpoint.condition) {
        return true
      }

      if (
        await breakpoint.condition({
          run: toRunResult(run),
          node: target.node,
          functionDefinition: target.functionDefinition,
          subgraphDefinition: target.subgraphDefinition,
          frame: target.frame,
        })
      ) {
        return true
      }
    }

    return false
  }

  private async pauseRun(
    run: RunSession,
    pause: {
      node?: GraphNode
      reason: RunPauseMode
      callStack: NodeWrightRuntimeCallFrame[]
    },
  ): Promise<void> {
    run.status = 'paused'
    run.currentNodeId = pause.node?.id
    run.pauseMode = pause.reason
    run.pausedCallStack = [...pause.callStack]
    this.events.emit({ type: 'run:pause', run, node: pause.node })

    await new Promise<void>((resolve) => {
      run.resume = resolve
    })

    run.resume = undefined

    if (!run.controller.signal.aborted) {
      run.status = 'running'
    }
  }
}
