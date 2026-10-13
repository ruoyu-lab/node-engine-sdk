# 运行环境与兼容范围

Node Engine SDK 只发布一套严格的 ESM / ES2022 产物，不提供 CommonJS、旧浏览器转译包、polyfill 或双轨兼容入口。

## 工具链

| 项目       | 最低版本 / 契约                 | 验证方式                                                                                                                                                                            |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js    | `>=20.19.0`                     | CI 使用 Node.js 22 执行安装、质量检查、构建、测试、打包与消费者测试                                                                                                                 |
| npm        | `>=10.0.0`                      | 使用 lockfile 与 `npm ci` 做可重复安装                                                                                                                                              |
| TypeScript | 声明文件按 ES2022、严格模式生成 | 仓库使用 TypeScript 5.8+；打包消费者测试以 NodeNext 解析做类型检查                                                                                                                  |
| Vue        | `^3.5.13`                       | `@node-engine-sdk/vue` 将 `vue` 声明为 peer dependency，不打包 Vue；消费者测试覆盖 Vue SSR                                                                                          |
| React      | `^18.3.0 \|\| ^19.0.0`          | `@node-engine-sdk/react` 将 `react`、`react-dom` 声明为 peer（`@types/react` 为可选 peer）；组件测试运行在 React 19，打包消费者测试覆盖 React 19 与 React 18 的类型检查和服务端渲染 |

只有 `@node-engine-sdk/vue` 需要宿主提供 Vue，只有 `@node-engine-sdk/react` 需要宿主提供 React；`@node-engine-sdk/presets` 只依赖 `@node-engine-sdk/core`。core 的 protocol、store、semantics、runtime、layout、debug 子路径以及 `@node-engine-sdk/presets` 都不依赖 DOM 与 UI 框架，可在 Node.js、Worker 等无界面环境运行；只有 `@node-engine-sdk/core/view` 使用 DOM API，且不依赖任何 UI 框架。

## 模块格式

- 发布包为 ESM-only（`"type": "module"`），使用标准 `exports`、`main`、`module`、`types` 入口；不发布 CommonJS，不做 `require()` 回退。
- JavaScript 构建目标为 ES2022。
- 包内相对 ESM 引用带 `.js` 扩展名；发布 tarball 只包含 `package.json`、`README.md`、`LICENSE` 与 `dist`，并在隔离消费者项目中完成 NodeNext 类型检查与运行时导入。
- 样式是显式的副作用导入：`@node-engine-sdk/vue/style.css`、`@node-engine-sdk/react/style.css` 或 `@node-engine-sdk/core/view/style.css`；各包 `sideEffects` 只声明这些样式文件。

## 浏览器

| 浏览器     | 最低版本 | 说明                                                     |
| ---------- | -------- | -------------------------------------------------------- |
| Chrome     | 120      | 桌面 Chromium 自动化主门禁                               |
| Edge       | 120      | 与 Chromium 能力基线一致                                 |
| Firefox    | 121      | 支持 ES2022、Pointer Events、ResizeObserver 与 Canvas 2D |
| Safari     | 17       | macOS 桌面支持下限                                       |
| iOS Safari | 17       | 移动端支持下限                                           |

自动化 E2E 同时针对 Vue 版与 React 版 playground，每个应用 5 个 project（共 10 个）：Chromium 的 1440×900、800×900、390×844 三种视口（均使用桌面 Chrome 配置，390×844 只缩小视口、不模拟触控设备），以及 Firefox 与 WebKit 的 1440×900 视口。所有视口都覆盖标准 preset 与画布初始化、自动布局、适配、重置、完整 Runtime 执行、画布主题切换、工具栏缩放与图 JSON 导出导入；拖动节点、撤销重做、平移与滚轮缩放、参数编辑、断开与重连、拖线建节点等指针交互只在三个 1440×900 桌面视口中运行。每个用例都断言浏览器没有 console error / warning 与页面异常。iOS Safari 不在自动化矩阵中。用例与 project 列表见 [Playground](./playground-demo.md#浏览器-e2e)。

表中的版本下限是正式支持契约；新增浏览器 API 时必须在边界内实现或提高矩阵版本，不加入隐式兼容分支。

## 宿主能力

浏览器宿主需要提供 ES modules、Pointer Events（含 pointer capture）、ResizeObserver、Canvas 2D、`requestAnimationFrame`、AbortController 与现代 CSS 布局。持久化、协作、搜索、Minimap 或业务网络能力由应用或独立插件提供，不改变基础包的运行环境契约。
