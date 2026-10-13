import type { GraphPlugin } from '../protocol/index.js'
import { createConnectionRulesPlugin, type ConnectionRuleInput } from './rules/index.js'
import { createDataflowConnectionRules } from './dataflow.js'
import { createExecflowConnectionRules } from './execflow.js'
import type { HybridFlowPluginOptions, PortKind } from './types.js'

export function createHybridFlowPlugin(options: HybridFlowPluginOptions = {}): GraphPlugin {
  return createConnectionRulesPlugin(createHybridFlowConnectionRules(options), {
    name: 'node-engine:hybrid-flow',
    validateRequiredInputs: true,
  })
}

export function createHybridFlowConnectionRules(
  options: HybridFlowPluginOptions = {},
): ConnectionRuleInput[] {
  return [
    ...scopeRules('data', createDataflowConnectionRules(options.dataflow)),
    ...scopeRules('exec', createExecflowConnectionRules(options.execflow)),
    ...(options.rules ?? []),
  ]
}

function scopeRules(kind: PortKind, rules: ConnectionRuleInput[]): ConnectionRuleInput[] {
  return rules.map((rule, index) => {
    const id = typeof rule === 'function' ? rule.name || `rule-${index}` : rule.id
    const validate = typeof rule === 'function' ? rule : rule.validate

    return {
      id: `${kind}:${id}`,
      validate(context) {
        return context.kind === kind ? validate(context) : { valid: true }
      },
    }
  })
}
