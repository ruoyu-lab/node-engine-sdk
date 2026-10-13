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
import type { ExecflowPluginOptions, PortSemanticsOptions } from './types.js'

export const EXEC_IN_PORT_ID = 'exec:in'
export const EXEC_THEN_PORT_ID = 'exec:then'
export const EXEC_ERROR_PORT_ID = 'exec:error'

export function createExecflowPlugin(options: ExecflowPluginOptions = {}): GraphPlugin {
  return createConnectionRulesPlugin(createExecflowConnectionRules(options), {
    name: 'node-engine:execflow',
    validateRequiredInputs: true,
  })
}

export function createExecflowConnectionRules(
  options: ExecflowPluginOptions = {},
): ConnectionRuleInput[] {
  const preventCycles = options.preventCycles === true
  const portOptions = resolvePortRuleOptions(options)

  return [
    createSameNodeRule(portOptions),
    createDirectionRule(portOptions),
    createKindRule(portOptions),
    createDataTypeRule(portOptions),
    createCapacityRule(portOptions),
    ...(preventCycles
      ? [
          createCycleRule({
            kind: 'exec',
            code: 'EXECFLOW_CYCLE_DETECTED',
            reason: 'This execution connection would create a cycle.',
          }),
        ]
      : []),
    ...(options.rules ?? []),
  ]
}

function resolvePortRuleOptions(options: ExecflowPluginOptions): PortSemanticsOptions {
  return {
    ...options,
    validateKinds: options.requireExecPortKinds === false ? false : options.validateKinds,
  }
}
