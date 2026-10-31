import type { GraphPlugin } from '../protocol/index.js'
import {
  createCapacityRule,
  createConnectionRulesPlugin,
  createCycleRule,
  createDataTypeRule,
  createDirectionRule,
  createKindRule,
  createSameNodeRule,
  type ConnectionRuleInput,
} from './rules/index.js'
import type { DataflowPluginOptions } from './types.js'

export function createDataflowConnectionRules(
  options: DataflowPluginOptions = {},
): ConnectionRuleInput[] {
  const preventCycles = options.preventCycles !== false

  return [
    createSameNodeRule(options),
    createDirectionRule(options),
    createKindRule(options),
    createDataTypeRule(options),
    createCapacityRule(options),
    ...(preventCycles
      ? [
          createCycleRule({
            kind: 'data',
            code: 'DATAFLOW_CYCLE_DETECTED',
            reason: 'This data connection would create a cycle.',
          }),
        ]
      : []),
    ...(options.rules ?? []),
  ]
}

export function createDataflowPlugin(options: DataflowPluginOptions = {}): GraphPlugin {
  return createConnectionRulesPlugin(createDataflowConnectionRules(options), {
    name: 'node-wright:dataflow',
    validateRequiredInputs: true,
  })
}
