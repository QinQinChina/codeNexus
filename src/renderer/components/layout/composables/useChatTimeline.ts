import { computed } from "vue";
import { useThreadStore } from "../../../stores/thread.store";
import { useRuntimeStore } from "../../../stores/runtime.store";
import type { TimelineEventItem, TurnPlanState } from "../../../domain/types";

export function useChatTimeline() {
  const threadStore = useThreadStore();
  const runtimeStore = useRuntimeStore();

  const isTurnRunning = computed(() => {
    const tid = String(runtimeStore.currentThreadId ?? "").trim();
    if (!tid) return false;
    return threadStore.runningThreadIds.has(tid);
  });

  const turnPlanForPlanDeltaEvent = (event: TimelineEventItem): TurnPlanState | null => {
    const threadId = String(event?.threadId ?? runtimeStore.currentThreadId ?? "").trim();
    const turnId = String(event?.turnId ?? "").trim();
    if (!threadId || !turnId) return null;
    return threadStore.turnPlanForTurn(threadId, turnId);
  };

  return {
    isTurnRunning,
    turnPlanForPlanDeltaEvent,
  };
}
