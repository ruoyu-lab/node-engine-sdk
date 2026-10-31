# 快速上手

本文从一个可编辑、可执行的最小编辑器开始，再逐步接入 Runtime、自动布局和导入导出。安装方式见根目录 [README](../README.zh-CN.md#安装)。

## 选择入口

| 目标                     | 使用                                                      | 说明                                                                  |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 定义、保存、严格解析图   | `@node-wright/core/protocol`                              | `GraphSnapshot`、`parseGraph`、诊断与参数 schema                      |
| 无界面编辑图数据         | `@node-wright/core/store`（或根入口 `@node-wright/core`） | `GraphStore`、命令、事务、历史、插件与连接校验                        |
| 快速搭建 Vue 编辑器      | `@node-wright/vue` + `@node-wright/presets`               | 默认节点、DOM 渲染、语义插件、布局策略、初始视口                      |
| 快速搭建 React 编辑器    | `@node-wright/react` + `@node-wright/presets`             | 与 Vue 版同名同语义的 props、事件与 ref API                           |
| 端口语义与连线规则       | `@node-wright/core/semantics`                             | 端口 kind、数据类型、容量、环路、必填输入                             |
| 执行节点图               | `@node-wright/core/runtime`                               | headless 执行，不依赖 DOM 与 UI 框架                                  |
| 自动布局                 | `@node-wright/core/layout`                                | 输入 `GraphSnapshot`，输出位置 patch                                  |
| 调试运行结果             | `@node-wright/core/debug`                                 | 查询 trace、callFrames、nodeStates                                    |
| 为其他 UI 框架编写适配层 | `@node-wright/core/view`                                  | `createEditorController`，见 [controller-api.md](./controller-api.md) |

## 1. 准备图与 preset

`GraphSnapshot` 是唯一持久化格式；preset 提供节点定义、DOM 渲染配置、语义插件、Runtime definitions、布局策略与初始视口。下面两个框架示例使用同一份图：

```ts
import { NODE_WRIGHT_GRAPH_SCHEMA_VERSION, type GraphSnapshot } from '@node-wright/core/protocol'
import {
  DATA_PREVIEW_NODE_TYPE,
  DATA_SOURCE_NODE_TYPE,
  DATA_TRANSFORM_NODE_TYPE,
  createDataflowPreset,
} from '@node-wright/presets'

export const preset = createDataflowPreset()

export function createDemoGraph(): GraphSnapshot {
  return {
    schemaVersion: NODE_WRIGHT_GRAPH_SCHEMA_VERSION,
    nodes: [
      { id: 'source', type: DATA_SOURCE_NODE_TYPE, x: 80, y: 120, data: { params: { value: 21 } } },
      {
        id: 'transform',
        type: DATA_TRANSFORM_NODE_TYPE,
        x: 400,
        y: 120,
        data: { params: { operation: 'string' } },
      },
      { id: 'preview', type: DATA_PREVIEW_NODE_TYPE, x: 720, y: 120 },
    ],
    edges: [
      {
        id: 'source-to-transform',
        kind: 'data',
        source: { nodeId: 'source', portId: 'value' },
        target: { nodeId: 'transform', portId: 'input' },
      },
      {
        id: 'transform-to-preview',
        kind: 'data',
        source: { nodeId: 'transform', portId: 'output' },
        target: { nodeId: 'preview', portId: 'value' },
      },
    ],
    groups: [],
    meta: {},
  }
}
```

后文假设这段代码保存为 `demo-graph.ts`。

## 2a. Vue 编辑器

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightApi } from '@node-wright/core/view'
import { DATA_PREVIEW_NODE_TYPE } from '@node-wright/presets'
import { NodeWright } from '@node-wright/vue'
import '@node-wright/vue/style.css'
import { createDemoGraph, preset } from './demo-graph'

const graph = ref<GraphSnapshot>(createDemoGraph())
const editor = ref<NodeWrightApi | null>(null)

function addPreview(): void {
  // nodes.create 会套用节点定义的尺寸、端口与默认数据，并记录一条可撤销历史。
  editor.value?.nodes.create(DATA_PREVIEW_NODE_TYPE, { x: 720, y: 320 })
}
</script>

<template>
  <div style="height: 100vh">
    <NodeWright
      ref="editor"
      v-model:graph="graph"
      :node-definitions="preset.nodeDefinitions"
      :node-types="preset.nodeTypes"
      :plugins="preset.plugins"
      :initial-viewport="preset.initialViewport"
    >
      <template #overlay="{ api, selection }">
        <div style="position: absolute; top: 12px; left: 12px; display: flex; gap: 8px">
          <button type="button" @click="addPreview">添加预览节点</button>
          <button type="button" :disabled="!api.history.canUndo()" @click="api.history.undo()">
            撤销
          </button>
          <button
            type="button"
            :disabled="!selection.nodes.length && !selection.edges.length"
            @click="api.selection.remove()"
          >
            删除选中
          </button>
        </div>
      </template>
    </NodeWright>
  </div>
</template>
```

- `v-model:graph` 双向绑定图：编辑器内的每次图变化以 `update:graph` 发出；父组件把收到的同一个对象传回时不会触发替换，撤销历史得以保留。
- 组件 ref 暴露 [`NodeWrightApi`](./controller-api.md#nodewrightapi-全表)。
- 默认已经包含画布交互、默认 DOM 节点、分组、连线校验、复制粘贴、撤销重做与快捷键。完整 props 见 [vue-adapter.md](./vue-adapter.md)。

## 2b. React 编辑器

```tsx
import { useRef, useState } from 'react'
import { DATA_PREVIEW_NODE_TYPE } from '@node-wright/presets'
import { NodeWright, type NodeWrightHandle } from '@node-wright/react'
import '@node-wright/react/style.css'
import { createDemoGraph, preset } from './demo-graph'

export function App() {
  const [graph, setGraph] = useState(createDemoGraph)
  const editor = useRef<NodeWrightHandle>(null)

  return (
    <div style={{ height: '100vh' }}>
      <NodeWright
        ref={editor}
        graph={graph}
        onGraphChange={setGraph}
        nodeDefinitions={preset.nodeDefinitions}
        nodeTypes={preset.nodeTypes}
        plugins={preset.plugins}
        initialViewport={preset.initialViewport}
        renderOverlay={({ api, selection }) => (
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() =>
                editor.current?.nodes.create(DATA_PREVIEW_NODE_TYPE, { x: 720, y: 320 })
              }
            >
              添加预览节点
            </button>
            <button
              type="button"
              disabled={!api.history.canUndo()}
              onClick={() => api.history.undo()}
            >
              撤销
            </button>
            <button
              type="button"
              disabled={!selection.nodes.length && !selection.edges.length}
              onClick={() => api.selection.remove()}
            >
              删除选中
            </button>
          </div>
        )}
      />
    </div>
  )
}
```

- `graph` + `onGraphChange` 对应 Vue 的 `v-model:graph`，其余事件是 `on` + 驼峰事件名（`selection-change` → `onSelectionChange`）。
- `preset` 在模块级创建：对象与数组 props 按引用比较，每次渲染新建的 `nodeDefinitions` / `plugins` 数组会重建内部 Store 并清空撤销历史。
- ref 中的 API 从挂载的同一次提交起可用。完整约定（StrictMode、SSR、原生事件）见 [react-adapter.md](./react-adapter.md)。

## 3. 接入 Runtime

Runtime 可选，编辑器本身不会创建它。需要执行时把当前图交给 `NodeWrightRuntime`：

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime, type NodeWrightRunResult } from '@node-wright/core/runtime'
import { preset } from './demo-graph'

export async function runGraph(graph: GraphSnapshot): Promise<NodeWrightRunResult> {
  const runtime = new NodeWrightRuntime({
    graph,
    definitions: preset.nodeDefinitions,
    runtimeDefinitions: preset.runtimeDefinitions,
  })
  // 纯数据流没有事件节点，显式指定终点节点作为入口，Runtime 向上游求值数据依赖。
  const compiled = runtime.compile('preview')

  if (!compiled.plan) {
    throw new Error(compiled.diagnostics[0]?.message ?? 'Graph cannot run.')
  }

  return runtime.run(compiled.plan)
}
```

在 Vue 中调用 `runGraph(graph.value)`，在 React 中调用 `runGraph(graph)`。执行流图（带 `exec:event` 节点）可以省略入口 id，编译器会选择第一个带 `event` 能力的节点。Runtime 不知道视口、选区或 DOM，也不会把结果写回图；如何展示 `result.nodeStates` 由应用决定，见 [runtime-api.md](./runtime-api.md)。

## 4. 自动布局

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { preset } from './demo-graph'

export function layout(graph: GraphSnapshot): GraphSnapshot {
  return preset.layout.apply(graph)
}
```

把返回的新图交给 `v-model:graph` / `setGraph` 即可；如需进入撤销历史，改用 `api.graph.apply(layout(api.graph.get()))`。完全自定义的策略可直接使用 [`@node-wright/core/layout`](./layout-api.md)。

## 5. 保存与加载

```ts
import { parseGraph, type GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightApi } from '@node-wright/core/view'
import { preset } from './demo-graph'

export function save(api: NodeWrightApi): string {
  return JSON.stringify(api.graph.export())
}

export function load(api: NodeWrightApi, json: string): GraphSnapshot {
  // graph.import 内部同样经过 parseGraph 严格解析，并替换图、清空历史。
  return api.graph.import(JSON.parse(json))
}

export function loadWithoutEditor(json: string): GraphSnapshot {
  return parseGraph(JSON.parse(json), { nodeDefinitions: preset.nodeDefinitions })
}
```

结构不合法的输入会抛出 `GraphParseError`（带 `path` 与 `diagnostics`），语义诊断（例如必填输入未连接）不会阻止加载，可以通过 `api.diagnostics.list()` 展示。

## 下一步

1. [architecture.md](./architecture.md)：理解分层与依赖方向。
2. [controller-api.md](./controller-api.md)：编辑器选项、事件与 `NodeWrightApi` 全表。
3. [node-definition-guide.md](./node-definition-guide.md)：开发自己的节点。
4. [editor-integration.md](./editor-integration.md)：工具栏、菜单、快捷键与参数控制器。
5. [runtime-api.md](./runtime-api.md)：变量、函数、子图、调度与调试。
