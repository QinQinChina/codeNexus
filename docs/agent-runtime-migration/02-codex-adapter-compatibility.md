# Phase 2: Codex Adapter Compatibility

Status: Not started

## Goal

把当前 Codex app-server 的 notification、request、response 转换为 CodeNexus agent protocol。此阶段必须保持现有功能不退化。

## Scope

本阶段仍使用 Codex app-server。目标是把 Codex-specific 逻辑收敛进 CodexAdapter，减少 UI 和 stores 对 Codex method name 的直接依赖。

## Mapping Targets

| Codex event/request | Internal event/request |
| --- | --- |
| `thread/started` | `agent/threadStarted` |
| `turn/started` | `agent/turnStarted` |
| `turn/completed` | `agent/turnCompleted` |
| `item/agentMessage/delta` | `agent/messageDelta` |
| `item/reasoning/*` | `agent/reasoningDelta` or `agent/reasoningSummaryDelta` |
| `turn/plan/updated` | `agent/planUpdated` |
| `item/fileChange/patchUpdated` | `agent/fileChangeSnapshot` |
| `item/fileChange/outputDelta` | `agent/toolDelta` with fileChange source |
| `turn/diff/updated` | `agent/turnDiffUpdated` |
| `item/commandExecution/outputDelta` | `agent/commandOutputDelta` |
| `item/fileChange/requestApproval` | `agent/approvalRequested` |
| `item/commandExecution/requestApproval` | `agent/approvalRequested` |
| `item/permissions/requestApproval` | `agent/approvalRequested` |
| `serverRequest/resolved` | `agent/approvalResolved` |

## Work Items

- [ ] Create `src/renderer/domain/agent/adapters/codex/codexEventMapper.ts`.
- [ ] Add mapper tests for message delta, file change snapshot, turn diff, command output, approvals.
- [ ] Create `src/renderer/domain/agent/adapters/codex/codexRequestMapper.ts`.
- [ ] Add a compatibility path in the event pipeline that emits internal events beside existing timeline behavior.
- [ ] Move file-change patch event normalization out of `installEventPipeline.ts` into mapper helpers.
- [ ] Move approval prompt normalization out of Codex-specific UI helpers into internal request helpers.
- [ ] Keep old Codex pipeline active until internal events render identical timeline output.

## Acceptance Criteria

- [ ] Existing Codex chat, file change, command output, approval, and history replay still work.
- [ ] New mapper tests cover the current `item/fileChange/patchUpdated` snapshot behavior.
- [ ] UI-facing code starts consuming internal agent events for at least message and fileChange flows.
- [ ] No direct removal of Codex app-server code in this phase.

## Suggested Tests

```powershell
pnpm exec vitest run src/renderer/app/events/protocolMethods.test.ts
pnpm exec vitest run src/renderer/processes/protocol-event-pipeline
pnpm exec vitest run src/renderer/domain/agent/adapters/codex
pnpm run typecheck
```

## Exit Decision

Proceed to Phase 3 when Codex remains stable and the internal protocol can drive core UI state.
