import type {
  NodeEngineDomNodeLayoutDefinition,
  NodeEngineDomNodeSizeConstraints,
  NodeEngineResolvedDomNodeField,
  NodeEngineResolvedDomNodeLayout,
  NodeEngineResolvedDomNodePort,
} from '../types/index.js'

export const DEFAULT_DOM_MIN_WIDTH = 120
export const DEFAULT_DOM_MIN_HEIGHT = 72
export const DEFAULT_DOM_HEADER_HEIGHT = 32
export const DEFAULT_DOM_PORT_TOP_OFFSET = 15
export const DEFAULT_DOM_PORT_GAP = 24
export const DEFAULT_DOM_PORT_INSET = 14
export const DEFAULT_DOM_PORT_BOTTOM_PADDING = 28
export const DEFAULT_DOM_FIELD_PORT_GAP = 24
export const DEFAULT_DOM_MIN_FIELDS_TOP = 48
export const DEFAULT_DOM_BOTTOM_PADDING = 10
export const DEFAULT_DOM_FIELD_ROW_HEIGHT = 47
export const DEFAULT_DOM_FIELD_ROW_GAP = 8
const DEFAULT_DOM_SIDE_PADDING = 20
const DEFAULT_DOM_PORT_COLUMN_GAP = 56
const DEFAULT_DOM_TEXT_CHAR_WIDTH = 7.2
const DEFAULT_DOM_TITLE_EXTRA_WIDTH = 46
const DEFAULT_DOM_FIELD_EXTRA_WIDTH = 28
const DEFAULT_DOM_PORT_EXTRA_WIDTH = 26
const DEFAULT_DOM_FIELD_PORT_GAP_X = 8
const DEFAULT_DOM_FIELD_TEXTAREA_HEIGHT = 88
const DEFAULT_DOM_FIELD_BOOLEAN_HEIGHT = 26
const DEFAULT_DOM_FIELD_RANGE_HEIGHT = 26
const DEFAULT_DOM_FIELD_IMAGE_HEIGHT = 220
const DEFAULT_DOM_FIELD_DEFAULT_HEIGHT = 26
const DEFAULT_DOM_FIELD_TEXTAREA_WIDTH = 204
const DEFAULT_DOM_FIELD_RANGE_WIDTH = 162
const DEFAULT_DOM_FIELD_BOOLEAN_WIDTH = 92
const DEFAULT_DOM_FIELD_TIME_WIDTH = 130
const DEFAULT_DOM_FIELD_SELECT_WIDTH = 156
const DEFAULT_DOM_FIELD_IMAGE_WIDTH = 240
const DEFAULT_DOM_FIELD_DEFAULT_WIDTH = 140

export interface DomNodeContent {
  title: string
  inputs: NodeEngineResolvedDomNodePort[]
  outputs: NodeEngineResolvedDomNodePort[]
  fields: NodeEngineResolvedDomNodeField[]
}

export function resolveDomNodeLayoutDefinition(
  value: NodeEngineDomNodeLayoutDefinition | undefined,
  override?: Partial<NodeEngineDomNodeLayoutDefinition>,
): NodeEngineResolvedDomNodeLayout {
  const headerHeight = Math.max(
    override?.headerHeight ?? value?.headerHeight ?? DEFAULT_DOM_HEADER_HEIGHT,
    0,
  )
  const portTop = Math.max(
    override?.portTop ?? value?.portTop ?? headerHeight + DEFAULT_DOM_PORT_TOP_OFFSET,
    headerHeight,
  )

  return {
    headerHeight,
    portTop,
    portGap: Math.max(override?.portGap ?? value?.portGap ?? DEFAULT_DOM_PORT_GAP, 1),
    portInset: Math.max(override?.portInset ?? value?.portInset ?? DEFAULT_DOM_PORT_INSET, 0),
    portBottomPadding: Math.max(
      override?.portBottomPadding ?? value?.portBottomPadding ?? DEFAULT_DOM_PORT_BOTTOM_PADDING,
      0,
    ),
    fieldPortGap: Math.max(
      override?.fieldPortGap ?? value?.fieldPortGap ?? DEFAULT_DOM_FIELD_PORT_GAP,
      0,
    ),
    minFieldsTop: Math.max(
      override?.minFieldsTop ?? value?.minFieldsTop ?? DEFAULT_DOM_MIN_FIELDS_TOP,
      0,
    ),
    bottomPadding: Math.max(
      override?.bottomPadding ?? value?.bottomPadding ?? DEFAULT_DOM_BOTTOM_PADDING,
      0,
    ),
    fieldRowHeight: Math.max(
      override?.fieldRowHeight ?? value?.fieldRowHeight ?? DEFAULT_DOM_FIELD_ROW_HEIGHT,
      1,
    ),
    fieldRowGap: Math.max(
      override?.fieldRowGap ?? value?.fieldRowGap ?? DEFAULT_DOM_FIELD_ROW_GAP,
      0,
    ),
    minWidth: Math.max(override?.minWidth ?? value?.minWidth ?? 0, 0),
    minHeight: Math.max(override?.minHeight ?? value?.minHeight ?? 0, 0),
  }
}

export function resolveDomNodePortTop(
  index: number,
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'portTop' | 'portGap'>,
): number {
  return layout.portTop + Math.max(index, 0) * layout.portGap
}

export function resolveDomNodePortsBottom(
  portCount: number,
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'headerHeight' | 'portTop' | 'portGap'>,
): number {
  if (portCount <= 0) {
    return layout.headerHeight
  }

  return resolveDomNodePortTop(portCount - 1, layout)
}

export function resolveFieldsTop(
  inputs: NodeEngineResolvedDomNodePort[],
  outputs: NodeEngineResolvedDomNodePort[],
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'minFieldsTop' | 'fieldPortGap'>,
): number {
  const allPorts = [...inputs, ...outputs]

  if (!allPorts.length) {
    return layout.minFieldsTop
  }

  return Math.max(
    layout.minFieldsTop,
    Math.max(...allPorts.map((port) => port.top)) + layout.fieldPortGap,
  )
}

/** Estimates the minimum node size that fits the title, port columns and every field row. */
export function resolveDomNodeSizeConstraintsFromLayout(
  layout: NodeEngineResolvedDomNodeLayout,
  content: DomNodeContent,
): NodeEngineDomNodeSizeConstraints {
  const portCount = Math.max(content.inputs.length, content.outputs.length)
  const portsBottom = resolveDomNodePortsBottom(portCount, layout)
  const fieldsTop = resolveFieldsTop(content.inputs, content.outputs, layout)
  const fieldsHeight = resolveDomFieldsHeight(content.fields, layout)
  const contentHeight =
    content.fields.length > 0
      ? fieldsTop + fieldsHeight + layout.bottomPadding
      : portsBottom + layout.portBottomPadding
  const titleWidth = estimateDomTextWidth(content.title) + DEFAULT_DOM_TITLE_EXTRA_WIDTH
  const portsWidth =
    resolveDomPortColumnWidth(content.inputs) +
    resolveDomPortColumnWidth(content.outputs) +
    (content.inputs.length && content.outputs.length ? DEFAULT_DOM_PORT_COLUMN_GAP : 0) +
    DEFAULT_DOM_SIDE_PADDING * 2
  const fieldsWidth = resolveDomFieldsWidth(content.fields) + DEFAULT_DOM_SIDE_PADDING * 2

  return {
    minWidth: Math.max(layout.minWidth, titleWidth, portsWidth, fieldsWidth),
    minHeight: Math.max(layout.minHeight, contentHeight, portsBottom + layout.portBottomPadding),
  }
}

/**
 * Stacks field rows from `fieldsTop`; the last stretchable row (textarea or image) absorbs the
 * remaining height so the fields fill the node.
 */
export function positionDomFields(
  fields: NodeEngineResolvedDomNodeField[],
  fieldsTop: number,
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'fieldRowGap'>,
  extraHeight: number,
): NodeEngineResolvedDomNodeField[] {
  let stretchableIndex = -1

  for (let index = fields.length - 1; index >= 0; index -= 1) {
    const kind = fields[index]?.kind

    if (kind === 'textarea' || kind === 'image') {
      stretchableIndex = index
      break
    }
  }

  let nextTop = fieldsTop

  return fields.map((field, index) => {
    const height =
      resolveDomFieldVisualHeight(field) + (index === stretchableIndex ? extraHeight : 0)
    const top = nextTop

    nextTop += height + (index < fields.length - 1 ? layout.fieldRowGap : 0)

    return {
      ...field,
      top,
      height,
    }
  })
}

export function resolveVisibleDomFieldCount(
  fields: NodeEngineResolvedDomNodeField[],
  availableHeight: number,
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'fieldRowGap'>,
): number {
  if (!fields.length || availableHeight <= 0) {
    return 0
  }

  let usedHeight = 0
  let count = 0

  for (const field of fields) {
    const nextHeight = resolveDomFieldVisualHeight(field)
    const gap = count > 0 ? layout.fieldRowGap : 0

    if (usedHeight + gap + nextHeight > availableHeight) {
      break
    }

    usedHeight += gap + nextHeight
    count += 1
  }

  return count
}

export function resolveDomFieldsHeight(
  fields: NodeEngineResolvedDomNodeField[],
  layout: Pick<NodeEngineResolvedDomNodeLayout, 'fieldRowGap'>,
): number {
  return fields.reduce((total, field, index) => {
    const gap = index > 0 ? layout.fieldRowGap : 0
    return total + gap + resolveDomFieldVisualHeight(field)
  }, 0)
}

function resolveDomFieldsWidth(fields: NodeEngineResolvedDomNodeField[]): number {
  if (!fields.length) {
    return 0
  }

  return Math.max(
    ...fields.map((field) => {
      const labelWidth = estimateDomTextWidth(field.label)
      const controlWidth = resolveDomFieldControlWidth(field)
      const fieldReservesPortSlot = field.kind !== 'textarea' && field.kind !== 'image'
      const inputPortWidth =
        field.inputPort || fieldReservesPortSlot
          ? DEFAULT_DOM_PORT_EXTRA_WIDTH + DEFAULT_DOM_FIELD_PORT_GAP_X
          : 0

      return Math.max(labelWidth + inputPortWidth + 8, controlWidth + inputPortWidth)
    }),
  )
}

function resolveDomFieldVisualHeight(field: NodeEngineResolvedDomNodeField): number {
  if (field.height > 0) {
    return field.height
  }

  switch (field.kind) {
    case 'textarea':
      return DEFAULT_DOM_FIELD_TEXTAREA_HEIGHT
    case 'boolean':
      return DEFAULT_DOM_FIELD_BOOLEAN_HEIGHT
    case 'range':
      return DEFAULT_DOM_FIELD_RANGE_HEIGHT
    case 'image':
      return DEFAULT_DOM_FIELD_IMAGE_HEIGHT
    default:
      return DEFAULT_DOM_FIELD_DEFAULT_HEIGHT
  }
}

function resolveDomFieldControlWidth(field: NodeEngineResolvedDomNodeField): number {
  const textWidth = estimateDomTextWidth(field.textValue)
  const optionWidth = Math.max(
    0,
    ...(field.options ?? []).map((option) => estimateDomTextWidth(option.label)),
  )

  switch (field.kind) {
    case 'textarea':
      return DEFAULT_DOM_FIELD_TEXTAREA_WIDTH
    case 'range':
      return DEFAULT_DOM_FIELD_RANGE_WIDTH
    case 'boolean':
      return DEFAULT_DOM_FIELD_BOOLEAN_WIDTH
    case 'time':
      return Math.max(DEFAULT_DOM_FIELD_TIME_WIDTH, Math.min(textWidth + 28, 176))
    case 'select':
      return Math.max(
        DEFAULT_DOM_FIELD_SELECT_WIDTH,
        Math.min(Math.max(textWidth, optionWidth) + 36, 240),
      )
    case 'image':
      return DEFAULT_DOM_FIELD_IMAGE_WIDTH
    default:
      return Math.max(
        DEFAULT_DOM_FIELD_DEFAULT_WIDTH,
        Math.min(textWidth + DEFAULT_DOM_FIELD_EXTRA_WIDTH, 240),
      )
  }
}

function resolveDomPortColumnWidth(ports: NodeEngineResolvedDomNodePort[]): number {
  if (!ports.length) {
    return 0
  }

  return Math.max(
    ...ports.map((port) => estimateDomTextWidth(port.label) + DEFAULT_DOM_PORT_EXTRA_WIDTH),
  )
}

function estimateDomTextWidth(value: string | undefined): number {
  if (!value) {
    return 0
  }

  return Math.ceil(value.trim().length * DEFAULT_DOM_TEXT_CHAR_WIDTH)
}
