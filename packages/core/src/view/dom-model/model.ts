import type {
  NodeWrightDomNodeDefinition,
  NodeWrightDomNodeLayoutDefinition,
  NodeWrightDomNodeRenderContext,
  NodeWrightDomNodeSizeConstraints,
  NodeWrightResolvedDomNodeLayout,
  NodeWrightResolvedDomNodeModel,
} from '../types/index.js'
import {
  resolveDomNodeDefinition,
  resolveDomNodeSubtitle,
  resolveDomNodeTitle,
  resolveNodeAccent,
} from './definition.js'
import { resolveDomNodeFields } from './fields.js'
import {
  positionDomFields,
  resolveDomFieldsHeight,
  resolveDomNodeLayoutDefinition,
  resolveDomNodeSizeConstraintsFromLayout,
  resolveFieldsTop,
  resolveVisibleDomFieldCount,
  type DomNodeContent,
} from './layout.js'
import { bindDomFieldInputPorts, buildResolvedDomPorts } from './ports.js'

/**
 * Resolves the complete, framework-independent model a DOM node component renders: title,
 * port rows, parameter fields with their bound input ports, and row positions.
 */
export function resolveDomNodeModel(
  context: NodeWrightDomNodeRenderContext,
  options?: Partial<NodeWrightDomNodeLayoutDefinition>,
): NodeWrightResolvedDomNodeModel {
  const domDefinition = resolveDomNodeDefinition(context)
  const layout = resolveDomNodeLayoutDefinition(domDefinition.layout, options)
  const content = resolveDomNodeContent(context, domDefinition, layout)
  const constraints = resolveDomNodeSizeConstraintsFromLayout(layout, content)
  const fieldsTop = resolveFieldsTop(content.inputs, content.outputs, layout)
  const availableHeight = context.bounds.height - fieldsTop - layout.bottomPadding
  const maxVisibleByHeight = resolveVisibleDomFieldCount(content.fields, availableHeight, layout)
  const visibleLimit =
    typeof domDefinition.maxVisibleFields === 'number'
      ? Math.max(0, Math.min(domDefinition.maxVisibleFields, maxVisibleByHeight))
      : maxVisibleByHeight
  const visibleFields = content.fields.slice(0, visibleLimit)
  const fields = positionDomFields(
    visibleFields,
    fieldsTop,
    layout,
    Math.max(0, availableHeight - resolveDomFieldsHeight(visibleFields, layout)),
  )

  return {
    title: content.title,
    subtitle: resolveDomNodeSubtitle(context, domDefinition),
    accent: resolveNodeAccent(context.node, context.definition),
    fieldSource: domDefinition.fieldSource ?? 'auto',
    layout,
    minWidth: constraints.minWidth,
    minHeight: constraints.minHeight,
    fieldsTop,
    maxVisibleFields: visibleLimit,
    inputs: content.inputs,
    outputs: content.outputs,
    fields,
  }
}

export function resolveDomNodeLayout(
  context: NodeWrightDomNodeRenderContext,
  options?: Partial<NodeWrightDomNodeLayoutDefinition>,
): NodeWrightResolvedDomNodeLayout {
  return resolveDomNodeLayoutDefinition(resolveDomNodeDefinition(context).layout, options)
}

export function resolveDomNodeSizeConstraints(
  context: NodeWrightDomNodeRenderContext,
  options?: Partial<NodeWrightDomNodeLayoutDefinition>,
): NodeWrightDomNodeSizeConstraints {
  const domDefinition = resolveDomNodeDefinition(context)
  const layout = resolveDomNodeLayoutDefinition(domDefinition.layout, options)

  return resolveDomNodeSizeConstraintsFromLayout(
    layout,
    resolveDomNodeContent(context, domDefinition, layout),
  )
}

/** Input ports that are bound to a field row are rendered by that row, not the port column. */
function resolveDomNodeContent(
  context: NodeWrightDomNodeRenderContext,
  domDefinition: NodeWrightDomNodeDefinition,
  layout: NodeWrightResolvedDomNodeLayout,
): DomNodeContent {
  const inputs = buildResolvedDomPorts(context.inputs, context.theme, layout)
  const outputs = buildResolvedDomPorts(context.outputs, context.theme, layout)
  const fields = bindDomFieldInputPorts(resolveDomNodeFields(context, domDefinition), inputs)
  const fieldInputPortIds = new Set(
    fields.flatMap((field) => (field.inputPort ? [field.inputPort.id] : [])),
  )

  return {
    title: resolveDomNodeTitle(context, domDefinition),
    inputs: inputs.filter((port) => !fieldInputPortIds.has(port.id)),
    outputs,
    fields,
  }
}
