# 子图指南

子图能力由四部分协作完成，图本身只是普通的 `GraphSnapshot`：

| 概念           | 归属                                  | 说明                                                                |
| -------------- | ------------------------------------- | ------------------------------------------------------------------- |
| 子图签名       | `@node-wright/core/semantics`         | `SubgraphDefinition`：id、内部图、输入输出边界端口                  |
| 调用与边界节点 | `@node-wright/presets/nodes/subgraph` | `subgraph:call`、`subgraph:input`、`subgraph:output` 与端口生成函数 |
| 子图求值       | `@node-wright/core/runtime`           | 注册子图、`callSubgraph`、求值输出边界的数据依赖                    |
| 编辑体验       | 应用                                  | 进入/返回子图、面包屑、签名编辑、端口同步                           |

## 完整示例

子图把输入的 `message` 转成 JSON 字符串，以 `json` 输出返回；父图用数据源调用它，再用预览节点接收结果。

```ts
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime } from '@node-wright/core/runtime'
import type { SubgraphDefinition } from '@node-wright/core/semantics'
import {
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  SUBGRAPH_CALL_NODE_TYPE,
  SUBGRAPH_INPUT_NODE_TYPE,
  SUBGRAPH_OUTPUT_NODE_TYPE,
  createHybridFlowPreset,
} from '@node-wright/presets'
import {
  createSubgraphCallPorts,
  createSubgraphInputPorts,
  createSubgraphOutputPorts,
} from '@node-wright/presets/nodes/subgraph'

const preset = createHybridFlowPreset()

const signature: SubgraphDefinition = {
  id: 'to-json',
  graph: emptyGraph(),
  inputs: [{ id: 'message', dataType: 'any' }],
  outputs: [{ id: 'json', dataType: 'string' }],
}

const inner: GraphSnapshot = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [
    {
      id: 'in',
      type: SUBGRAPH_INPUT_NODE_TYPE,
      x: 0,
      y: 0,
      ports: createSubgraphInputPorts(signature),
    },
    {
      id: 'json',
      type: DATA_TRANSFORM_NODE_TYPE,
      x: 300,
      y: 0,
      data: { params: { operation: 'json' } },
    },
    {
      id: 'out',
      type: SUBGRAPH_OUTPUT_NODE_TYPE,
      x: 600,
      y: 0,
      ports: createSubgraphOutputPorts(signature),
    },
  ],
  edges: [
    {
      id: 'in-to-json',
      kind: 'data',
      source: { nodeId: 'in', portId: 'message' },
      target: { nodeId: 'json', portId: 'input' },
    },
    {
      id: 'json-to-out',
      kind: 'data',
      source: { nodeId: 'json', portId: 'output' },
      target: { nodeId: 'out', portId: 'json' },
    },
  ],
  groups: [],
  meta: {},
}

export const toJson: SubgraphDefinition = { ...signature, graph: inner, outputNodeId: 'out' }

const parent: GraphSnapshot = {
  schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
  nodes: [
    {
      id: 'source',
      type: DATA_SOURCE_NODE_TYPE,
      x: 0,
      y: 0,
      data: { params: { value: { a: 1 } } },
    },
    {
      id: 'call',
      type: SUBGRAPH_CALL_NODE_TYPE,
      x: 300,
      y: 0,
      ports: createSubgraphCallPorts(toJson),
      data: { params: { subgraphId: toJson.id } },
    },
    { id: 'preview', type: DATA_PREVIEW_NODE_TYPE, x: 600, y: 0 },
  ],
  edges: [
    {
      id: 'source-to-call',
      kind: 'data',
      source: { nodeId: 'source', portId: 'value' },
      target: { nodeId: 'call', portId: 'message' },
    },
    {
      id: 'call-to-preview',
      kind: 'data',
      source: { nodeId: 'call', portId: 'json' },
      target: { nodeId: 'preview', portId: 'value' },
    },
  ],
  groups: [],
  meta: {},
}

export async function runParent() {
  const runtime = new NodeWrightRuntime({
    graph: parent,
    definitions: preset.nodeDefinitions,
    runtimeDefinitions: preset.runtimeDefinitions,
    subgraphDefinitions: [toJson],
  })
  const compiled = runtime.compile('preview')

  if (!compiled.plan) {
    throw new Error(compiled.diagnostics[0]?.message ?? 'Graph cannot run.')
  }

  const result = await runtime.run(compiled.plan)

  return result.nodeStates.preview?.inputValues?.value // '{"a":1}'
}

function emptyGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    groups: [],
    meta: {},
  }
}
```

要点：

- 调用节点与边界节点的定义没有固定端口，端口由签名生成并写在节点实例的 `ports` 上（调用节点同时带有输入与输出端口，因此签名中输入与输出的 id 不能重复；三个端口生成函数会先校验签名，冲突时抛出定位到具体条目的 `SUBGRAPH_SIGNATURE_PORT_ID_DUPLICATE` 诊断，`runtime.compile()` 也会报告注册子图的签名诊断，见 [semantics-api.md](./semantics-api.md#签名校验)）：`createSubgraphCallPorts` 生成调用节点的输入与输出，`createSubgraphInputPorts` 生成输入边界的输出端口，`createSubgraphOutputPorts` 生成输出边界的输入端口。签名未设置的可选字段不会出现在生成的端口上，生成结果可以直接通过严格的 `parseGraph`。签名变化后重新生成即可；三个函数也从 `@node-wright/presets` 根入口导出。
- 调用节点的子图 id 只来自参数 `subgraphId`（默认 DOM 节点显示为“子图”字段）：handler 读取 `context.params.subgraphId`，即本地值 `data.params.subgraphId`。该参数没有参数端口，调用节点的全部数据输入都原样传给子图；id 为空或不是字符串时运行失败，错误为 `Subgraph call node "<节点 id>" requires a non-empty "subgraphId" parameter.`。
- Runtime 找到输出边界节点（`outputNodeId`，未给出时为子图中第一个 `subgraph:output` 节点），按数据依赖求值它的输入；输入边界按端口 `name`（或 `id`）读取调用方传入的值。子图在独立的作用域中求值，拥有自己的数据缓存，调用帧与 trace 记为 `subgraph`。
- 子图求值只沿数据依赖进行；`inputNodeId`、`eventId` 字段目前只作为签名信息保存，Runtime 不使用它们。

## 函数委托给子图

```ts
import type { NodeWrightRuntimeFunctionDefinition } from '@node-wright/core/runtime'

export const formatMessage: NodeWrightRuntimeFunctionDefinition = {
  id: 'format-message',
  mode: 'subgraph',
  inputs: [{ id: 'message', dataType: 'any' }],
  outputs: [{ id: 'json', dataType: 'string' }],
  meta: { subgraphId: 'to-json' },
}
```

`mode: 'subgraph'` 且没有 handler 的函数会调用 `meta.subgraphId`（未给出时使用函数 id）指向的子图。这样可以把“函数”作为公开接口，把实现保存在子图中。

## 编辑器层建议

子图的编辑体验不属于 Runtime，建议由应用维护：

- 图栈：父图、当前子图与返回路径；面包屑用于进入和返回。
- 签名编辑：编辑 `inputs` / `outputs`，变化后重建调用节点与边界节点的实例端口。
- 保存策略：子图作为独立文档保存，或保存在父图 `meta` / 业务数据库中。
- 画布可以直接编辑子图内部的普通图；“进入子图 / 返回父图”的产品流程由应用实现，Node Wright 不提供占位 API。
