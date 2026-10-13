import type { GraphMetadata, GraphSnapshot } from '../protocol/index.js'
import { assertValidSignature, validateSubgraphSignature } from './signatures.js'
import type { ValueTypeRef } from './type-system.js'

export const SUBGRAPH_CALL_NODE_TYPE = 'subgraph:call'
export const SUBGRAPH_INPUT_NODE_TYPE = 'subgraph:input'
export const SUBGRAPH_OUTPUT_NODE_TYPE = 'subgraph:output'

export interface SubgraphBoundaryPort {
  id: string
  name?: string
  label?: string
  description?: string
  dataType?: string
  valueType?: ValueTypeRef
  accepts?: string[]
  required?: boolean
  defaultValue?: unknown
  meta?: GraphMetadata
}

export interface SubgraphDefinition {
  id: string
  label?: string
  category?: string
  description?: string
  graph: GraphSnapshot
  inputs?: SubgraphBoundaryPort[]
  outputs?: SubgraphBoundaryPort[]
  inputNodeId?: string
  outputNodeId?: string
  eventId?: string
  tags?: string[]
  meta?: GraphMetadata
}

export interface SubgraphReference {
  id: string
}

export type SubgraphReferenceInput = string | SubgraphReference

export function normalizeSubgraphId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Subgraph id must be a non-empty string.')
  }

  return value.trim()
}

export function createSubgraphReference(input: SubgraphReferenceInput): SubgraphReference {
  if (typeof input === 'string') {
    return {
      id: normalizeSubgraphId(input),
    }
  }

  return {
    id: normalizeSubgraphId(input.id),
  }
}

/** Normalizes the id and throws when the signature cannot become the ports of a call node. */
export function createSubgraphDefinition(definition: SubgraphDefinition): SubgraphDefinition {
  const reference = createSubgraphReference(definition)

  assertValidSignature(
    validateSubgraphSignature({ ...definition, id: reference.id }),
    `Subgraph "${reference.id}"`,
  )

  return {
    ...definition,
    id: reference.id,
    inputs: definition.inputs?.map((input) => ({ ...input })) ?? [],
    outputs: definition.outputs?.map((output) => ({ ...output })) ?? [],
  }
}
