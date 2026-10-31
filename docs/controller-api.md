# 编辑器控制器 API（`@node-wright/core/view`）

`@node-wright/core/view` 是底层核心 中框架无关的编辑器控制器。`createEditorController(options)` 持有编辑器的全部状态与交互：视口、选区、拖拽、连线、框选、缩放、剪贴板、快捷键、节点编辑器、右键菜单、可见性裁剪、性能采样与 Canvas 绘制调度。官方适配层 `@node-wright/vue` 与 `@node-wright/react` 都只是这个控制器的渲染层，因此本文同时是两个适配层 props、事件与 ref API 的权威参考。

```ts
import {
  createEditorController,
  type NodeWrightApi,
  type NodeWrightEditorOptions,
  type NodeWrightEventMap,
} from '@node-wright/core/view'
```

## 控制器契约

| 成员                       | 说明                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `api`                      | `NodeWrightApi`，命令式编辑器 API；每个方法作为一个状态批次执行                                |
| `getSnapshot()`            | 返回不可变的 `NodeWrightViewSnapshot`；状态未变化时返回同一个对象                              |
| `subscribe(listener)`      | 每个可能产生新快照的状态批次之后通知一次，返回取消函数                                         |
| `update(options)`          | 传入完整的选项对象；只有引用变化的字段生效                                                     |
| `mount(host)`              | 把输入监听、尺寸观察和 Canvas 绘制绑定到宿主元素；已挂载时再次调用会抛错                       |
| `unmount()`                | 从宿主元素解绑，之后可以再次 `mount`                                                           |
| `destroy()`                | 解绑并释放控制器（以及它创建的内部 Store）；之后调用 `update`/`mount` 会抛错，重复调用无副作用 |
| `selectAccessibleNode(id)` | 供 Canvas-only 节点的可访问按钮调用，选中该节点                                                |
| `hidePerformanceOverlay()` | 关闭性能浮层（`performance.overlayDismissible` 为 `true` 时显示关闭按钮）                      |
| `mountMinimap(host)`       | 把小地图的绘制与输入绑定到适配层渲染的小地图元素，返回解绑函数；见[小地图](#小地图)            |

`NodeWrightEditorHost` 是适配层渲染并交给 `mount` 的三个元素：

| 字段         | 元素                                                        |
| ------------ | ----------------------------------------------------------- |
| `root`       | 可聚焦的根元素，接收键盘与滚轮输入                          |
| `canvas`     | 可交互的 Canvas，绘制连线、分组与 Canvas 节点，接收指针输入 |
| `gridCanvas` | 位于 `canvas` 之下、不可交互的网格 Canvas                   |

`NodeWrightMinimapHost` 是适配层为 `snapshot.minimap` 渲染并交给 `mountMinimap` 的两个元素：`root`（可聚焦的小地图容器 `nw-minimap`，接收指针、滚轮与键盘输入）与 `canvas`（`nw-minimap__canvas`，控制器在其上绘制分组与节点）。

控制器创建、`update` 与 `getSnapshot` 都不访问 DOM，可以在服务端渲染时调用；只有 `mount` 需要真实元素。

### 不借助 UI 框架接入

下面的示例只使用 Canvas 节点（`dom: false`），因此不需要渲染 DOM 节点层：

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import {
  createEditorController,
  type NodeWrightStyleDeclaration,
  type NodeWrightViewSnapshot,
} from '@node-wright/core/view'
import '@node-wright/core/view/style.css'

function applyStyle(element: HTMLElement, style: NodeWrightStyleDeclaration): void {
  for (const [key, value] of Object.entries(style)) {
    const property = key.startsWith('--')
      ? key
      : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

    element.style.setProperty(property, String(value))
  }
}

export function mountCanvasEditor(container: HTMLElement, graph: GraphSnapshot): () => void {
  const root = document.createElement('div')
  const gridCanvas = document.createElement('canvas')
  const canvas = document.createElement('canvas')

  root.className = 'nw-root'
  root.tabIndex = 0
  root.setAttribute('role', 'application')
  root.setAttribute('aria-label', 'Node graph editor')
  gridCanvas.className = 'nw-grid-surface'
  canvas.className = 'nw-canvas-surface'
  root.append(gridCanvas, canvas)
  container.append(root)

  const controller = createEditorController({
    graph,
    nodeTypes: Object.fromEntries(graph.nodes.map((node) => [node.type, { dom: false }])),
    onEvent(name, ...args) {
      if (name === 'graph-change') {
        console.log('graph changed', args[0])
      }
    },
  })

  function render(view: NodeWrightViewSnapshot): void {
    applyStyle(root, view.rootStyle)
    gridCanvas.style.display = view.gridState.visible ? '' : 'none'
    canvas.style.cursor = view.canvasCursor
  }

  render(controller.getSnapshot())
  const unsubscribe = controller.subscribe(() => render(controller.getSnapshot()))
  controller.mount({ root, canvas, gridCanvas })
  controller.api.view.fit.graph(72)

  return () => {
    unsubscribe()
    controller.destroy()
    root.remove()
  }
}
```

完整的适配层还需要渲染 DOM 节点层、可访问节点列表、框选框、性能浮层和小地图，见[编写新的 UI 适配层](#编写新的-ui-适配层)。

## 编辑器选项

`NodeWrightEditorOptions` 是控制器的完整配置，也就是 Vue / React `NodeWright` 组件的 props（适配层额外增加 `ariaLabel`、`domComponents` 等渲染相关 props，见各自文档）。对象与数组按引用比较。

### 图与注册表

| 选项                  | 类型                          | 默认               | 说明                                                                                                     |
| --------------------- | ----------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `graph`               | `GraphSnapshot`               | 空图               | 当前图。新的对象会 `replaceGraph` 并清空历史；与控制器刚发出的 `graph-change` 是同一对象时视为回声，忽略 |
| `store`               | `GraphStore`                  | 内部创建           | 外部 Store。它持有图与全部注册表，编辑器不会释放它；分层规则见下文                                       |
| `nodeDefinitions`     | `NodeDefinition[]`            | `[]`               | 节点协议定义（端口、参数 schema、默认数据）                                                              |
| `edgeDefinitions`     | `EdgeDefinition[]`            | `[]`               | 边定义                                                                                                   |
| `commands`            | `GraphCommandRegistryEntry[]` | `[]`               | 额外命令，可通过 `api.commands.dispatch` 调用                                                            |
| `plugins`             | `NodeWrightPlugin[]`          | `[]`               | 插件：`contributes` 注册到 Store，`components` 贡献编辑器扩展                                            |
| `connectionValidator` | `ConnectionValidator`         | -                  | 额外的交互连接校验                                                                                       |
| `initialViewport`     | `Partial<ViewportState>`      | `{x:0,y:0,zoom:1}` | 只在创建时读取                                                                                           |
| `initialSelection`    | `Partial<SelectionState>`     | 空选区             | 只在创建时读取                                                                                           |

`nodeDefinitions`、`edgeDefinitions`、`commands`、`plugins`、`connectionValidator` 任一引用变化时（且未传 `store`），控制器以当前图重建内部 Store，撤销历史随之清空。

Store 层与编辑器层严格分层：`graph`、`nodeDefinitions`、`edgeDefinitions`、`commands`、`connectionValidator` 属于 Store。未传 `store` 时控制器用它们创建并持有内部 Store；传入 `store` 时图与注册表完全由该 Store 持有，同时传入上述任一选项会在创建或 `update()` 时直接抛错（错误信息列出冲突的选项），而不是静默忽略，应改为传给 `createGraphStore()`。插件同理：编辑器只读取插件的 `components`；带 `contributes` 或 `setup` 的插件必须已注册在该 Store 中（`store.hasPlugin(name)`），否则抛错。从外部 Store 切回内部 Store 时，新的内部 Store 以 `graph` 选项（未给出时为当前图）创建，外部 Store 的图不会被改写。

### 渲染扩展

| 选项               | 类型                                    | 说明                                                                     |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------ |
| `nodeTypes`        | `NodeTypeRegistry`                      | 按节点 `type` 配置尺寸、端口、DOM / Canvas 渲染与节点编辑器              |
| `nodeEditors`      | `NodeWrightNodeEditorRegistry`          | 按节点 `type` 配置内联参数编辑器                                         |
| `edgeTypes`        | `EdgeTypeRegistry`                      | 按边 `type` 配置颜色、线宽与 Canvas 渲染                                 |
| `renderers`        | `Partial<NodeWrightCanvasRenderers>`    | 全局覆盖默认 Canvas 渲染器（`node`、`edge`、`group`）                    |
| `groupRenderers`   | `NodeWrightGroupRendererContribution[]` | 按 `match` / `order` 选择分组渲染器                                      |
| `edgeRenderers`    | `NodeWrightEdgeRendererContribution[]`  | 按 `type` / `match` / `order` 选择连线渲染器                             |
| `toolbarItems`     | `NodeWrightToolbarItem[]`               | 工具栏条目，由 `api.menu.resolve.toolbar()` 解析                         |
| `contextMenuItems` | `NodeWrightContextMenuItem[]`           | 右键菜单条目                                                             |
| `hotkeys`          | `NodeWrightHotkey[]`                    | 快捷键，优先级高于内置快捷键                                             |
| `resolvePortValue` | `NodeWrightResolvePortValueHook`        | 参数字段被连线驱动时解析上游值，见 [resolvePortValue](#resolveportvalue) |

直接选项优先于插件 `components` 中的同名贡献；同一 id 的后注册条目替换先注册的条目。

### 外观与交互

| 选项                | 类型                                    | 默认     | 说明                                                             |
| ------------------- | --------------------------------------- | -------- | ---------------------------------------------------------------- |
| `theme`             | `Partial<NodeWrightTheme>`              | 深色主题 | 内置调色板（`colorScheme`）与逐项颜色覆盖，见[主题](#主题)       |
| `nodeStatus`        | `Record<string, NodeWrightNodeStatus>`  | `{}`     | 节点执行状态，见[节点状态](#节点状态)                            |
| `behaviors`         | `Partial<NodeWrightBehaviors>`          | 见下表   | 框选、连线右键、分组、网格、节点编辑器行为                       |
| `performance`       | `Partial<NodeWrightPerformanceOptions>` | 关闭     | 性能采样与浮层                                                   |
| `canvasBackground`  | `string`                                | 调色板   | 画布背景，优先于 `theme.background`                              |
| `readonly`          | `boolean`                               | `false`  | 只读：禁止编辑交互与写快捷键                                     |
| `gridVisible`       | `boolean`                               | `true`   | 网格可见性；也可用 `api.view.grid.*` 切换                        |
| `gridColor`         | `string`                                | 主题色   | 次网格颜色                                                       |
| `gridSize`          | `number`                                | `24`     | 网格基础步长，也用于吸附                                         |
| `snapToGrid`        | `boolean`                               | `false`  | 拖动与缩放吸附到网格                                             |
| `minZoom`           | `number`                                | `0.2`    | 最小缩放                                                         |
| `maxZoom`           | `number`                                | `2.5`    | 最大缩放                                                         |
| `connectionPreview` | `boolean`                               | `true`   | 拖线时绘制预览线                                                 |
| `wheelBehavior`     | `'zoom' \| 'pan' \| 'mixed'`            | `'zoom'` | 滚轮缩放 / 平移 / 默认缩放且按住 Shift 平移                      |
| `wheelInertia`      | `boolean`                               | `true`   | 滚轮惯性                                                         |
| `minimap`           | `boolean \| NodeWrightMinimapOptions`   | `false`  | 小地图：`true` 使用默认尺寸，或传入尺寸选项，见[小地图](#小地图) |

`behaviors` 的字段与默认值：

| 字段                                      | 默认                                           | 说明                                                                |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `marquee.gestures`                        | `['space-left', 'middle']`                     | 可选 `'space-left'`、`'middle'`、`'shift-left'`                     |
| `marquee.selectionMode`                   | `'replace'`                                    | `'replace'` / `'add'` / `'subtract'`                                |
| `edge.rightClickAction`                   | `'disconnect'`                                 | 右键连线：`'disconnect'` / `'context-menu'` / `'select'` / `'none'` |
| `group.dragHandle`                        | `'header'`                                     | 拖动分组的区域：`'header'` / `'body'`                               |
| `group.headerHeight`                      | `40`（最小 20）                                | 分组标题栏高度                                                      |
| `group.moveNodesOnDrag`                   | `true`                                         | 拖动分组时同时移动成员节点                                          |
| `group.resizable`                         | `true`                                         | 允许拖动调整分组尺寸                                                |
| `group.minWidth` / `group.minHeight`      | `180` / `120`                                  | 分组最小尺寸                                                        |
| `group.showCloseButton`                   | `true`                                         | 分组标题栏的删除按钮                                                |
| `group.showCollapseButton`                | `true`                                         | 分组标题栏的折叠按钮                                                |
| `grid.adaptive`                           | `true`                                         | 随缩放自适应网格步长                                                |
| `grid.minPixelStep` / `grid.maxPixelStep` | `16` / `48`                                    | 自适应网格的屏幕像素范围                                            |
| `grid.majorEvery`                         | `4`                                            | 每几格绘制一条主网格线（点阵为一个强调点）                          |
| `grid.style`                              | `'dot'`                                        | `'dot'`（低对比点阵）/ `'line'` / `'dash'`                          |
| `editor.enabled`                          | `true`                                         | 是否启用内联节点编辑器状态                                          |
| `editor.defaultActivateOn`                | `'selected'`                                   | `'selected'` / `'double-click'` / `'manual'`                        |
| `editor.defaultInset`                     | `{ top: 78, right: 14, bottom: 14, left: 14 }` | 编辑器相对节点的内边距                                              |
| `editor.defaultMaxFields`                 | `6`                                            | 最多显示的字段数                                                    |

`performance` 的字段：`enabled`（采样并发出 `performance-sample`，默认 `false`）、`overlay`（显示浮层，默认 `false`）、`overlayMinWidth`（根元素窄于该宽度时隐藏浮层）、`overlayDismissible`（显示关闭按钮）、`sampleWindow`（平均帧数，默认 `30`）、`cullPadding`（可见性裁剪的屏幕外余量，默认 `240` 像素）。

#### 节点状态

`nodeStatus` 按节点 id 给出执行状态 `NodeWrightNodeStatus`（`'idle' | 'running' | 'paused' | 'success' | 'error' | 'cancelled'`，与 Runtime 的节点状态同值），没有条目的节点视为 `'idle'`。它只是视图状态，不进入图与撤销历史。DOM 节点渲染上下文收到对应的 `status`；默认 DOM 节点据此加上 `nw-default-dom-node--<status>` 类（运行中的节点边框轻微脉动，失败的节点使用危险色边框）并在标题栏右侧显示状态角标，`prefers-reduced-motion` 下不播放动画。从一次运行结果生成：

```ts
const nodeStatus = Object.fromEntries(
  Object.values(result.nodeStates)
    .filter((state) => state.status !== 'idle')
    .map((state) => [state.nodeId, state.status]),
)
```

#### 小地图

`minimap: true` 显示默认尺寸（200 × 136）的小地图，也可以传入 `NodeWrightMinimapOptions`：

| 字段      | 默认  | 说明                                 |
| --------- | ----- | ------------------------------------ |
| `width`   | `200` | 宽度（CSS 像素）                     |
| `height`  | `136` | 高度（CSS 像素）                     |
| `padding` | `8`   | 内容与小地图边缘的间距（小地图像素） |

非正数或非有限的尺寸回退为默认值。小地图显示的范围是图内容（节点按解析后的尺寸，加上分组）与当前可见区域的并集，等比缩放后居中；空图时只显示可见区域。Canvas 背景透明（容器背景由样式表提供），分组以半透明的 `group.color`（未设置时为 `theme.groupBorderColor`）填充，节点以强调色（节点 `meta.accent`，其次节点类型的 `accent`）或 `theme.minimapNodeColor` 填充，选中节点使用 `theme.selectionColor`；不绘制连线。超过 1500 个节点时节点画成直角矩形。

交互与画布平移一致：

- 在可见区域框外按下时，视口中心先跳到按下处；按住拖动时视口随指针平移，在框内按下则保持指针与框中心的偏移。拖动过程只更新视口预览（`interaction.viewportSource` 为 `'minimap'`，DOM 节点层进入合成），松开时提交一次，事件依次为 `viewport-interaction-start`、若干 `viewport-interaction`、一次 `viewport-change`（`source` 为 `'minimap'`）与 `viewport-interaction-end`。拖动期间小地图保持开始时的缩放比例，滚轮输入被忽略。
- 小地图获得焦点时，方向键按可见区域的 10% 平移视口（按住 Shift 为 40%），`viewport-change` 的 `source` 为 `'minimap.keyboard'`。
- 小地图上的 `pointerdown`、`pointermove` 与方向键不会冒泡到画布，滚轮既不缩放画布也不滚动页面。

小地图的矩形只在图、节点定义或节点类型变化后重建，拖拽与缩放的实时预览在提交后才反映到小地图；绘制在动画帧中合并，只有矩形、缩放比例、选区、主题颜色、尺寸或设备像素比变化时才重绘。在内容范围内平移视口只移动可见区域框，不重绘小地图。选项关闭时不做任何计算。

### 导入导出钩子

| 选项               | 签名                                        | 说明                                                                    |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| `serializeGraph`   | `(graph) => GraphSnapshot`                  | `api.graph.export()` 返回前转换                                         |
| `deserializeGraph` | `(input: unknown) => unknown`               | `api.graph.import()` 解析前转换外部输入                                 |
| `beforeImport`     | `(graph) => GraphSnapshot \| false \| void` | 解析成功后拦截：返回 `false` 取消导入，返回新图则替换（会再次严格解析） |
| `afterImport`      | `(graph) => void`                           | 导入完成后调用                                                          |
| `onEvent`          | `NodeWrightEventListener`                   | 接收全部编辑器事件；适配层用它转发为框架事件，见[事件](#事件)           |

## 视图快照

`NodeWrightViewSnapshot` 是适配层渲染所需的全部状态：

| 字段              | 说明                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `graph`           | 当前已提交的图                                                                                             |
| `selection`       | 当前选区                                                                                                   |
| `readonly`        | 是否只读                                                                                                   |
| `colorScheme`     | 当前调色板 `'dark'` / `'light'`（来自 `theme.colorScheme`），适配层渲染为根元素的 `data-color-scheme`      |
| `gridState`       | 网格完整状态：`visible`、步长、像素步长、主网格间隔、样式                                                  |
| `interaction`     | `NodeWrightInteractionState`：模式、拖拽/缩放中的 id、视口、`dragDelta`                                    |
| `nodeEditor`      | 当前内联节点编辑器状态或 `null`                                                                            |
| `contextMenu`     | 当前右键菜单状态或 `null`                                                                                  |
| `renderContext`   | `NodeWrightRenderContext`，与工具栏、菜单、快捷键回调收到的上下文相同                                      |
| `rootStyle`       | 根元素样式（CSS 自定义属性）                                                                               |
| `canvasCursor`    | 交互 Canvas 的光标                                                                                         |
| `domLayer`        | DOM 节点层：`composited`、层样式、`nodes`（`NodeWrightDomNodeEntry[]`）                                    |
| `accessibleNodes` | Canvas-only 节点的可访问替代项（`id`、`label`、`selected`）                                                |
| `marqueeStyle`    | 框选框的屏幕样式或 `null`                                                                                  |
| `performance`     | 性能浮层：`visible`、`dismissible`、`sample`                                                               |
| `minimap`         | 小地图状态 `NodeWrightMinimapState`（`style`、`viewportStyle`、`dragging`）；`minimap` 选项关闭时为 `null` |

`NodeWrightDomNodeEntry` 包含 `id`、`component`（DOM 节点组件键）、`props`（`NodeWrightDomNodeProps` 与渲染器 `props()` 的附加字段）、`className`、`style`。

## 事件

全部事件定义在 `NodeWrightEventMap`，控制器通过 `onEvent(name, ...args)` 发出。Vue 使用同名事件（图变化改名为 `update:graph`），React 使用 `on` + 驼峰名的回调 prop，参数完全相同。

`onEvent` 的类型 `NodeWrightEventListener` 为每个事件提供一个调用签名，因此监听器可以声明比事件更少的参数：`() => …`、`(name) => …`、`(name, payload) => …` 与 `(name, ...args) => …` 都可赋值，`name` 的类型是 `NodeWrightEventName`；`NodeWrightEventSink`（`<Event>(event, ...args: NodeWrightEventMap[Event]) => void`）是逐事件精确的发出端类型，适配层的转发函数用它声明，也可以直接作为 `onEvent`。

| 事件                                                                               | Vue             | React                                                                               | 参数                                                                                                                        |
| ---------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `mount`                                                                            | `mount`         | `onMount`                                                                           | `api: NodeWrightApi`（每次 `mount()` 挂载到宿主元素后，此时视口命令已能测量尺寸）                                           |
| `graph-change`                                                                     | `update:graph`  | `onGraphChange`                                                                     | `graph: GraphSnapshot`（每次 `graph:changed`）                                                                              |
| `command`                                                                          | `command`       | `onCommand`                                                                         | `event: GraphStoreEvent`（每个 Store 事件）                                                                                 |
| `command-error`                                                                    | `command-error` | `onCommandError`                                                                    | `NodeWrightCommandErrorEvent`（`api.commands.dispatch` 未应用时）                                                           |
| `connect`                                                                          | `connect`       | `onConnect`                                                                         | `{ edge }`（`edge.connect` 命令新建了一条边）                                                                               |
| `selection-change`                                                                 | 同名            | `onSelectionChange`                                                                 | `selection, graph, source?`                                                                                                 |
| `viewport-change`                                                                  | 同名            | `onViewportChange`                                                                  | `viewport, source?`                                                                                                         |
| `imported`                                                                         | 同名            | `onImported`                                                                        | `{ input, graph }`（`api.graph.import` 成功）                                                                               |
| `node-click`                                                                       | 同名            | `onNodeClick`                                                                       | `{ node, event: PointerEvent }`                                                                                             |
| `node-double-click`                                                                | 同名            | `onNodeDoubleClick`                                                                 | `{ node, event: PointerEvent }`                                                                                             |
| `node-drag-start` / `node-drag` / `node-drag-end`                                  | 同名            | `onNodeDragStart` / `onNodeDrag` / `onNodeDragEnd`                                  | `NodeWrightNodeDragEvent`：`nodeIds`、`nodes`、`delta`、`graph`、`liveGraph`、`viewport`、`interaction`                     |
| `node-resize-start` / `node-resize` / `node-resize-end`                            | 同名            | `onNodeResizeStart` / `onNodeResize` / `onNodeResizeEnd`                            | `NodeWrightNodeResizeEvent`：`nodeId`、`node`、`size`、`bounds`、`graph`、`liveGraph` 等                                    |
| `node-param-change`                                                                | 同名            | `onNodeParamChange`                                                                 | `{ nodeId, key, value, previousValue, node, graph }`                                                                        |
| `node-editor-open` / `node-editor-close`                                           | 同名            | `onNodeEditorOpen` / `onNodeEditorClose`                                            | `NodeWrightNodeEditorState`                                                                                                 |
| `edge-click`                                                                       | 同名            | `onEdgeClick`                                                                       | `{ edge, event: PointerEvent }`                                                                                             |
| `edge-right-click`                                                                 | 同名            | `onEdgeRightClick`                                                                  | `{ edge, event: MouseEvent, action, graph }`                                                                                |
| `edge-disconnect`                                                                  | 同名            | `onEdgeDisconnect`                                                                  | `{ edge, graph, reason }`（右键断开或 `api.edges.disconnect`）                                                              |
| `group-click`                                                                      | 同名            | `onGroupClick`                                                                      | `{ group, event, areaId?, areaKind? }`                                                                                      |
| `group-drag-start` / `group-drag` / `group-drag-end`                               | 同名            | `onGroupDragStart` / `onGroupDrag` / `onGroupDragEnd`                               | `NodeWrightGroupDragEvent`：`groupIds`、`groups`、`nodeIds`、`nodes`、`delta`、`graph`、`liveGraph` 等                      |
| `group-resize-start` / `group-resize` / `group-resize-end`                         | 同名            | `onGroupResizeStart` / `onGroupResize` / `onGroupResizeEnd`                         | `NodeWrightGroupResizeEvent`                                                                                                |
| `connection-start`                                                                 | 同名            | `onConnectionStart`                                                                 | `NodeWrightConnectStartEvent`：`source`、`sourceNode`、`sourcePort`、`originDirection`、`targetDirection`、`point`、`graph` |
| `connection-preview`                                                               | 同名            | `onConnectionPreview`                                                               | `NodeWrightConnectPreviewEvent`：`source`、`target?`、`validation?`、`point`、`graph`                                       |
| `connection-end`                                                                   | 同名            | `onConnectionEnd`                                                                   | `NodeWrightConnectEndEvent`：`source`、`target`、`edge?`、`validation`、`graph`                                             |
| `connection-cancel`                                                                | 同名            | `onConnectionCancel`                                                                | `NodeWrightConnectionCancelEvent`：起点端口、方向、`startPoint`、`point`、`screenPoint`、`dragDistance`                     |
| `connection-invalid`                                                               | 同名            | `onConnectionInvalid`                                                               | `{ source, target, validation, graph }`                                                                                     |
| `marquee-start` / `marquee` / `marquee-end`                                        | 同名            | `onMarqueeStart` / `onMarquee` / `onMarqueeEnd`                                     | `{ start, current, mode, graph }`                                                                                           |
| `viewport-interaction-start` / `viewport-interaction` / `viewport-interaction-end` | 同名            | `onViewportInteractionStart` / `onViewportInteraction` / `onViewportInteractionEnd` | `{ viewport, source, graph, interaction, liveGraph }`                                                                       |
| `context-menu-open`                                                                | 同名            | `onContextMenuOpen`                                                                 | `NodeWrightContextMenuState`                                                                                                |
| `context-menu-close`                                                               | 同名            | `onContextMenuClose`                                                                | `NodeWrightContextMenuState \| null`                                                                                        |
| `performance-sample`                                                               | 同名            | `onPerformanceSample`                                                               | `NodeWrightPerformanceSample`（`performance.enabled` 时）                                                                   |

`connection-cancel` 的 `source` 是拖拽起点端口，不一定是最终边的 `source`：从 input 端口拉出时 `originDirection` 为 `input`、`targetDirection` 为 `output`。业务可以据此实现“拖线到空白处创建节点”，见 [editor-integration.md](./editor-integration.md#拖线到空白处创建节点)。

## NodeWrightApi 全表

`controller.api`，也是 Vue 组件 ref 与 React `NodeWrightHandle` 的值。返回 `GraphSnapshot` 的写方法返回写入后的图快照。

### `runtime`

| 方法                          | 返回                                  | 说明                         |
| ----------------------------- | ------------------------------------- | ---------------------------- |
| `runtime.ids.create(prefix?)` | `string`                              | 生成当前 Store 中未占用的 id |
| `runtime.store.get()`         | `GraphStore`                          | 当前 Store                   |
| `runtime.performance.get()`   | `NodeWrightPerformanceSample \| null` | 最近一次性能采样             |

### `graph`

| 方法                  | 返回                    | 说明                                                                                                              |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `graph.get()`         | `GraphSnapshot`         | 已提交的图                                                                                                        |
| `graph.getLive()`     | `GraphSnapshot`         | 含拖拽/缩放预览的实时图                                                                                           |
| `graph.set(graph)`    | `GraphSnapshot`         | 替换整图并清空历史                                                                                                |
| `graph.apply(graph)`  | `GraphSnapshot`         | 把整图作为一条可撤销历史应用                                                                                      |
| `graph.export()`      | `GraphSnapshot`         | 当前图；配置 `serializeGraph` 时返回其转换结果                                                                    |
| `graph.import(input)` | `GraphSnapshot`         | `deserializeGraph` → `parseGraph` 严格解析 → `beforeImport` → 替换图并清空历史 → `afterImport` 与 `imported` 事件 |
| `graph.validate()`    | `GraphValidationResult` | 结构诊断 + 全部 provider 诊断                                                                                     |
| `graph.repair()`      | `GraphRepairResult`     | 机械修复并记录一条历史                                                                                            |

### `view`

| 方法                                | 返回                  | 说明                                                        |
| ----------------------------------- | --------------------- | ----------------------------------------------------------- |
| `view.get()`                        | `ViewportState`       | 已提交的视口                                                |
| `view.getLive()`                    | `ViewportState`       | 含平移/滚轮预览的实时视口                                   |
| `view.set(patch)`                   | `GraphSnapshot`       | 修改视口（发出 `viewport-change`）                          |
| `view.fit.graph(padding?)`          | `void`                | 适配全部节点与分组                                          |
| `view.fit.selection(padding?)`      | `void`                | 适配选区                                                    |
| `view.fit.nodes(nodeIds, padding?)` | `void`                | 适配指定节点                                                |
| `view.center.node(nodeId)`          | `void`                | 居中节点                                                    |
| `view.center.selection()`           | `void`                | 居中选区                                                    |
| `view.zoom.to(zoom)`                | `void`                | 以视口中心为锚点设置缩放比例（按 `minZoom`/`maxZoom` 截断） |
| `view.grid.setVisible(visible)`     | `void`                | 设置网格可见性                                              |
| `view.grid.toggle()`                | `void`                | 切换网格可见性                                              |
| `view.grid.state()`                 | `NodeWrightGridState` | 网格可见性与当前步长等完整状态                              |

`fit.*` 的 `padding` 是 `NodeWrightFitPadding`：一个数字表示四边相同的留白（默认 `64`），或 `{ top, right, bottom, left }`（`NodeWrightInsets`，缺省的边为 `0`）按边留白，内容在剩余区域内等比缩放并居中。画布上叠加了浮动面板时，按面板占据的边传入留白即可让内容避开面板：

```ts
api.view.fit.graph({ top: 80, right: 376, bottom: 48, left: 272 })
```

缩放的锚点按来源区分：`view.zoom.to()`（工具栏缩放按钮等程序化缩放）保持视口中心下的图坐标点不动，事件来源为 `zoom-to`；滚轮缩放保持指针下的图坐标点不动，来源为 `wheel.zoom`；`fit.*` 与 `center.*` 按内容边界重新计算平移。编辑器尚未挂载时视口尺寸为 0，`zoom.to()` 的锚点即屏幕原点。

### `coordinates`

| 方法                                        | 说明                      |
| ------------------------------------------- | ------------------------- |
| `coordinates.screenToGraph(point)`          | 根元素内坐标 → 图坐标     |
| `coordinates.clientToGraph(point)`          | 视口 client 坐标 → 图坐标 |
| `coordinates.graphToScreen(point)`          | 图坐标 → 根元素内坐标     |
| `coordinates.graphRectToScreenRect(bounds)` | 图矩形 → 屏幕矩形         |

### `selection`

| 方法                               | 返回             | 说明                                                                                   |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `selection.get()`                  | `SelectionState` | 当前选区                                                                               |
| `selection.set(patch)`             | `GraphSnapshot`  | 设置选区                                                                               |
| `selection.clear()`                | `GraphSnapshot`  | 清空                                                                                   |
| `selection.all()`                  | `GraphSnapshot`  | 选中全部节点和边                                                                       |
| `selection.nodes(nodeIds)`         | `GraphSnapshot`  | 只选中指定节点                                                                         |
| `selection.edges(edgeIds)`         | `GraphSnapshot`  | 只选中指定边                                                                           |
| `selection.rect(bounds, options?)` | `GraphSnapshot`  | 按图坐标矩形选择；`options.mode`（`replace`/`add`/`subtract`）、`options.includeEdges` |
| `selection.remove()`               | `GraphSnapshot`  | 在一个事务中删除选中的节点与边，并清空选区                                             |

### `history`

| 方法                | 返回            |
| ------------------- | --------------- |
| `history.canUndo()` | `boolean`       |
| `history.canRedo()` | `boolean`       |
| `history.undo()`    | `GraphSnapshot` |
| `history.redo()`    | `GraphSnapshot` |

### `nodes`

| 方法                                                | 返回                                | 说明                                                                                                               |
| --------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nodes.create(type, patch?)`                        | `GraphNode \| null`                 | 按类型创建；`type` 为空字符串时返回 `null`                                                                         |
| `nodes.add(node)`                                   | `GraphNode`                         | 新增节点，`id` 可省略；套用定义的尺寸、`dataDefaults`、`metaDefaults` 与参数默认值，并按位置加入所在分组（见下文） |
| `nodes.get(nodeId)`                                 | `GraphNode \| undefined`            | 已提交的节点                                                                                                       |
| `nodes.getLive(nodeId)`                             | `GraphNode \| undefined`            | 含预览的实时节点                                                                                                   |
| `nodes.update(nodeId, patch)`                       | `GraphSnapshot`                     | 更新节点；位置或尺寸变化时同步分组成员                                                                             |
| `nodes.move(nodeIds, delta)`                        | `GraphSnapshot`                     | 平移节点                                                                                                           |
| `nodes.remove(nodeId)`                              | `GraphSnapshot`                     | 删除节点及其连线                                                                                                   |
| `nodes.bounds(nodeId, space?)`                      | `NodeWrightBounds \| null`          | `space` 为 `'graph'`（默认）或 `'screen'`                                                                          |
| `nodes.params.update(nodeId, key, value, options?)` | `GraphSnapshot`                     | 修改一个参数（写入 `data.params`），发出 `node-param-change`                                                       |
| `nodes.params.set(nodeId, params, options?)`        | `GraphSnapshot`                     | 合并（或 `options.replace` 替换）全部参数；不发出 `node-param-change`                                              |
| `nodes.editor.open(nodeId)`                         | `boolean`                           | 打开内联节点编辑器；节点没有可编辑字段时返回 `false`                                                               |
| `nodes.editor.close()`                              | `void`                              | 关闭节点编辑器                                                                                                     |
| `nodes.editor.state()`                              | `NodeWrightNodeEditorState \| null` | 当前节点编辑器状态                                                                                                 |

`nodes.create` / `nodes.add` 产生的节点只写有值的字段，整张图始终能被 `parseGraph` 严格解析、通过 `validateGraph`。节点只保存自己的端口：给了 `ports` 时保存它们；有节点定义时，定义端口与参数输入端口都从定义解析，不写进节点（定义以后改了端口，已有节点跟着变）；没有节点定义、只有节点类型（`NodeTypeDefinition.ports`）的默认端口时才复制它们，因为协议层看不到节点类型。

### `edges`

| 方法                                      | 返回                         | 说明                                                                                             |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `edges.add(edge)`                         | `GraphEdge`                  | 直接新增边，不运行连接校验器（仍做协议结构校验），`id` 可省略                                    |
| `edges.get(edgeId)`                       | `GraphEdge \| undefined`     |                                                                                                  |
| `edges.update(edgeId, patch)`             | `GraphSnapshot`              |                                                                                                  |
| `edges.reconnect(edgeId, reconnect)`      | `ConnectionValidationResult` | 校验后重连一端                                                                                   |
| `edges.disconnect(edgeId, reason?)`       | `GraphSnapshot`              | 删除边并发出 `edge-disconnect`                                                                   |
| `edges.remove(edgeId)`                    | `GraphSnapshot`              | 只删除边，不发出 `edge-disconnect`                                                               |
| `edges.connect(source, target, options?)` | `ConnectionValidationResult` | 校验并连线；`options`：`edgeId`、`edgeType`、`data`（没给的不写进边）；边的 `kind` 取源端口 kind |
| `edges.validate(source, target)`          | `ConnectionValidationResult` | 只校验，不修改图                                                                                 |

### `groups`

| 方法                                     | 返回                       | 说明                                         |
| ---------------------------------------- | -------------------------- | -------------------------------------------- |
| `groups.add(group)`                      | `GraphGroup`               | `id` 可省略                                  |
| `groups.get(groupId)`                    | `GraphGroup \| undefined`  |                                              |
| `groups.getLive(groupId)`                | `GraphGroup \| undefined`  | 含预览的实时分组                             |
| `groups.update(groupId, patch)`          | `GraphSnapshot`            |                                              |
| `groups.move(groupIds, delta, options?)` | `GraphSnapshot`            | `options.moveNodes` 控制是否同时移动成员     |
| `groups.resize(groupId, size)`           | `GraphSnapshot`            | 受 `behaviors.group.minWidth/minHeight` 约束 |
| `groups.collapse(groupId)`               | `GraphSnapshot`            |                                              |
| `groups.expand(groupId)`                 | `GraphSnapshot`            |                                              |
| `groups.toggleCollapsed(groupId)`        | `GraphSnapshot`            |                                              |
| `groups.isCollapsed(groupId)`            | `boolean`                  |                                              |
| `groups.remove(groupId)`                 | `GraphSnapshot`            | 删除分组（成员节点保留）                     |
| `groups.list()`                          | `GraphGroup[]`             |                                              |
| `groups.bounds(groupId, space?)`         | `NodeWrightBounds \| null` |                                              |

### `ports`

| 方法                             | 返回                           | 说明                                 |
| -------------------------------- | ------------------------------ | ------------------------------------ |
| `ports.get(endpoint)`            | `GraphPort \| undefined`       | 解析端口（含定义端口与参数输入端口） |
| `ports.anchor(endpoint, space?)` | `NodeWrightPortAnchor \| null` | 端口锚点坐标、朝向与连接数           |

### `clipboard`

编辑器剪贴板保存在控制器内存中，不读写系统剪贴板。

| 方法                                     | 返回                          | 说明                                                                                    |
| ---------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `clipboard.copy()`                       | `NodeWrightClipboard \| null` | 复制选中节点、选中的边与两端都被选中的边、包含选中节点的分组；没有选中节点时返回 `null` |
| `clipboard.paste(position?, clipboard?)` | `GraphSnapshot \| null`       | 以新 id 粘贴（两端都被粘贴的边才保留）并选中粘贴结果；省略位置时偏移 `{ x: 48, y: 48 }` |
| `clipboard.duplicate(offset?)`           | `GraphSnapshot \| null`       | 复制并立即粘贴选区                                                                      |

### `commands`

| 方法                                     | 返回                                     | 说明                             |
| ---------------------------------------- | ---------------------------------------- | -------------------------------- |
| `commands.dispatch(commandId, payload?)` | `GraphCommandDispatchResult`             | 未应用时额外发出 `command-error` |
| `commands.get(commandId)`                | `GraphCommandRegistryEntry \| undefined` |                                  |
| `commands.list()`                        | `GraphCommandRegistryEntry[]`            |                                  |

### `definitions`

| 方法                          | 返回                          | 说明                          |
| ----------------------------- | ----------------------------- | ----------------------------- |
| `definitions.nodes.get(type)` | `NodeDefinition \| undefined` | 参数 schema 即其 `parameters` |
| `definitions.nodes.list()`    | `NodeDefinition[]`            |                               |
| `definitions.edges.get(type)` | `EdgeDefinition \| undefined` |                               |
| `definitions.edges.list()`    | `EdgeDefinition[]`            |                               |

### `diagnostics`

| 方法                 | 返回                | 说明                                               |
| -------------------- | ------------------- | -------------------------------------------------- |
| `diagnostics.list()` | `GraphDiagnostic[]` | 协议结构、语义 provider 与业务 provider 的整图诊断 |

### `transactions`

| 方法                                 | 返回            | 说明                                           |
| ------------------------------------ | --------------- | ---------------------------------------------- |
| `transactions.mutate(label, recipe)` | `GraphSnapshot` | 修改草稿，产生一条历史                         |
| `transactions.run(label, operation)` | `GraphSnapshot` | 同步原子作用域；失败整体回滚；不支持嵌套或异步 |

### `menu`

| 方法                                     | 返回                                  | 说明                                     |
| ---------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `menu.open(target, position)`            | `void`                                | 在屏幕坐标打开右键菜单                   |
| `menu.close()`                           | `void`                                |                                          |
| `menu.state()`                           | `NodeWrightContextMenuState \| null`  |                                          |
| `menu.resolve.toolbar()`                 | `NodeWrightResolvedToolbarItem[]`     | 已过滤 `visible`、计算 `disabled` 并排序 |
| `menu.resolve.context(target, position)` | `NodeWrightResolvedContextMenuItem[]` | 同上                                     |

### `interaction`

| 方法                  | 返回                         |
| --------------------- | ---------------------------- |
| `interaction.state()` | `NodeWrightInteractionState` |

## 内置交互与快捷键

| 操作                               | 行为                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| 左键拖动空白处                     | 平移画布；单击空白处清空选区                                                 |
| 滚轮                               | 按 `wheelBehavior` 缩放或平移；带 `ctrlKey` 的滚轮（触控板捏合）被拦截并忽略 |
| 按住 Space 拖动 / 中键拖动         | 框选（`behaviors.marquee.gestures`）                                         |
| 拖动节点 / 分组标题栏              | 移动；分组默认带动成员节点                                                   |
| 拖动默认 DOM 节点四角 / 分组右下角 | 调整尺寸                                                                     |
| 从端口拖出                         | 连线；松开在有效端口上创建边，否则发出 `connection-cancel`                   |
| 右键连线                           | 按 `behaviors.edge.rightClickAction` 处理（默认断开）                        |
| `Ctrl/Cmd + Z`                     | 撤销                                                                         |
| `Ctrl + Y`、`Ctrl/Cmd + Shift + Z` | 重做                                                                         |
| `Ctrl/Cmd + C` / `Ctrl/Cmd + V`    | 复制 / 粘贴（编辑器剪贴板）                                                  |
| `Delete` / `Backspace`             | 删除选区                                                                     |
| 点击 / 拖动小地图                  | 视口中心跳到点击处 / 随指针平移视口，松开时提交一次                          |
| 小地图获得焦点时按方向键           | 按可见区域的 10% 平移视口，按住 Shift 时为 40%                               |

内置快捷键的优先级低于 `hotkeys` 选项与插件贡献；只读模式下写操作类快捷键不生效。焦点在输入框、文本域或可编辑元素中时，按键归该元素所有。

## 渲染扩展类型

### `NodeTypeDefinition`

| 字段               | 说明                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `label`            | 显示名                                                                              |
| `accent`           | 强调色（CSS 颜色，十六进制时 Canvas 绘制可派生透明色），见下文                      |
| `width` / `height` | 默认尺寸（节点定义未给出时使用）                                                    |
| `ports`            | 默认端口（节点实例与节点定义未给出时使用）                                          |
| `dom`              | DOM 渲染器 `NodeWrightDomNodeRenderer`；`false` 表示只用 Canvas 渲染                |
| `canvas`           | Canvas 节点渲染器 `NodeWrightCanvasNodeRenderer`                                    |
| `editor`           | 内联节点编辑器 `NodeWrightNodeEditorDefinition`（`nodeEditors` 中同类型的配置优先） |

强调色标识节点的类别：默认 DOM 节点的标题栏色标与标题栏底色、Canvas 节点的强调色、小地图中的节点填充，以及无类型端口出发的连线颜色都使用它。节点自身的 `meta.accent` 优先于类型的 `accent`（`resolveNodeAccent(node, definition)`）；两者都没有时使用样式表的中性色。`@node-wright/presets` 的四类节点使用 `PRESET_NODE_ACCENTS`。

节点默认渲染为 DOM 节点；只有显式声明 `dom: false` 时才完全由 Canvas 绘制，此时控制器会生成可访问的替代按钮（`snapshot.accessibleNodes`）。

### Canvas 渲染器

| 接口                            | 方法                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| `NodeWrightCanvasNodeRenderer`  | `measure(ctx)`、`getPortLayout(ctx)`、`draw(ctx)`、`hitTestNode(ctx)` |
| `NodeWrightCanvasEdgeRenderer`  | `draw(ctx)`、`hitTest(ctx)`                                           |
| `NodeWrightCanvasGroupRenderer` | `draw(ctx)`、`hitTest(ctx)`、`hitAreaAt(ctx)`                         |

渲染上下文提供 `CanvasRenderingContext2D`、图坐标下的 `bounds`、`zoom`、端口锚点、主题色与 `NodeWrightRenderContext`。`EdgeTypeDefinition` 提供 `stroke`、`strokeWidth` 与 `canvas`；`edgeRenderers` / `groupRenderers` 贡献带 `id`、`order`、`match`（连线还可用 `type`）的渲染器。

### DOM 节点渲染器

`NodeTypeDefinition.dom` 的字段：

| 字段                  | 说明                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `component`           | DOM 节点组件键；省略时使用默认节点（`NODE_WRIGHT_DEFAULT_DOM_COMPONENT`）。适配层通过 `domComponents` 注册对应组件，未注册的键在渲染时抛错 |
| `mode`                | `'replace'`（默认，DOM 替代 Canvas 绘制）或 `'overlay'`（叠加在 Canvas 节点之上）                                                          |
| `defaults`            | `NodeWrightDomNodeDefinition` 或返回它的函数：标题、副标题、字段来源、字段 hint、布局                                                      |
| `visible`             | 返回 `false` 时不渲染 DOM 节点                                                                                                             |
| `pointerEvents`       | `'auto'` / `'none'` 或函数                                                                                                                 |
| `className` / `style` | 节点外层容器的类名与样式（值或函数）                                                                                                       |
| `services`            | 注入给组件的业务服务（数据访问、SDK 等），组件收到 `domServices`                                                                           |
| `actions`             | 注入给组件的 UI 动作（弹窗、选择器等），组件收到 `domActions`                                                                              |
| `props`               | 返回附加 props 的函数，合并进组件 props                                                                                                    |

`NodeWrightDomNodeDefinition`：

| 字段                 | 说明                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` / `subtitle` | 标题与副标题；标题优先级为节点 `data.title` → `title` → 节点 `meta.title` → 节点定义 `label` → 节点类型 `label` → `type`，副标题为节点 `data.subtitle` → `subtitle` |
| `fieldSource`        | 字段取值位置：`'auto'`（默认，先 `data.params` 再 `data`）、`'params'`、`'data'`、`'none'`                                                                          |
| `fields`             | 字段显示 hint（`NodeWrightDomFieldDefinition[]`），按 `key` 匹配参数                                                                                                |
| `maxVisibleFields`   | 最多显示的字段数                                                                                                                                                    |
| `layout`             | 标题栏高度、端口间距、字段行高、最小尺寸等                                                                                                                          |

默认 DOM 节点与[内联节点编辑器](#内联节点编辑器)遵循同一条规则：字段只来自 `NodeDefinition.parameters`，每个参数一个字段；没有参数 schema 时不会从 `node.data` / `data.params` 推断字段。`fields` 只是同名参数的显示 hint（`label`、`description`、`kind`、`order`、`highlighted`、`placeholder`、`min`/`max`/`step`，以及图片字段的 `aspectRatio`、`fit`、`downloadable`、`openable`、`emptyHint`），没有对应参数的 hint 被忽略；hint 不能声明选项，选项（值域）始终是参数自身的 `options`（`NodeParameterOption[]`，`domModel.fields[i].options`）。未给 hint 时：标签取参数 `label`，未声明时为参数 `key`；占位符与说明取参数 `ui.placeholder` / `ui.description`；字段类型 `NodeWrightDomFieldKind`（`'value' | 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'range' | 'time' | 'image'`）由参数 `kind` 推导（`boolean`、`number`、`select` 对应同名，`json`/`code` 为 `textarea`，其余为 `text`）。

参数默认只是本地字段。节点定义 `parameterInputs: true`，或参数上 `input: true` / `input: { portId }`，会生成参数输入端口；字段被上游连线驱动时显示上游值并禁用本地编辑，上游值不是数字时数字字段显示它的文字（比如 `resolvePortValue` 给出的上游端口名），解析不出上游值时为空。数字字段的 hint 给了 `step` 时，输入值按步长对齐（以 `min` 或 0 为起点）；没给 `step` 时接受任意数字，只按 `min` / `max` 截断，步进按钮与拖动按 1 调整。数字显示它本身的全部位数，只去掉二进制小数的误差（`0.1 + 0.2` 显示 `0.3`）。参数行输入端口默认在悬停或聚焦该行时显示，已连接时常显。

### DOM 节点组件契约

自定义 DOM 节点组件收到 `NodeWrightDomNodeProps`：

| Props                                  | 说明                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| `node`、`schema`、`definition`         | 节点实例、节点定义、节点类型定义                                     |
| `bounds`、`screenBounds`、`zoom`       | 图坐标与屏幕坐标边界、当前缩放                                       |
| `selected`、`dragging`、`readonly`     | 状态                                                                 |
| `status`                               | `nodeStatus` 中该节点的执行状态（可能为 `undefined`）                |
| `inputs`、`outputs`                    | 端口锚点                                                             |
| `connectionSource`、`connectionTarget` | 正在进行的连线的起点与悬停目标                                       |
| `theme`、`context`                     | 节点主题色与 `NodeWrightRenderContext`（含 `api`）                   |
| `domModel`                             | 解析好的展示模型：标题、端口（含连接状态）、字段（含驱动状态）、布局 |
| `domApi`                               | 节点操作接口，见下表                                                 |
| `domServices`、`domActions`            | 渲染器注入的服务与动作                                               |

`domModel.fields[i]` 的驱动状态：`value`（本地值）、`resolvedValue`（实际生效值，被驱动时为上游值）、`textValue` / `resolvedTextValue`（格式化文本）、`driven`、`driveSource`（`edgeId`、`source`、`target`、`sourcePort`）。

`domApi`（`NodeWrightDomNodeApi`）：

| 方法                                                                  | 说明                                        |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `getNode()`、`getSchema()`、`getDefinition()`                         | 读取节点、节点定义、节点类型定义            |
| `getBounds(space?)`、`getContext()`、`getModel()`                     | 边界、渲染上下文、展示模型                  |
| `focus()`                                                             | 聚焦编辑器根元素（使快捷键生效）            |
| `interaction.pointerDown(event)`                                      | 从节点内部开始选择 / 拖动手势               |
| `select(options?)`                                                    | 选中节点（`options.add` 追加）              |
| `center()`、`fit(padding?)`                                           | 居中或适配该节点                            |
| `update(patch)`、`remove()`                                           | 更新或删除节点                              |
| `editor.open()`、`editor.close()`                                     | 打开或关闭内联节点编辑器                    |
| `params.update(key, value, options?)`、`params.set(params, options?)` | 修改参数                                    |
| `ports.get(portId, space?)`                                           | 端口锚点                                    |
| `ports.startConnection(portId, event)`                                | 从端口开始连线                              |
| `ports.finishConnection(portId, event)`                               | 在端口上结束连线                            |
| `ports.previewConnection(portId \| null)`                             | 设置或清除悬停目标                          |
| `resize.get()`、`resize.getConstraints()`                             | 当前尺寸与最小尺寸                          |
| `resize.start(event, handle?)`                                        | 开始调整尺寸（`'nw'`/`'ne'`/`'sw'`/`'se'`） |

接收事件的方法要求传入原生 `PointerEvent`：手势会在 `event.currentTarget` 上捕获指针，并调用 `stopPropagation()` 阻止原生冒泡。`context`、`screenBounds`、`zoom`、`theme`、`inputs`/`outputs` 每个视口帧都会更新；`domModel` 与 `domApi` 在节点本身变化前保持引用不变。

### `resolvePortValue`

参数字段被连线驱动时，控制器调用 `resolvePortValue(context)` 解析上游端口当前值，`context` 包含 `graph`、`endpoint`（上游端口）、`port`、`node`、`schema`、`definition`、`api`。未提供时使用默认规则：依次读取 `port.data.value`、`port.data.valueKey` 指向的参数、`port.data.domFieldKey` / `fieldKey` / `key` / `port.name` / `port.id` 对应的参数，最后回退到 `node.data.params.value` 或 `node.data.value`。这让“数据源节点 → 参数字段”无需额外代码即可显示。

### 内联节点编辑器

`nodeEditors[type]` 或 `nodeTypes[type].editor` 配置 `NodeWrightNodeEditorDefinition`：`enabled`、`activateOn`（`'selected'` / `'double-click'` / `'manual'`）、`inset`、`maxFields`、`fields`。与默认 DOM 节点相同，可编辑字段恰好是节点定义的 `parameters`（按参数顺序，最多 `maxFields` 个），节点没有参数时 `nodes.editor.open()` 返回 `false`，不会从 `data.params` 的现有键推断。`fields` 是按 `key` 匹配参数的显示 hint（`label`、`type`、`placeholder`、`rows`、`step`、`min`、`max`、`visible`、`disabled`、`parse`），没有对应参数的 hint 被忽略。解析后的字段 `NodeWrightResolvedNodeEditorField` 带 `label`（hint → 参数 `label` → 参数 `key`）、`type`（hint → 由参数 `kind` 推导，规则同 DOM 字段）、`placeholder`（hint → 参数 `ui.placeholder`）、`options`（参数自身的 `options`）、`disabled` 与当前 `value`。控制器只维护编辑器状态（`snapshot.nodeEditor`、`node-editor-open/close` 事件），编辑器 UI 由应用在 overlay 中渲染并调用 `api.nodes.params.update` 写回。

### 工具栏、右键菜单与快捷键

| 类型                        | 字段                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `NodeWrightToolbarItem`     | `id`、`label`、`title`、`order`、`kind`（`'default'`/`'accent'`）、`visible(ctx)`、`disabled(ctx)`、`run(ctx, event?)`                   |
| `NodeWrightContextMenuItem` | `id`、`label`、`title`、`order`、`visible(ctx)`、`disabled(ctx)`、`run(ctx, event?)`；`ctx` 额外带 `position`、`graphPosition`、`target` |
| `NodeWrightHotkey`          | `id`、`key`、`priority`、`ctrl`、`meta`、`shift`、`alt`、`preventDefault`、`visible(ctx)`、`run(ctx, event)`                             |

回调收到的 `NodeWrightRenderContext` 包含 `graph`、`selection`、`viewport`、`readonly`、`api`、`history`（`canUndo`/`canRedo`）、`rootElement` 与坐标换算函数。右键菜单的 `target` 是 `{ kind: 'canvas' }`、`{ kind: 'node', node }`、`{ kind: 'edge', edge }` 或 `{ kind: 'group', group, areaId?, areaKind? }`。

### 插件 `components`

`NodeWrightPlugin` 继承协议的 `GraphPlugin`（`name`、`contributes`、`setup`），并增加 `components`：`nodeTypes`、`nodeEditors`、`edgeTypes`、`renderers`、`groupRenderers`、`edgeRenderers`、`toolbarItems`、`contextMenuItems`、`hotkeys`。`contributes` 注册到 Store，`components` 只在编辑器中生效。

### 主题

`theme.colorScheme`（`NodeWrightColorScheme`：`'dark'` 默认，或 `'light'`）选择内置调色板：Canvas 绘制的画布、网格、连线、分组、Canvas 节点与小地图颜色来自 TypeScript 中的调色板，DOM 部分（默认节点、字段控件、小地图容器、框选框）来自样式表中按根元素 `data-color-scheme` 切换的 CSS 自定义属性。两套调色板分别为深色与浅色界面设计，而不是互相反色；`resolveColorScheme(theme)` 返回生效的方案。

其余字段都是颜色字符串，逐项覆盖所选调色板：`background`、`gridColor`、`gridMajorColor`、`edgeColor`（无类型数据边）、`edgeActiveColor`、`execEdgeColor`（执行边与执行端口）、`draftEdgeColor`、`draftEdgeGlowColor`、`selectionColor`（选中与悬停连线的光晕）、`marqueeColor`、`marqueeBorderColor`、`groupBackground`、`groupBorderColor`、`groupLabelColor`、`minimapNodeColor`（没有强调色的节点在小地图中的颜色）、`nodeBackground`、`nodeBorderColor`、`nodeSelectedBorderColor`、`nodeShadowColor`、`nodeTitleColor`、`nodeSubtitleColor`、`nodeMetaColor`、`portFillColor`、`portStrokeColor`、`portLabelColor`、`portActiveColor`、`portActiveFillColor`、`portConnectedColor`、`portConnectedDotColor`。

连线绘制规则：数据边使用源端口数据类型的颜色（`PORT_DATA_TYPE_COLOR_PALETTE`，两套调色板下都保持至少 3:1 的对比度），其次是源节点的强调色，最后是 `edgeColor`；执行边使用 `execEdgeColor` 且更粗；选中的边与指针悬停的边下方绘制 `selectionColor` 光晕。带 `color` 的分组以该颜色描边、以其淡色填充主体。

## 样式

共享样式位于 `@node-wright/core/view/style.css`，所有类名以 `nw-` 开头。设计令牌是 `.nw-root` 上的 CSS 自定义属性：字体栈（`--nw-font-sans`、`--nw-font-mono`）、圆角（`--nw-radius-sm/md/lg`）、动效时长与缓动（`--nw-duration`、`--nw-ease`）、文字层级（`--nw-text`、`--nw-text-secondary`、`--nw-text-muted`）、节点与控件表面（`--nw-node-*`、`--nw-control-*`、`--nw-popover-*`）、浮层表面（`--nw-chrome-*`）以及选择色与语义色（`--nw-selection`、`--nw-success`、`--nw-warning`、`--nw-danger`）。深色值定义在 `.nw-root` 上，`[data-color-scheme='light']` 覆盖为浅色值；应用可以在自己的样式中覆盖任意令牌。默认节点读取 `--nw-node-accent`（由节点强调色内联设置），端口读取 `--nw-port-color`；端口状态是类名（`--exec`、`--connected`、`--active`、`--compatible`、`--incompatible`），由 `resolveDomPortDotClass`、`resolveDomFieldPortDotClass` 与 `resolveDomPortLabelClass` 给出。小地图位置可通过 `--nw-minimap-right` / `--nw-minimap-bottom` 调整（默认 16px）。动画与过渡在 `prefers-reduced-motion: reduce` 下关闭。Vue 与 React 适配层各自把它打包为 `@node-wright/vue/style.css` / `@node-wright/react/style.css`，使用适配层时导入适配层的样式即可。根元素 `.nw-root` 的宽高为 `100%`，需要父容器提供高度。

## 编写新的 UI 适配层

适配层需要：

1. 创建控制器（`createEditorController({ ...props, onEvent })`），把 `onEvent` 转换为框架事件。
2. 渲染根元素（`nw-root`，`tabindex="0"`、`role="application"`、`aria-label`、`data-color-scheme`（`colorScheme`），应用 `rootStyle`）、网格 Canvas（`nw-grid-surface`，`gridState.visible` 为 `false` 时隐藏）和交互 Canvas（`nw-canvas-surface`，应用 `canvasCursor`）。
3. 渲染 `domLayer`：层容器 `nw-dom-node-layer`（`composited` 时加 `nw-dom-node-layer--composited`，应用层样式），每个 entry 一个 `nw-dom-node` 容器（应用 `className`、`style`），按 `component` 键渲染组件；`NODE_WRIGHT_DEFAULT_DOM_COMPONENT` 对应默认节点，其余键查找注册表，缺失时抛错。
4. 渲染 `accessibleNodes`（按钮调用 `selectAccessibleNode`）、`marqueeStyle`（`nw-marquee`）与 `performance` 浮层（关闭按钮调用 `hidePerformanceOverlay`）。
5. `minimap` 不为 `null` 时，在根元素内、性能浮层之后、应用叠加内容之前渲染小地图：容器 `nw-minimap`（拖动时加 `nw-minimap--dragging`，应用 `style`，`role="group"`、`aria-label="Minimap"`、`tabindex="0"`），其中依次为 `nw-minimap__canvas` 画布（`aria-hidden="true"`）与 `viewportStyle` 不为 `null` 时的 `nw-minimap__viewport`（应用 `viewportStyle`）。元素渲染完成后调用 `mountMinimap({ root, canvas })`，元素移除前调用它返回的函数；`mountMinimap` 可以早于 `mount`，`destroy` 也会解绑小地图。
6. 在元素渲染完成后 `mount`；props 变化时把完整选项交给 `update`；卸载时 `destroy`。
7. 订阅 `subscribe` 并在通知后读取 `getSnapshot()` 重新渲染。
8. 默认 DOM 节点可以复用 `resolveDomNodeModel` 产出的 `domModel` 与 `createDomNodeControls` 交互状态机，只写模板。

`packages/core/test/view/adapter-contract.ts` 是框架无关的契约测试：为新适配层实现一个 driver（受控挂载 `NodeWright`，在 `act` 后等待渲染完成），即可运行与 Vue、React 相同的用例，覆盖渲染结构、ref API 与图变化事件次数、回声不清空历史、替换图清空历史、选择与拖拽、端口连线、各类字段编辑、指针捕获元素、控件事件不冒泡、`domComponents` 注册与缺失报错、调色板属性、节点强调色、副标题、状态角标与端口状态类、`mount` 事件、props 更新、小地图的渲染、点击平移与解绑，以及卸载后解绑。
