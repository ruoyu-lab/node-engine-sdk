import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphEdge,
  type GraphGroup,
  type GraphNode,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'
import {
  createDataflowPreset,
  DATA_SOURCE_NODE_TYPE,
  type NodeEnginePreset,
} from '@node-engine-sdk/presets'
import type {
  NodeEngineRuntimeFunctionDefinition,
  NodeEngineRuntimeInitialVariables,
  NodeEngineRuntimeNodeDefinition,
  NodeEngineRuntimeSubgraphDefinition,
} from '@node-engine-sdk/core/runtime'
import {
  AI_IMAGE_ACCENT,
  AI_IMAGE_DISPLAY_NODE_TYPE,
  AI_IMAGE_GENERATE_NODE_TYPE,
  AI_PROMPT_NODE_TYPE,
  aiImageNodeDefinitions,
  aiImageNodeTypes,
  aiImageRuntimeDefinitions,
} from '../business/ai-image'
import { dataflowScenario } from './primitives/dataflow'
import { execflowScenario } from './primitives/execflow'
import { functionScenario } from './primitives/function'
import { subgraphScenario } from './primitives/subgraph'

/** Scenario ids are keys of the `demoScenarios` registry; `getDemoScenario` rejects unknown ids. */
export type DemoScenarioId = string

/** A node input whose value after a run is the scenario's result, as the runtime panel lists it. */
export interface DemoScenarioOutput {
  nodeId: string
  portId: string
  label: string
}

export interface DemoScenario {
  id: DemoScenarioId
  title: string
  eyebrow: string
  /** Colour of the scenario's node family; it marks the scenario in the scenario list. */
  accent: string
  summary: string
  graph: () => GraphSnapshot
  preset: NodeEnginePreset
  runtimeDefinitions?: NodeEngineRuntimeNodeDefinition[]
  functionDefinitions?: NodeEngineRuntimeFunctionDefinition[]
  subgraphDefinitions?: NodeEngineRuntimeSubgraphDefinition[]
  runtimeEventId?: string
  runtimeInitialVariables?: NodeEngineRuntimeInitialVariables
  outputs: DemoScenarioOutput[]
}

const basePreset = createDataflowPreset()

export const demoScenarios: DemoScenario[] = [
  {
    id: 'ai-image',
    title: 'AI 图片生成',
    eyebrow: '完整业务应用',
    accent: AI_IMAGE_ACCENT,
    summary: '将提示词、固定种子、图片生成和预览组合为可编辑、可执行的图像工作流。',
    graph: createAiImageDemoGraph,
    preset: {
      ...basePreset,
      nodeDefinitions: [...basePreset.nodeDefinitions, ...aiImageNodeDefinitions],
      nodeTypes: {
        ...basePreset.nodeTypes,
        ...aiImageNodeTypes,
      },
    },
    runtimeDefinitions: [...basePreset.runtimeDefinitions, ...aiImageRuntimeDefinitions],
    runtimeEventId: 'image-display',
    outputs: [{ nodeId: 'image-display', portId: 'imageUrl', label: '图片地址' }],
  },
  dataflowScenario,
  execflowScenario,
  functionScenario,
  subgraphScenario,
]

const demoScenarioById = new Map(demoScenarios.map((scenario) => [scenario.id, scenario]))

export function getDemoScenario(id: DemoScenarioId): DemoScenario {
  const scenario = demoScenarioById.get(id)

  if (!scenario) {
    throw new Error(`Unknown demo scenario "${id}".`)
  }

  return scenario
}

function createAiImageDemoGraph(): GraphSnapshot {
  const nodes: GraphNode[] = [
    {
      id: 'prompt',
      type: AI_PROMPT_NODE_TYPE,
      x: 80,
      y: 140,
      width: 320,
      height: 220,
      data: {
        title: '提示词',
        params: {
          text: 'a serene mountain lake at sunrise, photorealistic, soft mist, cinematic lighting',
        },
      },
    },
    {
      id: 'image-generate',
      type: AI_IMAGE_GENERATE_NODE_TYPE,
      x: 480,
      y: 140,
      width: 304,
      height: 256,
      data: {
        title: '生成图片',
        params: {
          provider: 'pollinations',
          model: 'auto',
          width: 1024,
          height: 1024,
          seed: 0,
        },
      },
    },
    {
      id: 'seed-value',
      type: DATA_SOURCE_NODE_TYPE,
      x: 80,
      y: 400,
      width: 250,
      height: 132,
      data: {
        title: '固定种子',
        params: {
          value: 12345,
        },
      },
    },
    {
      id: 'image-display',
      type: AI_IMAGE_DISPLAY_NODE_TYPE,
      x: 860,
      y: 120,
      width: 360,
      height: 384,
      data: {
        title: '图片预览',
        params: {
          imageUrl: '',
        },
      },
    },
  ]

  const edges: GraphEdge[] = [
    {
      id: 'e-prompt-to-generate',
      kind: 'data',
      source: { nodeId: 'prompt', portId: 'prompt' },
      target: { nodeId: 'image-generate', portId: 'prompt' },
    },
    {
      id: 'e-seed-to-generate',
      kind: 'data',
      source: { nodeId: 'seed-value', portId: 'value' },
      target: { nodeId: 'image-generate', portId: 'seed' },
    },
    {
      id: 'e-generate-to-display',
      kind: 'data',
      source: { nodeId: 'image-generate', portId: 'imageUrl' },
      target: { nodeId: 'image-display', portId: 'imageUrl' },
    },
  ]

  const groups: GraphGroup[] = [
    {
      id: 'ai-image-group',
      x: 32,
      y: 64,
      width: 1240,
      height: 512,
      label: 'AI 图片生成流水线',
      nodeIds: ['prompt', 'image-generate', 'seed-value', 'image-display'],
    },
  ]

  return {
    schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
    nodes,
    edges,
    groups,
    meta: { scenario: 'ai-image' },
  }
}
