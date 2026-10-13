import type { ConnectionValidationResult } from '../../protocol/index.js'
import { resolvePortKind } from '../../protocol/index.js'
import type { PortKind, PortSemanticsOptions } from '../types.js'
import { resolvePortSemanticsOptions } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export interface KindRuleOptions extends Pick<PortSemanticsOptions, 'validateKinds'> {
  allowKinds?: Array<[PortKind, PortKind]>
}

export function createKindRule(options: KindRuleOptions = {}) {
  const resolved = resolvePortSemanticsOptions(options)
  const allowedPairs = new Set(
    (options.allowKinds ?? []).map(([source, target]) => `${source}->${target}`),
  )

  return defineConnectionRule('kind', (context): ConnectionValidationResult => {
    if (!resolved.validateKinds || !context.sourcePort || !context.targetPort) {
      return { valid: true }
    }

    const sourceKind = resolvePortKind(context.sourcePort)
    const targetKind = resolvePortKind(context.targetPort)

    if (sourceKind === targetKind || allowedPairs.has(`${sourceKind}->${targetKind}`)) {
      return { valid: true }
    }

    return {
      valid: false,
      code: 'PORT_KIND_MISMATCH',
      reason: `Cannot connect ${sourceKind} port to ${targetKind} port.`,
    }
  })
}
