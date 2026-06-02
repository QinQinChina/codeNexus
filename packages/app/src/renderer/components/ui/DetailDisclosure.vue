<template>
  <Collapsible
    class="detail-disclosure"
    :open="open"
    :defaultOpen="defaultOpen"
    :disabled="disabled"
    :motion="motion"
    :keepMounted="keepMounted"
    @update:open="onUpdateOpen"
  >
    <template #trigger="{ triggerProps, open: isOpen }">
      <div class="min-w-0 cursor-pointer select-none" :class="summaryClass" v-bind="triggerProps">
        <slot name="summary" :open="isOpen" />
      </div>
    </template>
    <slot />
  </Collapsible>
</template>

<script setup lang="ts">
// 详情披露组件：封装“摘要 + 可展开详情”的通用模式，内部基于 Collapsible 组件。
import Collapsible from "./Collapsible.vue";

type ClassValue = string | Record<string, boolean> | Array<string | Record<string, boolean>>;

withDefaults(
  defineProps<{
    open?: boolean;
    defaultOpen?: boolean;
    disabled?: boolean;
    motion?: "height" | "fade";
    keepMounted?: boolean;
    summaryClass?: ClassValue;
  }>(),
  {
    defaultOpen: false,
    disabled: false,
    motion: "fade",
    keepMounted: false,
    summaryClass: "",
  }
);

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();

// 透传并标准化布尔值，避免父组件收到非布尔开关值。
const onUpdateOpen = (next: boolean) => {
  emit("update:open", Boolean(next));
};
</script>
