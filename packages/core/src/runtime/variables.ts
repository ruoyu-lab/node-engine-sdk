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

export type NodeWrightRuntimeVariableValues = Record<string, unknown>
export type NodeWrightRuntimeVariableInput = VariableReferenceInput

export interface NodeWrightRuntimeVariableSnapshot {
  run: NodeWrightRuntimeVariableValues
  graph: NodeWrightRuntimeVariableValues
  nodes: Record<string, NodeWrightRuntimeVariableValues>
  scopes: Record<string, NodeWrightRuntimeVariableValues>
}

export type NodeWrightRuntimeInitialVariables = Partial<NodeWrightRuntimeVariableSnapshot>

export interface NodeWrightRuntimeVariableAccessOptions {
  defaultScope?: VariableScope
  nodeId?: string
}

export interface NodeWrightRuntimeVariableApi {
  get: (
    reference: NodeWrightRuntimeVariableInput,
    options?: NodeWrightRuntimeVariableAccessOptions,
  ) => unknown
  set: (
    reference: NodeWrightRuntimeVariableInput,
    value: unknown,
    options?: NodeWrightRuntimeVariableAccessOptions,
  ) => void
  has: (
    reference: NodeWrightRuntimeVariableInput,
    options?: NodeWrightRuntimeVariableAccessOptions,
  ) => boolean
  delete: (
    reference: NodeWrightRuntimeVariableInput,
    options?: NodeWrightRuntimeVariableAccessOptions,
  ) => boolean
  list: (
    scope?: VariableScope,
    options?: Pick<NodeWrightRuntimeVariableAccessOptions, 'nodeId'>,
  ) => NodeWrightRuntimeVariableValues
  snapshot: () => NodeWrightRuntimeVariableSnapshot
}

export function createRuntimeVariableSnapshot(
  initialVariables?: NodeWrightRuntimeInitialVariables,
): NodeWrightRuntimeVariableSnapshot {
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
  variables: NodeWrightRuntimeVariableSnapshot,
  context: NodeWrightRuntimeVariableAccessOptions = {},
): NodeWrightRuntimeVariableApi {
  const resolveReference = (
    reference: NodeWrightRuntimeVariableInput,
    options: NodeWrightRuntimeVariableAccessOptions = {},
  ): VariableReference =>
    createVariableReference(reference, {
      defaultScope: options.defaultScope ?? context.defaultScope ?? VARIABLE_SCOPE_RUN,
      nodeId: options.nodeId ?? context.nodeId,
    })

  const readBucket = (reference: VariableReference): NodeWrightRuntimeVariableValues | undefined =>
    resolveVariableBucket(variables, reference, { create: false })

  const writeBucket = (reference: VariableReference): NodeWrightRuntimeVariableValues =>
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

function createEmptyVariableSnapshot(): NodeWrightRuntimeVariableSnapshot {
  return {
    run: {},
    graph: {},
    nodes: {},
    scopes: {},
  }
}

function resolveVariableBucket(
  variables: NodeWrightRuntimeVariableSnapshot,
  reference: VariableReference,
  options: { create: boolean },
): NodeWrightRuntimeVariableValues | undefined {
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

function cloneVariableRecord(value: unknown): NodeWrightRuntimeVariableValues {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? cloneValue(value as NodeWrightRuntimeVariableValues)
    : {}
}

function cloneVariableRecordMap(value: unknown): Record<string, NodeWrightRuntimeVariableValues> {
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
