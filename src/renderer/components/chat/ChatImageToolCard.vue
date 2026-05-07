<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <div class="w-full rounded-xl border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="text-[13px] font-semibold text-[var(--text)]">
          {{ item.title }}
        </span>
        <span
          class="inline-flex h-[22px] items-center rounded-[4px] border px-[9px] text-[11px] mono"
          :class="imageToolStatusBadgeClass(item.status)"
        >
          {{ imageToolStatusText(item.status) }}
        </span>
        <span v-if="showTimestamps" class="ml-auto mono dim text-[11px] whitespace-nowrap">{{ formattedTime }}</span>
      </div>

      <div
        v-if="item.detailText"
        class="mt-2 mono dim whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px]"
      >
        {{ item.detailText }}
      </div>
      <div
        v-if="item.errorText"
        class="mt-2 mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--fg-danger)]"
      >
        {{ item.errorText }}
      </div>
      <div
        v-if="item.revisedPrompt"
        class="mt-2 mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--ui-code-text)]"
      >
        {{ item.revisedPrompt }}
      </div>

      <div v-if="visibleImages.length > 0" class="mt-2 flex flex-wrap gap-2">
        <LazyImageThumb
          v-for="image in visibleImages"
          :key="image.id"
          :imageId="image.id"
          class="h-[120px] w-[120px] max-w-full"
          :source="image.source"
          :sourceKind="image.sourceKind"
          :title="image.title"
          :workspaceRoot="workspaceRoot"
          :rootMarginPx="260"
          @load-error="$emit('load-error', $event)"
          @preview="$emit('preview', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatImageToolItem, ImageToolStatus } from "../layout/chat.types";
import LazyImageThumb from "../ui/LazyImageThumb.vue";

defineProps<{
  item: ChatImageToolItem;
  visibleImages: any[];
  showTimestamps: boolean;
  formattedTime: string;
  workspaceRoot: string;
}>();

defineEmits<{
  (e: "load-error", payload: any): void;
  (e: "preview", payload: any): void;
}>();

const imageToolStatusText = (status: ImageToolStatus): string => {
  if (status === "running") return "运行中";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return "未知";
};

const imageToolStatusBadgeClass = (status: ImageToolStatus): string => {
  if (status === "completed") {
    return "border-[var(--border-success)] bg-[var(--bg-success-soft)] text-[var(--fg-success)]";
  }
  if (status === "failed") {
    return "border-[var(--border-danger)] bg-[var(--bg-danger-soft)] text-[var(--fg-danger)]";
  }
  if (status === "running") {
    return "border-[var(--border-accent)] bg-[var(--bg-accent-soft)] text-[var(--fg-accent)]";
  }
  return "border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] text-[var(--text-muted)]";
};
</script>
