import {
  applyGraphLayout,
  layoutGraph,
  type GraphLayoutOptions,
  type GraphLayoutResult,
} from '@node-engine-sdk/core/layout'
import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import type { NodeEnginePresetLayout } from './types.js'

export function createPresetLayout(options: GraphLayoutOptions): NodeEnginePresetLayout {
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
