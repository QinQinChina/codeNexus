import { basenameFromPath } from "../../domain/workspaceFiles";
import type { ChatImageEntry, ChatImageToolItem, ImageToolStatus, LazyImageSourceKind } from "../../components/layout/chat.types";

type SupportedImageProtocolItem =
  | {
      type: "imageView";
      id?: string;
      path?: string;
    }
  | {
      type: "imageGeneration";
      id?: string;
      status?: string;
      revisedPrompt?: string | null;
      result?: string;
      savedPath?: string;
    }
  | {
      type: "image_generation_call";
      id?: string;
      status?: string;
      revised_prompt?: string;
      result?: string;
    };

function toImageToolStatus(statusValue: unknown, eventMethod: string): ImageToolStatus {
  if (eventMethod === "item/started") return "running";
  const status = String(statusValue ?? "").trim().toLowerCase();
  if (!status) return "completed";
  if (status.includes("error") || status.includes("fail") || status.includes("cancel")) return "failed";
  if (status.includes("running") || status.includes("progress") || status.includes("pending")) return "running";
  if (status.includes("complete") || status.includes("success") || status.includes("succeeded")) return "completed";
  return "unknown";
}

function inferImageSourceKind(sourceValue: string): LazyImageSourceKind {
  const source = String(sourceValue ?? "").trim();
  if (source.startsWith("data:image/")) return "dataUrl";
  if (/^https?:\/\//i.test(source)) return "remoteUrl";
  return "localPath";
}

function normalizeImageGenerationResultSource(resultValue: unknown): string {
  const result = String(resultValue ?? "").trim();
  if (!result) return "";
  if (result.startsWith("data:image/") || /^https?:\/\//i.test(result)) return result;
  return `data:image/png;base64,${result}`;
}

function buildImageEntry(id: string, sourceValue: unknown, titleValue?: unknown): ChatImageEntry | null {
  const source = String(sourceValue ?? "").trim();
  if (!source) return null;
  const sourceKind = inferImageSourceKind(source);
  const title = String(titleValue ?? "").trim() || basenameFromPath(source) || "生成图片";
  return { id, sourceKind, source, title };
}

export function buildImageToolItemFromProtocolItem(
  item: unknown,
  eventMethod: string
): ChatImageToolItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const protocolItem = item as SupportedImageProtocolItem;
  const type = String((protocolItem as { type?: unknown }).type ?? "").trim();
  const id = String((protocolItem as { id?: unknown }).id ?? "").trim() || "image-tool";

  if (type === "imageView") {
    const path = String((protocolItem as Extract<SupportedImageProtocolItem, { type: "imageView" }>).path ?? "").trim();
    const image = buildImageEntry(`${id}:path`, path, basenameFromPath(path) || path);
    return {
      itemId: id,
      itemType: "imageView",
      title: "查看图片",
      status: eventMethod === "item/started" ? "running" : "completed",
      detailText: path ? `path=${path}` : "",
      errorText: path ? "" : "缺少图片路径",
      revisedPrompt: "",
      images: image ? [image] : [],
    };
  }

  if (type !== "imageGeneration" && type !== "image_generation_call") return null;

  const generationItem = protocolItem as
    | Extract<SupportedImageProtocolItem, { type: "imageGeneration" }>
    | Extract<SupportedImageProtocolItem, { type: "image_generation_call" }>;
  const statusText = String(generationItem.status ?? "").trim();
  const status = toImageToolStatus(statusText, eventMethod);
  const revisedPrompt = String(
    generationItem.type === "imageGeneration" ? generationItem.revisedPrompt ?? "" : generationItem.revised_prompt ?? ""
  ).trim();
  const result = String(generationItem.result ?? "").trim();
  const savedPath = String(generationItem.type === "imageGeneration" ? generationItem.savedPath ?? "" : "").trim();
  const resultSource = savedPath ? "" : normalizeImageGenerationResultSource(result);

  const seen = new Set<string>();
  const images: ChatImageEntry[] = [];
  const addImage = (source: string, title?: string) => {
    if (!source || seen.has(source)) return;
    seen.add(source);
    const image = buildImageEntry(`${id}:${images.length}:${inferImageSourceKind(source)}`, source, title);
    if (image) images.push(image);
  };
  addImage(savedPath, basenameFromPath(savedPath) || savedPath);
  addImage(resultSource, "生成图片");

  return {
    itemId: id,
    itemType: "imageGeneration",
    title: "生成图片",
    status,
    detailText: [
      statusText ? `status=${statusText}` : "",
      savedPath ? `savedPath=${savedPath}` : "",
      result ? (resultSource.startsWith("data:image/") ? "result=dataUrl" : `result=${result.length > 180 ? `${result.slice(0, 179)}…` : result}`) : "",
    ]
      .filter(Boolean)
      .join("\n"),
    errorText: status === "failed" ? (statusText ? `status=${statusText}` : "生成失败") : "",
    revisedPrompt: revisedPrompt ? `修订提示词：\n${revisedPrompt}` : "",
    images,
  };
}
