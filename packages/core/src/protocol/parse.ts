import {
  NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  type GraphDiagnostic,
  type GraphEdge,
  type GraphEndpoint,
  type GraphGroup,
  type GraphMetadata,
  type GraphNode,
  type GraphPort,
  type GraphSnapshot,
  type GraphValue,
  type ValidateGraphOptions,
} from './types.js'
import { validateGraph } from './validate.js'
import { cloneValue } from './values.js'

/*
 * The boundary for external graph data: `parseGraph` reads an unknown value strictly into a
 * typed `GraphSnapshot` and then rejects it on any structural diagnostic from `validateGraph`.
 */

export class GraphParseError extends Error {
  readonly path: string
  readonly diagnostics: GraphDiagnostic[]

  constructor(path: string, reason: string, diagnostics: GraphDiagnostic[] = []) {
    super(`Invalid graph at "${path}": ${reason}`)
    this.name = 'GraphParseError'
    this.path = path
    this.diagnostics = cloneValue(diagnostics)
  }
}

export function parseGraph(input: unknown, options: ValidateGraphOptions = {}): GraphSnapshot {
  const graph = parseGraphSnapshot(input)
  const validation = validateGraph(graph, options)
  const error = validation.diagnostics.find((diagnostic) => diagnostic.severity === 'error')

  if (error) {
    throw new GraphParseError(error.path ?? 'graph', error.message, validation.diagnostics)
  }

  return graph
}

type GraphInputRecord = Record<string, unknown>

function parseGraphSnapshot(input: unknown): GraphSnapshot {
  const graph = readRecord(input, 'graph')
  assertAllowedKeys(graph, 'graph', ['schemaVersion', 'nodes', 'edges', 'groups', 'meta'])
  const schemaVersion = readString(graph.schemaVersion, 'schemaVersion')

  if (schemaVersion !== NODE_WRIGHT_GRAPH_SCHEMA_VERSION) {
    throw new GraphParseError(
      'schemaVersion',
      `unsupported schemaVersion "${schemaVersion}"; expected "${NODE_WRIGHT_GRAPH_SCHEMA_VERSION}".`,
    )
  }

  return {
    schemaVersion,
    nodes: readArray(graph.nodes, 'nodes').map((node, index) =>
      parseGraphNode(node, `nodes.${index}`),
    ),
    edges: readArray(graph.edges, 'edges').map((edge, index) =>
      parseGraphEdge(edge, `edges.${index}`),
    ),
    groups: readArray(graph.groups, 'groups').map((group, index) =>
      parseGraphGroup(group, `groups.${index}`),
    ),
    meta: parseGraphMetadata(graph.meta, 'meta'),
  }
}

function parseGraphNode(input: unknown, path: string): GraphNode {
  const node = readRecord(input, path)
  assertAllowedKeys(node, path, [
    'id',
    'type',
    'x',
    'y',
    'width',
    'height',
    'locked',
    'ports',
    'data',
    'meta',
  ])

  return removeUndefined({
    id: readNonEmptyString(node.id, `${path}.id`),
    type: readNonEmptyString(node.type, `${path}.type`),
    x: readFiniteNumber(node.x, `${path}.x`),
    y: readFiniteNumber(node.y, `${path}.y`),
    width: readOptional(node, 'width', path, readFiniteNumber),
    height: readOptional(node, 'height', path, readFiniteNumber),
    locked: readOptional(node, 'locked', path, readBoolean),
    ports: readOptional(node, 'ports', path, parseGraphPorts),
    data: readOptional(node, 'data', path, parseGraphMetadata),
    meta: readOptional(node, 'meta', path, parseGraphMetadata),
  }) as GraphNode
}

function parseGraphPorts(input: unknown, path: string): GraphPort[] {
  return readArray(input, path).map((port, index) => parseGraphPort(port, `${path}.${index}`))
}

function parseGraphPort(input: unknown, path: string): GraphPort {
  const port = readRecord(input, path)
  assertAllowedKeys(port, path, [
    'id',
    'name',
    'label',
    'direction',
    'kind',
    'side',
    'capacity',
    'required',
    'dataType',
    'accepts',
    'data',
    'meta',
  ])
  const direction = readString(port.direction, `${path}.direction`)

  if (direction !== 'input' && direction !== 'output') {
    throw new GraphParseError(`${path}.direction`, 'expected "input" or "output".')
  }

  return removeUndefined({
    id: readNonEmptyString(port.id, `${path}.id`),
    name: readOptional(port, 'name', path, readString),
    label: readOptional(port, 'label', path, readString),
    direction,
    kind: readOptional(port, 'kind', path, readString),
    side: readOptional(port, 'side', path, readPortSide),
    capacity: readOptional(port, 'capacity', path, readPortCapacity),
    required: readOptional(port, 'required', path, readBoolean),
    dataType: readOptional(port, 'dataType', path, readString),
    accepts: readOptional(port, 'accepts', path, readStringArray),
    data: readOptional(port, 'data', path, parseGraphMetadata),
    meta: readOptional(port, 'meta', path, parseGraphMetadata),
  }) as GraphPort
}

function parseGraphEdge(input: unknown, path: string): GraphEdge {
  const edge = readRecord(input, path)
  assertAllowedKeys(edge, path, ['id', 'source', 'target', 'kind', 'type', 'label', 'data', 'meta'])

  return removeUndefined({
    id: readNonEmptyString(edge.id, `${path}.id`),
    source: parseGraphEndpoint(edge.source, `${path}.source`),
    target: parseGraphEndpoint(edge.target, `${path}.target`),
    kind: readNonEmptyString(edge.kind, `${path}.kind`),
    type: readOptional(edge, 'type', path, readString),
    label: readOptional(edge, 'label', path, readString),
    data: readOptional(edge, 'data', path, parseGraphMetadata),
    meta: readOptional(edge, 'meta', path, parseGraphMetadata),
  }) as GraphEdge
}

function parseGraphEndpoint(input: unknown, path: string): GraphEndpoint {
  const endpoint = readRecord(input, path)
  assertAllowedKeys(endpoint, path, ['nodeId', 'portId'])

  return {
    nodeId: readNonEmptyString(endpoint.nodeId, `${path}.nodeId`),
    portId: readNonEmptyString(endpoint.portId, `${path}.portId`),
  }
}

function parseGraphGroup(input: unknown, path: string): GraphGroup {
  const group = readRecord(input, path)
  assertAllowedKeys(group, path, [
    'id',
    'label',
    'x',
    'y',
    'width',
    'height',
    'color',
    'nodeIds',
    'data',
    'meta',
  ])

  return removeUndefined({
    id: readNonEmptyString(group.id, `${path}.id`),
    label: readOptional(group, 'label', path, readString),
    x: readFiniteNumber(group.x, `${path}.x`),
    y: readFiniteNumber(group.y, `${path}.y`),
    width: readFiniteNumber(group.width, `${path}.width`),
    height: readFiniteNumber(group.height, `${path}.height`),
    color: readOptional(group, 'color', path, readString),
    nodeIds: readOptional(group, 'nodeIds', path, readStringArray),
    data: readOptional(group, 'data', path, parseGraphMetadata),
    meta: readOptional(group, 'meta', path, parseGraphMetadata),
  }) as GraphGroup
}

function parseGraphMetadata(input: unknown, path: string): GraphMetadata {
  const metadata = readRecord(input, path)

  return parseGraphRecord(metadata, path, new Set<object>([metadata]))
}

function parseGraphValue(input: unknown, path: string, active: Set<object>): GraphValue {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') {
    return input
  }

  if (typeof input === 'number') {
    return readFiniteNumber(input, path)
  }

  if (typeof input !== 'object') {
    throw new GraphParseError(path, 'expected a JSON-serializable value.')
  }

  if (active.has(input)) {
    throw new GraphParseError(path, 'cyclic metadata is not supported.')
  }

  active.add(input)

  try {
    if (Array.isArray(input)) {
      return input.map((entry, index) => parseGraphValue(entry, `${path}.${index}`, active))
    }

    return parseGraphRecord(readRecord(input, path), path, active)
  } finally {
    active.delete(input)
  }
}

/** Parses the entries of a record; `active` holds the records being parsed, to reject cycles. */
function parseGraphRecord(
  record: GraphInputRecord,
  path: string,
  active: Set<object>,
): Record<string, GraphValue> {
  const parsed: Record<string, GraphValue> = {}

  for (const [key, value] of Object.entries(record)) {
    parsed[key] = parseGraphValue(value, `${path}.${key}`, active)
  }

  return parsed
}

function readRecord(input: unknown, path: string): GraphInputRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GraphParseError(path, 'expected an object.')
  }

  const prototype = Object.getPrototypeOf(input)

  if (prototype !== Object.prototype && prototype !== null) {
    throw new GraphParseError(path, 'expected a plain object.')
  }

  return input as GraphInputRecord
}

function readArray(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) {
    throw new GraphParseError(path, 'expected an array.')
  }

  return input
}

function readString(input: unknown, path: string): string {
  if (typeof input !== 'string') {
    throw new GraphParseError(path, 'expected a string.')
  }

  return input
}

function readNonEmptyString(input: unknown, path: string): string {
  const value = readString(input, path)

  if (!value.trim()) {
    throw new GraphParseError(path, 'expected a non-empty string.')
  }

  return value
}

function readFiniteNumber(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new GraphParseError(path, 'expected a finite number.')
  }

  return input
}

function readBoolean(input: unknown, path: string): boolean {
  if (typeof input !== 'boolean') {
    throw new GraphParseError(path, 'expected a boolean.')
  }

  return input
}

function readPortSide(input: unknown, path: string): NonNullable<GraphPort['side']> {
  const side = readString(input, path)

  if (side !== 'top' && side !== 'right' && side !== 'bottom' && side !== 'left') {
    throw new GraphParseError(path, 'expected "top", "right", "bottom", or "left".')
  }

  return side
}

function readPortCapacity(input: unknown, path: string): NonNullable<GraphPort['capacity']> {
  if (input === 'many') {
    return input
  }

  const capacity = readFiniteNumber(input, path)

  if (capacity < 0) {
    throw new GraphParseError(path, 'expected a non-negative number or "many".')
  }

  return capacity
}

function readStringArray(input: unknown, path: string): string[] {
  return readArray(input, path).map((entry, index) => readString(entry, `${path}.${index}`))
}

function readOptional<T>(
  record: GraphInputRecord,
  key: string,
  path: string,
  parser: (input: unknown, path: string) => T,
): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? parser(record[key], `${path}.${key}`)
    : undefined
}

function removeUndefined<T extends GraphInputRecord>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

function assertAllowedKeys(record: GraphInputRecord, path: string, keys: string[]): void {
  const allowed = new Set(keys)

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new GraphParseError(`${path}.${key}`, 'unexpected property.')
    }
  }
}
