import type { GraphDiagnostic } from '../protocol/index.js'
import { EXEC_ERROR_PORT_ID, EXEC_IN_PORT_ID, EXEC_THEN_PORT_ID } from './execflow.js'

/** Port declarations of a function or subgraph signature. */
export interface SignaturePorts {
  id: string
  inputs?: ReadonlyArray<{ id: string }>
  outputs?: ReadonlyArray<{ id: string }>
}

type SignatureKind = 'function' | 'subgraph'
type SignatureDirection = 'inputs' | 'outputs'

/** Execution port ids a call node may add next to the signature ports. */
const RESERVED_PORT_IDS = new Set([EXEC_IN_PORT_ID, EXEC_THEN_PORT_ID, EXEC_ERROR_PORT_ID])

/**
 * Checks that a function signature can become the ports of one call node: input and output ids
 * share a single port id namespace, and the execution port ids stay reserved for the call node.
 * `path` prefixes every diagnostic path, e.g. `functionDefinitions.0`.
 */
export function validateFunctionSignature(
  definition: SignaturePorts,
  path?: string,
): GraphDiagnostic[] {
  return validateSignaturePorts('function', definition, path)
}

/**
 * Checks that a subgraph signature can become the ports of one call node. Its boundary nodes only
 * expose one direction each, but a call node exposes inputs and outputs together.
 */
export function validateSubgraphSignature(
  definition: SignaturePorts,
  path?: string,
): GraphDiagnostic[] {
  return validateSignaturePorts('subgraph', definition, path)
}

/** Throws one error listing every signature diagnostic, so invalid ports are never generated. */
export function assertValidSignature(diagnostics: readonly GraphDiagnostic[], label: string): void {
  if (!diagnostics.length) {
    return
  }

  throw new Error(
    `${label} has an invalid signature:\n${diagnostics
      .map((diagnostic) => `- ${diagnostic.path}: ${diagnostic.message}`)
      .join('\n')}`,
  )
}

/** O(inputs + outputs): one pass over both lists with a map of the first use of each id. */
function validateSignaturePorts(
  kind: SignatureKind,
  definition: SignaturePorts,
  path: string | undefined,
): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const firstUse = new Map<string, string>()
  const label = `${kind === 'function' ? 'Function' : 'Subgraph'} "${definition.id}"`
  const code = kind === 'function' ? 'FUNCTION_SIGNATURE' : 'SUBGRAPH_SIGNATURE'

  for (const direction of ['inputs', 'outputs'] as const satisfies SignatureDirection[]) {
    for (const [index, port] of (definition[direction] ?? []).entries()) {
      const portPath = `${path ? `${path}.` : ''}${direction}.${index}.id`
      const name = `${direction === 'inputs' ? 'input' : 'output'} "${port.id}"`
      const previous = firstUse.get(port.id)

      if (RESERVED_PORT_IDS.has(port.id)) {
        diagnostics.push({
          code: `${code}_PORT_ID_RESERVED`,
          severity: 'error',
          message: `${label} ${name} uses an execution port id reserved for its call node.`,
          source: `semantics:${kind}-signature`,
          portId: port.id,
          path: portPath,
        })
      } else if (previous) {
        diagnostics.push({
          code: `${code}_PORT_ID_DUPLICATE`,
          severity: 'error',
          message: `${label} ${name} reuses the port id of ${previous}; inputs and outputs become ports of one call node and need unique ids.`,
          source: `semantics:${kind}-signature`,
          portId: port.id,
          path: portPath,
        })
      }

      if (!previous) {
        firstUse.set(port.id, `${direction === 'inputs' ? 'input' : 'output'} ${index}`)
      }
    }
  }

  return diagnostics
}
