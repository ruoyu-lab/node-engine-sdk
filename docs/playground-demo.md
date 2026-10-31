# Playground

playground 由一个完整的 AI 图片工作流与数据流、执行流、函数、子图 4 个原语场景组成，用来验证标准 preset 与业务自定义节点能否共同编辑、布局和执行。它只消费公开包入口，不承载可复用的框架能力。同一个应用分别用 Vue 与 React 实现：业务节点、场景注册表、运行编排、编辑器命令与样式只在 `playground-shared` 中写一份，两个应用只保留各自框架的应用壳与组件，新增场景只需登记到共享注册表。

## 目录与分层

| 目录                 | 内容                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `playground/`        | Vue 版应用（`@node-wright/vue`）                                           |
| `playground-react/`  | React 版应用（`@node-wright/react`）                                       |
| `playground-shared/` | 两个应用共用的框架无关代码、样式、Vite 配置片段、TypeScript 配置与单元测试 |

`playground-shared/` 内部：

| 路径                                 | 职责                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/business/ai-image/`             | AI 图片业务节点的完整参考实现：`definitions.ts`（协议定义与节点类型常量）、`handlers.ts`（Runtime handler，使用 `fetch` 并传递 `AbortSignal`）、`node-types.ts`（DOM 渲染配置与组件注册键 `AI_IMAGE_DISPLAY_DOM_COMPONENT`）、`result-summary.ts`（预览节点的结果徽标）                                                                                                   |
| `src/demo/`                          | `scenarios.ts`（场景注册表、AI 演示图与 preset 组合）、`primitives/`（4 个原语场景与共用的图构造函数 `graph.ts`）、`runtime.ts`（单次运行编排：创建 Runtime、编译计划、收集事件）、`runtime-labels.ts`（运行状态、事件、参数、运行结果与执行轨迹的显示文本）                                                                                                              |
| `src/app/`                           | 两个应用共用的编辑器命令（适配、缩放、重置、自动布局、撤销重做可用性）、主题（`canvas-themes.ts`）、浮动面板占据的画布区域（`canvas-insets.ts`）、初始面板状态（`shell-layout.ts`）、图标与快捷键数据、拖线建节点菜单、按场景命名的图文件导入导出、运行结果写回、节点状态与端口值解析，以及 Pages 站点中另一框架版本的链接（`companion-app.ts`，值由 Vite `define` 注入） |
| `src/styles/`                        | 两个应用共用的样式表，由 `index.css` 汇总：`tokens.css`（设计令牌）、`base.css`、`controls.css`（图标、按钮、提示）、各面板样式与 `app-shell.css`（布局）；两个应用渲染相同的类名                                                                                                                                                                                         |
| `config/workspace-aliases.ts`        | 两个应用的 Vite alias 与各自独立的依赖预构建缓存目录                                                                                                                                                                                                                                                                                                                      |
| `config/pages-site.ts`               | 按 `PAGES_BASE` 计算两个应用在 GitHub Pages 站点中的 Vite `base` 与互相切换的链接（未设置时各自部署在 `/`、不显示切换链接）                                                                                                                                                                                                                                               |
| `tsconfig.app.json`、`tsconfig.json` | 共用编译选项与 `paths`（两个应用的 tsconfig 继承 `tsconfig.app.json`）；`tsconfig.json` 额外覆盖 `config/` 与 `test/`                                                                                                                                                                                                                                                     |
| `test/`                              | Vitest 单元测试，运行在根 `vitest.config.ts` 的 `headless` project 中                                                                                                                                                                                                                                                                                                     |

两个应用的结构一一对应：

| Vue（`playground/`）                           | React（`playground-react/`）                   | 内容                                                             |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `src/bootstrap/main.ts`                        | `src/bootstrap/main.tsx`                       | 挂载应用并导入共用样式                                           |
| `src/app/App.vue`                              | `src/app/App.tsx`                              | 应用壳：全屏画布、浮动面板、拖线建节点菜单、`domComponents` 注册 |
| `src/components/DemoSidebar.vue`               | `src/components/DemoSidebar.tsx`               | 品牌与场景列表（可收起为侧轨）                                   |
| `src/components/EditorToolbar.vue`             | `src/components/EditorToolbar.tsx`             | 顶部工具条                                                       |
| `src/components/DemoRuntimePanel.vue`          | `src/components/DemoRuntimePanel.tsx`          | 运行面板：图统计、运行结果、执行轨迹、事件、选中节点与变量       |
| `src/components/ZoomControls.vue`              | `src/components/ZoomControls.tsx`              | 缩放控件                                                         |
| `src/components/StatusBar.vue`                 | `src/components/StatusBar.tsx`                 | 快捷键提示与性能浮层开关                                         |
| `src/components/PlaygroundIcon.vue`            | `src/components/PlaygroundIcon.tsx`            | 内联 SVG 图标（路径数据来自共享的 `icons.ts`）                   |
| `src/business/ai-image/AiImageDisplayNode.vue` | `src/business/ai-image/AiImageDisplayNode.tsx` | 图片预览节点组件：默认 DOM 节点加结果徽标                        |
| `config/vite.config.ts`                        | `config/vite.config.ts`                        | Vite 配置（共用 `playgroundAliases`）                            |

依赖方向是“应用 → `playground-shared` → `@node-wright/*` 公开入口”，由 `packages/presets/test/package-boundaries.test.ts` 检查：

- `playground-shared/src` 不导入 `vue`、`react`、`react-dom`、`@node-wright/vue` 或 `@node-wright/react`。
- `playground/src` 与 `playground-react/src` 不出现 AI 节点类型、`fetch` 调用或 `new NodeWrightRuntime`，业务节点与运行编排只有 `playground-shared` 中的一份。
- 三个目录都不从 `@node-wright/presets/nodes/*` 导入，标准节点只经 `@node-wright/presets` 根入口使用（原语场景需要的 `createFunctionCallPorts`、`createSubgraphCallPorts` 等端口生成函数也从根入口导入，执行端口 id 来自 `@node-wright/core/semantics`）。
- `packages/*/src` 中不出现 AI 与 HTTP（`fetch`）实现。

模块解析：`@playground/shared/*` 指向 `playground-shared/src/*`；`@node-wright/*` 的各个公开入口在开发与构建时都通过 Vite alias（`playground-shared/config/workspace-aliases.ts`）与 tsconfig `paths` 解析到各包的 TypeScript 源码，修改包源码即时生效，不需要先构建包。

## 运行

| 命令                       | 作用                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | 启动 Vue 版开发服务器（默认端口 5174）                                                                                                                                           |
| `npm run dev:react`        | 启动 React 版开发服务器（默认端口 5175）                                                                                                                                         |
| `npm run build:playground` | 先运行 `typecheck:playground`（`playground-shared` 用 `tsc`、`playground` 用 `vue-tsc`、`playground-react` 用 `tsc`），再分别构建到 `playground/dist` 与 `playground-react/dist` |
| `npm run preview`          | 预览 Vue 版构建产物（先运行 `build:playground`）                                                                                                                                 |
| `npm run preview:react`    | 预览 React 版构建产物                                                                                                                                                            |

`npm run build` 依次运行 `build:packages` 与 `build:playground`。

### 在线 Demo（GitHub Pages）

[在线 Demo](https://ruoyu-lab.github.io/node-wright/) 由 `.github/workflows/pages.yml` 在推送到 `main`（或手动触发）时构建部署：以 `PAGES_BASE=<站点根路径>/`（例如 `/node-wright/`）运行 `npm run build`，Vue 版产物放在站点根路径，React 版放在 `react/` 子目录。两个应用的 Vite 配置通过 `playground-shared/config/pages-site.ts` 从 `PAGES_BASE` 推导各自的 `base`，并在场景列表底部显示切换到另一个框架版本的链接；本地开发、构建与 E2E 不设置 `PAGES_BASE`，应用部署在 `/` 且没有切换链接。应用不使用前端路由，静态资源都由 Vite 按 `base` 输出，没有写死的绝对路径。

AI 图片场景在浏览器中直接请求公开的 Pollinations 图片接口（`https://image.pollinations.ai/prompt/...`），需要联网，不使用任何密钥；4 个原语场景完全在本地运行。

本地预览 Pages 产物：`PAGES_BASE=/node-wright/ npm run build:playground`，把 `playground/dist` 与 `playground-react/dist` 分别放到静态服务器的 `/node-wright/` 与 `/node-wright/react/` 下访问。

README 中的截图与动图由 `node scripts/capture-readme-assets.mjs` 从本地 Vue 版 playground 重新生成（需要 Playwright Chromium、`ffmpeg` 与访问 Pollinations 的网络）。

## 场景注册表

`src/demo/scenarios.ts` 导出场景注册表 `demoScenarios` 与 `getDemoScenario(id)`（未知 id 抛错）。场景 id 是字符串，两个应用的场景列表按注册表顺序列出全部场景，默认打开 `ai-image`：

| id         | 场景标题     | preset                     | 运行入口        | 运行结果（`outputs`）                        |
| ---------- | ------------ | -------------------------- | --------------- | -------------------------------------------- |
| `ai-image` | AI 图片生成  | dataflow preset + AI 节点  | `image-display` | 图片地址：预览节点收到的 `imageUrl`          |
| `dataflow` | 数据流管线   | `createDataflowPreset()`   | `df-preview`    | 预览：`["node-wright","42"]`                 |
| `execflow` | 审批发布流程 | `createExecflowPreset()`   | `exec-start`    | 发布日志：`测试版发布说明`；驳回日志：未执行 |
| `function` | 函数调用链   | `createHybridFlowPreset()` | `fn-preview`    | 预览：`你好，Node Wright！（15 字）`         |
| `subgraph` | 子图复用     | `createHybridFlowPreset()` | `sub-preview`   | 预览：`["《Node Wright》","《子图指南》"]`   |

每个场景（`DemoScenario`）提供：标题、小标题、所属节点类别的强调色 `accent` 与说明，`graph()`（每次调用返回一份新的演示图），`preset`，场景自身的 `runtimeDefinitions`、`functionDefinitions`、`subgraphDefinitions`、初始变量 `runtimeInitialVariables`，运行入口 `runtimeEventId`，以及 `outputs`：一组 `{ nodeId, portId, label }`，表示把哪个节点输入在运行后收到的值作为场景结果显示在面板的“运行结果”中。

## AI 图片场景

演示图由四个节点、三条 `data` 连线和一个分组（“AI 图片生成流水线”）组成：

| 节点 id          | 标题     | 类型                                                      | 作用                                                                                                                                                                                |
| ---------------- | -------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | 提示词   | `ai:prompt`（`AI_PROMPT_NODE_TYPE`）                      | `text` 参数以多行文本字段编辑，从 `prompt` 端口输出；内容为空时 handler 报错                                                                                                        |
| `image-generate` | 生成图片 | `ai:image-generate`（`AI_IMAGE_GENERATE_NODE_TYPE`）      | 必填输入 `prompt`；参数 `model`、`width`、`height`、`seed`，其中 `seed` 带参数输入端口；handler 调用 Pollinations.ai 图片服务，从 `imageUrl` 端口输出图片 URL（`cacheable: false`） |
| `seed-value`     | 固定种子 | `data:source`（`DATA_SOURCE_NODE_TYPE`，dataflow preset） | 输出 `12345`，接到生成节点的 `seed` 参数输入端口，连接后覆盖节点上的 `seed` 参数                                                                                                    |
| `image-display`  | 图片预览 | `ai:image-display`（`AI_IMAGE_DISPLAY_NODE_TYPE`）        | 必填输入 `imageUrl`；以 `image` 字段显示结果并提供下载与新标签打开；头部徽标显示“等待运行”或“宽 × 高 · 种子”                                                                        |

三条连线依次是 `prompt.prompt → image-generate.prompt`、`seed-value.value → image-generate.seed`、`image-generate.imageUrl → image-display.imageUrl`。

`model` 是 `select` 字段，选项来自参数定义 `parameters[].options`：`auto`（默认，免费，无需 API key）、`turbo` 与 `flux`（需要访问 token；服务返回 403 时错误信息会提示改回 `auto`）。`seed` 为 0 时 handler 使用随机种子。

场景的 preset 由 `createDataflowPreset()` 与业务节点组合而成：`nodeDefinitions`、`nodeTypes` 在标准 dataflow 基础上追加 `aiImageNodeDefinitions`、`aiImageNodeTypes`，场景的 `runtimeDefinitions` 在标准 Runtime definitions 后追加 `aiImageRuntimeDefinitions`，运行入口 `runtimeEventId` 为 `image-display`。

## 原语场景

4 个原语场景只使用 `@node-wright/presets` 的 15 个原语节点（共同覆盖全部 15 种），函数与子图由场景注册到它创建的 Runtime 中。所有连线都写 `kind`，演示图通过严格的 `parseGraph`，结构与语义诊断、`compileGraph` 诊断都为空；运行结果不依赖网络与随机数，每次运行都相同。图由 `primitives/graph.ts` 的 `primitiveNode`、`dataEdge`、`execEdge`、`groupOf`、`snapshotOf` 构造。

| 场景       | 节点                                                                                                                                                                                                                                                                 | 运行过程                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dataflow` | 数据源“名称”（`node-wright`）与“构建号”（`42`）、转换“转为字符串”（`operation: 'string'`）、合并、预览；4 条 `data` 连线、1 个分组                                                                                                                                   | 以预览节点为入口沿数据依赖反向求值：构建号转成字符串 `"42"` 后与名称合并为数组。执行轨迹 5 条                                                                                                                                                                      |
| `execflow` | 事件、顺序、延迟（`durationMs: 20`）、分支、两个日志、写入变量、三个读取变量；6 条 `exec` 连线、3 条 `data` 连线、1 个分组。初始变量 `run.draft = '测试版发布说明'`、`run.approved = true`                                                                           | 顺序节点先走 `then:0`：等待后把 `run.draft` 写入 `graph.notes`；再走 `then:1`：按 `run.approved` 分支，“发布日志”的 `message` 参数端口连着读取 `graph.notes` 的节点，因此记录刚写入的说明，“驳回日志”不执行。执行轨迹 9 条，运行结束后的变量面板显示 `graph.notes` |
| `function` | 数据源“名称”（`Node Wright`）、两个 `function:call`（“格式化问候”调用 `format-greeting`，“附加字数”调用 `append-length`）、预览；3 条 `data` 连线、1 个分组                                                                                                          | 调用节点的端口由 `createFunctionCallPorts(函数定义)` 生成，`functionId` 参数（“函数”字段）选择被调用的函数。执行轨迹 6 条，其中 2 条是函数调用                                                                                                                     |
| `subgraph` | 数据源“主标题”（`Node Wright`）与“副标题”（`子图指南`）、两个 `subgraph:call`（都调用 `title-pipeline`）、合并、预览；5 条 `data` 连线、1 个分组。注册子图 `title-pipeline` 内部为子图输入 → 转换（字符串）→ `function:call`（`decorate-title`，加书名号）→ 子图输出 | 两个调用节点复用同一个子图，每次调用在独立作用域中求值，内部再调用函数。执行轨迹 14 条，包含子图调用、子图内部节点与函数调用                                                                                                                                       |

调用节点没有可用的目标 id 时运行失败，面板显示错误，例如把“格式化问候”的“函数”字段清空后运行，错误为 `Function call node "fn-greet" requires a non-empty "functionId" parameter.`；改成未注册的 id 时为 `Function "<id>" does not have a runtime handler.`。

应用界面是铺满窗口的画布加浮动面板（玻璃质感、可收起，不遮挡画布主体）：

- 左上：品牌与场景列表，每个场景带所属节点类别的色标（`DemoScenario.accent`）。可收起为只显示色标的侧轨，场景名仍作为按钮的可访问名称与悬停提示。切换场景会以该场景的图重新挂载编辑器，清空上一次运行结果、节点状态、选区与菜单，缩放比例与撤销 / 重做按钮改读新编辑器的状态；再次点击当前场景等同于重置。Pages 站点中，列表底部有切换到另一框架版本的链接。
- 顶部居中：工具条（`role="toolbar"`、`aria-label="画布操作"`）：运行、自动布局、适配、重置、撤销 / 重做、导入 / 导出图 JSON（导出文件名为 `<场景 id>-workflow.json`，例如 `ai-image-workflow.json`；导入经 `graph.import` 按当前场景的定义严格校验，失败时面板显示“导入失败”）以及深浅主题切换。图标按钮的可访问名称在 `aria-label` 上，悬停或键盘聚焦时显示提示。
- 右侧：运行面板，可收起为只显示场景名与运行状态的标题栏。内容依次为场景说明、图统计（节点、连线、分组数）、运行结果（`listRunOutputs`：未运行时为“等待运行”，节点未执行时为“未执行”，节点失败时为运行状态，否则为收到的值，字符串原样显示、其余值显示为 JSON；标题旁的数字是已得到值的结果数）、执行轨迹（`listTraceRows`，按执行顺序显示为带状态色点的时间线；函数与子图调用显示为“函数调用 / 子图调用”）、运行事件（函数与子图事件显示函数或子图 id）、选中节点的定义与参数，以及运行状态与变量。
- 右下：编辑器的小地图（`minimap` 选项）与缩放控件（缩小 / 缩放比例 / 放大）。
- 左下：快捷键与手势提示（可展开收起）和性能浮层开关。
- 画布：选择、拖动、缩放、连线、重连、分组、复制粘贴、撤销重做与快捷键等能力来自编辑器本身。运行时，每个运行到的节点通过 `nodeStatus` 显示运行中、成功或失败的状态角标（`resolveRunNodeStatus`，运行过程中由 `runDemoScenario` 的 `onNodeStatus` 回调逐步更新）。
- 拖线建节点：从端口拖线并在空白处释放（拖动距离不小于 18 px）时弹出候选节点菜单。从输出端口拖出时提供下游节点（`prompt` → 生成图片，`imageUrl` → 图片预览，数据端口另外提供数据预览）；从输入端口拖出时提供上游节点（`prompt` → 提示词，`imageUrl` → 生成图片，数据端口另外提供数据源）。候选项只包含当前场景注册的节点类型，没有候选项时不弹出菜单（例如执行端口，或执行流场景中没有数据源与数据预览定义）。选择后创建节点、自动连线并选中新节点；若输入端已有唯一的上游连线，新建的上游节点会替换它；无法连接时删除新节点并显示校验原因。

适配、重置、自动布局与导入后都按浮动面板实际占据的区域适配视口：面板带 `data-canvas-inset` 属性，`measureCanvasArea` 测量它们并把每个面板计入占用画布面积最少的一边（右侧高面板压缩宽度，顶部短工具条压低顶部），结果作为 `api.view.fit.graph(padding)` 的按边留白；适配后的缩放低于 50% 时（手机上的宽图），视口以可用区域左边缘中点为锚点放大到 50%，保留图的开头、其余部分可平移查看。每个新挂载的编辑器在 `mount` 事件中完成同样的适配，因此 React 的 StrictMode 重新挂载也会得到适配后的视口。

主题：两个主题（`canvas-themes.ts`）分别选择编辑器的深色与浅色内置调色板（`theme.colorScheme`），应用外壳同时把 `data-theme` 写到 `.app-shell` 与 `<html>`，`tokens.css` 按它切换外壳的设计令牌（中性色阶、品牌色、5 类节点强调色、语义色、间距、圆角、阴影、字体栈与动效）。初始主题跟随 `prefers-color-scheme`，未声明时为深色。

布局随宽度降级：宽度小于 1100 px 时场景列表初始为侧轨、运行面板初始收起；760 px 及以下为手机布局：场景列表变为顶部横向滚动的场景条，工具条变为一行紧凑图标（480 px 以下运行按钮只显示图标），运行面板变为可展开的底部抽屉，小地图与快捷键提示隐藏，缩放控件在抽屉收起时显示在其上方。

## 运行流程

场景只提供定义与入口，preset 不创建 Runtime。`playground-shared/src/demo/runtime.ts` 的 `runDemoScenario` 按下面的方式执行（实际实现还传入函数、子图定义、初始变量、`summarizeValue`、`debug: { captureInputs: true }`（运行结果读取节点收到的输入）与 `onEvent` 收集事件，事件 id 按运行内的顺序编号）：

```ts
import type { GraphSnapshot } from '@node-wright/core/protocol'
import { NodeWrightRuntime, type NodeWrightRuntimeNodeDefinition } from '@node-wright/core/runtime'
import type { NodeWrightPreset } from '@node-wright/presets'

export async function runScenario(
  graph: GraphSnapshot,
  preset: NodeWrightPreset,
  runtimeDefinitions: NodeWrightRuntimeNodeDefinition[],
  entryNodeId: string,
) {
  const runtime = new NodeWrightRuntime({
    graph,
    definitions: preset.nodeDefinitions,
    runtimeDefinitions,
  })
  const compiled = runtime.compile(entryNodeId)

  if (!compiled.plan) {
    throw new Error(compiled.diagnostics[0]?.message ?? '图无法执行。')
  }

  return runtime.run(compiled.plan)
}
```

AI 场景以 `image-display` 节点为入口，Runtime 沿数据依赖向上游求值提示词、种子与图片生成节点；原语场景的入口见[场景注册表](#场景注册表)。运行结束后：

- `applyRunResultToGraph`（`src/app/run-result.ts`）把每个预览节点收到的 `imageUrl` 输入值写回它的 `params.imageUrl`，`image` 字段与徽标随之更新。
- `resolveDemoPortValue`（`src/app/port-values.ts`）作为编辑器的 `resolvePortValue`：已连接端口的字段优先显示上游节点最近一次运行的输出，其次是上游同名参数，最后是上游的 `value` 参数。两个应用在运行结果或场景变化时传入新的 hook（Vue 用 `computed`，React 用 `useCallback`），编辑器据此重新解析已连接字段，因此执行流场景中“发布日志”的消息字段在运行后显示读取到的变量值。

## 自动布局

`applyScenarioLayout`（`src/app/editor-commands.ts`）的做法：

```ts
import type { NodeWrightApi, NodeWrightFitPadding } from '@node-wright/core/view'
import type { NodeWrightPreset } from '@node-wright/presets'

export function applyLayout(
  api: NodeWrightApi,
  preset: NodeWrightPreset,
  padding: NodeWrightFitPadding,
): void {
  api.graph.apply(preset.layout.apply(api.graph.get()))
  api.view.fit.graph(padding)
}
```

布局函数不读 DOM、不修改视口，也不持有图状态；应用决定何时写回、是否进入历史以及何时适配视口。`graph.apply` 把布局结果作为一次可撤销的变更写回。

## 新增业务节点

以 AI 图片节点为模板，业务节点分布在共享层与两个应用中：

1. **协议定义**：在 `playground-shared/src/business/<领域>/definitions.ts` 中导出节点类型常量（`命名空间:名称`）与 `SemanticNodeDefinition[]`：端口、参数、`dataDefaults`、`capabilities`。`select` 字段的选项写在 `parameters[].options` 中，需要连线输入的参数通过 `input: { portId }` 声明参数输入端口。
2. **Runtime handler**：在 `handlers.ts` 中导出 `NodeWrightRuntimeNodeDefinition[]`。handler 从 `values` 读输入、从 `params` 读参数，网络请求传入 `signal`，有副作用的节点设置 `cacheable: false`。
3. **节点类型**：在 `node-types.ts` 中导出 `NodeTypeRegistry`。默认 DOM 节点用 `dom.defaults.fields` 描述字段（`key`、`label`、`kind` 及字段专属提示，不写选项）；需要自定义组件时设置 `dom.component` 为一个导出的注册键常量（如 `AI_IMAGE_DISPLAY_DOM_COMPONENT = 'ai-image.display'`）。
4. **导出与组合**：从领域目录的 `index.ts` 导出以上内容，在 `src/demo/scenarios.ts` 中把定义、节点类型与 Runtime definitions 合入场景，需要时在演示图中加入节点与连线（每条连线都写 `kind`，与源端口的 `kind` 一致），并在 `outputs` 中登记要显示的运行结果。新场景加入 `demoScenarios` 后两个应用自动列出。拖线建节点的候选项在 `src/app/connection-create-menu.ts` 中维护。
5. **框架组件**（只有自定义 DOM 组件需要）：分别实现 `playground/src/business/<领域>/Xxx.vue` 与 `playground-react/src/business/<领域>/Xxx.tsx`，两者都接收 `NodeWrightDomNodeProps`，可以包一层 `DefaultDomNode`；然后在 `App.vue` 与 `App.tsx` 的 `domComponents` 中以同一个注册键常量登记。两个组件之间共享的逻辑（例如 `summarizeAiImageResult`）放在 `playground-shared`，样式放在 `playground-shared/src/styles/` 并由 `index.css` 导入。
6. **测试**：在 `playground-shared/test/` 中补单元测试；涉及界面交互时在 `e2e/` 中补用例，选择器只依赖两个应用共同渲染的结构。

节点四层（协议、DOM 渲染、语义、Runtime）的通用写法见 [节点开发指南](./node-definition-guide.md)，`domComponents` 的组件契约见 [Vue 适配层](./vue-adapter.md#自定义-dom-节点) 与 [React 适配层](./react-adapter.md#domcomponents-契约)。

## 能力归属

| 能力                           | 包                                       |
| ------------------------------ | ---------------------------------------- |
| 图协议与严格解析               | `@node-wright/core/protocol`             |
| Store、命令、事务与历史        | `@node-wright/core/store`                |
| 编辑器控制器与 `NodeWrightApi` | `@node-wright/core/view`                 |
| 画布组件                       | `@node-wright/vue`、`@node-wright/react` |
| 端口语义                       | `@node-wright/core/semantics`            |
| 图执行                         | `@node-wright/core/runtime`              |
| 自动布局                       | `@node-wright/core/layout`               |
| 原语节点                       | `@node-wright/presets/nodes/*`           |
| 标准完整组合                   | `@node-wright/presets`                   |

AI 节点、`fetch` 调用与运行编排属于业务应用，只存在于 `playground-shared`。

## 自动化验证

### 单元测试

`npm run test` 会运行 `playground-shared/test/` 中的用例（`headless` project）：

- `scenario.test.ts`：注册表中的 5 个场景；每个场景的演示图与注册子图都能通过 `parseGraph` 严格解析且原样返回，结构与语义诊断、`compileGraph` 诊断为空，`outputs` 指向真实的输入端口；每个节点都有 DOM 渲染配置且预览节点使用 `AI_IMAGE_DISPLAY_DOM_COMPONENT`；图文件 JSON 往返与按场景命名；徽标、运行文本、运行结果、执行轨迹等展示辅助函数；主题切换与跟随系统的初始主题；场景强调色。
- `shell.test.ts`：浮动面板计入画布边距的规则、手机上的可读缩放下限、初始面板状态、运行结果到节点状态的映射、图标与快捷键数据。
- `runtime.test.ts`：在替换 `fetch` 的情况下完整运行 AI 工作流（含运行中逐步上报的节点状态）并写回预览节点、图片请求失败时运行失败、已连接端口优先显示运行输出；4 个原语场景各运行两次，断言运行结果、执行轨迹、事件数量与 id 唯一、运行后的变量；函数与子图事件的显示文本；调用节点缺少或使用未注册的函数 id 时运行失败并显示错误。
- `connection-create-menu.test.ts`：菜单只在真实拖动后打开、候选项只包含当前场景注册的节点类型且数据节点只提供给数据端口、建节点连线与替换唯一上游连线。

### 浏览器 E2E

```bash
npx playwright install chromium firefox webkit   # 首次运行前安装浏览器
npm run test:e2e
npx playwright test --project=react-desktop-chromium   # 只运行一个 project
```

`e2e/` 中的用例由两个应用共用：两个应用渲染相同的场景与结构，`e2e/support/playground.ts` 中的选择器不区分应用。`playwright.config.ts` 用 2 个应用 × 5 种目标生成 10 个 project，命名为 `<应用>-<目标>`：

| 目标               | 浏览器配置                                     | 视口     | 布局      |
| ------------------ | ---------------------------------------------- | -------- | --------- |
| `desktop-chromium` | `Desktop Chrome`                               | 1440×900 | `desktop` |
| `compact-chromium` | `Desktop Chrome`                               | 800×900  | `compact` |
| `mobile-chromium`  | `Desktop Chrome`（只缩小视口，不模拟触控设备） | 390×844  | `mobile`  |
| `desktop-firefox`  | `Desktop Firefox`                              | 1440×900 | `desktop` |
| `desktop-webkit`   | `Desktop Safari`                               | 1440×900 | `desktop` |

即 `vue-desktop-chromium`、`vue-compact-chromium`、`vue-mobile-chromium`、`vue-desktop-firefox`、`vue-desktop-webkit` 与对应的五个 `react-*` project。Playwright 自动启动两个开发服务器：Vue 版 `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`，React 版 `npm run dev:react -- --host 127.0.0.1 --port 4174 --strictPort`；本地会复用已在这两个端口运行的服务器，CI 中不复用，并且失败重试 2 次、禁止 `test.only`。

- `playground.spec.ts`（6 个用例）：标准 preset 在各视口可用（四个节点、自动布局、适配、重置后的统计）；用确定性响应替换 `https://image.pollinations.ai/**` 后完整运行工作流（运行成功、执行轨迹与事件各 4 条、运行结果为图片地址、四个节点的成功角标、图片与徽标“1024 × 1024 · 种子 12345”，重置后清空运行与角标）；工具条切换深浅主题（外壳 `data-theme`、编辑器 `data-color-scheme`、`--nw-background` 与节点底色）；按系统偏好选择初始主题；缩放控件、图 JSON 导出与导入往返，以及无效 JSON 的导入错误；快捷键提示的展开收起与性能浮层开关（手机布局跳过）。
- `primitive-scenarios.spec.ts`（5 个用例）：从场景列表切换到 4 个原语场景，各自检查图统计、运行前的“等待运行”、适配后可见的节点，运行后断言运行状态、运行结果文本、结果数与执行轨迹条数（执行流场景另外检查“发布日志”连着读取变量节点的消息字段在运行前为空、运行后显示读取到的值）；另一个用例确认切换场景会清空上一次运行，撤销按钮与缩放比例改读新编辑器（切回同一场景时回到相同的适配缩放），切回 AI 场景后重新显示四个节点。
- `editor-interactions.spec.ts`（6 个用例）：拖动节点并保持选中、撤销重做拖动、背景平移与滚轮缩放、编辑参数字段、右键断开连线后拖线重连、拖线到空白处从菜单创建节点。
- `layout.spec.ts`（3 个用例）：小地图显示图与可见区域，放大后可见区域缩小，点击、拖动与方向键平移画布（桌面布局）；场景列表收起为侧轨后仍可切换场景，运行面板收起为标题栏并显示运行状态（手机布局跳过）；手机布局中工具条按钮全部位于屏幕内且触控尺寸不小于 32 px，小地图隐藏，底部抽屉收起时贴底、展开后显示运行结果，场景条可切换场景（只在手机布局运行）。

按屏幕坐标操作节点、端口与小地图的用例只在 `desktop` 布局的 project 中运行（跳过原因 “Pointer gestures run on desktop layouts.” 等）：它们需要整张演示图完整显示在两侧面板旁；手机布局专属的用例只在 `mobile` 布局中运行。全部 project 合计 200 个用例，其中 160 个运行、40 个按上述设计跳过。每个用例都会收集浏览器 console 的 error / warning 与页面异常，并断言为空。
