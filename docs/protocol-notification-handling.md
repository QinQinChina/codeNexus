# Codex App Server 通知处理现状

本文档记录当前项目对 Codex App Server `ServerNotification` 的接收、聊天时间线语义处理、隐藏处理、默认处理，以及已处理通知中尚未消费的字段。

## 结论

当前项目的协议方法白名单已经和官方生成协议对齐：

- `ServerNotification`: 64 个方法，定义在 `src/renderer/app/events/protocolMethods.ts`
- `ServerRequest`: 9 个方法，定义在 `src/renderer/app/events/protocolMethods.ts`
- 协议类型来源：`src/generated/codex-app-server/ServerNotification.ts`

但“协议层接收”不等于“聊天 UI 语义处理”。真正进入聊天事件流水线的处理入口是：

- `src/renderer/core/protocol/notifications.ts`
- `src/renderer/infra/ipc/eventBridge.ts`
- `src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts`
- `src/renderer/features/timeline/renderModel/buildTimelineNodes.ts`
- `src/renderer/components/layout/composables/useChatRenderModel.ts`

当前状态可以概括为：

- 官方 64 个 `ServerNotification` 均在白名单内。
- 非官方通知会在 `normalizeNotification` 中被丢弃。
- 核心聊天相关通知已经有语义处理。
- 一批官方通知已经被识别并有意隐藏、路由到 debug，或交给其他面板处理，不进入主聊天 UI。
- 部分已处理通知只消费了展示所需字段，没有完整消费官方 payload。

## 已语义处理的通知

这些通知会更新 store、聚合成专门时间线节点，或在聊天 UI 中形成可见语义。

| 分类 | 通知 / 条件 | 当前用途 |
| --- | --- | --- |
| 线程生命周期 | `thread/started` | 更新线程历史，记录工作区、模型来源等基础信息 |
| 回合生命周期 | `turn/started` | 设置运行中状态、绑定本地用户消息到 turn、显示思考状态 |
| 回合生命周期 | `turn/completed` | 清除运行中状态、记录完成 turn、触发完成提示音、裁剪旧 turn |
| 回合 diff | `turn/diff/updated` | 保存 turn 级 diff 快照，用于回滚/摘要，不直接进入主聊天流 |
| 计划 | `turn/plan/updated` | 更新 turn 计划摘要状态 |
| token 使用量 | `thread/tokenUsage/updated` | 更新上下文用量概览 |
| 助手消息 | `item/agentMessage/delta` | 流式聚合助手回复 |
| 助手消息 | `item/started` + `agentMessage` | 驱动“准备回复”状态，不单独显示 |
| 助手消息 | `item/completed` + `agentMessage` | 用最终文本覆盖 delta 聚合结果 |
| 计划消息 | `item/plan/delta` | 流式聚合计划文本 |
| 计划消息 | `item/completed` + `plan` | 用最终计划文本覆盖 delta 聚合结果 |
| 推理摘要 | `item/reasoning/summaryPartAdded` | 记录分片/索引，驱动思考状态 |
| 推理摘要 | `item/reasoning/summaryTextDelta` | 聚合为 reasoning block |
| 推理文本 | `item/reasoning/textDelta` | 驱动“思考/输出中”状态，并聚合为 reasoning block 内默认折叠的原始推理内容 |
| 推理完成 | `item/completed` + `reasoning` | 用 `summary` 生成摘要，并用 `content` 覆盖/补齐默认折叠的原始推理内容 |
| 命令执行 | `item/commandExecution/outputDelta` | 聚合命令输出 |
| 命令执行 | `item/commandExecution/terminalInteraction` | 显示终端输入活动 |
| 命令执行 | `item/started` / `item/completed` + `commandExecution` | 生成命令卡片并更新状态 |
| 文件变更 | `item/fileChange/patchUpdated` | 按官方 `FileUpdateChange` 聚合文件变更卡片；debug 开启时同步写入 debug timeline |
| 文件变更 | `item/started` / `item/completed` + `fileChange` | 记录文件变更生命周期和最终状态；debug 开启时同步写入 debug timeline |
| MCP 工具 | `item/mcpToolCall/progress` | 更新 MCP 调用进度 |
| MCP 工具 | `item/started` / `item/completed` + `mcpToolCall` | 生成 MCP 工具调用卡片 |
| raw response | `rawResponseItem/completed` | 作为 MCP 结果提示、图片工具等的补充来源 |
| Guardian | `item/autoApprovalReview/started` | 生成 Guardian 复核活动 |
| Guardian | `item/autoApprovalReview/completed` | 生成 Guardian 复核结果 |
| 用户提示 | `warning` | toast + 时间线警告 |
| 用户提示 | `guardianWarning` | toast + 时间线警告 |
| 用户提示 | `model/verification` | toast + 时间线提示 |
| 上下文压缩 | `item/started` / `item/completed` + `contextCompaction` | 显示上下文压缩短暂状态 |
| 上下文压缩 | `thread/compacted` | deprecated 兼容，显示上下文压缩完成 |
| 动态工具 | `item/started` / `item/completed` + `dynamicToolCall` | 渲染动态工具卡片 |
| 搜索 | `item/started` / `item/completed` + `webSearch` | 渲染 web search 卡片 |
| 图片工具 | `item/started` / `item/completed` + `imageView` / `imageGeneration` | 渲染图片工具卡片 |

## 已处理但不进入主聊天 UI 的通知

这些通知不是“未处理”。当前代码会识别它们，并按产品语义选择不展示在主聊天时间线中。部分通知会在 `timelineDebugEnabled` 开启时写入 debug timeline，便于排查协议事件；部分通知由其他功能面板消费。

| 通知 | 当前处理 |
| --- | --- |
| `skills/changed` | 已识别；不进主聊天 UI，由集成/技能相关面板自行处理 |
| `mcpServer/startupStatus/updated` | 已识别；不进主聊天 UI，由集成/MCP 状态相关面板自行处理 |
| `item/fileChange/outputDelta` | 已识别；官方 deprecated，当前只记 debug，不再驱动文件变更卡片 |
| `process/outputDelta` | 已识别；不进主聊天 UI，debug 开启时写 debug timeline |
| `process/exited` | 已识别；不进主聊天 UI，debug 开启时写 debug timeline |
| `remoteControl/status/changed` | 已识别；不进主聊天 UI，debug 开启时写 debug timeline |
| `thread/goal/updated` | 已识别；不进主聊天 UI，debug 开启时写 debug timeline |
| `thread/goal/cleared` | 已识别；不进主聊天 UI，debug 开启时写 debug timeline |
| `account/rateLimits/updated` | 已识别；默认不进主聊天 UI，debug 开启时写 debug timeline |

## 默认追加但没有专门业务语义的通知

这些通知属于官方协议，当前不会被丢弃。它们会落入 `installEventPipeline.ts` 底部的默认 `timelineStore.appendEvent`，保留原始参数文本，但聊天 UI 通常不会展示专门卡片或更新专门 store。

| 通知 | 缺少的语义处理方向 |
| --- | --- |
| `thread/status/changed` | 未更新线程运行/状态历史 |
| `thread/archived` | 未同步线程归档状态 |
| `thread/unarchived` | 未同步线程取消归档状态 |
| `thread/closed` | 未同步线程关闭状态 |
| `thread/name/updated` | 未同步线程标题 |
| `hook/started` | 未形成 hook 活动卡片 |
| `hook/completed` | 未形成 hook 结果卡片 |
| `serverRequest/resolved` | 未作为审批/请求闭环状态显示 |
| `mcpServer/oauthLogin/completed` | 未同步 MCP OAuth 登录结果到 UI 状态 |
| `account/updated` | 未同步账号状态 |
| `app/list/updated` | 未同步 app 列表状态 |
| `externalAgentConfig/import/completed` | 未同步外部 agent 配置导入结果 |
| `fs/changed` | 未同步文件系统 watch 变更 |
| `model/rerouted` | 未显示模型 reroute 信息 |
| `deprecationNotice` | 未作为用户提示展示 |
| `configWarning` | 未作为用户提示展示 |
| `fuzzyFileSearch/sessionUpdated` | 未同步 fuzzy search 会话进度 |
| `fuzzyFileSearch/sessionCompleted` | 未同步 fuzzy search 会话结果 |
| `thread/realtime/started` | 未同步 realtime 会话状态 |
| `thread/realtime/itemAdded` | 未同步 realtime item |
| `thread/realtime/transcript/delta` | 未同步 realtime transcript |
| `thread/realtime/transcript/done` | 未同步 realtime transcript 完成状态 |
| `thread/realtime/outputAudio/delta` | 未同步 audio 输出 |
| `thread/realtime/sdp` | 未同步 SDP 信息 |
| `thread/realtime/error` | 未同步 realtime 错误 |
| `thread/realtime/closed` | 未同步 realtime 关闭状态 |
| `windows/worldWritableWarning` | 未作为用户提示展示 |
| `windowsSandbox/setupCompleted` | 未同步 Windows sandbox setup 结果 |
| `account/login/completed` | 未同步登录完成状态 |

## 已处理通知中未完整消费的字段

以下字段已随 `params` 保留在事件里，但没有进入当前 UI/store 的结构化状态，或者只被部分消费。

| 通知 / item | 当前使用字段 | 未完整消费字段 |
| --- | --- | --- |
| `thread/started.thread` | `id`、`cwd`、`modelProvider`、`source`、`forkedFromId`、`agentNickname`、`agentRole` | `sessionId`、`preview`、`ephemeral`、`createdAt`、`updatedAt`、`status`、`path`、`cliVersion`、`threadSource`、`gitInfo`、`name`、`turns` |
| `turn/started.turn` | `id`、`startedAt` | `items`、`itemsView`、`status`、`error`、`completedAt`、`durationMs` |
| `turn/completed.turn` | `id`、`error` | `items`、`itemsView`、`status`、`startedAt`、`completedAt`、`durationMs` |
| `item/started` | `item`、`threadId`、`turnId` | `startedAtMs` 未作为权威时间使用 |
| `item/completed` | `item`、`threadId`、`turnId` | `completedAtMs` 未作为权威时间使用 |
| `thread/tokenUsage/updated.tokenUsage` | `last.totalTokens` / `last.inputTokens` / `total.totalTokens`、`modelContextWindow` | `cachedInputTokens`、`outputTokens`、`reasoningOutputTokens` 等明细未展示 |
| `agentMessage` item | `id`、`text` | `phase`、`memoryCitation` |
| `reasoning` item | `id`、`summary`、`content` | `content` 只在 reasoning block 的“原始推理”折叠区展示 |
| `item/reasoning/textDelta` | `threadId`、`turnId`、`itemId`、`delta`、`contentIndex` | `delta` 只在 reasoning block 的“原始推理”折叠区展示 |
| `commandExecution` item | `id`、`command`、`commandActions`、`status`、`aggregatedOutput`、`exitCode`、`durationMs` | `cwd`、`processId`、`source` |
| `item/commandExecution/terminalInteraction` | `itemId`、`turnId`、`stdin` | `processId` |
| `fileChange` item / `item/fileChange/patchUpdated` | `path`、`kind`、`diff`、`move_path`、`status` | 生命周期时间仍使用本地事件时间，不使用官方 `startedAtMs` / `completedAtMs` |
| `mcpToolCall` item | `server`、`tool`、`status`、`arguments`、`result`、`error`、`durationMs` | `mcpAppResourceUri` |
| `item/mcpToolCall/progress` | `message` | 仅作为进度文本，不和最终 result 形成完整状态模型 |
| `rawResponseItem/completed` | `item` 中的 function call / image 相关信息 | 其他 raw response item 类型没有完整 UI 映射 |
| Guardian review | `reviewId`、`targetItemId`、`review.status`、`riskLevel`、`userAuthorization`、`rationale`、`decisionSource`、`action` 摘要 | `startedAtMs`、`completedAtMs`、`action.source`、`action.cwd`、`connectorId`、`requestPermissions.reason`、`permissions` 等未完整展示 |
| `warning` / `guardianWarning` | `message` | 无 |
| `model/verification` | `verifications` 摘要 | 未建立持久模型验证状态 |

## 文件变更通知的当前协议对齐状态

文件变更卡片已经改为使用官方 `item/fileChange/patchUpdated`：

- payload: `{ threadId, turnId, itemId, changes }`
- `changes`: `FileUpdateChange[]`
- `FileUpdateChange`: `{ path, kind, diff }`
- `PatchChangeKind`: `add` / `delete` / `update`
- `update.move_path !== null` 时视为 rename
- `PatchApplyStatus`: `inProgress` / `completed` / `failed` / `declined`

`item/fileChange/outputDelta` 是官方保留但 deprecated 的 legacy 通知，当前项目不再用它驱动文件变更卡片。

当前官方文件变更通知仍然进入主 `timelineStore` 并聚合成文件变更卡片；同时在 `timelineDebugEnabled` 开启时，`item/fileChange/patchUpdated` 以及 `item/started` / `item/completed` 中的 `fileChange` 生命周期事件会额外写入 `debugTimelineStore`，用于查看原始官方事件。

## 后续补齐建议

如果目标是“和官方协议完全对照，并让聊天/状态 UI 完整反映官方通知”，建议按下面顺序补齐：

1. 线程状态类：处理 `thread/status/changed`、`thread/archived`、`thread/unarchived`、`thread/closed`、`thread/name/updated`。
2. 用户可见 notice 类：处理 `deprecationNotice`、`configWarning`、`windows/worldWritableWarning`、`model/rerouted`。
3. 官方时间字段：让 `startedAtMs`、`completedAtMs`、`turn.startedAt`、`turn.completedAt` 成为卡片和活动时间的权威来源。
4. 账号/MCP/app 状态类：处理 `account/updated`、`account/login/completed`、`mcpServer/oauthLogin/completed`、`app/list/updated`。
5. realtime / fuzzy search / fs watch：如果 UI 需要这些能力，再建立专门 store 和展示层。
6. 字段完整性：为 token 明细、command `cwd/processId/source`、MCP `mcpAppResourceUri`、Guardian 权限细节增加结构化 UI。
