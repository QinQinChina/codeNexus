import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type PersistedThreadTitleOverride = {
  title: string;
  updatedAt: number;
};

type PersistedThreadTitleOverrideStore = {
  version: 1;
  overrides: Record<string, PersistedThreadTitleOverride>;
};

const THREAD_TITLE_OVERRIDE_STORE_VERSION = 1 as const;
const THREAD_TITLE_OVERRIDE_MAX_LENGTH = 80;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeThreadId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTitle(value: unknown): string {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const oneLine = lines.join(" ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= THREAD_TITLE_OVERRIDE_MAX_LENGTH) return oneLine;
  return oneLine.slice(0, THREAD_TITLE_OVERRIDE_MAX_LENGTH).trim();
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function createEmptyStore(): PersistedThreadTitleOverrideStore {
  return { version: THREAD_TITLE_OVERRIDE_STORE_VERSION, overrides: {} };
}

function sanitizeStorePayload(payload: unknown): PersistedThreadTitleOverrideStore {
  if (!isPlainObject(payload)) {
    return createEmptyStore();
  }
  const version = (payload as any).version;
  const overridesRaw = (payload as any).overrides;
  if (version !== THREAD_TITLE_OVERRIDE_STORE_VERSION || !isPlainObject(overridesRaw)) {
    return createEmptyStore();
  }
  const overrides: Record<string, PersistedThreadTitleOverride> = {};
  for (const [threadIdRaw, entryRaw] of Object.entries(overridesRaw)) {
    const threadId = normalizeThreadId(threadIdRaw);
    if (!threadId) continue;
    if (!isPlainObject(entryRaw)) continue;
    const title = normalizeTitle((entryRaw as any).title);
    const updatedAtRaw = (entryRaw as any).updatedAt;
    const updatedAt =
      typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw) ? Math.max(0, Math.round(updatedAtRaw)) : 0;
    if (!title || !updatedAt) continue;
    overrides[threadId] = { title, updatedAt };
  }
  return { version: THREAD_TITLE_OVERRIDE_STORE_VERSION, overrides };
}

export class ThreadTitleOverrideService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  async listOverrides(): Promise<Record<string, string>> {
    await this.writeQueue.catch(() => undefined);
    const store = await this.readFromDisk().catch(() => createEmptyStore());
    const out: Record<string, string> = {};
    for (const [threadId, entry] of Object.entries(store.overrides)) {
      const title = normalizeTitle(entry?.title);
      if (threadId && title) out[threadId] = title;
    }
    return out;
  }

  async setOverride(args: { threadId: string; title: string }): Promise<void> {
    const threadId = normalizeThreadId(args?.threadId);
    const title = normalizeTitle(args?.title);
    if (!threadId) throw new Error("threadId 不能为空");
    if (!title) {
      await this.clearOverride({ threadId });
      return;
    }

    await this.runExclusive(async () => {
      const store = await this.readFromDisk().catch(() => createEmptyStore());
      store.overrides[threadId] = { title, updatedAt: Date.now() };
      await this.writeToDisk(store);
    });
  }

  async clearOverride(args: { threadId: string }): Promise<void> {
    const threadId = normalizeThreadId(args?.threadId);
    if (!threadId) return;

    await this.runExclusive(async () => {
      const store = await this.readFromDisk().catch(() => createEmptyStore());
      if (!Object.prototype.hasOwnProperty.call(store.overrides, threadId)) return;
      delete store.overrides[threadId];
      await this.writeToDisk(store);
    });
  }

  private async runExclusive(worker: () => Promise<void>): Promise<void> {
    const task = this.writeQueue.catch(() => undefined).then(worker);
    this.writeQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  private async readFromDisk(): Promise<PersistedThreadTitleOverrideStore> {
    let raw = "";
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: any) {
      if (error?.code === "ENOENT") return createEmptyStore();
      throw new Error(`读取线程标题覆盖失败：${readErrorMessage(error)}`);
    }
    if (!String(raw).trim()) {
      return createEmptyStore();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return createEmptyStore();
    }
    return sanitizeStorePayload(parsed);
  }

  private async writeToDisk(store: PersistedThreadTitleOverrideStore): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: PersistedThreadTitleOverrideStore = {
      version: THREAD_TITLE_OVERRIDE_STORE_VERSION,
      overrides: store.overrides,
    };
    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}
