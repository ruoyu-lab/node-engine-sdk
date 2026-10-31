import {
  applyGraphLayout,
  layoutGraph,
  type GraphLayoutOptions,
  type GraphLayoutResult,
} from '@node-wright/core/layout'
import type { GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightPresetLayout } from './types.js'

export function createPresetLayout(options: GraphLayoutOptions): NodeWrightPresetLayout {
  const resolvedOptions = Object.freeze({ ...options })

  return {
    options: resolvedOptions,
    run(graph: GraphSnapshot): GraphLayoutResult {
      return layoutGraph(graph, resolvedOptions)
    },
    apply(graph: GraphSnapshot): GraphSnapshot {
      return applyGraphLayout(graph, layoutGraph(graph, resolvedOptions))
    },
  }
}
