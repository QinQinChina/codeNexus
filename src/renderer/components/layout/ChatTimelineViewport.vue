<template>
  <div class="chat-timeline-viewport">
    <div
      v-for="(row, index) in rows"
      :key="row.id"
      class="chat-timeline-row"
      :data-row-id="row.id"
      :data-row-kind="row.kind"
      :data-row-group="rowGroup(row.kind)"
      :data-row-index="index"
    >
      <slot :row="row" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";

type TimelineViewportRow = {
  id: string;
  kind?: string;
};

type TimelineRowGroup = "activity" | "body" | "command";

const props = defineProps<{
  rows: TimelineViewportRow[];
  onLayoutChange?: () => void;
}>();

defineSlots<{
  default(props: { row: TimelineViewportRow }): unknown;
}>();

let pendingLayoutNotifyRafId: number | null = null;

const rowStructureSignature = computed(() =>
  props.rows.map((row) => `${String(row.id ?? "")}:${String(row.kind ?? "")}`).join("\n")
);

function rowGroup(kind?: string): TimelineRowGroup {
  switch (kind) {
    case "activity":
      return "activity";
    case "commandAction":
    case "commandList":
    case "commandRead":
    case "commandSearch":
      return "command";
    default:
      return "body";
  }
}

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

<style scoped>
.chat-timeline-viewport {
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.chat-timeline-row {
  min-width: 0;
}

.chat-timeline-row + .chat-timeline-row {
  margin-top: var(--chat-row-gap-mixed, 8px);
}

.chat-timeline-row[data-row-group="body"] + .chat-timeline-row[data-row-group="body"] {
  margin-top: var(--chat-row-gap-body, var(--chat-row-gap-mixed, 8px));
}

.chat-timeline-row[data-row-group="command"] + .chat-timeline-row[data-row-group="command"] {
  margin-top: var(--chat-row-gap-command, var(--chat-row-gap-mixed, 4px));
}

.chat-timeline-row[data-row-group="activity"] + .chat-timeline-row[data-row-group="activity"] {
  margin-top: var(--chat-row-gap-activity, var(--chat-row-gap-mixed, 4px));
}
</style>
