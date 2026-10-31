import type {
  ConnectionValidator,
  EdgeDefinition,
  GraphCommandRegistryEntry,
  GraphSnapshot,
} from '@node-wright/core/protocol'
import type { GraphLayoutOptions, GraphLayoutResult } from '@node-wright/core/layout'
import type { NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'
import type {
  EdgeTypeRegistry,
  NodeWrightBehaviors,
  NodeWrightPerformanceOptions,
  NodeWrightPlugin,
  NodeWrightTheme,
  NodeTypeRegistry,
  ViewportState,
} from '@node-wright/core/view'

export interface NodeWrightPreset {
  nodeDefinitions: SemanticNodeDefinition[]
  runtimeDefinitions: NodeWrightRuntimeNodeDefinition[]
  layout: NodeWrightPresetLayout
  edgeDefinitions?: EdgeDefinition[]
  nodeTypes?: NodeTypeRegistry
  edgeTypes?: EdgeTypeRegistry
  commands?: GraphCommandRegistryEntry[]
  plugins?: NodeWrightPlugin[]
  connectionValidator?: ConnectionValidator
  initialViewport?: Partial<ViewportState>
  theme?: Partial<NodeWrightTheme>
  behaviors?: Partial<NodeWrightBehaviors>
  performance?: Partial<NodeWrightPerformanceOptions>
}

export interface NodeWrightPresetLayout {
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
