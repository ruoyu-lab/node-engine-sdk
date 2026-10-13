import type { ConnectionValidationResult } from '../../protocol/index.js'
import { wouldCreateCycle } from '../cycles.js'
import type { EdgeKind } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export interface CycleRuleOptions {
  kind: EdgeKind
  enabled?: boolean
  matchConnectionKind?: boolean
  code?: string
  reason?: string
}

export function createCycleRule(options: CycleRuleOptions) {
  const enabled = options.enabled !== false

  return defineConnectionRule(`cycle:${options.kind}`, (context): ConnectionValidationResult => {
    if (!enabled) {
      return { valid: true }
    }

    if (options.matchConnectionKind !== false && context.kind !== options.kind) {
      return { valid: true }
    }

    if (
      wouldCreateCycle(
        context.index,
        { source: context.source, target: context.target },
        options.kind,
        context.ignoredEdgeId,
      )
    ) {
      return {
        valid: false,
        code: options.code ?? 'CYCLE_DETECTED',
        reason: options.reason ?? `This ${options.kind} connection would create a cycle.`,
      }
    }

    return { valid: true }
  })
}
