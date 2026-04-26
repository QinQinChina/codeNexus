import type { SandboxMode } from "../generated/codex-app-server/v2/SandboxMode";
import { DEFAULT_MODEL_NAME } from "./modelCatalog";

export type LocalDraftSandboxMode = SandboxMode;

export type LocalDraftComposeMode = "default" | "plan";

export type LocalThreadComposeState = {
  sandboxMode: LocalDraftSandboxMode;
  composeInput: string;
  composeMode: LocalDraftComposeMode;
  model: string;
  reasoningEffort: string;
  reasoningSummary: string;
};

export type LocalDraftState = {
  version: 1;
  updatedAt: number;
  threads: Record<string, LocalThreadComposeState>;
};

export const DEFAULT_LOCAL_THREAD_COMPOSE_STATE: LocalThreadComposeState = {
  sandboxMode: "danger-full-access",
  composeInput: "",
  composeMode: "default",
  model: DEFAULT_MODEL_NAME,
  reasoningEffort: "high",
  reasoningSummary: "auto",
};

export const DEFAULT_LOCAL_DRAFT_STATE: LocalDraftState = {
  version: 1,
  updatedAt: 0,
  threads: {},
};

const REASONING_EFFORT_OPTIONS = ["low", "medium", "high", "xhigh"] as const;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toThreadKey(value: unknown): string {
  return String(value ?? "").trim();
}

function toComposeMode(value: unknown): LocalDraftComposeMode {
  return value === "plan" ? "plan" : "default";
}

function normalizeModelName(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_LOCAL_THREAD_COMPOSE_STATE.model;
  // 迁移：已移除的内置模型 ID 统一回落到当前默认模型。
  if (raw === "gpt-5.2-codex") return DEFAULT_LOCAL_THREAD_COMPOSE_STATE.model;
  return raw;
}

function toSandboxMode(value: unknown): LocalDraftSandboxMode {
  if (value === "read-only" || value === "workspace-write" || value === "danger-full-access") {
    return value;
  }
  return DEFAULT_LOCAL_THREAD_COMPOSE_STATE.sandboxMode;
}

function toReasoningEffort(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  const hit = REASONING_EFFORT_OPTIONS.find((item) => item === raw);
  return hit ?? DEFAULT_LOCAL_THREAD_COMPOSE_STATE.reasoningEffort;
}

export function normalizeLocalThreadComposeState(value: unknown): LocalThreadComposeState {
  const record = toRecord(value);
  return {
    sandboxMode: toSandboxMode(record?.sandboxMode),
    composeInput:
      typeof record?.composeInput === "string" ? record.composeInput : DEFAULT_LOCAL_THREAD_COMPOSE_STATE.composeInput,
    composeMode: toComposeMode(record?.composeMode),
    model: normalizeModelName(record?.model),
    reasoningEffort: toReasoningEffort(record?.reasoningEffort),
    reasoningSummary:
      typeof record?.reasoningSummary === "string"
        ? record.reasoningSummary
        : DEFAULT_LOCAL_THREAD_COMPOSE_STATE.reasoningSummary,
  };
}

export function normalizeLocalDraftState(value: unknown): LocalDraftState {
  const root = toRecord(value);
  const threadsRecord = toRecord(root?.threads);
  const threads: Record<string, LocalThreadComposeState> = {};
  for (const [rawThreadId, rawState] of Object.entries(threadsRecord ?? {})) {
    const threadId = toThreadKey(rawThreadId);
    if (!threadId) continue;
    threads[threadId] = normalizeLocalThreadComposeState(rawState);
  }
  const updatedAt = Number(root?.updatedAt);
  return {
    version: 1,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    threads,
  };
}

export function upsertLocalDraftThreadState(
  current: unknown,
  threadIdValue: string,
  stateValue: unknown
): LocalDraftState {
  const next = normalizeLocalDraftState(current);
  const threadId = toThreadKey(threadIdValue);
  if (!threadId) return next;
  return {
    version: 1,
    updatedAt: Date.now(),
    threads: {
      ...next.threads,
      [threadId]: normalizeLocalThreadComposeState(stateValue),
    },
  };
}

export function mergeLocalDraftThreadStates(current: unknown, stateEntries: Record<string, unknown>): LocalDraftState {
  const next = normalizeLocalDraftState(current);
  const threads = { ...next.threads };
  let changed = false;

  for (const [rawThreadId, rawState] of Object.entries(stateEntries ?? {})) {
    const threadId = toThreadKey(rawThreadId);
    if (!threadId) continue;
    threads[threadId] = normalizeLocalThreadComposeState(rawState);
    changed = true;
  }

  if (!changed) return next;
  return {
    version: 1,
    updatedAt: Date.now(),
    threads,
  };
}

export function removeLocalDraftThreadState(current: unknown, threadIdValue: string): LocalDraftState {
  const next = normalizeLocalDraftState(current);
  const threadId = toThreadKey(threadIdValue);
  if (!threadId || !(threadId in next.threads)) return next;
  const threads = { ...next.threads };
  delete threads[threadId];
  return {
    version: 1,
    updatedAt: Date.now(),
    threads,
  };
}
