<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--assistant']">
    <div class="chat-bubble chat-bubble-assistant w-full max-w-full min-w-0">
      <MarkdownPlanOutputCard v-if="isPlanDelta" :rawText="event.paramsText" :forceCollapsed="shouldCollapsePlan">
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
      <details v-if="memoryCitationSummary" class="assistant-memory-citation">
        <summary class="assistant-memory-citation__summary mono">{{ memoryCitationSummary }}</summary>
        <pre class="assistant-memory-citation__body mono">{{ memoryCitationRaw }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h } from "vue";
import { useI18n } from "vue-i18n";
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import ChatPlanDeltaActions from "./ChatPlanDeltaActions.vue";
import type { TimelineEventItem } from "../../domain/types";
import type { PlanDeltaExecUiState } from "../layout/types/chat.types";
import type { SandboxMode } from "../../stores/runtime.store";
import { CHAT_ROW_BASE_CLASS } from "../layout/chat/chatPresentation";
import { safeJsonStringify } from "../../utils/safeJson";

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
  isStructuredFinalAnswer: boolean;
  markdownHtml: string;
  execState: PlanDeltaExecUiState | null;
  modelOptions: readonly OptionInput[];
  isTurnRunning: boolean;
  reasoningEffortOptions: readonly OptionInput[];
  sandboxModeOptions: readonly OptionInput[];
}>();

const { t } = useI18n();
const isPlanDelta = computed(() => props.event.method === "item/plan/delta");
const planActionDisabled = computed(() => props.isTurnRunning || Boolean(props.execState?.executing));
const shouldCollapsePlan = computed(() => {
  const state = props.execState;
  if (!state?.collapseWhileExecuting) return false;
  return Boolean(state.executing || props.isTurnRunning);
});
const memoryCitation = computed(() => {
  const params = props.event.params as any;
  const citation = params?.item?.memoryCitation;
  return citation && typeof citation === "object" && !Array.isArray(citation) ? citation : null;
});
const memoryCitationSummary = computed(() => {
  const citation = memoryCitation.value;
  if (!citation) return "";
  const entries = Array.isArray(citation.entries) ? citation.entries.length : 0;
  const threads = Array.isArray(citation.threadIds) ? citation.threadIds.length : 0;
  if (entries <= 0 && threads <= 0) return "";
  return t("chat.memoryCitation.summary", { entries, threads });
});
const memoryCitationRaw = computed(() =>
  memoryCitation.value ? safeJsonStringify(memoryCitation.value, { space: 2 }) : ""
);

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

.assistant-memory-citation {
  margin-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  padding-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.assistant-memory-citation__summary {
  cursor: pointer;
  user-select: none;
}

.assistant-memory-citation__body {
  margin-top: 6px;
  max-height: 180px;
  overflow: auto;
  border-radius: 4px;
  background: var(--ui-code-bg);
  padding: 8px;
  color: var(--ui-code-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
