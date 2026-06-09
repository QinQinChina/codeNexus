import type {
  AgentMessage,
  ChatClient,
  ChatStreamHandlers,
  ModelReply,
  ToolCall,
  ToolDefinition,
} from "./types";
import { readSseBlocks } from "./sse";
import { postJson } from "./http";

/**
 * Anthropic Messages API 的 ChatClient 实现。
 *
 * 与 Chat Completions 的主要差异（已在此吸收，内核无感知）：
 * - 鉴权用 `x-api-key` + `anthropic-version`，不是 `Authorization: Bearer`
 * - `system` 是顶层参数，不是一条消息；`max_tokens` 必填
 * - 工具调用是 content block（assistant 的 `tool_use`，结果回传为 user 的 `tool_result`）
 * - 模型发起的工具入参是对象（这里转回内核约定的 JSON 字符串）
 *
 * send（非流式）与 stream（SSE：content_block_delta 累积 text/thinking、input_json_delta 累积工具入参）皆已实现，内核优先走 stream。
 * thinking 默认关闭（按 options.thinking 显式开启，避免对不支持的模型报错）；不发送 temperature 以最大化兼容性。
 */
export type AnthropicClientOptions = {
  /** 形如 https://api.anthropic.com，末尾不带斜杠。 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Anthropic 要求 max_tokens 必填，默认 4096。 */
  maxTokens?: number;
  /** 单次请求超时（毫秒），默认 120s。 */
  timeoutMs?: number;
  /** anthropic-version 头，默认 2023-06-01。 */
  anthropicVersion?: string;
  /** 开启扩展思考（Claude thinking）：发送 thinking 参数并解析 thinking 块。 */
  thinking?: boolean;
  /** thinking 预算 tokens（开启时生效，最小 1024），默认 2048；max_tokens 会被抬到 > 预算。 */
  thinkingBudgetTokens?: number;
};

type Block = Record<string, unknown>;
type WireMessage = { role: "user" | "assistant"; content: Block[] };

function resolveEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/g, "");
  if (/\/messages$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 把内核消息转成 Anthropic 的 user/assistant 块；system 在外部单独抽取，这里返回 null。 */
function toWireMessage(message: AgentMessage): WireMessage | null {
  if (message.role === "system") return null;
  if (message.role === "tool") {
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: message.toolCallId ?? "",
          content: message.content ?? "",
        },
      ],
    };
  }
  if (message.role === "assistant") {
    const content: Block[] = [];
    if (message.content) content.push({ type: "text", text: message.content });
    for (const call of message.toolCalls ?? []) {
      content.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: safeParseObject(call.arguments),
      });
    }
    if (content.length === 0) content.push({ type: "text", text: "" });
    return { role: "assistant", content };
  }
  return {
    role: "user",
    content: [{ type: "text", text: message.content ?? "" }],
  };
}

/** 合并相邻同 role 的消息，满足 Anthropic 对话结构（尤其多个 tool_result 合并进同一 user 轮）。 */
function coalesce(messages: WireMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  for (const message of messages) {
    const last = out[out.length - 1];
    if (last && last.role === message.role)
      last.content.push(...message.content);
    else out.push({ role: message.role, content: [...message.content] });
  }
  return out;
}

function toWireTool(tool: ToolDefinition): Block {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

function extractToolCalls(content: unknown[]): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (record.type !== "tool_use") continue;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    calls.push({
      id:
        typeof record.id === "string" && record.id
          ? record.id
          : `call_${calls.length}`,
      name,
      arguments: JSON.stringify(record.input ?? {}),
    });
  }
  return calls;
}

export function createAnthropicClient(
  options: AnthropicClientOptions,
): ChatClient {
  const endpoint = resolveEndpoint(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxTokens =
    options.maxTokens && options.maxTokens > 0 ? options.maxTokens : 4096;
  const version = options.anthropicVersion ?? "2023-06-01";
  const thinkingEnabled = options.thinking === true;
  const thinkingBudget =
    options.thinkingBudgetTokens && options.thinkingBudgetTokens >= 1024
      ? options.thinkingBudgetTokens
      : 2048;
  // Anthropic 要求 max_tokens 严格大于 budget_tokens。
  const effectiveMaxTokens = thinkingEnabled
    ? Math.max(maxTokens, thinkingBudget + 1024)
    : maxTokens;

  return {
    async send(
      messages: AgentMessage[],
      tools: ToolDefinition[],
    ): Promise<ModelReply> {
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content ?? "")
        .filter(Boolean)
        .join("\n\n");
      const wire = coalesce(
        messages
          .map(toWireMessage)
          .filter((message): message is WireMessage => message !== null),
      );

      const body: Record<string, unknown> = {
        model: options.model,
        max_tokens: effectiveMaxTokens,
        messages: wire,
      };
      if (system) body.system = system;
      if (tools.length > 0) body.tools = tools.map(toWireTool);
      if (thinkingEnabled) {
        body.thinking = { type: "enabled", budget_tokens: thinkingBudget };
      }

      const response = await postJson(endpoint, {
        headers: { "x-api-key": options.apiKey, "anthropic-version": version },
        body,
        timeoutMs,
        errorLabel: "anthropic messages",
      });

      const json = (await response.json()) as Record<string, unknown>;
      const content = Array.isArray(json.content) ? json.content : [];
      const blocks = content.filter(
        (block): block is Record<string, unknown> =>
          Boolean(block) && typeof block === "object",
      );
      const text = blocks
        .filter(
          (block) => block.type === "text" && typeof block.text === "string",
        )
        .map((block) => block.text as string)
        .join("");
      const reasoning =
        blocks
          .filter(
            (block) =>
              block.type === "thinking" && typeof block.thinking === "string",
          )
          .map((block) => block.thinking as string)
          .join("") || null;
      const toolCalls = extractToolCalls(content);

      return { content: text || null, toolCalls, reasoning };
    },

    async stream(
      messages: AgentMessage[],
      tools: ToolDefinition[],
      handlers: ChatStreamHandlers,
    ): Promise<ModelReply> {
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content ?? "")
        .filter(Boolean)
        .join("\n\n");
      const wire = coalesce(
        messages
          .map(toWireMessage)
          .filter((message): message is WireMessage => message !== null),
      );

      const body: Record<string, unknown> = {
        model: options.model,
        max_tokens: effectiveMaxTokens,
        messages: wire,
        stream: true,
      };
      if (system) body.system = system;
      if (tools.length > 0) body.tools = tools.map(toWireTool);
      if (thinkingEnabled) {
        body.thinking = { type: "enabled", budget_tokens: thinkingBudget };
      }

      const response = await postJson(endpoint, {
        headers: { "x-api-key": options.apiKey, "anthropic-version": version },
        body,
        timeoutMs,
        errorLabel: "anthropic messages stream",
        stream: true,
      });

      let content = "";
      let reasoning = "";
      const toolBlocks = new Map<
        number,
        { id: string; name: string; json: string }
      >();
      for await (const { data } of readSseBlocks(response)) {
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (evt.type === "content_block_start") {
          const block = evt.content_block as
            | Record<string, unknown>
            | undefined;
          if (block?.type === "tool_use") {
            const index =
              typeof evt.index === "number" ? evt.index : toolBlocks.size;
            toolBlocks.set(index, {
              id: typeof block.id === "string" ? block.id : `call_${index}`,
              name: typeof block.name === "string" ? block.name : "",
              json: "",
            });
          }
        } else if (evt.type === "content_block_delta") {
          const delta = evt.delta as Record<string, unknown> | undefined;
          if (
            delta?.type === "text_delta" &&
            typeof delta.text === "string" &&
            delta.text
          ) {
            content += delta.text;
            handlers.onTextDelta(delta.text);
          } else if (
            delta?.type === "thinking_delta" &&
            typeof delta.thinking === "string" &&
            delta.thinking
          ) {
            reasoning += delta.thinking;
            handlers.onReasoningDelta?.(delta.thinking);
          } else if (
            delta?.type === "input_json_delta" &&
            typeof delta.partial_json === "string"
          ) {
            const index = typeof evt.index === "number" ? evt.index : 0;
            const block = toolBlocks.get(index);
            if (block) block.json += delta.partial_json;
          }
        }
      }

      const toolCalls: ToolCall[] = [...toolBlocks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, block]) => ({
          id: block.id,
          name: block.name,
          arguments: block.json || "{}",
        }))
        .filter((call) => call.name);

      return {
        content: content || null,
        toolCalls,
        reasoning: reasoning || null,
      };
    },
  };
}
