import type { GraphMetadata } from '../protocol/index.js'
import { assertValidSignature, validateFunctionSignature } from './signatures.js'
import type { PortDataType } from './types.js'

export type FunctionCallMode = 'pure' | 'effect' | 'async' | 'subgraph' | string

export interface FunctionParameter {
  id: string
  name?: string
  label?: string
  description?: string
  dataType?: PortDataType
  accepts?: PortDataType[]
  required?: boolean
  defaultValue?: unknown
  meta?: GraphMetadata
}

export interface FunctionReturn {
  id: string
  name?: string
  label?: string
  description?: string
  dataType?: PortDataType
  meta?: GraphMetadata
}

export interface FunctionSignature {
  inputs?: FunctionParameter[]
  outputs?: FunctionReturn[]
}

export interface FunctionDefinition extends FunctionSignature {
  id: string
  label?: string
  category?: string
  description?: string
  mode?: FunctionCallMode
  tags?: string[]
  meta?: GraphMetadata
}

export interface FunctionReference {
  id: string
}

export type FunctionReferenceInput = string | FunctionReference

export function normalizeFunctionId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Function id must be a non-empty string.')
  }

  return value.trim()
}

export function createFunctionReference(input: FunctionReferenceInput): FunctionReference {
  if (typeof input === 'string') {
    return {
      id: normalizeFunctionId(input),
    }
  }

  return {
    id: normalizeFunctionId(input.id),
  }
}

/** Normalizes the id and throws when the signature cannot become the ports of a call node. */
export function createFunctionDefinition(definition: FunctionDefinition): FunctionDefinition {
  const reference = createFunctionReference(definition)

  assertValidSignature(
    validateFunctionSignature({ ...definition, id: reference.id }),
    `Function "${reference.id}"`,
  )

  return {
    ...definition,
    id: reference.id,
    inputs: definition.inputs?.map((input) => ({ ...input })) ?? [],
    outputs: definition.outputs?.map((output) => ({ ...output })) ?? [],
  }
}
