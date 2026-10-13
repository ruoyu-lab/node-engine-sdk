import type { PortDataType } from './types.js'

export const VARIABLE_SCOPE_RUN = 'run'
export const VARIABLE_SCOPE_GRAPH = 'graph'
export const VARIABLE_SCOPE_NODE = 'node'

export type VariableScope =
  typeof VARIABLE_SCOPE_RUN | typeof VARIABLE_SCOPE_GRAPH | typeof VARIABLE_SCOPE_NODE | string

export interface VariableDefinition {
  name: string
  label?: string
  scope?: VariableScope
  dataType?: PortDataType
  defaultValue?: unknown
  readonly?: boolean
  description?: string
  meta?: Record<string, unknown>
}

export interface VariableReference {
  name: string
  scope?: VariableScope
  nodeId?: string
}

export type VariableReferenceInput = string | VariableReference

export interface VariableReferenceOptions {
  defaultScope?: VariableScope
  nodeId?: string
}

export function normalizeVariableName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Variable name must be a non-empty string.')
  }

  return value.trim()
}

export function normalizeVariableScope(
  value: unknown,
  defaultScope: VariableScope = VARIABLE_SCOPE_RUN,
): VariableScope {
  if (value === undefined) {
    return defaultScope
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Variable scope must be a non-empty string.')
  }

  return value.trim()
}

export function createVariableReference(
  input: VariableReferenceInput,
  options: VariableReferenceOptions = {},
): VariableReference {
  if (typeof input === 'string') {
    return {
      name: normalizeVariableName(input),
      scope: options.defaultScope ?? VARIABLE_SCOPE_RUN,
      nodeId: options.nodeId,
    }
  }

  return {
    name: normalizeVariableName(input.name),
    scope: normalizeVariableScope(input.scope, options.defaultScope ?? VARIABLE_SCOPE_RUN),
    nodeId: input.nodeId ?? options.nodeId,
  }
}

export function createVariableDefinition(
  definition: VariableDefinition,
  options: VariableReferenceOptions = {},
): VariableDefinition {
  const reference = createVariableReference(definition, options)

  return {
    ...definition,
    name: reference.name,
    scope: reference.scope,
  }
}
