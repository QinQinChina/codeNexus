<template>
  <aside class="sidebar sidebar-right debug-timeline-sidebar">
    <header class="debug-timeline-sidebar-head">
      <div class="debug-timeline-sidebar-title">
        <span class="mono">调试 JSON</span>
        <span class="mono dim">事件时间线</span>
      </div>
      <div class="debug-timeline-sidebar-actions">
        <span class="mono dim text-[10px]">Ctrl/⌘ + Alt + J</span>
        <button class="btn-mini" type="button" @click="close">关闭</button>
      </div>
    </header>
    <div class="debug-timeline-sidebar-body app-scrollbar" role="region" aria-label="调试 JSON 事件列表">
      <TimelinePane :contentEvents="debugOverlayEvents" :workspaceRoot="workspaceRoot" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import TimelinePane from "./TimelinePane.vue";
import type { TimelineEventItem } from "../../domain/types";
import { useDebugTimelineStore } from "../../stores/debugTimeline.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useTimelineStore } from "../../stores/timeline.store";

const runtimeStore = useRuntimeStore();
const timelineStore = useTimelineStore();
const debugTimelineStore = useDebugTimelineStore();

const timelineKey = computed(() => String(runtimeStore.timelineKey ?? "__app__"));
const workspaceRoot = computed(() => String(runtimeStore.workspacePath ?? "").trim());
const contentTimelineEvents = computed<TimelineEventItem[]>(() => timelineStore.eventsForThread(timelineKey.value));
const debugTimelineEvents = computed<TimelineEventItem[]>(() => debugTimelineStore.eventsForThread(timelineKey.value));
const debugOverlayEvents = computed<TimelineEventItem[]>(() => {
  const combined = [...contentTimelineEvents.value, ...debugTimelineEvents.value];
  combined.sort((a, b) => {
    const ta = Number.isFinite(a.createdAt) ? a.createdAt : 0;
    const tb = Number.isFinite(b.createdAt) ? b.createdAt : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
  return combined;
});

function close() {
  runtimeStore.setTimelineDebugEnabled(false);
}

onMounted(() => {
  debugTimelineStore.loadThread(timelineKey.value);
});

watch(
  timelineKey,
  (threadId) => {
    debugTimelineStore.loadThread(threadId);
  },
  { flush: "post" }
);
</script>

<style scoped>
.debug-timeline-sidebar {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-1) 90%, transparent),
      color-mix(in srgb, var(--bg) 94%, transparent)
    ),
    var(--surface-1);
}

.debug-timeline-sidebar-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.debug-timeline-sidebar-title,
.debug-timeline-sidebar-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.debug-timeline-sidebar-title {
  flex: 1 1 auto;
  overflow: hidden;
}

.debug-timeline-sidebar-actions {
  flex: 0 0 auto;
}

.debug-timeline-sidebar-body {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}
</style>
