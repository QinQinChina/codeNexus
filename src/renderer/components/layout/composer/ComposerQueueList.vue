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
                :aria-label="`编辑排队消息：${previewText(msg)}`"
                @click="emit('edit', msg.id)"
              >
                <Pencil class="composer-queue-action-icon" aria-hidden="true" />
              </button>
              <button
                class="composer-queue-action composer-queue-action--primary"
                type="button"
                :disabled="msg.status === 'sending'"
                :aria-label="`发送排队消息：${previewText(msg)}`"
                @click="emit('send-now', msg.id)"
              >
                <SendHorizontal class="composer-queue-action-icon" aria-hidden="true" />
              </button>
              <button
                class="composer-queue-action composer-queue-action--danger"
                type="button"
                :disabled="msg.status === 'sending'"
                :aria-label="`删除排队消息：${previewText(msg)}`"
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
import {
  AlertTriangle,
  ChevronDown,
  ListChecks,
  LoaderCircle,
  Pencil,
  SendHorizontal,
  Trash2,
} from "lucide-vue-next";
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

const failedCount = computed(() => props.items.filter((msg) => msg.status === "failed").length);
const sendingCount = computed(() => props.items.filter((msg) => msg.status === "sending").length);
const firstItem = computed(() => props.items[0] ?? null);

const summaryTitle = computed(() => {
  if (failedCount.value > 0) return `${failedCount.value} 条发送失败`;
  if (sendingCount.value > 0) return "正在发送排队消息";
  return `排队 ${props.items.length} 条`;
});

const summaryPreview = computed(() => {
  const item = firstItem.value;
  if (!item) return "没有等待发送的消息";
  const prefix = props.items.length > 1 ? "下一条：" : "";
  return `${prefix}${previewText(item)}`;
});

function previewText(message: QueuedMessage): string {
  const displayText = String(message.displayText ?? "").trim();
  if (displayText) return displayText;
  const text = String(message.text ?? "").trim();
  if (text) return text;
  const inputs = Array.isArray(message.inputs) ? message.inputs : [];
  const imageCount = inputs.filter((item) => item?.type === "image" || item?.type === "localImage").length;
  if (imageCount > 0) return `图片 ${imageCount} 张`;
  return "（空消息）";
}

function statusText(message: QueuedMessage): string {
  if (message.status === "failed") return "发送失败，可编辑后重试";
  if (message.status === "sending") return "正在发送";
  return "等待当前回合结束后发送";
}
</script>
