export const TIMELINE_FOLLOW_THRESHOLD_PX = 56;

export type TimelineFollowState = "following" | "detached";

export type TimelineViewportSnapshot = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export type TimelineVisibleRowAnchor = {
  rowId: string;
  topOffsetPx: number;
};

export type TimelineViewportAdapter = {
  captureVisibleAnchor: () => TimelineVisibleRowAnchor | null;
  restoreVisibleAnchor: (anchor: TimelineVisibleRowAnchor) => boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  getScrollMetrics: () => TimelineViewportSnapshot;
  notifyLayoutChange: () => void;
};

export type TimelineScrollIntent = { kind: "preserve-position" } | { kind: "scroll-to-bottom" };

export type TimelineScrollReason = "stream-update" | "layout-change" | "turn-changed" | "explicit-bottom";

export function maxTimelineScrollTop(snapshot: TimelineViewportSnapshot): number {
  return Math.max(0, Math.round(snapshot.scrollHeight) - Math.round(snapshot.clientHeight));
}

export function timelineDistanceToBottom(snapshot: TimelineViewportSnapshot): number {
  return Math.max(0, maxTimelineScrollTop(snapshot) - Math.max(0, Math.round(snapshot.scrollTop)));
}

export function classifyViewportFollowState(
  snapshot: TimelineViewportSnapshot,
  thresholdPx = TIMELINE_FOLLOW_THRESHOLD_PX
): TimelineFollowState {
  return timelineDistanceToBottom(snapshot) <= Math.max(0, Math.round(thresholdPx)) ? "following" : "detached";
}

export function resolveTimelineScrollIntent(params: {
  reason: TimelineScrollReason;
  followState: TimelineFollowState;
  previousTurnId?: string;
  nextTurnId?: string;
}): TimelineScrollIntent {
  if (params.reason === "explicit-bottom") return { kind: "scroll-to-bottom" };
  if (params.reason === "turn-changed") return { kind: "scroll-to-bottom" };
  if (params.followState === "following") return { kind: "scroll-to-bottom" };
  return { kind: "preserve-position" };
}

export function restorePrependScrollTop(before: TimelineViewportSnapshot, after: TimelineViewportSnapshot): number {
  const delta = Math.max(0, Math.round(after.scrollHeight) - Math.round(before.scrollHeight));
  return Math.max(0, Math.round(before.scrollTop) + delta);
}

export function restoreScrollTopFromBottomOffset(after: TimelineViewportSnapshot, bottomOffset: number): number {
  const maxScrollTop = maxTimelineScrollTop(after);
  return Math.max(0, Math.min(maxScrollTop, maxScrollTop - Math.max(0, Math.round(bottomOffset))));
}

export function snapshotTimelineViewport(
  element: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">
): TimelineViewportSnapshot {
  return {
    scrollTop: Math.max(0, Math.round(element.scrollTop)),
    scrollHeight: Math.max(0, Math.round(element.scrollHeight)),
    clientHeight: Math.max(0, Math.round(element.clientHeight)),
  };
}
