import type { GraphEndpoint, GraphNode, GraphSnapshot } from '../../protocol/index.js'
import type { GraphStore } from '../../store/index.js'
import { resolvePortSemanticColor } from '../dom-model/ports.js'
import { computed, type ReadonlySignal } from '../reactive.js'
import { endpointKey, type PortLayout } from '../rendering/node-layout.js'

/**
 * Per-endpoint connection counts and colours. A connected port takes the colour of its edge,
 * which is the semantic colour of the source port (or the source node accent); exec ports and
 * edges take the theme's exec colour.
 */
export interface EndpointStyles {
  connectionCount: (port: PortLayout) => number
  connectionColor: (port: PortLayout) => string | undefined
  /** Semantic colour of the endpoint's port, falling back to its node's accent. */
  endpointColor: (endpoint: GraphEndpoint | undefined) => string | undefined
  /** Adds connection count and colour to port layouts, optionally moving them with a preview. */
  decorate: (ports: PortLayout[], preview: (port: PortLayout) => PortLayout) => PortLayout[]
}

export function createEndpointStyles(options: {
  graph: ReadonlySignal<GraphSnapshot>
  getStore: () => GraphStore
  defaultStroke: ReadonlySignal<string>
  execStroke: ReadonlySignal<string>
  /** Accent of a node (`meta.accent`, then its node type's `accent`). */
  resolveAccent: (node: GraphNode) => string | undefined
}): EndpointStyles {
  const counts = computed(() => {
    const incoming = new Map<string, number>()
    const outgoing = new Map<string, number>()

    for (const edge of options.graph.value.edges) {
      const sourceKey = endpointKey(edge.source)
      const targetKey = endpointKey(edge.target)

      outgoing.set(sourceKey, (outgoing.get(sourceKey) ?? 0) + 1)
      incoming.set(targetKey, (incoming.get(targetKey) ?? 0) + 1)
    }

    return { incoming, outgoing }
  })

  const nodeAccents = computed(() => {
    const accents = new Map<string, string>()

    for (const node of options.graph.value.nodes) {
      const accent = options.resolveAccent(node)

      if (accent) {
        accents.set(node.id, accent)
      }
    }

    return accents
  })

  function endpointColor(endpoint: GraphEndpoint | undefined): string | undefined {
    if (!endpoint) {
      return undefined
    }

    return (
      resolvePortSemanticColor(options.getStore().getPort(endpoint), options.execStroke.value) ??
      nodeAccents.value.get(endpoint.nodeId)
    )
  }

  const colors = computed(() => {
    const incoming = new Map<string, string>()
    const outgoing = new Map<string, string>()

    for (const edge of options.graph.value.edges) {
      const exec = edge.kind === 'exec'
      const sourceColor = exec
        ? options.execStroke.value
        : (endpointColor(edge.source) ?? options.defaultStroke.value)
      const targetColor = exec ? sourceColor : (endpointColor(edge.target) ?? sourceColor)

      outgoing.set(endpointKey(edge.source), sourceColor)
      incoming.set(endpointKey(edge.target), targetColor)
    }

    return { incoming, outgoing }
  })

  function connectionCount(port: PortLayout): number {
    const registry = port.port.direction === 'input' ? counts.value.incoming : counts.value.outgoing
    return registry.get(endpointKey(port.endpoint)) ?? 0
  }

  function connectionColor(port: PortLayout): string | undefined {
    const registry = port.port.direction === 'input' ? colors.value.incoming : colors.value.outgoing
    return (
      registry.get(endpointKey(port.endpoint)) ??
      resolvePortSemanticColor(port.port, options.execStroke.value)
    )
  }

  return {
    connectionCount,
    connectionColor,
    endpointColor,
    decorate: (ports, preview) =>
      ports.map((port) => ({
        ...preview(port),
        connectionCount: connectionCount(port),
        connectionColor: connectionColor(port),
      })),
  }
}
