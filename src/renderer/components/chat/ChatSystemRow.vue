<template>
  <div class="chat-row chat-row--system flex min-w-0 m-0">
    <div
      class="chat-system-line chat-system-line--error mono inline-flex w-full max-w-full min-w-0 items-start gap-2 rounded-[6px] border px-3 py-2 text-xs"
    >
      <span class="chat-system-icon" aria-hidden="true">!</span>
      <span class="chat-system-text min-w-0 flex-1 break-words">{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>

<style scoped>
.chat-system-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border-danger) 86%, transparent);
  background: color-mix(in srgb, var(--bg-danger-soft) 90%, transparent);
  color: var(--fg-danger);
  font-size: 11px;
  line-height: 1;
}

.chat-system-text {
  line-height: 1.5;
}
</style>
