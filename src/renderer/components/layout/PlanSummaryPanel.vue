<template>
  <section
    id="plan-summary-panel"
    class="plan-summary m-0 mt-[3px] flex min-w-0 flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface-1)] p-[var(--timeline-card-padding,10px)] shadow-[var(--shadow-soft)] max-[1500px]:rounded-xl"
    :class="open ? 'max-h-[45vh] overflow-hidden' : ''"
  >
    <button
      type="button"
      class="plan-summary-toggle !h-auto !w-full !min-w-0 !select-none !items-center !justify-between !gap-2.5 !rounded-none !border-0 !bg-transparent !p-0 !text-[13px] !font-bold !tracking-[0.24px] !text-[var(--text)] !shadow-none max-[1500px]:!gap-2 max-[1500px]:!text-[12px]"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="plan-summary-content"
      @click="$emit('toggle')"
    >
      <span>计划摘要</span>
      <span class="plan-summary-toggle-right inline-flex min-w-0 items-center gap-2">
        <span
          v-if="summaryText"
          class="plan-summary-summaryline mono dim inline-flex min-w-0 max-w-[560px] items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium max-[1500px]:max-w-[460px] max-[1500px]:gap-1 max-[1500px]:text-[10px]"
        >
          <span v-if="showRunningIcon" class="running-indicator is-accent flex-none" aria-hidden="true"></span>
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ summaryText }}</span>
        </span>
        <ChevronDown
          class="plan-summary-chevron h-3.5 w-3.5 flex-none text-[var(--text-muted)] transition-[transform,color] duration-200 [stroke-width:2.2] max-[1500px]:h-3 max-[1500px]:w-3"
          :class="open ? 'rotate-180 text-[var(--text)]' : ''"
        />
      </span>
    </button>

    <div
      id="plan-summary-content"
      class="plan-summary-content grid min-h-0 flex-1 overflow-hidden transition-[grid-template-rows,opacity,margin-top] duration-200 ease-in-out"
      :class="
        open
          ? '[grid-template-rows:1fr] mt-1.5 opacity-100 max-[1500px]:mt-1'
          : '[grid-template-rows:0fr] mt-0 opacity-0 pointer-events-none'
      "
      :aria-hidden="open ? 'false' : 'true'"
    >
      <div
        class="plan-summary-content-inner app-scrollbar min-h-0 overflow-x-hidden"
        :class="open ? 'overflow-y-auto' : 'overflow-y-hidden'"
      >
        <div v-if="explanationText" class="dim mt-1 max-[1500px]:mt-0.5">{{ explanationText }}</div>
        <ol
          id="plan-summary-list"
          class="plan-step-list mt-2 grid gap-1.5 pl-[18px] max-[1500px]:mt-1.5 max-[1500px]:gap-1"
        >
          <li
            v-for="step in steps"
            :key="`${step.status}:${step.step}`"
            class="plan-step-item grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-[var(--text)]"
            :class="planStepClass(step.status)"
          >
            <span
              class="status inline-flex min-w-[92px] items-center gap-1.5 text-[11px] tracking-[0.1px] max-[1500px]:min-w-[84px] max-[1500px]:text-[10px]"
              :class="planStepStatusTextClass(step.status)"
            >
              <CircleDashed
                v-if="step.status === 'pending'"
                class="plan-step-status-icon h-3 w-3 flex-none [stroke-width:2.2]"
              />
              <span
                v-else-if="step.status === 'inProgress'"
                class="running-indicator is-accent flex-none"
                aria-hidden="true"
              ></span>
              <CheckCircle2 v-else class="plan-step-status-icon h-3 w-3 flex-none [stroke-width:2.2]" />
              <span class="mono">{{ planStepLabelText(step.status) }}</span>
            </span>
            <span class="min-w-0">{{ step.step }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CheckCircle2, ChevronDown, CircleDashed } from "lucide-vue-next";
import type { PlanStepState } from "../../domain/types";

defineProps<{
  open: boolean;
  summaryText: string;
  showRunningIcon: boolean;
  explanationText: string;
  steps: PlanStepState[];
}>();

defineEmits<{
  (event: "toggle"): void;
}>();

function planStepLabelText(status: PlanStepState["status"]) {
  if (status === "completed") return "已完成";
  if (status === "inProgress") return "进行中";
  return "待处理";
}

function planStepClass(status: PlanStepState["status"]) {
  if (status === "completed") return "text-[color:var(--text)]";
  if (status === "inProgress") return "text-[color:var(--text)]";
  return "text-[color:var(--text-muted)]";
}

function planStepStatusTextClass(status: PlanStepState["status"]) {
  if (status === "completed") return "text-[color:var(--fg-success)]";
  if (status === "inProgress") return "text-[color:var(--fg-accent)]";
  return "text-[color:var(--text-muted)]";
}
</script>
