import { app } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeUserLocalSettings, type UserLocalSettings } from "../../shared/localSettings";
import {
  isCodexServerNotificationMessage,
  type CodexIncomingMessage,
  type CodexServerNotificationMessage,
} from "../../shared/codex-protocol";
import type {
  AppRemoteSyncState,
  RemoteSyncEventPayload,
  RemoteSyncPlanStep,
  RemoteSyncSnapshotPayload,
  RemoteSyncThreadSummary,
} from "../../shared/ipc";
import type { HistoryThread } from "../historyStore";
import type { LocalSettingsService } from "./LocalSettingsService";

type RemoteSyncQueueItem = {
  id: string;
  createdAt: number;
  payload: RemoteSyncEventPayload;
};

type RemoteThreadRuntimeState = {
  threadId: string;
  title: string;
  updatedAt: number;
  running: boolean;
  activeTurnId: string | null;
  lastError: string | null;
};

type RemoteThreadPlanState = {
  turnId: string;
  explanation: string | null;
  steps: RemoteSyncPlanStep[];
  updatedAt: number;
};

type RemoteAuthTokenPair = {
  accessToken: string | null;
  refreshToken: string | null;
};

type RemoteStateSyncServiceDeps = {
  localSettingsService: LocalSettingsService;
  onState: (payload: { state: AppRemoteSyncState }) => void;
};

type JsonRecord = Record<string, unknown>;

const QUEUE_FILE_NAME = "remote-sync-queue.json";
const MAX_QUEUE_ITEMS = 1500;
const MAX_EVENTS_PER_FLUSH = 120;

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeBaseUrl(value: unknown): string | null {
  const raw = toNullableString(value);
  if (!raw) return null;
  const trimmed = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function normalizePlanStep(value: unknown): RemoteSyncPlanStep | null {
  const record = toRecord(value);
  const step = toNullableString(record?.step);
  if (!step) return null;
  const statusRaw = String(record?.status ?? "").trim();
  const status: RemoteSyncPlanStep["status"] =
    statusRaw === "completed" ? "completed" : statusRaw === "inProgress" ? "inProgress" : "pending";
  return { step, status };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "unknown error");
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v), 2);
  } catch (error) {
    return JSON.stringify({ _error: "json_stringify_failed", message: readErrorMessage(error) }, null, 2);
  }
}

function normalizeThreadTitle(thread: HistoryThread): string {
  const title = toNullableString(thread.title);
  if (title) return title;
  return toNullableString(thread.id) || "未命名线程";
}

function parseAuthPair(value: unknown): RemoteAuthTokenPair {
  const record = toRecord(value);
  const accessToken =
    toNullableString(record?.accessToken) ?? toNullableString(record?.access_token) ?? toNullableString(record?.token);
  const refreshToken = toNullableString(record?.refreshToken) ?? toNullableString(record?.refresh_token);
  return { accessToken, refreshToken };
}

function parseDesktopId(value: unknown): string | null {
  const record = toRecord(value);
  return toNullableString(record?.desktopId) ?? toNullableString(record?.desktop_id) ?? toNullableString(record?.id);
}

function parsePlanFromNotification(notification: CodexServerNotificationMessage): {
  threadId: string;
  turnId: string;
  explanation: string | null;
  steps: RemoteSyncPlanStep[];
} | null {
  if (notification.method !== "turn/plan/updated") return null;
  const params = toRecord(notification.params);
  const threadId = toNullableString(params?.threadId);
  const turnId = toNullableString(params?.turnId);
  if (!threadId || !turnId) return null;
  const explanation = toNullableString(params?.explanation);
  const stepsRaw = Array.isArray(params?.plan) ? params?.plan : [];
  const steps = stepsRaw.map((item) => normalizePlanStep(item)).filter(Boolean) as RemoteSyncPlanStep[];
  return { threadId, turnId, explanation, steps };
}

export class RemoteStateSyncService {
  private readonly deps: RemoteStateSyncServiceDeps;
  private readonly queueFilePath: string;
  private state: AppRemoteSyncState;
  private queue: RemoteSyncQueueItem[] = [];
  private threadStateById = new Map<string, RemoteThreadRuntimeState>();
  private planStateByThreadId = new Map<string, RemoteThreadPlanState>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushAbortController: AbortController | null = null;
  private flushing = false;
  private started = false;

  constructor(deps: RemoteStateSyncServiceDeps) {
    this.deps = deps;
    this.queueFilePath = join(app.getPath("userData"), QUEUE_FILE_NAME);
    const defaults = normalizeUserLocalSettings(null).remoteSync;
    this.state = {
      phase: "disabled",
      enabled: defaults.enabled,
      configured: false,
      authenticated: false,
      serverBaseUrl: defaults.serverBaseUrl,
      username: defaults.username,
      desktopId: defaults.desktopId,
      lastSyncedAt: 0,
      pendingQueueSize: 0,
      lastError: null,
      settings: { ...defaults },
    };
  }

  getState(): AppRemoteSyncState {
    return {
      ...this.state,
      settings: { ...this.state.settings },
    };
  }

  async start(initialSettings?: UserLocalSettings): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.loadQueueFromDisk();
    const normalized = normalizeUserLocalSettings(initialSettings ?? null);
    this.applySettings(normalized);
    this.startLoop();
    this.emitState();
  }

  stop(): void {
    this.started = false;
    this.flushAbortController?.abort();
    this.flushAbortController = null;
    this.flushing = false;
    this.clearLoop();
    this.clearFlushTimer();
  }

  getQueueCacheFilePath(): string {
    return this.queueFilePath;
  }

  async getQueueCacheStats(): Promise<{ items: number; bytes: number; updatedAt: number }> {
    let bytes = 0;
    try {
      const metadata = await stat(this.queueFilePath);
      if (metadata.isFile()) bytes = Math.max(0, Math.round(metadata.size));
    } catch {}
    return {
      items: this.queue.length,
      bytes,
      updatedAt: Date.now(),
    };
  }

  onSettingsUpdated(settings: UserLocalSettings): void {
    this.applySettings(normalizeUserLocalSettings(settings));
    this.emitState();
  }

  observeHistoryThreads(items: HistoryThread[]): void {
    const known = new Set<string>();
    for (const item of items) {
      const threadId = toNullableString(item.id);
      if (!threadId) continue;
      known.add(threadId);
      const existing = this.threadStateById.get(threadId);
      this.threadStateById.set(threadId, {
        threadId,
        title: normalizeThreadTitle(item),
        updatedAt: Number.isFinite(item.updatedAt) ? Math.max(0, Math.round(item.updatedAt)) : Date.now(),
        running: Boolean(item.running),
        activeTurnId: toNullableString(item.activeTurnId),
        lastError: existing?.lastError ?? null,
      });
    }
    for (const threadId of Array.from(this.threadStateById.keys())) {
      if (!known.has(threadId)) {
        this.threadStateById.delete(threadId);
        this.planStateByThreadId.delete(threadId);
      }
    }
    this.scheduleFlushSoon();
  }

  clearThread(threadIdValue: string): void {
    const threadId = toNullableString(threadIdValue);
    if (!threadId) return;
    this.threadStateById.delete(threadId);
    this.planStateByThreadId.delete(threadId);
    this.scheduleFlushSoon();
  }

  observeCodexEvent(payload: { serverId: string; msg: CodexIncomingMessage }): void {
    if (!this.state.enabled) return;
    if (!isCodexServerNotificationMessage(payload.msg)) return;
    const notification = payload.msg;
    if (notification.method === "turn/started") {
      const params = toRecord(notification.params);
      const threadId = toNullableString(params?.threadId);
      const turn = toRecord(params?.turn);
      const turnId = toNullableString(turn?.id);
      if (!threadId || !turnId) return;
      this.applyThreadRunningState(threadId, turnId, true);
      this.enqueueEvent({
        id: randomUUID(),
        occurredAt: Date.now(),
        eventType: "turnStarted",
        threadId,
        turnId,
        payload: { serverId: payload.serverId },
      });
      return;
    }
    if (notification.method === "turn/completed") {
      const params = toRecord(notification.params);
      const threadId = toNullableString(params?.threadId);
      const turn = toRecord(params?.turn);
      const turnId = toNullableString(turn?.id);
      if (!threadId) return;
      this.applyThreadRunningState(threadId, turnId, false);
      this.enqueueEvent({
        id: randomUUID(),
        occurredAt: Date.now(),
        eventType: "turnCompleted",
        threadId,
        turnId: turnId ?? undefined,
        payload: { serverId: payload.serverId },
      });
      return;
    }
    const plan = parsePlanFromNotification(notification);
    if (!plan) return;
    this.planStateByThreadId.set(plan.threadId, {
      turnId: plan.turnId,
      explanation: plan.explanation,
      steps: plan.steps,
      updatedAt: Date.now(),
    });
    this.enqueueEvent({
      id: randomUUID(),
      occurredAt: Date.now(),
      eventType: "planUpdated",
      threadId: plan.threadId,
      turnId: plan.turnId,
      payload: {
        explanation: plan.explanation,
        steps: plan.steps,
        serverId: payload.serverId,
      },
    });
  }

  async login(args: { password: string }): Promise<{ ok: boolean; state: AppRemoteSyncState; error?: string }> {
    try {
      const baseUrl = normalizeBaseUrl(this.state.settings.serverBaseUrl);
      const username = toNullableString(this.state.settings.username);
      const password = toNullableString(args.password);
      if (!baseUrl || !username || !password) {
        throw new Error("请先配置服务地址、用户名和密码。");
      }
      const loginResult = await this.requestJson("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const auth = parseAuthPair(loginResult);
      if (!auth.accessToken) {
        throw new Error("登录响应缺少 access token。");
      }
      await this.persistRemoteSyncSettings({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
      });
      this.state.lastError = null;
      await this.ensureDesktopBinding();
      this.emitState();
      return { ok: true, state: this.getState() };
    } catch (error) {
      const message = readErrorMessage(error);
      this.state.phase = this.state.enabled ? "error" : "disabled";
      this.state.lastError = message;
      this.emitState();
      return { ok: false, state: this.getState(), error: message };
    }
  }

  async logout(): Promise<{ ok: true; state: AppRemoteSyncState }> {
    await this.persistRemoteSyncSettings({
      accessToken: null,
      refreshToken: null,
      desktopId: null,
    });
    this.state.lastError = null;
    this.state.phase = this.state.enabled ? "idle" : "disabled";
    this.emitState();
    return { ok: true, state: this.getState() };
  }

  async flushNow(): Promise<{ ok: boolean; state: AppRemoteSyncState; error?: string }> {
    const result = await this.flushOnce();
    if (!result.ok) return { ok: false, state: this.getState(), error: result.error };
    return { ok: true, state: this.getState() };
  }

  private applyThreadRunningState(threadId: string, turnId: string | null, running: boolean): void {
    const existing = this.threadStateById.get(threadId);
    this.threadStateById.set(threadId, {
      threadId,
      title: existing?.title ?? threadId,
      updatedAt: Date.now(),
      running,
      activeTurnId: running ? turnId : null,
      lastError: existing?.lastError ?? null,
    });
  }

  private applySettings(settings: UserLocalSettings): void {
    const remote = settings.remoteSync;
    this.state.settings = { ...remote };
    this.state.enabled = remote.enabled;
    this.state.serverBaseUrl = normalizeBaseUrl(remote.serverBaseUrl);
    this.state.username = toNullableString(remote.username);
    this.state.desktopId = toNullableString(remote.desktopId);
    this.state.configured = Boolean(this.state.serverBaseUrl && this.state.username);
    this.state.authenticated = Boolean(remote.accessToken);
    if (!this.state.enabled) {
      this.state.phase = "disabled";
      this.state.lastError = null;
    } else if (this.state.phase === "disabled") {
      this.state.phase = "idle";
    }
    this.startLoop();
  }

  private emitState(): void {
    this.state.pendingQueueSize = this.queue.length;
    this.state.configured = Boolean(this.state.serverBaseUrl && this.state.username);
    this.state.authenticated = Boolean(this.state.settings.accessToken);
    this.deps.onState({ state: this.getState() });
  }

  private startLoop(): void {
    this.clearLoop();
    const intervalSec = this.state.settings.heartbeatIntervalSec;
    const intervalMs = Math.max(1, Math.round(intervalSec)) * 1000;
    this.loopTimer = setInterval(() => {
      void this.flushOnce();
    }, intervalMs);
  }

  private clearLoop(): void {
    if (!this.loopTimer) return;
    clearInterval(this.loopTimer);
    this.loopTimer = null;
  }

  private clearFlushTimer(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private scheduleFlushSoon(delayMs = 1200): void {
    if (!this.state.enabled) return;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(
      () => {
        this.flushTimer = null;
        void this.flushOnce();
      },
      Math.max(300, Math.round(delayMs))
    );
  }

  private async flushOnce(): Promise<{ ok: boolean; error?: string }> {
    if (this.flushing) return { ok: true };
    if (!this.state.enabled) {
      this.state.phase = "disabled";
      this.state.lastError = null;
      this.emitState();
      return { ok: true };
    }
    if (!this.state.configured) {
      this.state.phase = "idle";
      this.state.lastError = "请先配置远程服务地址和用户名。";
      this.emitState();
      return { ok: false, error: this.state.lastError };
    }
    if (!this.state.settings.accessToken) {
      this.state.phase = "idle";
      this.state.lastError = "未登录远程服务。";
      this.emitState();
      return { ok: false, error: this.state.lastError };
    }

    this.flushing = true;
    const abortController = new AbortController();
    this.flushAbortController = abortController;
    this.state.phase = "syncing";
    this.state.lastError = null;
    this.emitState();
    try {
      await this.ensureDesktopBinding();
      const desktopId = toNullableString(this.state.settings.desktopId);
      if (!desktopId) throw new Error("未绑定桌面实例。");

      while (this.queue.length > 0) {
        const chunk = this.queue.slice(0, MAX_EVENTS_PER_FLUSH);
        await this.requestJson("/api/v1/ingest/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            desktopId,
            events: chunk.map((item) => item.payload),
          }),
        });
        this.queue.splice(0, chunk.length);
        await this.persistQueueToDisk();
      }

      await this.requestJson("/api/v1/ingest/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desktopId,
          snapshot: this.buildSnapshot(),
        }),
      });
      this.state.lastSyncedAt = Date.now();
      this.state.phase = "idle";
      this.state.lastError = null;
      this.emitState();
      return { ok: true };
    } catch (error) {
      if (!this.started) return { ok: true };
      const message = readErrorMessage(error);
      this.state.phase = "error";
      this.state.lastError = message;
      this.emitState();
      return { ok: false, error: message };
    } finally {
      if (this.flushAbortController === abortController) {
        this.flushAbortController = null;
      }
      this.flushing = false;
    }
  }

  private enqueueEvent(payload: RemoteSyncEventPayload): void {
    const item: RemoteSyncQueueItem = {
      id: randomUUID(),
      createdAt: Date.now(),
      payload,
    };
    this.queue.push(item);
    if (this.queue.length > MAX_QUEUE_ITEMS) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE_ITEMS);
    }
    void this.persistQueueToDisk();
    this.emitState();
    this.scheduleFlushSoon();
  }

  private buildSnapshot(): RemoteSyncSnapshotPayload {
    const threads: RemoteSyncThreadSummary[] = [];
    for (const runtimeState of this.threadStateById.values()) {
      const plan = this.planStateByThreadId.get(runtimeState.threadId);
      threads.push({
        threadId: runtimeState.threadId,
        title: runtimeState.title,
        updatedAt: runtimeState.updatedAt,
        running: runtimeState.running,
        activeTurnId: runtimeState.activeTurnId,
        lastError: runtimeState.lastError,
        planTurnId: plan?.turnId ?? null,
        planExplanation: plan?.explanation ?? null,
        planSteps: plan?.steps ?? [],
      });
    }
    threads.sort((left, right) => right.updatedAt - left.updatedAt);
    return {
      generatedAt: Date.now(),
      threads,
    };
  }

  private async requestJson(path: string, init: RequestInit, retry = true): Promise<unknown> {
    const baseUrl = normalizeBaseUrl(this.state.settings.serverBaseUrl);
    if (!baseUrl) throw new Error("远程服务地址无效。");
    const headers: Record<string, string> = {
      ...(toRecord(init.headers) as Record<string, string>),
    };
    if (this.state.settings.accessToken) {
      headers.Authorization = `Bearer ${this.state.settings.accessToken}`;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? this.flushAbortController?.signal,
    });
    if (response.status === 401 && retry) {
      const refreshed = await this.tryRefreshAccessToken();
      if (refreshed) return this.requestJson(path, init, false);
    }
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private async tryRefreshAccessToken(): Promise<boolean> {
    const baseUrl = normalizeBaseUrl(this.state.settings.serverBaseUrl);
    const refreshToken = toNullableString(this.state.settings.refreshToken);
    if (!baseUrl || !refreshToken) return false;
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: this.flushAbortController?.signal,
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const json = await response.json().catch(() => null);
    const auth = parseAuthPair(json);
    if (!auth.accessToken) return false;
    await this.persistRemoteSyncSettings({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken ?? refreshToken,
    });
    return true;
  }

  private async ensureDesktopBinding(): Promise<void> {
    const desktopId = toNullableString(this.state.settings.desktopId);
    if (desktopId) return;
    const result = await this.requestJson("/api/v1/desktop/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "CodeNexus",
        clientVersion: app.getVersion(),
        deviceName: toNullableString(process.env.COMPUTERNAME) ?? "desktop",
      }),
    });
    const nextDesktopId = parseDesktopId(result);
    if (!nextDesktopId) throw new Error("桌面绑定响应缺少 desktopId。");
    await this.persistRemoteSyncSettings({ desktopId: nextDesktopId });
  }

  private async persistRemoteSyncSettings(
    patch: Partial<{
      accessToken: string | null;
      refreshToken: string | null;
      desktopId: string | null;
    }>
  ): Promise<void> {
    const settings = await this.deps.localSettingsService.patch({
      remoteSync: {
        accessToken: "accessToken" in patch ? (patch.accessToken ?? null) : undefined,
        refreshToken: "refreshToken" in patch ? (patch.refreshToken ?? null) : undefined,
        desktopId: "desktopId" in patch ? (patch.desktopId ?? null) : undefined,
      },
    });
    this.applySettings(settings);
  }

  private async loadQueueFromDisk(): Promise<void> {
    try {
      const raw = await readFile(this.queueFilePath, "utf8");
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      this.queue = items
        .map((item: unknown) => {
          const record = toRecord(item);
          const payload = toRecord(record?.payload);
          const id = toNullableString(record?.id);
          const payloadId = toNullableString(payload?.id);
          const eventType = toNullableString(payload?.eventType);
          const threadId = toNullableString(payload?.threadId);
          if (!id || !payloadId || !eventType || !threadId) return null;
          if (eventType !== "turnStarted" && eventType !== "turnCompleted" && eventType !== "planUpdated") return null;
          return {
            id,
            createdAt: Number.isFinite(Number(record?.createdAt)) ? Math.max(0, Number(record?.createdAt)) : Date.now(),
            payload: {
              id: payloadId,
              occurredAt: Number.isFinite(Number(payload?.occurredAt))
                ? Math.max(0, Number(payload?.occurredAt))
                : Date.now(),
              eventType,
              threadId,
              turnId: toNullableString(payload?.turnId) ?? undefined,
              payload: payload?.payload,
            } satisfies RemoteSyncEventPayload,
          } satisfies RemoteSyncQueueItem;
        })
        .filter(Boolean) as RemoteSyncQueueItem[];
      this.queue.sort((left, right) => left.createdAt - right.createdAt);
    } catch {
      this.queue = [];
    }
    this.emitState();
  }

  private async persistQueueToDisk(): Promise<void> {
    const content = safeJsonStringify({
      version: 1,
      items: this.queue.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        payload: item.payload,
      })),
    });
    await mkdir(dirname(this.queueFilePath), { recursive: true });
    await writeFile(this.queueFilePath, `${content}\n`, "utf8");
  }
}
