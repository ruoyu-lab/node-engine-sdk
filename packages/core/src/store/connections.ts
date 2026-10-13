import { findNode, resolvePortKind } from '../protocol/index.js'
import type {
  ConnectionContext,
  ConnectionValidationResult,
  ConnectionValidator,
  GraphEndpoint,
  GraphPort,
  GraphSnapshot,
} from '../protocol/index.js'

/** The first failed result, or `{ valid: true }` when every validator accepts or abstains. */
export function composeValidationResults(
  results: Array<ConnectionValidationResult | void>,
): ConnectionValidationResult {
  for (const result of results) {
    if (result && !result.valid) {
      return result
    }
  }

  return { valid: true }
}

/** What connection validation reads from the store. */
export interface ConnectionLookup {
  getSnapshot: () => GraphSnapshot
  getPort: (endpoint: GraphEndpoint) => GraphPort | undefined
}

/**
 * Validates a proposed connection: the built-in structural checks first, then every registered
 * connection validator in registration order.
 */
export class ConnectionValidation {
  private readonly validators = new Set<ConnectionValidator>()

  constructor(private readonly lookup: ConnectionLookup) {}

  add(validator: ConnectionValidator): () => void {
    if (this.validators.has(validator)) {
      throw new Error('Connection validator is already registered.')
    }

    this.validators.add(validator)
    let active = true

    return () => {
      if (!active) {
        return
      }

      active = false
      this.validators.delete(validator)
    }
  }

  validate(
    source: GraphEndpoint,
    target: GraphEndpoint,
    options: { ignoreEdgeId?: string } = {},
  ): ConnectionValidationResult {
    if (source.nodeId === target.nodeId && source.portId === target.portId) {
      return {
        valid: false,
        code: 'SELF_CONNECTION',
        reason: 'A port cannot connect to itself.',
      }
    }

    const graph = this.lookup.getSnapshot()

    if (options.ignoreEdgeId) {
      graph.edges = graph.edges.filter((edge) => edge.id !== options.ignoreEdgeId)
    }

    const sourceNode = findNode(graph, source.nodeId)
    const targetNode = findNode(graph, target.nodeId)

    if (!sourceNode || !targetNode) {
      return {
        valid: false,
        code: 'MISSING_NODE',
        reason: 'Source or target node was not found.',
      }
    }

    const sourcePort = this.lookup.getPort(source)
    const targetPort = this.lookup.getPort(target)

    if (!sourcePort || !targetPort) {
      return {
        valid: false,
        code: 'MISSING_PORT',
        reason: 'Source or target port was not found.',
      }
    }

    if (sourcePort.direction !== 'output') {
      return {
        valid: false,
        code: 'SOURCE_NOT_OUTPUT',
        reason: 'Connections must start from an output port.',
      }
    }

    if (targetPort.direction !== 'input') {
      return {
        valid: false,
        code: 'TARGET_NOT_INPUT',
        reason: 'Connections must end at an input port.',
      }
    }

    const duplicate = graph.edges.some(
      (edge) =>
        edge.source.nodeId === source.nodeId &&
        edge.source.portId === source.portId &&
        edge.target.nodeId === target.nodeId &&
        edge.target.portId === target.portId,
    )

    if (duplicate) {
      return {
        valid: false,
        code: 'DUPLICATE_EDGE',
        reason: 'This connection already exists.',
      }
    }

    // Validators see the edge exactly as `connectPortsCommand` / `reconnectEdgeCommand` build it.
    const context: ConnectionContext = {
      graph,
      source,
      target,
      kind: resolvePortKind(sourcePort),
      sourceNode,
      targetNode,
      sourcePort,
      targetPort,
    }

    return composeValidationResults([...this.validators].map((validator) => validator(context)))
  }

  clear(): void {
    this.validators.clear()
  }
}
