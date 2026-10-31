import { GraphIndex, cloneValue } from '../protocol/index.js'
import type { GraphNode, GraphSnapshot } from '../protocol/index.js'
import {
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createFunctionReference,
  createSubgraphReference,
} from '../semantics/index.js'
import type {
  FunctionDefinition,
  FunctionReferenceInput,
  SubgraphDefinition,
  SubgraphReferenceInput,
} from '../semantics/index.js'
import type { RuntimeDebugger } from './debugger.js'
import type { RuntimeDefinitions } from './definitions.js'
import type { RuntimeEventDispatcher } from './events.js'
import type { RunRecorder } from './recorder.js'
import { assertRunnable, type ExecutionScope, type RunSession } from './run-session.js'
import { cloneRuntimeValue, deepFreeze } from './snapshot.js'
import type {
  NodeWrightRuntimeCallFrame,
  NodeWrightRuntimeFunctionResult,
  NodeWrightRuntimeNodeContext,
  NodeWrightRuntimePortValues,
  NodeWrightRuntimeSubgraphDefinition,
  NodeWrightRuntimeSubgraphResult,
} from './types.js'
import { createRuntimeVariableApi } from './variables.js'

/** The part of a handler context that node and function handlers share. */
export type HandlerServices = Pick<
  NodeWrightRuntimeNodeContext,
  | 'variables'
  | 'variable'
  | 'getVariable'
  | 'setVariable'
  | 'callFunction'
  | 'callSubgraph'
  | 'callStack'
  | 'runId'
  | 'signal'
>

export interface RuntimeCallsDependencies {
  definitions: RuntimeDefinitions
  recorder: RunRecorder
  debugger: RuntimeDebugger
  events: RuntimeEventDispatcher
  /** Evaluates the data inputs of a node; a subgraph call evaluates its output boundary node. */
  evaluateInputs: (
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
  ) => Promise<NodeWrightRuntimePortValues>
}

type CallTarget =
  | { kind: 'function'; functionDefinition: FunctionDefinition }
  | { kind: 'subgraph'; subgraphDefinition: SubgraphDefinition }

/**
 * Function and subgraph calls made by handlers. Each call runs in its own call frame and trace
 * entry, emits start and success or error events, and can stop at a breakpoint.
 */
export class RuntimeCalls {
  constructor(private readonly dependencies: RuntimeCallsDependencies) {}

  /** Variables, call helpers, and call stack for a handler running in `scope`. */
  createHandlerServices(run: RunSession, scope: ExecutionScope, nodeId?: string): HandlerServices {
    const variable = createRuntimeVariableApi(run.variables, { nodeId })

    return {
      variables: run.variables,
      variable,
      getVariable: variable.get,
      setVariable: variable.set,
      callFunction: (reference, values) => this.callFunction(run, scope, reference, values),
      callSubgraph: (reference, values) => this.callSubgraph(run, scope, reference, values),
      callStack: cloneRuntimeValue(scope.callStack),
      runId: run.runId,
      signal: scope.signal,
    }
  }

  private async callFunction(
    run: RunSession,
    scope: ExecutionScope,
    reference: FunctionReferenceInput,
    values: NodeWrightRuntimePortValues = {},
  ): Promise<NodeWrightRuntimeFunctionResult> {
    const { definitions } = this.dependencies
    const resolved = createFunctionReference(reference)
    const definition = definitions.getFunction(resolved.id)
    const handler = definitions.getFunctionHandler(resolved.id)

    if (!handler && definition?.mode === 'subgraph') {
      return this.callSubgraph(
        run,
        scope,
        readStringValue(definition.meta?.subgraphId) ?? definition.id,
        values,
      )
    }

    if (!handler) {
      throw new Error(`Function "${resolved.id}" does not have a runtime handler.`)
    }

    const functionDefinition = definition ?? { id: resolved.id }

    return this.runInFrame(
      run,
      scope,
      { target: { kind: 'function', functionDefinition }, id: resolved.id, inputValues: values },
      async (callStack) => {
        const result = await handler({
          functionDefinition,
          graph: scope.graph,
          values,
          ...this.createHandlerServices(run, { ...scope, callStack }),
        })
        const outputValues = result?.values ?? {}

        return { result: { values: outputValues, data: result?.data }, outputValues }
      },
    )
  }

  private async callSubgraph(
    run: RunSession,
    scope: ExecutionScope,
    reference: SubgraphReferenceInput,
    values: NodeWrightRuntimePortValues = {},
  ): Promise<NodeWrightRuntimeSubgraphResult> {
    const resolved = createSubgraphReference(reference)
    const definition = this.dependencies.definitions.getSubgraph(resolved.id)

    if (!definition) {
      throw new Error(`Subgraph "${resolved.id}" was not found.`)
    }

    const graph = deepFreeze(cloneValue(definition.graph))
    const outputNode = resolveSubgraphOutputNode(graph, definition)

    if (!outputNode) {
      throw new Error(`Subgraph "${resolved.id}" does not have an output boundary node.`)
    }

    return this.runInFrame(
      run,
      scope,
      {
        target: { kind: 'subgraph', subgraphDefinition: definition },
        id: resolved.id,
        inputValues: values,
      },
      async (callStack) => {
        const subgraphScope: ExecutionScope = {
          graph,
          graphIndex: new GraphIndex(graph),
          dataEvaluations: new Map(),
          signal: scope.signal,
          callStack,
          subgraphInputs: values,
        }

        try {
          const outputValues = await this.dependencies.evaluateInputs(
            run,
            subgraphScope,
            outputNode,
          )

          return { result: { values: outputValues, data: outputValues }, outputValues }
        } finally {
          subgraphScope.dataEvaluations.clear()
        }
      },
    )
  }

  /**
   * Runs `body` inside a new call frame of `target`, recording its trace entry and emitting its
   * start and completion events. The call stack passed to `body` ends with the new frame.
   */
  private async runInFrame<T>(
    run: RunSession,
    scope: ExecutionScope,
    call: { target: CallTarget; id: string; inputValues: NodeWrightRuntimePortValues },
    body: (
      callStack: NodeWrightRuntimeCallFrame[],
    ) => Promise<{ result: T; outputValues: NodeWrightRuntimePortValues }>,
  ): Promise<T> {
    const { recorder, events } = this.dependencies
    const { kind, ...definition } = call.target
    const recorded = recorder.startCall(run, scope.callStack, {
      kind,
      id: call.id,
      inputValues: call.inputValues,
    })
    const { frame, trace } = recorded

    events.emit({ type: `${kind}:start`, run, ...definition, frame, trace })

    try {
      await this.dependencies.debugger.beforeCall(run, { ...definition, frame }, recorded.callStack)

      const { result, outputValues } = await body(recorded.callStack)
      assertRunnable(run, scope.signal)

      recorder.finishCall(recorded, 'success', outputValues)
      events.emit({ type: `${kind}:success`, run, ...definition, frame, trace })

      return result
    } catch (error) {
      recorder.finishCall(recorded, 'error', undefined, error)
      events.emit({ type: `${kind}:error`, run, ...definition, frame, trace })
      throw error
    }
  }
}

function resolveSubgraphOutputNode(
  graph: GraphSnapshot,
  definition: NodeWrightRuntimeSubgraphDefinition,
): GraphNode | undefined {
  return (
    (definition.outputNodeId
      ? graph.nodes.find((node) => node.id === definition.outputNodeId)
      : undefined) ?? graph.nodes.find((node) => node.type === SUBGRAPH_OUTPUT_NODE_TYPE)
  )
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
