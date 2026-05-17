<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--assistant']">
    <div class="chat-bubble chat-bubble-assistant w-full max-w-full min-w-0">
      <PlanOutputCard
        v-if="event.method === 'item/plan/delta' && assistantPlanMessageFormat === 'plan-card-v1'"
        class="chat-bubble-body min-w-0"
        :rawText="event.paramsText"
        :turnPlan="turnPlan"
      />
      <MarkdownPlanOutputCard
        v-else-if="isMarkdownPlanOutput"
        :rawText="event.paramsText"
        :forceCollapsed="shouldCollapseMarkdownPlan"
      >
        <template v-if="execState" #actions>
          <ChatPlanDeltaActions
            :execState="execState"
            :modelOptions="modelOptions"
            :reasoningEffortOptions="reasoningEffortOptions"
            :sandboxModeOptions="sandboxModeOptions"
            :disabled="planActionDisabled"
            :embedded="true"
            @execute-plan="$emit('execute-plan', event)"
            @update:model="(value) => $emit('update:model', value)"
            @update:reasoning-effort="(value) => $emit('update:reasoning-effort', value)"
            @update:sandbox-mode="(value) => $emit('update:sandbox-mode', value)"
          />
        </template>
      </MarkdownPlanOutputCard>
      <StructuredFinalAnswerCard
        v-else-if="isStructuredFinalAnswer"
        class="chat-bubble-body min-w-0"
        :rawText="event.paramsText"
      />
      <AgentMarkdownContent v-else class="chat-bubble-body agent-markdown-body min-w-0" :html="markdownHtml" />
      <ChatPlanDeltaActions
        v-if="showStandalonePlanActions && execState"
        :execState="execState"
        :modelOptions="modelOptions"
        :reasoningEffortOptions="reasoningEffortOptions"
        :sandboxModeOptions="sandboxModeOptions"
        :disabled="planActionDisabled"
        @execute-plan="$emit('execute-plan', event)"
        @update:model="(value) => $emit('update:model', value)"
        @update:reasoning-effort="(value) => $emit('update:reasoning-effort', value)"
        @update:sandbox-mode="(value) => $emit('update:sandbox-mode', value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h } from "vue";
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import ChatPlanDeltaActions from "./ChatPlanDeltaActions.vue";
import type { TimelineEventItem, TurnPlanState } from "../../domain/types";
import type { PlanDeltaExecUiState } from "../layout/types/chat.types";
import type { SandboxMode } from "../../stores/runtime.store";
import { CHAT_ROW_BASE_CLASS } from "../layout/chat/chatPresentation";

type OptionInput =
  | string
  | {
      value: string;
      label: string;
      disabled?: boolean;
    };

const AssistantCardLoading = defineComponent({
  name: "AssistantCardLoading",
  setup() {
    return () =>
      h("div", { class: "assistant-card-loading", "aria-hidden": "true" }, [
        h("div", { class: "assistant-card-loading__line assistant-card-loading__line--wide" }),
        h("div", { class: "assistant-card-loading__line assistant-card-loading__line--short" }),
      ]);
  },
});

const PlanOutputCard = defineAsyncComponent({
  loader: () => import("../ui/PlanOutputCard.vue"),
  loadingComponent: AssistantCardLoading,
  delay: 120,
});
const MarkdownPlanOutputCard = defineAsyncComponent({
  loader: () => import("../ui/MarkdownPlanOutputCard.vue"),
  loadingComponent: AssistantCardLoading,
  delay: 120,
});
const StructuredFinalAnswerCard = defineAsyncComponent({
  loader: () => import("../ui/StructuredFinalAnswerCard.vue"),
  loadingComponent: AssistantCardLoading,
  delay: 120,
});

const props = defineProps<{
  event: TimelineEventItem;
  assistantPlanMessageFormat: string;
  turnPlan: TurnPlanState | null;
  isStructuredFinalAnswer: boolean;
  markdownHtml: string;
  execState: PlanDeltaExecUiState | null;
  modelOptions: readonly OptionInput[];
  isTurnRunning: boolean;
  reasoningEffortOptions: readonly OptionInput[];
  sandboxModeOptions: readonly OptionInput[];
}>();

const isPlanDelta = computed(() => props.event.method === "item/plan/delta");
const isMarkdownPlanOutput = computed(() => isPlanDelta.value && props.assistantPlanMessageFormat !== "plan-card-v1");
const planActionDisabled = computed(() => props.isTurnRunning || Boolean(props.execState?.executing));
const showStandalonePlanActions = computed(
  () => isPlanDelta.value && !isMarkdownPlanOutput.value && Boolean(props.execState)
);
const shouldCollapseMarkdownPlan = computed(() => {
  const state = props.execState;
  if (!state?.collapseWhileExecuting) return false;
  return Boolean(state.executing || props.isTurnRunning);
});

defineEmits<{
  (e: "execute-plan", event: TimelineEventItem): void;
  (e: "update:model", value: string): void;
  (e: "update:reasoning-effort", value: string): void;
  (e: "update:sandbox-mode", value: SandboxMode): void;
}>();
</script>

<style scoped>
.assistant-card-loading {
  display: grid;
  min-height: 64px;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--ui-well-border) 76%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--ui-well-bg) 82%, transparent);
  padding: 12px;
}

.assistant-card-loading__line {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 18%, transparent);
}

.assistant-card-loading__line--wide {
  width: min(300px, 76%);
}

.assistant-card-loading__line--short {
  width: min(190px, 48%);
}
</style>
