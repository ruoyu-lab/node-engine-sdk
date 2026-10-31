# Semantics API（`@node-wright/core/semantics`）

`@node-wright/core/semantics` 负责端口语义与连线规则：端口 kind、数据类型、容量、环路、必填输入，以及函数、子图、变量的签名与引用。它不持有 Store 或 UI 状态，也不执行节点；只依赖 `protocol`。

## 流程插件

最常用的入口是三个流程插件，它们都是 `GraphPlugin`，可以交给 Store（`plugins` 选项或 `store.use()`）或编辑器（`plugins` prop）：

```ts
import {
  createDataflowPlugin,
  createExecflowPlugin,
  createHybridFlowPlugin,
} from '@node-wright/core/semantics'

export const dataflow = createDataflowPlugin()
export const execflow = createExecflowPlugin({ preventCycles: true })
export const hybrid = createHybridFlowPlugin({
  dataflow: { compatibleDataTypes: { integer: ['number'] } },
  execflow: { allowSameNodeConnections: true },
})
```

| 插件                       | 插件名                    | 默认规则                                                                           |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `createDataflowPlugin()`   | `node-wright:dataflow`    | 同节点、方向、kind、数据类型、容量、数据环（`preventCycles` 默认 `true`）          |
| `createExecflowPlugin()`   | `node-wright:execflow`    | 同节点、方向、kind、数据类型、容量；执行环默认允许（`preventCycles: true` 时禁止） |
| `createHybridFlowPlugin()` | `node-wright:hybrid-flow` | 按连接类型分别运行 dataflow 与 execflow 规则                                       |

三个插件都会同时注册交互连接校验器和整图诊断 provider，并开启必填输入诊断：同一套规则既用于拖线预览，也用于 `store.validateGraph()` / `api.diagnostics.list()`，不会漂移。默认规则数组也可以单独取得：`createDataflowConnectionRules(options)`、`createExecflowConnectionRules(options)`、`createHybridFlowConnectionRules(options)`。

Hybrid 按连接的 `context.kind`（`'data'` 或 `'exec'`，即边的 kind）分别运行两侧规则；`dataflow` 与 `execflow` 选项各自独立生效，不会合并或互相覆盖；顶层 `rules` 对所有连接运行。

### 选项

`DataflowPluginOptions` / `ExecflowPluginOptions` 继承 `PortSemanticsOptions`：

| 选项                       | 默认                               | 说明                                       |
| -------------------------- | ---------------------------------- | ------------------------------------------ |
| `allowSameNodeConnections` | `false`                            | 是否允许同一节点的端口互连                 |
| `requireOutputToInput`     | `true`                             | 要求 output → input                        |
| `validateKinds`            | `true`                             | 两端端口 kind 必须一致                     |
| `validateDataTypes`        | `true`                             | 校验数据类型兼容                           |
| `validateCapacity`         | `true`                             | 校验目标端口 `capacity`                    |
| `wildcardDataTypes`        | `['any', '*', 'unknown']`          | 与任意类型兼容的类型名                     |
| `compatibleDataTypes`      | `{}`                               | 额外兼容关系，如 `{ integer: ['number'] }` |
| `preventCycles`            | dataflow `true` / execflow `false` | 是否禁止同 kind 环路                       |
| `rules`                    | `[]`                               | 追加的自定义规则                           |
| `requireExecPortKinds`     | -                                  | 仅 execflow：设为 `false` 时关闭 kind 校验 |

## 自定义规则

规则是 `(context: SemanticConnectionContext) => ConnectionValidationResult | void`，或带 `id` 的 `ConnectionRuleDefinition`。同一个 `id` 的后出现规则会替换先出现的规则，因此可以用内置 id（`same-node`、`direction`、`kind`、`data-type`、`capacity`、`cycle:data`、`cycle:exec`）覆盖默认行为。

```ts
import {
  createCapacityRule,
  createConnectionRulesPlugin,
  createCycleRule,
  createDataTypeRule,
  createDirectionRule,
  createKindRule,
  createSameNodeRule,
  defineConnectionRule,
} from '@node-wright/core/semantics'

const noPreviewChains = defineConnectionRule('no-preview-chains', (context) =>
  context.sourceNode?.type === 'data:preview'
    ? { valid: false, code: 'PREVIEW_IS_TERMINAL', reason: 'Preview nodes are terminal.' }
    : { valid: true },
)

export const rulesPlugin = createConnectionRulesPlugin(
  [
    createSameNodeRule(),
    createDirectionRule(),
    createKindRule({ allowKinds: [['data', 'event']] }),
    createDataTypeRule(),
    createCapacityRule(),
    createCycleRule({ kind: 'data' }),
    noPreviewChains,
  ],
  { name: 'my-app:rules', validateRequiredInputs: true },
)
```

`SemanticConnectionContext` 在 `ConnectionContext`（`graph`、`source`、`target`、`kind`、`sourceNode`、`targetNode`、`sourcePort`、`targetPort`）之上提供：

- `index`：一次构建、所有规则共享的 [`GraphIndex`](./protocol-api.md#graphindex)；
- `ignoredEdgeId`：诊断现有边时表示“先忽略这条边再验证”，容量与环路规则据此计算，不会复制或过滤整张图。

`kind` 是被校验的边的 kind。协议规定边的 kind 必填且等于源端口的 kind（见[协议](./protocol-api.md#图协议)），因此两条路径口径一致：交互校验时 Store 传入将要创建的边的 kind（源端口 kind），整图诊断时传入边上保存的 `kind`。端口未声明 `kind` 时按 `'data'`（protocol 的 `DEFAULT_PORT_KIND`）处理，这一默认值在协议、Store、语义规则与 runtime 中相同，不可配置。

端口统一经 Protocol 的 `resolveNodePorts()` 解析，节点实例端口、定义端口和参数输入端口在拖线预览、容量、必填输入和整图诊断中的结论一致。

| 规则                        | 失败 code                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `createSameNodeRule()`      | `SAME_NODE_CONNECTION`                                                                    |
| `createDirectionRule()`     | `PORT_NOT_FOUND`、`PORT_DIRECTION_MISMATCH`                                               |
| `createKindRule()`          | `PORT_KIND_MISMATCH`                                                                      |
| `createDataTypeRule()`      | `PORT_DATA_TYPE_MISMATCH`                                                                 |
| `createCapacityRule()`      | `TARGET_PORT_CAPACITY_REACHED`                                                            |
| `createCycleRule({ kind })` | 默认 `CYCLE_DETECTED`；流程插件中为 `DATAFLOW_CYCLE_DETECTED` / `EXECFLOW_CYCLE_DETECTED` |

装配函数：

- `createConnectionRulesPlugin(rules, { name?, validateRequiredInputs? })`：注册校验器与诊断 provider 的插件。
- `createConnectionRulesValidator(rules, getNodeDefinitions?)`：只得到 `ConnectionValidator`。
- `createConnectionRulesDiagnosticProvider(rules, { source?, validateRequiredInputs? })`：只得到 `GraphDiagnosticProvider`；规则失败记为 `error`，未给 code 时为 `CONNECTION_RULE_FAILED`。

## 必填输入

`port.required === true` 的输入端口没有任何入边时产生 `REQUIRED_INPUT_MISSING`（`error`，来源 `semantics:required-input`）：

- `findRequiredInputIssues(index)` / `validateRequiredInputPorts(graph, nodeDefinitions?)`：返回问题列表。
- `createRequiredInputDiagnosticProvider()`：作为独立 provider 注册。

语义诊断不会阻止图加载，用于编辑器展示和业务决策；修复策略由业务决定。

## 环路

`wouldCreateCycle(index, edge, kind, ignoredEdgeId?)` 判断新增（或保留现有）一条 `kind` 边是否形成环，只沿 `edge.kind === kind` 的边遍历，使用迭代式 O(V + E) 可达性遍历，深图不会耗尽调用栈。`hasCycleForKind(graph, edge, kind)` 是基于快照的便捷版本。

## 节点能力

节点能力只定义在 `SemanticNodeDefinition.capabilities`（`SemanticNodeDefinition` 继承 `NodeDefinition`）：

```ts
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'

export const requestNode: SemanticNodeDefinition = {
  type: 'http:request',
  capabilities: ['effect', 'async'],
  ports: [],
}
```

| 能力        | 含义（Runtime 中的作用）                            |
| ----------- | --------------------------------------------------- |
| `pure`      | 无副作用：默认可缓存、可重试                        |
| `effect`    | 有副作用：默认不重试                                |
| `async`     | 异步执行                                            |
| `event`     | 执行入口：未指定入口时编译器选择第一个 `event` 节点 |
| `composite` | 组合节点标记                                        |

`node.meta` 与 `metaDefaults` 不承担能力语义；`hasNodeCapability(definition, capability)` 是唯一的读取入口。

## 值类型

端口可以只写 `dataType: 'string'`。需要结构化类型时，唯一入口是 `port.data.type`：

```ts
import type { GraphPort } from '@node-wright/core/protocol'

export const payloadPort: GraphPort = {
  id: 'payload',
  direction: 'input',
  kind: 'data',
  dataType: 'object',
  data: {
    type: {
      kind: 'object',
      required: ['id'],
      properties: { id: 'string', count: 'number' },
    },
  },
}
```

- `createDataTypeRule()` 优先读取 `data.type`，未声明时使用 `dataType`；目标可接受类型只读取顶层 `accepts`。
- `ValueTypeRef` 是类型名（`any`、`unknown`、`never`、`string`、`number`、`integer`、`boolean`、`object`、`array`、`null`、`undefined` 或自定义名）或 `ValueTypeSchema`（`kind`、`items`、`properties`、`required`、`union`、`enum` 等）。
- 工具：`createValueType`、`normalizeValueType`、`serializeValueType`（转为可持久化的 `GraphValue`）、`isValueTypeCompatible`、`validateValueType`（产生带路径的 `VALUE_TYPE_MISMATCH` 问题）、`inferValueTypeKind`、`formatTypeRef`、`resolvePortValueType`、`resolvePortAcceptedValueTypes`、`isPortDataTypeCompatible`。

## 函数签名

semantics 只描述函数签名，不执行函数，也不生成 UI：

```ts
import type { FunctionDefinition } from '@node-wright/core/semantics'

export const formatMessage: FunctionDefinition = {
  id: 'format-message',
  label: '格式化消息',
  mode: 'pure',
  inputs: [{ id: 'payload', dataType: 'string', required: true }],
  outputs: [{ id: 'message', dataType: 'string' }],
}
```

`mode` 可为 `'pure'`、`'effect'`、`'async'`、`'subgraph'` 或自定义字符串。`createFunctionDefinition()`、`createFunctionReference()`、`normalizeFunctionId()` 要求非空 id，空值直接抛错。函数 handler 注册在 [runtime](./runtime-api.md#函数)，调用节点来自 `@node-wright/presets/nodes/function`。

### 签名校验

函数与子图的输入、输出会成为同一个调用节点的端口，所以签名必须能生成一组不冲突的端口 id。`validateFunctionSignature(definition, path?)` 与 `validateSubgraphSignature(definition, path?)` 一次遍历（O(输入数 + 输出数)）检查签名并返回 `GraphDiagnostic[]`：

| code                                                                            | 含义                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `FUNCTION_SIGNATURE_PORT_ID_DUPLICATE` / `SUBGRAPH_SIGNATURE_PORT_ID_DUPLICATE` | 输入或输出的 id 与先出现的输入/输出相同（同一列表内重复，或输出与输入同 id） |
| `FUNCTION_SIGNATURE_PORT_ID_RESERVED` / `SUBGRAPH_SIGNATURE_PORT_ID_RESERVED`   | 使用了调用节点保留的执行端口 id（`exec:in`、`exec:then`、`exec:error`）      |

诊断带 `portId` 与定位到具体条目的 `path`（如 `outputs.0.id`；传入 `path` 前缀时为 `functionDefinitions.1.outputs.0.id`），`message` 写明函数或子图 id 以及与之冲突的条目。三处使用这同一份校验：`createFunctionDefinition()` / `createSubgraphDefinition()` 在签名无效时抛出列出全部诊断的错误；`@node-wright/presets` 的调用节点与边界节点端口生成函数先经过它们，不会生成重复端口；`compileGraph()` / `runtime.compile()` 把注册的函数与子图签名诊断（路径前缀 `functionDefinitions.<i>` / `subgraphDefinitions.<i>`）计入编译结果，签名无效时编译失败。

## 子图签名

```ts
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION } from '@node-wright/core/protocol'
import type { SubgraphDefinition } from '@node-wright/core/semantics'

export const wrapMessage: SubgraphDefinition = {
  id: 'wrap-message',
  graph: {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
  },
  inputs: [{ id: 'message', dataType: 'string' }],
  outputs: [{ id: 'wrapped', dataType: 'string' }],
}
```

`SubgraphDefinition` 还可以给出 `inputNodeId`、`outputNodeId`（边界节点 id）、`eventId`、`label`、`category`、`description`、`tags`、`meta`；边界端口 `SubgraphBoundaryPort` 支持 `dataType`、`valueType`、`accepts`、`required`、`defaultValue`。调用节点会同时带上输入与输出端口，因此同一签名中输入与输出的 id 不能重复，校验规则见[签名校验](#签名校验)。常量 `SUBGRAPH_CALL_NODE_TYPE`（`'subgraph:call'`）、`SUBGRAPH_INPUT_NODE_TYPE`（`'subgraph:input'`）、`SUBGRAPH_OUTPUT_NODE_TYPE`（`'subgraph:output'`）定义在这里。完整流程见 [subgraph-guide.md](./subgraph-guide.md)。

## 变量引用

- 作用域常量：`VARIABLE_SCOPE_RUN`（`'run'`，默认）、`VARIABLE_SCOPE_GRAPH`（`'graph'`）、`VARIABLE_SCOPE_NODE`（`'node'`），也可以使用自定义作用域名。
- `createVariableReference(input, options?)`：字符串或 `{ name, scope?, nodeId? }` → `VariableReference`；空名称抛错。
- `createVariableDefinition`、`normalizeVariableName`、`normalizeVariableScope`。

变量的读写发生在 [runtime](./runtime-api.md#变量)。

## 执行端口常量

`EXEC_IN_PORT_ID`（`'exec:in'`）、`EXEC_THEN_PORT_ID`（`'exec:then'`）、`EXEC_ERROR_PORT_ID`（`'exec:error'`）是执行流节点约定的端口 id，`@node-wright/presets/nodes/execflow` 也转出了它们。
