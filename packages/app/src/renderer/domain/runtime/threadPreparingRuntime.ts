import type { useTimelineStore } from "../../stores/timeline.store";

type TimelineStore = ReturnType<typeof useTimelineStore>;
type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export type ThreadPreparingRuntimeDeps = {
  appTimelineId: string;
  timelineStore: TimelineStore;
  translate: TranslateFn;
};

export type ThreadPreparingRuntime = {
  upsertThreadPreparingEvent: (threadId: string) => void;
  clearThreadPreparingEvent: (threadId: string) => void;
};

const THREAD_PREPARING_EVENT_ID = "local:threadPreparing";

export function createThreadPreparingRuntime(deps: ThreadPreparingRuntimeDeps): ThreadPreparingRuntime {
  const { appTimelineId, timelineStore, translate } = deps;

  const upsertThreadPreparingEvent = (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId || threadId === appTimelineId) return;
    timelineStore.upsertEvent({
      threadId,
      id: THREAD_PREPARING_EVENT_ID,
      method: "local/thinking",
      paramsText: translate("runtime.threadPreparingEnvironment"),
      params: { phase: "preparingEnvironment" },
      level: "info",
      localKind: "thinking",
      thinkingPhase: "preparing",
    });
  };

  const clearThreadPreparingEvent = (threadIdValue: string) => {
    const threadId = String(threadIdValue ?? "").trim();
    if (!threadId || threadId === appTimelineId) return;
    timelineStore.removeEvent({ threadId, id: THREAD_PREPARING_EVENT_ID });
  };

  return { upsertThreadPreparingEvent, clearThreadPreparingEvent };
}