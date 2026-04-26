# Agent Runtime Migration Progress

目标：把当前直接依赖 Codex app-server 的运行时，逐步迁移为 CodeNexus 自己的 agent protocol，并在其下接入 CodexAdapter、OpenAICompatibleAdapter，以及后续可选的 ClaudeAdapter。

当前策略：先双栈运行，不直接删除 Codex app-server。只有当自研 OpenAI-compatible runtime 覆盖聊天、工具调用、文件修改、审批、历史和回滚后，才进入默认切换和删除阶段。

## Overall Status

| Phase | Document | Status | Exit Result |
| --- | --- | --- | --- |
| 0 | [Codex Dependency Audit](./00-codex-dependency-audit.md) | Completed | 明确所有 Codex 协议依赖和替换边界 |
| 1 | [CodeNexus Agent Protocol](./01-codenexus-agent-protocol.md) | Completed | UI 可消费稳定的内部 agent events |
| 2 | [Codex Adapter Compatibility](./02-codex-adapter-compatibility.md) | Not started | 现有 Codex 功能通过内部协议保持可用 |
| 3 | [OpenAI-Compatible Core Adapter](./03-openai-compatible-core-adapter.md) | Not started | OpenAI-compatible 模型可完成基础聊天和流式回复 |
| 4 | [Tools, File Changes, Commands](./04-tools-file-changes-commands.md) | Not started | 自研 adapter 可读写文件、应用 patch、运行命令并显示 diff |
| 5 | [History, Rollback, Cutover](./05-history-rollback-cutover.md) | Not started | 自研 runtime 支持恢复、回放、回滚和灰度切换 |
| 6 | [Codex App Server Removal](./06-codex-app-server-removal.md) | Blocked | 删除 Codex app-server 依赖，保留迁移兼容层 |

## Execution Rules

- 每次只推进一个 phase，不跨阶段改代码。
- 每个 phase 先补测试，再改实现。
- 每个 phase 完成后运行该文档列出的测试命令。
- Codex app-server 在 Phase 6 前必须保留为默认可回退路径。
- UI 层最终只允许依赖 CodeNexus agent events，不直接依赖 Codex method names。

## Shared Vocabulary

| Term | Meaning |
| --- | --- |
| Codex protocol | 当前 `src/generated/codex-app-server` 和 `src/shared/codex-protocol` 定义的官方 app-server 协议 |
| CodeNexus agent protocol | 本项目内部稳定事件模型，用来隔离 UI 和不同 agent runtime |
| Adapter | 把外部 runtime 或模型 API 映射到 CodeNexus agent protocol 的模块 |
| Runtime | 管理 thread、turn、tool、approval、history、rollback 的执行层 |
| OpenAI-compatible API | 兼容 `/v1/chat/completions` 或类似 OpenAI schema 的模型服务 |

## Completion Definition

迁移完成需要同时满足：

- 新线程可以选择 Codex 或 OpenAI-compatible runtime。
- OpenAI-compatible runtime 支持文本流、工具调用、文件修改、命令执行和审批。
- 历史记录和时间线不依赖 Codex 原始事件。
- 老 Codex 历史可以继续回放。
- 删除 Codex app-server 后，核心 IDE agent 流程仍可用。
