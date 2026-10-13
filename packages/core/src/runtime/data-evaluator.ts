import { resolvePortKind } from '../protocol/index.js'
import type { GraphEdge, GraphIndex, GraphNode, GraphPort } from '../protocol/index.js'
import { SUBGRAPH_INPUT_NODE_TYPE } from '../semantics/index.js'
import type { SemanticNodeDefinition } from '../semantics/index.js'
import type { HandlerServices } from './calls.js'
import type { RuntimeDefinitions } from './definitions.js'
import {
  readStoredPortValue,
  readSubgraphInputValues,
  resolveNodeParameterValues,
} from './node-values.js'
import type { RunRecorder } from './recorder.js'
import {
  assertRunnable,
  createSchedulerContext,
  isRunCancelled,
  type ExecutionScope,
  type RunSession,
} from './run-session.js'
import type {
  NodeEngineRuntimePortValues,
  NodeEngineRuntimeScheduledTask,
  NodeEngineRuntimeScheduler,
} from './types.js'

export interface DataEvaluatorDependencies {
  definitions: RuntimeDefinitions
  scheduler: NodeEngineRuntimeScheduler
  recorder: RunRecorder
  handlerServices: (run: RunSession, scope: ExecutionScope, nodeId: string) => HandlerServices
}

/**
 * Pull-based evaluation of data inputs. An input reads the output of the node connected to it,
 * evaluating that node first, or else the value stored on its own node. Concurrent readers share
 * one in-flight evaluation per node, and pure or cacheable nodes are evaluated once per scope.
 */
export class DataEvaluator {
  constructor(private readonly dependencies: DataEvaluatorDependencies) {}

  /** Values of the node's data input ports, scheduled as one task per port. */
  async evaluateInputs(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    visiting: ReadonlySet<string> = new Set(),
  ): Promise<NodeEngineRuntimePortValues> {
    const { definitions, scheduler } = this.dependencies
    const values: NodeEngineRuntimePortValues = {}
    const ports = definitions
      .getNodePorts(node)
      .filter((port) => port.direction === 'input' && resolvePortKind(port) === 'data')
    const tasks = ports.map((port): NodeEngineRuntimeScheduledTask => {
      const edge = findIncomingDataEdge(scope.graphIndex, node.id, port.id)
      const source = edge ? scope.graphIndex.nodes.get(edge.source.nodeId) : undefined

      return {
        id: `${node.id}:${port.id}`,
        label: port.id,
        retryable: source ? definitions.isNodeRetryable(source) : true,
        run: ({ signal }) =>
          this.readInput(
            run,
            { ...scope, signal, callStack: [...scope.callStack] },
            node,
            port,
            visiting,
          ),
      }
    })
    const resolved = await scheduler.schedule(
      createSchedulerContext(run, scope, 'data', node),
      tasks,
    )

    for (const [index, port] of ports.entries()) {
      values[port.id] = resolved[index]
    }

    return values
  }

  /** Handler params of a node whose input values are known. */
  resolveParams(
    scope: ExecutionScope,
    node: GraphNode,
    definition: SemanticNodeDefinition | undefined,
    values: NodeEngineRuntimePortValues,
  ): NodeEngineRuntimePortValues {
    return resolveNodeParameterValues(
      node,
      definition,
      values,
      (portId) => findIncomingDataEdge(scope.graphIndex, node.id, portId) !== undefined,
    )
  }

  private async readInput(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    port: GraphPort,
    visiting: ReadonlySet<string>,
  ): Promise<unknown> {
    const edge = findIncomingDataEdge(scope.graphIndex, node.id, port.id)

    if (!edge) {
      return readStoredPortValue(node, port)
    }

    const sourceNode = scope.graphIndex.nodes.get(edge.source.nodeId)

    if (!sourceNode) {
      throw new Error(`Data source node "${edge.source.nodeId}" was not found.`)
    }

    const values = await this.evaluateNode(run, scope, sourceNode, visiting)

    if (!Object.prototype.hasOwnProperty.call(values, edge.source.portId)) {
      throw new Error(
        `Data node "${sourceNode.id}" did not produce output "${edge.source.portId}".`,
      )
    }

    return values[edge.source.portId]
  }

  /**
   * Output values of a data node. A failed evaluation is never cached; a successful one stays
   * cached for the scope only when the node is cacheable.
   */
  private async evaluateNode(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    visiting: ReadonlySet<string>,
  ): Promise<NodeEngineRuntimePortValues> {
    if (visiting.has(node.id)) {
      throw new Error(`Runtime data dependency cycle reached node "${node.id}".`)
    }

    const existing = scope.dataEvaluations.get(node.id)

    if (existing) {
      return existing
    }

    const nextVisiting = new Set(visiting)
    nextVisiting.add(node.id)
    const evaluation = this.runNode(run, scope, node, nextVisiting)
    scope.dataEvaluations.set(node.id, evaluation)

    try {
      return await evaluation
    } catch (error) {
      if (scope.dataEvaluations.get(node.id) === evaluation) {
        scope.dataEvaluations.delete(node.id)
      }
      throw error
    } finally {
      if (
        !this.dependencies.definitions.isDataCacheable(node) &&
        scope.dataEvaluations.get(node.id) === evaluation
      ) {
        scope.dataEvaluations.delete(node.id)
      }
    }
  }

  private async runNode(
    run: RunSession,
    scope: ExecutionScope,
    node: GraphNode,
    visiting: ReadonlySet<string>,
  ): Promise<NodeEngineRuntimePortValues> {
    const { definitions, recorder } = this.dependencies
    assertRunnable(run, scope.signal)
    const definition = definitions.getNodeDefinition(node.type)

    if (node.type === SUBGRAPH_INPUT_NODE_TYPE) {
      return readSubgraphInputValues(definitions.getNodePorts(node), scope.subgraphInputs)
    }

    const values = await this.evaluateInputs(run, scope, node, visiting)
    assertRunnable(run, scope.signal)
    const params = this.resolveParams(scope, node, definition, values)
    const handler = definitions.getHandler(node)
    const startedAt = Date.now()

    if (!handler) {
      throw new Error(`Node "${node.id}" of type "${node.type}" does not have a runtime handler.`)
    }

    const services = this.dependencies.handlerServices(run, scope, node.id)

    try {
      const result = await handler({
        node,
        definition,
        graph: scope.graph,
        input: undefined,
        values,
        params,
        ...services,
      })
      assertRunnable(run, scope.signal)
      const outputValues = result?.values ?? {}

      recorder.recordDataEvaluation(run, node, startedAt, {
        status: 'success',
        values: outputValues,
        inputValues: values,
        callStack: scope.callStack,
      })

      return outputValues
    } catch (error) {
      recorder.recordDataEvaluation(run, node, startedAt, {
        status: isRunCancelled(run) ? 'cancelled' : 'error',
        inputValues: values,
        callStack: scope.callStack,
        error,
      })
      throw error
    }
  }
}

/** First data edge into the port, in graph order; O(incoming edges of the port). */
function findIncomingDataEdge(
  index: GraphIndex,
  nodeId: string,
  portId: string,
): GraphEdge | undefined {
  return index.listIncomingEdges({ nodeId, portId }).find((edge) => edge.kind === 'data')
}
