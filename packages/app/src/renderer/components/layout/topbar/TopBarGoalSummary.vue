<template>
  <div v-if="visible" ref="rootRef" class="topbar-goal-summary" :class="{ 'is-open': open }">
    <button
      id="btn-topbar-goal-summary"
      class="topbar-goal-trigger"
      type="button"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="topbar-goal-menu"
      @click="toggleOpen"
    >
      <Target class="topbar-goal-icon" aria-hidden="true" />
      <span class="topbar-goal-label">{{ t("topbarGoal.goal") }}</span>
      <span class="topbar-goal-progress mono">{{ progressText }}</span>
      <span class="topbar-goal-current">
        <span class="topbar-goal-current-text">{{ goal?.objective }}</span>
      </span>
      <ChevronDown class="topbar-goal-caret" :class="{ 'is-open': open }" aria-hidden="true" />
    </button>

    <Transition name="topbar-fly">
      <div v-if="open" id="topbar-goal-menu" class="topbar-menu-shell topbar-menu-shell--goal" @click.stop>
        <div class="topbar-dropdown topbar-menu topbar-goal-menu app-scrollbar" role="dialog" :aria-label="menuLabel">
          <div class="topbar-goal-menu-head">
            <span class="topbar-menu-heading">{{ menuLabel }}</span>
            <span class="topbar-goal-status mono" :class="statusClass">{{ statusLabel }}</span>
          </div>

          <div class="topbar-goal-objective">{{ goal?.objective }}</div>

          <div class="topbar-goal-metrics">
            <div class="topbar-goal-metric">
              <span class="topbar-goal-metric-label mono">{{ t("topbarGoal.tokens") }}</span>
              <span class="topbar-goal-metric-value mono">{{ tokensText }}</span>
            </div>
            <div class="topbar-goal-metric">
              <span class="topbar-goal-metric-label mono">{{ t("topbarGoal.elapsed") }}</span>
              <span class="topbar-goal-metric-value mono">{{ elapsedText }}</span>
            </div>
          </div>

          <div class="topbar-menu-section topbar-goal-actions">
            <button class="btn-mini !justify-start" type="button" @click="onEditGoal">
              <Pencil aria-hidden="true" />
              {{ t("topbarGoal.setGoal") }}
            </button>
            <button
              class="btn-mini !justify-start"
              type="button"
              :disabled="goal?.status === 'complete'"
              @click="onCompleteGoal"
            >
              <CheckCircle2 aria-hidden="true" />
              {{ t("topbarGoal.completeGoal") }}
            </button>
            <button class="btn-mini !justify-start danger" type="button" @click="onClearGoal">
              <Trash2 aria-hidden="true" />
              {{ t("topbarGoal.clearGoal") }}
            </button>
            <button class="btn-mini !justify-start" type="button" @click="onRefreshGoal">
              <RefreshCw aria-hidden="true" />
              {{ t("topbarGoal.refreshGoal") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2, ChevronDown, Pencil, RefreshCw, Target, Trash2 } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getRuntimeOrchestrator } from "../../../domain/runtimeOrchestrator";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useThreadStore } from "../../../stores/thread.store";

const appShellStore = useAppShellStore();
const threadStore = useThreadStore();
const runtime = getRuntimeOrchestrator();
const { t } = useI18n();

const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);

const goal = computed(() => threadStore.currentGoal);
const visible = computed(() => appShellStore.mainView === "chat" && !appShellStore.settingsOpen && Boolean(goal.value));
const menuLabel = computed(() => t("topbarGoal.currentGoal"));
const statusLabel = computed(() => t(`topbarGoal.status.${goal.value?.status ?? "active"}`));
const statusClass = computed(() => `is-${goal.value?.status ?? "active"}`);
const numberFormat = new Intl.NumberFormat();

const tokensText = computed(() => {
  const current = Math.max(0, Math.round(Number(goal.value?.tokensUsed ?? 0)));
  const budget = goal.value?.tokenBudget;
  if (budget == null || budget <= 0) return numberFormat.format(current);
  return `${numberFormat.format(current)}/${numberFormat.format(Math.round(budget))}`;
});

const progressText = computed(() => {
  if (!goal.value) return "";
  return goal.value.tokenBudget ? tokensText.value : statusLabel.value;
});

const elapsedText = computed(() => {
  const seconds = Math.max(0, Math.round(Number(goal.value?.timeUsedSeconds ?? 0)));
  if (seconds < 60) return t("topbarGoal.elapsedSeconds", { count: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("topbarGoal.elapsedMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  return t("topbarGoal.elapsedHours", { count: hours });
});

function toggleOpen() {
  open.value = !open.value;
}

function closeOpen() {
  open.value = false;
}

async function onEditGoal() {
  closeOpen();
  await runtime.promptAndSetCurrentThreadGoal();
}

async function onCompleteGoal() {
  closeOpen();
  await runtime.completeCurrentThreadGoal();
}

async function onClearGoal() {
  closeOpen();
  await runtime.clearCurrentThreadGoal();
}

async function onRefreshGoal() {
  await runtime.refreshThreadGoal();
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

watch(visible, (next) => {
  if (!next) closeOpen();
});

watch(
  () => goal.value?.threadId,
  () => closeOpen()
);

window.addEventListener("pointerdown", onWindowPointerDown, true);
window.addEventListener("keydown", onWindowKeydown);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onWindowPointerDown, true);
  window.removeEventListener("keydown", onWindowKeydown);
});
</script>
