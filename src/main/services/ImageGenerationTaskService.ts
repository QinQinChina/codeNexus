import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ImageGenerationGenerateArgs,
  ImageGenerationGenerateResult,
  ImageGenerationTaskItem,
  ImageGenerationTaskStatus,
} from "../../shared/ipc/contracts";

type ImageGenerationTaskState = {
  version: 1;
  tasks: ImageGenerationTaskItem[];
};

type ImageGenerationTaskRunner = (
  args: ImageGenerationGenerateArgs,
  signal: AbortSignal
) => Promise<ImageGenerationGenerateResult>;

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

function toTimestamp(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toStatus(value: unknown): ImageGenerationTaskStatus {
  return value === "running" || value === "succeeded" || value === "failed" || value === "canceled" ? value : "queued";
}

function normalizeArgs(value: unknown): ImageGenerationGenerateArgs | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;
  const prompt = toText(record?.prompt);
  if (!record || !prompt) return null;
  return {
    threadId: toNullableText(record.threadId),
    turnId: toNullableText(record.turnId),
    callId: toNullableText(record.callId),
    mode: record.mode === "edit" ? "edit" : record.mode === "generate" ? "generate" : null,
    prompt,
    inputImages: Array.isArray(record.inputImages)
      ? record.inputImages
          .map((item) => {
            const input = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, any>) : {};
            const dataUrl = toText(input.dataUrl);
            if (!dataUrl) return null;
            return { dataUrl, name: toNullableText(input.name) };
          })
          .filter((item): item is { dataUrl: string; name: string | null } => Boolean(item))
      : null,
    maskDataUrl: toNullableText(record.maskDataUrl),
    size: toNullableText(record.size),
    quality: toNullableText(record.quality),
    outputFormat: toNullableText(record.outputFormat),
    background: toNullableText(record.background),
    moderation: toNullableText(record.moderation),
    outputCompression: typeof record.outputCompression === "number" ? record.outputCompression : null,
    n: typeof record.n === "number" ? record.n : null,
  };
}

function normalizeTask(value: unknown): ImageGenerationTaskItem | null {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null;
  if (!record) return null;
  const id = toText(record.id);
  const args = normalizeArgs(record.args);
  if (!id || !args) return null;
  const status = toStatus(record.status);
  const persistedStatus = status === "running" || status === "queued" ? "failed" : status;
  const now = Date.now();
  return {
    id,
    createdAt: toTimestamp(record.createdAt) ?? now,
    updatedAt: toTimestamp(record.updatedAt) ?? now,
    startedAt: toTimestamp(record.startedAt),
    completedAt: toTimestamp(record.completedAt),
    status: persistedStatus,
    args,
    historyId: toNullableText(record.historyId),
    result: null,
    errorText: persistedStatus === status ? toNullableText(record.errorText) : "应用重启前任务未完成，请重试。",
    retryOf: toNullableText(record.retryOf),
    attempt: Math.max(1, Math.round(Number(record.attempt) || 1)),
  };
}

function sanitizeTaskArgsForSnapshot(args: ImageGenerationGenerateArgs): ImageGenerationGenerateArgs {
  return {
    ...args,
    inputImages: Array.isArray(args.inputImages)
      ? args.inputImages.map((image) => ({
          dataUrl: "",
          name: image.name ?? null,
        }))
      : null,
    maskDataUrl: null,
  };
}

function normalizeState(value: unknown): ImageGenerationTaskState {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  const tasks = Array.isArray(record.tasks) ? record.tasks.map(normalizeTask).filter(Boolean) : [];
  return {
    version: 1,
    tasks: (tasks as ImageGenerationTaskItem[]).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export class ImageGenerationTaskService {
  private tasks: ImageGenerationTaskItem[] = [];
  private loaded = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private running = new Map<string, AbortController>();

  constructor(
    private readonly filePath: string,
    private readonly runner: ImageGenerationTaskRunner,
    private readonly maxConcurrency = 2
  ) {}

  async list(): Promise<ImageGenerationTaskItem[]> {
    await this.ensureLoaded();
    return this.snapshot();
  }

  async submit(
    args: ImageGenerationGenerateArgs,
    retryOf: string | null = null,
    attempt = 1
  ): Promise<{ task: ImageGenerationTaskItem; tasks: ImageGenerationTaskItem[] }> {
    await this.ensureLoaded();
    const now = Date.now();
    const task: ImageGenerationTaskItem = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      status: "queued",
      args: { ...args },
      historyId: null,
      result: null,
      errorText: null,
      retryOf,
      attempt: Math.max(1, Math.round(attempt)),
    };
    this.tasks = [task, ...this.tasks];
    await this.persist();
    this.pump();
    return { task: { ...task }, tasks: this.snapshot() };
  }

  async cancel(
    idValue: unknown
  ): Promise<{ canceled: boolean; task: ImageGenerationTaskItem | null; tasks: ImageGenerationTaskItem[] }> {
    await this.ensureLoaded();
    const id = toText(idValue);
    const task = this.tasks.find((item) => item.id === id) ?? null;
    if (!task) return { canceled: false, task: null, tasks: this.snapshot() };
    if (task.status === "queued") {
      this.updateTask(id, { status: "canceled", completedAt: Date.now(), errorText: "已取消" });
      await this.persist();
      return { canceled: true, task: this.cloneTask(id), tasks: this.snapshot() };
    }
    if (task.status === "running") {
      this.running.get(id)?.abort();
      return { canceled: true, task: this.cloneTask(id), tasks: this.snapshot() };
    }
    return { canceled: false, task: this.cloneTask(id), tasks: this.snapshot() };
  }

  async delete(idValue: unknown): Promise<{ deleted: boolean; tasks: ImageGenerationTaskItem[] }> {
    await this.ensureLoaded();
    const id = toText(idValue);
    if (!id) return { deleted: false, tasks: this.snapshot() };
    const before = this.tasks.length;
    this.running.get(id)?.abort();
    this.running.delete(id);
    this.tasks = this.tasks.filter((task) => task.id !== id);
    const deleted = this.tasks.length !== before;
    if (deleted) await this.persist();
    this.pump();
    return { deleted, tasks: this.snapshot() };
  }

  async retry(idValue: unknown): Promise<{ task: ImageGenerationTaskItem; tasks: ImageGenerationTaskItem[] }> {
    await this.ensureLoaded();
    const id = toText(idValue);
    const source = this.tasks.find((item) => item.id === id);
    if (!source) throw new Error("图片生成任务不存在。");
    return this.submit(source.args, source.id, source.attempt + 1);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    let shouldRewrite = false;
    try {
      const raw = await readFile(this.filePath, "utf8");
      shouldRewrite = raw.includes('"dataUrl"') || raw.includes('"result"');
      this.tasks = normalizeState(tryParseJson(raw)).tasks;
    } catch {
      this.tasks = [];
    }
    this.loaded = true;
    if (shouldRewrite) {
      void this.persist().catch(() => undefined);
    }
  }

  private snapshot(): ImageGenerationTaskItem[] {
    return this.tasks.map((task) => ({
      ...task,
      args: sanitizeTaskArgsForSnapshot(task.args),
      result: null,
    }));
  }

  private cloneTask(id: string): ImageGenerationTaskItem | null {
    return this.snapshot().find((task) => task.id === id) ?? null;
  }

  private updateTask(id: string, patch: Partial<ImageGenerationTaskItem>) {
    const now = Date.now();
    this.tasks = this.tasks.map((task) => (task.id === id ? { ...task, ...patch, updatedAt: now } : task));
  }

  private async persist(): Promise<void> {
    const task = this.saveQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify({ version: 1, tasks: this.tasks }, null, 2)}\n`, "utf8");
    });
    this.saveQueue = task.catch(() => undefined);
    await task;
  }

  private pump() {
    void this.ensureLoaded().then(() => {
      while (this.running.size < this.maxConcurrency) {
        const task = [...this.tasks].reverse().find((item) => item.status === "queued");
        if (!task) return;
        this.startTask(task.id);
      }
    });
  }

  private startTask(id: string) {
    const task = this.tasks.find((item) => item.id === id);
    if (!task || task.status !== "queued") return;
    const controller = new AbortController();
    this.running.set(id, controller);
    this.updateTask(id, { status: "running", startedAt: Date.now(), errorText: null });
    void this.persist();
    void this.runner(task.args, controller.signal)
      .then(async (result) => {
        this.updateTask(id, {
          status: "succeeded",
          completedAt: Date.now(),
          historyId: result.historyId,
          result: null,
          errorText: null,
        });
        await this.persist();
      })
      .catch(async (error: any) => {
        const aborted = controller.signal.aborted;
        this.updateTask(id, {
          status: aborted ? "canceled" : "failed",
          completedAt: Date.now(),
          errorText: aborted ? "已取消" : String(error?.message ?? error ?? "unknown error"),
        });
        await this.persist();
      })
      .finally(() => {
        this.running.delete(id);
        this.pump();
      });
  }
}
