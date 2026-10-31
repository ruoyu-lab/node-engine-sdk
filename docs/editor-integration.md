# 编辑器集成

`NodeWright` 不强制任何外部面板。节点库、属性检查器、运行面板、调试面板都由应用组合；Node Wright 提供的是可复用的编辑器原语：编辑器选项、插件、`NodeWrightApi`、事件和扩展点。本文的扩展定义都是框架无关的 TypeScript，Vue 与 React 共用，只有渲染部分（overlay 插槽或 `renderOverlay`）按框架编写。

## 基础结构

```vue
<NodeWright
  ref="editor"
  v-model:graph="graph"
  :node-definitions="preset.nodeDefinitions"
  :node-types="preset.nodeTypes"
  :plugins="preset.plugins"
  :toolbar-items="toolbarItems"
  :context-menu-items="contextMenuItems"
  :hotkeys="hotkeys"
>
  <template #overlay="{ api, contextMenuState, nodeEditorState }">
    <!-- 工具栏、右键菜单、节点编辑器 -->
  </template>
</NodeWright>
```

```tsx
<NodeWright
  ref={editor}
  graph={graph}
  onGraphChange={setGraph}
  nodeDefinitions={preset.nodeDefinitions}
  nodeTypes={preset.nodeTypes}
  plugins={preset.plugins}
  toolbarItems={toolbarItems}
  contextMenuItems={contextMenuItems}
  hotkeys={hotkeys}
  renderOverlay={(props) => <EditorChrome {...props} />}
/>
```

## 视口与选区

```ts
import type { NodeWrightApi } from '@node-wright/core/view'

export function focusNode(api: NodeWrightApi, nodeId: string): void {
  api.selection.nodes([nodeId])
  api.view.center.node(nodeId)
}

export function fitAll(api: NodeWrightApi): void {
  api.view.fit.graph(72)
}
```

视口与选区是编辑器状态，不属于 `GraphSnapshot`。需要持久化时由应用自行保存（例如监听 `viewport-change`），下次通过 `initialViewport` / `initialSelection` 传入。

## 工具栏、右键菜单与快捷键

```ts
import { applyGraphLayout, layoutGraph } from '@node-wright/core/layout'
import type {
  NodeWrightContextMenuItem,
  NodeWrightHotkey,
  NodeWrightToolbarItem,
} from '@node-wright/core/view'

export const toolbarItems: NodeWrightToolbarItem[] = [
  {
    id: 'layout.auto',
    label: '自动布局',
    order: 10,
    disabled: ({ readonly, graph }) => readonly || graph.nodes.length === 0,
    run({ api, graph }) {
      api.graph.apply(applyGraphLayout(graph, layoutGraph(graph, { edgeKinds: ['data', 'exec'] })))
      api.view.fit.graph(72)
    },
  },
  {
    id: 'selection.remove',
    label: '删除',
    order: 20,
    kind: 'accent',
    disabled: ({ selection }) => selection.nodes.length === 0 && selection.edges.length === 0,
    run: ({ api }) => {
      api.selection.remove()
    },
  },
]

export const contextMenuItems: NodeWrightContextMenuItem[] = [
  {
    id: 'node.center',
    label: '居中节点',
    visible: ({ target }) => target.kind === 'node',
    run({ api, target }) {
      if (target.kind === 'node') {
        api.view.center.node(target.node.id)
      }
    },
  },
  {
    id: 'canvas.paste',
    label: '粘贴到这里',
    visible: ({ target }) => target.kind === 'canvas',
    run: ({ api, graphPosition }) => {
      api.clipboard.paste(graphPosition)
    },
  },
]

export const hotkeys: NodeWrightHotkey[] = [
  {
    id: 'view.fit-selection',
    key: 'f',
    shift: true,
    run: ({ api }) => api.view.fit.selection(72),
  },
]
```

- 工具栏与右键菜单只产生数据：`api.menu.resolve.toolbar()` / `api.menu.resolve.context(target, position)` 返回过滤了 `visible`、计算好 `disabled` 并排序的条目，条目的 `run(event?)` 已绑定上下文。渲染示例见 [vue-adapter.md](./vue-adapter.md#插槽) 与 [react-adapter.md](./react-adapter.md#render-props)。
- 右键时控制器打开菜单状态（`contextMenuState` / `context-menu-open`），`position` 为根元素内的屏幕坐标，`graphPosition` 为图坐标。
- 快捷键在编辑器根元素获得焦点时生效；`priority` 越高越先匹配，均高于内置快捷键（撤销、重做、复制、粘贴、删除）。这些条目也可以通过插件的 `components` 贡献。

## 自动布局

preset 自带布局策略，最简单的写法是 `api.graph.apply(preset.layout.apply(api.graph.get()))`。`api.graph.apply` 写入一条可撤销历史；若通过受控 `graph` 直接替换，则会清空历史。只布局选区、做动画等策略由应用实现。详见 [layout-api.md](./layout-api.md)。

## 分组

分组属于图数据（`GraphGroup.nodeIds` 是成员唯一来源），分组的拖动手柄、最小尺寸、是否带动成员等属于编辑器行为：

```ts
import type { NodeWrightBehaviors } from '@node-wright/core/view'

export const behaviors: Partial<NodeWrightBehaviors> = {
  group: {
    dragHandle: 'header',
    moveNodesOnDrag: true,
    resizable: true,
    minWidth: 180,
    minHeight: 120,
  },
}
```

常用 API：`api.groups.add(group)`、`update`、`move([id], delta)`、`resize(id, size)`、`toggleCollapsed(id)`、`remove(id)`。通过 API 或拖动新增、移动、缩放节点时，受影响分组的成员按位置重新计算：落入分组范围的节点加入，移出范围的节点退出。

## 参数控制器

默认 DOM 节点把 `NodeDefinition.parameters` 渲染为字段。参数默认是本地值；打开 `input` 后字段可以被上游连线驱动：

```ts
import type { NodeDefinition } from '@node-wright/core/protocol'

export const sendNode: NodeDefinition = {
  type: 'task:send',
  ports: [{ id: 'done', direction: 'output', kind: 'data' }],
  parameters: [{ key: 'message', label: '消息', kind: 'string', input: { portId: 'message' } }],
}
```

被驱动的字段显示上游值并禁用本地编辑。上游值默认按 [`resolvePortValue` 默认规则](./controller-api.md#resolveportvalue) 从上游节点的参数中读取；需要显示运行结果时可以提供自己的解析器：

```ts
import type { NodeWrightRunResult } from '@node-wright/core/runtime'
import type { NodeWrightResolvePortValueHook } from '@node-wright/core/view'

export function createResultResolver(result: NodeWrightRunResult): NodeWrightResolvePortValueHook {
  return ({ endpoint, node }) =>
    result.nodeStates[endpoint.nodeId]?.outputValues?.[endpoint.portId] ??
    (node?.data?.params as Record<string, unknown> | undefined)?.[endpoint.portId]
}
```

把返回的函数作为 `resolvePortValue` 传给编辑器即可（注意它按引用比较，结果变化时再生成新的函数）。

## 拖线到空白处创建节点

从端口拖出但没有落到有效端口时，控制器发出 `connection-cancel`。`source` 是拖拽起点端口，`targetDirection` 是需要的另一端方向：

```ts
import type { NodeWrightApi, NodeWrightConnectionCancelEvent } from '@node-wright/core/view'
import { DATA_PREVIEW_NODE_TYPE, DATA_SOURCE_NODE_TYPE } from '@node-wright/presets'

export function createNodeAtDrop(api: NodeWrightApi, event: NodeWrightConnectionCancelEvent): void {
  if (event.dragDistance < 18) {
    return
  }

  api.transactions.run('Create connected node', () => {
    if (event.targetDirection === 'input') {
      const node = api.nodes.create(DATA_PREVIEW_NODE_TYPE, { x: event.point.x, y: event.point.y })

      if (node) {
        api.edges.connect(event.source, { nodeId: node.id, portId: 'value' })
      }
    } else {
      const node = api.nodes.create(DATA_SOURCE_NODE_TYPE, {
        x: event.point.x - 240,
        y: event.point.y,
      })

      if (node) {
        api.edges.connect({ nodeId: node.id, portId: 'value' }, event.source)
      }
    }
  })
}
```

`transactions.run` 让“建节点 + 连线”成为一条可撤销历史。playground 的做法是先弹出候选节点菜单（`event.screenPoint` 用于定位菜单，候选项只包含当前场景注册的节点类型），选中后依次调用 `nodes.create` 与 `edges.connect`，连接失败时删除新建的节点并显示校验原因，见 `playground-shared/src/app/connection-create-menu.ts`。

## 只读、诊断与事件

- `readonly` 禁止编辑交互与写操作类快捷键，复制、平移、缩放、选择仍可用。
- `api.diagnostics.list()` 返回协议结构、语义插件与业务 provider 的整图诊断，可用于错误列表或在节点上标注；语义诊断不会阻止编辑。
- `api.commands.dispatch()` 未应用时发出 `command-error`；`command` 事件转发每个 Store 事件，适合做自动保存或审计。
- 拖拽、缩放、视口交互都有 `*-start` / 进行中 / `*-end` 三段事件，事件同时带已提交的 `graph` 与含预览的 `liveGraph`。

## 触控板与滚轮

- `wheelBehavior: 'zoom'`（默认）：滚轮缩放，以指针下的图坐标点为锚点；工具栏等程序化缩放用 `api.view.zoom.to(zoom)`，以视口中心为锚点。
- `wheelBehavior: 'pan'`：滚轮平移。
- `wheelBehavior: 'mixed'`：滚轮缩放，按住 Shift 时平移。

编辑器不会根据触控板手势自动切换模式；带 `ctrlKey` 的滚轮（触控板捏合）被拦截并忽略，避免误缩放页面。`wheelInertia` 控制滚轮惯性。

## 留给应用的部分

- 节点库面板、属性检查器布局、调试器外观、子图导航外观。
- 工作流保存、发布、权限与多人协作。
- 节点搜索等产品能力（Node Wright 当前不提供，也不保留占位 API）。
