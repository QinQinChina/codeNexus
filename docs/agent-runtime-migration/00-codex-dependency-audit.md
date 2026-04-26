# Phase 0: Codex Dependency Audit

Status: Completed

## Goal

列出当前项目中所有 Codex app-server 依赖，确认哪些可以直接映射，哪些必须重写，哪些应暂缓。

## Scope

本阶段只读代码和补文档，不改运行时行为。

## Known Starting Points

| Area | Files |
| --- | --- |
| App server process | `src/main/codexAppServer.ts`, `src/main/services/CodexServerManager.ts` |
| Protocol types | `src/generated/codex-app-server`, `src/shared/codex-protocol` |
| IPC bridge | `src/main/ipc/handlers/codex.handlers.ts`, `src/shared/ipc/contracts.ts` |
| Runtime orchestration | `src/renderer/domain/runtimeOrchestrator.ts` |
| Event pipeline | `src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts` |
| Request responder | `src/renderer/processes/protocol-request-responder/installRequestResponder.ts` |
| Approval UI | `src/renderer/stores/approval.store.ts`, `src/renderer/app/events/approvalPrompts.ts` |
| Timeline render | `src/renderer/features/timeline/renderModel` |
| History replay | `src/main/historyStore.ts`, `src/renderer/features/history`, `src/renderer/domain/runtime/historyReplayRuntime.test.ts` |

## Work Items

- [x] 统计所有直接引用 `CodexIncomingMessage`, `OfficialCodexServerNotification`, `OfficialCodexServerRequest` 的文件。
- [x] 统计所有直接引用 Codex method name 的文件，例如 `thread/start`, `item/fileChange/patchUpdated`, `turn/diff/updated`。
- [x] 把 Codex method 按能力分组：thread、turn、message、reasoning、tool、fileChange、command、approval、account、MCP、settings。
- [x] 标记每个 method 的迁移策略：map、rewrite、defer、drop。
- [x] 找出 UI 组件中直接依赖 Codex method name 的位置。
- [x] 找出 history replay 中依赖 Codex 原始事件格式的位置。
- [x] 输出 `docs/agent-runtime-migration/codex-method-inventory.md`。

## Acceptance Criteria

- [x] `codex-method-inventory.md` 包含每个已用 Codex method 的用途、调用方、迁移策略。
- [x] 能明确说明 Phase 1 需要覆盖的内部事件集合。
- [x] 能明确说明 Phase 3 第一版 OpenAI-compatible adapter 可以暂缓哪些能力。

## Suggested Commands

```powershell
rg -n "CodexIncomingMessage|OfficialCodexServerNotification|OfficialCodexServerRequest" src
rg -n '"thread/|"turn/|"item/|"command/|"serverRequest/' src
rg -n "item/fileChange|turn/diff|requestApproval|thread/start|thread/resume" src
```

## Exit Decision

只有当依赖清单完成后，才能进入 Phase 1。否则内部协议会漏事件，后续 UI 改造会反复返工。
