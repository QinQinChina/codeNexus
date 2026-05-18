import { computed } from "vue";
import { useThreadStore } from "../../../stores/thread.store";
import { useRuntimeStore } from "../../../stores/runtime.store";

export function useChatTimeline() {
  const threadStore = useThreadStore();
  const runtimeStore = useRuntimeStore();

  const isTurnRunning = computed(() => {
    const tid = String(runtimeStore.currentThreadId ?? "").trim();
    if (!tid) return false;
    return threadStore.runningThreadIds.has(tid);
  });

  return {
    isTurnRunning,
  };
}
