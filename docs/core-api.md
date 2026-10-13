# Core API

`@node-engine-sdk/core` 是 Node Engine SDK 框架无关的底层 SDK：协议、状态、语义、运行时、布局、调试与编辑器控制器都在这里，官方适配层与官方预设都构建在它之上。它不依赖任何 UI 框架，也不依赖其他 `@node-engine-sdk/*` 包；只有 `view` 子路径使用 DOM API。本文按子路径列出公开导出，并完整说明 `store` 子路径；其余子路径的详细用法见各自文档。

| 子路径                                 | 内容                                                                                 | 详细文档                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `@node-engine-sdk/core`                | 根入口，等于 `protocol` + `store` 的全部导出                                         | 本文                                           |
| `@node-engine-sdk/core/protocol`       | 图协议、严格解析、诊断、修复、参数 schema、扩展 manifest、执行计划类型、`GraphIndex` | [protocol-api.md](./protocol-api.md)           |
| `@node-engine-sdk/core/store`          | `GraphStore`、内置命令、命令辅助函数、事务、历史、插件生命周期                       | 本文                                           |
| `@node-engine-sdk/core/semantics`      | 端口语义、连线规则、流程插件、值类型、函数/子图/变量引用                             | [semantics-api.md](./semantics-api.md)         |
| `@node-engine-sdk/core/runtime`        | 执行计划编译、`NodeEngineRuntime`、调度器、变量 API                                  | [runtime-api.md](./runtime-api.md)             |
| `@node-engine-sdk/core/layout`         | 分层自动布局与位置 patch                                                             | [layout-api.md](./layout-api.md)               |
| `@node-engine-sdk/core/debug`          | 运行结果的汇总与查询                                                                 | [runtime-debugging.md](./runtime-debugging.md) |
| `@node-engine-sdk/core/view`           | 编辑器控制器、`NodeEngineApi`、事件与渲染扩展类型、DOM 节点模型                      | [controller-api.md](./controller-api.md)       |
| `@node-engine-sdk/core/view/style.css` | 编辑器共享样式（Vue/React 适配层已各自打包为 `style.css`）                           | [controller-api.md](./controller-api.md#样式)  |

## `@node-engine-sdk/core/protocol`

值导出：

- 常量：`NODE_ENGINE_GRAPH_SCHEMA_VERSION`（当前为 `'1.0.0'`，是图数据协议版本，与包版本无关）、`DEFAULT_PORT_KIND`（`'data'`，未声明 `kind` 的端口的 kind）
- 解析与校验：`parseGraph`、`validateGraph`、`repairGraph`、`GraphParseError`
- 诊断结果：`createGraphValidationResult`、`mergeGraphValidationResults`
- 克隆与比较：`cloneGraph`、`cloneValue`、`snapshotEquals`
- 查找：`findNode`、`findEdge`、`findGroup`、`findPort`、`GraphIndex`
- 端口与参数：`resolveNodePorts`、`resolvePortKind`、`getNodeParameterDefinitions`、`resolveNodeParameterInput`、`resolveNodeParameterInputPortId`、`resolveNodeParameterInputPorts`、`mergeParameterInputPorts`

类型导出：

- 图：`GraphSnapshot`、`GraphNode`、`GraphEdge`、`GraphGroup`、`GraphPort`、`GraphEndpoint`、`GraphEdgeReconnect`、`GraphNodePatch`、`GraphEdgePatch`、`GraphGroupPatch`、`GraphMetadata`、`GraphValue`、`GraphPrimitive`、`PortDirection`、`XYPosition`、`Size`
- 定义：`NodeDefinition`、`EdgeDefinition`、`NodeParameterDefinition`、`NodeParameterKind`、`NodeParameterOption`、`NodeParameterInputDefinition`、`NodeParameterInputPolicy`
- 连接：`ConnectionContext`、`ConnectionValidationResult`、`ConnectionValidator`
- 诊断：`GraphDiagnostic`、`GraphDiagnosticSeverity`、`GraphValidationResult`、`GraphDiagnosticContext`、`GraphDiagnosticProvider`、`GraphRepairResult`、`ValidateGraphOptions`、`RepairGraphOptions`
- 命令与事件：`GraphCommand`、`GraphCommandDefinition`、`GraphCommandMetadata`、`GraphCommandRegistryEntry`、`GraphCommandDispatchResult`、`GraphCommandApi`、`GraphHistoryEntry`、`GraphChangeOptions`、`GraphStoreEvent`、`GraphStoreEventBase`、`GraphChangedEvent`、`GraphCommandEvent`、`GraphHistoryEvent`、`GraphPluginEvent`、`GraphRegistryEvent`、`GraphStoreListener`
- Store 与插件契约：`GraphStoreLike`、`GraphStoreOptions`、`GraphPlugin`、`GraphPluginContext`、`NodeEngineExtensionManifest`、`NodeEngineExtensionContributions`
- 执行计划：`NodeEngineExecutionPlan`、`NodeEngineCompileResult`

## `@node-engine-sdk/core/store`

导出 `GraphStore`、`createGraphStore`、12 个命令辅助函数（`addNodeCommand`、`updateNodeCommand`、`moveNodesCommand`、`removeNodeCommand`、`addEdgeCommand`、`updateEdgeCommand`、`reconnectEdgeCommand`、`removeEdgeCommand`、`connectPortsCommand`、`addGroupCommand`、`updateGroupCommand`、`removeGroupCommand`）与 `composeValidationResults`。`store` 子路径不再导出协议类型，类型从 `@node-engine-sdk/core/protocol` 或根入口导入。

### 创建

```ts
import { NODE_ENGINE_GRAPH_SCHEMA_VERSION } from '@node-engine-sdk/core/protocol'
import { createGraphStore } from '@node-engine-sdk/core/store'

const store = createGraphStore(
  { schemaVersion: NODE_ENGINE_GRAPH_SCHEMA_VERSION, nodes: [], edges: [], groups: [], meta: {} },
  {
    nodeDefinitions: [{ type: 'demo', ports: [{ id: 'out', direction: 'output' }] }],
    historyLimit: 200,
  },
)

store.transaction('Add pair', () => {
  store.addNode({ id: 'a', type: 'demo', x: 0, y: 0 })
  store.addNode({ id: 'b', type: 'demo', x: 240, y: 0 })
})

store.undo()
```

`createGraphStore(graph?, options?)` 与 `new GraphStore(graph?, options?)` 等价；省略 `graph` 时为空图。`GraphStoreOptions`：

| 选项                  | 说明                                                     |
| --------------------- | -------------------------------------------------------- |
| `nodeDefinitions`     | 节点定义；用于端口解析、参数输入端口与结构校验           |
| `edgeDefinitions`     | 边定义                                                   |
| `commands`            | 额外注册的命令                                           |
| `validators`          | 交互连接校验器（`ConnectionValidator[]`）                |
| `diagnosticProviders` | 整图诊断 provider                                        |
| `plugins`             | 插件（`GraphPlugin[]`），按顺序 `use`                    |
| `idFactory`           | 自定义 id 生成；默认 `${prefix}-${序号}` 并跳过已占用 id |
| `historyLimit`        | 撤销栈上限，默认 `100`                                   |

构造时会校验初始图；存在协议结构错误时抛错，并释放已注册的插件。

### 读取

| 方法                                           | 说明                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `getSnapshot()`                                | 当前图的隔离副本                         |
| `getNode(id)` / `getEdge(id)` / `getGroup(id)` | 按 id 查询（O(1) 索引），返回隔离副本    |
| `getPort(endpoint)`                            | 解析节点端口（含定义端口与参数输入端口） |
| `listGroups()`                                 | 全部分组                                 |
| `canUndo` / `canRedo`                          | 只读属性                                 |
| `createId(prefix?)`                            | 生成未被占用的 id                        |
| `subscribe(listener)`                          | 订阅 `GraphStoreEvent`，返回取消函数     |

所有查询值与事件 payload 都与内部状态隔离，修改它们不会影响 Store。

### 写入

| 方法                                       | 说明                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `addNode(node, options?)`                  | 新增节点；同 id 已存在时抛错（add 不承担 upsert）                                                                               |
| `updateNode(id, patch, options?)`          | 更新节点；`GraphNodePatch` 只允许位置、尺寸、`locked`、`ports`、`data`、`meta`                                                  |
| `moveNodes(ids, delta, options?)`          | 平移多个节点                                                                                                                    |
| `removeNode(id, options?)`                 | 删除节点及其连线，并从分组成员中移除                                                                                            |
| `addEdge` / `updateEdge` / `removeEdge`    | 边的增改删；`addEdge` 的 `kind` 必须等于源端口 kind，`GraphEdgePatch` 不含 `kind`                                               |
| `connect(source, target, options?)`        | 校验并连线，返回 `ConnectionValidationResult`；`options` 可带 `edgeId`、`edgeType`、`data`、`change`；边的 `kind` 取源端口 kind |
| `reconnectEdge(id, reconnect, options?)`   | 重连边的一端，返回 `ConnectionValidationResult`；换源端口时 `kind` 随新源端口更新                                               |
| `addGroup` / `updateGroup` / `removeGroup` | 分组的增改删；分组成员唯一来源是 `GraphGroup.nodeIds`                                                                           |
| `replaceGraph(graph, options?)`            | 替换整图并清空撤销/重做历史                                                                                                     |
| `applyGraph(graph, options?)`              | 把整图作为一条可撤销历史应用                                                                                                    |
| `execute(command, options?)`               | 执行一个 `GraphCommand`（草稿式修改）                                                                                           |
| `mutate(label, recipe, options?)`          | 以 `recipe(draft)` 修改草稿，产生一条历史                                                                                       |
| `transaction(label, operation, options?)`  | 同步原子作用域，见下文                                                                                                          |
| `undo()` / `redo()`                        | 撤销 / 重做                                                                                                                     |

便捷写方法失败时抛错，不会返回旧快照伪装成功。`options.source` 会出现在事件的 `source` 字段，用于区分来源。

### 命令

内置命令 id：`node.add`、`node.update`、`node.move`、`node.remove`、`edge.add`、`edge.update`、`edge.connect`、`edge.reconnect`、`edge.remove`、`group.add`、`group.update`、`group.remove`。另有内部历史条目 `graph.apply`、`graph.mutate`、`graph.repair`。

| 方法                                      | 说明                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `registerCommand(definition)`             | 注册 `GraphCommandDefinition`，返回注销函数                                                                             |
| `getCommand(id)` / `listCommands()`       | 查询                                                                                                                    |
| `dispatchCommand(id, payload?, options?)` | 执行命令并返回 `GraphCommandDispatchResult`（`applied`、`snapshot`、`reason`、`validation`、`diagnostics`），失败不抛错 |

`GraphCommandDefinition` 的 `validate(payload, store)` 可以返回布尔值、`ConnectionValidationResult` 或 `GraphValidationResult`；`execute(payload, draft, api, store)` 只能通过 `draft` 和 `GraphCommandApi`（`createId`、`getNode`、`ensureNode` 等）修改草稿。命令辅助函数（例如 `addNodeCommand(node)`）返回可直接交给 `store.execute()` 的 `GraphCommand`。

### 事务

```ts
store.transaction('Layout', () => {
  store.moveNodes(['a'], { x: 40, y: 0 })
  store.updateNode('b', { width: 320 })
})
```

- 作用域内的命令只修改暂存状态；成功后只产生一条历史、一次最终诊断和一次 `graph:changed`。
- 任一命令失败或最终结构校验失败时整体回滚，并抛出错误。
- 嵌套事务、异步 operation（返回 Promise）都会被拒绝；事务中不能调用 `replaceGraph`、`applyGraph`、`repairGraph`、`undo`、`redo`。

### 注册表与诊断

| 方法                                                                   | 说明                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerNodeDefinition` / `getNodeDefinition` / `listNodeDefinitions` | 节点定义注册表                                                                                                                                                                              |
| `registerEdgeDefinition` / `getEdgeDefinition` / `listEdgeDefinitions` | 边定义注册表                                                                                                                                                                                |
| `registerDiagnosticProvider(provider)`                                 | 注册整图诊断 provider                                                                                                                                                                       |
| `addConnectionValidator(validator)`                                    | 注册交互连接校验器                                                                                                                                                                          |
| `validateConnection(source, target, options?)`                         | 先做结构检查（同一端口自连、节点或端口缺失、必须 output → input、重复边），再依次运行校验器，返回第一个失败结果；校验器收到的 `ConnectionContext.kind` 是将要创建的边的 kind（源端口 kind） |
| `validateGraph()` / `listDiagnostics()`                                | 结构诊断 + 全部 provider 的诊断                                                                                                                                                             |
| `repairGraph()`                                                        | 机械修复（删除非法边、清理分组中不存在的节点）并记录历史                                                                                                                                    |

`register*` 与 `add*` 都返回注销函数。Store 只阻止协议结构错误；语义 provider 产生的 `error` 只出现在诊断结果中，不会阻止加载语义有误的图。

### 插件生命周期

```ts
import type { GraphPlugin } from '@node-engine-sdk/core/protocol'
import type { GraphStore } from '@node-engine-sdk/core/store'

declare const store: GraphStore

const plugin: GraphPlugin = {
  name: 'my-app:rules',
  contributes: {
    nodeDefinitions: [],
    edgeDefinitions: [],
    commands: [],
    diagnostics: [],
  },
  setup(context) {
    return context.addConnectionValidator(({ sourceNode, targetNode }) =>
      sourceNode?.type === targetNode?.type
        ? { valid: false, code: 'SAME_TYPE', reason: 'Nodes of one type cannot be connected.' }
        : { valid: true },
    )
  },
}

const dispose = store.use(plugin)
dispose()
```

- 插件名在同一个 Store 中唯一，重复注册立即抛错；`store.hasPlugin(name)` 查询某个名字是否已注册。
- 贡献只能写在 `contributes` 中；`setup(context)` 可以返回清理函数。
- `setup` 失败时，本次已注册的贡献全部回滚。
- `use()` 返回的 dispose 幂等，只清理该实例自身注册的内容。`store.dispose()` 释放全部插件与订阅。

### 事件

`subscribe` 收到的 `GraphStoreEvent`：

| `type`                                              | 时机                                                    |
| --------------------------------------------------- | ------------------------------------------------------- |
| `command:executed`                                  | 一条命令成功执行（含 `command` 元数据与 `diagnostics`） |
| `history:commit`                                    | 事务或 `applyGraph` 提交一条历史                        |
| `history:undo` / `history:redo`                     | 撤销 / 重做                                             |
| `graph:changed`                                     | 图发生变化（每次写入最后发出）                          |
| `plugin:registered`                                 | 插件注册完成                                            |
| `registry:*-registered` / `registry:*-unregistered` | 命令、节点定义、边定义、诊断 provider 的注册与注销      |

## `@node-engine-sdk/core/semantics`

- 流程插件：`createDataflowPlugin`、`createExecflowPlugin`、`createHybridFlowPlugin`，以及默认规则数组 `createDataflowConnectionRules`、`createExecflowConnectionRules`、`createHybridFlowConnectionRules`
- 规则：`createSameNodeRule`、`createDirectionRule`、`createKindRule`、`createDataTypeRule`、`createCapacityRule`、`createCycleRule`、`defineConnectionRule`
- 规则装配：`createConnectionRulesPlugin`、`createConnectionRulesValidator`、`createConnectionRulesDiagnosticProvider`
- 必填输入：`findRequiredInputIssues`、`validateRequiredInputPorts`、`createRequiredInputDiagnosticProvider`
- 环路：`wouldCreateCycle`、`hasCycleForKind`
- 端口与能力：`resolvePortSemantics`、`resolvePortSemanticsOptions`、`hasNodeCapability`、`isPortDataTypeCompatible`（端口 kind 由 protocol 的 `resolvePortKind` 解析，边 kind 直接读 `GraphEdge.kind`）
- 值类型：`createValueType`、`normalizeValueType`、`serializeValueType`、`formatTypeRef`、`inferValueTypeKind`、`isValueTypeCompatible`、`validateValueType`、`resolvePortValueType`、`resolvePortAcceptedValueTypes`
- 函数、子图、变量：`createFunctionDefinition`、`createFunctionReference`、`normalizeFunctionId`、`createSubgraphDefinition`、`createSubgraphReference`、`normalizeSubgraphId`、`validateFunctionSignature`、`validateSubgraphSignature`、`createVariableDefinition`、`createVariableReference`、`normalizeVariableName`、`normalizeVariableScope`
- 常量：`EXEC_IN_PORT_ID`、`EXEC_THEN_PORT_ID`、`EXEC_ERROR_PORT_ID`、`SUBGRAPH_CALL_NODE_TYPE`、`SUBGRAPH_INPUT_NODE_TYPE`、`SUBGRAPH_OUTPUT_NODE_TYPE`、`VARIABLE_SCOPE_RUN`、`VARIABLE_SCOPE_GRAPH`、`VARIABLE_SCOPE_NODE`
- 主要类型：`SemanticNodeDefinition`、`SemanticEdgeDefinition`、`NodeCapability`、`SemanticConnectionContext`、`ConnectionRule`、`ConnectionRuleDefinition`、`PortSemanticsOptions`、`DataflowPluginOptions`、`ExecflowPluginOptions`、`HybridFlowPluginOptions`、`ValueTypeRef`、`ValueTypeSchema`、`FunctionDefinition`、`SubgraphDefinition`、`VariableReference`

## `@node-engine-sdk/core/runtime`

- 类：`NodeEngineRuntime`
- 函数：`compileGraph`、`createSequentialScheduler`、`createConcurrentScheduler`、`createRuntimeVariableSnapshot`、`createRuntimeVariableApi`
- 主要类型：`NodeEngineRuntimeOptions`、`NodeEngineCompileOptions`、`NodeEngineRuntimeNodeDefinition`、`NodeEngineRuntimeNodeHandler`、`NodeEngineRuntimeNodeContext`、`NodeEngineRuntimeNodeResult`、`NodeEngineRuntimeFunctionDefinition`、`NodeEngineRuntimeSubgraphDefinition`、`NodeEngineRuntimeScheduler`、`NodeEngineRuntimeScheduledTask`、`NodeEngineRunResult`、`NodeEngineRuntimeEvent`、`NodeEngineRuntimeTraceEntry`、`NodeEngineRuntimeCallFrame`、`NodeEngineRuntimeNodeState`、`NodeEngineBreakpoint`、`NodeEngineRuntimeVariableApi`、`NodeEngineRuntimeVariableSnapshot`；并转出 `GraphDiagnostic`、`NodeEngineExecutionPlan`、`NodeEngineCompileResult`

## `@node-engine-sdk/core/layout`

- 函数：`layoutGraph`、`applyGraphLayout`、`createDagLayout`
- 类型：`GraphLayoutOptions`、`GraphLayoutDirection`、`GraphLayoutResult`、`GraphNodeLayoutPatch`、`GraphGroupLayoutPatch`、`GraphLayoutBounds`

## `@node-engine-sdk/core/debug`

| 函数                               | 返回                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `summarizeRunDebugState(run)`      | `NodeEngineDebugSummary`：状态、节点数、失败/暂停节点、累计耗时、trace 与帧数量 |
| `getCurrentDebugNode(run)`         | 正在运行或暂停的节点状态                                                        |
| `getFailedTraceEntries(run)`       | 失败的 trace 条目                                                               |
| `getTraceEntriesByKind(run, kind)` | 指定 `node` / `data` / `function` / `subgraph` 的 trace                         |
| `getActiveCallStack(run)`          | 状态为 `running` 的调用帧                                                       |
| `getFailedCallFrames(run)`         | 失败的调用帧                                                                    |
| `getTraceForFrame(run, frameId)`   | 某个调用帧内的 trace                                                            |

## `@node-engine-sdk/core/view`

- 控制器：`createEditorController`、`NODE_ENGINE_DEFAULT_DOM_COMPONENT`（适配层注册默认 DOM 节点的组件键，值为 `'node-engine.default'`）
- 默认 DOM 节点模型：`resolveDomNodeModel`、`resolveDomNodeLayout`、`resolveDomNodeSizeConstraints`、`resolveDomNodeDefinition`、`resolveDomNodeTitle`、`resolveDomNodeSubtitle`、`resolveDomNodeFields`、`resolveDomPortAnchorPoints`、`applyDomConnectionState`、`applyDomFieldDriveState`、`buildDomNodePortSignature`、`resolveDefaultConnectedPortValue`、`endpointMatches`
- 默认 DOM 节点交互：`createDomNodeControls`、`DOM_NODE_RESIZE_HANDLES` 以及字段渲染辅助（`resolveDomField*`、`resolveDomPort*`、`resolveDomNumberDraft`、`resolveDomTimeSegment`、`isDomSelectOpen`、`isDomFieldOptionSelected`、`normalizeDomFieldNumber`、`normalizeDomTimeSegment`、`parseDomTimeValue`、`sanitizeDomNumberDraft`、`sanitizeDomTimeSegment`、`measureDomFieldLabel`、`formatDomFieldValue`、`resolveDomNodeHeaderStyle`、`resolveDomFieldsStyle`）
- 布局与端口颜色：`DEFAULT_DOM_*`、`resolveDomNodePortTop`、`resolveDomNodePortsBottom`、`PORT_DATA_TYPE_COLOR_PALETTE`、`resolveDomNodePortColor`、`resolvePortSemanticColor(port, execColor)`（执行端口取传入的主题执行色）、`normalizePortDataType`、`hashString`
- 主题与外观：`resolveColorScheme(theme)`、`resolveNodeAccent(node, definition)`；默认节点的 `resolveDomNodeClass`（选中、拖动与执行状态类）、`resolveDomNodeAccentStyle`（`--ne-node-accent`）、`resolveDomNodeStatusClass`（状态角标），以及端口的 `resolveDomPortDotStyle`（`--ne-port-color`）、`resolveDomPortDotClass`、`resolveDomFieldPortDotClass`、`resolveDomPortLabelClass`
- 类型：`NodeEngineEditorOptions`、`NodeEngineEditorController`、`NodeEngineEditorHost`、`NodeEngineViewSnapshot`、`NodeEngineApi`、`NodeEngineEventMap` 及全部事件 payload、`NodeEngineEventListener`（`onEvent`）与 `NodeEngineEventSink`（发出端）、渲染扩展类型、DOM 节点类型等，见 [controller-api.md](./controller-api.md)

上述 DOM 模型与交互辅助函数是两个适配层渲染默认 DOM 节点所用的同一套实现，编写新的 UI 适配层时直接复用即可；普通应用通常不需要直接调用它们。
