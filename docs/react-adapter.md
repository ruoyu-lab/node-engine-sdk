# React 适配层（`@node-wright/react`）

`@node-wright/react` 是官方 React 适配层，把底层核心 `@node-wright/core/view` 的编辑器控制器渲染为 React 组件。props、事件、ref API 与默认 DOM 节点行为都与 Vue 版一致（两者运行同一份适配层契约测试），本文说明 React 侧的用法与专属约定。

## 安装与导入

- 依赖：`@node-wright/core`（随本包安装）。
- peer dependencies：`react`、`react-dom` `^18.3.0 || ^19.0.0`；`@types/react` 为可选 peer。
- 样式：`@node-wright/react/style.css`（已打包 `@node-wright/core/view/style.css`），需要显式导入一次。

```ts
import {
  DefaultDomNode,
  NodeWright,
  useNodeWrightApi,
  type NodeWrightHandle,
} from '@node-wright/react'
import '@node-wright/react/style.css'
```

| 导出                                                               | 说明                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `NodeWright`                                                       | 编辑器组件（`forwardRef`，ref 类型为 `NodeWrightHandle`）              |
| `DefaultDomNode`                                                   | 默认 DOM 节点组件（`memo`，props 为 `NodeWrightDomNodeProps`）         |
| `useNodeWrightApi()`                                               | 在 render props 内容与 DOM 节点组件中取得所在编辑器的 `NodeWrightApi`  |
| `NodeWrightProps`                                                  | 组件 props 类型                                                        |
| `NodeWrightHandle`                                                 | ref 的值，即 `NodeWrightApi`                                           |
| `NodeWrightEventHandlers`                                          | 全部事件回调 props 的类型                                              |
| `NodeWrightEventHandlerName<Name>`                                 | 事件名到回调 prop 名的类型映射（`'graph-change'` → `'onGraphChange'`） |
| `NodeWrightDomComponent`                                           | DOM 节点组件类型：`ComponentType<NodeWrightDomNodeProps>`              |
| `NodeWrightBackgroundRenderProps` / `NodeWrightOverlayRenderProps` | render props 的参数类型                                                |

最小可运行示例见 [README](../README.zh-CN.md#react) 与 [getting-started.md](./getting-started.md#2b-react-编辑器)。

## Props

`NodeWrightProps` = `NodeWrightEditorOptions`（不含 `onEvent`）+ 事件回调 + 以下 React 专属 props。编辑器选项的类型、默认值与语义见 [controller-api.md](./controller-api.md#编辑器选项)。

| Prop               | 类型                                                    | 说明                                              |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| `ariaLabel`        | `string`                                                | 根元素可访问名称，默认 `'Node graph editor'`      |
| `className`        | `string`                                                | 追加到根元素 `nw-root` 之后                       |
| `style`            | `CSSProperties`                                         | 与主题根样式合并（后者为 CSS 自定义属性）         |
| `domComponents`    | `Readonly<Record<string, NodeWrightDomComponent>>`      | DOM 节点组件注册表，键为 DOM 渲染器的 `component` |
| `renderBackground` | `(props: NodeWrightBackgroundRenderProps) => ReactNode` | 渲染在画布之上、DOM 节点层之下                    |
| `renderOverlay`    | `(props: NodeWrightOverlayRenderProps) => ReactNode`    | 渲染在所有编辑器图层之上                          |

### 引用比较

- 编辑器选项按引用比较：每次提交后，适配层逐项比较选项值，只有某一项引用变化时才调用 `controller.update()`。请传入稳定引用——模块级常量、state 或 `useMemo` 的结果。
- 新的注册表数组（`nodeDefinitions`、`edgeDefinitions`、`commands`、`plugins`）或新的 `connectionValidator` 会以当前图重建内部 Store，并清空撤销历史。
- 事件回调 props 不参与比较，每次渲染都可以是新的函数；适配层总是调用最近一次渲染的回调。
- `initialViewport`、`initialSelection` 只在控制器创建时读取。

### 受控图

```tsx
const [graph, setGraph] = useState(initialGraph)

<NodeWright graph={graph} onGraphChange={setGraph} />
```

`graph` + `onGraphChange` 对应 Vue 的 `v-model:graph`。`onGraphChange` 回传的图对象原样传回 `graph` 时被识别为回声，不会替换图，撤销历史得以保留；传入其他图对象时替换图并清空历史。只传 `graph` 不接 `onGraphChange` 时，编辑器内部仍然可以编辑，`graph` 只在引用变化时覆盖内部状态。

## 事件

每个 [`NodeWrightEventMap`](./controller-api.md#事件) 事件对应一个 `on` + 驼峰名的回调 prop，参数与 Vue 事件相同：`graph-change` → `onGraphChange`、`selection-change` → `onSelectionChange`、`node-drag-end` → `onNodeDragEnd`、`connect` → `onConnect`、`command-error` → `onCommandError`。

```tsx
<NodeWright
  graph={graph}
  onGraphChange={setGraph}
  onSelectionChange={(selection, _graph, source) => console.log(source, selection.nodes)}
  onConnectionCancel={(event) => openCreateMenu(event)}
/>
```

## ref 与 `useNodeWrightApi`

```tsx
const editor = useRef<NodeWrightHandle>(null)

useLayoutEffect(() => {
  editor.current?.view.fit.graph(72)
}, [])

return <NodeWright ref={editor} graph={graph} onGraphChange={setGraph} />
```

- ref 中的 `NodeWrightApi` 从挂载的同一次提交起可用：父组件第一个 `useLayoutEffect` / `useEffect` 中即可调用。
- StrictMode 的模拟重挂载会换成新的控制器，ref 随之指向新控制器的 API。
- `onMount(api)` 在每个控制器挂载到渲染出的元素后调用，是首次适配视口的位置：StrictMode 重挂载与 `key` 变化创建的新控制器都会再调用一次，因此不会遗漏，例如 `onMount={(api) => api.view.fit.graph(72)}`。
- `useNodeWrightApi()` 只能在 `renderBackground` / `renderOverlay` 渲染的内容和 DOM 节点组件中调用，其他位置会抛错。

## Render props

`renderBackground` 与 `renderOverlay` 的参数与 Vue 的 `background` / `overlay` 插槽 props 相同：

| render prop        | 参数                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `renderBackground` | `api`、`graph`、`readonly`、`gridState`、`interactionState`、`nodeEditorState`、`toggleGrid`、`renderContext` |
| `renderOverlay`    | `api`、`graph`、`selection`、`gridState`、`interactionState`、`nodeEditorState`、`contextMenuState`           |

```tsx
import { useState } from 'react'
import type { GraphSnapshot } from '@node-wright/core/protocol'
import type { NodeWrightToolbarItem } from '@node-wright/core/view'
import { NodeWright, type NodeWrightOverlayRenderProps } from '@node-wright/react'

declare const initialGraph: GraphSnapshot
declare const toolbarItems: NodeWrightToolbarItem[]

function Toolbar({ api }: NodeWrightOverlayRenderProps) {
  return (
    <div className="toolbar">
      {api.menu.resolve.toolbar().map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          onClick={(event) => item.run(event.nativeEvent)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function Editor() {
  const [graph, setGraph] = useState(initialGraph)

  return (
    <NodeWright
      graph={graph}
      onGraphChange={setGraph}
      toolbarItems={toolbarItems}
      renderOverlay={Toolbar}
    />
  )
}
```

render props 在控制器创建之后才会调用；服务端渲染与首次提交之前不调用。

## 主题与节点状态

`theme.colorScheme`（`'dark'` 默认或 `'light'`）选择内置调色板，根元素渲染为 `data-color-scheme`（服务端渲染时由 `theme` 直接得出），`style.css` 中的设计令牌随之切换；其余主题字段逐项覆盖颜色。`nodeStatus` 按节点 id 传入执行状态，默认 DOM 节点显示状态角标（`DefaultDomNode` 的 memo 比较包含 `status`），自定义 DOM 节点从 props 的 `status` 读取。两者都按引用比较，用模块常量或 state：

```tsx
const LIGHT = { colorScheme: 'light' } as const

const [nodeStatus, setNodeStatus] = useState<Record<string, NodeWrightNodeStatus>>({})

return <NodeWright graph={graph} onGraphChange={setGraph} theme={LIGHT} nodeStatus={nodeStatus} />
```

节点类型的 `accent` 决定默认节点标题栏的色标，见 [controller-api.md](./controller-api.md#nodetypedefinition)。

## 小地图

`minimap` prop 打开小地图：`true` 使用默认尺寸 200 × 136，也可以传入 `NodeWrightMinimapOptions`（`width`、`height`、`padding`）：

```tsx
<NodeWright graph={graph} onGraphChange={setGraph} minimap />

<NodeWright graph={graph} onGraphChange={setGraph} minimap={{ width: 240, height: 160 }} />
```

小地图渲染在根元素内、性能浮层之后、`renderOverlay` 的内容之前（`.nw-minimap`，内含 `.nw-minimap__canvas` 与可见区域框 `.nw-minimap__viewport`，拖动时加 `.nw-minimap--dragging`），外观来自 `style.css`，可以在应用样式中覆盖这些类名。点击小地图把视口中心移到该处，拖动平移视口，获得焦点后方向键平移视口（Shift 加速）；平移结束时调用一次 `onViewportChange`（`source` 为 `'minimap'` 或 `'minimap.keyboard'`）。完整行为见 [controller-api.md](./controller-api.md#小地图)。

- `minimap` 与其他选项一样按引用比较：内联对象每次渲染都会触发一次 `update()`，但控制器按值比较尺寸，内容相同时不会重算或重绘。
- 小地图元素在 layout effect 中挂载到控制器，StrictMode 的模拟重挂载会先解绑再重新挂载；关闭 `minimap` 或卸载组件时解绑。
- 与其他编辑器图层一样，小地图在控制器创建之后才渲染，服务端渲染不输出它。

## StrictMode

控制器是外部资源，适配层从不在渲染过程中创建它，而是在一个 layout effect 中创建、`mount`，并在清理时 `destroy`：

- StrictMode（React 18 与 19）的模拟卸载会销毁第一个控制器并创建新的控制器，不会泄漏，也不会调用已销毁的控制器。
- 传入外部 `store` 时，任何时刻只有一个控制器订阅它；它持有图与注册表，不能同时传 `graph`、`nodeDefinitions`、`edgeDefinitions`、`commands`、`connectionValidator`（会抛错），见 [controller-api.md](./controller-api.md#图与注册表)。
- 默认 DOM 节点的交互控件（`createDomNodeControls`）同样在 layout effect 中挂载，StrictMode 下会随之销毁并重新挂载。

## 服务端渲染

- 服务端只输出根元素（含 `className`、`aria-label`）与两个画布，不访问 DOM，也不调用 render props；`gridVisible={false}` 时网格画布带 `display:none`。
- 客户端首次渲染与服务端输出一致，hydrate 不会出现不一致；节点层在挂载后的提交中渲染。
- 适配层在服务端使用 `useEffect` 代替 `useLayoutEffect`，React 18 不会报告 layout effect 警告。
- 包内没有 `'use client'` 指令。在 React Server Components 框架中，请在客户端组件里渲染 `NodeWright`。

## 原生事件注意事项

`domApi` 的手势入口（`interaction.pointerDown`、`ports.startConnection` / `finishConnection`、`resize.start`）和 `createDomNodeControls` 按 DOM 监听语义工作：

- 手势在 `event.currentTarget` 上捕获指针（例如尺寸手柄在拖动过程中保持光标）；
- `event.stopPropagation()` 阻止原生冒泡，避免节点内的控件触发画布手势。

React 的合成事件委托在根容器上派发，`nativeEvent.currentTarget` 不是绑定元素，原生冒泡也已经发生，因此**自定义 React DOM 节点必须用原生监听器**把事件交给 `domApi`。默认 DOM 节点就是这样实现的。示例：

```tsx
import { memo, useEffect, useRef } from 'react'
import type {
  NodeWrightDomNodeApi,
  NodeWrightDomNodeProps,
  NodeWrightResolvedDomNodePort,
} from '@node-wright/core/view'
import type { NodeWrightDomComponent } from '@node-wright/react'

function TaskPort(props: {
  port: NodeWrightResolvedDomNodePort
  side: 'input' | 'output'
  domApi: NodeWrightDomNodeApi
}) {
  const { port, side, domApi } = props
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return undefined
    }

    const down = (event: PointerEvent) => {
      event.stopPropagation()
      domApi.ports.startConnection(port.id, event)
    }
    const up = (event: PointerEvent) => {
      domApi.ports.finishConnection(port.id, event)
    }
    const enter = () => {
      domApi.ports.previewConnection(port.id)
    }
    const leave = () => {
      domApi.ports.previewConnection(null)
    }

    element.addEventListener('pointerdown', down)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)

    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
    }
  }, [domApi, port.id])

  return (
    <span
      ref={ref}
      className={`task-node__port task-node__port--${side}`}
      style={{ top: port.top }}
    />
  )
}

function TaskNodeView({ domApi, domModel, selected }: NodeWrightDomNodeProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return undefined
    }

    const down = (event: PointerEvent) => {
      domApi.interaction.pointerDown(event)
    }

    element.addEventListener('pointerdown', down)
    return () => element.removeEventListener('pointerdown', down)
  }, [domApi])

  return (
    <article ref={ref} className={selected ? 'task-node task-node--selected' : 'task-node'}>
      <header className="task-node__title">{domModel.title}</header>
      {domModel.inputs.map((port) => (
        <TaskPort key={port.key} port={port} side="input" domApi={domApi} />
      ))}
      {domModel.outputs.map((port) => (
        <TaskPort key={port.key} port={port} side="output" domApi={domApi} />
      ))}
    </article>
  )
}

/** 只比较本组件读取的 props，平移和缩放不会重渲染它。 */
export const TaskNode: NodeWrightDomComponent = memo(
  TaskNodeView,
  (previous, next) =>
    previous.domModel === next.domModel &&
    previous.domApi === next.domApi &&
    previous.selected === next.selected,
)
```

普通的点击、输入等不涉及 `domApi` 手势的交互可以照常使用 React 事件；如需阻止它们触发画布手势，同样要在原生 `pointerdown` 监听器中调用 `stopPropagation()`。

## `domComponents` 契约

- 键为节点类型 `dom.component` 的值，值为 `ComponentType<NodeWrightDomNodeProps>`；缺失的键在渲染该节点时抛出 `NodeWright has no DOM node component registered as "<key>".`。默认节点的键（`NODE_WRIGHT_DEFAULT_DOM_COMPONENT`）由适配层内置，无需注册。
- 组件收到的 props 见 [DOM 节点组件契约](./controller-api.md#dom-节点组件契约)，另加渲染器 `props(context)` 返回的附加字段。
- `context`、`screenBounds`、`zoom`、`theme`、`inputs` / `outputs` 每个视口帧都会更新；`domModel` 与 `domApi` 在节点本身变化前保持引用不变。默认节点只比较 `domModel`、`domApi`、`selected`、`dragging`、`connectionSource`；自定义组件需要时用 `memo` 自行比较。
- 连线锚点按 `domModel` 计算：输入端口在节点左边缘、输出端口在右边缘，纵向位置为 `port.top`。
- 组件内可以调用 `useNodeWrightApi()` 取得编辑器 API。
- 注册的组件请在模块级定义：在渲染过程中内联创建的组件每次渲染都是新的组件类型，会导致对应节点反复卸载重挂。`domComponents` 不是编辑器选项，变化时不会重建 Store。

## 与 Vue 适配层的对应关系

见 [vue-adapter.md](./vue-adapter.md#与-react-适配层的对应关系)。
