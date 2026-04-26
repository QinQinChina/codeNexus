# Phase 4: Tools, File Changes, Commands

Status: Not started

## Goal

让 OpenAI-compatible adapter 具备 agent 能力：读取文件、生成和应用 patch、运行命令、展示 diff、处理审批。

## Scope

本阶段实现最小可用工具集。MCP、插件市场、复杂 skills 暂缓。

## Required Tools

| Tool | Purpose | Approval |
| --- | --- | --- |
| `read_file` | 读取工作区文件 | No approval inside workspace |
| `list_files` | 搜索或列出文件 | No approval inside workspace |
| `apply_patch` | 应用 unified diff | Approval required when policy says so |
| `write_file` | 创建或覆盖文件 | Approval required |
| `run_command` | 执行 shell command | Approval required by command policy |

## File Change Events

| Internal event | When emitted |
| --- | --- |
| `agent/fileChangeStarted` | Tool call begins modifying files |
| `agent/fileChangeDelta` | Adapter can parse partial patch text safely |
| `agent/fileChangeSnapshot` | Complete validated patch is available |
| `agent/fileChangeCompleted` | Patch applied or declined/failed |
| `agent/turnDiffUpdated` | Aggregated diff changes |

## Work Items

- [ ] Create `src/main/services/agentTools/WorkspaceReadTool.ts`.
- [ ] Create `src/main/services/agentTools/WorkspacePatchTool.ts`.
- [ ] Reuse or wrap `src/main/services/WorkspacePatchService.ts` for patch parsing and application.
- [ ] Create `src/main/services/agentTools/CommandTool.ts`.
- [ ] Define command policy: allowed, approval required, denied.
- [ ] Add approval request bridge using internal `agent/approvalRequested`.
- [ ] Add tests for patch add, update, delete, rename, failed apply, declined approval.
- [ ] Add tests for command output streaming and termination.
- [ ] Add UI rendering for OpenAI-compatible file change events using the existing file change timeline components.

## Acceptance Criteria

- [ ] OpenAI-compatible runtime can read a file and propose an edit.
- [ ] Proposed file edits appear as diff before applying.
- [ ] User can accept or decline file modifications.
- [ ] Accepted patch is applied to disk and reflected in timeline/history.
- [ ] Command execution streams output and can be cancelled.
- [ ] Dangerous or out-of-workspace operations are blocked or require explicit approval.

## Suggested Tests

```powershell
pnpm exec vitest run src/main/services/WorkspacePatchService.test.ts
pnpm exec vitest run src/main/services/agentTools
pnpm exec vitest run src/renderer/stores/approval.store
pnpm run typecheck
```

## Exit Decision

Proceed to Phase 5 when OpenAI-compatible runtime can complete a small code edit task end to end.
