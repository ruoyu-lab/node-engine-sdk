import type { ConnectionValidationResult } from '../../protocol/index.js'
import {
  formatTypeRef,
  isValueTypeCompatible,
  resolvePortAcceptedValueTypes,
  resolvePortValueType,
} from '../type-system.js'
import type { PortSemanticsOptions } from '../types.js'
import { resolvePortSemanticsOptions } from '../types.js'
import { defineConnectionRule } from './connection-rules.js'

export type DataTypeRuleOptions = Pick<
  PortSemanticsOptions,
  'validateDataTypes' | 'wildcardDataTypes' | 'compatibleDataTypes'
>

export function createDataTypeRule(options: DataTypeRuleOptions = {}) {
  const resolved = resolvePortSemanticsOptions(options)

  return defineConnectionRule('data-type', (context): ConnectionValidationResult => {
    if (!resolved.validateDataTypes || !context.sourcePort || !context.targetPort) {
      return { valid: true }
    }

    const sourceType = resolvePortValueType(context.sourcePort)
    const targetType = resolvePortValueType(context.targetPort)
    const targetAccepts = resolvePortAcceptedValueTypes(context.targetPort)

    if (isValueTypeCompatible(sourceType, targetType, targetAccepts, resolved)) {
      return { valid: true }
    }

    return {
      valid: false,
      code: 'PORT_DATA_TYPE_MISMATCH',
      reason: `Cannot connect ${formatTypeRef(sourceType)} to ${formatTypeRef(targetType)}.`,
    }
  })
}
