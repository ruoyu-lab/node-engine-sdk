import type { GraphValue } from '../../protocol/index.js'
import type {
  NodeEngineResolvedDomNodeField,
  NodeEngineResolvedDomNodeModel,
  NodeEngineResolvedDomNodePort,
  NodeEngineStyleDeclaration,
} from '../types/index.js'
import { CANVAS_FONT_FAMILY } from '../rendering/color.js'

/** Pure presentation rules shared by every adapter's default DOM node component. */

export type DomTimeSegment = 'hours' | 'minutes'

const NUMBER_DRAG_PIXELS_PER_STEP = 14
/** Font of `.ne-default-dom-node__field-label`; the label column is measured with it. */
const FIELD_LABEL_FONT = `500 11px ${CANVAS_FONT_FAMILY}`
const FIELD_INPUT_PORT_WIDTH = 18
const MIN_FIELD_LABEL_COLUMN_WIDTH = 56

/** Inline style of a port dot: the port's colour as `--ne-port-color`; states are classes. */
export function resolveDomPortDotStyle(
  port: NodeEngineResolvedDomNodePort,
): NodeEngineStyleDeclaration {
  return { '--ne-port-color': port.color }
}

/** State classes of a port column dot (`ne-default-dom-node__port-dot--*`). */
export function resolveDomPortDotClass(
  port: NodeEngineResolvedDomNodePort,
): Record<string, boolean> {
  return resolvePortStateClass('ne-default-dom-node__port-dot', port)
}

/** State classes of a parameter input port dot (`ne-default-dom-node__field-port-dot--*`). */
export function resolveDomFieldPortDotClass(
  port: NodeEngineResolvedDomNodePort,
): Record<string, boolean> {
  return resolvePortStateClass('ne-default-dom-node__field-port-dot', port)
}

/** State classes of a port label (`ne-default-dom-node__port-label--*`). */
export function resolveDomPortLabelClass(
  port: NodeEngineResolvedDomNodePort,
): Record<string, boolean> {
  return {
    'ne-default-dom-node__port-label--active': port.active === true,
    'ne-default-dom-node__port-label--incompatible': port.connectable === false,
  }
}

/**
 * `exec` ports have their own shape; `connected` ports are filled; while a connection is dragged
 * the dragged ports are `active` and every candidate is `compatible` or `incompatible`.
 */
function resolvePortStateClass(
  block: string,
  port: NodeEngineResolvedDomNodePort,
): Record<string, boolean> {
  return {
    [`${block}--exec`]: port.port.kind === 'exec',
    [`${block}--connected`]: (port.anchor.connectionCount ?? 0) > 0,
    [`${block}--active`]: port.active === true,
    [`${block}--compatible`]: port.connectable === true,
    [`${block}--incompatible`]: port.connectable === false,
  }
}

export function resolveDomFieldRowClass(
  field: NodeEngineResolvedDomNodeField,
): Record<string, boolean> {
  return {
    'ne-default-dom-node__field--textarea': field.kind === 'textarea',
    'ne-default-dom-node__field--image': field.kind === 'image',
    'ne-default-dom-node__field--driven': field.driven,
    'ne-default-dom-node__field--has-input': Boolean(field.inputPort),
  }
}

export function resolveDomFieldControlClass(
  field: NodeEngineResolvedDomNodeField,
): Record<string, boolean> {
  return {
    'ne-default-dom-node__field-control--highlighted': field.highlighted,
    'ne-default-dom-node__field-control--textarea': field.kind === 'textarea',
    'ne-default-dom-node__field-control--range': field.kind === 'range',
    'ne-default-dom-node__field-control--number': field.kind === 'number',
    'ne-default-dom-node__field-control--time': field.kind === 'time',
    'ne-default-dom-node__field-control--select': field.kind === 'select',
    'ne-default-dom-node__field-control--text': field.kind === 'text',
    'ne-default-dom-node__field-control--boolean': field.kind === 'boolean',
  }
}

export function resolveDomFieldRowStyle(
  field: NodeEngineResolvedDomNodeField,
): NodeEngineStyleDeclaration {
  return {
    height: `${field.height}px`,
    minHeight: `${field.height}px`,
  }
}

/** Positions the field section and sizes its label column to the widest non-textarea label. */
export function resolveDomFieldsStyle(
  model: NodeEngineResolvedDomNodeModel,
  measureLabel: (label: string) => number = measureDomFieldLabel,
): NodeEngineStyleDeclaration {
  const inset = Math.max(8, model.layout.portInset - 5)
  const labelColumnWidth = Math.max(
    MIN_FIELD_LABEL_COLUMN_WIDTH,
    ...model.fields
      .filter((field) => field.kind !== 'textarea')
      .map((field) => measureLabel(field.label) + FIELD_INPUT_PORT_WIDTH + 8),
  )

  return {
    top: `${model.fieldsTop}px`,
    left: `${inset}px`,
    right: `${inset}px`,
    bottom: `${model.layout.bottomPadding}px`,
    gap: `${model.layout.fieldRowGap}px`,
    '--ne-field-label-column-width': `${labelColumnWidth}px`,
  }
}

let labelMeasureContext: CanvasRenderingContext2D | null | undefined

/** Measures a field label with the default node font; estimates when no canvas is available. */
export function measureDomFieldLabel(label: string): number {
  if (labelMeasureContext === undefined) {
    labelMeasureContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')

    if (labelMeasureContext) {
      labelMeasureContext.font = FIELD_LABEL_FONT
    }
  }

  return labelMeasureContext
    ? Math.ceil(labelMeasureContext.measureText(label).width)
    : label.length * 10
}

export function resolveDomFieldImageUrl(field: NodeEngineResolvedDomNodeField): string | null {
  const value = field.resolvedValue
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function resolveDomFieldImageAspectStyle(
  field: NodeEngineResolvedDomNodeField,
): NodeEngineStyleDeclaration | undefined {
  if (field.kind !== 'image' || typeof field.aspectRatio !== 'number' || !(field.aspectRatio > 0)) {
    return undefined
  }

  return { aspectRatio: String(field.aspectRatio) }
}

export function resolveDomFieldDisplayValue(field: NodeEngineResolvedDomNodeField): string {
  if (field.kind === 'boolean') {
    return field.resolvedValue === true ? 'ON' : 'OFF'
  }

  return field.resolvedTextValue
}

export function resolveDomFieldRangeProgress(field: NodeEngineResolvedDomNodeField): number {
  if (field.kind !== 'range' || typeof field.resolvedValue !== 'number') {
    return 0
  }

  const min = typeof field.min === 'number' ? field.min : 0
  const max = typeof field.max === 'number' ? field.max : 100

  if (max <= min) {
    return 0
  }

  return Math.min(Math.max(((field.resolvedValue - min) / (max - min)) * 100, 0), 100)
}

export function resolveDomFieldStringValue(field: NodeEngineResolvedDomNodeField): string {
  return typeof field.resolvedValue === 'string'
    ? field.resolvedValue
    : field.resolvedValue == null
      ? ''
      : String(field.resolvedValue)
}

export function resolveDomFieldNumberValue(field: NodeEngineResolvedDomNodeField): number {
  return typeof field.resolvedValue === 'number'
    ? field.resolvedValue
    : Number(field.resolvedValue ?? 0)
}

export function resolveDomFieldStep(field: NodeEngineResolvedDomNodeField): number {
  const step = typeof field.step === 'number' ? field.step : 1

  return Number.isFinite(step) && step > 0 ? step : 1
}

/** Clamps to the field range, then snaps to the step grid anchored at `min` (or 0). */
export function normalizeDomFieldNumber(
  field: NodeEngineResolvedDomNodeField,
  value: number,
): number {
  let nextValue = value

  if (typeof field.min === 'number') {
    nextValue = Math.max(field.min, nextValue)
  }

  if (typeof field.max === 'number') {
    nextValue = Math.min(field.max, nextValue)
  }

  const step = resolveDomFieldStep(field)
  const base = typeof field.min === 'number' ? field.min : 0
  const decimals = step.toString().split('.')[1]?.length ?? 0
  const aligned = base + Math.round((nextValue - base) / step) * step

  return Number(aligned.toFixed(decimals))
}

/** Keeps digits, a single dot and a leading minus sign. */
export function sanitizeDomNumberDraft(rawValue: string): string {
  let result = ''
  let hasDot = false

  for (const char of rawValue) {
    if (char >= '0' && char <= '9') {
      result += char
      continue
    }

    if (char === '.' && !hasDot) {
      hasDot = true
      result += char
      continue
    }

    if (char === '-' && result.length === 0) {
      result += char
    }
  }

  return result
}

/** Value for a number field dragged horizontally by `deltaX` pixels from `startValue`. */
export function resolveDomNumberDragValue(
  field: NodeEngineResolvedDomNodeField,
  startValue: number,
  deltaX: number,
): { stepDelta: number; value: number } {
  const stepDelta = Math.trunc(deltaX / NUMBER_DRAG_PIXELS_PER_STEP)

  return {
    stepDelta,
    value: normalizeDomFieldNumber(field, startValue + stepDelta * resolveDomFieldStep(field)),
  }
}

export function resolveDomFieldOptionValue(
  field: NodeEngineResolvedDomNodeField,
  rawValue: string,
): GraphValue {
  const match = field.options?.find((option) => String(option.value ?? '') === rawValue)
  return match ? match.value : rawValue
}

export function isDomFieldOptionSelected(
  field: NodeEngineResolvedDomNodeField,
  optionValue: GraphValue,
): boolean {
  return String(optionValue ?? '') === String(field.resolvedValue ?? '')
}

export function resolveDomSelectedOptionLabel(field: NodeEngineResolvedDomNodeField): string {
  const match = field.options?.find(
    (option) =>
      option.value === field.resolvedValue || isDomFieldOptionSelected(field, option.value),
  )

  return match?.label ?? resolveDomFieldDisplayValue(field)
}

export function parseDomTimeValue(
  field: NodeEngineResolvedDomNodeField,
): Record<DomTimeSegment, string> {
  const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(resolveDomFieldStringValue(field).trim())

  return {
    hours: match?.[1] ?? '00',
    minutes: match?.[2] ?? '00',
  }
}

export function sanitizeDomTimeSegment(rawValue: string): string {
  return rawValue.replace(/\D+/g, '').slice(0, 2)
}

export function normalizeDomTimeSegment(rawValue: string, max: number): string {
  const digits = sanitizeDomTimeSegment(rawValue)

  if (!digits) {
    return '00'
  }

  return String(Math.min(max, Math.max(0, Number(digits)))).padStart(2, '0')
}
