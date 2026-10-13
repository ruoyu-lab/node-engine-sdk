import type { ConnectionValidationResult } from '../../protocol/index.js'
import type { PortSemanticsOptions } from '../types.js'
import { resolvePortSemanticsOptions } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export type CapacityRuleOptions = Pick<PortSemanticsOptions, 'validateCapacity'>

export function createCapacityRule(options: CapacityRuleOptions = {}) {
  const resolved = resolvePortSemanticsOptions(options)

  return defineConnectionRule('capacity', (context): ConnectionValidationResult => {
    if (!resolved.validateCapacity || !context.targetPort) {
      return { valid: true }
    }

    const capacity = context.targetPort.capacity

    if (capacity === undefined || capacity === 'many') {
      return { valid: true }
    }

    const connectionCount = context.index.countIncoming(context.target, context.ignoredEdgeId)

    if (connectionCount < capacity) {
      return { valid: true }
    }

    return {
      valid: false,
      code: 'TARGET_PORT_CAPACITY_REACHED',
      reason: 'The target port has reached its connection limit.',
    }
  })
}
