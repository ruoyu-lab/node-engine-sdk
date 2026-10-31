import type { GraphPort } from '@node-wright/core/protocol'
import type {
  NodeWrightRuntimeNodeDefinition,
  NodeWrightRuntimeNodeHandler,
} from '@node-wright/core/runtime'
import {
  EXEC_THEN_PORT_ID,
  VARIABLE_SCOPE_RUN,
  createVariableReference,
  normalizeVariableScope,
  type VariableReference,
} from '@node-wright/core/semantics'
import {
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
} from './definitions.js'

export const execflowRuntimeHandlers: Record<string, NodeWrightRuntimeNodeHandler> = {
  [EXEC_EVENT_NODE_TYPE]: () => ({ output: EXEC_THEN_PORT_ID }),
  [EXEC_SEQUENCE_NODE_TYPE]: ({ node, definition }) => ({
    outputs: getExecOutputPortIds(node.ports?.length ? node.ports : definition?.ports),
  }),
  [EXEC_BRANCH_NODE_TYPE]: ({ values }) => ({
    output: values.condition === false ? 'false' : 'true',
  }),
  [EXEC_DELAY_NODE_TYPE]: async ({ params, signal }) => {
    await delay(resolveDuration(params.durationMs), signal)

    return { output: EXEC_THEN_PORT_ID }
  },
  [EXEC_LOG_NODE_TYPE]: ({ params }) => ({
    output: EXEC_THEN_PORT_ID,
    data: params.message,
  }),
  [EXEC_SET_VARIABLE_NODE_TYPE]: ({ params, values, setVariable }) => {
    const reference = resolveVariableReference(params.name, params.scope)
    setVariable(reference, values.value)

    return {
      output: EXEC_THEN_PORT_ID,
      data: {
        name: reference.name,
        scope: reference.scope,
        value: values.value,
      },
    }
  },
  [EXEC_GET_VARIABLE_NODE_TYPE]: ({ params, getVariable }) => {
    const reference = resolveVariableReference(params.name, params.scope)

    return {
      values: {
        value: getVariable(reference),
      },
    }
  },
}

export const execflowRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[] = Object.entries(
  execflowRuntimeHandlers,
).map(([type, handler]) => ({
  type,
  handler,
  cacheable: type !== EXEC_GET_VARIABLE_NODE_TYPE,
}))

function getExecOutputPortIds(ports: GraphPort[] | undefined): string[] {
  return (ports ?? [])
    .filter((port) => port.direction === 'output' && port.kind === 'exec')
    .map((port) => port.id)
}

/**
 * `params` holds each parameter's effective value: the upstream value while its input port is
 * connected, otherwise the node's local value.
 */
function resolveDuration(value: unknown): number {
  const duration = Number(value)

  return Number.isFinite(duration) ? Math.max(0, duration) : 0
}

function resolveVariableReference(name: unknown, scope: unknown): VariableReference {
  return createVariableReference({
    name: typeof name === 'string' && name.trim() ? name : 'value',
    scope: normalizeVariableScope(scope, VARIABLE_SCOPE_RUN),
  })
}

function delay(durationMs: number, signal: AbortSignal): Promise<void> {
  if (durationMs <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, durationMs)

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(new Error('Delay was cancelled.'))
      },
      { once: true },
    )
  })
}
