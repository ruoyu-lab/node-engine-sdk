import type {
  NodeEngineRunResult,
  NodeEngineRunStatus,
  NodeEngineRuntimeEvent,
  NodeEngineRuntimeTraceEntry,
} from '@node-engine-sdk/core/runtime'
import type { DemoScenario, DemoScenarioOutput } from './scenarios'

const RUN_STATUS_LABELS: Record<NodeEngineRunStatus, string> = {
  idle: '空闲',
  running: '运行中',
  paused: '已暂停',
  success: '成功',
  error: '错误',
  cancelled: '已取消',
}

/** Run and node events the panel names; function and subgraph events keep their type. */
const RUNTIME_EVENT_LABELS: Partial<Record<NodeEngineRuntimeEvent['type'], string>> = {
  'run:start': '运行开始',
  'run:pause': '运行暂停',
  'run:resume': '运行继续',
  'run:step': '单步运行',
  'run:cancel': '运行取消',
  'run:success': '运行成功',
  'run:error': '运行错误',
  'node:start': '节点开始',
  'node:success': '节点成功',
  'node:cancel': '节点取消',
  'node:error': '节点错误',
}

/** Run and trace statuses; a panel without a run result shows the idle status. */
export function formatRunStatus(status: NodeEngineRunStatus | undefined): string {
  return RUN_STATUS_LABELS[status ?? 'idle']
}

export function formatRuntimeEventType(type: NodeEngineRuntimeEvent['type']): string {
  return RUNTIME_EVENT_LABELS[type] ?? type
}

export function formatRuntimeVariables(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** Parameter entries of the selected node, as the runtime panel lists them. */
export function listNodeParams(params: unknown): Array<[key: string, value: string]> {
  return params && typeof params === 'object'
    ? Object.entries(params as Record<string, unknown>).map(([key, value]) => [key, String(value)])
    : []
}

export interface DemoRunOutputRow {
  key: string
  label: string
  value: string
}

export interface DemoTraceRow {
  key: string
  title: string
  detail: string
  /** Status of the traced step; the panel marks each row with it. */
  status: NodeEngineRunStatus
}

/**
 * The scenario outputs as the panel lists them: the value each output node received in the run,
 * or why there is none (no run yet, the node did not run, or it did not succeed).
 */
export function listRunOutputs(
  scenario: DemoScenario,
  result: NodeEngineRunResult | null,
): DemoRunOutputRow[] {
  return scenario.outputs.map((output) => ({
    key: `${output.nodeId}:${output.portId}`,
    label: output.label,
    value: describeRunOutput(output, result),
  }))
}

/** Number of scenario outputs that received a value in the run. */
export function countRunOutputs(
  scenario: DemoScenario,
  result: NodeEngineRunResult | null,
): number {
  return scenario.outputs.filter(
    (output) => result?.nodeStates[output.nodeId]?.status === 'success',
  ).length
}

/** Trace entries in execution order; function and subgraph calls name the call instead of a node. */
export function listTraceRows(result: NodeEngineRunResult | null): DemoTraceRow[] {
  return (result?.trace ?? []).map((entry, index) => ({
    key: String(index),
    title: entry.type,
    detail: `${describeTraceTarget(entry)} / ${formatRunStatus(entry.status)}`,
    status: entry.status,
  }))
}

function describeRunOutput(output: DemoScenarioOutput, result: NodeEngineRunResult | null): string {
  if (!result) {
    return '等待运行'
  }

  const state = result.nodeStates[output.nodeId]

  if (!state) {
    return '未执行'
  }

  if (state.status !== 'success') {
    return formatRunStatus(state.status)
  }

  const value = state.inputValues?.[output.portId]

  return value === undefined ? '无值' : formatOutputValue(value)
}

/** Strings show as they are; other run values are JSON, as they would be exported. */
function formatOutputValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function describeTraceTarget(entry: NodeEngineRuntimeTraceEntry): string {
  if (entry.kind === 'function') {
    return '函数调用'
  }

  if (entry.kind === 'subgraph') {
    return '子图调用'
  }

  return String(entry.nodeId)
}
