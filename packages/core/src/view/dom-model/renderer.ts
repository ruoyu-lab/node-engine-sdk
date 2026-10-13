import type {
  NodeEngineDomNodeClassValue,
  NodeEngineDomNodeRenderContext,
  NodeEngineDomNodeRenderer,
  NodeEngineStyleDeclaration,
  NodeTypeDefinition,
} from '../types/index.js'

/**
 * Resolves the DOM renderer of a node type. Nodes render through DOM by default; `dom: false`
 * opts out and `visible(context) === false` hides the DOM node for that render.
 */
export function resolveDomNodeRenderer(
  definition: NodeTypeDefinition | undefined,
  context: NodeEngineDomNodeRenderContext,
): NodeEngineDomNodeRenderer | null {
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
  renderer: NodeEngineDomNodeRenderer,
): 'replace' | 'overlay' {
  return renderer.mode ?? 'replace'
}

export function resolveDomNodeClassName(
  value: NodeEngineDomNodeRenderer['className'],
  context: NodeEngineDomNodeRenderContext,
): NodeEngineDomNodeClassValue | undefined {
  return typeof value === 'function' ? value(context) : value
}

export function resolveDomNodePointerEvents(
  value: NodeEngineDomNodeRenderer['pointerEvents'],
  context: NodeEngineDomNodeRenderContext,
): 'none' | 'auto' {
  return (typeof value === 'function' ? value(context) : value) ?? 'none'
}

export function resolveDomNodeStyle(
  value: NodeEngineDomNodeRenderer['style'],
  context: NodeEngineDomNodeRenderContext,
): NodeEngineStyleDeclaration {
  return (typeof value === 'function' ? value(context) : value) ?? {}
}

export function resolveDomNodeRecord(
  value: NodeEngineDomNodeRenderer['services'] | NodeEngineDomNodeRenderer['actions'],
  context: NodeEngineDomNodeRenderContext,
): Record<string, unknown> {
  return (typeof value === 'function' ? value(context) : value) ?? {}
}
