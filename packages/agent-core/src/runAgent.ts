import type {
  AgentMessage,
  ChatClient,
  RunAgentOptions,
  RunAgentResult,
  ToolCall,
  ToolDefinition,
} from "./types";

const DEFAULT_MAX_STEPS = 16;

/**
 * 把模型生成的 JSON 字符串参数安全地解析成对象。
 *
 * 模型偶尔会吐出空串、非法 JSON 或非对象（如数组/数字），这里统一兜底为 {}，
 * 把「参数到底合不合法」的判断交给工具自身，避免内核因解析失败直接崩溃。
 */
function parseToolArguments(raw: string): Record<string, unknown> {
  const text = raw?.trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 执行单个工具调用，把成功结果或错误信息都转成喂回模型的字符串。 */
async function executeToolCall(
  call: ToolCall,
  toolsByName: Map<string, ToolDefinition>,
  onEvent: RunAgentOptions["onEvent"]
): Promise<AgentMessage> {
  const tool = toolsByName.get(call.name);
  if (!tool) {
    const error = `Unknown tool: ${call.name}`;
    onEvent?.({ type: "tool_error", toolCallId: call.id, name: call.name, error });
    return { role: "tool", toolCallId: call.id, content: error };
  }

  onEvent?.({ type: "tool_call", call });
  try {
    const args = parseToolArguments(call.arguments);
    const result = await tool.execute(args);
    const text = typeof result === "string" ? result : JSON.stringify(result);
    onEvent?.({ type: "tool_result", toolCallId: call.id, name: call.name, result: text });
    return { role: "tool", toolCallId: call.id, content: text };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    onEvent?.({ type: "tool_error", toolCallId: call.id, name: call.name, error: message });
    // 工具失败不应中断整个 agent：把错误回灌给模型，让它自己决定重试或换路。
    return { role: "tool", toolCallId: call.id, content: `Error: ${message}` };
  }
}

/**
 * Agent 内核：协议无关的「思考-行动」循环。
 *
 * 每一轮：把对话发给模型 → 模型要么给文字（结束）、要么要求调用工具。
 * 若调用工具，就执行并把结果塞回对话，继续下一轮，直到模型不再调用工具
 * 或达到 maxSteps 安全上限。
 *
 * 这里不含任何 HTTP / Provider 细节——换模型、换协议只需替换传入的 ChatClient。
 */
export async function runAgent(options: RunAgentOptions): Promise<RunAgentResult> {
  const { client, tools, onEvent } = options;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  // 复制一份，避免就地修改调用方传入的数组。
  const messages: AgentMessage[] = [...options.messages];

  let steps = 0;
  let finalText = "";

  while (steps < maxSteps) {
    steps += 1;
    const reply = await client.send(messages, tools);

    if (reply.content) {
      onEvent?.({ type: "assistant_message", content: reply.content });
    }

    // 把模型这一轮的发言（文字 + 工具调用）作为一条 assistant 消息入历史。
    messages.push({
      role: "assistant",
      content: reply.content,
      toolCalls: reply.toolCalls.length > 0 ? reply.toolCalls : undefined,
    });

    // 没有工具调用 = 模型认为任务完成，循环结束。
    if (reply.toolCalls.length === 0) {
      finalText = reply.content ?? "";
      return { finalText, messages, steps, stoppedByMaxSteps: false };
    }

    // 并行执行本轮所有工具调用，把每个结果作为独立的 tool 消息塞回历史。
    const toolMessages = await Promise.all(
      reply.toolCalls.map((call) => executeToolCall(call, toolsByName, onEvent))
    );
    messages.push(...toolMessages);
  }

  onEvent?.({ type: "max_steps_reached", steps });
  return { finalText, messages, steps, stoppedByMaxSteps: true };
}

export type { ChatClient };
