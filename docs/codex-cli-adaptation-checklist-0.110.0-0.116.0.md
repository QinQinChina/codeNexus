# Codex CLI 0.110.0 ~ 0.116.0 历史适配 / 回看清单

## 文档说明

- ✅ 本文档用于补回 `Codex CLI / codex app-server` 从 `0.110.0` 到 `0.116.0` 的历史版本梳理。
- ✅ 本文档是“历史版本能力回看 + 当前项目对照”，不是当前协议基线说明。
- ✅ 当前仓库**实际协议基线已经是 `0.120.0`**；因此这里的状态判断，都是站在当前仓库现状回看这些历史版本能力。
- ✅ `0.117.0 ~ 0.120.0` 的后续梳理见 [docs/codex-cli-adaptation-checklist.md](docs/codex-cli-adaptation-checklist.md)。
- ✅ 当前界面结构补充说明见 [docs/topbar-more-vs-settings.md](topbar-more-vs-settings.md)。

| 状态               | 含义                                                             |
| ------------------ | ---------------------------------------------------------------- |
| ✅ 已同步 / 已完成 | 当前仓库已有明确协议接线、运行时调用或完整 UI                    |
| 🟡 部分完成        | 已有类型、事件或局部接线，但未形成完整业务能力                   |
| ❌ 未完成          | 当前仅保留协议类型，或未见业务使用                               |
| ✅ 已移除          | 当前桌面端明确不再提供该产品能力，但保留部分协议类型用于跟踪上游 |

---

## 当前总览

| 项                       | 当前状态               | 说明                                                                                                                                                                                      |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前仓库协议基线         | ✅ `0.120.0`           | 当前 README 与 generated 已按 `0.120.0` 整理                                                                                                                                              |
| 历史文档覆盖范围         | ✅ `0.110.0 ~ 0.116.0` | 本文档负责旧能力回看                                                                                                                                                                      |
| 后续文档覆盖范围         | ✅ `0.117.0 ~ 0.120.0` | 见主适配清单                                                                                                                                                                              |
| Skills                   | ✅ 已完成              | 列表、配置写入、管理 UI 已接线                                                                                                                                                            |
| MCP                      | ✅ 已完成              | 列表、重载、OAuth、elicitation 已接线                                                                                                                                                     |
| 审批流                   | ✅ 已完成              | 文件、补丁、命令、权限审批已接线                                                                                                                                                          |
| Plan / 时间线 / 历史回放 | ✅ 已完成              | `item/plan/delta` 与回放链路已接线                                                                                                                                                        |
| 子 Agent / 多线程关系    | 🟡 部分完成            | 当前已补 `thread/list` 元数据回填、历史缓存持久化、`forkedFromId` 回退建图、线程树 / 时间线来源展示，以及当前线程 handoff transcript 诊断摘要，但官方后续完整 transcript 语义仍需专项回归 |
| Realtime                 | ✅ 已移除              | 桌面端已下线 Realtime 产品能力，仅保留 generated 协议基线                                                                                                                                 |
| Plugin                   | ✅ 已移除              | 桌面端已移除插件市场产品能力                                                                                                                                                              |
| FS RPC                   | ✅ 已移除              | 文件能力已统一走本地 IPC                                                                                                                                                                  |
| Hooks                    | 🟡 部分完成            | 事件已识别，但未见专门 UI                                                                                                                                                                 |

---

## 仓库依据

| 项                              | 当前证据                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ |
| 协议方法映射总表                | `src/shared/codex-protocol/types.ts`                                           |
| 主要运行时 RPC 调用             | `src/renderer/domain/runtimeOrchestrator.ts`                                   |
| 通知方法注册                    | `src/renderer/app/events/protocolMethods.ts`                                   |
| 审批请求入队                    | `src/renderer/processes/protocol-request-responder/installRequestResponder.ts` |
| MCP elicitation 处理            | `src/renderer/app/events/requestHandlers.ts`                                   |
| MCP 用户输入互操作              | `src/renderer/domain/userInputInterop.ts`                                      |
| 模型列表使用                    | `src/renderer/stores/modelCatalog.store.ts`                                    |
| `service_tier` / fast mode 映射 | `src/renderer/domain/serverInterop.ts`                                         |
| 子线程关系维护                  | `src/renderer/stores/thread.store.ts`                                          |
| `thread/list` 元数据回填        | `src/renderer/domain/runtimeOrchestrator.ts`                                   |
| 历史元数据缓存合并              | `src/main/historyStore.ts`                                                     |
| 历史子线程关系                  | `src/renderer/features/history/subAgentRelations.ts`                           |
| `thread/started` 实时元数据消费 | `src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts`       |
| 子代理昵称 / fork 时间线展示    | `src/renderer/components/layout/ChatPane.vue`                                  |
| 本地文件读写 IPC                | `src/main/ipc/handlers/app.handlers.ts`                                        |

---

## 1️⃣ 官方版本摘要

| 版本      | 发布时间     | 官方来源                                                                    | 关键信息                                                                                                                                                      | 对当前项目的主要影响                                  |
| --------- | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `0.110.0` | `2026-03-05` | [rust-v0.110.0](https://github.com/openai/codex/releases/tag/rust-v0.110.0) | 插件系统、TUI 多 Agent 审批与 `/agent`、`fast/flex` service tier、memories 改进                                                                               | 影响 Plugin、子 Agent、fast mode、能力发现            |
| `0.111.0` | `2026-03-05` | [rust-v0.111.0](https://github.com/openai/codex/releases/tag/rust-v0.111.0) | fast mode 默认开启、MCP elicitation 结构化请求、图片工作流增强、会话启动时告诉模型已启用 plugins                                                              | 影响 fast mode、MCP 交互、图片能力、Plugin 上下文透传 |
| `0.112.0` | `2026-03-08` | [rust-v0.112.0](https://github.com/openai/codex/releases/tag/rust-v0.112.0) | `@plugin` mention、模型选择器更新、按回合 sandbox 权限合并                                                                                                    | 影响 Plugin mention、模型列表、权限模型               |
| `0.113.0` | `2026-03-10` | [rust-v0.113.0](https://github.com/openai/codex/releases/tag/rust-v0.113.0) | `request_permissions` 内置工具、plugin marketplace 元数据与卸载、命令执行流式 stdin/stdout/stderr、web search 完整配置、权限 profile 语言、图片生成保存到 cwd | 影响审批流、Plugin、命令执行、权限配置、图片输出      |
| `0.114.0` | `2026-03-11` | [rust-v0.114.0](https://github.com/openai/codex/releases/tag/rust-v0.114.0) | experimental code mode、hooks engine、`/readyz`/`/healthz`、禁用 bundled system skills、handoff 带 realtime transcript、`$` mention picker 改进               | 影响 hooks、code mode、健康检查、Skills、handoff      |
| `0.115.0` | `2026-03-16` | [rust-v0.115.0](https://github.com/openai/codex/releases/tag/rust-v0.115.0) | `view_image` 原图细节、Realtime transcription mode 与 v2 handoff、v2 app-server filesystem RPC、guardian subagent smart approvals、应用集成走 tool-search     | 影响图片、Realtime、FS RPC、审批复核、应用集成        |
| `0.116.0` | `2026-03-19` | [rust-v0.116.0](https://github.com/openai/codex/releases/tag/rust-v0.116.0) | ChatGPT 设备码登录、plugin 缺失提示与远程同步、`userpromptsubmit` hook、Realtime 启动带最近线程上下文                                                         | 影响登录、Plugin 安装引导、Hooks、Realtime 启动上下文 |

---

## 2️⃣ 当前项目对历史能力的整体对照

| 模块                     | 回看结论    | 当前说明                                                                                                                                                           |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skills                   | ✅ 已完成   | `skills/list`、`skills/config/write` 与管理 UI 已接线                                                                                                              |
| Plugin                   | ✅ 已移除   | 历史上游更新很多，但桌面端当前不再提供插件市场产品能力                                                                                                             |
| MCP                      | ✅ 已完成   | `mcpServerStatus/list`、重载、OAuth、elicitation 已接线                                                                                                            |
| 审批流                   | ✅ 已完成   | `request_permissions`、命令审批、补丁审批、文件审批已接线                                                                                                          |
| Plan / 时间线            | ✅ 已完成   | 计划事件、时间线渲染、历史回放已接线                                                                                                                               |
| 子 Agent / Handoff       | 🟡 部分完成 | 已补 `thread/list` 元数据、历史缓存落盘、`forkedFromId` 回退建图、线程树 / 时间线来源展示，以及当前线程 handoff transcript 诊断摘要，但后续 handoff 语义仍偏兼容层 |
| Realtime                 | ✅ 已移除   | 桌面端不实现 Realtime；通知识别、运行时封装与右侧面板链路已删除，仅保留 generated 与协议映射基线                                                                   |
| Hooks                    | 🟡 部分完成 | `hook/started` / `hook/completed` 已注册，但未见 hooks 专项 UI                                                                                                     |
| 图片 / 多模态            | 🟡 部分完成 | 已支持本地图和远程图输入，但 `view_image` 专项体验不完整                                                                                                           |
| FS RPC                   | ✅ 已移除   | `fs/*` 类型保留，桌面端文件能力走本地 IPC                                                                                                                          |
| fast mode / service tier | ✅ 已完成   | 已对齐默认开启语义、配置层映射与主视图状态展示                                                                                                                     |
| code mode / 健康检查     | ❌ 未完成   | 当前未见专门 UI 或运行时接入                                                                                                                                       |

---

## 3️⃣ 分版本回看与当前对照

### `0.110.0`

| 官方更新点                                                 | 当前项目状态                                                                                                  | 当前判断    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| 插件系统可加载 skills、MCP、app connectors，并支持安装端点 | 协议类型仍保留，但桌面端插件市场能力已移除                                                                    | ✅ 已移除   |
| TUI 多 Agent 审批、`/agent` 开关、昵称与上下文增强         | 当前已补 `thread/list` 元数据回填、历史缓存持久化、`forkedFromId` 回退建图，以及线程树 / 时间线昵称与来源展示 | 🟡 部分完成 |
| `fast` / `flex` service tier 与持久化 `/fast`              | 当前已补 `service_tier` 默认语义、配置映射与主视图状态展示                                                    | ✅ 已完成   |
| memories 防污染、工作区范围写入                            | 当前文档未见专门 memories UI 或回归能力                                                                       | ❌ 未完成   |

**回看结论**

- ✅ `0.110.0` 对当前项目最有价值的遗留影响，主要落在多 Agent、Plugin、fast mode 三块。
- ✅ 其中只有多 Agent 关系维护在当前项目里还有持续产品价值。
- ✅ Plugin 当前应明确写成“已移除”，不要再写成“已接线”。

### `0.111.0`

| 官方更新点                                     | 当前项目状态                                                  | 当前判断    |
| ---------------------------------------------- | ------------------------------------------------------------- | ----------- |
| fast mode 默认开启、会话头显示 Fast / Standard | 当前已对齐默认开启语义，并在主视图展示生效 `Fast / Standard`  | ✅ 已完成   |
| MCP elicitation 改为结构化 request/response    | 当前已有 `mcpServer/elicitation/request` 处理与用户输入互操作 | ✅ 已完成   |
| 图片工作流增强、客户端处理图片生成事件         | 当前已有图片输入、预览、历史回放保留                          | 🟡 部分完成 |
| 会话启动时告知模型已启用 plugins               | 当前插件市场已移除，未见相关业务使用                          | ✅ 已移除   |

**回看结论**

- ✅ `0.111.0` 历史版本里最实打实落地的是 MCP elicitation。
- 🟡 图片链路已经有基础，但还不应写成完整覆盖官方图片工作流。

### `0.112.0`

| 官方更新点              | 当前项目状态                                  | 当前判断    |
| ----------------------- | --------------------------------------------- | ----------- |
| `@plugin` mention       | 协议与 mention 类型保留，但未见插件产品化入口 | ❌ 未完成   |
| 模型选择器更新          | 当前 `model/list` 已用于模型目录 store        | ✅ 已完成   |
| 按回合 sandbox 权限合并 | 当前审批与权限模型已接入，但配置展示仍较粗    | 🟡 部分完成 |

**回看结论**

- ✅ `0.112.0` 与当前项目真正对应上的，主要是 `model/list`。
- ❌ `@plugin` mention 现在不应写成已落地。

### `0.113.0`

| 官方更新点                                              | 当前项目状态                                         | 当前判断    |
| ------------------------------------------------------- | ---------------------------------------------------- | ----------- |
| `request_permissions` 内置工具                          | 当前权限审批与审批请求入队已接线                     | ✅ 已完成   |
| plugin marketplace 元数据、安装鉴权、`plugin/uninstall` | 当前插件产品能力已移除，仅保留类型                   | ✅ 已移除   |
| 命令执行流式 stdin/stdout/stderr、TTY / PTY             | 当前 `command/exec*` 与审批链路已接线                | ✅ 已完成   |
| web search 完整工具配置                                 | 当前全局配置可读写，但并未见完整 web search 配置面板 | 🟡 部分完成 |
| 权限 profile 语言与更细粒度 sandbox                     | 当前审批能力已跟上主链路，配置层表达仍不完整         | 🟡 部分完成 |
| 图片生成保存到 cwd                                      | 当前未见桌面端专门对齐该上游语义                     | ❌ 未完成   |

**回看结论**

- ✅ `0.113.0` 是当前项目真正受益最大的一个历史版本点，核心是审批流和命令执行。
- ✅ 当前可以明确说：`request_permissions`、命令执行审批、补丁审批、文件审批已经形成主链路。

### `0.114.0`

| 官方更新点                                 | 当前项目状态                                                                                                                                                                              | 当前判断    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| experimental code mode                     | 当前仅见 `collaborationMode/list` 类型保留                                                                                                                                                | ❌ 未完成   |
| hooks engine，新增 `SessionStart` / `Stop` | 当前仅注册 `hook/started` / `hook/completed` 通知                                                                                                                                         | 🟡 部分完成 |
| `GET /readyz` / `GET /healthz`             | 当前未见桌面端健康检查接入                                                                                                                                                                | ❌ 未完成   |
| 禁用 bundled system skills                 | 当前已有 Skills 管理与配置写入，但未见“禁用系统 skills”专项 UI                                                                                                                            | 🟡 部分完成 |
| handoff 带 realtime transcript             | 当前已补父子线程关系、`forkedFromId` 回退建图、时间线 agent 昵称消费，以及基于 `thread/read` 的当前线程 handoff transcript 诊断摘要；Realtime 桌面端已下线，完整 transcript viewer 仍未做 | 🟡 部分完成 |

**回看结论**

- ✅ `0.114.0` 在当前项目里更多还是“协议与事件兼容”。
- ❌ code mode、健康检查目前都不应写成已支持。

### `0.115.0`

| 官方更新点                                              | 当前项目状态                                                                                          | 当前判断    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `view_image` / `emitImage(detail: "original")` 原图细节 | 当前支持图片输入与预览，但未见完整 `view_image` 专项体验                                              | 🟡 部分完成 |
| Realtime transcription mode 与 v2 handoff               | 当前已补 handoff transcript 诊断摘要；Realtime transcription 桌面端不实现，相关 UI / 运行时链路已下线 | 🟡 部分完成 |
| v2 app-server filesystem RPC                            | 当前类型保留，但桌面端文件能力已改走本地 IPC                                                          | ✅ 已移除   |
| guardian subagent smart approvals                       | 当前已补 Chat / 时间线活动行展示、调试 JSON，以及审批 UI 内嵌诊断区，但仍未做独立 UI                  | 🟡 部分完成 |
| 应用集成走 tool-search                                  | 当前桌面端并未围绕这块做专门产品能力                                                                  | ❌ 未完成   |

**回看结论**

- ✅ `0.115.0` 对当前项目要特别区分两类：FS RPC 是“已移除”，guardian / 图片是“只到兼容层”。
- ❌ 不能把 guardian subagent 或 realtime v2 写成当前已完整落地。

### `0.116.0`

| 官方更新点                                   | 当前项目状态                                                             | 当前判断      |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| ChatGPT 设备码登录与 token refresh           | 当前协议类型可承接，但桌面端当前明确不跟进设备码登录 UI                  | ❌ 当前不跟进 |
| plugin 缺失提示、allowlist、远程同步安装状态 | 当前插件市场能力已移除                                                   | ✅ 已移除     |
| `userpromptsubmit` hook                      | 当前只到 hooks 事件识别层                                                | 🟡 部分完成   |
| Realtime 启动带最近线程上下文                | 桌面端已不再提供 Realtime 入口；该语义仅保留协议层，不再作为产品能力跟进 | ✅ 已移除     |

**回看结论**

- ✅ `0.116.0` 的设备码登录协议已纳入基线跟踪，但桌面端当前明确不跟进对应 UI。
- ❌ 但就当前仓库而言，这块还停留在协议能力，不应算作已接线。

---

## 4️⃣ 当前项目模块化对照

### Skills / MCP

| 检查项                          | 状态      | 当前说明                   |
| ------------------------------- | --------- | -------------------------- |
| `skills/list`                   | ✅ 已完成 | 运行时已有明确调用         |
| `skills/config/write`           | ✅ 已完成 | 已支持启停与配置写入       |
| Skills 管理 UI                  | ✅ 已完成 | 已有列表、管理页、集成入口 |
| `mcpServerStatus/list`          | ✅ 已完成 | 可拉取 MCP 状态            |
| `config/mcpServer/reload`       | ✅ 已完成 | 已支持重载                 |
| `mcpServer/oauth/login`         | ✅ 已完成 | 已支持 OAuth 登录          |
| `mcpServer/elicitation/request` | ✅ 已完成 | 已接入用户输入互操作层     |

**结论**

- ✅ Skills 与 MCP 是 `0.110.0 ~ 0.116.0` 这段历史里，当前项目落地最完整的区域。

### 审批流 / 权限 / 命令执行

| 检查项                                     | 状态        | 当前说明                                                                                                |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| `item/fileChange/requestApproval`          | ✅ 已完成   | 文件修改审批已接线                                                                                      |
| `applyPatchApproval`                       | ✅ 已完成   | 补丁审批已接线                                                                                          |
| `item/commandExecution/requestApproval`    | ✅ 已完成   | 命令审批已接线                                                                                          |
| `item/permissions/requestApproval`         | ✅ 已完成   | 权限审批已接线                                                                                          |
| `execCommandApproval`                      | ✅ 已完成   | 命令执行审批响应已接线                                                                                  |
| guardian / auto approval review            | 🟡 部分完成 | 已补活动行可视化、调试 JSON 与审批 UI 内嵌诊断区，但仍未做独立 UI / 诊断页                              |
| 全局审批 reviewer 配置 / requirements 限制 | ✅ 已完成   | 已接入 `configRequirements/read`，全局配置抽屉会按服务端 requirements 限制审批策略、reviewer 与沙箱模式 |

**结论**

- ✅ 审批流是当前项目对 `0.113.0 ~ 0.115.0` 这段能力最明确的接线成果。
- 🟡 guardian 相关已从“仅注册事件”推进到“可视化 + 审批 UI 内嵌诊断区”，但仍应写成“部分完成”。
- ✅ guardian reviewer 已可在全局配置中选择，并会按服务端 requirements 动态受限。

### Plan / 时间线 / 历史回放 / 子 Agent

| 检查项                              | 状态        | 当前说明                                                                                                                            |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `item/plan/delta`                   | ✅ 已完成   | 已有事件处理与展示                                                                                                                  |
| 时间线渲染模型                      | ✅ 已完成   | 已形成 render model 管道                                                                                                            |
| 历史回放 plan 兼容                  | ✅ 已完成   | 历史解析已覆盖计划事件                                                                                                              |
| 线程父子关系维护                    | ✅ 已完成   | 当前通过 store、`thread/list` 元数据回填与历史缓存共同维护，并补了实时元数据写回                                                    |
| handoff / transcript context 新语义 | 🟡 部分完成 | 当前已补 `forkedFromId` 回退建图、时间线 agent 昵称消费，以及当前线程 handoff transcript 诊断摘要，但 transcript 仍主要停留在兼容层 |

**结论**

- ✅ 当前项目对多线程关系与计划事件已经形成稳定主链路。
- 🟡 当前已把 handoff transcript 做到“当前线程诊断摘要”层，但官方后续完整 transcript 语义增强还没有做成专门产品表达。

### Realtime / Hooks / 图片

| 检查项                                       | 状态        | 当前说明                                           |
| -------------------------------------------- | ----------- | -------------------------------------------------- |
| `thread/realtime/*` 通知注册                 | ✅ 已移除   | 桌面端已移除通知注册；generated 与协议类型仍保留   |
| `thread/realtime/start` / `append*` / `stop` | ✅ 已移除   | 运行时封装与右侧面板已删除，桌面端不再提供主动链路 |
| `hook/started` / `hook/completed`            | ✅ 已完成   | 通知识别已注册                                     |
| hooks 专项 UI                                | ❌ 未完成   | 未见独立面板                                       |
| 远程图片输入 `image`                         | ✅ 已完成   | 当前可发送图片 URL / data URL                      |
| 本地图片输入 `localImage`                    | ✅ 已完成   | 当前可发送本地图片路径                             |
| `view_image` / 原图细节                      | 🟡 部分完成 | 只有图片能力基础，不是完整专项体验                 |

**结论**

- 🟡 hooks 当前仍更接近“兼容层”；Realtime 已明确从桌面端产品面移除。
- ✅ 图片输入已经完成基础接线。
- ❌ 但 `view_image`、hook 管理都还没有真正产品化。

### Plugin / FS RPC / code mode / 健康检查

| 检查项                    | 状态        | 当前说明               |
| ------------------------- | ----------- | ---------------------- |
| `plugin/*` 协议类型       | ✅ 已保留   | 用于跟踪上游协议       |
| 插件市场 UI / 安装流程    | ✅ 已移除   | 当前桌面端不再提供     |
| `fs/*` 协议类型           | ✅ 已保留   | 生成类型仍存在         |
| FS RPC 业务调用           | ✅ 已移除   | 文件能力统一走本地 IPC |
| `collaborationMode/list`  | 🟡 部分完成 | 协议层保留             |
| code mode 专项能力        | ❌ 未完成   | 当前未见完整业务落地   |
| `readyz` / `healthz` 接入 | ❌ 未完成   | 当前未见桌面端调用     |

**结论**

- ✅ Plugin 与 FS RPC 现在都应该明确归类为“桌面端已移除产品能力，协议保留”。
- ❌ code mode、健康检查当前不应写成已支持。

---

## 5️⃣ 建议回归批次

### P0

| 项                       | 目标                                              |
| ------------------------ | ------------------------------------------------- |
| Skills / MCP 主链路      | 确保 `0.110.0 ~ 0.116.0` 期间最核心扩展能力不回退 |
| 审批流                   | 重点验证权限审批、命令审批、补丁审批、文件审批    |
| Plan / 时间线 / 历史回放 | 确保事件展示与历史解析一致                        |
| 子线程关系               | 验证父子线程索引、切换、回放不乱                  |

### P1

| 项                         | 目标                                       |
| -------------------------- | ------------------------------------------ |
| 图片输入 / 预览 / 历史保留 | 验证基础多模态体验                         |
| guardian 事件              | 验证自动审批复核事件不会丢失或显示异常     |
| fast mode / service tier   | 复核默认开启、配置映射与主视图状态是否一致 |

### P2

| 项                                  | 目标                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| 设备码登录                          | 当前明确不跟进，仅保留协议层兼容与文档记录                   |
| hooks / code mode / 健康检查        | 当前先记入待办，不作为主线功能                               |
| handoff transcript / hooks 诊断回归 | 重点验证当前线程诊断摘要、hooks 通知识别与时间线展示是否稳定 |

---

## 6️⃣ 当前结论

### 已完成

- ✅ `0.110.0 ~ 0.116.0` 历史版本能力已补回独立梳理文档
- ✅ 当前项目对 Skills、MCP、审批流、Plan / 时间线、历史回放的落地已经比较明确
- ✅ `model/list`、图片输入、子线程关系维护也已经有实际接线

### 部分完成

- 🟡 多 Agent / handoff 已补齐前两阶段主链路，包括元数据回填、缓存持久化、回退建图、线程树 / 时间线展示，以及当前线程 handoff transcript 诊断摘要，但整体仍偏兼容层，不应夸大为完整 handoff 产品化
- 🟡 hooks、guardian、`view_image` 当前都只能算部分完成；其中 guardian 已有首批活动行可视化
- 🟡 handoff transcript 当前已有诊断摘要，但仍不是完整 transcript viewer

### 未完成或已移除

- ❌ code mode、健康检查未落地；设备码登录当前明确不跟进
- ✅ Plugin 市场、FS RPC 与 Realtime 已从桌面端产品面移除

---

## 7️⃣ 更新记录

| 日期       | 变更项                                              | 状态      | 备注                                                                                                                  |
| ---------- | --------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-04-11 | 新增 `0.110.0 ~ 0.116.0` 历史回看文档               | ✅ 已完成 | 与 `0.117.0 ~ 0.120.0` 文档拆分维护                                                                                   |
| 2026-04-11 | 按当前项目现状重写历史状态判断                      | ✅ 已完成 | 明确区分“协议保留”“业务落地”“桌面端已移除”                                                                            |
| 2026-04-12 | 完成 `0.110.0 / 0.111.0` 首批代码对接               | ✅ 已完成 | 补齐 `fast mode` 默认语义、主视图状态展示、`thread/list` 元数据回填与历史缓存持久化                                   |
| 2026-04-12 | 完成多 Agent / handoff 第二阶段补强                 | ✅ 已完成 | 补齐 `forkedFromId` 回退建图、`thread/started` 实时元数据消费与时间线 agent 昵称 / fork 展示                          |
| 2026-04-12 | 完成 guardian / auto approval review 首批可视化     | ✅ 已完成 | 补齐 guardian 事件摘要、Chat / 时间线活动行展示与调试 JSON 诊断基础                                                   |
| 2026-04-12 | 完成 guardian 审批 UI 内嵌诊断区                    | ✅ 已完成 | 已在顶部审批菜单与右侧审批区展示最近 guardian 复核，支持按当前 item 聚焦                                              |
| 2026-04-12 | 接入 `configRequirements/read` 与 reviewer 受限配置 | ✅ 已完成 | 已补 `approvals_reviewer` 读写、requirements store，以及全局配置抽屉的动态限制与提示                                  |
| 2026-04-12 | 补齐 handoff transcript 诊断摘要                    | ✅ 已完成 | 已基于 `thread/read(includeTurns: true)` 展示当前线程与父线程 turn 摘要，并在 Chat 顶部显示 handoff transcript 诊断行 |
| 2026-04-12 | 下线 Realtime 桌面端功能                            | ✅ 已完成 | 已移除右侧面板、运行时封装、通知注册、事件摘要与相关设置项；仅保留 generated 协议基线                                 |
