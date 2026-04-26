<template>
  <Transition name="app-closing-overlay">
    <div
      v-if="appClosingStore.visible"
      class="app-closing-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="应用正在关闭"
    >
      <div class="app-closing-overlay-backdrop"></div>
      <section class="app-closing-panel">
        <div class="app-closing-head">
          <div class="app-closing-orb" aria-hidden="true">
            <span class="running-indicator is-accent"></span>
          </div>
          <div class="app-closing-copy">
            <p class="app-closing-kicker mono">正在关闭应用</p>
            <h2 class="app-closing-title">{{ phaseTitle }}</h2>
            <p class="app-closing-subtitle">{{ phaseSubtitle }}</p>
          </div>
        </div>

        <div class="app-closing-step-list" role="list" aria-label="关闭步骤">
          <div
            v-for="step in appClosingStore.steps"
            :key="`${step.id}:${step.status}`"
            class="app-closing-step-item"
            :class="{ 'is-completed': step.status === 'completed' }"
            :aria-label="buildStepAriaLabel(step.label, step.status)"
          >
            <span class="app-closing-refresh-badge" aria-hidden="true">
              <CheckCircle2
                v-if="step.status === 'completed'"
                class="app-closing-complete-icon h-4 w-4 [stroke-width:2.2]"
              />
              <span v-else class="running-indicator is-accent"></span>
            </span>
            <span class="app-closing-step-text">{{ step.label }}</span>
          </div>
        </div>

        <section v-if="showTaskCard" class="app-closing-task-card" aria-label="当前任务摘要">
          <div class="app-closing-task-head">
            <span class="running-indicator is-muted" aria-hidden="true"></span>
            <div class="min-w-0">
              <p class="app-closing-task-kicker mono">当前任务</p>
              <p class="app-closing-task-title">{{ taskTitle }}</p>
            </div>
          </div>
          <p v-if="taskDescription" class="app-closing-task-description">{{ taskDescription }}</p>
          <div v-if="taskPlanSteps.length > 0" class="app-closing-task-steps" role="list">
            <div
              v-for="step in taskPlanSteps"
              :key="`${step.step}:${step.status}`"
              class="app-closing-task-step"
              :class="{ 'is-completed': step.status === 'completed' }"
              :aria-label="buildStepAriaLabel(step.step, step.status)"
            >
              <span class="app-closing-refresh-badge" aria-hidden="true">
                <CheckCircle2
                  v-if="step.status === 'completed'"
                  class="app-closing-complete-icon h-4 w-4 [stroke-width:2.2]"
                />
                <span v-else class="running-indicator is-accent"></span>
              </span>
              <span class="app-closing-task-step-text">{{ step.step }}</span>
            </div>
          </div>
        </section>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle2 } from "lucide-vue-next";
import type { AppClosingStep } from "../../../shared/ipc";
import type { PlanStepState, TimelineEventItem, TurnPlanState } from "../../domain/types";
import { isLocalThinkingEvent } from "../../features/timeline/renderModel/formatters";
import { useAppClosingStore } from "../../stores/appClosing.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useThreadStore } from "../../stores/thread.store";
import { useTimelineStore } from "../../stores/timeline.store";

const appClosingStore = useAppClosingStore();
const runtimeStore = useRuntimeStore();
const threadStore = useThreadStore();
const timelineStore = useTimelineStore();

const THINKING_PHASE_LABELS: Record<NonNullable<TimelineEventItem["thinkingPhase"]>, string> = {
  queued: "已排队",
  preparing: "准备中",
  reasoning: "思考中",
  streaming: "生成中",
  waiting_more: "等待继续",
  completed: "已完成",
  failed: "已失败",
};

function compactText(value: unknown, maxLength = 140) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function buildStepAriaLabel(label: string, status: AppClosingStep["status"] | PlanStepState["status"]) {
  return `${label}，${status === "completed" ? "已完成" : "正在处理中"}`;
}

const activeThreadId = computed(() => {
  return String(runtimeStore.currentThreadId || threadStore.currentThreadId || "").trim();
});

const activePlan = computed<TurnPlanState | null>(() => {
  const threadId = activeThreadId.value;
  if (!threadId) return null;
  const currentPlan = threadStore.currentTurnPlan;
  if (currentPlan && currentPlan.threadId === threadId) return currentPlan;
  return threadStore.latestTurnPlanByThread.get(threadId) ?? null;
});

const activeThinkingEvent = computed<TimelineEventItem | null>(() => {
  const threadId = activeThreadId.value;
  if (!threadId) return null;
  const events = timelineStore.eventsForThread(threadId);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!isLocalThinkingEvent(event)) continue;
    if (event.thinkingPhase === "completed" || event.thinkingPhase === "failed") continue;
    return event;
  }
  return null;
});

const phaseTitle = computed(() => {
  if (appClosingStore.phase === "stopping") return "正在停止后台任务";
  if (appClosingStore.phase === "finalizing") return "正在退出应用";
  return "正在安全关闭应用";
});

const phaseSubtitle = computed(() => {
  if (appClosingStore.phase === "starting") return "正在切换到关闭过场，避免界面停留在旧状态。";
  if (appClosingStore.phase === "preparing") return "正在整理当前界面状态并保存临时输入。";
  if (appClosingStore.phase === "stopping") return "正在结束后台步骤、连接和运行中的服务。";
  if (appClosingStore.phase === "finalizing") return "所有收尾步骤已完成，应用即将退出。";
  return "正在准备关闭。";
});

const taskPlanSteps = computed<PlanStepState[]>(() => activePlan.value?.plan ?? []);

const taskTitle = computed(() => {
  const plan = activePlan.value;
  if (plan) {
    return (
      plan.plan.find((step) => step.status === "inProgress")?.step ||
      compactText(plan.explanation) ||
      plan.plan[0]?.step ||
      "正在处理当前任务"
    );
  }

  const event = activeThinkingEvent.value;
  if (!event) return "";
  if (event.thinkingPhase) return THINKING_PHASE_LABELS[event.thinkingPhase] ?? "思考中";
  return "思考中";
});

const taskDescription = computed(() => {
  const plan = activePlan.value;
  if (plan) {
    const text = compactText(plan.explanation);
    return text && text !== taskTitle.value ? text : "";
  }

  const event = activeThinkingEvent.value;
  if (!event) return "";
  const text = compactText(event.paramsText);
  return text && text !== taskTitle.value ? text : "";
});

const showTaskCard = computed(() => {
  return Boolean(taskTitle.value || taskDescription.value || taskPlanSteps.value.length > 0);
});
</script>
