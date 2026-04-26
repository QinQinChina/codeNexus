import type { Thread } from "../../../generated/codex-app-server/v2/Thread";
import type { Turn } from "../../../generated/codex-app-server/v2/Turn";
import type { ThreadHandoffDiagnosticsState, ThreadTurnDiagnostics } from "../../domain/types";

function normalizeThreadId(value: unknown): string {
  return String(value ?? "").trim();
}

function toEpochMs(value: unknown): number | null {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw >= 1_000_000_000_000) return Math.round(raw);
  return Math.round(raw * 1000);
}

function summarizeTurns(turns: Turn[]): ThreadTurnDiagnostics {
  const normalizedTurns = Array.isArray(turns) ? turns : [];
  let completedTurns = 0;
  let latestAnchorMs = 0;
  let lastTurnStartedAt: number | null = null;
  let lastTurnCompletedAt: number | null = null;
  let lastTurnDurationMs: number | null = null;

  for (const turn of normalizedTurns) {
    const startedAtMs = toEpochMs(turn?.startedAt);
    const completedAtMs = toEpochMs(turn?.completedAt);
    const durationMs =
      typeof turn?.durationMs === "number" && Number.isFinite(turn.durationMs) && turn.durationMs >= 0
        ? Math.round(turn.durationMs)
        : null;
    const status = String(turn?.status ?? "")
      .trim()
      .toLowerCase();
    if (completedAtMs != null || status === "completed" || status === "failed") completedTurns += 1;

    const anchorMs = completedAtMs ?? startedAtMs ?? 0;
    if (anchorMs < latestAnchorMs) continue;
    latestAnchorMs = anchorMs;
    lastTurnStartedAt = startedAtMs;
    lastTurnCompletedAt = completedAtMs;
    lastTurnDurationMs = durationMs;
  }

  return {
    totalTurns: normalizedTurns.length,
    completedTurns,
    lastTurnStartedAt,
    lastTurnCompletedAt,
    lastTurnDurationMs,
  };
}

export function buildThreadHandoffDiagnostics(params: {
  threadId: string;
  currentThread: Thread;
  parentThreadId?: string | null;
  parentThread?: Thread | null;
  fetchedAt?: number;
}): ThreadHandoffDiagnosticsState {
  const threadId = normalizeThreadId(params.threadId || params.currentThread?.id);
  const parentThreadId = normalizeThreadId(params.parentThreadId || params.parentThread?.id) || null;
  const current = summarizeTurns(Array.isArray(params.currentThread?.turns) ? params.currentThread.turns : []);
  const parent = params.parentThread
    ? summarizeTurns(Array.isArray(params.parentThread.turns) ? params.parentThread.turns : [])
    : null;

  return {
    threadId,
    parentThreadId,
    fetchedAt: Math.max(0, Math.round(Number(params.fetchedAt ?? Date.now()) || Date.now())),
    current,
    parent,
    inheritedTurns: parent ? Math.min(current.totalTurns, parent.totalTurns) : null,
    postHandoffTurns: parent ? Math.max(0, current.totalTurns - parent.totalTurns) : null,
  };
}
