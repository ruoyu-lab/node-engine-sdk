import type { GraphMetadata, NodeParameterDefinition } from '../../protocol/index.js'
import { resolveNodeParameterInputPortId } from '../../protocol/index.js'
import type {
  NodeWrightDomFieldDefinition,
  NodeWrightDomNodeDefinition,
  NodeWrightDomNodeFieldSource,
  NodeWrightDomNodeRenderContext,
  NodeWrightResolvedDomNodeField,
} from '../types/index.js'
import { asRecord } from './definition.js'
import {
  readParameterUiString,
  resolveParameterControlKind,
  resolveParameterLabel,
} from './parameter-display.js'

/**
 * Builds one display field per `NodeDefinition.parameters` entry. DOM field definitions are only
 * display hints for the parameter with the same key; raw node data never creates fields.
 */
export function resolveDomNodeFields(
  context: Pick<NodeWrightDomNodeRenderContext, 'node' | 'schema'>,
  domDefinition: NodeWrightDomNodeDefinition,
): NodeWrightResolvedDomNodeField[] {
  const hints = new Map((domDefinition.fields ?? []).map((hint) => [hint.key, hint]))
  const fieldSource = domDefinition.fieldSource ?? 'auto'

  return (context.schema?.parameters ?? [])
    .map((parameter) => ({ parameter, hint: hints.get(parameter.key) }))
    .sort((left, right) => (left.hint?.order ?? 0) - (right.hint?.order ?? 0))
    .map(({ parameter, hint }) =>
      resolveParameterField(
        lookupDomFieldValue(context.node.data, parameter.key, fieldSource),
        parameter,
        hint,
        resolveNodeParameterInputPortId(context.schema, parameter),
      ),
    )
}

export function formatDomFieldValue(value: unknown): string {
  if (typeof value === 'number') {
    // As it is, every digit it has, but the noise of binary fractions (0.1 + 0.2 shows 0.3).
    return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)))
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'string') {
    return value
  }

  if (value == null) {
    return ''
  }

  return String(value)
}

/** The parameter supplies identity, value domain and defaults; the hint only changes display. */
function resolveParameterField(
  value: unknown,
  parameter: NodeParameterDefinition,
  hint: NodeWrightDomFieldDefinition | undefined,
  inputPortId: string | undefined,
): NodeWrightResolvedDomNodeField {
  const placeholder = hint?.placeholder ?? readParameterUiString(parameter, 'placeholder')
  const textValue = value === undefined ? (placeholder ?? '') : formatDomFieldValue(value)

  return {
    key: parameter.key,
    label: hint?.label ?? resolveParameterLabel(parameter),
    description: hint?.description ?? readParameterUiString(parameter, 'description'),
    kind: hint?.kind ?? resolveParameterControlKind(parameter.kind),
    inputPortId,
    inputPort: undefined,
    top: 0,
    height: 0,
    value,
    textValue,
    resolvedValue: value,
    resolvedTextValue: textValue,
    driven: false,
    driveSource: undefined,
    placeholder,
    highlighted: hint?.highlighted ?? false,
    options: parameter.options,
    min: hint?.min,
    max: hint?.max,
    step: hint?.step,
    aspectRatio: hint?.aspectRatio,
    fit: hint?.fit,
    downloadable: hint?.downloadable,
    openable: hint?.openable,
    emptyHint: hint?.emptyHint,
  }
}

function lookupDomFieldValue(
  source: GraphMetadata | undefined,
  key: string,
  fieldSource: NodeWrightDomNodeFieldSource,
): unknown {
  const record = asRecord(source)

  if (!record) {
    return undefined
  }

  if (fieldSource === 'params') {
    return asRecord(record.params)?.[key]
  }

  if (fieldSource === 'data') {
    return record[key]
  }

  if (fieldSource === 'none') {
    return undefined
  }

  const params = asRecord(record.params)

  if (params && key in params) {
    return params[key]
  }

  return record[key]
}
