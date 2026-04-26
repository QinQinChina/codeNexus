import { reactive, computed, watch } from "vue";
import type { TimelineEventItem } from "../../domain/types";
import type { PlanDeltaExecUiState } from "./chat.types";
import { useRuntimeStore, type SandboxMode } from "../../stores/runtime.store";
import { getRuntimeOrchestrator } from "../../domain/runtimeOrchestrator";

export function usePlanExecution(contentEvents: () => TimelineEventItem[], isTurnRunning: () => boolean) {
  const runtimeStore = useRuntimeStore();
  const runtime = getRuntimeOrchestrator();

  const planExecStateByEventId = reactive<Record<string, PlanDeltaExecUiState>>({});

  const updatePlanExecModel = (eventId: string, value: string) => {
    const state = planExecStateByEventId[eventId];
    if (state) state.model = value;
  };

  const updatePlanExecReasoningEffort = (eventId: string, value: string) => {
    const state = planExecStateByEventId[eventId];
    if (state) state.reasoningEffort = value;
  };

  const updatePlanExecSandboxMode = (eventId: string, value: SandboxMode) => {
    const state = planExecStateByEventId[eventId];
    if (state) state.sandboxMode = value;
  };

  const planDeltaEventIds = computed(() => {
    const ids: string[] = [];
    for (const event of contentEvents() ?? []) {
      if (event.method !== "item/plan/delta") continue;
      const id = String(event.id ?? "").trim();
      if (id) ids.push(id);
    }
    return ids;
  });

  watch(
    planDeltaEventIds,
    (ids) => {
      const alive = new Set(ids);
      for (const id of ids) {
        if (planExecStateByEventId[id]) continue;
        planExecStateByEventId[id] = {
          model: runtimeStore.model,
          reasoningEffort: runtimeStore.reasoningEffort,
          sandboxMode: runtimeStore.sandboxMode,
          executing: false,
        };
      }
      for (const key of Object.keys(planExecStateByEventId)) {
        if (!alive.has(key)) delete planExecStateByEventId[key];
      }
    },
    { immediate: true }
  );

  const cloneComposeAttachments = () => {
    return runtimeStore.composeAttachments.map((item) => ({ ...item, input: { ...item.input } }));
  };

  const cloneComposeFileMentions = () => {
    return runtimeStore.composeFileMentions.map((item) => ({ ...item }));
  };

  const onExecutePlanFromPlanDelta = async (event: TimelineEventItem) => {
    const eventId = String(event?.id ?? "").trim();
    if (!eventId) return;
    const state = planExecStateByEventId[eventId];
    if (!state) return;
    if (state.executing) return;
    if (isTurnRunning()) return;

    state.executing = true;
    const prevModel = runtimeStore.model;
    const prevEffort = runtimeStore.reasoningEffort;
    const prevSandbox = runtimeStore.sandboxMode;
    const prevComposeInput = runtimeStore.composeInput;
    const prevAttachments = cloneComposeAttachments();
    const prevMentions = cloneComposeFileMentions();
    const prevRewriteActive = runtimeStore.historyRewriteActive;
    const prevRewriteSource = runtimeStore.historyRewriteSource;
    const prevRewriteAnchorId = runtimeStore.historyRewriteAnchorEventId;
    const prevRewriteSavedDraft = runtimeStore.historyRewriteSavedDraft;
    const prevRewriteSavedAttachments = runtimeStore.historyRewriteSavedAttachments.map((item) => ({
      ...item,
      input: { ...item.input },
    }));
    const prevRewriteSavedMentions = runtimeStore.historyRewriteSavedMentions.map((item) => ({ ...item }));

    try {
      runtimeStore.model = state.model;
      runtimeStore.reasoningEffort = state.reasoningEffort;
      runtimeStore.sandboxMode = state.sandboxMode;
      runtimeStore.setComposeMode("default");
      runtimeStore.composeAttachments = [];
      runtimeStore.composeFileMentions = [];
      runtimeStore.composeInput = "执行计划";
      await runtime.send();
    } finally {
      runtimeStore.model = prevModel;
      runtimeStore.reasoningEffort = prevEffort;
      runtimeStore.sandboxMode = prevSandbox;
      runtimeStore.composeInput = prevComposeInput;
      runtimeStore.composeAttachments = prevAttachments.map((item) => ({ ...item, input: { ...item.input } }));
      runtimeStore.composeFileMentions = prevMentions.map((item) => ({ ...item }));
      runtimeStore.saveThreadComposeAttachments(runtimeStore.currentThreadId);
      runtimeStore.saveThreadComposeFileMentions(runtimeStore.currentThreadId);
      runtimeStore.historyRewriteActive = prevRewriteActive;
      runtimeStore.historyRewriteSource = prevRewriteSource;
      runtimeStore.historyRewriteAnchorEventId = prevRewriteAnchorId;
      runtimeStore.historyRewriteSavedDraft = prevRewriteSavedDraft;
      runtimeStore.historyRewriteSavedAttachments = prevRewriteSavedAttachments.map((item) => ({
        ...item,
        input: { ...item.input },
      }));
      runtimeStore.historyRewriteSavedMentions = prevRewriteSavedMentions.map((item) => ({ ...item }));
      state.executing = false;
    }
  };

  return {
    planExecStateByEventId,
    onExecutePlanFromPlanDelta,
    updatePlanExecModel,
    updatePlanExecReasoningEffort,
    updatePlanExecSandboxMode,
  };
}
