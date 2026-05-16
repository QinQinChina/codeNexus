<template>
  <div class="chat-timeline-viewport">
    <div
      v-for="item in renderedRows"
      :key="item.row.id"
      class="chat-timeline-row"
      :class="item.presentation.className"
      :data-row-id="item.row.id"
      :data-row-kind="item.row.kind"
      :data-row-group="item.presentation.group"
      :data-row-role="item.presentation.role"
      :data-row-density="item.presentation.density"
      :data-row-status="item.presentation.status"
      :data-row-expandable="item.presentation.expandable ? 'true' : 'false'"
      :data-row-estimated-height="item.presentation.estimatedHeightPx"
      :data-row-index="item.index"
    >
      <slot :row="item.row" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import type { ChatRenderedRow } from "../types/chat.types";
import { getChatRowPresentation } from "./chatPresentation";

const props = defineProps<{
  rows: ChatRenderedRow[];
  onLayoutChange?: () => void;
}>();

defineSlots<{
  default(props: { row: ChatRenderedRow }): unknown;
}>();

let pendingLayoutNotifyRafId: number | null = null;

const renderedRows = computed(() =>
  props.rows.map((row, index) => ({
    row,
    index,
    presentation: getChatRowPresentation(row),
  }))
);

const rowStructureSignature = computed(() =>
  renderedRows.value
    .map(
      (item) =>
        `${String(item.row.id ?? "")}:${String(item.row.kind ?? "")}:${item.presentation.group}:${item.presentation.estimatedHeightPx}`
    )
    .join("\n")
);

function scheduleLayoutChangeNotify() {
  if (!props.onLayoutChange) return;
  if (pendingLayoutNotifyRafId != null) return;
  pendingLayoutNotifyRafId = requestAnimationFrame(() => {
    pendingLayoutNotifyRafId = null;
    props.onLayoutChange?.();
  });
}

watch(rowStructureSignature, () => scheduleLayoutChangeNotify(), { flush: "post" });

onMounted(() => {
  scheduleLayoutChangeNotify();
});

onBeforeUnmount(() => {
  if (pendingLayoutNotifyRafId != null) cancelAnimationFrame(pendingLayoutNotifyRafId);
  pendingLayoutNotifyRafId = null;
});
</script>
