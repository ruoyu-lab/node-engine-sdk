import {
  GraphIndex,
  type ConnectionContext,
  type GraphDiagnostic,
  type ConnectionValidationResult,
  type GraphDiagnosticProvider,
  type GraphPlugin,
  type NodeDefinition,
} from '../../protocol/index.js'
import type {
  ConnectionRule,
  ConnectionRuleDefinition,
  ConnectionRuleInput,
  ConnectionRulesPluginOptions,
  SemanticConnectionContext,
} from '../types.js'
import { findRequiredInputIssues } from './required-input.js'

export type {
  ConnectionRule,
  ConnectionRuleDefinition,
  ConnectionRuleInput,
  ConnectionRulesPluginOptions,
} from '../types.js'

export function defineConnectionRule(
  id: string,
  validate: ConnectionRule,
): ConnectionRuleDefinition {
  return { id, validate }
}

export function createConnectionRulesValidator(
  rules: ConnectionRuleInput[],
  getNodeDefinitions: () => NodeDefinition[] = () => [],
): (context: ConnectionContext) => ConnectionValidationResult {
  const normalized = dedupeConnectionRules(rules.map(resolveConnectionRule))

  return (context) => {
    const index = new GraphIndex(context.graph, getNodeDefinitions())
    return validateConnectionRules(normalized, createSemanticConnectionContext(context, index))
  }
}

export function createConnectionRulesDiagnosticProvider(
  rules: ConnectionRuleInput[],
  options: {
    source?: string
    validateRequiredInputs?: boolean
  } = {},
): GraphDiagnosticProvider {
  const source = options.source ?? 'semantics:connection-rules'
  const normalized = dedupeConnectionRules(rules.map(resolveConnectionRule))

  return ({ graph, nodeDefinitions }) => {
    const diagnostics: GraphDiagnostic[] = []
    const index = new GraphIndex(graph, nodeDefinitions)

    for (const [edgeIndex, edge] of graph.edges.entries()) {
      const context = createSemanticConnectionContext(
        {
          graph,
          source: edge.source,
          target: edge.target,
          kind: edge.kind,
        },
        index,
        edge.id,
      )
      const result = validateConnectionRules(normalized, context)

      if (!result.valid) {
        diagnostics.push({
          code: result.code ?? 'CONNECTION_RULE_FAILED',
          severity: 'error' as const,
          message: result.reason ?? 'Connection failed semantic validation.',
          source,
          edgeId: edge.id,
          nodeId: edge.target.nodeId,
          portId: edge.target.portId,
          path: `edges.${edgeIndex}`,
        })
      }
    }

    if (options.validateRequiredInputs) {
      diagnostics.push(
        ...findRequiredInputIssues(index).map((issue) => ({
          code: issue.code,
          severity: 'error' as const,
          message: issue.message,
          source: 'semantics:required-input',
          nodeId: issue.nodeId,
          portId: issue.portId,
        })),
      )
    }

    return diagnostics
  }
}

function dedupeConnectionRules(rules: ConnectionRuleDefinition[]): ConnectionRuleDefinition[] {
  const registry = new Map<string, ConnectionRuleDefinition>()

  for (const rule of rules) {
    registry.set(rule.id, rule)
  }

  return [...registry.values()]
}

export function createConnectionRulesPlugin(
  rules: ConnectionRuleInput[],
  options: ConnectionRulesPluginOptions = {},
): GraphPlugin {
  const name = options.name ?? 'node-wright:connection-rules'

  return {
    name,
    contributes: {
      diagnostics: [
        createConnectionRulesDiagnosticProvider(rules, {
          source: name,
          validateRequiredInputs: options.validateRequiredInputs,
        }),
      ],
    },
    setup(context) {
      return context.addConnectionValidator(
        createConnectionRulesValidator(rules, () => context.store.listNodeDefinitions()),
      )
    },
  }
}

function resolveConnectionRule(rule: ConnectionRuleInput): ConnectionRuleDefinition {
  if (typeof rule === 'function') {
    return {
      id: rule.name || 'anonymous-rule',
      validate: rule,
    }
  }

  return rule
}

function validateConnectionRules(
  rules: ConnectionRuleDefinition[],
  context: SemanticConnectionContext,
): ConnectionValidationResult {
  for (const rule of rules) {
    const result = rule.validate(context)

    if (result && !result.valid) {
      return result
    }
  }

  return { valid: true }
}

/**
 * Interactive validation and whole-graph diagnostics build the same context: the store passes the
 * kind of the edge it is about to create, diagnostics pass the kind stored on the edge.
 */
function createSemanticConnectionContext(
  context: Pick<ConnectionContext, 'graph' | 'source' | 'target' | 'kind'>,
  index: GraphIndex,
  ignoredEdgeId?: string,
): SemanticConnectionContext {
  return {
    graph: context.graph,
    source: context.source,
    target: context.target,
    kind: context.kind,
    sourceNode: index.nodes.get(context.source.nodeId),
    targetNode: index.nodes.get(context.target.nodeId),
    sourcePort: index.getPort(context.source),
    targetPort: index.getPort(context.target),
    index,
    ignoredEdgeId,
  }
}
