<template>
  <div class="chat-terminal-action-wrap w-full max-w-full min-w-0">
    <div
      class="chat-terminal-action-line inline-flex w-full max-w-full min-w-0 items-center gap-1.5 p-0 m-0 box-border border-0 bg-transparent text-xs"
      :class="{ 'is-running': item.item.status === 'running' }"
      :title="commandActionNodeTitle(item)"
    >
      <span class="ui-leading-icon-slot" aria-hidden="true">
        <TerminalSquare class="chat-terminal-action-icon h-[14px] w-[14px] flex-none [stroke-width:2.4]" />
      </span>
      <WaveText
        v-if="isRunning"
        class="chat-terminal-action-text"
        color="var(--accent)"
        :text="actionText"
        :cycle-max-chars="128"
      />
      <span v-else class="chat-terminal-action-text">{{ actionText }}</span>
      <button
        v-if="item.item.filesCount > 0"
        class="chat-terminal-action-toggle !ml-auto !inline-flex !h-[22px] !w-[22px] !items-center !justify-center !rounded-[4px] !border !border-[var(--ui-well-border)] !bg-[var(--ui-well-bg)] !p-0 !text-inherit !shadow-none opacity-80 transition-[opacity,border-color,background] duration-150 hover:opacity-100 hover:!border-[var(--ui-well-border-hover)] hover:!bg-[var(--ui-well-bg-strong)] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[var(--ui-well-focus-outline)] active:!translate-y-0"
        type="button"
        :aria-expanded="isFilesOpen ? 'true' : 'false'"
        :title="isFilesOpen ? '收起文件清单' : '展开文件清单'"
        @click.stop="$emit('toggle-files')"
      >
        <ChevronDown
          class="chat-terminal-action-toggle-icon h-[14px] w-[14px] opacity-80 transition-[transform,opacity] duration-150"
          :class="isFilesOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      v-if="item.item.filesCount > 0 && isFilesOpen"
      class="chat-terminal-action-files mx-2.5 rounded-xl border border-[var(--ui-well-border)] bg-[var(--ui-well-bg-strong)] px-2.5 py-2"
    >
      <div class="chat-terminal-action-files-title mb-1.5 text-xs mono dim">文件（{{ item.item.filesCount }}）</div>
      <div
        class="chat-terminal-action-files-list app-scrollbar grid max-h-[180px] gap-0.5 overflow-y-auto text-xs text-[var(--text)] mono"
      >
        <div
          v-for="name in item.item.files.slice(0, renderLimit)"
          :key="`${item.id}:file:${name}`"
          class="chat-terminal-action-files-row truncate whitespace-nowrap"
        >
          {{ name }}
        </div>
        <div v-if="item.item.filesCount > renderLimit" class="chat-terminal-action-files-more mt-1.5 dim">
          还有 {{ item.item.filesCount - renderLimit }} 项未展示
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, TerminalSquare } from "lucide-vue-next";
import WaveText from "../ui/WaveText.vue";
import type { CommandActionNode } from "../../features/timeline/renderModel/buildTimelineNodes";
import {
  commandActionNodeTitle,
  commandGroupItemActionText,
  commandGroupItemActionDetailText,
} from "../../features/timeline/renderModel/formatters";

const props = defineProps<{
  item: CommandActionNode;
  isFilesOpen: boolean;
  renderLimit: number;
}>();

defineEmits<{
  (e: "toggle-files"): void;
}>();

const actionText = computed(() => {
  const main = commandGroupItemActionText(props.item.item);
  const detail = commandGroupItemActionDetailText(props.item.item);
  return detail ? `${main} · ${detail}` : main;
});
const isRunning = computed(() => props.item.item.status === "running");
</script>

<style scoped>
.chat-terminal-action-wrap {
  /* 状态只做“进行中扫光”提示，不做成功/失败配色。 */
}

.chat-terminal-action-line {
  display: flex !important;
  width: 100%;
  min-height: 20px;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
}

.chat-terminal-action-text {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: normal !important;
  text-overflow: ellipsis;
  white-space: nowrap !important;
  word-break: normal !important;
}
</style>
