# Vue 适配层（`@node-wright/vue`）

`@node-wright/vue` 是官方 Vue 3 适配层，把底层核心 `@node-wright/core/view` 的编辑器控制器渲染为 Vue 3 组件。编辑器状态与交互全部在控制器中，本包只负责渲染快照、转发事件、通过组件 ref 暴露 `NodeWrightApi`，以及注册 DOM 节点组件。

## 安装与导入

- 依赖：`@node-wright/core`（随本包安装）。
- peer dependency：`vue ^3.5.13`，由宿主应用提供，本包不打包 Vue。
- 样式：`@node-wright/vue/style.css`（已打包 `@node-wright/core/view/style.css`），需要显式导入一次。

```ts
import {
  DefaultDomNode,
  NodeWright,
  type NodeWrightEmitMap,
  type NodeWrightProps,
} from '@node-wright/vue'
import '@node-wright/vue/style.css'
```

| 导出                | 说明                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| `NodeWright`        | 编辑器组件                                                                   |
| `DefaultDomNode`    | 默认 DOM 节点组件（props 为 `NodeWrightDomNodeProps`），可在自定义节点中复用 |
| `NodeWrightProps`   | 组件 props 类型                                                              |
| `NodeWrightEmitMap` | 组件事件类型                                                                 |

编辑器 API、事件 payload 与扩展类型从 `@node-wright/core/view` 导入，图类型从 `@node-wright/core/protocol` 导入。最小可运行示例见 [README](../README.zh-CN.md#vue-3) 与 [getting-started.md](./getting-started.md#2a-vue-编辑器)。

## Props

`NodeWrightProps` = `NodeWrightEditorOptions`（不含 `onEvent`）+ 以下 Vue 专属 props。全部编辑器选项的类型、默认值与语义见 [controller-api.md](./controller-api.md#编辑器选项)。

| Prop            | 类型                        | 默认                  | 说明                                              |
| --------------- | --------------------------- | --------------------- | ------------------------------------------------- |
| `ariaLabel`     | `string`                    | `'Node graph editor'` | 根元素的可访问名称                                |
| `domComponents` | `Record<string, Component>` | -                     | DOM 节点组件注册表，键为 DOM 渲染器的 `component` |

约定：

- 布尔 props（`readonly`、`gridVisible`、`snapToGrid`、`connectionPreview`、`wheelInertia`、`minimap`）未传时为 `undefined`，由控制器套用默认值（例如 `gridVisible` 默认 `true`），不会被 Vue 的布尔转换变成 `false`。
- 适配层把每个对象/数组 prop 以 `toRaw()` 后的原始对象交给控制器，控制器按引用比较。更新选项时请替换为新的对象或数组，原地修改（例如 `nodeDefinitions.push(...)`）不会生效。
- 新的注册表数组（`nodeDefinitions`、`edgeDefinitions`、`commands`、`plugins`）或新的 `connectionValidator` 会重建内部 Store 并清空撤销历史；把 preset 放在模块级或 `setup` 顶层创建一次即可。
- `initialViewport`、`initialSelection` 只在创建时读取。
- 根元素是组件唯一的根节点，`class`、`style` 等属性会透传到它上面。根元素宽高为 `100%`，需要父容器提供高度。

## `v-model:graph`

```vue
<NodeWright v-model:graph="graph" :node-definitions="nodeDefinitions" />
```

编辑器内每次图变化（对应 Store 的 `graph:changed`）发出 `update:graph`。父组件把收到的同一个图对象传回 `graph` 时被识别为回声，不会替换图，撤销历史得以保留；传入其他图对象（例如重置、加载）时替换图并清空历史。需要可撤销的整图替换时使用 `api.graph.apply(next)`。

## 事件

除图变化改名为 `update:graph` 外，事件名与 [`NodeWrightEventMap`](./controller-api.md#事件) 完全一致（kebab-case），参数相同：

```vue
<NodeWright
  v-model:graph="graph"
  @selection-change="(selection, graph, source) => onSelection(selection)"
  @node-drag-end="(event) => save(event.graph)"
  @connection-cancel="openCreateMenu"
  @command-error="(event) => notify(event.reason)"
/>
```

`NodeWrightEmitMap` 是 `defineEmits` 使用的完整类型映射，`vue-tsc` 会检查监听器的参数类型。

## 组件 ref

组件通过 `defineExpose` 暴露 [`NodeWrightApi`](./controller-api.md#nodewrightapi-全表)：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { NodeWrightApi } from '@node-wright/core/view'

const editor = ref<NodeWrightApi | null>(null)

function fit(): void {
  editor.value?.view.fit.graph(72)
}
</script>

<template>
  <NodeWright ref="editor" />
</template>
```

API 在 `setup` 中创建；依赖宿主元素的方法（视口适配、坐标换算等）在组件挂载后才有意义。`@mount` 事件在编辑器挂载到渲染出的元素后发出并带上 API，是首次适配视口的位置（`:key` 变化重新挂载时也会再次发出）：

```vue
<NodeWright v-model:graph="graph" @mount="(api) => api.view.fit.graph(72)" />
```

## 插槽

| 插槽         | 渲染位置                     | 插槽 props                                                                                                    |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `background` | 两个画布之上、DOM 节点层之下 | `api`、`graph`、`readonly`、`gridState`、`interactionState`、`nodeEditorState`、`toggleGrid`、`renderContext` |
| `overlay`    | 所有编辑器图层之上           | `api`、`graph`、`selection`、`gridState`、`interactionState`、`nodeEditorState`、`contextMenuState`           |

`overlay` 适合放工具栏、右键菜单、内联节点编辑器等：

```vue
<NodeWright v-model:graph="graph" :context-menu-items="contextMenuItems">
  <template #overlay="{ api, contextMenuState }">
    <ul
      v-if="contextMenuState"
      class="menu"
      :style="{ left: `${contextMenuState.position.x}px`, top: `${contextMenuState.position.y}px` }"
    >
      <li
        v-for="item in api.menu.resolve.context(contextMenuState.target, contextMenuState.position)"
        :key="item.id"
      >
        <button type="button" :disabled="item.disabled" @click="item.run($event); api.menu.close()">
          {{ item.label }}
        </button>
      </li>
    </ul>
  </template>
</NodeWright>
```

## 自定义 DOM 节点

在节点类型中用 `dom.component` 指定组件键，并通过 `domComponents` 注册对应组件。未注册的键在渲染该节点时抛出 `NodeWright has no DOM node component registered as "<key>".`。

```ts
import type { NodeTypeRegistry } from '@node-wright/core/view'

export const nodeTypes: NodeTypeRegistry = {
  task: {
    width: 260,
    height: 120,
    dom: {
      component: 'task-node',
      services: ({ node }) => ({ ticketId: String(node.data?.ticketId ?? '') }),
    },
  },
}
```

```vue
<NodeWright
  v-model:graph="graph"
  :node-types="nodeTypes"
  :dom-components="{ 'task-node': TaskNode }"
/>
```

组件以 `defineProps<NodeWrightDomNodeProps>()` 声明全部 props（契约见 [DOM 节点组件契约](./controller-api.md#dom-节点组件契约)）：

```vue
<script setup lang="ts">
import type { NodeWrightDomNodeProps } from '@node-wright/core/view'

const props = defineProps<NodeWrightDomNodeProps>()

function startDrag(event: PointerEvent): void {
  props.domApi.interaction.pointerDown(event)
}
</script>

<template>
  <article class="task-node" :class="{ 'task-node--selected': selected }" @pointerdown="startDrag">
    <header class="task-node__title">{{ domModel.title }}</header>
    <span
      v-for="port in domModel.inputs"
      :key="port.key"
      class="task-node__port task-node__port--input"
      :style="{ top: `${port.top}px` }"
      @pointerdown.stop="domApi.ports.startConnection(port.id, $event)"
      @pointerup="domApi.ports.finishConnection(port.id, $event)"
      @pointerenter="domApi.ports.previewConnection(port.id)"
      @pointerleave="domApi.ports.previewConnection(null)"
    />
    <span
      v-for="port in domModel.outputs"
      :key="port.key"
      class="task-node__port task-node__port--output"
      :style="{ top: `${port.top}px` }"
      @pointerdown.stop="domApi.ports.startConnection(port.id, $event)"
      @pointerup="domApi.ports.finishConnection(port.id, $event)"
      @pointerenter="domApi.ports.previewConnection(port.id)"
      @pointerleave="domApi.ports.previewConnection(null)"
    />
  </article>
</template>
```

- Vue 的 `@pointerdown` 等监听器直接绑定在元素上，`$event` 就是原生事件，`currentTarget` 是绑定元素，可直接交给 `domApi`。
- 连线锚点由控制器按 `domModel` 计算：输入端口在节点左边缘、输出端口在右边缘，纵向位置为 `port.top`（相对节点顶部的像素）。自定义组件应把端口放在同一位置。
- 需要节点外的编辑器 API 时使用 `props.context.api`。
- 只想在默认节点外包一层时，可以在自定义组件中渲染 `<DefaultDomNode v-bind="props" />`。

## 默认 DOM 节点

`DefaultDomNode` 渲染标题栏、输入/输出端口、参数字段（文本、多行文本、数字（含拖动调值）、开关、下拉、时间、滑块、图片）与四角尺寸手柄，交互由 `@node-wright/core/view` 的 `createDomNodeControls` 状态机驱动。字段来源、参数输入端口与驱动状态见 [controller-api.md](./controller-api.md#dom-节点渲染器)。

## 主题与节点状态

`theme` 的 `colorScheme`（`'dark'` 默认或 `'light'`）选择内置调色板，根元素渲染为 `data-color-scheme`，`style.css` 中的设计令牌随之切换；其余主题字段逐项覆盖颜色。`nodeStatus` 按节点 id 传入执行状态，默认 DOM 节点显示状态角标，自定义 DOM 节点从 props 的 `status` 读取。主题对象与状态对象按引用比较，放在常量或 `shallowRef` 中：

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import type { NodeWrightNodeStatus } from '@node-wright/core/view'

const light = { colorScheme: 'light' } as const
const nodeStatus = shallowRef<Record<string, NodeWrightNodeStatus>>({})
</script>

<template>
  <NodeWright v-model:graph="graph" :theme="light" :node-status="nodeStatus" />
</template>
```

节点类型的 `accent` 决定默认节点标题栏的色标，见 [controller-api.md](./controller-api.md#nodetypedefinition)。

## 小地图

`minimap` prop 打开小地图：`true`（或不带值的 `minimap` 属性）使用默认尺寸 200 × 136，也可以传入 `NodeWrightMinimapOptions`（`width`、`height`、`padding`）：

```vue
<NodeWright v-model:graph="graph" :node-definitions="nodeDefinitions" minimap />

<NodeWright
  v-model:graph="graph"
  :node-definitions="nodeDefinitions"
  :minimap="{ width: 240, height: 160 }"
/>
```

小地图由内部组件渲染在根元素内、性能浮层之后、`overlay` 插槽之前（`.nw-minimap`，内含 `.nw-minimap__canvas` 与可见区域框 `.nw-minimap__viewport`，拖动时加 `.nw-minimap--dragging`），外观来自 `style.css`，可以在应用样式中覆盖这些类名。点击小地图把视口中心移到该处，拖动平移视口，获得焦点后方向键平移视口（Shift 加速）；平移结束时发出一次 `@viewport-change`（`source` 为 `'minimap'` 或 `'minimap.keyboard'`）。尺寸按值比较，模板中的对象字面量每次渲染都是新对象，也不会引起重算或重绘。完整行为见 [controller-api.md](./controller-api.md#小地图)。

小地图组件在自身 `onMounted` 时挂载到控制器（早于编辑器根元素的挂载），关闭 `minimap` 或卸载组件时解绑。

## 生命周期与服务端渲染

- 控制器在组件 `setup` 中创建，`onMounted` 时挂载到渲染出的根元素与两个画布，`onBeforeUnmount` 时取消订阅并销毁。
- 控制器创建不访问 DOM，组件可以在服务端渲染（打包消费者测试覆盖 `vue/server-renderer` 的 `renderToString`）；客户端挂载后才开始绘制与监听输入。
- 传入的外部 `store` 不会随组件卸载而释放；它持有图与注册表，不能同时传 `graph` / `v-model:graph`、`nodeDefinitions`、`edgeDefinitions`、`commands`、`connectionValidator`（会抛错），见 [controller-api.md](./controller-api.md#图与注册表)。

## 与 React 适配层的对应关系

| Vue                                       | React                                           |
| ----------------------------------------- | ----------------------------------------------- |
| `v-model:graph`（`update:graph`）         | `graph` + `onGraphChange`                       |
| `@selection-change` 等 kebab-case 事件    | `onSelectionChange` 等 `on` + 驼峰回调          |
| 组件 ref（`defineExpose(NodeWrightApi)`） | `ref`（`NodeWrightHandle`，即 `NodeWrightApi`） |
| `#background` / `#overlay` 插槽           | `renderBackground` / `renderOverlay`            |
| 透传的 `class` / `style`                  | `className` / `style`                           |
| 节点组件通过 `props.context.api` 取 API   | 另可使用 `useNodeWrightApi()`                   |

两个适配层运行同一份契约测试，行为一致；React 侧的专属约定见 [react-adapter.md](./react-adapter.md)。
