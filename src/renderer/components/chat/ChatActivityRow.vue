<template>
  <div class="chat-row chat-row--activity flex min-w-0 m-0">
    <div class="chat-activity-line inline-flex w-full max-w-full items-center gap-2.5 px-2.5 py-0.5 text-xs dim">
      <span
        class="chat-activity-dot h-1.5 w-1.5 flex-none rounded-full bg-[var(--ui-activity-dot-bg)] shadow-[var(--ui-activity-dot-shadow)]"
        :class="activityDotClass"
        aria-hidden="true"
      ></span>
      <span>{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string;
  activityDotClass: string;
}>();
</script>
