import {
  GraphIndex,
  type GraphDiagnostic,
  type GraphDiagnosticProvider,
  type GraphSnapshot,
  type NodeDefinition,
} from '../../protocol/index.js'
import type { RequiredInputIssue } from '../types.js'

export function validateRequiredInputPorts(
  graph: GraphSnapshot,
  nodeDefinitions: NodeDefinition[] = [],
): RequiredInputIssue[] {
  const index = new GraphIndex(graph, nodeDefinitions)
  return findRequiredInputIssues(index)
}

export function findRequiredInputIssues(index: GraphIndex): RequiredInputIssue[] {
  const issues: RequiredInputIssue[] = []

  for (const node of index.graph.nodes) {
    for (const port of index.listPorts(node.id)) {
      if (port.direction !== 'input' || port.required !== true) {
        continue
      }

      const connected =
        index.countIncoming({
          nodeId: node.id,
          portId: port.id,
        }) > 0

      if (!connected) {
        issues.push({
          code: 'REQUIRED_INPUT_MISSING',
          nodeId: node.id,
          portId: port.id,
          message: `Required input ${port.label ?? port.id} is not connected.`,
        })
      }
    }
  }

  return issues
}

export function createRequiredInputDiagnosticProvider(): GraphDiagnosticProvider {
  return ({ graph, nodeDefinitions }) =>
    validateRequiredInputPorts(graph, nodeDefinitions).map((issue): GraphDiagnostic => ({
      code: issue.code,
      severity: 'error',
      message: issue.message,
      source: 'semantics:required-input',
      nodeId: issue.nodeId,
      portId: issue.portId,
    }))
}
