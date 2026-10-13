import type { ConnectionValidationResult } from '../../protocol/index.js'
import type { PortSemanticsOptions } from '../types.js'
import { resolvePortSemanticsOptions } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export type SameNodeRuleOptions = Pick<PortSemanticsOptions, 'allowSameNodeConnections'>

export function createSameNodeRule(options: SameNodeRuleOptions = {}) {
  const resolved = resolvePortSemanticsOptions(options)

  return defineConnectionRule('same-node', (context): ConnectionValidationResult => {
    if (resolved.allowSameNodeConnections || context.source.nodeId !== context.target.nodeId) {
      return { valid: true }
    }

    return {
      valid: false,
      code: 'SAME_NODE_CONNECTION',
      reason: 'A node cannot connect to itself.',
    }
  })
}
