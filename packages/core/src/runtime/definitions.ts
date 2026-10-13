import { resolveNodePorts } from '../protocol/index.js'
import type { GraphNode, GraphPort } from '../protocol/index.js'
import { hasNodeCapability } from '../semantics/index.js'
import type { SemanticNodeDefinition } from '../semantics/index.js'
import type {
  NodeEngineCompileOptions,
  NodeEngineRuntimeFunctionDefinition,
  NodeEngineRuntimeFunctionHandler,
  NodeEngineRuntimeNodeDefinition,
  NodeEngineRuntimeNodeHandler,
  NodeEngineRuntimeOptions,
  NodeEngineRuntimeSubgraphDefinition,
} from './types.js'

type DefinitionOptions = Pick<
  NodeEngineRuntimeOptions,
  | 'definitions'
  | 'getNodeDefinition'
  | 'runtimeDefinitions'
  | 'handlers'
  | 'functionDefinitions'
  | 'functionHandlers'
  | 'subgraphDefinitions'
>

/**
 * The node, function, and subgraph definitions a runtime executes, and the handlers resolved from
 * them. Explicit `handlers` and `functionHandlers` take precedence over definition handlers, and
 * `getNodeDefinition` over the `definitions` list.
 */
export class RuntimeDefinitions {
  private readonly nodes = new Map<string, SemanticNodeDefinition>()
  private readonly runtimeNodes = new Map<string, NodeEngineRuntimeNodeDefinition>()
  private readonly functions = new Map<string, NodeEngineRuntimeFunctionDefinition>()
  private readonly subgraphs = new Map<string, NodeEngineRuntimeSubgraphDefinition>()

  constructor(private readonly options: DefinitionOptions) {
    for (const definition of options.definitions ?? []) {
      this.nodes.set(definition.type, definition)
    }

    for (const definition of options.runtimeDefinitions ?? []) {
      this.runtimeNodes.set(definition.type, definition)
    }

    for (const definition of options.functionDefinitions ?? []) {
      this.functions.set(definition.id, definition)
    }

    for (const definition of options.subgraphDefinitions ?? []) {
      this.subgraphs.set(definition.id, definition)
    }
  }

  /** Everything `compileGraph` needs besides the graph and its entry node. */
  compileOptions(): Omit<NodeEngineCompileOptions, 'graph' | 'entryNodeId' | 'diagnostics'> {
    return {
      definitions: [...this.nodes.values()],
      getNodeDefinition: (type) => this.getNodeDefinition(type),
      runtimeDefinitions: [...this.runtimeNodes.values()],
      handlers: this.options.handlers,
      functionDefinitions: [...this.functions.values()],
      subgraphDefinitions: [...this.subgraphs.values()],
    }
  }

  getNodeDefinition(type: string): SemanticNodeDefinition | undefined {
    return this.options.getNodeDefinition?.(type) ?? this.nodes.get(type)
  }

  getNodePorts(node: GraphNode): GraphPort[] {
    const definition = this.getNodeDefinition(node.type)

    return resolveNodePorts(node, definition ? [definition] : [])
  }

  getHandler(node: GraphNode): NodeEngineRuntimeNodeHandler | undefined {
    return this.options.handlers?.[node.type] ?? this.runtimeNodes.get(node.type)?.handler
  }

  /** Whether one evaluation of a data node may serve every reader in a run. */
  isDataCacheable(node: GraphNode): boolean {
    return (
      this.runtimeNodes.get(node.type)?.cacheable ??
      hasNodeCapability(this.getNodeDefinition(node.type), 'pure')
    )
  }

  /** Whether a scheduler may retry the node: it is pure or explicitly idempotent. */
  isNodeRetryable(node: GraphNode): boolean {
    return (
      this.runtimeNodes.get(node.type)?.idempotent === true ||
      hasNodeCapability(this.getNodeDefinition(node.type), 'pure')
    )
  }

  getFunction(id: string): NodeEngineRuntimeFunctionDefinition | undefined {
    return this.functions.get(id)
  }

  getFunctionHandler(id: string): NodeEngineRuntimeFunctionHandler | undefined {
    return this.options.functionHandlers?.[id] ?? this.functions.get(id)?.handler
  }

  getSubgraph(id: string): NodeEngineRuntimeSubgraphDefinition | undefined {
    return this.subgraphs.get(id)
  }
}
