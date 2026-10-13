# 节点开发指南

一个可复用的业务节点由四层组成，按需实现其中几层即可：

| 层         | 归属                                                                | 职责                                                    |
| ---------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| 协议定义   | `@node-engine-sdk/core/protocol`、`@node-engine-sdk/core/semantics` | 节点 type、端口、参数 schema、默认尺寸与数据、能力      |
| 编辑器渲染 | `@node-engine-sdk/core/view` 类型 + 适配层组件                      | DOM 节点字段与布局、自定义组件、Canvas 渲染、节点编辑器 |
| 语义规则   | `@node-engine-sdk/core/semantics`                                   | 端口 kind、数据类型、容量、必填输入、环路约束、业务规则 |
| 运行行为   | `@node-engine-sdk/core/runtime`                                     | handler、变量、函数与子图调用、异步与取消               |

下面以一个“格式化工单”节点为例。

## 1. 协议定义

```ts
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'

export const TICKET_FORMAT_NODE_TYPE = 'ticket:format'

export const ticketFormatNode: SemanticNodeDefinition = {
  type: TICKET_FORMAT_NODE_TYPE,
  label: '格式化工单',
  category: '工单',
  width: 280,
  height: 200,
  capabilities: ['pure'],
  ports: [
    {
      id: 'title',
      label: '标题',
      direction: 'input',
      kind: 'data',
      dataType: 'string',
      required: true,
    },
    {
      id: 'message',
      label: '消息',
      direction: 'output',
      kind: 'data',
      dataType: 'string',
      capacity: 'many',
    },
  ],
  parameters: [
    {
      key: 'template',
      kind: 'string',
      label: '模板',
      defaultValue: '[{{priority}}] {{title}}',
      input: { portId: 'template' },
    },
    {
      key: 'priority',
      kind: 'select',
      label: '优先级',
      defaultValue: 'normal',
      options: [
        { label: '低', value: 'low' },
        { label: '普通', value: 'normal' },
        { label: '高', value: 'high' },
      ],
    },
  ],
}
```

- `parameters` 是协议级参数 schema，也是“节点有哪些可编辑字段”的唯一来源：默认 DOM 节点与内联节点编辑器都为每个参数生成一个字段，runtime handler 通过 `context.params` 读取。参数值保存在 `node.data.params`；`api.nodes.create` / `add` 会写入 `defaultValue`，因此默认值写在参数上即可，不需要在 `dataDefaults.params` 中重复。
- `input` 让参数可以被上游连线驱动：`template` 会生成 id 为 `template` 的输入端口（不写 `portId` 时为 `field:template`）。驱动时编辑器显示上游值并禁用本地编辑，runtime 中 `params.template` 也取上游值。
- 能力只写在顶层 `capabilities`（`pure`、`effect`、`async`、`event`、`composite`），Runtime 用它决定缓存、重试与默认入口。
- 需要按实例变化的端口（函数调用、子图调用、动态表单）时，把端口写在 `GraphNode.ports`，它优先于定义端口。

## 2. 编辑器渲染

### 默认 DOM 节点

```ts
import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'

export const ticketNodeTypes: NodeTypeRegistry = {
  'ticket:format': {
    dom: {
      defaults: {
        subtitle: 'ticket',
        fieldSource: 'params',
        fields: [
          { key: 'template', kind: 'textarea', placeholder: '使用 {{title}} 与 {{priority}}' },
        ],
        layout: { minWidth: 260, minHeight: 180 },
      },
    },
  },
}
```

`fields` 只是同名参数的显示 hint（标签、控件类型、占位符、数值范围、图片字段设置等），不能声明新字段，也不能声明选项——下拉选项只写在参数的 `options` 上，DOM 字段与节点编辑器因此显示同一组选项；没有参数 schema 的数据不会生成字段。节点编辑器的 `fields` 遵循同一规则。完整字段说明见 [controller-api.md](./controller-api.md#dom-节点渲染器)。

### 自定义 DOM 组件

```ts
import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'

declare const ticketApi: { get(id: string): Promise<unknown> }
declare function openTicketPicker(): void

export const ticketCardNodeTypes: NodeTypeRegistry = {
  'ticket:card': {
    dom: {
      component: 'ticket-card',
      services: ({ node }) => ({ load: () => ticketApi.get(node.id) }),
      actions: () => ({ pick: () => openTicketPicker() }),
    },
  },
}
```

`component` 是组件注册键，在适配层通过 `domComponents` 注册同名组件：Vue 见 [vue-adapter.md](./vue-adapter.md#自定义-dom-节点)，React 见 [react-adapter.md](./react-adapter.md#domcomponents-契约)。组件通过 `domApi` 操作节点、端口、尺寸与编辑器状态，通过 `domServices` / `domActions` 使用业务注入的能力，不需要直接依赖 Store。

### Canvas 节点

```ts
import type { NodeTypeRegistry } from '@node-engine-sdk/core/view'

export const badgeNodeTypes: NodeTypeRegistry = {
  'ticket:badge': {
    width: 120,
    height: 48,
    dom: false,
    canvas: {
      draw({ ctx, bounds, selected, theme, node }) {
        ctx.fillStyle = theme.background
        ctx.strokeStyle = selected ? theme.borderSelected : theme.border
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
        ctx.fillStyle = theme.title
        ctx.fillText(String(node.data?.label ?? node.type), bounds.x + 12, bounds.y + 28)
      },
    },
  },
}
```

`dom: false` 的节点完全由 Canvas 绘制，适合大量简单节点；控制器会为它们生成可键盘选择的辅助结构。

## 3. 语义规则

原语流程插件已经覆盖方向、kind、数据类型、容量、环路与必填输入。业务规则可以做成一个额外的规则插件，与 preset 自带的流程插件并存（插件名必须唯一）：

```ts
import { createConnectionRulesPlugin, defineConnectionRule } from '@node-engine-sdk/core/semantics'

export const ticketRules = createConnectionRulesPlugin(
  [
    defineConnectionRule('ticket:no-chain', (context) =>
      context.sourceNode?.type === 'ticket:format' && context.targetNode?.type === 'ticket:format'
        ? { valid: false, code: 'TICKET_CHAIN', reason: '工单格式化节点不能串联。' }
        : { valid: true },
    ),
  ],
  { name: 'ticket:rules' },
)
```

也可以把规则交给 `createDataflowPlugin({ rules })`，但它与 preset 中的数据流插件同名（`node-engine:dataflow`），此时应替换而不是追加 preset 的 `plugins`。同一套规则同时用于拖线校验与整图诊断，见 [semantics-api.md](./semantics-api.md)。

## 4. Runtime handler

```ts
import type { NodeEngineRuntimeNodeDefinition } from '@node-engine-sdk/core/runtime'

export const ticketFormatRuntime: NodeEngineRuntimeNodeDefinition = {
  type: 'ticket:format',
  handler({ values, params }) {
    const template = String(params.template ?? '{{title}}')
    const message = template
      .replaceAll('{{title}}', String(values.title ?? ''))
      .replaceAll('{{priority}}', String(params.priority ?? 'normal'))

    return { values: { message } }
  },
}
```

handler 只处理运行行为，不读取 DOM、视口、选区或组件状态。异步 handler 必须把 `context.signal` 传给可取消操作；有副作用且可安全重试时声明 `idempotent: true`。

## 5. 打包

```ts
import type { GraphPlugin } from '@node-engine-sdk/core/protocol'
import type { NodeEngineRuntimeNodeDefinition } from '@node-engine-sdk/core/runtime'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'

declare const ticketFormatNode: SemanticNodeDefinition
declare const ticketFormatRuntime: NodeEngineRuntimeNodeDefinition

export const ticketNodeDefinitions = [ticketFormatNode]
export const ticketRuntimeDefinitions = [ticketFormatRuntime]

export function createTicketNodesPlugin(): GraphPlugin {
  return {
    name: '@my-org/nodes-ticket',
    contributes: { nodeDefinitions: ticketNodeDefinitions },
  }
}
```

节点定义与 handler 不依赖任何 UI 框架，可以在服务端执行；DOM 渲染配置只依赖 `@node-engine-sdk/core/view` 的类型，Vue 与 React 共用。只有自定义 DOM 组件需要按框架分别实现。

## 6. 在编辑器与 Runtime 中使用

把业务定义与 preset 合并一次（模块级），再交给编辑器与 Runtime：

```ts
import type { GraphSnapshot } from '@node-engine-sdk/core/protocol'
import {
  NodeEngineRuntime,
  type NodeEngineRuntimeNodeDefinition,
} from '@node-engine-sdk/core/runtime'
import type { SemanticNodeDefinition } from '@node-engine-sdk/core/semantics'
import type { NodeEnginePlugin, NodeTypeRegistry } from '@node-engine-sdk/core/view'
import { createDataflowPreset } from '@node-engine-sdk/presets'

declare const ticketNodeDefinitions: SemanticNodeDefinition[]
declare const ticketRuntimeDefinitions: NodeEngineRuntimeNodeDefinition[]
declare const ticketNodeTypes: NodeTypeRegistry
declare const ticketRules: NodeEnginePlugin

const base = createDataflowPreset()

export const editorConfig = {
  nodeDefinitions: [...base.nodeDefinitions, ...ticketNodeDefinitions],
  nodeTypes: { ...base.nodeTypes, ...ticketNodeTypes },
  plugins: [...(base.plugins ?? []), ticketRules],
}

export function createTicketRuntime(graph: GraphSnapshot): NodeEngineRuntime {
  return new NodeEngineRuntime({
    graph,
    definitions: editorConfig.nodeDefinitions,
    runtimeDefinitions: [...base.runtimeDefinitions, ...ticketRuntimeDefinitions],
  })
}
```

Vue：`<NodeEngine v-model:graph="graph" v-bind="editorConfig" />`；React：`<NodeEngine graph={graph} onGraphChange={setGraph} {...editorConfig} />`。

## 设计建议

- 节点 type 使用稳定命名空间（如 `ticket:format`），端口 id 稳定且不使用显示文本。
- 协议定义只放图结构、参数 schema、默认数据与能力；DOM 字段只负责编辑体验；handler 不依赖 UI。
- 语义规则按需组合，不要把某个业务流程写成通用的硬规则。
- 一组节点形成稳定领域后，在业务方自己的命名空间下拆成独立包；SDK 不为业务领域预留包名。
