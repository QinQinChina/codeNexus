import type { AgentMessage, ChatClient, ModelReply, ToolDefinition, ToolCall } from "./types";

/**
 * 真实的 ChatClient 实现：直连 OpenAI 兼容的 /v1/chat/completions 接口。
 *
 * 这是内核与「真实模型」之间唯一的接缝实现。只要某个 Provider 兼容
 * Chat Completions 协议（OpenAI、DeepSeek、Kimi、各类中转站、本地 ollama/vLLM…），
 * 填上 baseUrl + apiKey + model 即可驱动同一个 runAgent 内核。
 *
 * 这里刻意用「非流式」实现：内核循环不需要流式即可工作，
 * 流式只是后续优化用户体验（让文字逐字出现）时再加的东西。
 */

export type ChatCompletionsClientOptions = {
  /** 形如 https://host/v1，末尾不带斜杠。 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 单次请求超时（毫秒），默认 120s。 */
  timeoutMs?: number;
  /** 透传给上游的可选采样参数。 */
  temperature?: number;
};

type WireMessage = Record<string, unknown>;

function resolveEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/g, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/** 把内核的 AgentMessage 转成 Chat Completions 线缆格式（camelCase → snake_case）。 */
function toWireMessage(message: AgentMessage): WireMessage {
  if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content ?? "",
    };
  }
  return { role: message.role, content: message.content ?? "" };
}

/** 把工具定义转成 Chat Completions 的 tools 数组。 */
function toWireTool(tool: ToolDefinition): WireMessage {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/** 从上游返回的 message 中提取工具调用，归一成内核的 ToolCall。 */
function extractToolCalls(rawToolCalls: unknown): ToolCall[] {
  if (!Array.isArray(rawToolCalls)) return [];
  const calls: ToolCall[] = [];
  for (const raw of rawToolCalls) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const fn = record.function as Record<string, unknown> | undefined;
    const name = typeof fn?.name === "string" ? fn.name : "";
    if (!name) continue;
    calls.push({
      id: typeof record.id === "string" && record.id ? record.id : `call_${calls.length}`,
      name,
      arguments: typeof fn?.arguments === "string" ? fn.arguments : "",
    });
  }
  return calls;
}

export function createChatCompletionsClient(options: ChatCompletionsClientOptions): ChatClient {
  const endpoint = resolveEndpoint(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 120_000;

  return {
    async send(messages: AgentMessage[], tools: ToolDefinition[]): Promise<ModelReply> {
      const body: Record<string, unknown> = {
        model: options.model,
        messages: messages.map(toWireMessage),
      };
      if (tools.length > 0) body.tools = tools.map(toWireTool);
      if (typeof options.temperature === "number") body.temperature = options.temperature;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`chat/completions failed (${response.status}): ${text.slice(0, 500)}`);
      }

      const json = (await response.json()) as Record<string, unknown>;
      const choices = Array.isArray(json.choices) ? json.choices : [];
      const first = choices[0] as Record<string, unknown> | undefined;
      const message = first?.message as Record<string, unknown> | undefined;
      const content = typeof message?.content === "string" ? message.content : null;
      const toolCalls = extractToolCalls(message?.tool_calls);

      return { content, toolCalls };
    },
  };
}
