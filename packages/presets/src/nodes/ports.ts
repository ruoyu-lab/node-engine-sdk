import type { GraphPort } from '@node-engine-sdk/core/protocol'

/**
 * Drops the optional fields a signature leaves unset. A protocol port omits an unset field rather
 * than holding `undefined`, so generated ports pass the strict `parseGraph` boundary unchanged.
 */
export function compactPort(port: GraphPort): GraphPort {
  return Object.fromEntries(
    Object.entries(port).filter(([, value]) => value !== undefined),
  ) as GraphPort
}
