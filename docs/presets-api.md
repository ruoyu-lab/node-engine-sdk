# Presets API（`@node-wright/presets`）

`@node-wright/presets` 是官方预设节点包，也是标准完整组合的唯一入口：把原语节点定义、框架无关的 DOM 渲染配置（`@node-wright/core/view` 类型）、语义插件、Runtime definitions、布局策略与初始视口组合成一个对象，两个官方适配层都可以直接使用。它只依赖 `@node-wright/core`，不依赖任何 UI 框架；创建 preset 不会实例化 Runtime，只使用编辑器时没有运行时成本。

| 入口                                  | 内容                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `@node-wright/presets`                | 5 个 preset 工厂、`createPresetLayout`、各节点系统的定义与 DOM 配置 |
| `@node-wright/presets/nodes/dataflow` | 数据流原语节点                                                      |
| `@node-wright/presets/nodes/execflow` | 执行流原语节点                                                      |
| `@node-wright/presets/nodes/function` | 函数调用节点                                                        |
| `@node-wright/presets/nodes/subgraph` | 子图调用与边界节点                                                  |

`nodes/*` 子路径的内容见 [node-systems.md](./node-systems.md)。

## Preset 工厂

| 工厂                               | 节点                                 | 语义插件                   | 布局                                  |
| ---------------------------------- | ------------------------------------ | -------------------------- | ------------------------------------- |
| `createDataflowPreset(options?)`   | 4 个 `data:*`                        | `createDataflowPlugin()`   | `LR`，`edgeKinds: ['data']`，层距 300 |
| `createExecflowPreset(options?)`   | 7 个 `exec:*`                        | `createExecflowPlugin()`   | `TB`，`edgeKinds: ['exec']`，层距 240 |
| `createFunctionPreset(options?)`   | `function:call`                      | 无                         | `LR`，`edgeKinds: ['data', 'exec']`   |
| `createSubgraphPreset(options?)`   | `subgraph:call` / `input` / `output` | 无                         | `LR`，`edgeKinds: ['data', 'exec']`   |
| `createHybridFlowPreset(options?)` | 以上全部 15 个                       | `createHybridFlowPlugin()` | `LR`，`edgeKinds: ['data', 'exec']`   |

- 前四个工厂接受 `{ includeDefaultNodes?: boolean }`：设为 `false` 时只保留语义插件、布局与视口，节点定义、Runtime definitions 与 DOM 配置为空。
- `createHybridFlowPreset` 接受 `includeDataflowNodes`、`includeExecflowNodes`、`includeFunctionNodes`、`includeSubgraphNodes`（默认都为 `true`）。
- 所有 preset 的初始视口为 `{ x: 48, y: 40, zoom: 0.9 }`，布局 `nodeSpacing: 88`、`groupPadding: 44`。

## 返回内容

`NodeWrightPreset`：

| 字段                                                                                                   | 是否必有 | 说明                                                              |
| ------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `nodeDefinitions`                                                                                      | 是       | `SemanticNodeDefinition[]`                                        |
| `runtimeDefinitions`                                                                                   | 是       | `NodeWrightRuntimeNodeDefinition[]`                               |
| `layout`                                                                                               | 是       | `NodeWrightPresetLayout`：`options`、`run(graph)`、`apply(graph)` |
| `nodeTypes`                                                                                            | 否       | DOM 渲染配置（`NodeTypeRegistry`）                                |
| `plugins`                                                                                              | 否       | 语义插件等（`NodeWrightPlugin[]`）                                |
| `initialViewport`                                                                                      | 否       | 初始视口                                                          |
| `edgeDefinitions`、`edgeTypes`、`commands`、`connectionValidator`、`theme`、`behaviors`、`performance` | 否       | 标准 preset 当前不提供，保留给自定义 preset                       |

字段名与编辑器选项一一对应，可以直接展开到组件 props 上：

```vue
<NodeWright
  v-model:graph="graph"
  :node-definitions="preset.nodeDefinitions"
  :node-types="preset.nodeTypes"
  :plugins="preset.plugins"
  :initial-viewport="preset.initialViewport"
/>
```

```tsx
<NodeWright
  graph={graph}
  onGraphChange={setGraph}
  nodeDefinitions={preset.nodeDefinitions}
  nodeTypes={preset.nodeTypes}
  plugins={preset.plugins}
  initialViewport={preset.initialViewport}
/>
```

Runtime 单独接入：

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime } from '@node-wright/core/runtime'
import { createHybridFlowPreset } from '@node-wright/presets'

const preset = createHybridFlowPreset()

export function createRuntime(graph: GraphSnapshot): NodeWrightRuntime {
  return new NodeWrightRuntime({
    graph,
    definitions: preset.nodeDefinitions,
    runtimeDefinitions: preset.runtimeDefinitions,
  })
}
```

## 组合业务节点

preset 是普通对象，业务节点直接展开合并即可：

```ts
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'
import type { NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'
import type { NodeTypeRegistry } from '@node-wright/core/view'
import { createDataflowPreset, type NodeWrightPreset } from '@node-wright/presets'

declare const businessNodeDefinitions: SemanticNodeDefinition[]
declare const businessNodeTypes: NodeTypeRegistry
declare const businessRuntimeDefinitions: NodeWrightRuntimeNodeDefinition[]

const base = createDataflowPreset()

export const preset: NodeWrightPreset = {
  ...base,
  nodeDefinitions: [...base.nodeDefinitions, ...businessNodeDefinitions],
  nodeTypes: { ...base.nodeTypes, ...businessNodeTypes },
  runtimeDefinitions: [...base.runtimeDefinitions, ...businessRuntimeDefinitions],
}
```

playground 的 AI 图片场景以同样方式合并节点定义与节点类型（运行时定义合并后放在场景自身的 `runtimeDefinitions` 上，交给它创建的 Runtime）；数据流、执行流场景直接使用对应 preset，函数与子图场景使用 `createHybridFlowPreset()`，见 [playground-demo.md](./playground-demo.md)。合并后的 preset 应创建一次并复用：注册表数组引用变化会让编辑器重建内部 Store。

## 布局

```ts
import { createPresetLayout } from '@node-wright/presets'

export const layout = createPresetLayout({ direction: 'TB', edgeKinds: ['exec'], rankSpacing: 200 })
```

`createPresetLayout(options)` 冻结一份 `GraphLayoutOptions`，返回 `{ options, run, apply }`：`run(graph)` 返回布局 patch，`apply(graph)` 返回写回位置的新图。底层算法见 [layout-api.md](./layout-api.md)。

## 节点系统导出

根入口同时导出各节点系统的常量、定义、DOM 配置与调用节点的端口生成函数，便于只依赖 `@node-wright/presets` 一个入口：

- 数据流：`DATA_SOURCE_NODE_TYPE`、`DATA_TRANSFORM_NODE_TYPE`、`DATA_MERGE_NODE_TYPE`、`DATA_PREVIEW_NODE_TYPE`、`dataflowNodeDefinitions`、`dataflowRuntimeDefinitions`、`dataflowNodeTypes`
- 执行流：`EXEC_EVENT_NODE_TYPE`、`EXEC_SEQUENCE_NODE_TYPE`、`EXEC_BRANCH_NODE_TYPE`、`EXEC_DELAY_NODE_TYPE`、`EXEC_LOG_NODE_TYPE`、`EXEC_SET_VARIABLE_NODE_TYPE`、`EXEC_GET_VARIABLE_NODE_TYPE`、`execflowNodeDefinitions`、`execflowRuntimeDefinitions`、`execflowNodeTypes`
- 函数：`FUNCTION_CALL_NODE_TYPE`、`functionCallNodeDefinitions`、`functionCallRuntimeDefinitions`、`functionNodeTypes`、`createFunctionCallPorts`（及其选项类型 `FunctionCallPortOptions`）
- 子图：`SUBGRAPH_CALL_NODE_TYPE`、`SUBGRAPH_INPUT_NODE_TYPE`、`SUBGRAPH_OUTPUT_NODE_TYPE`、`subgraphNodeDefinitions`、`subgraphRuntimeDefinitions`、`subgraphNodeTypes`、`createSubgraphCallPorts`、`createSubgraphInputPorts`、`createSubgraphOutputPorts`
- 强调色：`PRESET_NODE_ACCENTS`（`dataflow` 蓝、`execflow` 橙、`function` 紫、`subgraph` 青），四类节点的 `*NodeTypes` 都把它设为 `accent`，默认 DOM 节点的标题栏色标、小地图与无类型端口的连线颜色据此区分节点类别；每种颜色在深浅两套调色板下都保持至少 3:1 的对比度。业务节点可以在自己的 `NodeTypeDefinition` 上设置另一种 `accent`
- 类型：`NodeWrightPreset`、`NodeWrightPresetLayout`、`DataflowPresetOptions`、`ExecflowPresetOptions`、`FunctionPresetOptions`、`SubgraphPresetOptions`、`HybridFlowPresetOptions`

节点插件工厂（`createDataflowNodesPlugin` 等）与 runtime handler map 只在对应的 `nodes/*` 子路径中导出；端口生成函数是同一个函数，在根入口与 `nodes/function`、`nodes/subgraph` 子路径中都可导入。执行端口 id 常量（`EXEC_IN_PORT_ID`、`EXEC_THEN_PORT_ID` 等）由 `@node-wright/core/semantics` 提供，`nodes/execflow` 子路径也再导出它们，根入口不导出。

## DOM 字段

默认 DOM 节点只从 `NodeDefinition.parameters` 生成字段，因此每个原语节点的可编辑值都声明为参数：

| 节点                                      | 字段（参数）                                            |
| ----------------------------------------- | ------------------------------------------------------- |
| `data:source`                             | `value`                                                 |
| `data:transform`                          | `operation`（选项：透传、字符串、数字、布尔值、JSON）   |
| `exec:delay`                              | `durationMs`（可连线驱动）                              |
| `exec:log`                                | `message`（可连线驱动）                                 |
| `exec:set-variable` / `exec:get-variable` | `scope`（选项：运行、图、节点）、`name`（均可连线驱动） |
| `function:call`                           | `functionId`（调用目标，没有参数端口）                  |
| `subgraph:call`                           | `subgraphId`（调用目标，没有参数端口）                  |

标签、默认值与选项都写在参数上；`*NodeTypes` 只补充参数之外的显示设置（强调色、标题、副标题、`fieldSource`，以及 `data:source` 的 `kind: 'text'`、`exec:delay` 的 `min`/`step` 等 hint）。其余节点（`exec:event`、`exec:sequence`、`exec:branch`、`data:merge`、`data:preview`、子图边界节点）没有参数，只显示端口。参数与端口的完整对照见 [node-systems.md](./node-systems.md)。

## 边界与已知限制

- presets 只组合正式定义与配置：不创建 Runtime 实例，不持有业务 handler 或应用状态，也不包含 AI、HTTP、文件等业务领域节点。
- Runtime definition 的实现归属各节点系统；presets 只把它们组合进 `runtimeDefinitions`。具体业务函数与子图由应用通过 `NodeWrightRuntime` 的 `functionDefinitions` / `subgraphDefinitions` 注册。
