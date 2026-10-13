import type {
  ConnectionContext,
  ConnectionValidationResult,
  EdgeDefinition,
  GraphIndex,
  GraphMetadata,
  GraphPort,
  NodeDefinition,
} from '../protocol/index.js'
import { resolvePortKind } from '../protocol/index.js'

export type SemanticKind = 'data' | 'exec' | string
export type PortKind = SemanticKind
export type EdgeKind = SemanticKind
export type PortDataType = string
export type PortCapacity = number | 'many'
export type NodeCapability = 'pure' | 'effect' | 'async' | 'event' | 'composite' | string

export interface SemanticNodeDefinition extends NodeDefinition {
  capabilities?: NodeCapability[]
  semantic?: GraphMetadata
}

export interface SemanticEdgeDefinition extends EdgeDefinition {
  kind?: EdgeKind
  semantic?: GraphMetadata
}

export interface PortSemantics {
  id: string
  direction: GraphPort['direction']
  kind: PortKind
  dataType?: PortDataType
  accepts: PortDataType[]
  capacity?: PortCapacity
  required: boolean
}

export interface PortSemanticsOptions {
  allowMissingPorts?: boolean
  allowSameNodeConnections?: boolean
  requireOutputToInput?: boolean
  validateKinds?: boolean
  validateDataTypes?: boolean
  validateCapacity?: boolean
  wildcardDataTypes?: PortDataType[]
  compatibleDataTypes?: Record<PortDataType, PortDataType[]>
}

export type ConnectionRuleResult = ConnectionValidationResult | void

/** `kind` (from `ConnectionContext`) is the kind of the validated edge, its source port's kind. */
export interface SemanticConnectionContext extends ConnectionContext {
  index: GraphIndex
  ignoredEdgeId?: string
}

export type ConnectionRule = (context: SemanticConnectionContext) => ConnectionRuleResult

export interface ConnectionRuleDefinition {
  id: string
  validate: ConnectionRule
}

export type ConnectionRuleInput = ConnectionRule | ConnectionRuleDefinition

export interface ConnectionRulesPluginOptions {
  name?: string
  validateRequiredInputs?: boolean
}

export interface DataflowPluginOptions extends PortSemanticsOptions {
  preventCycles?: boolean
  rules?: ConnectionRuleInput[]
}

export interface ExecflowPluginOptions extends PortSemanticsOptions {
  preventCycles?: boolean
  requireExecPortKinds?: boolean
  rules?: ConnectionRuleInput[]
}

export interface HybridFlowPluginOptions {
  dataflow?: DataflowPluginOptions
  execflow?: ExecflowPluginOptions
  rules?: ConnectionRuleInput[]
}

export type ResolvedPortSemanticsOptions = Required<
  Pick<
    PortSemanticsOptions,
    | 'allowMissingPorts'
    | 'allowSameNodeConnections'
    | 'requireOutputToInput'
    | 'validateKinds'
    | 'validateDataTypes'
    | 'validateCapacity'
    | 'wildcardDataTypes'
    | 'compatibleDataTypes'
  >
>

export interface RequiredInputIssue {
  code: 'REQUIRED_INPUT_MISSING'
  nodeId: string
  portId: string
  message: string
}

const DEFAULT_SEMANTICS_OPTIONS: Required<
  Pick<
    PortSemanticsOptions,
    | 'allowMissingPorts'
    | 'allowSameNodeConnections'
    | 'requireOutputToInput'
    | 'validateKinds'
    | 'validateDataTypes'
    | 'validateCapacity'
  >
> = {
  allowMissingPorts: false,
  allowSameNodeConnections: false,
  requireOutputToInput: true,
  validateKinds: true,
  validateDataTypes: true,
  validateCapacity: true,
}

export function resolvePortSemanticsOptions(
  options: PortSemanticsOptions = {},
): ResolvedPortSemanticsOptions {
  return {
    ...DEFAULT_SEMANTICS_OPTIONS,
    ...options,
    wildcardDataTypes: options.wildcardDataTypes ?? ['any', '*', 'unknown'],
    compatibleDataTypes: options.compatibleDataTypes ?? {},
  }
}

export function resolvePortSemantics(port: GraphPort): PortSemantics {
  return {
    id: port.id,
    direction: port.direction,
    kind: resolvePortKind(port),
    dataType: port.dataType,
    accepts: port.accepts ?? [],
    capacity: port.capacity,
    required: port.required === true,
  }
}

export function hasNodeCapability(
  definition: NodeDefinition | undefined,
  capability: NodeCapability,
): boolean {
  if (!definition || !('capabilities' in definition)) {
    return false
  }

  const capabilities = definition.capabilities

  return Array.isArray(capabilities) && capabilities.includes(capability)
}

export function isPortDataTypeCompatible(
  sourceType: PortDataType | undefined,
  targetType: PortDataType | undefined,
  targetAccepts: PortDataType[] = [],
  options: PortSemanticsOptions = {},
): boolean {
  if (!sourceType || !targetType) {
    return true
  }

  if (sourceType === targetType) {
    return true
  }

  const resolved = resolvePortSemanticsOptions(options)
  const wildcards = new Set(resolved.wildcardDataTypes)

  if (wildcards.has(sourceType) || wildcards.has(targetType)) {
    return true
  }

  if (targetAccepts.includes(sourceType)) {
    return true
  }

  return (resolved.compatibleDataTypes[targetType] ?? []).includes(sourceType)
}
