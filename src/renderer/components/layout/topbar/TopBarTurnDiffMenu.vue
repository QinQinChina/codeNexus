<template>
  <div class="topbar-single-switch" :class="{ 'is-open': props.open }">
    <span class="topbar-single-switch-thumb" aria-hidden="true"></span>
    <button
      id="btn-topbar-turn-diff"
      class="topbar-single-switch-option"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="props.open ? 'true' : 'false'"
      aria-label="本回合差异"
      @click.stop="emit('toggle')"
    >
      <GitCompare aria-hidden="true" />
      <span class="topbar-right-switch-label">差异</span>
    </button>
  </div>

  <Transition name="topbar-fly">
    <div v-if="props.open" class="topbar-menu-shell topbar-menu-shell--turn-diff" @click.stop>
      <div class="topbar-dropdown topbar-menu app-scrollbar" role="menu" aria-label="本回合差异">
        <div class="topbar-menu-section">
          <div class="topbar-menu-heading">本回合差异</div>
          <div v-if="!currentTurnDiffText" class="topbar-menu-note">当前没有可展示的差异。</div>
          <div v-else>
            <TurnDiffSummaryCard :diffText="currentTurnDiffText" />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GitCompare } from "lucide-vue-next";
import TurnDiffSummaryCard from "../../timeline/cards/TurnDiffSummaryCard.vue";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { useThreadStore } from "../../../stores/thread.store";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "close"): void;
}>();

const runtimeStore = useRuntimeStore();
const threadStore = useThreadStore();

const currentTurnDiff = computed(() => {
  const threadId = String(threadStore.currentThreadId || runtimeStore.timelineKey || "").trim();
  if (!threadId) return { turnId: "", diffText: "" };

  const diffMap = threadStore.turnDiffByThread.get(threadId) ?? null;
  if (!diffMap || diffMap.size === 0) return { turnId: "", diffText: "" };

  const planTurnId = String(threadStore.currentTurnPlan?.turnId ?? "").trim();
  const activeTurnId = String(threadStore.activeTurnIdByThread.get(threadId) ?? "").trim();

  const pickForTurn = (turnId: string) => {
    if (!turnId) return null;
    const diffText = diffMap.get(turnId) ?? "";
    if (!String(diffText ?? "").trim()) return null;
    return { turnId, diffText };
  };

  const direct = pickForTurn(planTurnId) ?? pickForTurn(activeTurnId);
  if (direct) return direct;

  const completed = threadStore.completedTurnsByThread.get(threadId) ?? [];
  for (let i = completed.length - 1; i >= 0; i -= 1) {
    const diffText = String(completed[i]?.diffText ?? "");
    if (!diffText.trim()) continue;
    const turnId = String(completed[i]?.turnId ?? "").trim();
    if (!turnId) continue;
    return { turnId, diffText };
  }

  let lastTurnId = "";
  let lastDiffText = "";
  for (const [turnId, diffText] of diffMap.entries()) {
    if (!String(diffText ?? "").trim()) continue;
    lastTurnId = String(turnId ?? "").trim();
    lastDiffText = String(diffText ?? "");
  }
  return { turnId: lastTurnId, diffText: lastDiffText };
});

const currentTurnDiffText = computed(() => String(currentTurnDiff.value?.diffText ?? ""));
</script>
