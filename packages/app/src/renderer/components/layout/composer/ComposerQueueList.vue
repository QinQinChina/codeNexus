<template>
  <div
    class="composer-queue-tray"
    :class="{
      'has-failed': failedCount > 0,
      'has-stack': restItems.length > 0,
      'has-deep-stack': restItems.length > 1,
    }"
  >
    <div v-if="firstItem" class="composer-queue-main" role="list">
      <div
        class="composer-queue-item composer-queue-item--primary"
        :class="{ 'is-failed': firstItem.status === 'failed', 'is-sending': firstItem.status === 'sending' }"
        role="listitem"
      >
        <span
          class="composer-queue-status-dot"
          :class="{
            'is-failed': firstItem.status === 'failed',
            'is-sending': firstItem.status === 'sending',
            'is-queued': firstItem.status === 'queued',
          }"
          aria-hidden="true"
        ></span>

        <span class="composer-queue-copy">
          <span class="composer-queue-message font-medium">{{ previewText(firstItem) }}</span>
        </span>

        <div class="composer-queue-actions">
          <button
            class="composer-queue-action"
            type="button"
            :disabled="firstItem.status === 'sending'"
            :aria-label="t('composer.editQueuedAria', { preview: previewText(firstItem) })"
            @click="emit('edit', firstItem.id)"
          >
            <Pencil class="composer-queue-action-icon" aria-hidden="true" />
          </button>
          <button
            class="composer-queue-action composer-queue-action--primary"
            type="button"
            :disabled="firstItem.status === 'sending'"
            :aria-label="t('composer.sendQueuedAria', { preview: previewText(firstItem) })"
            @click="emit('send-now', firstItem.id)"
          >
            <SendHorizontal class="composer-queue-action-icon" aria-hidden="true" />
          </button>
          <button
            class="composer-queue-action composer-queue-action--danger"
            type="button"
            :disabled="firstItem.status === 'sending'"
            :aria-label="t('composer.deleteQueuedAria', { preview: previewText(firstItem) })"
            @click="emit('remove', firstItem.id)"
          >
            <Trash2 class="composer-queue-action-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Pencil, SendHorizontal, Trash2 } from "lucide-vue-next";
import type { QueuedMessage } from "../../../stores/messageQueue.store";

const props = defineProps<{
  items: QueuedMessage[];
}>();

const emit = defineEmits<{
  (event: "edit", messageId: string): void;
  (event: "send-now", messageId: string): void;
  (event: "remove", messageId: string): void;
}>();

const { t } = useI18n();
const failedCount = computed(() => props.items.filter((msg) => msg.status === "failed").length);
const firstItem = computed(() => props.items[0] ?? null);
const restItems = computed(() => props.items.slice(1));

function previewText(message: QueuedMessage): string {
  const displayText = String(message.displayText ?? "").trim();
  if (displayText) return displayText;
  const text = String(message.text ?? "").trim();
  if (text) return text;
  const inputs = Array.isArray(message.inputs) ? message.inputs : [];
  const imageCount = inputs.filter((item) => item?.type === "image" || item?.type === "localImage").length;
  if (imageCount > 0) return t("composer.imageCount", { count: imageCount });
  return t("composer.emptyMessage");
}
</script>
