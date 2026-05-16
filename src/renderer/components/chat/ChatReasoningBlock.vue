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
              <span class="min-w-0 truncate" :title="title">{{ title || "思考" }}</span>
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
      </Collapsible>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Brain, ChevronDown } from "lucide-vue-next";
import Collapsible from "../ui/Collapsible.vue";
import AgentMarkdownContent from "../ui/AgentMarkdownContent.vue";
import { CHAT_ROW_TOOL_CLASS } from "../layout/chat/chatPresentation";

defineProps<{
  isOpen: boolean;
  title: string;
  durationText: string;
  html: string;
}>();

defineEmits<{
  (e: "toggle", open: boolean): void;
}>();
</script>
