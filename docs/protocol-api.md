# Protocol API（`@node-engine-sdk/core/protocol`）

`@node-engine-sdk/core/protocol` 是所有模块共享的协议源。它不持有状态、不渲染 UI、不执行节点，只定义图格式、严格解析、诊断、节点参数 schema、扩展 manifest 与执行计划类型，以及共享的 `GraphIndex` 查找索引。

## 边界

- core 的 `store`、`semantics`、`layout`、`runtime`、`view` 模块，`@node-engine-sdk/presets`、两个 UI 适配层以及业务代码都可以直接依赖它；它不依赖任何其他模块。
- 只描述“图是什么、如何严格解析、如何检查、如何声明扩展”的能力放在 protocol。
- 会改变状态、触发交互、执行节点或访问业务服务的能力不放在 protocol。

## 图协议

`GraphSnapshot` 是唯一持久化图格式：

```ts
import {
  NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from '@node-engine-sdk/core/protocol'

const graph: GraphSnapshot = {
  schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  groups: [],
  meta: {},
}
```

| 字段            | 说明                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | 图数据协议版本，当前唯一值为 `NODE_ENGINE_GRAPH_SCHEMA_VERSION`（`'1.0.0'`）。它描述图结构，与 npm 包版本无关                                |
| `nodes`         | `GraphNode[]`：`id`、`type`、`x`、`y`，可选 `width`、`height`、`locked`、`ports`（实例端口，优先于定义端口）、`data`、`meta`                 |
| `edges`         | `GraphEdge[]`：`id`、`source`、`target`（`{ nodeId, portId }`）、`kind`（必填，如 `'data'`、`'exec'`），可选 `type`、`label`、`data`、`meta` |
| `groups`        | `GraphGroup[]`：`id`、`x`、`y`、`width`、`height`，可选 `label`、`color`、`nodeIds`（成员的唯一来源）、`data`、`meta`                        |
| `meta`          | 图级元数据，SDK 不解释                                                                                                                       |

`GraphPort` 字段：`id`、`direction`（`'input'` / `'output'`），可选 `name`、`label`、`kind`、`side`、`capacity`（数字或 `'many'`）、`required`、`dataType`、`accepts`、`data`、`meta`。具体的端口校验策略由 [semantics](./semantics-api.md) 提供。

端口与边的 kind 只有一条规则：端口未声明 `kind` 时为 `DEFAULT_PORT_KIND`（`'data'`，`resolvePortKind(port)` 解析）；边的 `kind` 必填，且必须等于其源端口的 kind。`GraphStore` 在 `connect` / `reconnectEdge` 时由源端口推导边的 kind（连线 API 不接受另行指定的 kind，`GraphEdgePatch` 也不含 `kind`）；`parseGraph` 拒绝缺少 `kind` 的边，结构校验对与源端口 kind 不一致的边报告 `EDGE_KIND_MISMATCH`。runtime、布局、环路检测与编辑器渲染都直接读取 `GraphEdge.kind`，不需要再解析端口。

`data` 与 `meta` 是业务扩展空间，必须是 JSON 可序列化值（`GraphValue`：有限数字、字符串、布尔、`null`、数组、普通对象，不允许循环引用）。运行时端口值不受此限制，由 runtime 独立使用 `unknown`。约定上节点参数保存在 `node.data.params`。

## Parse / Validate / Repair

三个入口职责不同，不要混用：

| 入口                             | 输入            | 行为                                                                                                                                                                                               |
| -------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseGraph(input, options?)`    | `unknown`       | 唯一外部输入边界。要求完整的图结构，拒绝缺失或不支持的 `schemaVersion`、缺失字段、未知协议字段、非 JSON 元数据和结构诊断 `error`，返回与输入解除引用的 `GraphSnapshot`；失败抛出 `GraphParseError` |
| `validateGraph(graph, options?)` | `GraphSnapshot` | 返回 `GraphValidationResult`，不修改图                                                                                                                                                             |
| `repairGraph(graph, options?)`   | `GraphSnapshot` | 显式机械修复：删除引用缺失节点/端口或 kind 与源端口不一致的边、清理分组中不存在的节点，返回修复后的图与诊断                                                                                        |

`options`（`ValidateGraphOptions`）可以提供 `nodeDefinitions`、`edgeDefinitions` 与 `providers`（额外诊断 provider）。

```ts
import {
  GraphParseError,
  parseGraph,
  repairGraph,
  type NodeDefinition,
} from '@node-engine-sdk/core/protocol'

const nodeDefinitions: NodeDefinition[] = [
  { type: 'demo', ports: [{ id: 'out', direction: 'output', kind: 'data' }] },
]

export function load(input: unknown) {
  try {
    const graph = parseGraph(input, { nodeDefinitions })
    // 只有业务明确允许机械修复时才调用 repairGraph。
    return repairGraph(graph, { nodeDefinitions }).graph
  } catch (error) {
    if (error instanceof GraphParseError) {
      console.error(error.path, error.diagnostics)
    }

    throw error
  }
}
```

`GraphParseError` 带 `path`（第一个错误的位置，如 `nodes.0.type`）与完整的 `diagnostics`。`GraphStore` 的构造、`replaceGraph`、`applyGraph` 同样拒绝协议结构错误；需要修复时显式调用 `repairGraph()` 或编辑器的 `api.graph.repair()`，导入时不会隐式删除数据。语义诊断（例如必填输入未连接）只用于展示，不会被当成协议解析失败。

协议没有迁移入口：不符合当前 `schemaVersion` 的外部输入直接失败。未来出现真实的跨版本需求时再单独设计迁移工具。

## 诊断

所有图级问题统一表达为 `GraphDiagnostic`：

```ts
type GraphDiagnosticSeverity = 'error' | 'warning' | 'info'

interface GraphDiagnostic {
  code: string
  severity: GraphDiagnosticSeverity
  message: string
  source: string
  nodeId?: string
  edgeId?: string
  groupId?: string
  portId?: string
  path?: string
}
```

`GraphValidationResult.valid` 只在没有 `error` 时为 `true`；`warning` 与 `info` 不阻塞导入或执行计划生成。`createGraphValidationResult(diagnostics)` 与 `mergeGraphValidationResults(...results)` 用于组装结果。

协议内置的结构诊断：

| code                                                             | 等级    | 含义                                                |
| ---------------------------------------------------------------- | ------- | --------------------------------------------------- |
| `NODE_ID_DUPLICATE` / `EDGE_ID_DUPLICATE` / `GROUP_ID_DUPLICATE` | error   | id 重复                                             |
| `PORT_ID_DUPLICATE`                                              | error   | 节点实例端口 id 重复                                |
| `NODE_DEFINITION_TYPE_DUPLICATE`                                 | error   | 节点定义 `type` 重复                                |
| `NODE_DEFINITION_PORT_ID_DUPLICATE`                              | error   | 节点定义端口 id 重复                                |
| `NODE_PARAMETER_PORT_ID_CONFLICT`                                | error   | 参数输入端口与普通端口 id 冲突                      |
| `NODE_PARAMETER_PORT_ID_DUPLICATE`                               | error   | 参数输入端口 id 重复                                |
| `EDGE_SOURCE_NODE_MISSING` / `EDGE_TARGET_NODE_MISSING`          | error   | 边引用的节点不存在                                  |
| `EDGE_SOURCE_PORT_MISSING` / `EDGE_TARGET_PORT_MISSING`          | error   | 边引用的端口不存在（含已知零端口节点的任意端口 id） |
| `EDGE_KIND_MISMATCH`                                             | error   | 边的 `kind` 与其源端口的 kind 不一致                |
| `GROUP_NODE_MISSING`                                             | error   | 分组引用的节点不存在                                |
| `NODE_TYPE_UNKNOWN`                                              | warning | 提供了节点定义列表，但节点 `type` 不在其中          |
| `EDGE_TYPE_UNKNOWN`                                              | warning | 提供了边定义列表，但边的 `type` 不在其中            |

`repairGraph` 产生的诊断以 `REPAIRED_` 为前缀（例如 `REPAIRED_EDGE_SOURCE_PORT_MISSING`、`REPAIRED_GROUP_NODE_MISSING`），等级为 `warning`。

### 自定义诊断

```ts
import type { GraphDiagnosticProvider } from '@node-engine-sdk/core/protocol'

export const archivedTypeProvider: GraphDiagnosticProvider = ({ graph }) =>
  graph.nodes
    .filter((node) => node.type.startsWith('archived:'))
    .map((node) => ({
      code: 'ARCHIVED_NODE_TYPE',
      severity: 'warning' as const,
      message: `Node "${node.id}" uses an archived type.`,
      source: 'my-app',
      nodeId: node.id,
    }))
```

provider 可以通过 `parseGraph` / `validateGraph` 的 `providers`、Store 的 `diagnosticProviders` 选项或 `registerDiagnosticProvider`，以及插件的 `contributes.diagnostics` 接入。

## 节点定义与参数 schema

`NodeDefinition` 描述节点协议，不描述产品 UI：

```ts
import type { NodeDefinition } from '@node-engine-sdk/core/protocol'

export const promptNode: NodeDefinition = {
  type: 'prompt:text',
  label: 'Prompt',
  category: 'Input',
  width: 280,
  height: 160,
  ports: [{ id: 'text', direction: 'output', kind: 'data', dataType: 'string' }],
  parameters: [
    { key: 'prompt', kind: 'string', label: 'Prompt', defaultValue: '', required: true },
    {
      key: 'mode',
      kind: 'select',
      label: 'Mode',
      defaultValue: 'plain',
      options: [
        { label: 'Plain', value: 'plain' },
        { label: 'Template', value: 'template' },
      ],
      input: true,
    },
  ],
  dataDefaults: { params: { prompt: '' } },
}
```

| 字段                                       | 说明                                                |
| ------------------------------------------ | --------------------------------------------------- |
| `type`                                     | 节点类型，建议使用命名空间（如 `ticket:format`）    |
| `label`、`description`、`category`、`tags` | 展示与分类信息                                      |
| `width`、`height`                          | 默认尺寸                                            |
| `ports`                                    | 定义端口；节点实例的 `ports` 非空时优先使用实例端口 |
| `parameters`                               | 参数 schema（`NodeParameterDefinition[]`）          |
| `parameterInputs`                          | 设为 `true` 时所有参数默认生成输入端口              |
| `dataDefaults`、`metaDefaults`             | 创建节点时合并的默认 `data` / `meta`（值或函数）    |

`NodeParameterDefinition`：

| 字段           | 说明                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`          | 参数 key，值默认存放在 `node.data.params[key]`                                                                                                      |
| `kind`         | `'string'`、`'number'`、`'boolean'`、`'select'`、`'json'`、`'code'`、`'file'`                                                                       |
| `label`        | 显示名                                                                                                                                              |
| `defaultValue` | 默认值，编辑器创建节点时写入                                                                                                                        |
| `required`     | 必填声明，业务可以用诊断 provider 扩展为规则                                                                                                        |
| `options`      | 选项（`select`）                                                                                                                                    |
| `input`        | 参数输入端口策略：`true` 使用端口 id `field:${key}`；`{ portId, label, kind, dataType, accepts, ... }` 自定义；`false` 覆盖节点级 `parameterInputs` |
| `dataPath`     | 声明非默认的数据路径，SDK 不强制解释                                                                                                                |
| `ui`           | UI 提示（例如 `placeholder`、`description`），只放提示，不放业务逻辑                                                                                |

只有显式打开输入策略的参数会生成协议级参数输入端口（`data.parameter: true`、`data.parameterKey`）；`validateGraph()`、编辑器与 runtime 都通过 `resolveNodePorts()` 识别它们。参数端口的 `dataType` 默认由参数 `kind` 推导：`string` / `code` / `file` → `string`，`number` → `number`，`boolean` → `boolean`，`select` / `json` → `any`。相关工具函数：`resolveNodePorts`、`resolvePortKind`、`getNodeParameterDefinitions`、`resolveNodeParameterInput`、`resolveNodeParameterInputPortId`、`resolveNodeParameterInputPorts`、`mergeParameterInputPorts`。

`EdgeDefinition` 提供 `type`、`label`、`description`、`dataDefaults`、`metaDefaults`、`tags`。

## `GraphIndex`

`new GraphIndex(graph, nodeDefinitions?)` 是一个图快照的只读查找索引，Store、Semantics 与 Runtime 共用它：

- id 查找（`nodes`、`edges`、`groups` 三个 `ReadonlyMap`、`hasId(id)`）在构造时以 O(V + E + G) 建立；
- `getPort(endpoint)`、`listPorts(nodeId)` 在首次使用时解析并按节点缓存端口；
- `listIncomingEdges(endpoint)`、`listOutgoingEdges(endpoint)`、`listNodeOutgoingEdges(nodeId)`、`countIncoming(endpoint, ignoredEdgeId?)` 在首次使用时以 O(E) 建立邻接表。

索引不会比它所属的快照活得更久；图变化后应基于新快照重新构造。

## 扩展 manifest

`NodeEngineExtensionManifest` 描述一个扩展贡献什么；`GraphPlugin` 在其上增加 `setup(context)`：

```ts
import type {
  ConnectionValidator,
  GraphPlugin,
  NodeDefinition,
} from '@node-engine-sdk/core/protocol'

const ticketNode: NodeDefinition = { type: 'ticket:create', ports: [] }
const noSelfLoop: ConnectionValidator = ({ source, target }) =>
  source.nodeId === target.nodeId ? { valid: false, reason: 'No self loops.' } : { valid: true }

export const ticketPlugin: GraphPlugin = {
  name: '@my-org/nodes-ticket',
  contributes: {
    nodeDefinitions: [ticketNode],
  },
  setup(context) {
    return context.addConnectionValidator(noSelfLoop)
  },
}
```

`contributes` 支持 `diagnostics`、`nodeDefinitions`、`edgeDefinitions`、`commands`。`setup` 的 `context`（`GraphPluginContext`）提供 `store`（`GraphStoreLike`）、`addConnectionValidator`、`createId`、`registerCommand`、`registerNodeDefinition`、`registerEdgeDefinition`、`registerDiagnosticProvider`，可以返回清理函数。编辑器插件 `NodeEnginePlugin` 另有 `components` 字段，见 [controller-api.md](./controller-api.md#插件-components)。

## 执行计划

```ts
interface NodeEngineExecutionPlan {
  id: string
  schemaVersion: typeof NODE_ENGINE_GRAPH_SCHEMA_VERSION
  graph: GraphSnapshot
  entryNodeId: string
  nodeOrder: string[]
  diagnostics: GraphDiagnostic[]
}

interface NodeEngineCompileResult {
  valid: boolean
  diagnostics: GraphDiagnostic[]
  plan?: NodeEngineExecutionPlan
}
```

protocol 只定义形状；生成计划（入口解析、handler 检查、数据环检测）由 [`@node-engine-sdk/core/runtime`](./runtime-api.md#编译执行计划) 的 `compileGraph()` 或 `runtime.compile()` 完成。

## 其他工具

- `cloneGraph(graph)`、`cloneValue(value)`：深拷贝。
- `snapshotEquals(left, right)`：迭代式结构相等比较。
- `findNode`、`findEdge`、`findGroup`：线性查找；`findPort(graph, endpoint, definitions?)` 解析端口。频繁查询时使用 `GraphIndex`。
