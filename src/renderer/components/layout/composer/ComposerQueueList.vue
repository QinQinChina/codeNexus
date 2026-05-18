<template>
  <div
    class="composer-queue-tray"
    :class="{
      'is-expanded': expanded,
      'has-failed': failedCount > 0,
      'is-sending': sendingCount > 0,
    }"
  >
    <button
      class="composer-queue-summary"
      type="button"
      :aria-expanded="expanded ? 'true' : 'false'"
      aria-controls="composer-queue-list"
      @click="emit('update:expanded', !expanded)"
    >
      <span class="composer-queue-summary-icon" aria-hidden="true">
        <AlertTriangle v-if="failedCount > 0" class="composer-queue-summary-svg" />
        <LoaderCircle v-else-if="sendingCount > 0" class="composer-queue-summary-svg" />
        <ListChecks v-else class="composer-queue-summary-svg" />
      </span>
      <span class="composer-queue-summary-copy">
        <span class="composer-queue-summary-title">{{ summaryTitle }}</span>
        <span class="composer-queue-summary-preview">{{ summaryPreview }}</span>
      </span>
      <span class="composer-queue-summary-count mono">{{ items.length }}</span>
      <ChevronDown class="composer-queue-chevron" :class="{ 'is-expanded': expanded }" aria-hidden="true" />
    </button>

    <Transition name="composer-queue-panel">
      <div v-if="expanded" id="composer-queue-list" class="composer-queue-panel">
        <TransitionGroup name="composer-queue-list" tag="div" class="composer-queue-list">
          <div
            v-for="msg in items"
            :key="msg.id"
            class="composer-queue-item"
            :class="{ 'is-failed': msg.status === 'failed', 'is-sending': msg.status === 'sending' }"
          >
            <span
              class="composer-queue-status-dot"
              :class="{
                'is-failed': msg.status === 'failed',
                'is-sending': msg.status === 'sending',
                'is-queued': msg.status === 'queued',
              }"
              aria-hidden="true"
            ></span>

            <span class="composer-queue-copy">
              <span class="composer-queue-message font-medium">{{ previewText(msg) }}</span>
              <span class="composer-queue-hint">{{ statusText(msg) }}</span>
            </span>

            <div class="composer-queue-actions">
              <button
                class="composer-queue-action"
                type="button"
                :disabled="msg.status === 'sending'"
                :aria-label="t('composer.editQueuedAria', { preview: previewText(msg) })"
                @click="emit('edit', msg.id)"
              >
                <Pencil class="composer-queue-action-icon" aria-hidden="true" />
              </button>
              <button
                class="composer-queue-action composer-queue-action--primary"
                type="button"
                :disabled="msg.status === 'sending'"
                :aria-label="t('composer.sendQueuedAria', { preview: previewText(msg) })"
                @click="emit('send-now', msg.id)"
              >
                <SendHorizontal class="composer-queue-action-icon" aria-hidden="true" />
              </button>
              <button
                class="composer-queue-action composer-queue-action--danger"
                type="button"
                :disabled="msg.status === 'sending'"
                :aria-label="t('composer.deleteQueuedAria', { preview: previewText(msg) })"
                @click="emit('remove', msg.id)"
              >
                <Trash2 class="composer-queue-action-icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { AlertTriangle, ChevronDown, ListChecks, LoaderCircle, Pencil, SendHorizontal, Trash2 } from "lucide-vue-next";
import type { QueuedMessage } from "../../../stores/messageQueue.store";

const props = defineProps<{
  items: QueuedMessage[];
  expanded: boolean;
}>();

const emit = defineEmits<{
  (event: "update:expanded", value: boolean): void;
  (event: "edit", messageId: string): void;
  (event: "send-now", messageId: string): void;
  (event: "remove", messageId: string): void;
}>();

const { t } = useI18n();
const failedCount = computed(() => props.items.filter((msg) => msg.status === "failed").length);
const sendingCount = computed(() => props.items.filter((msg) => msg.status === "sending").length);
const firstItem = computed(() => props.items[0] ?? null);

const summaryTitle = computed(() => {
  if (failedCount.value > 0) return t("composer.failedCount", { count: failedCount.value });
  if (sendingCount.value > 0) return t("composer.sendingQueued");
  return t("composer.queuedCount", { count: props.items.length });
});

const summaryPreview = computed(() => {
  const item = firstItem.value;
  if (!item) return t("composer.noQueuedMessage");
  const prefix = props.items.length > 1 ? t("composer.nextPrefix") : "";
  return `${prefix}${previewText(item)}`;
});

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

function statusText(message: QueuedMessage): string {
  if (message.status === "failed") return t("composer.failedRetry");
  if (message.status === "sending") return t("composer.sending");
  return t("composer.waitingCurrentTurn");
}
</script>
