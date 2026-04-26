<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <div
      class="w-full rounded-xl border p-3 shadow-[var(--shadow-soft)]"
      :class="webSearchCardClass(item)"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span
          class="inline-flex h-7 w-7 flex-none items-center justify-center rounded-[8px] border"
          :class="webSearchIconWrapClass(item.actionType)"
          aria-hidden="true"
        >
          <Globe v-if="item.actionType === 'openPage'" class="h-3.5 w-3.5 [stroke-width:2.2]" />
          <CircleDashed
            v-else-if="item.actionType === 'other'"
            class="h-3.5 w-3.5 [stroke-width:2.2]"
          />
          <Search v-else class="h-3.5 w-3.5 [stroke-width:2.2]" />
        </span>
        <span class="text-[13px] font-semibold text-[color:var(--text)]">
          {{ item.title }}
        </span>
        <span
          v-if="item.summaryText"
          class="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-[13px] text-[color:color-mix(in_srgb,var(--text)_88%,var(--text-muted)_12%)]"
        >
          {{ item.summaryText }}
        </span>
        <span
          class="inline-flex h-[22px] items-center rounded-[4px] border px-[9px] text-[11px] mono"
          :class="webSearchStatusBadgeClass(item.status)"
        >
          {{ webSearchStatusText(item.status) }}
        </span>
        <span
          class="inline-flex h-[22px] items-center rounded-[4px] border px-[9px] text-[11px] mono"
          :class="webSearchActionBadgeClass(item.actionType)"
        >
          {{ webSearchActionText(item.actionType) }}
        </span>
        <span v-if="showTimestamps" class="ml-auto mono dim text-[11px] whitespace-nowrap">{{
          formattedTime
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Globe, CircleDashed, Search } from "lucide-vue-next";
import type { ChatWebSearchItem, WebSearchStatus } from "../layout/chat.types";
import type { NormalizedWebSearchActionType } from "../../features/timeline/webSearch";

defineProps<{
  item: ChatWebSearchItem;
  showTimestamps: boolean;
  formattedTime: string;
}>();

const webSearchStatusText = (status: WebSearchStatus): string => {
  return status === "running" ? "搜索中" : "已完成";
};

const webSearchNeutralBadgeToneClass =
  "[border-color:color-mix(in_srgb,var(--card-border)_92%,transparent)] [background:color-mix(in_srgb,var(--card-bg)_88%,transparent)] text-[color:var(--text-muted)]";
const webSearchAccentBadgeToneClass =
  "[border-color:var(--border-accent)] [background:var(--bg-accent-soft)] text-[color:var(--fg-accent)]";
const webSearchSuccessBadgeToneClass =
  "[border-color:var(--border-success)] [background:var(--bg-success-soft)] text-[color:var(--fg-success)]";
const webSearchWarningBadgeToneClass =
  "[border-color:var(--border-warning)] [background:var(--bg-warning-soft)] text-[color:var(--fg-warning)]";

const webSearchNeutralCardToneClass = "[border-color:var(--card-border)] [background:var(--card-bg)]";
const webSearchAccentCardToneClass =
  "[border-color:color-mix(in_srgb,var(--card-border)_40%,var(--border-accent)_60%)] [background:linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_84%,var(--bg-accent-soft)_16%),color-mix(in_srgb,var(--card-bg)_96%,transparent))]";
const webSearchSuccessCardToneClass =
  "[border-color:color-mix(in_srgb,var(--card-border)_42%,var(--border-success)_58%)] [background:linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_82%,var(--bg-success-soft)_18%),color-mix(in_srgb,var(--card-bg)_96%,transparent))]";
const webSearchWarningCardToneClass =
  "[border-color:color-mix(in_srgb,var(--card-border)_42%,var(--border-warning)_58%)] [background:linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_84%,var(--bg-warning-soft)_16%),color-mix(in_srgb,var(--card-bg)_96%,transparent))]";

const webSearchStatusBadgeClass = (status: WebSearchStatus): string => {
  if (status === "running") {
    return webSearchAccentBadgeToneClass;
  }
  return webSearchSuccessBadgeToneClass;
};

const webSearchActionText = (actionType: NormalizedWebSearchActionType): string => {
  if (actionType === "search") return "搜索";
  if (actionType === "openPage") return "打开";
  if (actionType === "findInPage") return "查找";
  return "其他";
};

const webSearchActionBadgeClass = (actionType: NormalizedWebSearchActionType): string => {
  if (actionType === "search") {
    return webSearchAccentBadgeToneClass;
  }
  if (actionType === "openPage") {
    return webSearchSuccessBadgeToneClass;
  }
  if (actionType === "findInPage") {
    return webSearchWarningBadgeToneClass;
  }
  return webSearchNeutralBadgeToneClass;
};

const webSearchCardClass = (item: ChatWebSearchItem): string => {
  if (item.actionType === "search") {
    return webSearchAccentCardToneClass;
  }
  if (item.actionType === "openPage") {
    return webSearchSuccessCardToneClass;
  }
  if (item.actionType === "findInPage") {
    return webSearchWarningCardToneClass;
  }
  return webSearchNeutralCardToneClass;
};

const webSearchIconWrapClass = (actionType: NormalizedWebSearchActionType): string => {
  if (actionType === "search") {
    return webSearchAccentBadgeToneClass;
  }
  if (actionType === "openPage") {
    return webSearchSuccessBadgeToneClass;
  }
  if (actionType === "findInPage") {
    return webSearchWarningBadgeToneClass;
  }
  return webSearchNeutralBadgeToneClass;
};
</script>
