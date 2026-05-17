<template>
  <ChatUserBubbleFrame
    class="chat-pinned-prompt"
    :title="tooltipText"
    role="button"
    tabindex="0"
    aria-label="定位到当前提问"
    @click="emit('locate')"
    @keydown.enter.prevent="emit('locate')"
    @keydown.space.prevent="emit('locate')"
  >
    <span class="chat-pinned-prompt__content-clip">
      <Transition :name="contentTransitionName">
        <span :key="contentKey" class="chat-pinned-prompt__content">
          <span class="chat-pinned-prompt__text">{{ displayText }}</span>
        </span>
      </Transition>
    </span>
    <template #meta>
      <span v-if="showMeta" class="chat-pinned-prompt__meta-clip">
        <Transition :name="contentTransitionName">
          <span :key="`${contentKey}:meta`" class="chat-pinned-prompt__meta">
            <span v-if="showTimestamp" class="mono dim">{{ formattedTime }}</span>
            <span v-if="hasMeta" class="chat-pinned-prompt__tags" aria-hidden="true">
              <span v-if="normalizedFileCount > 0" class="chat-pinned-prompt__tag"
                >+{{ normalizedFileCount }} 文件</span
              >
              <span v-if="normalizedImageCount > 0" class="chat-pinned-prompt__tag"
                >+{{ normalizedImageCount }} 图片</span
              >
            </span>
          </span>
        </Transition>
      </span>
    </template>
  </ChatUserBubbleFrame>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ChatUserBubbleFrame from "./ChatUserBubbleFrame.vue";

const props = defineProps<{
  text: string;
  title?: string;
  fileCount?: number;
  imageCount?: number;
  showTimestamp?: boolean;
  formattedTime?: string;
  contentKey?: string;
  transitionDirection?: "up" | "down";
}>();

const emit = defineEmits<{
  (event: "locate"): void;
}>();

function normalizeCount(value: number | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
}

const normalizedFileCount = computed(() => normalizeCount(props.fileCount));
const normalizedImageCount = computed(() => normalizeCount(props.imageCount));
const hasMeta = computed(() => normalizedFileCount.value > 0 || normalizedImageCount.value > 0);
const showTimestamp = computed(() => Boolean(props.showTimestamp && String(props.formattedTime ?? "").trim()));
const showMeta = computed(() => showTimestamp.value || hasMeta.value);
const formattedTime = computed(() => String(props.formattedTime ?? "").trim());
const displayText = computed(
  () =>
    String(props.text ?? "")
      .replace(/\s+/g, " ")
      .trim() || "用户消息"
);
const tooltipText = computed(() => String(props.title ?? "").trim() || displayText.value);
const contentKey = computed(() => String(props.contentKey ?? displayText.value).trim() || displayText.value);
const contentTransitionName = computed(() =>
  props.transitionDirection === "down" ? "chat-pinned-prompt-content-down" : "chat-pinned-prompt-content-up"
);
</script>
