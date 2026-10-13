import type { ConnectionValidationResult } from '../../protocol/index.js'
import type { PortSemanticsOptions } from '../types.js'
import { resolvePortSemanticsOptions } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export type DirectionRuleOptions = Pick<
  PortSemanticsOptions,
  'allowMissingPorts' | 'requireOutputToInput'
>

export function createDirectionRule(options: DirectionRuleOptions = {}) {
  const resolved = resolvePortSemanticsOptions(options)

  return defineConnectionRule('direction', (context): ConnectionValidationResult => {
    if (!resolved.requireOutputToInput) {
      return { valid: true }
    }

    if (!context.sourcePort || !context.targetPort) {
      return resolved.allowMissingPorts
        ? { valid: true }
        : {
            valid: false,
            code: 'PORT_NOT_FOUND',
            reason: 'Both connection endpoints must resolve to ports.',
          }
    }

    if (context.sourcePort.direction === 'output' && context.targetPort.direction === 'input') {
      return { valid: true }
    }

    return {
      valid: false,
      code: 'PORT_DIRECTION_MISMATCH',
      reason: 'Connections must run from an output port to an input port.',
    }
  })
}
