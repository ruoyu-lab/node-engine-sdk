# Layout API（`@node-wright/core/layout`）

`@node-wright/core/layout` 是可选的 headless 自动布局模块。它只依赖 `protocol`，输入 `GraphSnapshot`，输出节点与分组的位置 patch；不读 DOM、不修改 Store、不产生历史，也不负责动画或视口。

## 基础用法

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { applyGraphLayout, layoutGraph } from '@node-wright/core/layout'

export function autoLayout(graph: GraphSnapshot): GraphSnapshot {
  const layout = layoutGraph(graph, { direction: 'LR', rankSpacing: 320, nodeSpacing: 96 })

  return applyGraphLayout(graph, layout)
}
```

`layoutGraph` 不修改原图；可以只读取 `layout.nodes` 做预览，也可以用 `applyGraphLayout` 得到写回位置的新图。

## 选项

| 选项                  | 默认                          | 说明                                                           |
| --------------------- | ----------------------------- | -------------------------------------------------------------- |
| `direction`           | `'LR'`                        | 主方向：`'LR'`、`'RL'`、`'TB'`、`'BT'`                         |
| `edgeKinds`           | 全部边                        | 只用这些 kind 的边计算层级；未设置 `kind` 的边按 `'data'` 处理 |
| `rankSpacing`         | `280`（最小 `40`）            | 层与层之间的距离                                               |
| `nodeSpacing`         | `96`（最小 `24`）             | 同层节点之间的间隔                                             |
| `origin`              | `{ x: 80, y: 80 }`            | 布局起点                                                       |
| `defaultNodeSize`     | `{ width: 240, height: 160 }` | 节点没有 `width` / `height` 时使用的尺寸                       |
| `groupPadding`        | `40`（最小 `0`）              | 分组包围成员节点的内边距                                       |
| `includeDisconnected` | `true`                        | 是否排布没有相关边的孤立节点                                   |

## 算法

1. 按 `edgeKinds` 过滤边，对参与布局的节点做拓扑分层：每个节点的层级为从源节点出发的最长路径长度；环上无法排序的节点放在第 0 层。
2. 同层节点按 id 排序，沿交叉轴依次排列，间隔为节点尺寸 + `nodeSpacing`。
3. 每个分组包围它在本次布局中有位置的成员节点（外扩 `groupPadding`）；没有成员参与布局的分组不出现在结果中。
4. `bounds` 是所有节点与分组 patch 的外接矩形。

时间复杂度为 O(V + E)（加上同层排序）。

## 类型

| 类型                    | 说明                           |
| ----------------------- | ------------------------------ |
| `GraphLayoutOptions`    | 上表的选项                     |
| `GraphLayoutDirection`  | `'LR' \| 'RL' \| 'TB' \| 'BT'` |
| `GraphLayoutResult`     | `{ nodes, groups, bounds }`    |
| `GraphNodeLayoutPatch`  | `{ id, x, y }`                 |
| `GraphGroupLayoutPatch` | `{ id, x, y, width, height }`  |
| `GraphLayoutBounds`     | `{ x, y, width, height }`      |

## 固定策略

```ts
import { createDagLayout } from '@node-wright/core/layout'

export const layoutExecFlow = createDagLayout({ direction: 'LR', edgeKinds: ['exec'] })
```

`createDagLayout(options)` 返回 `(graph) => GraphLayoutResult`，适合保存一份固定策略。每个 preset 的 `layout` 字段（`options`、`run(graph)`、`apply(graph)`）也是同样的封装，见 [presets-api.md](./presets-api.md#返回内容)。

## 写回编辑器

layout 只计算位置，何时写回、是否进入历史由编辑器层决定：

```ts
import { applyGraphLayout, layoutGraph } from '@node-wright/core/layout'
import type { NodeWrightApi } from '@node-wright/core/view'

export function layoutWithUndo(api: NodeWrightApi): void {
  const graph = api.graph.get()

  api.graph.apply(applyGraphLayout(graph, layoutGraph(graph, { edgeKinds: ['data', 'exec'] })))
  api.view.fit.graph(72)
}
```

- `api.graph.apply()` 写入一条可撤销历史；`api.graph.set()` 或替换受控 `graph` 会清空历史。
- layout 不读取 DOM 实际尺寸；需要精确尺寸时，先把节点尺寸写入 `GraphNode.width` / `height`（通过 `api.nodes.create` / `api.nodes.add` 创建的 DOM 节点会按字段内容写入初始尺寸）。
- layout 不校验端口规则，也不运行节点。
