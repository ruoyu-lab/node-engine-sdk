import type { NodeParameterDefinition } from '../../protocol/index.js'

/** Input control kinds both the default DOM node and the node editor derive from a parameter. */
export type ParameterControlKind = 'text' | 'textarea' | 'number' | 'boolean' | 'select'

/**
 * Display defaults of a node parameter. DOM fields and node editor fields both start from these
 * values before applying their own display hints, so one parameter looks the same in both.
 */
export function resolveParameterControlKind(
  kind: NodeParameterDefinition['kind'],
): ParameterControlKind {
  if (kind === 'boolean' || kind === 'number' || kind === 'select') {
    return kind
  }

  if (kind === 'json' || kind === 'code') {
    return 'textarea'
  }

  return 'text'
}

/** Same fallback as the parameter's input port label: the parameter key. */
export function resolveParameterLabel(parameter: NodeParameterDefinition): string {
  return parameter.label ?? parameter.key
}

/** Reads a string display setting (`placeholder`, `description`) from the parameter's `ui`. */
export function readParameterUiString(
  parameter: NodeParameterDefinition,
  key: 'placeholder' | 'description',
): string | undefined {
  const value = parameter.ui?.[key]

  return typeof value === 'string' ? value : undefined
}
