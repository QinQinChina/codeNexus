# Phase 6: Codex App Server Removal

Status: Blocked until Phases 0-5 are complete

## Goal

在自研 runtime 覆盖核心能力后，删除或降级 Codex app-server 依赖，使 CodeNexus 不再必须启动 `codex app-server`。

## Preconditions

- [ ] Internal agent protocol is the only UI-facing runtime protocol.
- [ ] OpenAI-compatible runtime supports chat, tools, file changes, command execution, approvals, history, and rollback.
- [ ] Old Codex history has a replay compatibility path.
- [ ] Users can export or preserve old Codex thread metadata.
- [ ] There is a documented rollback plan for re-enabling CodexAdapter.

## Work Items

- [ ] Move CodexAdapter behind optional runtime plugin loading.
- [ ] Remove mandatory startup of `CodexServerManager`.
- [ ] Replace Codex-specific IPC names with runtime-neutral IPC names.
- [ ] Keep a read-only legacy replay parser for old Codex events.
- [ ] Remove direct UI imports from `src/shared/codex-protocol`.
- [ ] Remove direct UI imports from `src/generated/codex-app-server`.
- [ ] Update docs and README to describe the new runtime model.
- [ ] Run full regression on chat, file editing, command execution, approvals, history, rollback, and packaging.

## Acceptance Criteria

- [ ] App starts without global `@openai/codex` installed.
- [ ] New tasks run on CodeNexus runtime.
- [ ] Old Codex histories remain readable.
- [ ] Build and dist commands pass.
- [ ] No user-facing feature relies on Codex app-server being present.

## Suggested Tests

```powershell
pnpm run typecheck
pnpm exec vitest run
pnpm run build
pnpm run dist
```

## Exit Decision

Codex app-server can be deleted only when this document is fully checked and there is at least one release candidate build verified without Codex installed.
