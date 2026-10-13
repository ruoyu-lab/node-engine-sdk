import type { GraphNode } from '@node-engine-sdk/core/protocol'
import {
  createRuntimeVariableSnapshot,
  type NodeEngineRunResult,
} from '@node-engine-sdk/core/runtime'
import type { NodeEngineResolvePortValueContext } from '@node-engine-sdk/core/view'
import { EXEC_GET_VARIABLE_NODE_TYPE } from '@node-engine-sdk/presets'
import type { DemoScenario } from '../demo/scenarios'

/**
 * Value a connected port shows in the downstream field: the latest run output of the upstream
 * node, then its parameter of the same name, then its `value` parameter.
 */
export function resolveDemoPortValue(
  context: Pick<NodeEngineResolvePortValueContext, 'graph' | 'endpoint' | 'node' | 'port'>,
  result: NodeEngineRunResult | null,
  scenario: DemoScenario,
): unknown {
  const node =
    context.node ?? context.graph.nodes.find((entry) => entry.id === context.endpoint.nodeId)
  const params = node?.data?.params
  const key = context.port?.name ?? context.port?.id ?? context.endpoint.portId
  const runtimeValue = resolveRuntimePortValue(node, key, result, scenario)

  if (runtimeValue !== undefined) {
    return runtimeValue
  }

  if (params && typeof params === 'object') {
    const record = params as Record<string, unknown>

    if (key in record) {
      return record[key]
    }

    if ('value' in record) {
      return record.value
    }
  }

  return node?.data?.[key]
}

function resolveRuntimePortValue(
  node: GraphNode | undefined,
  key: string,
  result: NodeEngineRunResult | null,
  scenario: DemoScenario,
): unknown {
  if (!node) {
    return undefined
  }

  const stateValue = result?.nodeStates[node.id]?.values?.[key]

  if (stateValue !== undefined) {
    return stateValue
  }

  if (node.type !== EXEC_GET_VARIABLE_NODE_TYPE || key !== 'value') {
    return undefined
  }

  const variables =
    result?.variables ?? createRuntimeVariableSnapshot(scenario.runtimeInitialVariables)
  const scope = readNodeParamString(node, 'scope') ?? 'run'
  const name = readNodeParamString(node, 'name') ?? 'value'

  if (scope === 'run') {
    return variables.run[name]
  }

  if (scope === 'graph') {
    return variables.graph[name]
  }

  if (scope === 'node') {
    const nodeId = readNodeParamString(node, 'nodeId') ?? node.id

    return variables.nodes[nodeId]?.[name]
  }

  return variables.scopes[scope]?.[name]
}

function readNodeParamString(node: GraphNode, key: string): string | undefined {
  const params = node.data?.params

  if (params && typeof params === 'object') {
    const value = (params as Record<string, unknown>)[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const value = node.data?.[key]

  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
