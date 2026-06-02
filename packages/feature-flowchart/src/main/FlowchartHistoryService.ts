import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeFlowchartDocument, type FlowchartDocument } from "../types";

type FlowchartHistoryState = {
  version: 1;
  items: FlowchartDocument[];
};

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeState(value: unknown): FlowchartHistoryState {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(record.items)
    ? record.items
        .map((item) => normalizeFlowchartDocument(item).document)
        .filter((item) => item.nodes.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  return { version: 1, items };
}

export class FlowchartHistoryService {
  private writeQueue: Promise<FlowchartHistoryState> = Promise.resolve({ version: 1, items: [] });

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async readFromDisk(): Promise<FlowchartHistoryState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeState(tryParseJson(raw));
    } catch {
      return { version: 1, items: [] };
    }
  }

  async list(): Promise<FlowchartDocument[]> {
    await this.writeQueue.catch(() => undefined);
    const state = await this.readFromDisk();
    return state.items;
  }

  async upsert(value: unknown): Promise<{ item: FlowchartDocument; items: FlowchartDocument[] }> {
    const task = this.writeQueue
      .catch(() => ({ version: 1 as const, items: [] }))
      .then(async () => {
        const current = await this.readFromDisk();
        const normalized = normalizeFlowchartDocument(value);
        const now = Date.now();
        const item: FlowchartDocument = {
          ...normalized.document,
          createdAt: normalized.document.createdAt || now,
          updatedAt: now,
        };
        const items = [item, ...current.items.filter((entry) => entry.id !== item.id)]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 100);
        const next = { version: 1 as const, items };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return next;
      });
    this.writeQueue = task;
    const state = await task;
    return { item: state.items[0], items: state.items };
  }

  async delete(idValue: unknown): Promise<{ deleted: boolean; items: FlowchartDocument[] }> {
    const id = String(idValue ?? "").trim();
    if (!id) return { deleted: false, items: await this.list() };
    let deleted = false;
    const task = this.writeQueue
      .catch(() => ({ version: 1 as const, items: [] }))
      .then(async () => {
        const current = await this.readFromDisk();
        const items = current.items.filter((item) => {
          if (item.id !== id) return true;
          deleted = true;
          return false;
        });
        const next = { version: 1 as const, items };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return next;
      });
    this.writeQueue = task;
    const state = await task;
    return { deleted, items: state.items };
  }
}
