import type { GraphSnapshot, NodeDefinition } from '@node-wright/core/protocol'
import {
  NodeWrightRuntime,
  type NodeWrightRunResult,
  type NodeWrightRuntimeEvent,
} from '@node-wright/core/runtime'
import type { NodeWrightNodeStatus } from '@node-wright/core/view'
import type { DemoScenario } from './scenarios'

export interface DemoRuntimeLogEntry {
  id: string
  type: NodeWrightRuntimeEvent['type']
  nodeId?: string
  status: string
  detail: string
}

export interface DemoRuntimeRun {
  result: NodeWrightRunResult
  events: DemoRuntimeLogEntry[]
}

/** Node statuses while a run is in flight, keyed by node id. */
export type DemoNodeStatusMap = Readonly<Record<string, NodeWrightNodeStatus>>

const NODE_EVENT_STATUS: Partial<Record<NodeWrightRuntimeEvent['type'], NodeWrightNodeStatus>> = {
  'node:start': 'running',
  'node:success': 'success',
  'node:error': 'error',
  'node:cancel': 'cancelled',
}

/**
 * Runs the scenario's entry event. `onNodeStatus` receives the status of every node the run has
 * reached so far whenever one changes, so the editor can show progress before the run settles.
 */
export async function runDemoScenario(
  scenario: DemoScenario,
  graph: GraphSnapshot,
  definitions: NodeDefinition[],
  onNodeStatus?: (status: DemoNodeStatusMap) => void,
): Promise<DemoRuntimeRun> {
  if (!scenario.runtimeEventId) {
    throw new Error('当前场景没有定义 runtime 事件入口。')
  }

  const events: DemoRuntimeLogEntry[] = []
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  let nodeStatus: DemoNodeStatusMap = {}
  const runtime = new NodeWrightRuntime({
    graph,
    definitions,
    runtimeDefinitions: scenario.runtimeDefinitions ?? [],
    functionDefinitions: scenario.functionDefinitions ?? [],
    subgraphDefinitions: scenario.subgraphDefinitions ?? [],
    initialVariables: scenario.runtimeInitialVariables,
    // The panel reads each output node's captured inputs (`listRunOutputs`).
    debug: { captureInputs: true },
    summarizeValue,
    onEvent(event) {
      events.unshift(toLogEntry(event, events.length))

      const status = NODE_EVENT_STATUS[event.type]

      // Nodes of called functions and subgraphs are not part of the edited graph.
      if (status && event.node && nodeIds.has(event.node.id)) {
        nodeStatus = { ...nodeStatus, [event.node.id]: status }
        onNodeStatus?.(nodeStatus)
      }
    },
  })
  const compiled = runtime.compile(scenario.runtimeEventId)

  if (!compiled.plan) {
    throw new Error(compiled.diagnostics[0]?.message ?? '当前图无法编译为 runtime 执行计划。')
  }

  const result = await runtime.run(compiled.plan)

  return {
    result,
    events,
  }
}

export function canRunScenario(scenario: DemoScenario): boolean {
  return Boolean(scenario.runtimeEventId && scenario.runtimeDefinitions?.length)
}

export function describeRunError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `sequence` is the event's position in the run, so entry ids are unique within one run. */
function toLogEntry(event: NodeWrightRuntimeEvent, sequence: number): DemoRuntimeLogEntry {
  return {
    id: `event:${sequence}`,
    type: event.type,
    nodeId: event.node?.id,
    status: event.run.status,
    detail: describeEventTarget(event),
  }
}

function describeEventTarget(event: NodeWrightRuntimeEvent): string {
  if (event.node) {
    return `${event.node.type} / ${event.node.id}`
  }

  if (event.functionDefinition) {
    return `函数 / ${event.functionDefinition.id}`
  }

  if (event.subgraphDefinition) {
    return `子图 / ${event.subgraphDefinition.id}`
  }

  return `运行 ${event.run.runId}`
}

function summarizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 4)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const entries = Object.entries(record).slice(0, 6)

  return Object.fromEntries(entries)
}
