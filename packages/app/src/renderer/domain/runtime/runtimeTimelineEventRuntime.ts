import type { useTimelineStore } from "../../stores/timeline.store";

type TimelineStore = ReturnType<typeof useTimelineStore>;

export type RuntimeTimelineEventRuntimeDeps = {
  appTimelineId: string;
  timelineStore: TimelineStore;
};

export type RuntimeTimelineEventRuntime = {
  pushEvent: (
    method: string,
    paramsText: string,
    opts?: { threadId?: string; turnId?: string; level?: "info" | "warn" | "error" }
  ) => void;
};

export function createRuntimeTimelineEventRuntime(
  deps: RuntimeTimelineEventRuntimeDeps
): RuntimeTimelineEventRuntime {
  const pushEvent: RuntimeTimelineEventRuntime["pushEvent"] = (method, paramsText, opts) => {
    deps.timelineStore.appendEvent({
      threadId: opts?.threadId || deps.appTimelineId,
      method,
      paramsText,
      turnId: opts?.turnId,
      level: opts?.level ?? "info",
    });
  };

  return { pushEvent };
}