# Phase 1: CodeNexus Agent Protocol

Status: Completed

## Goal

定义 CodeNexus 内部 agent protocol，让 UI、timeline、approval、history 以后只消费项目自己的事件，而不是直接消费 Codex app-server method name。

## Scope

本阶段新增内部类型、事件规范和纯转换测试。Codex app-server 仍然是唯一实际 runtime。

## Proposed Event Groups

| Group | Events |
| --- | --- |
| Thread | `agent/threadStarted`, `agent/threadUpdated`, `agent/threadClosed` |
| Turn | `agent/turnStarted`, `agent/turnCompleted`, `agent/turnFailed`, `agent/turnInterrupted` |
| Message | `agent/messageStarted`, `agent/messageDelta`, `agent/messageCompleted` |
| Reasoning | `agent/reasoningDelta`, `agent/reasoningSummaryDelta` |
| Plan | `agent/planUpdated` |
| Tool | `agent/toolStarted`, `agent/toolDelta`, `agent/toolCompleted`, `agent/toolFailed` |
| File change | `agent/fileChangeStarted`, `agent/fileChangeDelta`, `agent/fileChangeSnapshot`, `agent/fileChangeCompleted` |
| Command | `agent/commandStarted`, `agent/commandOutputDelta`, `agent/commandCompleted` |
| Approval | `agent/approvalRequested`, `agent/approvalResolved` |
| Diff | `agent/turnDiffUpdated` |
| Runtime | `agent/runtimeWarning`, `agent/runtimeError`, `agent/runtimeStatusChanged` |

## Work Items

- [x] Create `src/shared/agent-protocol/types.ts`.
- [x] Create `src/shared/agent-protocol/index.ts`.
- [x] Define stable IDs: `runtimeId`, `threadId`, `turnId`, `itemId`, `eventId`.
- [x] Define `AgentEvent` discriminated union.
- [x] Define `AgentRequest` union for approvals and user input.
- [x] Define `AgentRuntimeCapabilities` for feature flags such as `streamingPatch`, `commandExecution`, `rollback`, `mcp`.
- [x] Add unit tests for event shape guards.
- [x] Add docs describing event versioning and compatibility rules.

## Acceptance Criteria

- [x] Internal protocol has no imports from `src/generated/codex-app-server`.
- [x] Internal protocol can represent existing Codex message, file change, command, approval, and turn diff events.
- [x] Type tests or runtime guard tests reject malformed event objects.
- [x] No UI behavior changes yet.

## Completed Files

| File | Purpose |
| --- | --- |
| `src/shared/agent-protocol/types.ts` | Internal CodeNexus agent protocol types, event/request guards, default capabilities |
| `src/shared/agent-protocol/index.ts` | Public export surface |
| `src/shared/agent-protocol/types.test.ts` | Guard and default capability tests |

## Verification

```powershell
pnpm exec vitest run src/shared/agent-protocol/types.test.ts
pnpm run typecheck
```

## Suggested Tests

```powershell
pnpm exec vitest run src/shared/agent-protocol
pnpm run typecheck
```

## Exit Decision

Phase 2 can start only when Codex events can be mapped into this protocol without adding Codex-specific fields to UI-facing types.
