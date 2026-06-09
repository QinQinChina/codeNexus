/**
 * 极简 SSE 读取器：把 fetch 流式响应体切成一个个 `event/data` 块。
 *
 * 兼容三家 provider 的流式格式：OpenAI / Gemini 只用 `data:`；Anthropic 额外带 `event:`。
 * 调用方按各自协议解析 data（多为 JSON；OpenAI 末尾是 `[DONE]` 哨兵）。
 */
export type SseBlock = { event: string | null; data: string };

function parseBlock(raw: string): SseBlock | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export async function* readSseBlocks(response: Response): AsyncGenerator<SseBlock> {
  const body = response.body;
  if (!body) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = parseBlock(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
      if (block) yield block;
    }
  }
  buffer += decoder.decode();
  const tail = parseBlock(buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim());
  if (tail) yield tail;
}
