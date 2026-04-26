# Phase 3: OpenAI-Compatible Core Adapter

Status: Not started

## Goal

新增 OpenAI-compatible adapter 的基础能力：模型配置、线程启动、turn 执行、文本流式输出、错误处理。第一版不做文件修改和命令执行。

## Scope

本阶段只实现基础聊天。它不替换 Codex 默认路径。

## Adapter Responsibilities

| Responsibility | First Version |
| --- | --- |
| Provider config | `baseUrl`, `apiKey`, `model`, optional headers |
| Thread state | In-memory first, persisted in Phase 5 |
| Turn state | started, streaming, completed, failed |
| Streaming | Convert response chunks to `agent/messageDelta` |
| Tool calls | Detect but return unsupported message until Phase 4 |
| Cancellation | AbortController for active request |
| Errors | Convert HTTP/API errors to `agent/runtimeError` |

## Work Items

- [ ] Create `src/main/services/openaiCompatible/OpenAICompatibleClient.ts`.
- [ ] Create `src/main/services/openaiCompatible/types.ts`.
- [ ] Add secure provider settings storage or reuse existing local settings extension point.
- [ ] Create renderer adapter entry `src/renderer/domain/agent/adapters/openaiCompatible`.
- [ ] Implement basic `startTurn` with streaming text.
- [ ] Emit `agent/turnStarted`, `agent/messageStarted`, `agent/messageDelta`, `agent/messageCompleted`, `agent/turnCompleted`.
- [ ] Add abort handling and map it to `agent/turnInterrupted`.
- [ ] Add UI runtime selector behind an experimental flag.

## Acceptance Criteria

- [ ] User can start a new experimental OpenAI-compatible chat thread.
- [ ] Streaming text appears in the same timeline UI path as Codex output.
- [ ] Network/API errors show as runtime errors without breaking the app.
- [ ] Codex remains the default runtime.

## Suggested Tests

```powershell
pnpm exec vitest run src/main/services/openaiCompatible
pnpm exec vitest run src/renderer/domain/agent/adapters/openaiCompatible
pnpm run typecheck
```

## Exit Decision

Proceed to Phase 4 only after basic chat is stable and interruption works.
