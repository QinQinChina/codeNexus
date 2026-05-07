<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <div
      class="w-full rounded-xl border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-3"
      :class="{ 'is-loading-shimmer': item.status === 'running' }"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="text-[13px] font-semibold text-[var(--text)]">
          {{ item.title }}
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
        class="mt-2 mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--text)]"
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
import type { ChatImageToolItem } from "../layout/chat.types";
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

// 工具事件两态化：不展示状态徽标，不做成功/失败配色。
</script>
