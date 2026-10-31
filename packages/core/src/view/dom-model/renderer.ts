import type {
  NodeWrightDomNodeClassValue,
  NodeWrightDomNodeRenderContext,
  NodeWrightDomNodeRenderer,
  NodeWrightStyleDeclaration,
  NodeTypeDefinition,
} from '../types/index.js'

/**
 * Resolves the DOM renderer of a node type. Nodes render through DOM by default; `dom: false`
 * opts out and `visible(context) === false` hides the DOM node for that render.
 */
export function resolveDomNodeRenderer(
  definition: NodeTypeDefinition | undefined,
  context: NodeWrightDomNodeRenderContext,
): NodeWrightDomNodeRenderer | null {
  const renderer = definition?.dom

  if (renderer === false) {
    return null
  }

  if (renderer?.visible && !renderer.visible(context)) {
    return null
  }

  return renderer ?? {}
}

export function resolveDomNodeRenderMode(
  renderer: NodeWrightDomNodeRenderer,
): 'replace' | 'overlay' {
  return renderer.mode ?? 'replace'
}

export function resolveDomNodeClassName(
  value: NodeWrightDomNodeRenderer['className'],
  context: NodeWrightDomNodeRenderContext,
): NodeWrightDomNodeClassValue | undefined {
  return typeof value === 'function' ? value(context) : value
}

export function resolveDomNodePointerEvents(
  value: NodeWrightDomNodeRenderer['pointerEvents'],
  context: NodeWrightDomNodeRenderContext,
): 'none' | 'auto' {
  return (typeof value === 'function' ? value(context) : value) ?? 'none'
}

export function resolveDomNodeStyle(
  value: NodeWrightDomNodeRenderer['style'],
  context: NodeWrightDomNodeRenderContext,
): NodeWrightStyleDeclaration {
  return (typeof value === 'function' ? value(context) : value) ?? {}
}

export function resolveDomNodeRecord(
  value: NodeWrightDomNodeRenderer['services'] | NodeWrightDomNodeRenderer['actions'],
  context: NodeWrightDomNodeRenderContext,
): Record<string, unknown> {
  return (typeof value === 'function' ? value(context) : value) ?? {}
}
