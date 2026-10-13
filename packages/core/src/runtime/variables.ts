import { cloneValue } from '../protocol/index.js'
import {
  createVariableReference,
  VARIABLE_SCOPE_GRAPH,
  VARIABLE_SCOPE_NODE,
  VARIABLE_SCOPE_RUN,
  type VariableReference,
  type VariableReferenceInput,
  type VariableScope,
} from '../semantics/index.js'

export type NodeEngineRuntimeVariableValues = Record<string, unknown>
export type NodeEngineRuntimeVariableInput = VariableReferenceInput

export interface NodeEngineRuntimeVariableSnapshot {
  run: NodeEngineRuntimeVariableValues
  graph: NodeEngineRuntimeVariableValues
  nodes: Record<string, NodeEngineRuntimeVariableValues>
  scopes: Record<string, NodeEngineRuntimeVariableValues>
}

export type NodeEngineRuntimeInitialVariables = Partial<NodeEngineRuntimeVariableSnapshot>

export interface NodeEngineRuntimeVariableAccessOptions {
  defaultScope?: VariableScope
  nodeId?: string
}

export interface NodeEngineRuntimeVariableApi {
  get: (
    reference: NodeEngineRuntimeVariableInput,
    options?: NodeEngineRuntimeVariableAccessOptions,
  ) => unknown
  set: (
    reference: NodeEngineRuntimeVariableInput,
    value: unknown,
    options?: NodeEngineRuntimeVariableAccessOptions,
  ) => void
  has: (
    reference: NodeEngineRuntimeVariableInput,
    options?: NodeEngineRuntimeVariableAccessOptions,
  ) => boolean
  delete: (
    reference: NodeEngineRuntimeVariableInput,
    options?: NodeEngineRuntimeVariableAccessOptions,
  ) => boolean
  list: (
    scope?: VariableScope,
    options?: Pick<NodeEngineRuntimeVariableAccessOptions, 'nodeId'>,
  ) => NodeEngineRuntimeVariableValues
  snapshot: () => NodeEngineRuntimeVariableSnapshot
}

export function createRuntimeVariableSnapshot(
  initialVariables?: NodeEngineRuntimeInitialVariables,
): NodeEngineRuntimeVariableSnapshot {
  if (!initialVariables || typeof initialVariables !== 'object') {
    return createEmptyVariableSnapshot()
  }

  return {
    run: cloneVariableRecord(initialVariables.run),
    graph: cloneVariableRecord(initialVariables.graph),
    nodes: cloneVariableRecordMap(initialVariables.nodes),
    scopes: cloneVariableRecordMap(initialVariables.scopes),
  }
}

export function createRuntimeVariableApi(
  variables: NodeEngineRuntimeVariableSnapshot,
  context: NodeEngineRuntimeVariableAccessOptions = {},
): NodeEngineRuntimeVariableApi {
  const resolveReference = (
    reference: NodeEngineRuntimeVariableInput,
    options: NodeEngineRuntimeVariableAccessOptions = {},
  ): VariableReference =>
    createVariableReference(reference, {
      defaultScope: options.defaultScope ?? context.defaultScope ?? VARIABLE_SCOPE_RUN,
      nodeId: options.nodeId ?? context.nodeId,
    })

  const readBucket = (reference: VariableReference): NodeEngineRuntimeVariableValues | undefined =>
    resolveVariableBucket(variables, reference, { create: false })

  const writeBucket = (reference: VariableReference): NodeEngineRuntimeVariableValues =>
    resolveVariableBucket(variables, reference, { create: true }) ?? {}

  return {
    get(reference, options) {
      const resolved = resolveReference(reference, options)
      return readBucket(resolved)?.[resolved.name]
    },
    set(reference, value, options) {
      const resolved = resolveReference(reference, options)
      writeBucket(resolved)[resolved.name] = value
    },
    has(reference, options) {
      const resolved = resolveReference(reference, options)
      return Object.prototype.hasOwnProperty.call(readBucket(resolved) ?? {}, resolved.name)
    },
    delete(reference, options) {
      const resolved = resolveReference(reference, options)
      const bucket = readBucket(resolved)

      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, resolved.name)) {
        return false
      }

      delete bucket[resolved.name]
      return true
    },
    list(scope = VARIABLE_SCOPE_RUN, options) {
      const reference = createVariableReference({
        name: '*',
        scope,
        nodeId: options?.nodeId ?? context.nodeId,
      })

      return cloneVariableRecord(readBucket(reference))
    },
    snapshot() {
      return cloneValue(variables)
    },
  }
}

function createEmptyVariableSnapshot(): NodeEngineRuntimeVariableSnapshot {
  return {
    run: {},
    graph: {},
    nodes: {},
    scopes: {},
  }
}

function resolveVariableBucket(
  variables: NodeEngineRuntimeVariableSnapshot,
  reference: VariableReference,
  options: { create: boolean },
): NodeEngineRuntimeVariableValues | undefined {
  const scope = reference.scope ?? VARIABLE_SCOPE_RUN

  if (scope === VARIABLE_SCOPE_RUN) {
    return variables.run
  }

  if (scope === VARIABLE_SCOPE_GRAPH) {
    return variables.graph
  }

  if (scope === VARIABLE_SCOPE_NODE) {
    const nodeId = reference.nodeId

    if (!nodeId) {
      if (options.create) {
        throw new Error('Node scoped variable requires a nodeId.')
      }

      return undefined
    }

    if (!variables.nodes[nodeId] && options.create) {
      variables.nodes[nodeId] = {}
    }

    return variables.nodes[nodeId]
  }

  if (!variables.scopes[scope] && options.create) {
    variables.scopes[scope] = {}
  }

  return variables.scopes[scope]
}

function cloneVariableRecord(value: unknown): NodeEngineRuntimeVariableValues {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneValue(value as NodeEngineRuntimeVariableValues)
    : {}
}

function cloneVariableRecordMap(value: unknown): Record<string, NodeEngineRuntimeVariableValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      cloneVariableRecord(entry),
    ]),
  )
}
