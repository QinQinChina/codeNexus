<template>
  <div v-if="visible" ref="rootRef" class="topbar-plan-summary" :class="{ 'is-open': open }">
    <button
      id="btn-topbar-plan-summary"
      class="topbar-plan-trigger"
      type="button"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="topbar-plan-menu"
      v-tooltip="'查看当前线程计划'"
      @click="toggleOpen"
    >
      <span class="topbar-plan-label">计划</span>
      <span class="topbar-plan-progress mono">{{ progressText }}</span>
      <span class="topbar-plan-current">
        <span
          v-if="currentRunningStep"
          class="running-indicator is-accent topbar-plan-spinner"
          aria-hidden="true"
        ></span>
        <Transition name="topbar-plan-step-slide" mode="out-in">
          <span :key="currentStepKey" class="topbar-plan-current-text">{{ currentStepText }}</span>
        </Transition>
      </span>
      <ChevronDown class="topbar-plan-caret" :class="{ 'is-open': open }" aria-hidden="true" />
    </button>

    <Transition name="topbar-fly">
      <div v-if="open" id="topbar-plan-menu" class="topbar-menu-shell topbar-menu-shell--plan" @click.stop>
        <div class="topbar-dropdown topbar-menu topbar-plan-menu app-scrollbar" role="dialog" aria-label="当前线程计划">
          <div class="topbar-plan-menu-head">
            <span class="topbar-menu-heading">当前线程计划</span>
            <span class="topbar-plan-menu-progress mono">{{ completedCount }}/{{ steps.length }} 已完成</span>
          </div>
          <div v-if="explanationText" class="topbar-plan-explanation">{{ explanationText }}</div>
          <ol class="topbar-plan-list">
            <li
              v-for="step in steps"
              :key="`${step.status}:${step.step}`"
              class="topbar-plan-step"
              :class="`is-${step.status}`"
            >
              <span class="topbar-plan-step-status" :class="planStepStatusTextClass(step.status)">
                <CircleDashed v-if="step.status === 'pending'" class="topbar-plan-step-icon" aria-hidden="true" />
                <span
                  v-else-if="step.status === 'inProgress'"
                  class="running-indicator is-accent topbar-plan-step-spinner"
                  aria-hidden="true"
                ></span>
                <CheckCircle2 v-else class="topbar-plan-step-icon" aria-hidden="true" />
                <span class="mono">{{ planStepLabelText(step.status) }}</span>
              </span>
              <span class="topbar-plan-step-text">{{ step.step }}</span>
            </li>
          </ol>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2, ChevronDown, CircleDashed } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { PlanStepState } from "../../../domain/types";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useThreadStore } from "../../../stores/thread.store";

const appShellStore = useAppShellStore();
const threadStore = useThreadStore();

const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);

const plan = computed(() => threadStore.currentTurnPlan);
const steps = computed<PlanStepState[]>(() => plan.value?.plan ?? []);
const explanationText = computed(() => String(plan.value?.explanation ?? "").trim());
const hasPlan = computed(() => Boolean(explanationText.value) || steps.value.length > 0);
const visible = computed(() => appShellStore.mainView === "chat" && !appShellStore.settingsOpen && hasPlan.value);
const completedCount = computed(() => steps.value.filter((step) => step.status === "completed").length);
const currentRunningStep = computed(() => steps.value.find((step) => step.status === "inProgress") ?? null);
const progressText = computed(() => (steps.value.length > 0 ? `${completedCount.value}/${steps.value.length}` : "0/0"));
const currentStepText = computed(() => {
  const running = currentRunningStep.value;
  if (running) return running.step;
  if (steps.value.length > 0) return "计划已完成";
  return "暂无步骤";
});
const currentStepKey = computed(() => {
  const running = currentRunningStep.value;
  if (running) return `running:${running.step}`;
  return `progress:${completedCount.value}:${steps.value.length}`;
});

function toggleOpen() {
  open.value = !open.value;
}

function closeOpen() {
  open.value = false;
}

function onWindowPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const root = rootRef.value;
  if (root && event.target instanceof Node && root.contains(event.target)) return;
  closeOpen();
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeOpen();
}

function planStepLabelText(status: PlanStepState["status"]) {
  if (status === "completed") return "已完成";
  if (status === "inProgress") return "进行中";
  return "待处理";
}

function planStepStatusTextClass(status: PlanStepState["status"]) {
  if (status === "completed") return "is-completed";
  if (status === "inProgress") return "is-in-progress";
  return "is-pending";
}

watch(visible, (next) => {
  if (!next) closeOpen();
});

watch(
  () => plan.value?.turnId,
  () => closeOpen()
);

window.addEventListener("pointerdown", onWindowPointerDown, true);
window.addEventListener("keydown", onWindowKeydown);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onWindowPointerDown, true);
  window.removeEventListener("keydown", onWindowKeydown);
});
</script>
