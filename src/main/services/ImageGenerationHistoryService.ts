import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ImageGenerationHistoryItem } from "../../shared/ipc/contracts";

type ImageGenerationHistoryState = {
  version: 1;
  items: ImageGenerationHistoryItem[];
};

type ImageGenerationHistoryCreateInput = Omit<ImageGenerationHistoryItem, "id" | "createdAt" | "updatedAt">;

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toTimestamp(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : Date.now();
}

function normalizeItem(value: unknown): ImageGenerationHistoryItem | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;
  if (!record) return null;
  const id = toText(record.id);
  const prompt = toText(record.prompt);
  if (!id || !prompt) return null;
  const images = Array.isArray(record.images)
    ? record.images
        .map((imageValue) => {
          const image =
            imageValue && typeof imageValue === "object" && !Array.isArray(imageValue)
              ? (imageValue as Record<string, any>)
              : {};
          const path = toText(image.path);
          if (!path) return null;
          return {
            path,
            mimeType: toText(image.mimeType, "image/png"),
            revisedPrompt: toNullableText(image.revisedPrompt),
          };
        })
        .filter((item): item is ImageGenerationHistoryItem["images"][number] => Boolean(item))
    : [];
  if (images.length === 0) return null;
  return {
    id,
    createdAt: toTimestamp(record.createdAt),
    updatedAt: toTimestamp(record.updatedAt ?? record.createdAt),
    workspacePath: toNullableText(record.workspacePath),
    model: toText(record.model, "gpt-image-2"),
    prompt,
    revisedPrompt: toNullableText(record.revisedPrompt),
    mode: record.mode === "edit" ? "edit" : "generate",
    size: toNullableText(record.size),
    quality: toNullableText(record.quality),
    outputFormat: toNullableText(record.outputFormat),
    background: toNullableText(record.background),
    moderation: toNullableText(record.moderation),
    outputCompression: typeof record.outputCompression === "number" ? record.outputCompression : null,
    images,
  };
}

function normalizeState(value: unknown): ImageGenerationHistoryState {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  const items = Array.isArray(record.items) ? record.items.map(normalizeItem).filter(Boolean) : [];
  return {
    version: 1,
    items: (items as ImageGenerationHistoryItem[]).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export class ImageGenerationHistoryService {
  private writeQueue: Promise<ImageGenerationHistoryState> = Promise.resolve({ version: 1, items: [] });

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async readFromDisk(): Promise<ImageGenerationHistoryState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeState(tryParseJson(raw));
    } catch {
      return { version: 1, items: [] };
    }
  }

  async list(): Promise<ImageGenerationHistoryItem[]> {
    await this.writeQueue.catch(() => undefined);
    const state = await this.readFromDisk();
    return state.items;
  }

  async create(input: ImageGenerationHistoryCreateInput): Promise<ImageGenerationHistoryItem> {
    const task = this.writeQueue
      .catch(() => ({ version: 1 as const, items: [] }))
      .then(async () => {
        const current = await this.readFromDisk();
        const now = Date.now();
        const item: ImageGenerationHistoryItem = {
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          ...input,
          images: input.images.map((image) => ({ ...image })),
        };
        const next = { version: 1 as const, items: [item, ...current.items] };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return next;
      });
    this.writeQueue = task;
    const state = await task;
    return state.items[0];
  }

  async delete(idValue: unknown): Promise<{ deleted: boolean; items: ImageGenerationHistoryItem[] }> {
    const id = toText(idValue);
    if (!id) return { deleted: false, items: await this.list() };
    let removed: ImageGenerationHistoryItem | null = null;
    const task = this.writeQueue
      .catch(() => ({ version: 1 as const, items: [] }))
      .then(async () => {
        const current = await this.readFromDisk();
        const nextItems = current.items.filter((item) => {
          if (item.id !== id) return true;
          removed = item;
          return false;
        });
        const next = { version: 1 as const, items: nextItems };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return next;
      });
    this.writeQueue = task;
    const state = await task;
    return { deleted: Boolean(removed), items: state.items };
  }
}
