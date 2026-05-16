<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--assistant']">
    <div class="chat-bubble chat-bubble-assistant w-full max-w-full min-w-0">
      <PlanOutputCard
        v-if="event.method === 'item/plan/delta' && assistantPlanMessageFormat === 'plan-card-v1'"
        class="chat-bubble-body min-w-0"
        :rawText="event.paramsText"
        :turnPlan="turnPlan"
      />
      <StructuredFinalAnswerCard
        v-else-if="isStructuredFinalAnswer"
        class="chat-bubble-body min-w-0"
        :rawText="event.paramsText"
      />
      <AgentMarkdownContent
        v-else
        class="chat-bubble-body agent-markdown-body min-w-0"
        :html="markdownHtml"
        :streaming="isStreaming"
        :animateTextGrowth="event.method === 'item/agentMessage/delta' || event.method === 'item/plan/delta'"
        :suppressTextEnterAnimations="suppressTextEnterAnimations"
      />
      <div
        v-if="event.method === 'item/plan/delta' && execState"
        class="plan-delta-actions mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-2.5"
      >
        <SelectDropdown
          :id="`plan-delta-model-${event.id}`"
          :modelValue="execState.model"
          class="mono inline-flex h-7 w-[clamp(108px,14vw,152px)] min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] max-[1500px]:w-[clamp(100px,16vw,136px)]"
          :options="modelOptions"
          :minPopoverWidth="0"
          aria-label="模型"
          :disabled="isTurnRunning || execState.executing"
          @update:modelValue="(value) => $emit('update:model', String(value ?? ''))"
        />
        <SelectDropdown
          :id="`plan-delta-effort-${event.id}`"
          :modelValue="execState.reasoningEffort"
          class="mono inline-flex h-7 min-w-0 w-[min(100%,70px)] max-w-[70px] cursor-pointer items-center justify-between gap-2 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] max-[1500px]:w-[min(100%,66px)] max-[1500px]:max-w-[66px]"
          :minPopoverWidth="0"
          :options="reasoningEffortOptions"
          aria-label="思考强度"
          :disabled="isTurnRunning || execState.executing"
          @update:modelValue="(value) => $emit('update:reasoning-effort', String(value ?? ''))"
        />
        <SelectDropdown
          :id="`plan-delta-sandbox-${event.id}`"
          :modelValue="execState.sandboxMode"
          class="mono inline-flex h-7 min-w-0 w-[min(100%,64px)] max-w-[64px] cursor-pointer items-center justify-between gap-1.5 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-1.5 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] max-[1500px]:w-[min(100%,60px)] max-[1500px]:max-w-[60px]"
          :class="sandboxSelectClass"
          :minPopoverWidth="0"
          :options="sandboxModeOptions"
          aria-label="权限"
          :disabled="isTurnRunning || execState.executing"
          @update:modelValue="(value) => $emit('update:sandbox-mode', String(value ?? '') as SandboxMode)"
        />
        <button
          class="!inline-flex !h-7 !items-center !justify-center !rounded-xl !border !border-[color:var(--border-warning)] !bg-gradient-to-b !from-[color:var(--bg-warning-soft)] !to-[color:var(--button-bg)] !px-3 !tracking-[0.1px] !text-[color:var(--fg-warning)] !shadow-none transition-[border-color,background,box-shadow,color] duration-150 hover:!border-[color:var(--border-warning-hover)] hover:!to-[color:var(--button-bg-hover)] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[color:var(--bg-warning-soft)] active:!translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          :disabled="isTurnRunning || execState.executing"
          v-tooltip="isTurnRunning ? '当前回合运行中，请等待完成后再执行计划' : '切换到 agent 模式并发送“执行计划”'"
          @click="$emit('execute-plan', event)"
        >
          <span v-if="execState.executing">执行中...</span>
          <span v-else>执行计划</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, defineComponent, h } from "vue";
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import SelectDropdown from "../ui/SelectDropdown.vue";
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
const StructuredFinalAnswerCard = defineAsyncComponent({
  loader: () => import("../ui/StructuredFinalAnswerCard.vue"),
  loadingComponent: AssistantCardLoading,
  delay: 120,
});

defineProps<{
  event: TimelineEventItem;
  assistantPlanMessageFormat: string;
  turnPlan: TurnPlanState | null;
  isStructuredFinalAnswer: boolean;
  markdownHtml: string;
  isStreaming: boolean;
  suppressTextEnterAnimations?: boolean;
  execState: PlanDeltaExecUiState | null;
  modelOptions: OptionInput[];
  isTurnRunning: boolean;
  reasoningEffortOptions: OptionInput[];
  sandboxModeOptions: OptionInput[];
  sandboxSelectClass: string;
}>();

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
