<template>
  <div class="grid gap-2" :class="{ 'is-loading-shimmer': item.status === 'running' }">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span class="text-[13px] font-semibold text-[var(--text)]">
        {{ item.label }}
      </span>
      <span
        v-if="item.approvalRequired"
        class="inline-flex h-[22px] items-center rounded-[4px] border border-[var(--border-warning)] bg-[var(--bg-warning-soft)] px-[9px] text-[11px] mono text-[var(--fg-warning)]"
      >
        需审批
      </span>
    </div>

    <div v-if="item.argsSummary" class="mono dim whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px]">
      {{ item.argsSummary }}
    </div>
    <div
      v-if="item.resultSummary"
      class="mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--text)]"
    >
      {{ item.resultSummary }}
    </div>
    <div
      v-if="item.errorText"
      class="mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[11px] text-[var(--text)]"
    >
      {{ item.errorText }}
    </div>

    <div v-if="imageItems.length > 0" class="grid gap-2">
      <img
        v-for="(image, index) in imageItems"
        :key="`${item.callId}:image:${index}`"
        :src="image.imageUrl"
        class="max-h-[240px] rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] object-contain"
        alt="dynamic-tool-image"
      />
    </div>

    <DetailDisclosure
      v-if="item.argsRaw"
      :open="argsOpen"
      motion="fade"
      summaryClass="mono text-[11px] dim"
      @update:open="argsOpen = $event"
    >
      <template #summary>查看完整参数</template>
      <pre
        class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
        >{{ item.argsRaw }}</pre
      >
    </DetailDisclosure>

    <DetailDisclosure
      v-if="resultRawText"
      :open="resultOpen"
      motion="fade"
      summaryClass="mono text-[11px] dim"
      @update:open="resultOpen = $event"
    >
      <template #summary>查看完整结果</template>
      <pre
        class="mono mt-1.5 max-h-[240px] overflow-y-auto app-scrollbar rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2 text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words"
        >{{ resultRawText }}</pre
      >
    </DetailDisclosure>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import DetailDisclosure from "../../ui/DetailDisclosure.vue";
import type { DynamicToolTimelineItem } from "../../../domain/dynamicTools";

const props = defineProps<{
  item: DynamicToolTimelineItem;
}>();

const argsOpen = ref(false);
const resultOpen = ref(false);

const imageItems = computed(() => props.item.contentItems.filter((item) => item.type === "inputImage"));
const textItems = computed(() =>
  props.item.contentItems.filter((item) => item.type === "inputText").map((item) => item.text)
);
const resultRawText = computed(() => {
  const imageLines = imageItems.value.map((item, index) => `image[${index + 1}]: ${item.imageUrl}`);
  return [...textItems.value, ...imageLines].filter(Boolean).join("\n\n");
});
// 工具事件两态化：不展示状态徽标，不做成功/失败配色。
</script>
