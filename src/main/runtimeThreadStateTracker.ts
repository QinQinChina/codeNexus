import type { HistoryThread } from "./historyStore";
import {
  isCodexLocalEventMessage,
  isCodexServerNotificationMessage,
  type CodexLocalEvent,
  type CodexServerNotificationMessage,
} from "../shared/codex-protocol";

type RunningThreadState = {
  serverId: string;
  turnId: string;
};

type RuntimeTrackedNotification = Extract<
  CodexServerNotificationMessage,
  { method: "turn/started" | "turn/completed" }
>;
type RuntimeTrackedLocalEvent = Extract<CodexLocalEvent, { method: "codex/exit" }>;
type RuntimeTrackedMessage = RuntimeTrackedNotification | RuntimeTrackedLocalEvent;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isRuntimeTrackedMessage(value: unknown): value is RuntimeTrackedMessage {
  if (isCodexLocalEventMessage(value)) return value.method === "codex/exit";
  if (isCodexServerNotificationMessage(value)) {
    return (value.method === "turn/started" || value.method === "turn/completed") && toRecord(value.params) != null;
  }
  return false;
}

function extractThreadId(message: RuntimeTrackedNotification): string {
  return normalizeText(message.params.threadId);
}

function extractTurnId(message: RuntimeTrackedNotification): string {
  return normalizeText(message.params.turn.id);
}

export class RuntimeThreadStateTracker {
  private readonly runningByThread = new Map<string, RunningThreadState>();
  private readonly threadIdsByServer = new Map<string, Set<string>>();

  getThreadRunningState(threadIdValue: string): {
    threadId: string;
    running: boolean;
    activeTurnId: string | null;
    checkedAt: number;
  } {
    const threadId = normalizeText(threadIdValue);
    const state = threadId ? this.runningByThread.get(threadId) : undefined;
    return {
      threadId,
      running: Boolean(state),
      activeTurnId: state?.turnId || null,
      checkedAt: Date.now(),
    };
  }

  observeEvent(payload: { serverId: string; msg: unknown }) {
    const serverId = normalizeText(payload.serverId);
    if (!serverId || !isRuntimeTrackedMessage(payload.msg)) return;

    if (payload.msg.method === "turn/started") {
      const threadId = extractThreadId(payload.msg);
      if (!threadId) return;
      const turnId = extractTurnId(payload.msg);
      this.markThreadRunning(serverId, threadId, turnId);
      return;
    }

    if (payload.msg.method === "turn/completed") {
      const threadId = extractThreadId(payload.msg);
      if (!threadId) return;
      this.markThreadStopped(threadId);
      return;
    }

    this.clearServer(serverId);
  }

  clearThread(threadIdValue: string) {
    const threadId = normalizeText(threadIdValue);
    if (!threadId) return;
    this.markThreadStopped(threadId);
  }

  decorateHistoryItems(items: HistoryThread[]): HistoryThread[] {
    return items.map((item) => {
      const state = this.runningByThread.get(item.id);
      if (!state) return { ...item, running: false, activeTurnId: undefined };
      return {
        ...item,
        running: true,
        activeTurnId: state.turnId || undefined,
      };
    });
  }

  private markThreadRunning(serverIdValue: string, threadIdValue: string, turnIdValue: string) {
    const serverId = normalizeText(serverIdValue);
    const threadId = normalizeText(threadIdValue);
    const turnId = normalizeText(turnIdValue);
    if (!serverId || !threadId) return;

    const prev = this.runningByThread.get(threadId);
    if (prev?.serverId && prev.serverId !== serverId) {
      const prevSet = this.threadIdsByServer.get(prev.serverId);
      prevSet?.delete(threadId);
      if (prevSet && prevSet.size === 0) this.threadIdsByServer.delete(prev.serverId);
    }

    this.runningByThread.set(threadId, { serverId, turnId });
    const set = this.threadIdsByServer.get(serverId) ?? new Set<string>();
    set.add(threadId);
    this.threadIdsByServer.set(serverId, set);
  }

  private markThreadStopped(threadIdValue: string) {
    const threadId = normalizeText(threadIdValue);
    if (!threadId) return;
    const prev = this.runningByThread.get(threadId);
    this.runningByThread.delete(threadId);
    if (!prev?.serverId) return;
    const set = this.threadIdsByServer.get(prev.serverId);
    set?.delete(threadId);
    if (set && set.size === 0) this.threadIdsByServer.delete(prev.serverId);
  }

  private clearServer(serverIdValue: string) {
    const serverId = normalizeText(serverIdValue);
    if (!serverId) return;
    const set = this.threadIdsByServer.get(serverId);
    if (!set) return;
    for (const threadId of set) {
      this.runningByThread.delete(threadId);
    }
    this.threadIdsByServer.delete(serverId);
  }
}
