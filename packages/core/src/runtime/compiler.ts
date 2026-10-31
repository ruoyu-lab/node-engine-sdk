import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  createGraphValidationResult,
  cloneGraph,
  resolvePortKind,
  validateGraph,
  type GraphDiagnostic,
  type GraphNode,
  type GraphSnapshot,
  type NodeWrightCompileResult,
} from '../protocol/index.js'
import {
  hasNodeCapability,
  validateFunctionSignature,
  validateSubgraphSignature,
  type SemanticNodeDefinition,
} from '../semantics/index.js'
import type { NodeWrightCompileOptions, NodeWrightRuntimeNodeDefinition } from './types.js'

export function compileGraph(options: NodeWrightCompileOptions): NodeWrightCompileResult {
  const graph = cloneGraph(options.graph)
  const definitions = options.definitions ?? []
  const runtimeDefinitions = new Map(
    (options.runtimeDefinitions ?? []).map((definition) => [definition.type, definition]),
  )
  const diagnostics: GraphDiagnostic[] = [
    ...(options.diagnostics ?? []),
    ...validateGraph(graph, { nodeDefinitions: definitions }).diagnostics,
    ...(options.functionDefinitions ?? []).flatMap((definition, index) =>
      validateFunctionSignature(definition, `functionDefinitions.${index}`),
    ),
    ...(options.subgraphDefinitions ?? []).flatMap((definition, index) =>
      validateSubgraphSignature(definition, `subgraphDefinitions.${index}`),
    ),
  ]
  const dataCycleNodeId = findDataCycleNodeId(graph)

  if (dataCycleNodeId) {
    diagnostics.push({
      code: 'RUNTIME_DATA_CYCLE',
      severity: 'error',
      message: `Runtime data dependencies contain a cycle at node "${dataCycleNodeId}".`,
      source: 'runtime:compile',
      nodeId: dataCycleNodeId,
    })
  }

  const entry = resolveEntryNode(
    graph,
    options.entryNodeId,
    (type) => options.getNodeDefinition?.(type) ?? definitions.find((entry) => entry.type === type),
  )

  if (!entry) {
    diagnostics.push({
      code: 'RUNTIME_ENTRY_NODE_MISSING',
      severity: 'error',
      message: options.entryNodeId
        ? `Runtime entry node "${options.entryNodeId}" was not found.`
        : 'Runtime entry node was not found.',
      source: 'runtime:compile',
      nodeId: options.entryNodeId,
    })
  }

  for (const [index, node] of graph.nodes.entries()) {
    const runtimeDefinition = runtimeDefinitions.get(node.type)
    const handler = options.handlers?.[node.type] ?? runtimeDefinition?.handler

    if (!handler && shouldRequireRuntimeHandler(node, runtimeDefinition)) {
      diagnostics.push({
        code: 'RUNTIME_HANDLER_MISSING',
        severity: 'error',
        message: `Node "${node.id}" of type "${node.type}" does not have a runtime handler.`,
        source: 'runtime:compile',
        nodeId: node.id,
        path: `nodes.${index}.type`,
      })
    }
  }

  const validation = createGraphValidationResult(diagnostics)

  if (!validation.valid || !entry) {
    return {
      valid: false,
      diagnostics,
    }
  }

  return {
    valid: true,
    diagnostics,
    plan: {
      id: `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
      graph,
      entryNodeId: entry.id,
      nodeOrder: resolveExecutionOrder(graph, entry),
      diagnostics,
    },
  }
}

function resolveEntryNode(
  graph: GraphSnapshot,
  entryNodeId: string | undefined,
  getDefinition: (type: string) => SemanticNodeDefinition | undefined,
): GraphNode | undefined {
  if (entryNodeId) {
    return graph.nodes.find((node) => node.id === entryNodeId)
  }

  return graph.nodes.find((node) => hasNodeCapability(getDefinition(node.type), 'event'))
}

function shouldRequireRuntimeHandler(
  node: GraphNode,
  definition: NodeWrightRuntimeNodeDefinition | undefined,
): boolean {
  if (definition?.handler) {
    return false
  }

  return node.type !== 'subgraph:input' && node.type !== 'subgraph:output'
}

function resolveExecutionOrder(graph: GraphSnapshot, entry: GraphNode): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const dataDependencies = new Map<string, GraphNode[]>()
  const execFollowers = new Map<string, GraphNode[]>()
  const execOutputIds = new Map(
    graph.nodes.map((node) => [
      node.id,
      new Set(
        (node.ports ?? [])
          .filter((port) => port.direction === 'output' && resolvePortKind(port) === 'exec')
          .map((port) => port.id),
      ),
    ]),
  )

  for (const edge of graph.edges) {
    const source = nodesById.get(edge.source.nodeId)
    const target = nodesById.get(edge.target.nodeId)

    if (!source || !target) {
      continue
    }

    if (edge.kind === 'data') {
      appendNode(dataDependencies, target.id, source)
      continue
    }

    if (edge.kind === 'exec') {
      const outputIds = execOutputIds.get(source.id)

      if (!outputIds) {
        throw new Error(`Execution output registry is missing node "${source.id}".`)
      }

      if (!outputIds.size || outputIds.has(edge.source.portId)) {
        appendNode(execFollowers, source.id, target)
      }
    }
  }

  const stack: Array<{ node: GraphNode; phase: 'enter' | 'emit' }> = [
    { node: entry, phase: 'enter' },
  ]

  while (stack.length) {
    const frame = stack.pop()

    if (!frame) {
      break
    }

    if (frame.phase === 'emit') {
      order.push(frame.node.id)
      pushUnvisited(stack, execFollowers.get(frame.node.id) ?? [], visited)
      continue
    }

    if (visited.has(frame.node.id)) {
      continue
    }

    visited.add(frame.node.id)
    stack.push({ node: frame.node, phase: 'emit' })
    pushUnvisited(stack, dataDependencies.get(frame.node.id) ?? [], visited)
  }

  return order
}

function appendNode(entries: Map<string, GraphNode[]>, nodeId: string, node: GraphNode): void {
  const nodes = entries.get(nodeId)

  if (nodes) {
    nodes.push(node)
  } else {
    entries.set(nodeId, [node])
  }
}

function pushUnvisited(
  stack: Array<{ node: GraphNode; phase: 'enter' | 'emit' }>,
  nodes: GraphNode[],
  visited: Set<string>,
): void {
  for (const node of nodes.slice().reverse()) {
    if (!visited.has(node.id)) {
      stack.push({ node, phase: 'enter' })
    }
  }
}

function findDataCycleNodeId(graph: GraphSnapshot): string | undefined {
  const indegrees = new Map(graph.nodes.map((node) => [node.id, 0]))
  const followers = new Map<string, string[]>()

  for (const edge of graph.edges) {
    if (
      edge.kind !== 'data' ||
      !indegrees.has(edge.source.nodeId) ||
      !indegrees.has(edge.target.nodeId)
    ) {
      continue
    }

    const targetIndegree = indegrees.get(edge.target.nodeId)

    if (targetIndegree === undefined) {
      throw new Error(`Runtime data dependency registry is missing node "${edge.target.nodeId}".`)
    }

    indegrees.set(edge.target.nodeId, targetIndegree + 1)
    const targets = followers.get(edge.source.nodeId)

    if (targets) {
      targets.push(edge.target.nodeId)
    } else {
      followers.set(edge.source.nodeId, [edge.target.nodeId])
    }
  }

  const queue = [...indegrees].filter(([, indegree]) => indegree === 0).map(([nodeId]) => nodeId)
  let nextIndex = 0

  while (nextIndex < queue.length) {
    const nodeId = queue[nextIndex]
    nextIndex += 1

    if (nodeId === undefined) {
      throw new Error('Runtime data dependency queue is inconsistent.')
    }

    for (const targetId of followers.get(nodeId) ?? []) {
      const targetIndegree = indegrees.get(targetId)

      if (targetIndegree === undefined) {
        throw new Error(`Runtime data dependency registry is missing node "${targetId}".`)
      }

      const indegree = targetIndegree - 1
      indegrees.set(targetId, indegree)

      if (indegree === 0) {
        queue.push(targetId)
      }
    }
  }

  for (const [nodeId, indegree] of indegrees) {
    if (indegree > 0) {
      return nodeId
    }
  }

  return undefined
}
