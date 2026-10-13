import type { GraphMetadata, GraphPort, GraphValue } from '../protocol/index.js'
import { cloneValue } from '../protocol/index.js'

export type ValueTypeKind =
  | 'any'
  | 'unknown'
  | 'never'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'undefined'
  | string

export type ValueTypeRef = ValueTypeKind | ValueTypeSchema

export interface ValueTypeSchema {
  kind?: ValueTypeKind
  id?: string
  label?: string
  description?: string
  items?: ValueTypeRef
  properties?: Record<string, ValueTypeRef>
  required?: string[]
  union?: ValueTypeRef[]
  enum?: GraphValue[]
  meta?: GraphMetadata
}

export interface ValueTypeCompatibilityOptions {
  wildcardDataTypes?: string[]
  compatibleDataTypes?: Record<string, string[]>
}

export interface ValueTypeValidationIssue {
  code: 'VALUE_TYPE_MISMATCH'
  path: string
  expected: ValueTypeRef
  actual: ValueTypeKind
  message: string
}

export function createValueType(input: ValueTypeRef): ValueTypeSchema {
  return normalizeValueType(input)
}

export function serializeValueType(input: ValueTypeRef): GraphValue {
  if (typeof input === 'string') {
    return input
  }

  const serialized: Record<string, GraphValue> = {}

  if (input.kind !== undefined) serialized.kind = input.kind
  if (input.id !== undefined) serialized.id = input.id
  if (input.label !== undefined) serialized.label = input.label
  if (input.description !== undefined) serialized.description = input.description
  if (input.items !== undefined) serialized.items = serializeValueType(input.items)
  if (input.properties !== undefined) {
    serialized.properties = Object.fromEntries(
      Object.entries(input.properties).map(([key, value]) => [key, serializeValueType(value)]),
    )
  }
  if (input.required !== undefined) serialized.required = [...input.required]
  if (input.union !== undefined) {
    serialized.union = input.union.map(serializeValueType)
  }
  if (input.enum !== undefined) serialized.enum = cloneValue(input.enum)
  if (input.meta !== undefined) serialized.meta = cloneValue(input.meta)

  return serialized
}

export function normalizeValueType(input: ValueTypeRef | undefined): ValueTypeSchema {
  if (!input) {
    return { kind: 'any' }
  }

  if (typeof input === 'string') {
    return { kind: input }
  }

  return {
    ...input,
    kind: input.kind ?? 'any',
  }
}

export function resolvePortValueType(port: GraphPort | undefined): ValueTypeRef | undefined {
  if (!port) {
    return undefined
  }

  const dataType = port.data?.type

  return isValueTypeRef(dataType) ? dataType : port.dataType
}

export function resolvePortAcceptedValueTypes(port: GraphPort | undefined): ValueTypeRef[] {
  if (!port) {
    return []
  }

  return [...new Set(port.accepts ?? [])]
}

export function isValueTypeCompatible(
  source: ValueTypeRef | undefined,
  target: ValueTypeRef | undefined,
  targetAccepts: ValueTypeRef[] = [],
  options: ValueTypeCompatibilityOptions = {},
): boolean {
  const sourceType = normalizeValueType(source)
  const targetType = normalizeValueType(target)

  if (targetAccepts.some((accept) => isSingleValueTypeCompatible(sourceType, accept, options))) {
    return true
  }

  return isSingleValueTypeCompatible(sourceType, targetType, options)
}

export function inferValueTypeKind(value: unknown): ValueTypeKind {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return 'array'
  }

  if (Number.isInteger(value)) {
    return 'integer'
  }

  return typeof value
}

export function validateValueType(
  value: unknown,
  expected: ValueTypeRef | undefined,
  path = '$',
): ValueTypeValidationIssue[] {
  if (!expected) {
    return []
  }

  const schema = normalizeValueType(expected)
  const kind = schema.kind ?? 'any'

  if (kind === 'any' || kind === 'unknown') {
    return []
  }

  if (schema.union?.some((entry) => validateValueType(value, entry, path).length === 0)) {
    return []
  }

  if (schema.enum && schema.enum.some((entry) => Object.is(entry, value))) {
    return []
  }

  const actual = inferValueTypeKind(value)
  const directMatch = actual === kind || (kind === 'number' && actual === 'integer')

  if (!directMatch) {
    return [
      {
        code: 'VALUE_TYPE_MISMATCH',
        path,
        expected: schema,
        actual,
        message: `Expected ${formatTypeRef(schema)} at ${path}, received ${actual}.`,
      },
    ]
  }

  if (kind === 'array' && schema.items && Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      validateValueType(entry, schema.items, `${path}[${index}]`),
    )
  }

  if (
    kind === 'object' &&
    schema.properties &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>
    const required = new Set(schema.required ?? [])
    const issues: ValueTypeValidationIssue[] = []

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        issues.push({
          code: 'VALUE_TYPE_MISMATCH',
          path: `${path}.${key}`,
          expected: schema.properties[key] ?? 'unknown',
          actual: 'undefined',
          message: `Missing required property ${path}.${key}.`,
        })
      }
    }

    for (const [key, propertyType] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        issues.push(...validateValueType(record[key], propertyType, `${path}.${key}`))
      }
    }

    return issues
  }

  return []
}

export function formatTypeRef(input: ValueTypeRef | undefined): string {
  const schema = normalizeValueType(input)

  if (schema.union?.length) {
    return schema.union.map(formatTypeRef).join(' | ')
  }

  if (schema.kind === 'array' && schema.items) {
    return `${formatTypeRef(schema.items)}[]`
  }

  return schema.id ?? schema.kind ?? 'any'
}

function isSingleValueTypeCompatible(
  source: ValueTypeRef,
  target: ValueTypeRef,
  options: ValueTypeCompatibilityOptions,
): boolean {
  const sourceType = normalizeValueType(source)
  const targetType = normalizeValueType(target)
  const sourceKind = sourceType.kind ?? 'any'
  const targetKind = targetType.kind ?? 'any'
  const wildcards = new Set(options.wildcardDataTypes ?? ['any', '*', 'unknown'])

  if (wildcards.has(sourceKind) || wildcards.has(targetKind)) {
    return true
  }

  if (targetType.union?.some((entry) => isSingleValueTypeCompatible(sourceType, entry, options))) {
    return true
  }

  if (sourceType.union?.every((entry) => isSingleValueTypeCompatible(entry, targetType, options))) {
    return true
  }

  if (sourceKind === targetKind) {
    return isStructuredTypeCompatible(sourceType, targetType, options)
  }

  if (sourceKind === 'integer' && targetKind === 'number') {
    return true
  }

  return (options.compatibleDataTypes?.[targetKind] ?? []).includes(sourceKind)
}

function isStructuredTypeCompatible(
  source: ValueTypeSchema,
  target: ValueTypeSchema,
  options: ValueTypeCompatibilityOptions,
): boolean {
  if (target.kind === 'array' && target.items && source.items) {
    return isSingleValueTypeCompatible(source.items, target.items, options)
  }

  if (target.kind === 'object' && target.properties && source.properties) {
    for (const key of target.required ?? []) {
      if (!source.properties[key]) {
        return false
      }
    }

    for (const [key, targetProperty] of Object.entries(target.properties)) {
      const sourceProperty = source.properties[key]

      if (sourceProperty && !isSingleValueTypeCompatible(sourceProperty, targetProperty, options)) {
        return false
      }
    }
  }

  return true
}

function isValueTypeRef(value: unknown): value is ValueTypeRef {
  return (
    typeof value === 'string' ||
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
  )
}
