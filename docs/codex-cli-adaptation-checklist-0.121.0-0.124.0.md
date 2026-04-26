# Codex CLI 0.121.0 ~ 0.124.0 兼容适配清单

## 当前结论

- 当前仓库协议生成基线已升级到 `@openai/codex@0.124.0`。
- 本轮采用“兼容优先”：同步 generated 类型、补齐 RPC result map、注册新增 server notification，确保新 app-server 消息不会被误判为未知协议。
- Marketplace、Device Key、MCP tool call、Thread turns、Thread inject items 暂不做完整产品化 UI，仅保留类型与 RPC 映射。

## 已接入类型面

| 类型面 | 当前状态 | 说明 |
| --- | --- | --- |
| Generated protocol | ✅ 已同步 | `src/generated/codex-app-server` 已按 `0.124.0` 重新生成 |
| RPC result map | ✅ 已补齐 | 新增 marketplace、device key、MCP tool call、thread turns、thread inject items、Guardian denied action、add credits nudge 映射 |
| Server notifications | ✅ 已注册 | 新增 file patch、external agent import completed、model verification、warning、guardian warning、realtime notifications |
| Server requests | ✅ 已复核 | `0.124.0` 当前未新增 server request；现有 request responder 保持安全兜底 |

## 暂缓产品化能力

| 能力 | 暂缓原因 |
| --- | --- |
| Marketplace add/remove UI | 本轮只做协议兼容，避免扩大插件管理交互范围 |
| Device key 管理 UI | 涉及远程身份和密钥保存策略，需要单独设计 |
| MCP tool call 手动入口 | 需要参数表单、权限提示、结果展示和错误处理设计 |
| Thread turns 独立时间线 | 当前历史回放已有既有路径，turns list 可后续替换或增强 |
| Thread inject items | 属于高级协议能力，需要明确来源标识和安全边界 |

## 回归重点

- `pnpm run typecheck`
- `pnpm exec vitest run src/renderer/app/events/protocolMethods.test.ts`
- MCP resource 读取、thread start/resume/read、approval prompt、timeline event pipeline 基础回归。
