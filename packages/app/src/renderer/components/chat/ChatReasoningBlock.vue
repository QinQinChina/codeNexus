<template>
  <div :class="CHAT_ROW_TOOL_CLASS">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <Collapsible class="reasoning-summary-event w-full" :open="isOpen" @update:open="$emit('toggle', $event)">
        <template #trigger="{ triggerProps, open }">
          <div
            class="reasoning-summary-meta flex w-full min-w-0 items-center gap-2.5 overflow-hidden text-xs dim cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-warning-hover)] focus-visible:outline-offset-2"
            v-bind="triggerProps"
          >
            <span class="inline-flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              <span class="ui-leading-icon-slot" aria-hidden="true">
                <Brain class="h-3 w-3 flex-none text-[var(--fg-warning)] [stroke-width:2.2]" />
              </span>
              <span class="min-w-0 truncate">{{ summaryTitle || t("chat.activity.reasoning") }}</span>
              <span v-if="durationText" class="mono dim whitespace-nowrap">{{ durationText }}</span>
            </span>
            <ChevronDown
              class="ml-auto h-3.5 w-3.5 flex-none opacity-80 transition-transform duration-150 [stroke-width:2.4]"
              :class="{ 'rotate-180': open }"
              aria-hidden="true"
            />
          </div>
        </template>

        <AgentMarkdownContent class="body agent-markdown-body mt-1 text-[var(--text-muted)]" :html="html" />

        <Collapsible
          v-if="hasRawText"
          class="reasoning-raw mt-2 w-full"
          :open="rawOpen"
          @update:open="rawOpen = $event"
        >
          <template #trigger="{ triggerProps, open }">
            <div
              class="reasoning-raw-trigger inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2 py-1 text-[11px] text-[var(--text-muted)] cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-warning-hover)] focus-visible:outline-offset-2"
              v-bind="triggerProps"
            >
              <span class="min-w-0 truncate">{{ t("chat.activity.rawReasoning") }}</span>
              <span class="mono dim whitespace-nowrap">{{ rawContentCountText }}</span>
              <ChevronDown
                class="h-3 w-3 flex-none opacity-80 transition-transform duration-150 [stroke-width:2.4]"
                :class="{ 'rotate-180': open }"
                aria-hidden="true"
              />
            </div>
          </template>
          <pre
            class="reasoning-raw-body app-scrollbar m-0 mt-1.5 max-h-[280px] overflow-auto rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-2.5 text-[12px] leading-[1.5] text-[var(--ui-code-text)] whitespace-pre-wrap [overflow-wrap:anywhere] break-words mono"
            >{{ rawText }}</pre
          >
        </Collapsible>
      </Collapsible>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Brain, ChevronDown } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import Collapsible from "../ui/Collapsible.vue";
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import { CHAT_ROW_TOOL_CLASS } from "../layout/chat/chatPresentation";

const props = defineProps<{
  isOpen: boolean;
  summaryTitle: string;
  durationText: string;
  html: string;
  rawText?: string;
  rawContentCount?: number;
}>();

defineEmits<{
  (e: "toggle", open: boolean): void;
}>();

const { t } = useI18n();
const rawOpen = ref(false);
const hasRawText = computed(() => String(props.rawText ?? "").trim().length > 0);
const rawContentCountText = computed(() => {
  const count = Math.max(0, Math.round(Number(props.rawContentCount) || 0));
  return t("chat.activity.segmentCount", { count: Math.max(1, count) });
});
</script>
