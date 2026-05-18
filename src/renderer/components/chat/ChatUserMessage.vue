<template>
  <div :class="[CHAT_ROW_BASE_CLASS, 'chat-row--user', 'chat-row--user-shell']">
    <div class="chat-user-bubble-stack" :class="{ 'is-editing': inlineRewriteDraft }">
      <ChatUserBubbleFrame
        @click="$emit('click', event)"
      >
        <template v-for="part in messageParts" :key="part.key">
          <span v-if="part.type === 'text'">{{ part.text }}</span>
          <button
            v-else
            class="chat-inline-file-token"
            type="button"
            v-tooltip="part.title"
            @click.stop="$emit('file-token-click', part.path)"
          >
            <Icon class="chat-inline-file-token__icon" :icon="part.icon" aria-hidden="true" />
            <span class="chat-inline-file-token__label">{{ part.label }}</span>
          </button>
        </template>
        <div v-if="imageCount > 0" class="chat-user-images mt-2.5 flex flex-col gap-2">
          <div class="mono dim text-[11px]">{{ t("chat.activity.attachedImages", { count: imageCount }) }}</div>
          <div v-if="visibleImages.length > 0" class="chat-user-image-list flex flex-wrap gap-2 max-[1500px]:gap-1.5">
            <LazyImageThumb
              v-for="image in visibleImages"
              :key="image.id"
              :imageId="image.id"
              class="h-[92px] w-[92px] max-w-full"
              :source="image.source"
              :sourceKind="image.sourceKind"
              :previewTitle="image.title"
              v-tooltip="image.title"
              :workspaceRoot="workspaceRoot"
              :rootMarginPx="260"
              @load-error="$emit('thumb-load-error', $event)"
              @preview="$emit('preview-image', $event)"
            />
          </div>
        </div>
        <template #meta>
          <span v-if="showTimestamps" class="mono dim">{{ formattedTime }}</span>
        </template>
      </ChatUserBubbleFrame>
      <ChatInlineRewriteOverlay
        v-if="inlineRewriteDraft"
        :draft="inlineRewriteDraft"
        :modelOptions="modelOptions"
        :reasoningEffortOptions="reasoningEffortOptions"
        :sandboxModeOptions="sandboxModeOptions"
        :sendDisabled="sendDisabled"
        @update="$emit('inline-rewrite-update', $event)"
        @cancel="$emit('inline-rewrite-cancel')"
        @send="$emit('inline-rewrite-send')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Icon } from "@iconify/vue";
import LazyImageThumb from "../ui/LazyImageThumb.vue";
import ChatUserBubbleFrame from "./ChatUserBubbleFrame.vue";
import ChatInlineRewriteOverlay from "./ChatInlineRewriteOverlay.vue";
import type { TimelineEventItem } from "../../domain/types";
import { CHAT_ROW_BASE_CLASS } from "../layout/chat/chatPresentation";
import type { ChatInlineRewriteDraft } from "../layout/types/chat.types";

type SelectOption = {
  value: string;
  label: string;
};

defineProps<{
  event: TimelineEventItem;
  workspaceRoot: string;
  messageParts: any[];
  imageCount: number;
  visibleImages: any[];
  showTimestamps: boolean;
  formattedTime: string;
  inlineRewriteDraft?: ChatInlineRewriteDraft | null;
  modelOptions: readonly string[];
  reasoningEffortOptions: readonly SelectOption[];
  sandboxModeOptions: readonly SelectOption[];
  sendDisabled?: boolean;
}>();

const { t } = useI18n();

defineEmits<{
  (e: "click", event: TimelineEventItem): void;
  (e: "file-token-click", path: string): void;
  (e: "thumb-load-error", err: any): void;
  (e: "preview-image", payload: any): void;
  (e: "inline-rewrite-update", patch: Partial<ChatInlineRewriteDraft>): void;
  (e: "inline-rewrite-cancel"): void;
  (e: "inline-rewrite-send"): void;
}>();
</script>
