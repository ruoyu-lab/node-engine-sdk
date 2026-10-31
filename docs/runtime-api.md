# Runtime API（`@node-wright/core/runtime`）

`@node-wright/core/runtime` 是可选的 headless 运行层：把 `GraphSnapshot` 编译为执行计划，再按数据依赖与执行边运行节点。它不依赖 DOM、UI 框架或 presets，可在浏览器、Node.js 与 Worker 中运行；只依赖 `protocol` 与 `semantics`。编辑器从不创建 Runtime，是否、何时执行由应用决定。

## 快速示例

```ts
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime, createConcurrentScheduler } from '@node-wright/core/runtime'
import {
  EXEC_EVENT_NODE_TYPE,
  EXEC_IN_PORT_ID,
  EXEC_LOG_NODE_TYPE,
  EXEC_THEN_PORT_ID,
  execflowNodeDefinitions,
  execflowRuntimeDefinitions,
} from '@node-wright/presets/nodes/execflow'

const graph: GraphSnapshot = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [
    { id: 'start', type: EXEC_EVENT_NODE_TYPE, x: 0, y: 0 },
    { id: 'log', type: EXEC_LOG_NODE_TYPE, x: 300, y: 0 },
  ],
  edges: [
    {
      id: 'start-to-log',
      kind: 'exec',
      source: { nodeId: 'start', portId: EXEC_THEN_PORT_ID },
      target: { nodeId: 'log', portId: EXEC_IN_PORT_ID },
    },
  ],
  groups: [],
  meta: {},
}

const runtime = new NodeWrightRuntime({
  graph,
  definitions: execflowNodeDefinitions,
  runtimeDefinitions: execflowRuntimeDefinitions,
  scheduler: createConcurrentScheduler({ maxConcurrency: 4, timeoutMs: 30_000, retries: 1 }),
  onEvent(event) {
    console.log(event.type, event.node?.id, event.run.status)
  },
})

// 执行流图有 event 节点，可以省略入口 id。
const compiled = runtime.compile()

if (!compiled.plan) {
  throw new Error(compiled.diagnostics[0]?.message ?? 'Graph cannot run.')
}

const result = await runtime.run(compiled.plan)
console.log(result.status, result.trace.length)
```

## Runtime 选项

| 选项                  | 说明                                                                         |
| --------------------- | ---------------------------------------------------------------------------- |
| `graph`               | `GraphSnapshot`，或返回快照的函数（`runtime.compile()` 未传图时使用）        |
| `definitions`         | `SemanticNodeDefinition[]`：解析端口、能力、缓存与重试资格                   |
| `getNodeDefinition`   | 可选解析器，适合定义由外部注册中心管理的场景                                 |
| `runtimeDefinitions`  | `NodeWrightRuntimeNodeDefinition[]`：按节点 `type` 绑定 handler              |
| `handlers`            | 直接的 handler map（key 为节点 type），同 type 时优先于 `runtimeDefinitions` |
| `functionDefinitions` | `NodeWrightRuntimeFunctionDefinition[]`：函数签名（来自 semantics）+ handler |
| `functionHandlers`    | 直接的函数 handler map（key 为函数 id），优先于定义中的 handler              |
| `subgraphDefinitions` | 子图定义（`SubgraphDefinition`）                                             |
| `scheduler`           | 调度器，默认 `createSequentialScheduler()`                                   |
| `debug`               | `captureInputs`、`captureOutputs`、`captureCallStack`，默认全部采集          |
| `initialVariables`    | 单次运行的变量初始值：`run`、`graph`、`nodes`、`scopes`                      |
| `maxSteps`            | 单次运行最大执行步数，默认 `1000`                                            |
| `maxLoopIterations`   | 单节点最大访问次数，默认 `100`                                               |
| `summarizeValue`      | trace 中输入/输出摘要的生成函数                                              |
| `onEvent`             | 运行事件监听器                                                               |

`NodeWrightRuntimeNodeDefinition`：

| 字段         | 说明                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `type`       | 节点类型                                                                  |
| `handler`    | `NodeWrightRuntimeNodeHandler`                                            |
| `cacheable`  | 是否在同一次 run 内缓存已完成的数据求值结果；未声明时只有 `pure` 节点缓存 |
| `idempotent` | 声明为 `true` 的非 pure 节点才允许被调度器重试                            |

## 编译执行计划

Runtime 只执行 `NodeWrightExecutionPlan`。计划由 `runtime.compile(entryNodeId?, graph?)` 或独立的 `compileGraph(options)` 生成：

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { compileGraph, type NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'
import type { SemanticNodeDefinition } from '@node-wright/core/semantics'

export function check(
  graph: GraphSnapshot,
  definitions: SemanticNodeDefinition[],
  runtimeDefinitions: NodeWrightRuntimeNodeDefinition[],
) {
  const compiled = compileGraph({ graph, entryNodeId: 'start', definitions, runtimeDefinitions })

  return compiled.valid ? compiled.plan : compiled.diagnostics
}
```

- 入口：显式传入 `entryNodeId` 时按节点 id 查找，找不到即失败；未传时选择第一个带 `event` 能力的节点。纯数据流图没有事件节点时，传入终点节点 id，Runtime 会向上游求值它的数据依赖。
- 诊断：合并外部 `diagnostics`、协议结构诊断、`functionDefinitions` / `subgraphDefinitions` 的签名诊断（[签名校验](./semantics-api.md#签名校验)，路径如 `functionDefinitions.1.outputs.0.id`），以及 runtime 自己的诊断：

| code                         | 含义                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `RUNTIME_ENTRY_NODE_MISSING` | 入口节点不存在或没有 `event` 节点                             |
| `RUNTIME_HANDLER_MISSING`    | 节点没有 handler（`subgraph:input` / `subgraph:output` 除外） |
| `RUNTIME_DATA_CYCLE`         | 数据依赖存在环                                                |

任何 `error` 都会阻止生成计划；`warning` 不阻止执行。语义诊断不由 runtime 产生，需要时由应用通过 Store 或 semantics 获取并通过 `diagnostics` 并入。

- `plan.nodeOrder` 是按执行边与数据依赖展开的静态顺序，用于调试、预览与静态分析；真实运行仍在执行时处理分支、函数与子图调用。
- 编译使用迭代式 O(V + E) 遍历，深图不会耗尽调用栈。

## 运行

| 方法                                                | 说明                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `run(plan, input?)`                                 | 执行计划，返回 `Promise<NodeWrightRunResult>`；`input` 交给入口节点 |
| `cancel(runId)`                                     | 取消运行                                                            |
| `pause(runId)` / `resume(runId)`                    | 暂停 / 继续                                                         |
| `step(runId)` / `stepInto` / `stepOver` / `stepOut` | 单步控制，见 [runtime-debugging.md](./runtime-debugging.md)         |
| `setBreakpoint(target)` / `clearBreakpoint(id)`     | 断点                                                                |
| `getRun(runId)`                                     | 正在进行的运行的公共快照                                            |

`NodeWrightRunResult`：`runId`、`status`（`success` / `error` / `cancelled` 等）、`trace`、`callFrames`、`nodeStates`、`variables`、`listenerErrors`、`error?`。

### 数据求值与缓存

- 显式连接的数据依赖只要存在 handler 就会执行，包括 `effect` / `async` 节点；不会用默认值静默跳过用户建立的依赖。
- 缓存属于单次 `run()`，key 是节点而不是输出端口：同一节点的多个输出和并发消费者共享一个求值 Promise；run 结束后缓存立即释放，后续 run 不复用旧值。
- `cacheable` 未声明时只有 `pure` 节点保留已完成结果；非 pure 节点只合并同一时刻的重复求值。失败的 Promise 会立即移除。
- 数据求值带 visiting guard：即使绕过编译传入伪造计划，数据环也会被识别而不是死锁或无限递归。
- 上游显式返回 `undefined` 或 `null` 时原样传给下游；上游根本没有返回所连接的输出属性时直接报错，而不是伪装成 `undefined`。执行计划中的节点缺少 handler 时同样直接失败。

## Handler

```ts
import type { NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'

export const formatTicket: NodeWrightRuntimeNodeDefinition = {
  type: 'ticket:format',
  handler({ values, params }) {
    return {
      values: {
        message: `[${String(params.priority ?? 'normal')}] ${String(values.title ?? '')}`,
      },
    }
  },
}
```

`NodeWrightRuntimeNodeContext`：

| 字段                                                  | 说明                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `node`、`definition`、`graph`                         | 当前节点、语义定义、单次运行持有的不可变图快照                                                             |
| `input`                                               | 入口 `run(plan, input)` 的 input，或上游执行节点返回的 `data`                                              |
| `values`                                              | 所有 data 输入端口的取值                                                                                   |
| `params`                                              | 参数的运行时视图：本地 `node.data.params` / `dataPath`，再被参数输入端口的连线值覆盖；handler 应优先读取它 |
| `variables`、`variable`、`getVariable`、`setVariable` | 变量快照与读写 API                                                                                         |
| `callFunction(reference, values?)`                    | 调用已注册函数                                                                                             |
| `callSubgraph(reference, values?)`                    | 调用已注册子图                                                                                             |
| `callStack`                                           | 当前分支的调用栈快照                                                                                       |
| `runId`、`signal`                                     | 运行 id 与当前调度 attempt 的 `AbortSignal`                                                                |

`signal` 在 run 取消或调度超时时 abort，异步 handler 应把它传给 `fetch`、定时器等可取消操作。handler 即使忽略 signal 正常返回，runtime 也会在提交成功状态前再次检查取消。

`NodeWrightRuntimeNodeResult`：

| 字段      | 说明                                   |
| --------- | -------------------------------------- |
| `output`  | 跟随一个执行输出端口                   |
| `outputs` | 按顺序跟随多个执行输出端口             |
| `values`  | 数据输出值，key 为输出端口 id          |
| `data`    | 传给下游执行节点的载荷（下游 `input`） |

## 变量

变量是作用域化的运行状态，不属于图模型，也不会写回图快照。

```ts
import type { NodeWrightRuntimeNodeHandler } from '@node-wright/core/runtime'

export const countHandler: NodeWrightRuntimeNodeHandler = ({
  getVariable,
  setVariable,
  variable,
}) => {
  const count = Number(getVariable('count') ?? 0) + 1

  setVariable('count', count)
  setVariable({ scope: 'graph', name: 'channel' }, 'beta')
  variable.set({ scope: 'node', name: 'visits' }, count)

  return { output: 'exec:then' }
}
```

| 作用域   | 说明                                                    |
| -------- | ------------------------------------------------------- |
| `run`    | 默认作用域，单次运行共享                                |
| `graph`  | 图级变量，适合运行参数或环境值                          |
| `node`   | 节点局部变量（需要 `nodeId`，handler 中默认为当前节点） |
| 自定义名 | 保存在 `scopes[name]` 中                                |

`initialVariables` 设置初始值，`result.variables` 是运行结束时的快照。`createRuntimeVariableSnapshot(initial?)` 与 `createRuntimeVariableApi(snapshot, options?)` 可以在 Runtime 之外复用同一套变量模型。

## 函数

函数签名来自 semantics，handler 注册在 runtime：

```ts
import type { NodeWrightRuntimeFunctionDefinition } from '@node-wright/core/runtime'

export const formatMessage: NodeWrightRuntimeFunctionDefinition = {
  id: 'format-message',
  mode: 'pure',
  inputs: [{ id: 'payload', dataType: 'string' }],
  outputs: [{ id: 'message', dataType: 'string' }],
  handler: ({ values }) => ({ values: { message: `payload: ${String(values.payload ?? '')}` } }),
}
```

函数 handler 的上下文包含 `functionDefinition`、`graph`、`values`、变量 API、`callFunction`、`callSubgraph`、`callStack`、`runId`、`signal`，可以继续调用其他函数。`mode: 'subgraph'` 且没有 handler 的函数会委托给子图：子图 id 取 `meta.subgraphId`，未给出时使用函数 id。默认调用节点 `function:call` 来自 `@node-wright/presets/nodes/function`，见 [node-systems.md](./node-systems.md#nodesfunction)。

## 子图

通过 `subgraphDefinitions` 注册子图，`callSubgraph(id, values)` 或默认的 `subgraph:call` 节点调用它。子图内部用 `subgraph:input` 暴露调用方输入、用 `subgraph:output` 收集返回值，这两个边界节点不需要 handler。完整流程见 [subgraph-guide.md](./subgraph-guide.md)。

## 调度器

调度器决定数据输入求值与执行分支的执行策略，不改变图：

```ts
import { createConcurrentScheduler, createSequentialScheduler } from '@node-wright/core/runtime'

export const sequential = createSequentialScheduler()
export const concurrent = createConcurrentScheduler({
  maxConcurrency: 8,
  timeoutMs: 60_000,
  retries: 2,
})
```

- 调度 phase 只有真实使用的 `data` 与 `exec` 两种。
- 每个任务接收 `{ attempt, signal }`；超时先 abort 当前 attempt 的 signal，再以错误结束该 attempt。
- `retries` 不是无条件重试：`pure` 节点默认可重试，副作用节点默认只执行一次；只有在 `NodeWrightRuntimeNodeDefinition` 上声明 `idempotent: true` 的非 pure 节点才允许重试。
- 并发分支各自持有调用栈快照，一个分支的帧不会进入另一个分支的 handler 上下文。
- 自定义调度器实现 `NodeWrightRuntimeScheduler.schedule(context, tasks)`，`context` 带 `runId`、`graph`、`signal`、`phase`、`node`，任务带 `id`、`label`、`retryable` 与 `run(attempt)`。

## 运行事件与取消

`onEvent` 收到的 `NodeWrightRuntimeEvent` 是与内部状态隔离并深度冻结的快照：

- 运行：`run:start`、`run:pause`、`run:resume`、`run:step`、`run:cancel`、`run:success`、`run:error`
- 节点：`node:start`、`node:success`、`node:cancel`、`node:error`
- 函数与子图：`function:start` / `success` / `error`、`subgraph:start` / `success` / `error`

事件带 `run`（当前运行状态）以及可选的 `node`、`functionDefinition`、`subgraphDefinition`、`frame`、`trace`。监听器修改快照会失败；监听器抛错不会改变运行状态或跳过内部清理，错误记录在 `result.listenerErrors`。

主动取消时只发布一次 `run:cancel`；正在执行的节点发布 `node:cancel`，不会同时发布 `node:success`。

## 边界

- Runtime 不感知 DOM、视口、选区或 presets；运行结果如何展示在画布上由应用决定（例如把 `result.nodeStates[nodeId]` 接到 `resolvePortValue` 或写回参数）。
- 业务节点的 handler 与副作用策略由应用显式注册；presets 只提供原语节点的 Runtime definitions，不创建 Runtime 实例。
- 调试数据（trace、callFrames、断点、单步）见 [runtime-debugging.md](./runtime-debugging.md)。
