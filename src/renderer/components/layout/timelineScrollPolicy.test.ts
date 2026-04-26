import { describe, expect, it } from "vitest";
import {
  TIMELINE_FOLLOW_THRESHOLD_PX,
  classifyViewportFollowState,
  resolveTimelineScrollIntent,
  restorePrependScrollTop,
  restoreScrollTopFromBottomOffset,
  type TimelineViewportSnapshot,
} from "./timelineScrollPolicy";

const snapshot = (scrollTop: number, scrollHeight: number, clientHeight: number): TimelineViewportSnapshot => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

describe("timeline scroll policy", () => {
  it("treats viewports within the bottom threshold as following", () => {
    expect(TIMELINE_FOLLOW_THRESHOLD_PX).toBe(56);
    expect(classifyViewportFollowState(snapshot(544, 1000, 400))).toBe("following");
    expect(classifyViewportFollowState(snapshot(543, 1000, 400))).toBe("detached");
  });

  it("keeps a detached viewport stable during same-turn stream updates", () => {
    const intent = resolveTimelineScrollIntent({
      reason: "stream-update",
      followState: "detached",
      previousTurnId: "turn-a",
      nextTurnId: "turn-a",
    });

    expect(intent).toEqual({ kind: "preserve-position" });
  });

  it("continues following the bottom during stream updates when already attached", () => {
    const intent = resolveTimelineScrollIntent({
      reason: "stream-update",
      followState: "following",
      previousTurnId: "turn-a",
      nextTurnId: "turn-a",
    });

    expect(intent).toEqual({ kind: "scroll-to-bottom" });
  });

  it("forces the bottom when a new turn starts after the user was detached", () => {
    const intent = resolveTimelineScrollIntent({
      reason: "turn-changed",
      followState: "detached",
      previousTurnId: "turn-a",
      nextTurnId: "turn-b",
    });

    expect(intent).toEqual({ kind: "scroll-to-bottom" });
  });

  it("preserves visible content after older history is prepended", () => {
    expect(restorePrependScrollTop(snapshot(40, 1000, 400), snapshot(40, 1240, 400))).toBe(280);
  });

  it("restores a viewport from a saved bottom offset", () => {
    expect(restoreScrollTopFromBottomOffset(snapshot(0, 1200, 400), 180)).toBe(620);
    expect(restoreScrollTopFromBottomOffset(snapshot(0, 500, 600), 180)).toBe(0);
  });
});
