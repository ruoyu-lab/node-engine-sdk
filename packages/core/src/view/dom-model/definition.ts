import type { GraphNode } from '../../protocol/index.js'
import type {
  NodeWrightDomFieldDefinition,
  NodeWrightDomNodeDefinition,
  NodeWrightDomNodeRenderContext,
  NodeTypeDefinition,
} from '../types/index.js'

/** Resolves the effective DOM description of a node from its renderer `defaults`. */
export function resolveDomNodeDefinition(
  context: NodeWrightDomNodeRenderContext,
): NodeWrightDomNodeDefinition {
  const rendererDefinition =
    context.definition?.dom && typeof context.definition.dom === 'object'
      ? context.definition.dom
      : undefined
  const rendererDefaults = rendererDefinition
    ? resolveDomRendererDefaults(rendererDefinition.defaults, context)
    : undefined

  return {
    title: rendererDefaults?.title,
    subtitle: rendererDefaults?.subtitle,
    fieldSource: rendererDefaults?.fieldSource ?? 'auto',
    fields: rendererDefaults?.fields ? rendererDefaults.fields.map(copyField) : undefined,
    maxVisibleFields: rendererDefaults?.maxVisibleFields,
    layout: rendererDefaults?.layout ? { ...rendererDefaults.layout } : undefined,
  }
}

export function resolveDomNodeTitle(
  context: Pick<NodeWrightDomNodeRenderContext, 'node' | 'schema' | 'definition'>,
  domDefinition?: NodeWrightDomNodeDefinition,
): string {
  return (
    readString(context.node.data?.title) ??
    domDefinition?.title ??
    readString(context.node.meta?.title) ??
    context.schema?.label ??
    context.definition?.label ??
    context.node.type
  )
}

export function resolveDomNodeSubtitle(
  context: Pick<NodeWrightDomNodeRenderContext, 'node'>,
  domDefinition?: NodeWrightDomNodeDefinition,
): string | undefined {
  return readString(context.node.data?.subtitle) ?? domDefinition?.subtitle ?? undefined
}

function resolveDomRendererDefaults(
  value:
    | Partial<NodeWrightDomNodeDefinition>
    | ((
        context: NodeWrightDomNodeRenderContext,
      ) => Partial<NodeWrightDomNodeDefinition> | undefined | void)
    | undefined,
  context: NodeWrightDomNodeRenderContext,
): Partial<NodeWrightDomNodeDefinition> | undefined {
  if (!value) {
    return undefined
  }

  return typeof value === 'function' ? (value(context) ?? undefined) : value
}

function copyField(field: NodeWrightDomFieldDefinition): NodeWrightDomFieldDefinition {
  return { ...field }
}

/** Accent colour of a node: its own `meta.accent`, then the `accent` of its node type. */
export function resolveNodeAccent(
  node: Pick<GraphNode, 'meta'>,
  definition: Pick<NodeTypeDefinition, 'accent'> | undefined,
): string | undefined {
  const own = node.meta?.accent

  return (typeof own === 'string' && own ? own : undefined) ?? (definition?.accent || undefined)
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
