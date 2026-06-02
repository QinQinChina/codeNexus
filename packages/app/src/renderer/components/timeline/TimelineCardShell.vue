<template>
  <Collapsible
    class="event timeline-card-shell group mb-2.5 min-w-0 max-w-full rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-timeline-card-bg)] p-[var(--timeline-card-padding,10px)] shadow-[var(--ui-timeline-card-shadow)] last:mb-0"
    :class="[cardClass, statusKindClass]"
    :open="open"
    :defaultOpen="defaultOpen"
    :disabled="disabled"
    :motion="motion"
    :keepMounted="keepMounted"
    @update:open="onUpdateOpen"
  >
    <template #trigger="{ triggerProps, open: isOpen }">
      <div
        class="timeline-card-shell-summary min-w-0 cursor-pointer select-none"
        :class="summaryClass"
        v-bind="triggerProps"
      >
        <div class="timeline-card-shell-title-wrap min-w-0 inline-flex items-center gap-1.5" :class="titleWrapClass">
          <slot name="icon" :open="isOpen" />
          <span
            class="inline-flex items-center max-w-full overflow-hidden text-ellipsis whitespace-nowrap h-[22px] px-[9px] rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg-strong)] text-[var(--text-muted)] text-[11px] tracking-[0.2px]"
            :class="tagClass"
          >
            <slot name="tag">{{ tagText }}</slot>
          </span>
          <span
            v-if="timeText"
            class="mono dim text-[11px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >{{ timeText }}</span
          >
          <span v-if="statusText" class="mono dim timeline-card-shell-status" :class="statusClass">{{
            statusText
          }}</span>
          <slot name="titleMeta" :open="isOpen" />
        </div>
        <div v-if="$slots.summary" class="timeline-card-shell-summaryline min-w-0" :class="summaryLineClass">
          <slot name="summary" :open="isOpen" />
        </div>
      </div>
    </template>
    <slot />
  </Collapsible>
</template>

<script setup lang="ts">
// 时间线卡片壳：统一卡片标题/标签/状态与折叠区域的通用展示。
import { computed } from "vue";
import Collapsible from "../ui/Collapsible.vue";

type ClassValue = string | Record<string, boolean> | Array<string | Record<string, boolean>>;

const props = withDefaults(
  defineProps<{
    tagText?: string;
    timeText?: string;
    statusText?: string;
    statusKind?: "running" | "completed" | "failed" | "unknown" | "";
    cardClass?: ClassValue;
    summaryClass?: ClassValue;
    titleWrapClass?: ClassValue;
    summaryLineClass?: ClassValue;
    tagClass?: ClassValue;
    statusClass?: ClassValue;
    open?: boolean;
    defaultOpen?: boolean;
    disabled?: boolean;
    motion?: "height" | "fade";
    keepMounted?: boolean;
  }>(),
  {
    tagText: "",
    timeText: "",
    statusText: "",
    statusKind: "",
    cardClass: "",
    summaryClass: "",
    titleWrapClass: "",
    summaryLineClass: "",
    tagClass: "",
    statusClass: "",
    defaultOpen: false,
    disabled: false,
    motion: "fade",
    keepMounted: false,
  }
);

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();

// 根据状态生成统一 class，交给样式层做色彩区分。
const statusKindClass = computed(() => {
  if (!props.statusKind) return "";
  return `timeline-card-shell-status-${props.statusKind}`;
});

// 透传折叠状态变更并规范为布尔值。
const onUpdateOpen = (next: boolean) => {
  emit("update:open", Boolean(next));
};
</script>
