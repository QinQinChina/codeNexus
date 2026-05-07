<template>
  <TransitionGroup name="composer-queue-list" tag="div" class="composer-queue-list">
    <div
      v-for="msg in items"
      :key="msg.id"
      class="composer-queue-item group"
      :class="{ 'is-failed': msg.status === 'failed', 'is-sending': msg.status === 'sending' }"
    >
      <button
        class="composer-queue-primary"
        type="button"
        :disabled="msg.status === 'sending'"
        :title="msg.displayText || msg.text"
        @click="$emit('edit', msg.id)"
      >
        <span
          class="composer-queue-status-dot"
          :class="msg.status === 'failed' ? 'is-failed' : 'is-queued'"
          aria-hidden="true"
        ></span>
        <span class="composer-queue-copy">
          <span class="composer-queue-message font-medium">{{ msg.displayText || msg.text || "（空消息）" }}</span>
          <span class="composer-queue-hint">{{
            msg.status === "failed" ? "发送失败，点击重写" : "等待发送，点击编辑"
          }}</span>
        </span>
        <div class="composer-queue-primary-tag-wrapper">
          <span
            class="composer-queue-primary-tag group-hover:bg-[var(--accent)] group-hover:text-[var(--surface-1)] transition-colors duration-200"
            >编辑</span
          >
        </div>
      </button>

      <div class="composer-queue-actions">
        <button
          class="composer-queue-action composer-queue-action--primary"
          type="button"
          :disabled="msg.status === 'sending'"
          @click="$emit('send-now', msg.id)"
          title="立即发送"
        >
          <SendHorizontal class="h-3.5 w-3.5 mr-1.5" />
          <span>发送</span>
        </button>
        <button
          class="composer-queue-action composer-queue-action--danger"
          type="button"
          :disabled="msg.status === 'sending'"
          @click="$emit('remove', msg.id)"
          title="删除"
        >
          <Trash2 class="h-3.5 w-3.5 mr-1.5" />
          <span>删除</span>
        </button>
      </div>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { SendHorizontal, Trash2 } from "lucide-vue-next";
import type { QueuedMessage } from "../../stores/messageQueue.store";

defineProps<{
  items: QueuedMessage[];
}>();

defineEmits<{
  (event: "edit", messageId: string): void;
  (event: "send-now", messageId: string): void;
  (event: "remove", messageId: string): void;
}>();
</script>
