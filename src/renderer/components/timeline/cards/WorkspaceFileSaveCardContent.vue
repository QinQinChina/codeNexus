<template>
  <div class="grid gap-2">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span class="text-[13px] font-semibold text-[var(--text)]">
        {{ titleText }}
      </span>
      <span
        class="inline-flex h-[22px] items-center rounded-[4px] border px-[9px] text-[11px] mono"
        :class="sourceBadgeClass"
      >
        {{ sourceText }}
      </span>
    </div>

    <div class="mono dim whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px]">
      {{ item.path }}
    </div>

    <div class="mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--text)]">
      {{ metaText }}
    </div>

    <div
      v-if="item.errorText"
      class="mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--text)]"
    >
      {{ item.errorText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { WorkspaceFileSaveTimelineItem } from "../../../domain/workspaceFiles";

const props = defineProps<{
  item: WorkspaceFileSaveTimelineItem;
}>();

const { t, n } = useI18n();

const titleText = computed(() => t("workspaceFileSave.title"));
// Tool events use a source badge instead of success/failure badges.
const sourceText = computed(() => t("workspaceFileSave.localFile"));
const metaText = computed(() => t("workspaceFileSave.charCount", { count: n(props.item.chars) }));

const sourceBadgeClass = computed(() => {
  return "border-[var(--border-warning)] bg-[var(--bg-warning-soft)] text-[var(--fg-warning)]";
});
</script>
