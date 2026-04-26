import { describe, expect, it } from "vitest";
import type { ReplayTimelineEvent } from "../../features/history/replayParsers";
import {
  buildCompletedTurnsFromReplay,
  countReplayTurns,
  dedupeReplayEvents,
  hasOlderReplayHistory,
  splitReplayEventsByRecentTurns,
  stripProposedPlanTags,
  toPlanSignatureText,
  toPlanTurnKey,
} from "./historyReplayRuntime";

function event(id: string, turnId: string, createdAt: number, method = "turn/completed"): ReplayTimelineEvent {
  return {
    id,
    method,
    turnId,
    createdAt,
    paramsText: `${method}:${turnId}`,
  };
}

describe("historyReplayRuntime", () => {
  it("sorts and dedupes replay events by method, turn, timestamp, and params", () => {
    const duplicate = event("b", "turn-1", 20);
    const events = [event("c", "turn-2", 30), duplicate, event("a", "turn-1", 10), { ...duplicate, id: "z" }];

    expect(dedupeReplayEvents(events).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(countReplayTurns(events)).toBe(2);
  });

  it("splits replay events by recent turn groups", () => {
    const events = [
      event("1a", "turn-1", 10),
      event("2a", "turn-2", 20, "item/started"),
      event("2b", "turn-2", 21),
      event("3a", "turn-3", 30),
    ];

    const { olderEvents, visibleEvents } = splitReplayEventsByRecentTurns(events, 2);

    expect(olderEvents.map((item) => item.id)).toEqual(["1a"]);
    expect(visibleEvents.map((item) => item.id)).toEqual(["2a", "2b", "3a"]);
  });

  it("preserves full history when no turn boundary can be found", () => {
    const events = [{ ...event("1", "", 10), turnId: "" }];

    expect(splitReplayEventsByRecentTurns(events, 2)).toEqual({
      olderEvents: [],
      visibleEvents: events,
    });
  });

  it("reports whether older replay history is available", () => {
    expect(hasOlderReplayHistory(null)).toBe(false);
    expect(hasOlderReplayHistory({ hasMorePages: false, bufferedOlderEvents: [] })).toBe(false);
    expect(hasOlderReplayHistory({ hasMorePages: true, bufferedOlderEvents: [] })).toBe(true);
    expect(hasOlderReplayHistory({ hasMorePages: false, bufferedOlderEvents: [event("1", "turn-1", 10)] })).toBe(true);
  });

  it("normalizes proposed plan text for dedupe signatures", () => {
    expect(stripProposedPlanTags("before\n<proposed_plan>\n执行计划：\n1. A\n</proposed_plan>\nafter")).toBe(
      "before\n\n执行计划：\n1. A\n\nafter"
    );
    expect(toPlanSignatureText("执行计划：\n1. A\n2. B")).toBe("执行计划： 1. A 2. B");
    expect(toPlanTurnKey("", 1_234_567)).toBe("__no_turn__:1234");
  });

  it("rebuilds completed turn rollback state from replay events", () => {
    const completedTurns = buildCompletedTurnsFromReplay([
      { method: "turn/diff/updated", turnId: "turn-1", paramsText: "fallback", params: { diff: "diff-1" } },
      { method: "turn/completed", turnId: "turn-1", paramsText: "", createdAt: 100 },
      { method: "turn/completed", turnId: "turn-2", paramsText: "", createdAt: 200 },
      { method: "turn/diff/updated", turnId: "turn-2", paramsText: "", params: { delta: "diff-2" } },
    ]);

    expect(completedTurns).toEqual([
      { turnId: "turn-1", diffText: "diff-1", completedAt: 100 },
      { turnId: "turn-2", diffText: "diff-2", completedAt: 200 },
    ]);
  });
});
