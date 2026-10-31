import type { GraphPort } from '../../protocol/index.js'
import type {
  NodeWrightCanvasNodeTheme,
  NodeWrightPortAnchor,
  NodeWrightResolvedDomNodeField,
  NodeWrightResolvedDomNodeLayout,
  NodeWrightResolvedDomNodePort,
} from '../types/index.js'
import { asRecord } from './definition.js'
import { resolveDomNodePortTop } from './layout.js'

/**
 * Colours of data ports by data type. Every entry keeps at least 3:1 contrast against both
 * built-in node backgrounds, so typed ports and edges read on the dark and the light palette.
 */
export const PORT_DATA_TYPE_COLOR_PALETTE = [
  '#3b8ae6',
  '#2b9f68',
  '#d9772b',
  '#9768ec',
  '#d94f86',
  '#1a9ba3',
  '#b88f0b',
  '#5f6fdc',
  '#d4544f',
  '#2f96c4',
  '#7f9620',
  '#b25dc8',
]

type DomPortAnchorLike = Pick<NodeWrightPortAnchor, 'connectionColor' | 'port'>

export function normalizePortDataType(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined
}

export function hashString(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash)
}

function resolveDataTypeColor(dataType: string): string {
  return PORT_DATA_TYPE_COLOR_PALETTE[
    hashString(dataType) % PORT_DATA_TYPE_COLOR_PALETTE.length
  ] as string
}

export function resolveDomNodePortColor(
  port: DomPortAnchorLike,
  theme: Pick<NodeWrightCanvasNodeTheme, 'portStroke'>,
): string {
  if (port.connectionColor) {
    return port.connectionColor
  }

  const dataType = normalizePortDataType(port.port.dataType)

  return dataType ? resolveDataTypeColor(dataType) : theme.portStroke
}

/** Explicit `port.data.color`, then `execColor` for exec ports, then a colour per data type. */
export function resolvePortSemanticColor(
  port: GraphPort | undefined,
  execColor: string,
): string | undefined {
  if (!port) {
    return undefined
  }

  const explicitColor = asRecord(port.data)?.color

  if (typeof explicitColor === 'string' && explicitColor) {
    return explicitColor
  }

  if (port.kind === 'exec') {
    return execColor
  }

  const dataType = normalizePortDataType(port.dataType)

  return dataType ? resolveDataTypeColor(dataType) : undefined
}

export function buildResolvedDomPorts(
  ports: NodeWrightPortAnchor[],
  theme: Pick<NodeWrightCanvasNodeTheme, 'portStroke'>,
  layout: NodeWrightResolvedDomNodeLayout,
): NodeWrightResolvedDomNodePort[] {
  return ports.map((port, index) => ({
    key: `${port.side}-${port.port.id}`,
    id: port.port.id,
    side: port.side,
    label: port.port.label ?? port.port.name ?? port.port.id,
    color: resolveDomNodePortColor(port, theme),
    top: resolveDomNodePortTop(index, layout),
    anchor: port,
    port: port.port,
  }))
}

export function bindDomFieldInputPorts(
  fields: NodeWrightResolvedDomNodeField[],
  inputs: NodeWrightResolvedDomNodePort[],
): NodeWrightResolvedDomNodeField[] {
  const inputPortMap = new Map(inputs.map((port) => [port.id, port]))

  return fields.map((field) => ({
    ...field,
    inputPort: field.inputPortId ? inputPortMap.get(field.inputPortId) : undefined,
  }))
}
