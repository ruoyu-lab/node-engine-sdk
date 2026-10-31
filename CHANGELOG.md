# Changelog

本文件记录 Node Wright 的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0-beta.3] - 2026-10-29

### Fixed

- `api.nodes.create` / `api.nodes.add` 不再把定义端口与参数输入端口写进新节点的 `ports`。之前带参数输入端口（`parameter.input`）的节点定义一创建节点，整图校验就报 `NODE_PARAMETER_PORT_ID_CONFLICT`，Store 拒绝这次修改。现在节点只保存自己的端口，定义的端口从定义解析；只有节点类型默认端口、没有节点定义时才复制。
- 编辑器创建的节点和边只写有值的字段，`api.graph.get()` 的结果可以直接交给 `parseGraph` 严格解析。之前 `edges.connect` 没给 `edgeType` / `data` 时会写出 `type: undefined` / `data: undefined`，严格解析报 `edges.N.type: expected a string`。
- 默认 DOM 节点的数字字段：没有 `step` hint 时不再按整数对齐（之前输入 `0.5` 会变成 `1`）；非整数不再固定显示两位小数（之前 `0.001` 显示为 `0.00`）；被非数字的上游值驱动时显示它的文字，不再显示 `0` 或 `NaN`。

## [0.1.0-beta.2] - 2026-10-14

### Changed

- 样式类名与主题 CSS 变量的前缀统一为 `nw-`（Node Wright），例如 `.nw-root`、`.nw-default-dom-node`、`--nw-selection`，与 `NodeWright` 系列 API 命名一致。自定义主题或覆盖样式时请使用新前缀。

## [0.1.0-beta.1] - 2026-10-14

### Changed

- 四个包与 workspace 的 `package.json` `description` 改为英文，npm 包页面显示英文简介。

## [0.1.0-beta] - 2026-10-13

首个测试版。

### Added

- 四个发布包，版本统一为 `0.1.0-beta`，MIT 协议，ESM-only / ES2022，Node.js `>=20.19.0`：
  - `@node-wright/core`：框架无关的底层核心（协议、状态、语义、运行时、布局、调试与编辑器控制器），子路径 `.`（protocol + store）、`/protocol`、`/store`、`/semantics`、`/runtime`、`/layout`、`/debug`、`/view` 与 `/view/style.css`。
  - `@node-wright/presets`：官方预设节点，提供数据流、执行流、函数、子图与混合流 preset，子路径 `/nodes/dataflow`、`/nodes/execflow`、`/nodes/function`、`/nodes/subgraph`，共 15 个原语节点，可编辑的值（如延迟时长、日志消息、变量名与作用域、函数 / 子图 id）都声明为参数 schema，可连线驱动的参数带参数输入端口；`function:call` / `subgraph:call` 的调用目标只来自 `functionId` / `subgraphId` 参数（没有参数端口，缺失时报出带节点 id 的错误），全部数据输入原样传给函数或子图；调用与边界节点的端口生成函数也从根入口导出，生成的端口不含未设置的可选字段，可直接通过严格解析；只依赖 `@node-wright/core`。
  - `@node-wright/vue`：官方 Vue 3 适配层（peer `vue ^3.5.13`）。
  - `@node-wright/react`：官方 React 适配层（peer `react` / `react-dom` `^18.3.0 || ^19.0.0`）。
- 图协议：唯一持久化格式 `GraphSnapshot`（`schemaVersion` `'1.0.0'`），`parseGraph(unknown)` 严格外部输入边界与 `GraphParseError`，`validateGraph` / `repairGraph`，统一的 `GraphDiagnostic`，参数 schema 与参数输入端口，扩展 manifest，执行计划类型，共享查找索引 `GraphIndex`。边的 `kind` 必填且等于源端口 kind（未声明 kind 的端口为 `DEFAULT_PORT_KIND`，即 `'data'`），不一致时报告 `EDGE_KIND_MISMATCH`。
- Store：查询与事件和内部状态隔离，同步原子事务（一条历史、一次诊断、一次通知、失败回滚），`replaceGraph`（清空历史）与 `applyGraph`（可撤销）分离，唯一插件名、`hasPlugin` 与幂等 dispose，命令失败可观察；连线与重连由源端口推导边的 kind。
- 语义：数据流 / 执行流 / 混合流插件，交互校验与整图诊断共用同一套规则、索引与连接 kind（`ConnectionContext.kind`），迭代式环路检测，顶层 `capabilities` 唯一能力来源，结构化值类型，函数、子图与变量签名，以及定位到具体条目的函数 / 子图签名校验（`validateFunctionSignature` / `validateSubgraphSignature`，在定义创建、调用节点端口生成与编译时生效）。
- Runtime：执行计划编译（入口、handler、数据环诊断），按 run 持有的数据求值缓存，`null` / `undefined` / 缺失输出区分，attempt 级 `AbortSignal` 与超时，只对 `pure` 或 `idempotent` 节点重试，顺序与并发调度器，变量作用域，函数与子图调用，断点与单步，深度冻结的运行事件与监听器错误隔离。
- 布局与调试：headless 分层布局与位置 patch；运行结果汇总与查询函数。
- 框架无关的编辑器控制器 `@node-wright/core/view`：`createEditorController`（`subscribe` / `getSnapshot` / `update` / `mount` / `unmount` / `destroy`）持有视口、选区、拖拽、连线、框选、缩放、剪贴板、快捷键、节点编辑器、右键菜单、可见性裁剪、性能采样与 Canvas 绘制调度；分组式命令 API `NodeWrightApi`；框架无关的默认 DOM 节点模型与交互状态机；共享样式。`view.fit.*` 的 `padding` 可以按边给出（`NodeWrightInsets`），内容在剩余区域内居中，`fit.graph` 同时包含节点与分组；`mount` 事件在编辑器挂载到宿主元素后带着 API 发出。默认 DOM 节点与内联节点编辑器的字段都只来自参数 schema（显示 hint 按参数 key 匹配，选项只来自参数）；`onEvent` 的 `NodeWrightEventListener` 类型允许参数更少的监听器；`view.zoom.to()` 以视口中心为锚点；传入外部 `store` 时与之冲突的 Store 层选项直接报错。
- 小地图：编辑器选项 `minimap?: boolean | NodeWrightMinimapOptions`（默认关闭），快照字段 `minimap`（容器与可见区域框的样式、拖动状态）与 `controller.mountMinimap({ root, canvas })`。小地图显示节点、分组与当前可见区域（图内容与可见区域的并集，等比缩放居中），点击、拖动或方向键平移视口，拖动只更新视口预览并在松开时提交一次；节点与分组的缩略矩形只在图、节点类型或尺寸变化时重算，绘制按动画帧合并且只在输入变化时进行，5,000 节点时在内容范围内平移不重绘。Vue 与 React 适配层用内部组件渲染同一结构，契约测试覆盖渲染、点击平移与解绑。
- 主题与外观：`theme.colorScheme`（`'dark'` 默认 / `'light'`）选择内置的深色或浅色调色板，Canvas 颜色来自 TypeScript 调色板，DOM 部分来自样式表中按根元素 `data-color-scheme` 切换的设计令牌（字体栈、圆角、动效、文字层级、节点与控件表面、选择色与语义色）；主题字段 `execEdgeColor`（执行边与执行端口的颜色，浅色画布上同样清晰）、`selectionColor`（选中与悬停连线的光晕）与 `minimapNodeColor`。`NodeTypeDefinition.accent`（节点 `meta.accent` 优先，`resolveNodeAccent`）标识节点类别，`@node-wright/presets` 以 `PRESET_NODE_ACCENTS` 为四类节点着色。编辑器选项 `nodeStatus` 按节点 id 传入执行状态（与 Runtime 节点状态同值，只是视图状态），DOM 渲染上下文收到 `status`。默认网格为低对比点阵（`gridSize` 24）。
- 默认 DOM 节点：标题栏为类别色标、标题与副标题（类型说明）以及执行状态角标（运行中旋转、成功、失败、暂停、取消；运行中的节点边框轻微脉动，`prefers-reduced-motion` 下不播放动画）；选中态为选择色描边加光晕；端口按数据类型着色，执行端口为三角形，已连接端口实心、未连接端口空心，拖线时兼容端口高亮、不兼容端口变淡（`resolveDomPortDotClass` 等状态类与 `--nw-port-color`）；字段控件统一的悬停、聚焦、禁用与被连线驱动（虚线描边、只读）样式；图片字段带棋盘格底、空态图标与悬停操作按钮。Canvas 绘制的分组为半透明色块与带色点的标题，带颜色的分组以淡色填充主体。
- 官方 Vue 与 React 适配层：同名同语义的 props、事件（Vue `update:graph` / React `onGraphChange` 与 `on*` 回调）、ref API、`background` / `overlay` 插槽与 `renderBackground` / `renderOverlay`、`domComponents` 注册、默认 DOM 节点（文本、多行文本、数字拖动调值、开关、下拉、时间、滑块、图片字段与尺寸手柄）、Canvas-only 节点的可访问替代结构；React 版支持 StrictMode 与服务端渲染，并提供 `useNodeWrightApi()`。
- playground：Vue 与 React 两个应用共用 `playground-shared` 的场景注册表、设计令牌与样式，提供 AI 图片工作流与数据流、执行流、函数、子图 4 个原语场景。界面为全屏画布加浮动面板：左上品牌与场景列表（可收起为色标侧轨）、顶部居中的图标工具条（运行、自动布局、适配、重置、撤销重做、导入导出、深浅主题）、右侧可收起的运行面板（运行结果、执行轨迹时间线、事件、选中节点与变量）、右下小地图与缩放控件、左下快捷键提示与性能浮层开关；深浅两套主题跟随 `prefers-color-scheme` 初始化并可切换；运行时节点显示执行状态角标；适配视口时避开浮动面板；窄屏（390 px）下为顶部场景条、紧凑工具条与底部抽屉。切换场景时清空运行结果并改读新编辑器的缩放与撤销状态。
- 在线 Demo 与文档：`.github/workflows/pages.yml` 把 Vue playground（站点根）与 React playground（`/react/`）部署到 [GitHub Pages](https://ruoyu-lab.github.io/node-wright/)，两版之间可互相切换；英文与简体中文双语 README（`README.md` / `README.zh-CN.md`）附真实界面截图与操作动图（由 `scripts/capture-readme-assets.mjs` 生成）；Issue 与 Pull Request 模板。
- 质量门禁：严格 TypeScript（含 `noUncheckedIndexedAccess`、`noUnusedLocals/Parameters`）、类型感知 ESLint、Prettier、覆盖率阈值、模块与包边界测试、Vue / React 共用的适配层契约测试、真实 tarball 隔离消费者测试（NodeNext 类型检查、运行时导入、Vue 与 React SSR、React 18 消费者）、Vue 与 React 两个 playground 共用的浏览器 E2E（各自覆盖 Chromium 三视口与 Firefox / WebKit 桌面，共 10 个项目）、`onEvent` 类型契约测试、5,000 节点性能预算与 CI 工作流。

### 已知限制

- React 组件测试只在 React 19 上运行 DOM 用例，React 18 由打包消费者的类型检查与 SSR 覆盖。
