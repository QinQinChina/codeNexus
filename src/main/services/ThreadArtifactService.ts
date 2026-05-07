import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  HistoryThreadArtifact,
  HistoryThreadArtifactGetFailureCode,
  HistoryThreadArtifactKind,
  HistoryThreadArtifactListFailureCode,
  HistoryThreadArtifactPayload,
  HistoryThreadArtifactPublishFailureCode,
} from "../../shared/ipc/contracts";

type ThreadArtifactServiceErrorCode =
  | HistoryThreadArtifactPublishFailureCode
  | HistoryThreadArtifactListFailureCode
  | HistoryThreadArtifactGetFailureCode;

type PersistedThreadArtifactStore = {
  version: 1;
  artifacts: HistoryThreadArtifact[];
};

const THREAD_ARTIFACT_STORE_VERSION = 1;
const ARTIFACT_TEXT_MAX_CHARS = 20_000;
const ARTIFACT_JSON_MAX_CHARS = 30_000;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArtifactKind(value: unknown): value is HistoryThreadArtifactKind {
  return value === "text" || value === "file" || value === "link" || value === "json";
}

export class ThreadArtifactServiceError extends Error {
  constructor(
    readonly code: ThreadArtifactServiceErrorCode,
    message: string
  ) {
    super(String(message ?? "").trim() || "unknown error");
    this.name = "ThreadArtifactServiceError";
  }
}

export function isThreadArtifactServiceError(error: unknown): error is ThreadArtifactServiceError {
  return error instanceof ThreadArtifactServiceError;
}

export class ThreadArtifactService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  async publishArtifact(args: {
    threadId: string;
    title: string;
    kind: HistoryThreadArtifactKind;
    description?: string;
    payload: HistoryThreadArtifactPayload;
  }): Promise<HistoryThreadArtifact> {
    return this.runExclusive(async () => {
      const threadId = this.readRequiredText(args?.threadId, "INVALID_THREAD_ID", "threadId 不能为空");
      const title = this.readRequiredText(args?.title, "INVALID_TITLE", "title 不能为空");
      const kind = this.readKind(args?.kind);
      const description = typeof args?.description === "string" ? args.description.trim() : "";
      const payload = this.readPayload(kind, args?.payload);

      const artifacts = await this.readArtifactsFromDisk();
      const now = Date.now();
      const artifact: HistoryThreadArtifact = {
        artifactId: this.generateArtifactId(artifacts),
        threadId,
        title,
        kind,
        description,
        payload,
        createdAt: now,
      };
      artifacts.push(artifact);
      await this.writeArtifactsToDisk(artifacts);
      return { ...artifact, payload: { ...artifact.payload } };
    });
  }

  async listArtifacts(args: { threadId: string; limit?: number }): Promise<HistoryThreadArtifact[]> {
    const threadId = this.readRequiredText(args?.threadId, "INVALID_THREAD_ID", "threadId 不能为空");
    const limitRaw = Number(args?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.round(limitRaw)) : 20;

    const artifacts = await this.readArtifactsFromDisk();
    return artifacts
      .filter((item) => item.threadId === threadId)
      .sort((a, b) => b.createdAt - a.createdAt || a.artifactId.localeCompare(b.artifactId))
      .slice(0, limit)
      .map((item) => ({ ...item, payload: { ...item.payload } }));
  }

  async getArtifact(args: { artifactId: string }): Promise<HistoryThreadArtifact> {
    const artifactId = this.readRequiredText(args?.artifactId, "INVALID_ARTIFACT_ID", "artifactId 不能为空");
    const artifacts = await this.readArtifactsFromDisk();
    const found = artifacts.find((item) => item.artifactId === artifactId) ?? null;
    if (!found) {
      throw new ThreadArtifactServiceError("ARTIFACT_NOT_FOUND", "未找到 artifact");
    }
    return { ...found, payload: { ...found.payload } };
  }

  private async runExclusive<T>(worker: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.catch(() => undefined).then(worker);
    this.writeQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  private readRequiredText(value: unknown, code: ThreadArtifactServiceErrorCode, message: string): string {
    if (typeof value !== "string") throw new ThreadArtifactServiceError(code, message);
    const text = value.trim();
    if (!text) throw new ThreadArtifactServiceError(code, message);
    return text;
  }

  private readKind(value: unknown): HistoryThreadArtifactKind {
    if (!isArtifactKind(value)) throw new ThreadArtifactServiceError("INVALID_KIND", "kind 不合法");
    return value;
  }

  private readPayload(kind: HistoryThreadArtifactKind, value: unknown): HistoryThreadArtifactPayload {
    if (!isPlainObject(value)) throw new ThreadArtifactServiceError("INVALID_PAYLOAD", "payload 必须是对象");
    const payload = value as Record<string, unknown>;

    if (kind === "text") {
      const text = this.readRequiredText(payload.text, "INVALID_PAYLOAD", "text 不能为空");
      if (text.length > ARTIFACT_TEXT_MAX_CHARS) {
        throw new ThreadArtifactServiceError("ARTIFACT_TOO_LARGE", `text 超过长度上限（${ARTIFACT_TEXT_MAX_CHARS}）`);
      }
      return { text };
    }

    if (kind === "file") {
      const path = this.readRequiredText(payload.path, "INVALID_PAYLOAD", "path 不能为空");
      return { path };
    }

    if (kind === "link") {
      const url = this.readRequiredText(payload.url, "INVALID_PAYLOAD", "url 不能为空");
      return { url };
    }

    // kind === "json"
    const valueRaw = payload.value;
    let jsonText = "";
    try {
      jsonText = JSON.stringify(valueRaw);
    } catch {
      throw new ThreadArtifactServiceError("INVALID_PAYLOAD", "value 无法序列化为 JSON");
    }
    if (jsonText.length > ARTIFACT_JSON_MAX_CHARS) {
      throw new ThreadArtifactServiceError("ARTIFACT_TOO_LARGE", `json 超过长度上限（${ARTIFACT_JSON_MAX_CHARS}）`);
    }
    return { value: valueRaw };
  }

  private generateArtifactId(existing: HistoryThreadArtifact[]): string {
    const known = new Set(existing.map((item) => item.artifactId));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let candidate = "";
      try {
        candidate = `artifact:${randomUUID()}`;
      } catch {
        candidate = `artifact:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      }
      if (!known.has(candidate)) return candidate;
    }
    return `artifact:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  private async readArtifactsFromDisk(): Promise<HistoryThreadArtifact[]> {
    let raw = "";
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw new ThreadArtifactServiceError(
        "ARTIFACT_STORE_READ_FAILED",
        `读取 artifacts 存储失败：${readErrorMessage(error)}`
      );
    }

    if (!String(raw).trim()) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ThreadArtifactServiceError("ARTIFACT_STORE_CORRUPTED", "artifacts 存储文件已损坏，无法解析 JSON");
    }

    return this.parseStorePayload(parsed);
  }

  private parseStorePayload(payload: unknown): HistoryThreadArtifact[] {
    if (!isPlainObject(payload)) {
      throw new ThreadArtifactServiceError("ARTIFACT_STORE_CORRUPTED", "artifacts 存储文件结构无效");
    }
    const version = (payload as PersistedThreadArtifactStore).version;
    const artifacts = (payload as PersistedThreadArtifactStore).artifacts;
    if (version !== THREAD_ARTIFACT_STORE_VERSION || !Array.isArray(artifacts)) {
      throw new ThreadArtifactServiceError("ARTIFACT_STORE_CORRUPTED", "artifacts 存储文件版本或结构不匹配");
    }

    return artifacts.map((item, index) => this.parseArtifactRecord(item, index));
  }

  private parseArtifactRecord(value: unknown, index: number): HistoryThreadArtifact {
    if (!isPlainObject(value)) {
      throw new ThreadArtifactServiceError("ARTIFACT_STORE_CORRUPTED", `artifacts 第 ${index + 1} 条记录无效`);
    }

    const record = value as Record<string, unknown>;
    const artifactId = this.readRequiredText(record.artifactId, "ARTIFACT_STORE_CORRUPTED", "artifactId 缺失");
    const threadId = this.readRequiredText(record.threadId, "ARTIFACT_STORE_CORRUPTED", "threadId 缺失");
    const title = this.readRequiredText(record.title, "ARTIFACT_STORE_CORRUPTED", "title 缺失");
    const kind = this.readKind(record.kind);
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const createdAtRaw = Number(record.createdAt);
    const createdAt = Number.isFinite(createdAtRaw) ? Math.max(0, Math.round(createdAtRaw)) : 0;

    const payloadRaw = isPlainObject(record.payload) ? (record.payload as Record<string, unknown>) : {};
    const payload: HistoryThreadArtifactPayload = {
      ...(typeof payloadRaw.text === "string" ? { text: payloadRaw.text } : {}),
      ...(typeof payloadRaw.path === "string" ? { path: payloadRaw.path } : {}),
      ...(typeof payloadRaw.url === "string" ? { url: payloadRaw.url } : {}),
      ...("value" in payloadRaw ? { value: payloadRaw.value } : {}),
    };

    // Best-effort validation: don't fail corrupted store purely because payload shape evolved.
    return {
      artifactId,
      threadId,
      title,
      kind,
      description,
      payload,
      createdAt,
    };
  }

  private async writeArtifactsToDisk(artifacts: HistoryThreadArtifact[]): Promise<void> {
    const payload: PersistedThreadArtifactStore = { version: THREAD_ARTIFACT_STORE_VERSION, artifacts };
    const out = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, out, "utf8");
    } catch (error) {
      throw new ThreadArtifactServiceError(
        "ARTIFACT_STORE_WRITE_FAILED",
        `写入 artifacts 存储失败：${readErrorMessage(error)}`
      );
    }
  }
}
