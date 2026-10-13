import type {
  ConnectionValidator,
  EdgeDefinition,
  GraphCommandRegistryEntry,
  GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import type { GraphLayoutOptions, GraphLayoutResult } from '@node-engine-sdk/core/layout'
import type { NodeEngineRuntimeNodeDefinition } from '@node-engine-sdk/core/runtime'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'
import type {
  EdgeTypeRegistry,
  NodeEngineBehaviors,
  NodeEnginePerformanceOptions,
  NodeEnginePlugin,
  NodeEngineTheme,
  NodeTypeRegistry,
  ViewportState,
} from '@node-engine-sdk/core/view'

export interface NodeEnginePreset {
  nodeDefinitions: SemanticNodeDefinition[]
  runtimeDefinitions: NodeEngineRuntimeNodeDefinition[]
  layout: NodeEnginePresetLayout
  edgeDefinitions?: EdgeDefinition[]
  nodeTypes?: NodeTypeRegistry
  edgeTypes?: EdgeTypeRegistry
  commands?: GraphCommandRegistryEntry[]
  plugins?: NodeEnginePlugin[]
  connectionValidator?: ConnectionValidator
  initialViewport?: Partial<ViewportState>
  theme?: Partial<NodeEngineTheme>
  behaviors?: Partial<NodeEngineBehaviors>
  performance?: Partial<NodeEnginePerformanceOptions>
}

export interface NodeEnginePresetLayout {
  options: Readonly<GraphLayoutOptions>
  run: (graph: GraphSnapshot) => GraphLayoutResult
  apply: (graph: GraphSnapshot) => GraphSnapshot
}

export interface DataflowPresetOptions {
  includeDefaultNodes?: boolean
}

export interface ExecflowPresetOptions {
  includeDefaultNodes?: boolean
}

export interface FunctionPresetOptions {
  includeDefaultNodes?: boolean
}

export interface SubgraphPresetOptions {
  includeDefaultNodes?: boolean
}

export interface HybridFlowPresetOptions {
  includeDataflowNodes?: boolean
  includeExecflowNodes?: boolean
  includeFunctionNodes?: boolean
  includeSubgraphNodes?: boolean
}
