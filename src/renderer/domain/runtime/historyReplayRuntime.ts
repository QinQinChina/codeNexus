import type { ReplayTimelineEvent } from "../../features/history/replayParsers";
import type { CompletedTurnState, TimelineEventItem } from "../types";

export type ThreadReplayCache = ReplayTimelineEvent[];

export type ThreadReplayWindowStateLike = {
  hasMorePages: boolean;
  bufferedOlderEvents: ThreadReplayCache;
};

export function sortReplayEvents(events: ReplayTimelineEvent[]): ReplayTimelineEvent[] {
  return [...events].sort((a, b) => {
    const ta = Number.isFinite(a.createdAt) ? Number(a.createdAt) : 0;
    const tb = Number.isFinite(b.createdAt) ? Number(b.createdAt) : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

export function dedupeReplayEvents(events: ReplayTimelineEvent[]): ReplayTimelineEvent[] {
  const seen = new Set<string>();
  const deduped: ReplayTimelineEvent[] = [];
  for (const event of sortReplayEvents(events)) {
    const key = [event.method, event.turnId ?? "", String(event.createdAt ?? ""), event.paramsText].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

function replayEventTurnId(event: { turnId?: string }): string {
  return String(event.turnId ?? "").trim();
}

export function countReplayTurns(events: ReplayTimelineEvent[]): number {
  const turnIds = new Set<string>();
  for (const event of events) {
    const turnId = replayEventTurnId(event);
    if (turnId) turnIds.add(turnId);
  }
  return turnIds.size;
}

export function splitReplayEventsByRecentTurns(
  events: ReplayTimelineEvent[],
  turnLimit: number
): {
  olderEvents: ThreadReplayCache;
  visibleEvents: ReplayTimelineEvent[];
} {
  const normalized = dedupeReplayEvents(events);
  if (normalized.length === 0 || turnLimit <= 0) {
    return {
      olderEvents: [],
      visibleEvents: normalized,
    };
  }

  const includedTurnIds = new Set<string>();
  let boundaryIndex = -1;
  let boundaryTurnId = "";

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const turnId = replayEventTurnId(normalized[index]);
    if (!turnId) continue;
    includedTurnIds.add(turnId);
    if (includedTurnIds.size >= turnLimit) {
      boundaryIndex = index;
      boundaryTurnId = turnId;
      break;
    }
  }

  if (boundaryIndex < 0) {
    return {
      olderEvents: [],
      visibleEvents: normalized,
    };
  }

  while (boundaryIndex > 0 && replayEventTurnId(normalized[boundaryIndex - 1]) === boundaryTurnId) {
    boundaryIndex -= 1;
  }

  return {
    olderEvents: normalized.slice(0, boundaryIndex),
    visibleEvents: normalized.slice(boundaryIndex),
  };
}

export function hasOlderReplayHistory(state: ThreadReplayWindowStateLike | null | undefined): boolean {
  if (!state) return false;
  return state.bufferedOlderEvents.length > 0 || state.hasMorePages;
}

export function normalizePlanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractProposedPlanBody(value: unknown): string {
  const text = String(value ?? "");
  if (!text) return "";
  const match = text.match(/<\s*proposed_plan\s*>([\s\S]*?)<\s*\/\s*proposed_plan\s*>/i);
  if (!match?.[1]) return "";
  return normalizePlanText(match[1]);
}

export function stripProposedPlanTags(value: unknown): string {
  const text = String(value ?? "");
  if (!text) return "";
  const match = text.match(/<\s*proposed_plan\s*>([\s\S]*?)<\s*\/\s*proposed_plan\s*>/i);
  if (!match?.[0]) return normalizePlanText(text);
  const body = normalizePlanText(match[1]);
  const before = text.slice(0, match.index ?? 0).trimEnd();
  const after = text.slice((match.index ?? 0) + match[0].length).trimStart();
  const parts = [before, body, after].filter((part) => String(part ?? "").trim().length > 0);
  return normalizePlanText(parts.join("\n\n"));
}

export function toPlanSignatureText(value: unknown): string {
  const normalized = normalizePlanText(value);
  if (!normalized) return "";
  return normalized
    .replace(/^执行计划\b[:：]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPlanTurnKey(turnIdValue: unknown, createdAtValue: unknown): string {
  const turnId = String(turnIdValue ?? "").trim();
  if (turnId) return turnId;
  const createdAt = Number.isFinite(createdAtValue) ? Math.round(Number(createdAtValue)) : 0;
  const bucket = createdAt > 0 ? Math.floor(createdAt / 1000) : 0;
  return `__no_turn__:${bucket}`;
}

export function isReplayCarryoverEvent(event: Pick<TimelineEventItem, "method">): boolean {
  return (
    event.method === "local/thinking" ||
    event.method === "local/contextCompaction" ||
    event.method === "item/plan/delta"
  );
}

export function getReplayEventDiffText(event: { paramsText: string; params?: unknown }): string {
  const params = event.params as any;
  if (typeof params?.diff === "string") return params.diff;
  if (typeof params?.delta === "string") return params.delta;
  return typeof event.paramsText === "string" ? event.paramsText : "";
}

export function getReplayEventTurnId(event: { turnId?: string; params?: unknown }): string {
  return String(event.turnId ?? "").trim();
}

export function buildCompletedTurnsFromReplay(
  events: Array<{ method: string; turnId?: string; params?: unknown; paramsText: string; createdAt?: number }>
): CompletedTurnState[] {
  const completedTurns: CompletedTurnState[] = [];
  const completedIndexByTurnId = new Map<string, number>();
  const diffByTurnId = new Map<string, string>();

  for (const event of events) {
    const turnId = getReplayEventTurnId(event);
    if (!turnId) continue;

    if (event.method === "turn/diff/updated") {
      const diffText = getReplayEventDiffText(event);
      diffByTurnId.set(turnId, diffText);
      const existingIndex = completedIndexByTurnId.get(turnId);
      if (existingIndex != null) {
        completedTurns[existingIndex] = {
          ...completedTurns[existingIndex],
          diffText,
        };
      }
      continue;
    }

    if (event.method !== "turn/completed") continue;
    const completedAt = Number.isFinite(event.createdAt) ? Number(event.createdAt) : 0;
    const diffText = diffByTurnId.get(turnId) ?? "";
    const existingIndex = completedIndexByTurnId.get(turnId);
    if (existingIndex == null) {
      completedIndexByTurnId.set(turnId, completedTurns.length);
      completedTurns.push({ turnId, diffText, completedAt });
    } else {
      completedTurns[existingIndex] = { turnId, diffText, completedAt };
    }
  }

  return completedTurns;
}
