<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--user']">
    <div
      class="chat-bubble chat-bubble-user w-full max-w-full min-w-0 cursor-pointer rounded-[4px] border border-[color:var(--bubble-user-border)] bg-[var(--bubble-user-bg)] bg-clip-padding px-3 py-2.5 shadow-[var(--bubble-shadow)] transition-[transform,box-shadow,border-color] hover:-translate-y-[1px] hover:shadow-md hover:border-[var(--border-accent)]"
      :class="
        isHistoryRewriteAnchor ? 'outline outline-2 outline-[var(--ui-well-focus-outline)] outline-offset-[1px]' : ''
      "
      @click="$emit('click', event)"
    >
      <div class="chat-bubble-inline flex min-w-0 items-start justify-between gap-2.5">
        <div class="chat-bubble-body flex-1 min-w-0 whitespace-pre-wrap break-words">
          <template v-for="part in messageParts" :key="part.key">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <button
              v-else
              class="chat-inline-file-token"
              type="button"
              :title="part.title"
              @click.stop="$emit('file-token-click', part.path)"
            >
              <span class="chat-inline-file-token__icon" aria-hidden="true"></span>
              <span class="chat-inline-file-token__label">{{ part.label }}</span>
            </button>
          </template>
          <div v-if="imageCount > 0" class="chat-user-images mt-2.5 flex flex-col gap-2">
            <div class="mono dim text-[11px]">附图 {{ imageCount }} 张</div>
            <div v-if="visibleImages.length > 0" class="chat-user-image-list flex flex-wrap gap-2 max-[1500px]:gap-1.5">
              <LazyImageThumb
                v-for="image in visibleImages"
                :key="image.id"
                :imageId="image.id"
                class="h-[92px] w-[92px] max-w-full"
                :source="image.source"
                :sourceKind="image.sourceKind"
                :title="image.title"
                :workspaceRoot="workspaceRoot"
                :rootMarginPx="260"
                @load-error="$emit('thumb-load-error', $event)"
                @preview="$emit('preview-image', $event)"
              />
            </div>
          </div>
        </div>
        <span
          class="chat-bubble-meta-right inline-flex flex-none min-w-0 items-center justify-end gap-2.5 whitespace-nowrap"
        >
          <span v-if="showTimestamps" class="mono dim">{{ formattedTime }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LazyImageThumb from "../ui/LazyImageThumb.vue";
import type { TimelineEventItem } from "../../domain/types";
import { CHAT_ROW_BASE_CLASS } from "../layout/chat/chatPresentation";

defineProps<{
  event: TimelineEventItem;
  workspaceRoot: string;
  isHistoryRewriteAnchor: boolean;
  messageParts: any[];
  imageCount: number;
  visibleImages: any[];
  showTimestamps: boolean;
  formattedTime: string;
}>();

defineEmits<{
  (e: "click", event: TimelineEventItem): void;
  (e: "file-token-click", path: string): void;
  (e: "thumb-load-error", err: any): void;
  (e: "preview-image", payload: any): void;
}>();
</script>
