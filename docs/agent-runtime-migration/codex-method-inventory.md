# Codex Method Inventory

Generated during Phase 0.

## Scan Summary

The current app is not using Codex as a simple model endpoint. It depends on Codex app-server as an agent runtime that owns thread lifecycle, turn execution, tool execution, file changes, approvals, command streaming, history replay inputs, account state, MCP integration, and protocol warnings.

## Dependency Hotspots

| Area | Files | Migration Strategy |
| --- | --- | --- |
| Process lifecycle | `src/main/codexAppServer.ts`, `src/main/services/CodexServerManager.ts` | Keep as CodexAdapter internals until Phase 6 |
| Generated protocol | `src/generated/codex-app-server`, `src/shared/codex-protocol` | Keep for CodexAdapter only |
| IPC bridge | `src/main/ipc/handlers/codex.handlers.ts`, `src/shared/ipc/contracts.ts` | Introduce runtime-neutral IPC in Phases 2-5 |
| Runtime orchestration | `src/renderer/domain/runtimeOrchestrator.ts` | Gradually move provider-specific logic behind AgentAdapter |
| Event pipeline | `src/renderer/processes/protocol-event-pipeline/installEventPipeline.ts` | Extract mapping into CodexAdapter |
| Request responder | `src/renderer/processes/protocol-request-responder/installRequestResponder.ts` | Convert Codex requests into internal approval/user-input requests |
| Approval state | `src/renderer/stores/approval.store.ts`, `src/renderer/app/events/approvalPrompts.ts` | Replace Codex request names with internal approval types |
| Timeline rendering | `src/renderer/features/timeline/renderModel` | Consume internal agent events |
| History | `src/main/historyStore.ts`, `src/renderer/features/history`, `src/renderer/domain/runtime/historyReplayRuntime.test.ts` | Support both legacy Codex replay and new internal event replay |
| Remote sync | `src/main/services/RemoteStateSyncService.ts` | Map internal turn/plan events before making OpenAI-compatible runtime syncable |

## Server Requests

| Codex method | Current meaning | Strategy | Internal target |
| --- | --- | --- | --- |
| `item/fileChange/requestApproval` | Ask user to allow a file change | Map, then rewrite | `agent/approvalRequested` with `kind: "fileChange"` |
| `item/commandExecution/requestApproval` | Ask user to allow command execution | Map, then rewrite | `agent/approvalRequested` with `kind: "command"` |
| `item/permissions/requestApproval` | Ask user to allow broader permission change | Map, then rewrite | `agent/approvalRequested` with `kind: "permission"` |
| `item/tool/requestUserInput` | Ask user for tool input | Defer for MVP | `agent/userInputRequested` |
| `mcpServer/elicitation/request` | MCP elicitation request | Defer | MCP-specific internal request |
| `item/tool/call` | Dynamic tool call bridge | Defer | Runtime tool call request |
| `account/chatgptAuthTokens/refresh` | Refresh ChatGPT auth tokens | Keep Codex-only | CodexAdapter internal |
| `applyPatchApproval` | Legacy patch approval request | Map for compatibility | `agent/approvalRequested` with `kind: "fileChange"` |
| `execCommandApproval` | Legacy command approval request | Map for compatibility | `agent/approvalRequested` with `kind: "command"` |

## Core Server Notifications

| Codex method | Current meaning | Strategy | Internal target |
| --- | --- | --- | --- |
| `thread/started` | Thread metadata became available | Map | `agent/threadStarted` |
| `thread/status/changed` | Thread running/idle status changed | Map | `agent/runtimeStatusChanged` |
| `thread/name/updated` | Thread title changed | Map | `agent/threadUpdated` |
| `thread/tokenUsage/updated` | Token usage update | Map | `agent/threadUpdated` or telemetry event |
| `turn/started` | Turn began | Map | `agent/turnStarted` |
| `turn/completed` | Turn ended | Map | `agent/turnCompleted` or `agent/turnFailed` |
| `turn/plan/updated` | Plan changed | Map | `agent/planUpdated` |
| `turn/diff/updated` | Aggregated turn diff changed | Map | `agent/turnDiffUpdated` |
| `item/started` | Thread item began | Map by item type | `agent/messageStarted`, `agent/toolStarted`, `agent/fileChangeStarted`, `agent/commandStarted` |
| `item/completed` | Thread item completed | Map by item type | `agent/messageCompleted`, `agent/toolCompleted`, `agent/fileChangeCompleted`, `agent/commandCompleted` |
| `item/agentMessage/delta` | Assistant text delta | Map | `agent/messageDelta` |
| `item/plan/delta` | Plan text delta | Map | `agent/planUpdated` |
| `item/reasoning/textDelta` | Reasoning text delta | Map | `agent/reasoningDelta` |
| `item/reasoning/summaryTextDelta` | Reasoning summary delta | Map | `agent/reasoningSummaryDelta` |
| `item/reasoning/summaryPartAdded` | Reasoning summary part created | Map | `agent/reasoningSummaryDelta` |
| `item/fileChange/patchUpdated` | File patch snapshot update | Map | `agent/fileChangeSnapshot` |
| `item/fileChange/outputDelta` | File change tool output text | Map as optional diagnostic | `agent/toolDelta` |
| `item/commandExecution/outputDelta` | Command output stream | Map | `agent/commandOutputDelta` |
| `item/commandExecution/terminalInteraction` | Terminal interaction metadata | Map in Phase 4 | `agent/commandUpdated` |
| `command/exec/outputDelta` | Streaming output from raw command RPC | Map for command tool | `agent/commandOutputDelta` |
| `serverRequest/resolved` | A server request was resolved | Map | `agent/approvalResolved` |
| `fs/changed` | Filesystem watcher changed | Map as calibration | `agent/filesChanged` |
| `warning` | Runtime warning | Map | `agent/runtimeWarning` |
| `guardianWarning` | Guardian warning | Map | `agent/runtimeWarning` with security severity |
| `configWarning` | Config warning | Map | `agent/runtimeWarning` |
| `deprecationNotice` | Protocol/runtime deprecation | Map | `agent/runtimeWarning` |

## Deferred Notifications

| Codex method group | Reason |
| --- | --- |
| `item/mcpToolCall/progress`, `mcpServer/*` | MCP productization is not part of the first OpenAI-compatible runtime |
| `account/*` | Provider account state differs between Codex and OpenAI-compatible providers |
| `app/list/updated`, `skills/changed`, `plugin/*` | Plugin and skill management should remain Codex-only until a generic plugin model exists |
| `thread/realtime/*` | Voice/realtime flows are separate from text/code agent migration |
| `model/rerouted`, `model/verification` | Provider-specific model lifecycle; map only after model registry abstraction exists |
| `windows/*`, `windowsSandbox/*` | Keep as runtime warnings or CodexAdapter-only until sandbox abstraction is rewritten |

## Client RPCs Used By Current Runtime

| Codex method group | Current purpose | Replacement requirement |
| --- | --- | --- |
| `initialize` | App-server handshake and capabilities | Runtime-neutral adapter initialization |
| `thread/start`, `thread/resume`, `thread/read`, `thread/list` | Thread lifecycle and history | Internal thread service |
| `turn/start`, `turn/steer`, `turn/interrupt` | Turn execution and interruption | Internal runtime turn state machine |
| `thread/rollback` | Rollback a turn | Internal file snapshot/diff rollback |
| `thread/name/set`, `thread/metadata/update` | Thread metadata updates | Internal thread store updates |
| `model/list` | Model discovery | Provider registry |
| `command/exec*` | Raw command execution bridge | Internal command tool service |
| `fs/*` | File read/write/watch utilities | Internal workspace filesystem service |
| `mcpServer/*` | MCP resources and tools | Deferred generic MCP adapter |
| `account/*` | Login, logout, account and rate limits | Provider-specific account modules |

## MVP Boundary For OpenAI-Compatible Runtime

The first OpenAI-compatible implementation should include:

- Thread and turn lifecycle.
- Streaming assistant message output.
- Basic model/provider configuration.
- File read/list tools.
- Patch proposal and application through `WorkspacePatchService`.
- File and command approvals.
- Command execution with streamed output.
- Persisted history and replay after Phase 5.

The first implementation should defer:

- MCP server tool calls.
- Marketplace and plugin management.
- Realtime audio.
- ChatGPT account token refresh.
- Codex-specific guardian auto-review internals.
- Remote sync of OpenAI-compatible threads until internal events are stable.

## Phase 1 Internal Events Required

Phase 1 must define at least these events:

- `agent/threadStarted`
- `agent/threadUpdated`
- `agent/turnStarted`
- `agent/turnCompleted`
- `agent/turnFailed`
- `agent/messageStarted`
- `agent/messageDelta`
- `agent/messageCompleted`
- `agent/reasoningDelta`
- `agent/reasoningSummaryDelta`
- `agent/planUpdated`
- `agent/toolStarted`
- `agent/toolDelta`
- `agent/toolCompleted`
- `agent/fileChangeStarted`
- `agent/fileChangeSnapshot`
- `agent/fileChangeCompleted`
- `agent/turnDiffUpdated`
- `agent/commandStarted`
- `agent/commandOutputDelta`
- `agent/commandCompleted`
- `agent/approvalRequested`
- `agent/approvalResolved`
- `agent/runtimeWarning`
- `agent/runtimeError`
