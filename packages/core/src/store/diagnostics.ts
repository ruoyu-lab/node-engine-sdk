import {
  cloneGraph,
  cloneValue,
  createGraphValidationResult,
  mergeGraphValidationResults,
  repairGraph,
  validateGraph,
} from '../protocol/index.js'
import type {
  EdgeDefinition,
  GraphDiagnostic,
  GraphDiagnosticProvider,
  GraphRepairResult,
  GraphSnapshot,
  GraphValidationResult,
  NodeDefinition,
} from '../protocol/index.js'
import type { RegistryEventType } from './registry.js'

/** The node and edge definitions a graph is validated against. */
export interface GraphDefinitions {
  listNodeDefinitions: () => NodeDefinition[]
  listEdgeDefinitions: () => EdgeDefinition[]
}

/** A graph about to be committed, with every diagnostic it has. */
export interface PreparedGraph {
  graph: GraphSnapshot
  diagnostics: GraphDiagnostic[]
}

/**
 * Validation of the store's graphs against the registered definitions, plus the registered
 * diagnostic providers. Providers work on copies and their diagnostics are copied back, so a
 * provider can never reach store state.
 */
export class GraphDiagnostics {
  private readonly providers = new Set<GraphDiagnosticProvider>()

  constructor(
    private readonly definitions: GraphDefinitions,
    private readonly notify: (type: RegistryEventType, key: string) => void,
  ) {}

  register(provider: GraphDiagnosticProvider): () => void {
    if (this.providers.has(provider)) {
      throw new Error('Diagnostic provider is already registered.')
    }

    const key = provider.name || 'anonymous'
    let active = true
    this.providers.add(provider)
    this.notify('registry:diagnostic-provider-registered', key)

    return () => {
      if (!active) {
        return
      }

      active = false
      this.providers.delete(provider)
      this.notify('registry:diagnostic-provider-unregistered', key)
    }
  }

  /** Throws on the first structural error of `graph`; providers do not run. */
  assertValid(graph: GraphSnapshot): void {
    this.validateStructure(graph)
  }

  /**
   * Validates a graph before it is committed: a structural error throws, any other diagnostic is
   * returned with a detached copy of the graph.
   */
  prepare(graph: GraphSnapshot): PreparedGraph {
    const next = cloneGraph(graph)
    const { validation, nodeDefinitions, edgeDefinitions } = this.validateStructure(next)

    return {
      graph: next,
      diagnostics: [
        ...validation.diagnostics,
        ...this.runProviders(next, nodeDefinitions, edgeDefinitions),
      ],
    }
  }

  /** Structural and provider diagnostics of `graph`, without throwing. */
  analyze(graph: GraphSnapshot): GraphValidationResult {
    const nodeDefinitions = this.definitions.listNodeDefinitions()
    const edgeDefinitions = this.definitions.listEdgeDefinitions()
    const structural = validateGraph(graph, { nodeDefinitions, edgeDefinitions })

    return createGraphValidationResult([
      ...structural.diagnostics,
      ...this.runProviders(graph, nodeDefinitions, edgeDefinitions),
    ])
  }

  /** `repairGraph` against the registered definitions, with provider diagnostics of the result. */
  repair(graph: GraphSnapshot): GraphRepairResult {
    const nodeDefinitions = this.definitions.listNodeDefinitions()
    const edgeDefinitions = this.definitions.listEdgeDefinitions()
    const result = repairGraph(graph, { nodeDefinitions, edgeDefinitions })
    const providerDiagnostics = this.runProviders(result.graph, nodeDefinitions, edgeDefinitions)

    return {
      graph: result.graph,
      diagnostics: [...result.diagnostics, ...providerDiagnostics],
      validation: mergeGraphValidationResults(result.validation, providerDiagnostics),
    }
  }

  clear(): void {
    this.providers.clear()
  }

  private validateStructure(graph: GraphSnapshot): {
    validation: GraphValidationResult
    nodeDefinitions: NodeDefinition[]
    edgeDefinitions: EdgeDefinition[]
  } {
    const nodeDefinitions = this.definitions.listNodeDefinitions()
    const edgeDefinitions = this.definitions.listEdgeDefinitions()
    const validation = validateGraph(graph, { nodeDefinitions, edgeDefinitions })

    if (!validation.valid) {
      throw new Error(createValidationErrorMessage(validation))
    }

    return { validation, nodeDefinitions, edgeDefinitions }
  }

  private runProviders(
    graph: GraphSnapshot,
    nodeDefinitions: NodeDefinition[],
    edgeDefinitions: EdgeDefinition[],
  ): GraphDiagnostic[] {
    return [...this.providers].flatMap((provider) => {
      const result = provider({
        graph: cloneGraph(graph),
        nodeDefinitions: cloneValue(nodeDefinitions),
        edgeDefinitions: cloneValue(edgeDefinitions),
      })

      if (!result) {
        return []
      }

      return cloneValue(Array.isArray(result) ? result : result.diagnostics)
    })
  }
}

/** The message of the first error diagnostic of a failed validation. */
export function createValidationErrorMessage(validation: GraphValidationResult): string {
  const first = validation.diagnostics.find((diagnostic) => diagnostic.severity === 'error')

  return first ? `Graph validation failed: ${first.message}` : 'Graph validation failed.'
}
