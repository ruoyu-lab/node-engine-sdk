import type { GraphSnapshot } from '@node-wright/core/protocol'
import type { DemoScenario } from '../demo/scenarios'

export const GRAPH_FILE_ACCEPT = '.json,application/json'

/** Name of the file a scenario's graph is exported to, e.g. `ai-image-workflow.json`. */
export function graphFileName(scenario: DemoScenario): string {
  return `${scenario.id}-workflow.json`
}

export function serializeGraphFile(graph: GraphSnapshot): string {
  return `${JSON.stringify(graph, null, 2)}\n`
}

/**
 * Parses a graph file as JSON. The editor's `graph.import` validates the parsed value against
 * the registered definitions, so the result stays `unknown` here.
 */
export function parseGraphFile(text: string): unknown {
  return JSON.parse(text)
}

/** Saves the exported graph of the scenario through a download link. */
export function downloadGraphFile(graph: GraphSnapshot, scenario: DemoScenario): void {
  const link = document.createElement('a')

  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(serializeGraphFile(graph))}`
  link.download = graphFileName(scenario)
  link.click()
}

export function describeImportError(error: unknown): string {
  return `导入失败：${error instanceof Error ? error.message : String(error)}`
}
