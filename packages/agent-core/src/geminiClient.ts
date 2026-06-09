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
 * Google Gemini（Generative Language API）的 ChatClient 实现。
 *
 * 与 Chat Completions 的主要差异（已在此吸收，内核无感知）：
 * - 端点是 `.../v1beta/models/{model}:generateContent`，鉴权用 `x-goog-api-key` 头
 * - 角色用 user / model（assistant→model）；system 走顶层 `systemInstruction`
 * - 消息是 `contents[].parts[]`；工具调用是 `functionCall` part，结果回传为 `functionResponse` part
 * - functionResponse 用函数名（非 id）关联，这里据 assistant 的 functionCall 建 id→name 映射
 *
 * send 走 generateContent、stream 走 streamGenerateContent?alt=sse（SSE）皆已实现，内核优先走 stream；
 * 思考按 options.thinking 开启（thinkingConfig.includeThoughts，把 thought parts 当推理解析）。
 * 提示：也可把 baseUrl 指向 Gemini 的 OpenAI 兼容端点，改用 createChatCompletionsClient——但本实现走原生 generateContent，能力更完整。
 */
export type GeminiClientOptions = {
  /** 形如 https://generativelanguage.googleapis.com，末尾不带斜杠。 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** generationConfig.maxOutputTokens；默认不设（用服务端默认）。 */
  maxOutputTokens?: number;
  /** 单次请求超时（毫秒），默认 120s。 */
  timeoutMs?: number;
  /** 开启思考：发送 thinkingConfig.includeThoughts，并把 thought parts 当推理解析。 */
  thinking?: boolean;
};

type Part = Record<string, unknown>;
type WireContent = { role: "user" | "model"; parts: Part[] };

function resolveEndpoint(
  baseUrl: string,
  model: string,
  streaming: boolean,
): string {
  const trimmed = baseUrl.trim().replace(/\/+$/g, "");
  if (/:(stream)?generatecontent(\?.*)?$/i.test(trimmed)) return trimmed;
  const base = /\/v1(beta)?$/i.test(trimmed) ? trimmed : `${trimmed}/v1beta`;
  const method = streaming ? "streamGenerateContent" : "generateContent";
  const suffix = streaming ? "?alt=sse" : "";
  return `${base}/models/${encodeURIComponent(model)}:${method}${suffix}`;
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

/** 工具结果文本：能解析成对象就直接用，否则包成 { result: <text> }，满足 functionResponse.response 需为对象。 */
function toFunctionResponseObject(
  content: string | null,
): Record<string, unknown> {
  const text = content ?? "";
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // ignore
  }
  return { result: text };
}

function buildToolNameById(messages: AgentMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of messages) {
    for (const call of message.toolCalls ?? []) map.set(call.id, call.name);
  }
  return map;
}

function toWireContent(
  message: AgentMessage,
  toolNameById: Map<string, string>,
): WireContent | null {
  if (message.role === "system") return null;
  if (message.role === "tool") {
    const name =
      (message.toolCallId && toolNameById.get(message.toolCallId)) ||
      message.toolCallId ||
      "tool";
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name,
            response: toFunctionResponseObject(message.content),
          },
        },
      ],
    };
  }
  if (message.role === "assistant") {
    const parts: Part[] = [];
    if (message.content) parts.push({ text: message.content });
    for (const call of message.toolCalls ?? []) {
      parts.push({
        functionCall: {
          name: call.name,
          args: safeParseObject(call.arguments),
        },
      });
    }
    if (parts.length === 0) parts.push({ text: "" });
    return { role: "model", parts };
  }
  return { role: "user", parts: [{ text: message.content ?? "" }] };
}

/** 合并相邻同 role 的 content，满足 Gemini 的 user/model 交替结构。 */
function coalesce(contents: WireContent[]): WireContent[] {
  const out: WireContent[] = [];
  for (const content of contents) {
    const last = out[out.length - 1];
    if (last && last.role === content.role) last.parts.push(...content.parts);
    else out.push({ role: content.role, parts: [...content.parts] });
  }
  return out;
}

function extractToolCalls(parts: unknown[]): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const fnCall = (part as Record<string, unknown>).functionCall;
    if (!fnCall || typeof fnCall !== "object") continue;
    const record = fnCall as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) continue;
    calls.push({
      id: `call_${calls.length}`,
      name,
      arguments: JSON.stringify(record.args ?? {}),
    });
  }
  return calls;
}

export function createGeminiClient(options: GeminiClientOptions): ChatClient {
  const endpoint = resolveEndpoint(options.baseUrl, options.model, false);
  const streamEndpoint = resolveEndpoint(options.baseUrl, options.model, true);
  const timeoutMs = options.timeoutMs ?? 120_000;

  const buildBody = (
    messages: AgentMessage[],
    tools: ToolDefinition[],
  ): Record<string, unknown> => {
    const systemText = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content ?? "")
      .filter(Boolean)
      .join("\n\n");
    const toolNameById = buildToolNameById(messages);
    const contents = coalesce(
      messages
        .map((message) => toWireContent(message, toolNameById))
        .filter((content): content is WireContent => content !== null),
    );

    const body: Record<string, unknown> = { contents };
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
    if (tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        },
      ];
    }
    const generationConfig: Record<string, unknown> = {};
    if (
      typeof options.maxOutputTokens === "number" &&
      options.maxOutputTokens > 0
    ) {
      generationConfig.maxOutputTokens = options.maxOutputTokens;
    }
    if (options.thinking === true) {
      generationConfig.thinkingConfig = { includeThoughts: true };
    }
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }
    return body;
  };

  return {
    async send(
      messages: AgentMessage[],
      tools: ToolDefinition[],
    ): Promise<ModelReply> {
      const body = buildBody(messages, tools);

      const response = await postJson(endpoint, {
        headers: { "x-goog-api-key": options.apiKey },
        body,
        timeoutMs,
        errorLabel: "gemini generateContent",
      });

      const json = (await response.json()) as Record<string, unknown>;
      const candidates = Array.isArray(json.candidates) ? json.candidates : [];
      const first = candidates[0] as Record<string, unknown> | undefined;
      const content = first?.content as Record<string, unknown> | undefined;
      const parts = Array.isArray(content?.parts)
        ? (content?.parts as unknown[])
        : [];
      const objParts = parts.filter(
        (part): part is Record<string, unknown> =>
          Boolean(part) && typeof part === "object",
      );
      const text = objParts
        .filter(
          (part) => part.thought !== true && typeof part.text === "string",
        )
        .map((part) => part.text as string)
        .join("");
      const reasoning =
        objParts
          .filter(
            (part) => part.thought === true && typeof part.text === "string",
          )
          .map((part) => part.text as string)
          .join("") || null;
      const toolCalls = extractToolCalls(parts);

      return { content: text || null, toolCalls, reasoning };
    },

    async stream(
      messages: AgentMessage[],
      tools: ToolDefinition[],
      handlers: ChatStreamHandlers,
    ): Promise<ModelReply> {
      const body = buildBody(messages, tools);

      const response = await postJson(streamEndpoint, {
        headers: { "x-goog-api-key": options.apiKey },
        body,
        timeoutMs,
        errorLabel: "gemini streamGenerateContent",
        stream: true,
      });

      let content = "";
      let reasoning = "";
      const calls: ToolCall[] = [];
      for await (const { data } of readSseBlocks(response)) {
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }
        const candidates = Array.isArray(chunk.candidates)
          ? chunk.candidates
          : [];
        const first = candidates[0] as Record<string, unknown> | undefined;
        const contentObj = first?.content as
          | Record<string, unknown>
          | undefined;
        const parts = Array.isArray(contentObj?.parts)
          ? (contentObj?.parts as unknown[])
          : [];
        for (const part of parts) {
          if (!part || typeof part !== "object") continue;
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string" && record.text) {
            if (record.thought === true) {
              reasoning += record.text;
              handlers.onReasoningDelta?.(record.text);
            } else {
              content += record.text;
              handlers.onTextDelta(record.text);
            }
          }
          const fnCall = record.functionCall as
            | Record<string, unknown>
            | undefined;
          if (
            fnCall &&
            typeof fnCall === "object" &&
            typeof fnCall.name === "string" &&
            fnCall.name
          ) {
            calls.push({
              id: `call_${calls.length}`,
              name: fnCall.name,
              arguments: JSON.stringify(fnCall.args ?? {}),
            });
          }
        }
      }

      return {
        content: content || null,
        toolCalls: calls,
        reasoning: reasoning || null,
      };
    },
  };
}
