import { createHybridFlowPlugin } from '@node-engine-sdk/core/semantics'
import type { HybridFlowPresetOptions, NodeEnginePreset } from './types.js'
import {
  dataflowNodeDefinitions,
  dataflowNodeTypes,
  dataflowRuntimeDefinitions,
} from './dataflow.js'
import {
  execflowNodeDefinitions,
  execflowNodeTypes,
  execflowRuntimeDefinitions,
} from './execflow.js'
import {
  functionCallNodeDefinitions,
  functionCallRuntimeDefinitions,
  functionNodeTypes,
} from './functions.js'
import {
  subgraphNodeDefinitions,
  subgraphNodeTypes,
  subgraphRuntimeDefinitions,
} from './subgraphs.js'
import { createPresetLayout } from './layout.js'

export function createHybridFlowPreset(options: HybridFlowPresetOptions = {}): NodeEnginePreset {
  const includeDataflowNodes = options.includeDataflowNodes !== false
  const includeExecflowNodes = options.includeExecflowNodes !== false
  const includeFunctionNodes = options.includeFunctionNodes !== false
  const includeSubgraphNodes = options.includeSubgraphNodes !== false

  return {
    nodeDefinitions: [
      ...(includeExecflowNodes ? execflowNodeDefinitions : []),
      ...(includeDataflowNodes ? dataflowNodeDefinitions : []),
      ...(includeFunctionNodes ? functionCallNodeDefinitions : []),
      ...(includeSubgraphNodes ? subgraphNodeDefinitions : []),
    ],
    runtimeDefinitions: [
      ...(includeExecflowNodes ? execflowRuntimeDefinitions : []),
      ...(includeDataflowNodes ? dataflowRuntimeDefinitions : []),
      ...(includeFunctionNodes ? functionCallRuntimeDefinitions : []),
      ...(includeSubgraphNodes ? subgraphRuntimeDefinitions : []),
    ],
    nodeTypes: {
      ...(includeExecflowNodes ? execflowNodeTypes : {}),
      ...(includeDataflowNodes ? dataflowNodeTypes : {}),
      ...(includeFunctionNodes ? functionNodeTypes : {}),
      ...(includeSubgraphNodes ? subgraphNodeTypes : {}),
    },
    plugins: [createHybridFlowPlugin()],
    initialViewport: {
      x: 48,
      y: 40,
      zoom: 0.9,
    },
    layout: createPresetLayout({
      direction: 'LR',
      edgeKinds: ['data', 'exec'],
      rankSpacing: 300,
      nodeSpacing: 88,
      groupPadding: 44,
    }),
  }
}
