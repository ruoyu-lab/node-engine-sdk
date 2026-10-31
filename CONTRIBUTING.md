# 贡献指南

感谢参与 Node Wright。本文说明本地开发流程、常用命令、模块边界与命名规则。架构背景见 [docs/architecture.md](docs/architecture.md)。

## 环境

- Node.js `>=20.19.0`（CI 使用 Node.js 22）、npm `>=10`。
- 首次安装使用 lockfile：`npm ci`（或 `npm install`）。
- 浏览器 E2E 需要先安装 Playwright 浏览器：`npx playwright install chromium firefox webkit`。

## 仓库结构

| 目录                             | 内容                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/core`                  | 底层核心 `@node-wright/core`：`src/{protocol,store,semantics,layout,runtime,debug,view}` |
| `packages/presets`               | 官方预设节点 `@node-wright/presets`：preset 工厂与 `src/nodes/*` 原语节点                |
| `packages/vue`、`packages/react` | 官方 Vue 3 / React 适配层                                                                |
| `playground`                     | Vue 版 playground 应用                                                                   |
| `playground-react`               | React 版 playground 应用                                                                 |
| `playground-shared`              | 两个 playground 共用的业务节点、场景、运行编排、编辑器命令、样式与单元测试               |
| `e2e`                            | Playwright 浏览器测试，用例由两个 playground 共用                                        |
| `scripts`                        | 打包、隔离消费者测试、性能基准与 README 素材截取脚本                                     |
| `docs`                           | 使用文档（简体中文）                                                                     |

## 开发流程

1. 从 `main` 新建分支。
2. 改动前先写清目标、行为不变量与允许的契约变化，再补能复现问题的测试，然后实现根因方案；被替换的实现、测试与文档在同一个改动里删除。
3. 修改包时先跑该包的类型检查与针对性测试（例如 `npm run typecheck -w @node-wright/core`、`npx vitest run packages/core/test/store`），再跑全量门禁。
4. 涉及公开 API 时同步更新 `docs/`、对应包的 `README.md` 与 `CHANGELOG.md` 的 `Unreleased` 小节。
5. 涉及交互或视觉时运行 `npm run test:e2e`；涉及图算法或 Runtime 时运行 `npm run test:performance`；涉及发布配置时运行 `npm run verify:release`。
6. **提交前必须通过 `npm run verify`。**

提交信息使用 Conventional Commits 风格，例如 `feat(core): ...`、`fix(react): ...`、`docs: ...`。

README 的截图与动图在 `docs/assets/`。playground 界面有明显变化时运行 `node scripts/capture-readme-assets.mjs` 重新生成（需要 Playwright Chromium、`ffmpeg` 与访问 Pollinations 图片接口的网络）；横幅 `banner-*.svg` 是手写 SVG，直接编辑。

## 常用命令

| 命令                           | 作用                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| `npm run dev`                  | 启动 Vue 版 playground                                                     |
| `npm run dev:react`            | 启动 React 版 playground                                                   |
| `npm run build`                | 构建全部包与 playground                                                    |
| `npm run build:packages`       | 只构建 4 个包                                                              |
| `npm run build:playground`     | `typecheck:playground` 后构建 Vue 版与 React 版 playground                 |
| `npm run preview`              | 预览 Vue 版 playground 构建产物                                            |
| `npm run preview:react`        | 预览 React 版 playground 构建产物                                          |
| `npm run typecheck`            | 全部包与 playground 的类型检查                                             |
| `npm run typecheck:playground` | 只检查 `playground-shared`、`playground`（`vue-tsc`）与 `playground-react` |
| `npm run lint`                 | ESLint（`--max-warnings=0`）                                               |
| `npm run format`               | Prettier 格式化                                                            |
| `npm run format:check`         | Prettier 格式检查                                                          |
| `npm run quality`              | `lint` + `format:check`                                                    |
| `npm run test`                 | Vitest（`headless` 与 `dom` 两个 project）                                 |
| `npm run test:coverage`        | 带覆盖率阈值的测试                                                         |
| `npm run test:e2e`             | Playwright 浏览器测试（Vue 与 React 两个 playground，10 个 project）       |
| `npm run test:performance`     | 5,000 节点性能预算检查                                                     |
| `npm run verify`               | `quality` + `typecheck` + `build` + `test`（提交前门禁）                   |
| `npm run pack:all`             | 构建并在 `packed/` 生成 tarball                                            |
| `npm run test:packed`          | 在隔离消费者项目中安装 tarball 并做类型检查、导入与 SSR 测试               |
| `npm run verify:release`       | `verify` + `pack:all` + `test:packed`                                      |

测试放在各包的 `test/` 目录与 `playground-shared/test/`：`packages/core/test/view/**`、`packages/vue/test/**`、`packages/react/test/**` 运行在 `happy-dom` 环境（`dom` project），其余（含 `playground-shared/test/**`）运行在 Node.js 环境（`headless` project）。测试通过 Vitest alias 直接引用各包源码，不依赖构建产物。

### 浏览器 E2E

`e2e/` 中的用例同时针对两个 playground 运行：`playwright.config.ts` 以 `vue`、`react` 两个应用 × `desktop-chromium`、`compact-chromium`、`mobile-chromium`、`desktop-firefox`、`desktop-webkit` 五种目标生成 10 个 project（如 `vue-desktop-chromium`、`react-desktop-webkit`），并自动在 4173（Vue）与 4174（React）端口启动开发服务器，本地运行时复用已启动的服务器。`editor-interactions.spec.ts` 的指针手势用例按设计只在 `*-desktop-*` project 中运行，`*-compact-chromium` 与 `*-mobile-chromium` 会跳过它们。只运行一个 project：`npx playwright test --project=vue-desktop-chromium`。新用例的选择器只依赖两个应用共同渲染的结构，公共辅助函数放在 `e2e/support/playground.ts`。详见 [docs/playground-demo.md](docs/playground-demo.md#浏览器-e2e)。

## 模块边界

以下规则由 `packages/core/test/module-boundaries.test.ts` 与 `packages/presets/test/package-boundaries.test.ts` 强制检查：

- core 内部依赖单向无环：`store`、`semantics`、`layout` 只依赖 `protocol`；`runtime` 可依赖 `protocol`、`store`、`semantics`、`layout`；`debug` 可再依赖 `runtime`；`view` 可依赖除 `debug` 外的 headless 模块，headless 模块不依赖 `view`。
- core 内只用相对导入，跨模块只经过对方的 `index.ts`；源文件之间的值导入无环。
- 只有 `core/src/view` 可以使用浏览器全局对象；core 任何位置都不导入 UI 框架或其他 `@node-wright/*` 包。
- 根入口 `@node-wright/core` 只导出 `protocol` 与 `store`。
- UI 适配层只导入 `@node-wright/core/protocol` 与 `@node-wright/core/view`，彼此不导入对方的框架；适配层公开声明中的相对导入必须带 `.js`（或 `.vue`）扩展名。
- presets 只依赖 `@node-wright/core`、不导入 UI 框架、不创建 `NodeWrightRuntime`；`src/nodes/*` 不导入 preset 组装代码。
- 每个包声明的 `@node-wright/*` 依赖与源码导入完全一致，版本统一。
- 业务实现（AI、HTTP、`fetch` 等）只能放在 playground，且只放在 `playground-shared/src`：`playground/src` 与 `playground-react/src` 只包含各自框架的应用壳与组件，不出现业务节点类型、`fetch` 或 `new NodeWrightRuntime`；`playground-shared/src` 不导入 Vue、React 或 UI 适配层；playground 只经 `@node-wright/presets` 根入口使用标准节点。
- 不发布未实现产品能力的占位 API。
- 新增导出子路径时，同步更新 `package.json` 的 `exports` 与边界测试中的 `expectedExports`（`vitest.config.ts` 会自动从 `exports` 生成测试 alias），以及使用 TypeScript `paths` 的 tsconfig 与 playground 的 Vite alias 表（`playground-shared/config/workspace-aliases.ts`）。

## 命名与代码规则

- 不使用版本后缀或新旧标记：标识符与文件名中不出现 `V2`、`new`、`old`、`compat`、`final`、`temp`、`copy` 之类的字样；`package.json` 的 `version`、图协议 `schemaVersion` 与变更日志中的版本号除外。
- 公共 API 命名表达领域语义：图协议类型以 `Graph` 开头（`GraphSnapshot`、`GraphNode`），编辑器与运行时类型以 `NodeWright` 开头（`NodeWrightApi`、`NodeWrightRuntime`），工厂函数以 `create` 开头，常量使用 `UPPER_SNAKE_CASE`（`NODE_WRIGHT_GRAPH_SCHEMA_VERSION`、`DATA_SOURCE_NODE_TYPE`）。
- 文件名：TypeScript 模块使用 kebab-case（`editor-controller.ts`、`use-dom-events.ts`），Vue / React 组件使用 PascalCase（`NodeWright.vue`、`DefaultDomNode.tsx`）。
- 节点类型使用 `命名空间:名称`（`data:source`、`exec:set-variable`），端口 id 稳定且不使用显示文本；样式类名使用 `nw-` 前缀。
- 不做兼容层：不保留旧 API 别名、旧字段或双轨入口；一个能力只有一个正式入口。
- 不新增无约束的 `any`，外部输入用 `unknown` 并在边界解析；不使用 `@ts-ignore` / `@ts-nocheck`，ESLint 禁用必须附带理由。
- 错误必须可观察：不用空 catch、空数组或默认成功状态掩盖失败；`?.` 与 `??` 只用于真实的可选值。
- 不留下 `TODO` / `FIXME` / `HACK` 来推迟当前改动必须解决的问题；一次性诊断脚本与临时文件用完即删。
- 文档使用简体中文，代码标识符保持英文；改完文档运行 `npx prettier --write <文件>`。

## 发布

四个包通过 GitHub Actions 的 `Release` 工作流（`.github/workflows/release.yml`）发布到 npm，只能由维护者在 Actions 页面手动触发。版本号由维护者决定，发布前确认 `CHANGELOG.md` 已更新。

1. 仓库 Secrets 中配置 `NPM_TOKEN`：在 npm 上创建对 `@node-wright` 作用域有读写权限的 Granular Access Token。
2. 先以默认的 `dry-run` 运行一次：工作流会执行 `npm audit`、`npm run verify:release`（质量门禁、类型检查、构建、单元测试、打包与隔离消费者测试），再对每个包执行 `npm publish --dry-run`。
3. 确认无误后关闭 `dry-run` 再运行一次，按 `core` → `presets` → `vue` → `react` 的依赖顺序以 `latest` 标签公开发布，并附带 npm provenance。已存在于 npm 的版本会被跳过，失败后可以直接重跑。

每个包的 `LICENSE` 与仓库根目录的 `LICENSE` 保持一致，由包边界测试检查。
