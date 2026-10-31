# Runtime 调试

`@node-wright/core/runtime` 提供 headless 调试模型：运行轨迹、调用帧、节点状态、断点与单步控制都以数据形式暴露；`@node-wright/core/debug` 提供对运行结果的汇总与查询。调试 UI 由应用实现，不进入 core。

## 采集配置

```ts
import { NodeWrightRuntime } from '@node-wright/core/runtime'
import {
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from '@node-wright/presets/nodes/dataflow'

export const runtime = new NodeWrightRuntime({
  definitions: dataflowNodeDefinitions,
  runtimeDefinitions: dataflowRuntimeDefinitions,
  debug: {
    captureInputs: true,
    captureOutputs: true,
    captureCallStack: true,
  },
  summarizeValue: (value) => (Array.isArray(value) ? value.slice(0, 10) : value),
})
```

三项采集默认都开启；数据量敏感时可以关闭其中一部分。`summarizeValue` 控制 trace 中 `inputSummary` / `outputSummary` 的内容。

## 运行结果

```ts
const compiled = runtime.compile('preview', graph)

if (compiled.plan) {
  const result = await runtime.run(compiled.plan)

  result.status // 'success' | 'error' | 'cancelled' ...
  result.trace // 运行轨迹
  result.callFrames // 调用帧
  result.nodeStates // 每个节点最后一次状态
  result.variables // 运行结束时的变量快照
  result.listenerErrors // 事件监听器抛出的错误
}
```

| 字段             | 说明                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trace`          | `NodeWrightRuntimeTraceEntry[]`：`kind`（`node` / `data` / `function` / `subgraph`）、`type`、`status`、起止时间与耗时、输入/输出值与摘要、`frameId`、`depth`、`callStack`、`error` |
| `callFrames`     | `NodeWrightRuntimeCallFrame[]`：`kind`、`name`、`parentId`、`depth`、`nodeId` / `functionId` / `subgraphId`、`status`、耗时                                                         |
| `nodeStates`     | `Record<nodeId, NodeWrightRuntimeNodeState>`：`status`、`inputValues`、`outputValues`、`values`、`error`、`frameId`、`callStack`                                                    |
| `variables`      | `run`、`graph`、`nodes`、`scopes` 四类变量                                                                                                                                          |
| `listenerErrors` | 监听器错误；不改变运行结果                                                                                                                                                          |

节点状态 `status` 为 `idle`、`running`、`paused`、`success`、`error`、`cancelled` 之一，可直接用于在画布上高亮节点。

## 事件流

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime, type NodeWrightRuntimeEvent } from '@node-wright/core/runtime'
import {
  dataflowNodeDefinitions,
  dataflowRuntimeDefinitions,
} from '@node-wright/presets/nodes/dataflow'

declare const graph: GraphSnapshot

export const events: NodeWrightRuntimeEvent[] = []

export const recordingRuntime = new NodeWrightRuntime({
  graph,
  definitions: dataflowNodeDefinitions,
  runtimeDefinitions: dataflowRuntimeDefinitions,
  onEvent(event) {
    events.push(event)
  },
})
```

事件类型见 [runtime-api.md](./runtime-api.md#运行事件与取消)。每个事件带当前 `run` 快照以及可选的 `node`、`functionDefinition`、`subgraphDefinition`、`frame`、`trace`，调试 UI 不需要访问 Runtime 内部状态。事件是深度冻结的快照。

## 断点

```ts
runtime.setBreakpoint({ nodeId: 'send-message' })
runtime.setBreakpoint({ functionId: 'format-message' })
runtime.setBreakpoint({ subgraphId: 'wrap-message' })
runtime.setBreakpoint({
  id: 'conditional',
  nodeId: 'send-message',
  enabled: true,
  condition: ({ run }) => run.variables.run.enabled !== false,
})

runtime.clearBreakpoint('send-message')
```

断点 id 取 `id`，未给出时依次取 `nodeId`、`functionId`、`subgraphId`；四者都没有时抛错。`condition` 可以是异步函数，参数带 `run`、`node`、`functionDefinition`、`subgraphDefinition`、`frame`。命中断点时运行进入 `paused` 并发布 `run:pause`。

## 单步与控制

| 方法              | 说明                                        |
| ----------------- | ------------------------------------------- |
| `pause(runId)`    | 在下一个可观察节点暂停                      |
| `resume(runId)`   | 继续运行，清除单步模式                      |
| `stepInto(runId)` | 运行到下一个可观察节点后暂停（`step` 同义） |
| `stepOver(runId)` | 跳过当前深度以下的函数或子图调用            |
| `stepOut(runId)`  | 调用栈回到外层后暂停                        |
| `cancel(runId)`   | 取消运行（发布一次 `run:cancel`）           |

`runId` 可以从 `run:start` 事件的 `event.run.runId` 获取；`getRun(runId)` 返回进行中运行的公共快照。

## `@node-wright/core/debug`

```ts
import {
  getActiveCallStack,
  getCurrentDebugNode,
  getFailedCallFrames,
  getFailedTraceEntries,
  getTraceEntriesByKind,
  getTraceForFrame,
  summarizeRunDebugState,
} from '@node-wright/core/debug'
import type { NodeWrightRunResult } from '@node-wright/core/runtime'

export function describe(result: NodeWrightRunResult) {
  return {
    summary: summarizeRunDebugState(result),
    current: getCurrentDebugNode(result),
    failures: getFailedTraceEntries(result),
    dataTraces: getTraceEntriesByKind(result, 'data'),
    activeStack: getActiveCallStack(result),
    failedFrames: getFailedCallFrames(result),
    firstFrameTrace: result.callFrames[0] ? getTraceForFrame(result, result.callFrames[0].id) : [],
  }
}
```

`summarizeRunDebugState` 返回 `status`、`totalNodes`、`failedNodes`、`pausedNodes`、`durationMs`（trace 耗时之和）、`totalTraceEntries`、`totalCallFrames`。这些函数只做查询，不修改结果，也不持有 UI。

## 调试面板建议

- 运行状态：`result.status`、耗时、`result.error`。
- 调用栈：`result.callFrames` 或 `getActiveCallStack`。
- 时间线：`result.trace`。
- 节点状态：`result.nodeStates[nodeId]`，可映射为画布高亮。
- 变量：`result.variables`。
- 控制：`resume`、`stepInto`、`stepOver`、`stepOut`、`cancel`。
- 断点列表：由应用保存断点配置，再同步给 Runtime。
