[← 返回项目首页](../README.zh-CN.md)

# Node Wright 文档

Node Wright是框架无关的节点图引擎，由四个包组成：底层核心 `@node-wright/core`（协议、状态、语义、运行时、布局、调试与框架无关的编辑器控制器，对应子路径 protocol、store、semantics、runtime、layout、debug、view）、官方预设节点 `@node-wright/presets`，以及基于 `@node-wright/core/view` 的官方适配层 `@node-wright/vue`（Vue 3）与 `@node-wright/react`（React）。playground 只是集成示例，不是能力归属地。

## 入门

- [getting-started.md](./getting-started.md)
  从 Vue 或 React 最小编辑器开始，再按需接入 Runtime、布局和调试。
- [architecture.md](./architecture.md)
  分层、依赖方向、模块边界约束、控制器契约和数据流。
- [support.md](./support.md)
  Node.js、TypeScript、Vue、React、模块格式与浏览器支持范围。

## 底层核心（`@node-wright/core`）

- [core-api.md](./core-api.md)
  按子路径列出全部导出，以及 Store、命令、事务、历史和插件生命周期。
- [protocol-api.md](./protocol-api.md)
  `GraphSnapshot`、严格解析、诊断、参数 schema、扩展 manifest 和执行计划类型。
- [semantics-api.md](./semantics-api.md)
  端口语义、连线规则、流程插件、值类型、函数与子图签名。
- [runtime-api.md](./runtime-api.md)
  执行计划编译、handler 协议、变量、函数、子图、调度器和运行事件。
- [runtime-debugging.md](./runtime-debugging.md)
  trace、callFrames、断点、单步控制与 `@node-wright/core/debug`。
- [layout-api.md](./layout-api.md)
  headless 自动布局与位置 patch。
- [controller-api.md](./controller-api.md)
  `@node-wright/core/view`：`createEditorController`、编辑器选项、视图快照、事件表、`NodeWrightApi` 全表、渲染扩展类型与 DOM 节点契约。

## 官方适配层

- [vue-adapter.md](./vue-adapter.md)
  `@node-wright/vue`：props、`v-model:graph`、事件、ref、插槽、`domComponents` 与自定义 DOM 节点。
- [react-adapter.md](./react-adapter.md)
  `@node-wright/react`：props、回调事件、ref、render props、`useNodeWrightApi`、StrictMode、SSR、原生事件与 `domComponents` 契约。

## 节点与官方预设

- [presets-api.md](./presets-api.md)
  五个 preset 工厂、返回内容和组合方式。
- [node-systems.md](./node-systems.md)
  `@node-wright/presets/nodes/*` 中 15 个原语节点的端口、能力与 handler 行为。
- [node-definition-guide.md](./node-definition-guide.md)
  从协议定义、DOM 渲染、语义和 runtime handler 四层开发一个业务节点。
- [subgraph-guide.md](./subgraph-guide.md)
  子图签名、调用节点、边界节点与 runtime 注册。

## 产品集成

- [editor-integration.md](./editor-integration.md)
  工具栏、右键菜单、快捷键、自动布局、参数控制器、分组与“拖线到空白处建节点”。
- [playground-demo.md](./playground-demo.md)
  Vue / React 两个 playground 应用与 `playground-shared` 的分层、AI 图片场景与 4 个原语场景、新增业务节点的步骤，以及单元测试与双应用 E2E。

## 阅读路径

- 快速使用：getting-started → presets-api → vue-adapter 或 react-adapter → controller-api
- 开发节点：protocol-api → node-definition-guide → node-systems → semantics-api
- 执行工作流：runtime-api → runtime-debugging → subgraph-guide
- 做编辑器产品：editor-integration → controller-api → layout-api
- 理解架构或编写新的 UI 适配层：architecture → controller-api → core-api

## 能力归属

| 能力                                              | 正式归属                                 | playground 角色                                 |
| ------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| 图协议、严格解析、诊断、参数 schema、执行计划类型 | `@node-wright/core/protocol`             | 提供演示图快照                                  |
| Store、命令、事务、历史、插件注册                 | `@node-wright/core/store`                | 通过编辑器 API 间接使用                         |
| 连线规则与端口语义                                | `@node-wright/core/semantics`            | 由 preset 插件启用                              |
| 执行、变量、函数、子图、调试事件                  | `@node-wright/core/runtime`              | 运行按钮与结果面板                              |
| 自动布局                                          | `@node-wright/core/layout`               | 工具栏“自动布局”                                |
| 编辑器状态与交互、`NodeWrightApi`、DOM 节点模型   | `@node-wright/core/view`                 | 通过适配层使用                                  |
| 画布组件与默认 DOM 节点                           | `@node-wright/vue`、`@node-wright/react` | Vue 版与 React 版应用各用一套                   |
| 原语节点定义与 handler                            | `@node-wright/presets/nodes/*`           | 经 presets 根入口使用数据源、数据预览节点       |
| 开箱即用组合                                      | `@node-wright/presets`                   | 组合 dataflow preset 与业务节点                 |
| 业务领域节点（AI、HTTP、文件等）                  | 业务应用自行实现                         | `playground-shared/src/business/ai-image/` 参考 |
