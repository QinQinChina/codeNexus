# Phase 5: History, Rollback, Cutover

Status: Not started

## Goal

补齐自研 runtime 的持久化、历史回放、diff 聚合、回滚和灰度切换能力，使 OpenAI-compatible runtime 可以承担真实项目任务。

## Scope

本阶段不删除 Codex app-server。重点是把新 runtime 的历史结构稳定下来，并保证老 Codex 线程可继续回放。

## Work Items

- [ ] Define persisted `AgentThreadRecord` and `AgentTurnRecord`.
- [ ] Add migration-safe storage version for internal agent events.
- [ ] Save OpenAI-compatible runtime events to history store.
- [ ] Add replay parser for internal agent events.
- [ ] Keep existing Codex replay parser for old history.
- [ ] Implement turn-level aggregated diff storage.
- [ ] Implement rollback for file changes produced by OpenAI-compatible runtime.
- [ ] Add runtime selector per new thread.
- [ ] Add workspace-level default runtime setting.
- [ ] Add feature flag for OpenAI-compatible runtime availability.

## Acceptance Criteria

- [ ] A completed OpenAI-compatible thread survives app restart.
- [ ] Timeline replay works without contacting model provider.
- [ ] File change diff can be reviewed after restart.
- [ ] Rollback restores modified files for accepted patches.
- [ ] Existing Codex threads still replay correctly.
- [ ] Users can choose runtime for new threads without affecting old threads.

## Suggested Tests

```powershell
pnpm exec vitest run src/main/historyStore
pnpm exec vitest run src/renderer/features/history
pnpm exec vitest run src/renderer/domain/runtime/historyReplayRuntime.test.ts
pnpm run typecheck
```

## Exit Decision

Proceed to Phase 6 only after OpenAI-compatible runtime has been used successfully on representative local coding tasks.
