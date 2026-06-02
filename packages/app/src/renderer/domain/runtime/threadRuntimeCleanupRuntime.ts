import type { useMessageQueueStore } from "../../stores/messageQueue.store";
import type { useRuntimeStore } from "../../stores/runtime.store";
import type { useThreadStore } from "../../stores/thread.store";
import type { useTimelineStore } from "../../stores/timeline.store";

type RuntimeStore = ReturnType<typeof useRuntimeStore>;
type ThreadStore = ReturnType<typeof useThreadStore>;
type TimelineStore = ReturnType<typeof useTimelineStore>;
type MessageQueueStore = ReturnType<typeof useMessageQueueStore>;
type ThreadScopedState = {
  delete: (threadId: string) => unknown;
};

export type ThreadRuntimeCleanupRuntimeDeps = {
  runtimeStore: RuntimeStore;
  threadStore: ThreadStore;
  timelineStore: TimelineStore;
  messageQueueStore: MessageQueueStore;
  threadScopedCaches: ThreadScopedState[];
  clearThreadResumeState: (threadId: string) => void;
  clearThreadStartConfigOverrides: (threadId: string) => void;
  clearThreadWorkspace: (threadId: string) => void;
};

export type ThreadRuntimeCleanupRuntime = {
  clearThreadRuntimeState: (threadId: string) => void;
  clearThreadLocalContextCompactionEvents: (threadId: string) => void;
};

export function createThreadRuntimeCleanupRuntime(
  deps: ThreadRuntimeCleanupRuntimeDeps
): ThreadRuntimeCleanupRuntime {
  const {
    runtimeStore,
    threadStore,
    timelineStore,
    messageQueueStore,
    threadScopedCaches,
    clearThreadResumeState,
    clearThreadStartConfigOverrides,
    clearThreadWorkspace,
  } = deps;

  const clearThreadRuntimeState = (threadIdValue: string) => {
    const id = String(threadIdValue ?? "").trim();
    if (!id) return;
    threadStore.threadHistory = threadStore.threadHistory.filter((item) => item.id !== id);
    threadStore.clearThreadState(id);
    timelineStore.clearThread(id);
    messageQueueStore.clearThreadQueue(id);
    runtimeStore.clearThreadComposeState(id);
    for (const cache of threadScopedCaches) cache.delete(id);
    clearThreadResumeState(id);
    clearThreadStartConfigOverrides(id);
    clearThreadWorkspace(id);
    if (runtimeStore.currentThreadId === id) {
      runtimeStore.setCurrentThread("", { savePrev: false });
      threadStore.setCurrentThread("");
    }
  };

  const clearThreadLocalContextCompactionEvents = (threadIdValue: string) => {
    const id = String(threadIdValue ?? "").trim();
    if (!id) return;
    for (const event of timelineStore.eventsForThread(id)) {
      if (event.method !== "local/contextCompaction") continue;
      timelineStore.removeEvent({ threadId: id, id: event.id });
    }
  };

  return { clearThreadRuntimeState, clearThreadLocalContextCompactionEvents };
}