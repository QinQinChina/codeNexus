<template>
  <div v-if="items.length > 0" class="grid gap-2">
    <div class="row" style="align-items: baseline; justify-content: space-between; gap: 10px">
      <div class="user-input-header">{{ titleText }}</div>
      <div class="mono dim text-[11px]">{{ t("guardianDiagnostics.itemCount", { count: items.length }) }}</div>
    </div>

    <DetailDisclosure
      v-for="item in items"
      :key="item.reviewId"
      class="rounded-[6px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2 py-1.5"
      summaryClass="flex min-w-0 items-start gap-2"
      :defaultOpen="item.matchesTarget"
      motion="fade"
    >
      <template #summary>
        <span
          class="inline-flex h-[22px] flex-none items-center rounded-[4px] border px-[9px] text-[11px] mono"
          :class="guardianStatusClass(item.tone)"
        >
          {{ item.statusText }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[12px] font-medium text-[color:var(--text)]">{{
            item.actionSummary || item.summaryText
          }}</span>
          <span class="block truncate mono text-[11px] text-[color:var(--text-muted)]">
            {{ guardianMetaText(item) }}
          </span>
        </span>
        <span
          v-if="item.matchesTarget"
          class="inline-flex h-[22px] flex-none items-center rounded-[4px] border border-[var(--border-accent)] bg-[var(--bg-accent-soft)] px-[8px] text-[10px] mono text-[var(--fg-accent)]"
        >
          {{ t("guardianDiagnostics.currentItem") }}
        </span>
      </template>

      <div
        class="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] break-words rounded-lg border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] p-2 text-[11px] leading-[1.45] text-[color:var(--text-muted)] mono"
      >
        {{ item.detailText }}
      </div>
    </DetailDisclosure>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import DetailDisclosure from "../ui/DetailDisclosure.vue";
import {
  collectGuardianApprovalReviewDiagnosticItems,
  type GuardianApprovalReviewDiagnosticItem,
} from "../../features/guardian/guardianApprovalReview";
import { formatTime } from "../../features/timeline/renderModel/formatters";
import { useTimelineStore } from "../../stores/timeline.store";

const props = withDefaults(
  defineProps<{
    threadId: string;
    focusTargetItemId?: string;
    maxItems?: number;
    title?: string;
  }>(),
  {
    focusTargetItemId: "",
    maxItems: 5,
    title: "",
  }
);

const timelineStore = useTimelineStore();
const { t } = useI18n();

const titleText = computed(() => String(props.title ?? "").trim() || t("guardianDiagnostics.defaultTitle"));
const normalizedThreadId = computed(() => String(props.threadId ?? "").trim() || "__app__");

const items = computed(() => {
  return collectGuardianApprovalReviewDiagnosticItems(timelineStore.eventsForThread(normalizedThreadId.value), {
    focusTargetItemId: props.focusTargetItemId,
    maxItems: props.maxItems,
  });
});

const guardianStatusClass = (tone: GuardianApprovalReviewDiagnosticItem["tone"]) => {
  if (tone === "running") {
    return "border-[var(--border-accent)] bg-[var(--bg-accent-soft)] text-[var(--fg-accent)]";
  }
  if (tone === "ok") {
    return "border-[var(--border-success)] bg-[var(--bg-success-soft)] text-[var(--fg-success)]";
  }
  if (tone === "warn") {
    return "border-[var(--border-warning)] bg-[var(--bg-warning-soft)] text-[var(--fg-warning)]";
  }
  if (tone === "error") {
    return "border-[var(--border-danger)] bg-[var(--bg-danger-soft)] text-[var(--fg-danger)]";
  }
  return "border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] text-[var(--text-muted)]";
};

const guardianMetaText = (item: GuardianApprovalReviewDiagnosticItem) => {
  const parts: string[] = [];
  parts.push(formatTime(item.createdAt));
  if (item.riskText) parts.push(t("guardianDiagnostics.risk", { value: item.riskText }));
  if (item.userAuthorizationText)
    parts.push(t("guardianDiagnostics.authorization", { value: item.userAuthorizationText }));
  if (item.decisionSourceText) parts.push(t("guardianDiagnostics.source", { value: item.decisionSourceText }));
  if (item.targetItemId) parts.push(`target ${item.targetItemId.slice(0, 12)}`);
  return parts.join(" ｜ ");
};
</script>
