import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  HistoryThreadTask,
  HistoryThreadTaskCreateFailureCode,
  HistoryThreadTaskStatus,
  HistoryThreadTaskPatch,
  HistoryThreadTaskUpdateFailureCode,
} from "../../shared/ipc/contracts";

type ThreadTaskServiceErrorCode = HistoryThreadTaskCreateFailureCode | HistoryThreadTaskUpdateFailureCode;

type PersistedThreadTaskStore = {
  version: 1;
  tasks: HistoryThreadTask[];
};

type ThreadTaskPatchPayload = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
};

const THREAD_TASK_STORE_VERSION = 1;
const THREAD_TASK_DEFAULT_TITLE = "Untitled";
const THREAD_TASK_DEFAULT_DESCRIPTION = "";
const THREAD_TASK_DEFAULT_STATUS: HistoryThreadTaskStatus = "todo";
const THREAD_TASK_STATUSES: readonly HistoryThreadTaskStatus[] = ["todo", "in_progress", "done", "blocked"] as const;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThreadTaskStatus(value: unknown): value is HistoryThreadTaskStatus {
  return typeof value === "string" && THREAD_TASK_STATUSES.some((item) => item === value);
}

export class ThreadTaskServiceError extends Error {
  constructor(
    readonly code: ThreadTaskServiceErrorCode,
    message: string
  ) {
    super(String(message ?? "").trim() || "unknown error");
    this.name = "ThreadTaskServiceError";
  }
}

export function isThreadTaskServiceError(error: unknown): error is ThreadTaskServiceError {
  return error instanceof ThreadTaskServiceError;
}

export class ThreadTaskService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  async createTask(args: {
    threadId: string;
    title: string;
    description: string;
    status?: HistoryThreadTaskStatus;
  }): Promise<HistoryThreadTask> {
    return this.runExclusive(async () => {
      const threadId = this.readRequiredText(args?.threadId, "INVALID_THREAD_ID", "threadId 不能为空");
      const title = this.readRequiredText(args?.title, "INVALID_TITLE", "title 不能为空");
      const description = this.readDescription(args?.description);
      const status = this.readStatus(args?.status, THREAD_TASK_DEFAULT_STATUS);
      const tasks = await this.readTasksFromDisk();
      const now = Date.now();
      const task: HistoryThreadTask = {
        taskId: this.generateTaskId(tasks),
        threadId,
        title,
        description,
        status,
        createdAt: now,
        updatedAt: now,
      };
      tasks.push(task);
      await this.writeTasksToDisk(tasks);
      return { ...task };
    });
  }

  async updateTask(args: {
    threadId: string;
    taskId: string;
    patch?: HistoryThreadTaskPatch | null;
  }): Promise<{ task: HistoryThreadTask; upserted: boolean }> {
    return this.runExclusive(async () => {
      const threadId = this.readRequiredText(args?.threadId, "INVALID_THREAD_ID", "threadId 不能为空");
      const taskId = this.readRequiredText(args?.taskId, "INVALID_TASK_ID", "taskId 不能为空");
      const patch = this.readPatch(args?.patch);
      const tasks = await this.readTasksFromDisk();
      const now = Date.now();
      const index = tasks.findIndex((item) => item.threadId === threadId && item.taskId === taskId);
      if (index >= 0) {
        const current = tasks[index];
        const next: HistoryThreadTask = {
          ...current,
          updatedAt: now,
        };
        if (Object.prototype.hasOwnProperty.call(patch, "title")) {
          next.title = this.readRequiredText(patch.title, "INVALID_TITLE", "title 不能为空");
        }
        if (Object.prototype.hasOwnProperty.call(patch, "description")) {
          next.description = this.readDescription(patch.description);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "status")) {
          next.status = this.readStatus(patch.status, THREAD_TASK_DEFAULT_STATUS);
        }
        tasks[index] = next;
        await this.writeTasksToDisk(tasks);
        return { task: { ...next }, upserted: false };
      }

      const created: HistoryThreadTask = {
        taskId,
        threadId,
        title: THREAD_TASK_DEFAULT_TITLE,
        description: THREAD_TASK_DEFAULT_DESCRIPTION,
        status: THREAD_TASK_DEFAULT_STATUS,
        createdAt: now,
        updatedAt: now,
      };
      if (Object.prototype.hasOwnProperty.call(patch, "title")) {
        created.title = this.readRequiredText(patch.title, "INVALID_TITLE", "title 不能为空");
      }
      if (Object.prototype.hasOwnProperty.call(patch, "description")) {
        created.description = this.readDescription(patch.description);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "status")) {
        created.status = this.readStatus(patch.status, THREAD_TASK_DEFAULT_STATUS);
      }
      tasks.push(created);
      await this.writeTasksToDisk(tasks);
      return { task: { ...created }, upserted: true };
    });
  }

  async listTasks(args: {
    threadId: string;
    limit?: number;
    statusIn?: HistoryThreadTaskStatus[] | null;
    includeDone?: boolean;
  }): Promise<HistoryThreadTask[]> {
    const threadId = this.readRequiredText(args?.threadId, "INVALID_THREAD_ID", "threadId 不能为空");
    const limitRaw = Number(args?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.round(limitRaw)) : 50;
    const includeDone = args?.includeDone !== false;
    const statusIn = Array.isArray(args?.statusIn) ? args.statusIn.filter((item) => isThreadTaskStatus(item)) : [];

    const tasks = await this.readTasksFromDisk();
    return tasks
      .filter((task) => task.threadId === threadId)
      .filter((task) => {
        if (statusIn.length > 0) return statusIn.some((status) => status === task.status);
        if (includeDone) return true;
        return task.status !== "done";
      })
      .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.taskId.localeCompare(b.taskId))
      .slice(0, limit)
      .map((task) => ({ ...task }));
  }

  private async runExclusive<T>(worker: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.catch(() => undefined).then(worker);
    this.writeQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  private readRequiredText(value: unknown, code: ThreadTaskServiceErrorCode, message: string): string {
    if (typeof value !== "string") {
      throw new ThreadTaskServiceError(code, message);
    }
    const text = value.trim();
    if (!text) {
      throw new ThreadTaskServiceError(code, message);
    }
    return text;
  }

  private readDescription(value: unknown): string {
    if (typeof value !== "string") {
      throw new ThreadTaskServiceError("INVALID_DESCRIPTION", "description 必须是字符串");
    }
    return value.trim();
  }

  private readStatus(value: unknown, defaultValue: HistoryThreadTaskStatus): HistoryThreadTaskStatus {
    if (typeof value === "undefined") return defaultValue;
    if (!isThreadTaskStatus(value)) {
      throw new ThreadTaskServiceError("INVALID_STATUS", "status 不合法");
    }
    return value;
  }

  private readPatch(value: unknown): ThreadTaskPatchPayload {
    if (typeof value === "undefined" || value === null) {
      return {};
    }
    if (!isPlainObject(value)) {
      throw new ThreadTaskServiceError("INVALID_PATCH", "patch 必须是对象");
    }
    return value;
  }

  private async readTasksFromDisk(): Promise<HistoryThreadTask[]> {
    let raw = "";
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw new ThreadTaskServiceError(
        "TASK_STORE_READ_FAILED",
        `读取任务存储失败：${readErrorMessage(error)}`
      );
    }
    if (!String(raw).trim()) {
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", "任务存储文件已损坏，无法解析 JSON");
    }
    return this.parseStorePayload(parsed);
  }

  private parseStorePayload(payload: unknown): HistoryThreadTask[] {
    if (!isPlainObject(payload)) {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", "任务存储文件结构无效");
    }
    const version = (payload as PersistedThreadTaskStore).version;
    const tasks = (payload as PersistedThreadTaskStore).tasks;
    if (version !== THREAD_TASK_STORE_VERSION || !Array.isArray(tasks)) {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", "任务存储文件版本或结构不匹配");
    }
    return tasks.map((item, index) => this.parseTaskRecord(item, index));
  }

  private parseTaskRecord(task: unknown, index: number): HistoryThreadTask {
    if (!isPlainObject(task)) {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", `任务存储第 ${index + 1} 条记录无效`);
    }

    const taskId = this.readTaskRecordText(task.taskId, index, "taskId");
    const threadId = this.readTaskRecordText(task.threadId, index, "threadId");
    const title = this.readTaskRecordText(task.title, index, "title");
    const description = this.readTaskRecordDescription(task.description, index);
    const statusRaw = task.status;
    if (!isThreadTaskStatus(statusRaw)) {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", `任务存储第 ${index + 1} 条 status 非法`);
    }
    const createdAt = this.readTaskRecordTimestamp(task.createdAt, index, "createdAt");
    const updatedAt = this.readTaskRecordTimestamp(task.updatedAt, index, "updatedAt");

    return {
      taskId,
      threadId,
      title,
      description,
      status: statusRaw,
      createdAt,
      updatedAt,
    };
  }

  private readTaskRecordText(value: unknown, index: number, fieldName: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new ThreadTaskServiceError(
        "TASK_STORE_CORRUPTED",
        `任务存储第 ${index + 1} 条 ${fieldName} 无效`
      );
    }
    return value.trim();
  }

  private readTaskRecordDescription(value: unknown, index: number): string {
    if (typeof value !== "string") {
      throw new ThreadTaskServiceError("TASK_STORE_CORRUPTED", `任务存储第 ${index + 1} 条 description 无效`);
    }
    return value.trim();
  }

  private readTaskRecordTimestamp(value: unknown, index: number, fieldName: "createdAt" | "updatedAt"): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      throw new ThreadTaskServiceError(
        "TASK_STORE_CORRUPTED",
        `任务存储第 ${index + 1} 条 ${fieldName} 无效`
      );
    }
    return Math.round(num);
  }

  private async writeTasksToDisk(tasks: HistoryThreadTask[]): Promise<void> {
    const payload: PersistedThreadTaskStore = {
      version: THREAD_TASK_STORE_VERSION,
      tasks,
    };
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    } catch (error) {
      throw new ThreadTaskServiceError(
        "TASK_STORE_WRITE_FAILED",
        `写入任务存储失败：${readErrorMessage(error)}`
      );
    }
  }

  private generateTaskId(tasks: HistoryThreadTask[]): string {
    const existing = new Set(tasks.map((item) => item.taskId));
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const candidate = randomUUID();
      if (existing.has(candidate)) continue;
      return candidate;
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
