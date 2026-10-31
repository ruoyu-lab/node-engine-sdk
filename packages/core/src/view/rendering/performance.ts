import type { NodeWrightPerformanceSample } from '../types/index.js'

export type PerformanceSampleInput = Omit<NodeWrightPerformanceSample, 'timestamp' | 'fps'>

export function createPerformanceSample(
  input: PerformanceSampleInput,
): NodeWrightPerformanceSample {
  const fps = input.avgFrameMs > 0 ? 1000 / input.avgFrameMs : 0

  return {
    timestamp: Date.now(),
    renderMode: input.renderMode,
    mode: input.mode,
    frameMs: round(input.frameMs),
    avgFrameMs: round(input.avgFrameMs),
    drawMs: round(input.drawMs),
    avgDrawMs: round(input.avgDrawMs),
    fps: round(fps),
    totalNodes: input.totalNodes,
    visibleNodes: input.visibleNodes,
    totalEdges: input.totalEdges,
    visibleEdges: input.visibleEdges,
    totalGroups: input.totalGroups,
    visibleGroups: input.visibleGroups,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
