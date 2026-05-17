<template>
  <div :class="CHAT_ROW_ACTIVITY_CLASS">
    <div class="chat-token-usage">
      <button
        class="chat-token-usage__summary"
        type="button"
        :aria-expanded="open ? 'true' : 'false'"
        @click="toggleOpen"
      >
        <span class="chat-activity-dot h-1.5 w-1.5 flex-none rounded-full" aria-hidden="true"></span>
        <span class="chat-token-usage__label mono">本轮用量</span>
        <span class="chat-token-usage__metric mono">{{ formatCount(usage.last.totalTokens) }} token</span>
        <span class="chat-token-usage__metric mono">缓存 {{ formatCount(usage.last.cachedInputTokens) }}</span>
        <span class="chat-token-usage__metric mono">上下文 {{ contextPercentText }}</span>
        <ChevronDown class="chat-token-usage__chevron" :class="{ 'is-open': open }" aria-hidden="true" />
      </button>

      <div v-if="open" class="chat-token-usage__details">
        <div v-for="item in detailItems" :key="item.label" class="chat-token-usage__detail">
          <span>{{ item.label }}</span>
          <strong class="mono">{{ item.value }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ChevronDown } from "lucide-vue-next";
import type { TokenUsageState } from "../../domain/types";
import { CHAT_ROW_ACTIVITY_CLASS } from "../layout/chat/chatPresentation";

const props = defineProps<{
  usage: TokenUsageState;
}>();

const emit = defineEmits<{
  "layout-change": [];
}>();

const open = ref(false);

const formatCount = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "--";
  const rounded = Math.max(0, Math.round(value));
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}m`;
  if (rounded >= 10_000) return `${(rounded / 1_000).toFixed(1)}k`;
  return rounded.toLocaleString("en-US");
};

const contextPercentText = computed(() => {
  const used = props.usage.usedTokens;
  const contextWindow = props.usage.contextWindow;
  if (used == null || contextWindow == null || contextWindow <= 0) return "--";
  return `${Math.max(0, Math.min(100, Math.round((used / contextWindow) * 100)))}%`;
});

const detailItems = computed(() => [
  { label: "输入", value: formatCount(props.usage.last.inputTokens) },
  { label: "缓存输入", value: formatCount(props.usage.last.cachedInputTokens) },
  { label: "输出", value: formatCount(props.usage.last.outputTokens) },
  { label: "推理输出", value: formatCount(props.usage.last.reasoningOutputTokens) },
  { label: "本轮总计", value: formatCount(props.usage.last.totalTokens) },
  { label: "累计总计", value: formatCount(props.usage.total.totalTokens) },
  { label: "上下文窗口", value: formatCount(props.usage.contextWindow) },
]);

const toggleOpen = async () => {
  open.value = !open.value;
  await nextTick();
  emit("layout-change");
};
</script>

<style scoped>
.chat-token-usage {
  width: 100%;
  min-width: 0;
  color: var(--chat-row-muted);
  font-size: 12px;
}

.chat-token-usage__summary {
  display: flex;
  min-height: 24px;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: var(--chat-radius-md);
  background: transparent;
  padding: 2px 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.chat-token-usage__summary:hover {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  color: var(--chat-row-text);
}

.chat-token-usage__summary:focus-visible {
  outline: 2px solid var(--chat-focus-ring);
  outline-offset: 1px;
}

.chat-token-usage .chat-activity-dot {
  background: var(--chat-status-ok);
  box-shadow: 0 0 10px color-mix(in srgb, var(--chat-status-ok) 45%, transparent);
}

.chat-token-usage__label {
  flex: 0 0 auto;
}

.chat-token-usage__metric {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-token-usage__chevron {
  margin-left: auto;
  height: 14px;
  width: 14px;
  flex: 0 0 auto;
  transition: transform 160ms ease;
}

.chat-token-usage__chevron.is-open {
  transform: rotate(180deg);
}

.chat-token-usage__details {
  display: flex;
  flex-wrap: wrap;
  column-gap: 22px;
  row-gap: 6px;
  align-items: center;
  margin: 2px 10px 4px 25px;
  padding: 8px 10px;
  border-left: 1px solid color-mix(in srgb, var(--chat-status-ok) 42%, var(--border) 58%);
}

.chat-token-usage__detail {
  display: inline-flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: baseline;
  gap: 5px;
}

.chat-token-usage__detail span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-token-usage__detail strong {
  flex: 0 0 auto;
  color: var(--chat-row-text);
  font-weight: 600;
}
</style>
