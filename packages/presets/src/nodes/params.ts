import type { NodeWrightRuntimePortValues } from '@node-wright/core/runtime'

/**
 * Reads the id a call node targets from its resolved `params[key]`, the only source of that id.
 * Blank strings and non-string values are rejected with an error that names the node and key.
 */
export function readCallTargetId(
  params: NodeWrightRuntimePortValues,
  key: string,
  node: string,
): string {
  const value = params[key]

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  throw new Error(`${node} requires a non-empty "${key}" parameter.`)
}
