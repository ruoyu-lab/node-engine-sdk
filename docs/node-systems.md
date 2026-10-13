# 原语节点系统（`@node-engine-sdk/presets/nodes/*`）

`@node-engine-sdk/presets` 自带 4 个节点系统共 15 个原语节点。每个节点系统只提供协议定义（`SemanticNodeDefinition`）、插件工厂和 runtime handler，不依赖任何 UI 框架，也不依赖 preset 组装代码；DOM 渲染配置（`*NodeTypes`）在 `@node-engine-sdk/presets` 根入口中。

业务领域节点（HTTP、AI、文件、数据库、脚本等）不在 SDK 内提供，开发方式见 [node-definition-guide.md](./node-definition-guide.md)。

所有可编辑的值都声明为节点定义的 `parameters`：默认 DOM 节点与内联节点编辑器据此生成字段，`api.nodes.create` / `add` 写入参数的 `defaultValue`，handler 通过 `context.params` 读取。带 `input` 的参数同时是一个可连线的输入端口（下表“参数”列标注端口 id）：端口未连接时 `params[key]` 取节点本地值（`data.params[key]`，其次 `data[key]`），连接后取上游值，编辑器中对应字段显示上游值并禁用本地编辑。参数端口由协议从参数推导，节点实例的 `ports` 不应再声明同 id 端口（否则报 `NODE_PARAMETER_PORT_ID_CONFLICT`）。

## nodes/dataflow

```ts
import {
  DATA_MERGE_NODE_TYPE,
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  createDataflowNodesPlugin,
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
  dataflowRuntimeHandlers,
  type DataflowNodesOptions,
} from '@node-engine-sdk/presets/nodes/dataflow'
```

| 类型             | 端口                                 | 参数                                                                                | 能力     | handler 行为                                        |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `data:source`    | 输出 `value`（`any`，多连接）        | `value`（`json`，默认 `''`）                                                        | `pure`   | 输出 `params.value`                                 |
| `data:transform` | 输入 `input`（必填）；输出 `output`  | `operation`（`select`：`pass`、`string`、`number`、`boolean`、`json`，默认 `pass`） | `pure`   | 按 `operation` 转换输入；`json` 为 `JSON.stringify` |
| `data:merge`     | 输入 `a`（必填）、`b`；输出 `output` | -                                                                                   | `pure`   | 只有 `a` 时输出 `a`，否则输出 `[a, b]`              |
| `data:preview`   | 输入 `value`（必填）                 | -                                                                                   | `effect` | 把输入作为 `data` 返回，用于检查                    |

`createDataflowNodesPlugin({ includeSource?, includeTransform?, includeMerge?, includePreview? })` 返回只贡献节点定义的 `GraphPlugin`（插件名 `@node-engine-sdk/presets/nodes/dataflow`）。

## nodes/execflow

```ts
import {
  EXEC_BRANCH_NODE_TYPE,
  EXEC_DELAY_NODE_TYPE,
  EXEC_ERROR_PORT_ID,
  EXEC_EVENT_NODE_TYPE,
  EXEC_GET_VARIABLE_NODE_TYPE,
  EXEC_IN_PORT_ID,
  EXEC_LOG_NODE_TYPE,
  EXEC_SEQUENCE_NODE_TYPE,
  EXEC_SET_VARIABLE_NODE_TYPE,
  EXEC_THEN_PORT_ID,
  createExecflowNodesPlugin,
  execflowNodeDefinitions,
  execflowRuntimeDefinitions,
  execflowRuntimeHandlers,
  type ExecflowNodesOptions,
} from '@node-engine-sdk/presets/nodes/execflow'
```

执行端口约定：输入 `exec:in`（`EXEC_IN_PORT_ID`），输出 `exec:then`（`EXEC_THEN_PORT_ID`）；`EXEC_ERROR_PORT_ID`（`exec:error`）为保留的错误输出 id。执行端口的 `kind` 为 `'exec'`，输入容量为 1。

| 类型                | 端口                                                                     | 参数（参数端口 id）                                                                                                                      | 能力              | handler 行为                                                              |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `exec:event`        | 输出 `exec:then`（多连接）                                               | -                                                                                                                                        | `event`           | 执行入口，跟随 `exec:then`                                                |
| `exec:sequence`     | `exec:in`；输出 `then:0`、`then:1`                                       | -                                                                                                                                        | `effect`          | 按顺序跟随全部执行输出（节点实例可以用 `ports` 增加输出）                 |
| `exec:branch`       | `exec:in`、数据输入 `condition`（`boolean`，必填）；输出 `true`、`false` | -                                                                                                                                        | `effect`          | `condition === false` 时走 `false`，否则走 `true`                         |
| `exec:delay`        | `exec:in`；`exec:then`                                                   | `durationMs`（`number`，默认 `100`；端口 `durationMs`，`number`）                                                                        | `async`、`effect` | 等待 `params.durationMs` 毫秒（非有限数按 0），可被取消                   |
| `exec:log`          | `exec:in`；`exec:then`                                                   | `message`（`string`，默认 `''`；端口 `message`，`any`）                                                                                  | `effect`          | 把 `params.message` 作为 `data` 写入执行轨迹                              |
| `exec:set-variable` | `exec:in`、数据输入 `value`；`exec:then`                                 | `scope`（`select`：`run`/`graph`/`node`，默认 `run`；端口 `scope`，`string`）、`name`（`string`，默认 `'value'`；端口 `name`，`string`） | `effect`          | 把 `value` 写入 `params.scope` 下的 `params.name`；名称为空时用 `'value'` |
| `exec:get-variable` | 数据输出 `value`                                                         | 同 `exec:set-variable` 的 `scope`、`name`                                                                                                | `pure`            | 读取变量；Runtime definition 声明 `cacheable: false`，避免读到旧值        |

`createExecflowNodesPlugin({ includeEvent?, includeSequence?, includeBranch?, includeDelay?, includeLog?, includeVariables? })` 按需选择节点。

## nodes/function

```ts
import {
  FUNCTION_CALL_NODE_TYPE,
  createFunctionCallPorts,
  createFunctionNodesPlugin,
  functionCallNodeDefinitions,
  functionCallRuntimeDefinitions,
  functionCallRuntimeHandler,
  type FunctionCallPortOptions,
  type FunctionNodesOptions,
} from '@node-engine-sdk/presets/nodes/function'
```

`function:call` 调用一个在 Runtime 中注册的函数：

- 函数 id 只来自参数 `functionId`（`string`，默认 `''`，在默认 DOM 节点中显示为“函数”字段）：handler 读取 `context.params.functionId`，即按[参数读取约定](#参数读取约定)解析出的本地值（`data.params.functionId`）。该参数没有参数端口：节点端口按所调用函数的签名生成，函数 id 因此固定在节点上，不能由连线改变。`data.params.id`、`data.id` 与名为 `functionId` 的数据输入都不会被当作函数 id。
- 函数 id 去掉首尾空白后为空或不是字符串时，节点执行失败，错误为 `Function call node "<节点 id>" requires a non-empty "functionId" parameter.`；id 没有注册时报 `Function "<id>" does not have a runtime handler.`。
- 全部数据输入（按签名生成的端口，包括 id 恰好为 `functionId` 的输入）原样作为函数参数，函数返回的 `values` 暴露到同名输出端口，`data` 透传；随后跟随 `exec:then`。
- 定义本身没有端口；用 `createFunctionCallPorts(functionDefinition, { includeExecPorts? })` 按函数签名生成实例端口（输入为数据输入端口，输出为多连接数据输出端口），写入 `GraphNode.ports`。签名未设置的可选字段（`required`、`dataType`、`meta` 等）不会出现在生成的端口上，因此使用这些端口的图可以直接通过严格的 `parseGraph`。签名中输入与输出 id 重复或使用保留的执行端口 id 时，它抛出列出全部签名诊断的错误，而不会生成重复端口（见 [semantics-api.md](./semantics-api.md#签名校验)）。该函数也从 `@node-engine-sdk/presets` 根入口导出。
- Runtime definition 为 `cacheable: false`：同一次运行中，调用节点的输出每被一个下游输入读取一次，函数就调用一次。

```ts
import type { GraphNode } from '@node-engine-sdk/core/protocol'
import type { FunctionDefinition } from '@node-engine-sdk/core/semantics'
import {
  FUNCTION_CALL_NODE_TYPE,
  createFunctionCallPorts,
} from '@node-engine-sdk/presets/nodes/function'

const formatMessage: FunctionDefinition = {
  id: 'format-message',
  inputs: [{ id: 'payload', dataType: 'string' }],
  outputs: [{ id: 'message', dataType: 'string' }],
}

export const callNode: GraphNode = {
  id: 'call-format',
  type: FUNCTION_CALL_NODE_TYPE,
  x: 320,
  y: 120,
  ports: createFunctionCallPorts(formatMessage, { includeExecPorts: true }),
  data: { params: { functionId: formatMessage.id } },
}
```

## nodes/subgraph

```ts
import {
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createSubgraphCallPorts,
  createSubgraphInputPorts,
  createSubgraphNodesPlugin,
  createSubgraphOutputPorts,
  subgraphCallRuntimeHandler,
  subgraphNodeDefinitions,
  subgraphRuntimeDefinitions,
  type SubgraphNodesOptions,
} from '@node-engine-sdk/presets/nodes/subgraph'
```

| 类型              | 说明                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subgraph:call`   | 调用 Runtime 中注册的子图；子图 id 只来自参数 `subgraphId`（`string`，默认 `''`，显示为“子图”字段，没有参数端口），为空或不是字符串时报 `Subgraph call node "<节点 id>" requires a non-empty "subgraphId" parameter.`。全部数据输入原样传给子图，子图输出暴露到同名输出端口 |
| `subgraph:input`  | 子图内部的输入边界：把调用方传入的值作为数据输出暴露给子图内部                                                                                                                                                                                                              |
| `subgraph:output` | 子图内部的输出边界：收集数据输入并返回给调用方                                                                                                                                                                                                                              |

- 三个定义都没有固定端口：`createSubgraphCallPorts(definition)` 生成调用节点端口（输入 + 输出），`createSubgraphInputPorts(definition)` 生成输入边界的输出端口，`createSubgraphOutputPorts(definition)` 生成输出边界的输入端口。边界端口的 `valueType` 会序列化到 `port.data.type`，签名未设置的可选字段不会出现在端口上。三个函数都先校验签名，输入与输出 id 冲突时抛错（见 [semantics-api.md](./semantics-api.md#签名校验)），也都从 `@node-engine-sdk/presets` 根入口导出。
- 只有 `subgraph:call` 有 Runtime definition（`cacheable: false`，与 `function:call` 一样，输出每被一个下游输入读取一次就调用一次子图）；两个边界节点由 Runtime 内部处理，不需要 handler。
- `createSubgraphNodesPlugin({ includeCall?, includeBoundary? })` 按需选择节点。

完整流程见 [subgraph-guide.md](./subgraph-guide.md)。

## 参数读取约定

原语节点的可编辑值都读自 handler 的 `context.params`：本地值按 `data.params[key]` → `data[key]` 读取，参数端口已连接时取上游值。默认 DOM 节点与内联编辑器为每个声明的参数生成字段——`data:source`、`data:transform`、`exec:delay`、`exec:log`、`exec:set-variable`、`exec:get-variable`、`function:call`、`subgraph:call` 都有字段；`@node-engine-sdk/presets` 的 `*NodeTypes` 只为这些参数补充显示 hint（例如 `exec:delay` 的 `min`/`step`），不再重复标签与选项。`function:call` / `subgraph:call` 的调用目标同样只读 `context.params.functionId` / `context.params.subgraphId`，这两个参数没有参数端口，只取本地值。

## 业务节点包

业务节点形成稳定集合后，可以在业务方自己的命名空间下发布独立包（例如 `@my-org/nodes-ticket`），推荐导出：

```ts
import type { GraphPlugin } from '@node-engine-sdk/core/protocol'
import type { NodeEngineRuntimeNodeDefinition } from '@node-engine-sdk/core/runtime'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'

export const ticketNodeDefinitions: SemanticNodeDefinition[] = []
export const ticketRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[] = []

export function createTicketNodesPlugin(): GraphPlugin {
  return {
    name: '@my-org/nodes-ticket',
    contributes: { nodeDefinitions: ticketNodeDefinitions },
  }
}
```

- 节点系统依赖 `@node-engine-sdk/core` 的 `protocol`（定义与插件类型）、`semantics`（能力与常量）、`runtime`（handler 类型）。
- 不要在节点系统中依赖任何 UI 框架或适配层；DOM 渲染配置（`NodeTypeRegistry`）只依赖 `@node-engine-sdk/core/view` 的类型，可以与节点定义放在同一个包中，也可以单独做成 preset 包。
