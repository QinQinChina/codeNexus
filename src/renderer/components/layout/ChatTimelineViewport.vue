<template>
  <div class="chat-timeline-viewport">
    <div v-for="row in rows" :key="row.id" class="chat-timeline-row" :data-row-id="row.id" :data-row-kind="row.kind">
      <slot :row="row" />
    </div>
  </div>
</template>

<script setup lang="ts">
type TimelineViewportRow = {
  id: string;
  kind?: string;
};

defineProps<{
  rows: TimelineViewportRow[];
}>();
</script>

<style scoped>
.chat-timeline-viewport {
  min-width: 0;
  width: 100%;
}

.chat-timeline-row {
  min-width: 0;
}
</style>
