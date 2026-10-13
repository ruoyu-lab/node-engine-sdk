import type {
  ConnectionValidationResult,
  GraphEndpoint,
  GraphNode,
  GraphPort,
  GraphSnapshot,
} from '../../protocol/index.js'
import type { NodeEnginePortAnchor, NodeEngineResolvedDomNodeModel } from '../types/index.js'
import { asRecord } from './definition.js'
import { formatDomFieldValue } from './fields.js'

/**
 * Live state layered on top of a cached DOM node model: values driven through connected field
 * input ports, and port highlighting while a connection is being dragged.
 */

export function applyDomFieldDriveState(
  model: NodeEngineResolvedDomNodeModel,
  graph: GraphSnapshot,
  resolvePort: (endpoint: GraphEndpoint) => GraphPort | undefined,
  resolveValue: (
    graph: GraphSnapshot,
    endpoint: GraphEndpoint,
    port: GraphPort | undefined,
  ) => unknown,
): NodeEngineResolvedDomNodeModel {
  const fields = model.fields.map((field) => {
    if (!field.inputPort) {
      return field
    }

    const incomingEdge = findIncomingEdge(graph, field.inputPort.anchor.endpoint)

    if (!incomingEdge) {
      if (
        !field.driven &&
        field.resolvedValue === field.value &&
        field.resolvedTextValue === field.textValue &&
        !field.driveSource
      ) {
        return field
      }

      return {
        ...field,
        resolvedValue: field.value,
        resolvedTextValue: field.textValue,
        driven: false,
        driveSource: undefined,
      }
    }

    const sourcePort = resolvePort(incomingEdge.source)
    const resolvedValue = resolveValue(graph, incomingEdge.source, sourcePort)
    const resolvedTextValue =
      resolvedValue === undefined ? (field.placeholder ?? '') : formatDomFieldValue(resolvedValue)

    if (
      field.driven &&
      field.driveSource?.edgeId === incomingEdge.id &&
      endpointMatches(field.driveSource.source, incomingEdge.source) &&
      endpointMatches(field.driveSource.target, incomingEdge.target) &&
      field.driveSource.sourcePort?.id === sourcePort?.id &&
      field.resolvedValue === resolvedValue &&
      field.resolvedTextValue === resolvedTextValue
    ) {
      return field
    }

    return {
      ...field,
      resolvedValue,
      resolvedTextValue,
      driven: true,
      driveSource: {
        edgeId: incomingEdge.id,
        source: incomingEdge.source,
        target: incomingEdge.target,
        sourcePort,
      },
    }
  })

  const unchanged = fields.every((field, index) => field === model.fields[index])

  return unchanged ? model : { ...model, fields }
}

export function applyDomConnectionState(
  model: NodeEngineResolvedDomNodeModel,
  options: {
    source?: GraphEndpoint
    target?: GraphEndpoint
    targetDirection: GraphPort['direction'] | null
    validate: (endpoint: GraphEndpoint) => {
      validation: ConnectionValidationResult
    } | null
  },
): NodeEngineResolvedDomNodeModel {
  if (!options.source && !options.target) {
    return model
  }

  const resolvePortState = <
    Port extends {
      anchor: { endpoint: GraphEndpoint }
    },
  >(
    port: Port,
  ): Port & {
    active: boolean
    connectable: boolean | null
    connectionValidation: ConnectionValidationResult | null
  } => {
    const active =
      endpointMatches(port.anchor.endpoint, options.source) ||
      endpointMatches(port.anchor.endpoint, options.target)
    const preview =
      options.source && portDirectionMatches(port.anchor.endpoint, options.targetDirection, model)
        ? options.validate(port.anchor.endpoint)
        : null

    return {
      ...port,
      active,
      connectable: preview ? preview.validation.valid : null,
      connectionValidation: preview?.validation ?? null,
    }
  }

  return {
    ...model,
    inputs: model.inputs.map(resolvePortState),
    outputs: model.outputs.map(resolvePortState),
    fields: model.fields.map((field) =>
      field.inputPort ? { ...field, inputPort: resolvePortState(field.inputPort) } : field,
    ),
  }
}

function portDirectionMatches(
  endpoint: GraphEndpoint,
  targetDirection: GraphPort['direction'] | null,
  model: NodeEngineResolvedDomNodeModel,
): boolean {
  if (!targetDirection) {
    return false
  }

  const ports = targetDirection === 'input' ? model.inputs : model.outputs

  return (
    ports.some((port) => endpointMatches(port.anchor.endpoint, endpoint)) ||
    model.fields.some(
      (field) =>
        targetDirection === 'input' && endpointMatches(field.inputPort?.anchor.endpoint, endpoint),
    )
  )
}

export function resolveDefaultConnectedPortValue(
  node: GraphNode | undefined,
  port: GraphPort | undefined,
): unknown {
  if (!node) {
    return undefined
  }

  const nodeData = asRecord(node.data)
  const params = asRecord(nodeData?.params)
  const portData = asRecord(port?.data)

  if (portData?.value !== undefined) {
    return portData.value
  }

  const explicitKey = readString(portData?.valueKey)

  if (explicitKey) {
    const explicitValue = readBoundValue(nodeData, params, explicitKey)

    if (explicitValue !== undefined) {
      return explicitValue
    }
  }

  const candidateKeys = dedupeStrings([
    readString(portData?.domFieldKey),
    readString(portData?.fieldKey),
    readString(portData?.key),
    readString(port?.name),
    readString(port?.id),
  ])

  for (const key of candidateKeys) {
    const value = readBoundValue(nodeData, params, key)

    if (value !== undefined) {
      return value
    }
  }

  return params?.value ?? nodeData?.value
}

export function endpointMatches(
  left: GraphEndpoint | undefined | null,
  right: GraphEndpoint | undefined | null,
): boolean {
  return Boolean(left && right && left.nodeId === right.nodeId && left.portId === right.portId)
}

/** Stable signature of everything about a node's ports that affects its DOM model. */
export function buildDomNodePortSignature(ports: NodeEnginePortAnchor[], nodeY: number): string {
  return ports
    .map((port) =>
      [
        port.side,
        port.port.id,
        port.port.label ?? port.port.name ?? '',
        typeof port.port.dataType === 'string' ? port.port.dataType : '',
        port.connectionColor ?? '',
        Math.round((port.y - nodeY) * 100) / 100,
      ].join(':'),
    )
    .join('|')
}

function findIncomingEdge(graph: GraphSnapshot, endpoint: GraphEndpoint) {
  for (let index = graph.edges.length - 1; index >= 0; index -= 1) {
    const edge = graph.edges[index]

    if (!edge) {
      continue
    }

    if (endpointMatches(edge.target, endpoint)) {
      return edge
    }
  }

  return undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readBoundValue(
  nodeData: Record<string, unknown> | undefined,
  params: Record<string, unknown> | undefined,
  key: string,
): unknown {
  if (params && Object.prototype.hasOwnProperty.call(params, key)) {
    return params[key]
  }

  return nodeData && Object.prototype.hasOwnProperty.call(nodeData, key) ? nodeData[key] : undefined
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}
