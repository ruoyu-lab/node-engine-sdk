import { toRunResult, type RunSession } from './run-session.js'
import { cloneRuntimeValue, deepFreeze } from './snapshot.js'
import type { NodeWrightRuntimeEvent, NodeWrightRuntimeOptions } from './types.js'

/** A runtime event about a live run, before it is copied for listeners. */
export type RunEvent = NodeWrightRuntimeEvent & { run: RunSession }

/**
 * Delivers runtime events to `options.onEvent`. Listeners receive frozen copies, and a listener
 * that throws is recorded in the run's `listenerErrors` instead of failing the run.
 */
export class RuntimeEventDispatcher {
  constructor(private readonly options: Pick<NodeWrightRuntimeOptions, 'onEvent'>) {}

  emit(event: RunEvent): void {
    if (!this.options.onEvent) {
      return
    }

    const publicEvent: NodeWrightRuntimeEvent = {
      type: event.type,
      run: {
        ...toRunResult(event.run),
        currentNodeId: event.run.currentNodeId,
      },
      node: event.node ? cloneRuntimeValue(event.node) : undefined,
      functionDefinition: event.functionDefinition
        ? cloneRuntimeValue(stripHandler(event.functionDefinition))
        : undefined,
      subgraphDefinition: event.subgraphDefinition
        ? cloneRuntimeValue(event.subgraphDefinition)
        : undefined,
      frame: event.frame ? cloneRuntimeValue(event.frame) : undefined,
      trace: event.trace ? cloneRuntimeValue(event.trace) : undefined,
    }

    try {
      this.options.onEvent(deepFreeze(publicEvent))
    } catch (error) {
      event.run.listenerErrors.push(error)
    }
  }

  /** Emits `run:cancel` at most once per run. */
  emitCancel(run: RunSession): void {
    if (run.cancelEmitted) {
      return
    }

    run.cancelEmitted = true
    this.emit({ type: 'run:cancel', run })
  }
}

function stripHandler<T extends object>(definition: T): Omit<T, 'handler'> {
  const { handler: _handler, ...publicDefinition } = definition as T & {
    handler?: unknown
  }
  return publicDefinition
}
