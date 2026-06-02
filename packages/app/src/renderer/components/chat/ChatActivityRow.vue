<template>
  <div :class="CHAT_ROW_ACTIVITY_CLASS">
    <div class="chat-activity-line inline-flex w-full max-w-full items-center gap-2.5 px-2.5 py-0.5 text-xs dim">
      <span
        v-if="activityDotClass !== 'is-running'"
        class="chat-activity-dot h-1.5 w-1.5 flex-none rounded-full bg-[var(--ui-activity-dot-bg)] shadow-[var(--ui-activity-dot-shadow)]"
        :class="activityDotClass"
        aria-hidden="true"
      ></span>
      <ExecutionWaveText v-if="activityDotClass === 'is-running'" :text="text" />
      <span v-else>{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import ExecutionWaveText from "../ui/ExecutionWaveText.vue";
import { CHAT_ROW_ACTIVITY_CLASS } from "../layout/chat/chatPresentation";

defineProps<{
  text: string;
  activityDotClass: string;
}>();
</script>
