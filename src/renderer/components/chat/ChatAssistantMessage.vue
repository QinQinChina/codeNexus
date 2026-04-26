<template>
  <div class="chat-row chat-row--assistant flex min-w-0 m-0">
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
      />
      <div
        v-if="event.method === 'item/plan/delta' && execState"
        class="plan-delta-actions mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-2.5"
      >
        <SelectDropdown
          :id="`plan-delta-model-${event.id}`"
          :modelValue="execState.model"
          class="mono inline-flex h-7 w-[clamp(108px,14vw,152px)] min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] focus:border-[color:var(--button-border-hover)] focus:shadow-[0_0_0_3px_var(--accent-soft)] max-[1500px]:w-[clamp(100px,16vw,136px)]"
          :options="modelOptions"
          :minPopoverWidth="0"
          aria-label="模型"
          :disabled="isTurnRunning || execState.executing"
          @update:modelValue="(value) => $emit('update:model', String(value ?? ''))"
        />
        <SelectDropdown
          :id="`plan-delta-effort-${event.id}`"
          :modelValue="execState.reasoningEffort"
          class="mono inline-flex h-7 min-w-0 w-[min(100%,70px)] max-w-[70px] cursor-pointer items-center justify-between gap-2 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-2 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] focus:border-[color:var(--button-border-hover)] focus:shadow-[0_0_0_3px_var(--accent-soft)] max-[1500px]:w-[min(100%,66px)] max-[1500px]:max-w-[66px]"
          :minPopoverWidth="0"
          :options="reasoningEffortOptions"
          aria-label="思考强度"
          :disabled="isTurnRunning || execState.executing"
          @update:modelValue="(value) => $emit('update:reasoning-effort', String(value ?? ''))"
        />
        <SelectDropdown
          :id="`plan-delta-sandbox-${event.id}`"
          :modelValue="execState.sandboxMode"
          class="mono inline-flex h-7 min-w-0 w-[min(100%,64px)] max-w-[64px] cursor-pointer items-center justify-between gap-1.5 rounded-[4px] border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-1.5 text-[color:var(--input-text)] shadow-none transition-[border-color,box-shadow,background,color] duration-150 hover:border-[color:var(--button-border-hover)] hover:bg-[color:var(--button-bg-hover)] focus:border-[color:var(--button-border-hover)] focus:shadow-[0_0_0_3px_var(--accent-soft)] max-[1500px]:w-[min(100%,60px)] max-[1500px]:max-w-[60px]"
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
          :title="
            isTurnRunning ? '当前回合运行中，请等待完成后再执行计划' : '切换到 agent 模式并发送“执行计划”'
          "
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
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import PlanOutputCard from "../ui/PlanOutputCard.vue";
import StructuredFinalAnswerCard from "../ui/StructuredFinalAnswerCard.vue";
import SelectDropdown from "../ui/SelectDropdown.vue";
import type { TimelineEventItem, TurnPlanState } from "../../domain/types";
import type { PlanDeltaExecUiState } from "../layout/chat.types";
import type { SandboxMode } from "../../stores/runtime.store";

type OptionInput =
  | string
  | {
      value: string;
      label: string;
      disabled?: boolean;
    };

defineProps<{
  event: TimelineEventItem;
  assistantPlanMessageFormat: string;
  turnPlan: TurnPlanState | null;
  isStructuredFinalAnswer: boolean;
  markdownHtml: string;
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
