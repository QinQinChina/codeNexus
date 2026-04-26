# Codex CLI 0.117.0 ~ 0.120.0 适配 / 回归清单

## 文档说明

- ✅ 本文档接续此前已清理的旧版适配清单，聚焦 `Codex CLI / codex app-server` 从 `0.117.0` 到 `0.120.0` 的变化。
- ✅ `0.110.0 ~ 0.116.0` 的历史版本回看已独立整理，见 [docs/codex-cli-adaptation-checklist-0.110.0-0.116.0.md](docs/codex-cli-adaptation-checklist-0.110.0-0.116.0.md)。
- ✅ 当前仓库**实际协议生成基线已升级到 `0.120.0`**；但 `0.118.0 ~ 0.120.0` 的新能力大多仍停留在协议同步或兼容层。
- ✅ 本文档目标是先把“官方更新点 / 当前仓库状态 / 建议回归项”梳理清楚，避免把“上游已发布”和“本仓已落地”混为一谈。
- ✅ 当前界面结构补充说明见 [docs/topbar-more-vs-settings.md](topbar-more-vs-settings.md)。

| 状态            | 含义                                                    |
| --------------- | ------------------------------------------------------- |
| ✅ 已同步       | 当前仓库已有明确基线、类型或完整接线                    |
| 🟡 已调研未升级 | 上游已发布，但当前仓库尚未同步 generated 或完整业务接线 |
| ❌ 未接线       | 当前仅有零散事件 / 类型，或完全未见落地实现             |

---

## 当前总览

| 项                                               | 当前状态     | 说明                                                                                   |
| ------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------- |
| 当前仓库协议基线                                 | ✅ `0.120.0` | `README.md` 与 `package.json` 已更新到 `@openai/codex@0.120.0`                         |
| `0.118.0` 官方更新                               | 🟡 已梳理    | 重点是设备码登录、Windows sandbox proxy、shell 状态与历史体验改进                      |
| `0.119.0` 官方更新                               | 🟡 已梳理    | 重点是 Realtime V2、MCP resource / file parameter / tool-call metadata、remote control |
| `0.120.0` 官方更新                               | 🟡 已梳理    | 重点是 background agent、hooks 展示、`outputSchema`、`SessionStart`                    |
| 当前仓库对 `0.118.0 ~ 0.120.0` 的 generated 同步 | ✅ 已完成    | 当前已完成 `0.120.0` generated 替换，并通过 `pnpm run typecheck`                       |

---

## 仓库依据

| 项                                                                      | 证据                                                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前基线已升级到 `0.120.0`                                              | `README.md`、`package.json`                                                                                                                                                |
| README 仍引用适配清单路径                                               | `README.md`                                                                                                                                                                |
| 当前 `codex:types` 已生成 `0.120.0`                                     | `package.json`                                                                                                                                                             |
| 已实现的官方 RPC 主要集中在 `skills/*`、`mcp*`、基础 thread/turn/config | `src/renderer/domain/runtimeOrchestrator.ts`                                                                                                                               |
| 当前仅注册了 hooks / guardian / account 通知方法                        | `src/renderer/app/events/protocolMethods.ts`                                                                                                                               |
| hooks 仍主要走通用时间线落库；guardian 已在 Chat / 时间线补基础摘要     | `src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts`、`src/renderer/components/layout/ChatPane.vue`、`src/renderer/components/layout/TimelinePane.vue` |
| guardian 审批内嵌诊断区                                                 | `src/renderer/components/guardian/GuardianReviewDiagnostics.vue`                                                                                                           |
| MCP resource 首版右侧查看器                                             | `src/renderer/components/layout/IntegrationsDrawer.vue`、`src/renderer/components/layout/RightSidebar.vue`、`src/renderer/components/mcp/McpResourcePanel.vue`             |
| 登录参数仍只有 `apiKey` / `chatgpt` / `chatgptAuthTokens` 三类          | `src/generated/codex-app-server/v2/LoginAccountParams.ts`                                                                                                                  |
| 协议层已含 `outputSchema` 字段                                          | `src/generated/codex-app-server/Tool.ts`、`src/generated/codex-app-server/v2/TurnStartParams.ts`                                                                           |

---

## 1️⃣ 官方版本摘要

| 版本      | 发布时间     | 官方来源                                                                    | 关键信息                                                                                                                            | 对当前项目的直接影响                                                                                                           |
| --------- | ------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0.117.0` | `2026-03-26` | [rust-v0.117.0](https://github.com/openai/codex/releases/tag/rust-v0.117.0) | Plugins 工作流、sub-agent 路径、app-server `!` 命令、`fs/watch`、远程 websocket、图片链路增强                                       | ✅ 当前仓库已同步到这一版 generated 基线                                                                                       |
| `0.118.0` | `2026-03-31` | [rust-v0.118.0](https://github.com/openai/codex/releases/tag/rust-v0.118.0) | ChatGPT 设备码登录、Windows 默认拒绝时可用 sandbox 作为代理、shell 状态 / 历史体验增强、`disable_response_storage`                  | 🟡 主要影响登录、Windows 沙箱、会话体验；当前仓库已同步 generated，但业务层尚未对应落地                                        |
| `0.119.0` | `2026-04-10` | [rust-v0.119.0](https://github.com/openai/codex/releases/tag/rust-v0.119.0) | Realtime V2、MCP resource references、可选文件上传参数、tool-call metadata、`codex proto remote-control`、app-server remote control | 🟡 主要影响 Realtime、MCP 能力面、远程控制边界；当前仓库已同步 generated，其中 MCP resource 首版已落地，其余能力仍未对应产品化 |
| `0.120.0` | `2026-04-11` | [rust-v0.120.0](https://github.com/openai/codex/releases/tag/rust-v0.120.0) | background agent 管理、hooks 可见性、`outputSchema`、plugins / agents / hooks 的 `SessionStart`、大图 `/export` 改进                | 🟡 当前仓库已同步 generated 基线，但多数能力仍未做专门 UI / 交互                                                               |

---

## 2️⃣ 基线与类型同步

| 检查项                             | 状态      | 当前说明                                                                   |
| ---------------------------------- | --------- | -------------------------------------------------------------------------- |
| `0.120.0` 基线文档存在             | ✅ 已完成 | README 已写明当前基线是 `@openai/codex@0.120.0`                            |
| `0.120.0` generated 已落地         | ✅ 已完成 | `codex:types` 脚本已切到 `0.120.0`                                         |
| `0.118.0 ~ 0.120.0` generated 升级 | ✅ 已完成 | 当前已完成 generated 替换并通过 `pnpm run typecheck`                       |
| 适配清单路径恢复                   | ✅ 已完成 | 本文档恢复到 `docs/codex-cli-adaptation-checklist.md`，README 链接重新有效 |

**当前结论**

- ✅ 当前仓库已完成 `0.120.0` 协议基线升级。
- ❌ 但目前仍不能把仓库状态描述为“已完整适配 `0.120.0` 全部新能力”。
- ✅ 更准确的描述应是：“已完成 `0.120.0` generated 基线升级，并同步整理了 `0.118.0 ~ 0.120.0` 的待适配能力差异。”

**建议升级命令**

```powershell
npx -y @openai/codex@0.120.0 app-server generate-ts --experimental --out .\tmp\codex_0.120.0_generated
pnpm run typecheck
```

---

## 补充：0.117.0 -> 0.120.0 generated 差异拆解

### 新增 RPC / 通知 / 顶层类型

| 类别         | 差异                                   | 当前仓库状态                                     | 影响层                |
| ------------ | -------------------------------------- | ------------------------------------------------ | --------------------- |
| 新增 RPC     | `mcpServer/resource/read`              | ✅ 已完成首版运行时封装与右侧资源查看器          | `shared` / `renderer` |
| 新增 RPC     | `thread/realtime/listVoices`           | ✅ generated 与协议基线保留；❌ 桌面端当前不实现 | `shared` / `renderer` |
| 新增通知     | `thread/realtime/sdp`                  | ✅ generated 保留；❌ 桌面端当前不注册该通知     | `renderer`            |
| 新增顶层类型 | `ResourceContent`                      | ✅ 已用于右侧资源查看器的文本 / 图片 / blob 预览 | `shared` / `renderer` |
| 新增顶层类型 | `RealtimeVoice` / `RealtimeVoicesList` | ✅ generated 保留；❌ 桌面端当前不消费           | `renderer`            |

### 字段级变化

| 域       | 具体变化                                                                                                              | 当前仓库状态                                    | 建议动作                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 登录     | `LoginAccountParams` 新增 `chatgptDeviceCode`；`LoginAccountResponse` 新增 `verificationUrl` / `userCode`             | ✅ 协议已保留；❌ 桌面端当前不跟进设备码登录 UI | 文档中明确标记为不实现                                                                                                  |
| Realtime | `ThreadRealtimeStartParams` 新增 `transport`、`voice`，`prompt` 改为可选                                              | ✅ 协议已保留                                   | 桌面端当前不实现 Realtime 主动链路                                                                                      |
| Realtime | 新增 `ThreadRealtimeStartTransport`，支持 `websocket` / `webrtc`                                                      | ✅ 协议已保留                                   | 桌面端当前不实现 Realtime transport 选择                                                                                |
| Thread   | `ThreadStartParams` 新增 `sessionStartSource`；`ThreadStartSource = "startup"                                         | "clear"`                                        | ❌ 当前未见非 generated 使用                                                                                            | 与 `/clear`、新建线程语义一起评估 |
| Thread   | `Thread.forkedFromId` 新增                                                                                            | ✅ 已完成                                       | 已用于线程树 / 时间线 fork 关系展示，并用于当前线程 handoff transcript 诊断                                             |
| Turn     | `TurnStartParams` / `TurnSteerParams` 新增 `responsesapiClientMetadata`                                               | ❌ 当前未见使用                                 | 如后续做诊断/埋点再评估                                                                                                 |
| Turn     | `Turn` 新增 `startedAt` / `completedAt` / `durationMs`                                                                | 🟡 部分完成                                     | 已用于 `thread/read` handoff transcript 诊断摘要，尚未全面进入时间线 / 回放 UI                                          |
| 模型     | `Model.additionalSpeedTiers` 新增                                                                                     | ❌ 当前未见消费                                 | 可用于模型选择器展示速度档                                                                                              |
| MCP      | `ListMcpServerStatusParams` 新增 `detail`，配套 `McpServerStatusDetail`                                               | ❌ 当前运行时仍只传 `{}`                        | 后续可按抽屉需要降级拉取粒度                                                                                            |
| MCP      | `McpToolCallResult` 新增 `_meta`                                                                                      | ❌ 当前未见展示                                 | 时间线卡片如需调试信息可补透传                                                                                          |
| 审批     | `ConfigRequirements` 新增 `allowedApprovalsReviewers`                                                                 | ✅ 已完成                                       | 已接入 `configRequirements/read`，全局配置抽屉会按 requirements 限制 `guardian_subagent`，并同步约束审批策略 / 沙箱模式 |
| 审批     | `GuardianApprovalReview` 去掉 `riskScore`，新增 `userAuthorization`；`GuardianRiskLevel` 新增 `critical`              | 🟡 部分完成                                     | 当前已用于 guardian 摘要与审批诊断展示，但仍无独立面板                                                                  |
| 审批     | guardian 通知新增 `reviewId`、`decisionSource`、结构化 `action`，`targetItemId` 改为可空                              | 🟡 部分完成                                     | 当前已用于自动审批摘要与诊断展示；后续如补独立面板，优先沿用这些字段                                                    |
| 网络     | `NetworkRequirements` 新增 `domains` / `unixSockets` map、`managedAllowedDomainsOnly`、`dangerFullAccessDenylistOnly` | ❌ 当前未见消费                                 | 当前 UI 仍只适合旧 allow/deny 文本视图                                                                                  |
| 计划类型 | `PlanType` 新增 `self_serve_business_usage_based`、`enterprise_cbp_usage_based`                                       | ❌ 当前未见显式消费                             | 账户/套餐展示时避免枚举不全                                                                                             |

### 删除 / 收缩项

| 项                    | 变化                                                                                                                    | 当前影响                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| macOS 权限模型        | 删除 `MacOsAutomationPermission`、`MacOsContactsPermission`、`MacOsPreferencesPermission`、`AdditionalMacOsPermissions` | ✅ 当前项目主要跑 Windows，且非 generated 代码未见依赖，暂无阻断       |
| 命令审批 skill 元数据 | 删除 `CommandExecutionRequestApprovalSkillMetadata`，`CommandExecutionRequestApprovalParams` 不再暴露 `skillMetadata`   | ✅ 当前审批 UI 未见依赖，暂无阻断                                      |
| guardian 风险分       | `GuardianApprovalReview` 去掉 `riskScore`                                                                               | ✅ 当前未做 guardian 专项 UI，暂无阻断；后续实现时不要再假设有数值评分 |

### 当前仓库实际使用面

| 结论                                    | 说明                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ 已接入的仅是协议壳层                 | 当前只在 `src/shared/codex-protocol/types.ts` 补了新 RPC，在 `src/renderer/app/events/protocolMethods.ts` 补了新通知方法                                    |
| ❌ 大多数新字段尚未进入业务层           | 诸如 `chatgptDeviceCode`、`responsesapiClientMetadata`、`additionalSpeedTiers` 等，目前仍未见非 generated 使用                                              |
| ✅ 这意味着后续落地可以按责任层分批推进 | 当前除 guardian / handoff 等既有能力外，`0.118.0 ~ 0.120.0` 新增点大多仍停留在 generated / 协议映射层，更适合按登录、MCP、guardian、remote control 分批推进 |

### 建议拆分待办

| 优先级 | 待办                                                              | 责任层            | 说明                                                      |
| ------ | ----------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| P1     | 将 `mcpServer/resource/read` 从右侧查看器继续推进到更完整线程联动 | `renderer`        | 当前已完成右侧查看器首版，后续可再评估是否并入聊天/时间线 |
| P2     | 保持 `chatgptDeviceCode` 仅协议兼容，不进入桌面端登录 UI          | `renderer` / docs | 当前已明确不跟进设备码登录产品化                          |
| P1     | 将 `forkedFromId`、`Turn.durationMs` 用到线程树 / 时间线          | `renderer`        | 这类改动不需要改主链路，收益较高                          |
| P1     | 评估 guardian 新结构可否做调试面板                                | `renderer` / UI   | 当前已有通知，只差展示与筛选                              |
| P2     | 评估 `NetworkRequirements` 新 map 结构是否要投射到全局配置 UI     | `renderer` / UI   | 当前不做也不影响主流程                                    |

---

## 3️⃣ 登录 / 账户

| 检查项                                                  | 状态          | 当前说明                                                         |
| ------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| `account/login/start` / `account/login/cancel` 类型存在 | ✅ 已完成     | 协议类型已保留                                                   |
| `account/login/completed` 通知方法注册                  | ✅ 已完成     | 通知方法已在前端注册                                             |
| `0.118.0` 设备码登录能力                                | ❌ 当前不跟进 | 协议类型已保留，但桌面端当前明确不实现设备码登录 UI / 中间态流程 |
| 账户速率限制事件                                        | 🟡 部分完成   | 当前仅见调试时间线记录，未见独立账户面板                         |

**当前判断**

- ✅ 当前仓库对“账户相关事件”是认识的。
- ✅ 对 `0.118.0` 新增的设备码登录流程，当前仓库只保留协议兼容；桌面端已明确不跟进对应 UI。
- ✅ 因此这块应该归类为“协议已同步、功能未落地”。

---

## 4️⃣ MCP / Realtime / Remote Control

| 检查项                                                                       | 状态            | 当前说明                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/list` / `skills/config/write`                                        | ✅ 已完成       | 当前仓库有明确运行时调用                                                                                                                          |
| `mcpServerStatus/list` / `config/mcpServer/reload` / `mcpServer/oauth/login` | ✅ 已完成       | 当前仓库有明确运行时调用                                                                                                                          |
| `mcpServer/resource/read`                                                    | ✅ 已完成增强版 | 已支持 `detail=full` 拉取资源/模板清单，并将读取结果并入右侧资源面板、Chat 与 Timeline                                                            |
| Realtime 通知方法注册                                                        | ❌ 桌面端不实现 | generated 仍保留，但当前前端不再注册 `thread/realtime/*`                                                                                          |
| Realtime 主动调用 `start/append/stop`                                        | ❌ 桌面端不实现 | 运行时封装与 UI 已移除                                                                                                                            |
| `thread/realtime/listVoices`                                                 | ❌ 桌面端不实现 | generated 仍保留，但当前前端不再消费                                                                                                              |
| `0.119.0` MCP resource references                                            | ✅ 已完成增强版 | 已在 MCP 抽屉补“资源面板”入口，并在右侧支持 resources / templates 列表、手动填参与 `mcpServer/resource/read` 预览；读取结果已并入 Chat / Timeline |
| `mcpServerStatus/list.detail` 粒度控制                                       | ✅ 已完成       | 当前运行时已显式使用 `detail: "full"` 拉取 MCP inventory                                                                                          |
| `0.119.0` 文件参数上传能力                                                   | ❌ 未完成       | 当前未见 MCP 工具文件参数上传协议或 UI                                                                                                            |
| `0.119.0` tool-call metadata 展示                                            | ✅ 已完成首版   | 已在 MCP tool card 诊断区展示 `structuredContent` 与 `_meta`，并补历史回放保真                                                                    |
| `0.119.0` codex proto remote-control / app-server remote control             | ❌ 未完成       | 当前未见专门远程控制入口或连接模型                                                                                                                |

**当前判断**

- ✅ 当前仓库已经有 Skills 与 MCP 基础能力，且 OAuth 流程已接线。
- ✅ Realtime 协议类型仍保留在 generated 基线中。
- ❌ 桌面端当前已明确不实现 Realtime 产品能力，也不再保留通知识别或主动调用链路。
- ✅ `0.119.0` 里新增的 MCP resource 已完成“右侧面板 + Chat / Timeline”增强版接入。
- 🟡 tool-call metadata 已完成 MCP 诊断首版，但 file parameter / remote control 仍未落地。

---

## 5️⃣ Hooks / Guardian / `outputSchema` / Background Agent

| 检查项                                         | 状态          | 当前说明                                                                                                                                    |
| ---------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| hooks 通知方法注册                             | ✅ 已完成     | 已注册 `hook/started` / `hook/completed`                                                                                                    |
| guardian auto approval review 通知注册         | ✅ 已完成     | 已注册 `item/autoApprovalReview/*`                                                                                                          |
| hooks / guardian 独立 UI                       | ❌ 未完成     | 当前未见专门 hooks 面板或独立 guardian 诊断面板                                                                                             |
| hooks / guardian 基础兼容                      | 🟡 部分完成   | hooks 仍主要依赖通用时间线；guardian 已补活动行摘要与审批 UI 内嵌诊断区；Realtime 已从桌面端移除                                            |
| guardian 新结构字段                            | 🟡 部分完成   | generated 已同步 `reviewId`、`decisionSource`、结构化 `action`、`userAuthorization`，当前已用于 guardian 摘要与审批诊断展示，但仍无独立面板 |
| `configRequirements.allowedApprovalsReviewers` | ✅ 已完成     | 已接入 `configRequirements/read`；全局配置抽屉会按服务端 requirements 限制 reviewer，并明确显示 guardian reviewer 是否可用                  |
| `outputSchema` 协议字段存在                    | ✅ 已完成     | generated types 已有 `Tool.outputSchema` 与 `TurnStartParams.outputSchema`                                                                  |
| `outputSchema` 前端使用或展示                  | ✅ 已完成首版 | 已在 MCP tool card 诊断区按 `server + tool` 匹配展示 `Tool.outputSchema`                                                                    |
| `0.120.0` background agent 管理                | ❌ 未完成     | 当前未见官方 background agent 管理入口、状态面板或相关协议升级                                                                              |
| `0.120.0` `SessionStart` 语义落地              | ❌ 未完成     | hooks 枚举里已有 `sessionStart`，但当前未见 plugins / agents / hooks 的专门会话启动视图或流程                                               |

**当前判断**

- ✅ hooks / guardian 在“协议名识别”层面已经具备基础兼容。
- 🟡 guardian 已有首批可见性，能够在 Chat / 时间线里显示摘要，并在审批 UI 中提供内嵌诊断；但整体仍缺少 `0.120.0` 所强调的独立管理能力。
- ✅ `configRequirements/read` 已进入业务层，guardian reviewer 现在可以在全局配置中受服务端 requirements 动态约束。
- 🟡 handoff transcript 已补到“当前线程诊断摘要”层，会基于 `thread/read(includeTurns: true)` 对照父线程与当前线程 turn 数，但仍没有完整 transcript viewer。
- ❌ realtime 当前不再纳入桌面端产品范围；协议基线保留，但前端已移除识别与交互。
- ✅ `outputSchema` 在当前 `0.120.0` generated 中已保持可用。
- ✅ 当前项目已将其做成 MCP tool card 诊断首版，可在 Chat / Timeline 中查看。

---

## 6️⃣ Windows / Shell / 其他体验项

| 检查项                                   | 状态      | 当前说明                                              |
| ---------------------------------------- | --------- | ----------------------------------------------------- |
| `windowsSandbox/setupStart` 类型存在     | ✅ 已完成 | 当前协议类型已保留                                    |
| `windowsSandbox/setupCompleted` 通知注册 | ✅ 已完成 | 当前通知方法已注册                                    |
| `0.118.0` Windows sandbox proxy 专项体验 | ❌ 未完成 | 当前未见专门代理策略 UI / 状态说明                    |
| `0.118.0` shell 状态继承 / 会话历史增强  | 🟡 待确认 | 更偏上游 CLI/TUI 体验，当前 GUI 未见专门适配点        |
| `0.120.0` 大图 `/export` 改进            | 🟡 待确认 | 更偏上游导出行为，当前桌面端无专门 `/export` 功能面板 |

**当前判断**

- ✅ Windows sandbox 相关协议入口和通知当前并不陌生。
- ❌ 但 `0.118.0` 所说的“默认拒绝时走 sandbox 代理”在当前项目里还没有产品化表达。
- ✅ 这些项更适合在升级 generated 之后做一次 Windows 实机专项回归。

---

## 7️⃣ 建议优先级

### P0

| 项                                         | 目标                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 为新字段补 UI / 调试承载                   | 优先把 guardian、`outputSchema` 等仍停留在协议层的能力推进到“用户可见”                                  |
| 登录链路专项核对                           | 保持设备码登录为“不跟进”，避免后续误判为待做项                                                          |
| `0.119.0` 协议差异回归                     | 核对 MCP resource、file parameter、tool-call metadata、remote control，并确认 Realtime 仍只保留协议基线 |
| hooks / guardian / `outputSchema` 专项梳理 | 明确哪些只做兼容，哪些要做正式 UI                                                                       |

### P1

| 项                        | 目标                                                          |
| ------------------------- | ------------------------------------------------------------- |
| background agent 产品边界 | 判断是否要把 `0.120.0` 官方 background agent 做成 GUI 能力    |
| remote control 产品边界   | 判断是否支持 `codex proto remote-control` / remote app-server |
| Windows sandbox 实机回归  | 验证代理策略、通知、失败路径是否符合预期                      |

### P2

| 项                   | 目标                                               |
| -------------------- | -------------------------------------------------- |
| `/export` 大图改进   | 如后续做图片导出体验，再评估是否跟进               |
| shell / 历史体验增强 | 如后续强化终端交互，再评估是否需要透传更多会话状态 |

---

## 8️⃣ 当前结论

### 已完成

- ✅ 当前仓库基线已升级到 `0.120.0`
- ✅ `0.117.0 ~ 0.120.0` 官方变更点已完成梳理
- ✅ Skills / MCP 基础能力仍是当前仓库相对完整的接线区
- ✅ hooks / guardian / account 相关通知方法已在前端注册

### 部分完成

- 🟡 hooks 目前主要还是“协议识别 + 通用时间线兼容”；guardian 已补首批可视化摘要，但仍未产品化
- 🟡 设备码登录当前明确不跟进；`mcpServer/resource/read` 已完成右侧面板 + Chat / Timeline 增强版；Realtime 则明确列为桌面端不实现
- 🟡 `outputSchema` 已完成 MCP tool card 诊断首版，但仍未扩展到独立 tools 管理视图或更强校验
- 🟡 Windows sandbox / account / shell 相关能力仍需结合新版本做专项回归

### 未完成

- ❌ file parameter / remote control
- ❌ 设备码登录 UI（当前不跟进）
- ❌ background agent / remote control / hooks 专项可视化

---

## 9️⃣ 后续更新记录

| 日期       | 变更项                                                               | 状态      | 备注                                                                                                                  |
| ---------- | -------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-04-11 | 补回 `docs/codex-cli-adaptation-checklist.md`                        | ✅ 已完成 | 修复 README 中失效的适配清单链接                                                                                      |
| 2026-04-11 | 新增 `0.117.0 ~ 0.120.0` 官方版本梳理                                | ✅ 已完成 | 基于 GitHub Releases 与当前仓库代码扫描整理                                                                           |
| 2026-04-11 | `0.120.0` generated 已替换本地 `src/generated/codex-app-server`      | ✅ 已完成 | 已补脚本与协议映射，`pnpm run typecheck` 通过                                                                         |
| 2026-04-11 | 补充字段级 generated 差异拆解与责任层待办                            | ✅ 已完成 | 已拆出登录、Realtime、MCP、guardian、网络权限等具体差异                                                               |
| 2026-04-11 | 对照当前业务层复核 `0.118.0 ~ 0.120.0` 实际进度                      | ✅ 已完成 | 已区分“协议已同步”和“业务已落地”，修正设备码登录等状态描述                                                            |
| 2026-04-12 | MCP resource 右侧查看器首版接入                                      | ✅ 已完成 | 已补 `detail=full` 状态拉取、资源/模板列表、手动填参与 `mcpServer/resource/read` 读取预览                             |
| 2026-04-12 | 设备码登录明确列为桌面端不跟进                                       | ✅ 已完成 | 保留 generated 协议兼容，但不再作为登录 UI 待办                                                                       |
| 2026-04-12 | guardian auto approval review 补齐首批可视化                         | ✅ 已完成 | 已新增 guardian 摘要 helper、Chat / 时间线活动行展示与基础诊断口径                                                    |
| 2026-04-12 | guardian 审批 UI 内嵌诊断区补齐                                      | ✅ 已完成 | 已在顶部审批菜单与右侧审批区展示最近 guardian 复核，并按当前 item 聚焦                                                |
| 2026-04-12 | 接入 `configRequirements/read` 与 reviewer 受限配置                  | ✅ 已完成 | 已补 `approvals_reviewer` 读写、requirements store，以及全局配置抽屉的动态限制与提示                                  |
| 2026-04-12 | 补齐 handoff transcript 诊断摘要                                     | ✅ 已完成 | 已基于 `thread/read(includeTurns: true)` 对照父线程与当前线程 turn 摘要，并在 Chat 顶部显示 handoff transcript 诊断行 |
| 2026-04-12 | 下线 Realtime 桌面端功能                                             | ✅ 已完成 | 已移除右侧面板、运行时封装、通知注册、事件摘要与相关设置项；仅保留 generated 协议基线                                 |
| 2026-04-12 | MCP 资源并入 Chat / Timeline，补 tool metadata / outputSchema 可视化 | ✅ 已完成 | 已新增资源读取卡片、MCP tool 诊断区 `structuredContent` / `_meta` / `outputSchema` 展示，并补历史回放保真             |
