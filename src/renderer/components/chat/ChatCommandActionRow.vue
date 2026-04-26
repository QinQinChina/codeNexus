<template>
  <div class="chat-terminal-action-wrap w-full max-w-full min-w-0">
    <div
      class="chat-terminal-action-line inline-flex w-full max-w-full min-w-0 items-center gap-1.5 p-0 m-0 box-border border-0 bg-transparent text-xs"
      :title="commandActionNodeTitle(item)"
    >
      <span class="chat-terminal-action-left inline-flex flex-none items-center gap-1">
        <span v-if="item.item.status === 'running'" class="running-indicator is-muted" aria-hidden="true"></span>
        <CheckCircle2
          v-else-if="item.item.status === 'completed'"
          class="chat-terminal-action-icon chat-terminal-action-icon--success h-[14px] w-[14px] flex-none [stroke-width:2.8]"
          aria-hidden="true"
        />
        <AlertTriangle
          v-else-if="item.item.status === 'failed'"
          class="chat-terminal-action-icon chat-terminal-action-icon--danger h-[14px] w-[14px] flex-none [stroke-width:2.8]"
          aria-hidden="true"
        />
        <CircleDashed
          v-else
          class="chat-terminal-action-icon chat-terminal-action-icon--muted h-[14px] w-[14px] flex-none [stroke-width:2.4]"
          aria-hidden="true"
        />
      </span>
      <span class="chat-terminal-action-text min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{
        commandGroupItemActionText(item.item)
      }}</span>
      <span
        class="chat-terminal-action-status inline-flex flex-none items-center rounded-[4px] border px-1.5 py-0.5 mono text-[10px] font-semibold leading-none"
        :class="commandStatusClass(item.item.status)"
      >
        {{ commandGroupItemStatusText(item.item) }}
      </span>
      <span v-if="commandGroupItemActionDetailText(item.item)" class="mono dim">{{
        commandGroupItemActionDetailText(item.item)
      }}</span>
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
import { CheckCircle2, AlertTriangle, CircleDashed, ChevronDown } from "lucide-vue-next";
import type { CommandActionNode, CommandGroupItem } from "../../features/timeline/renderModel/buildTimelineNodes";
import {
  commandActionNodeTitle,
  commandGroupItemActionText,
  commandGroupItemStatusText,
  commandGroupItemActionDetailText,
} from "../../features/timeline/renderModel/formatters";

defineProps<{
  item: CommandActionNode;
  isFilesOpen: boolean;
  renderLimit: number;
}>();

defineEmits<{
  (e: "toggle-files"): void;
}>();

const commandStatusClass = (status: CommandGroupItem["status"]) => {
  if (status === "completed") return "chat-terminal-action-status--success";
  if (status === "failed") return "chat-terminal-action-status--danger";
  if (status === "running") return "chat-terminal-action-status--running";
  return "chat-terminal-action-status--muted";
};
</script>

<style scoped>
.chat-terminal-action-wrap {
  --chat-tool-success-fg: color-mix(in srgb, var(--success, var(--fg-success)) 64%, var(--text-muted, var(--text)) 36%);
  --chat-tool-success-bg: color-mix(in srgb, var(--success, var(--fg-success)) 10%, transparent);
  --chat-tool-success-border: color-mix(in srgb, var(--success, var(--fg-success)) 34%, var(--border) 66%);
  --chat-tool-danger-fg: color-mix(in srgb, var(--danger, var(--fg-danger)) 64%, var(--text-muted, var(--text)) 36%);
  --chat-tool-danger-bg: color-mix(in srgb, var(--danger, var(--fg-danger)) 10%, transparent);
  --chat-tool-danger-border: color-mix(in srgb, var(--danger, var(--fg-danger)) 34%, var(--border) 66%);
  --chat-tool-running-fg: color-mix(in srgb, var(--accent) 64%, var(--text-muted, var(--text)) 36%);
  --chat-tool-running-bg: color-mix(in srgb, var(--accent) 10%, transparent);
  --chat-tool-running-border: color-mix(in srgb, var(--accent) 34%, var(--border) 66%);
}

.chat-terminal-action-line {
  color: color-mix(in srgb, var(--text) 94%, white 6%);
}

.chat-terminal-action-icon--success {
  color: var(--chat-tool-success-fg);
}

.chat-terminal-action-icon--danger {
  color: var(--chat-tool-danger-fg);
}

.chat-terminal-action-icon--muted {
  color: color-mix(in srgb, var(--text-muted) 88%, var(--text) 12%);
}

.chat-terminal-action-status--success {
  border-color: var(--chat-tool-success-border);
  background: var(--chat-tool-success-bg);
  color: var(--chat-tool-success-fg);
}

.chat-terminal-action-status--danger {
  border-color: var(--chat-tool-danger-border);
  background: var(--chat-tool-danger-bg);
  color: var(--chat-tool-danger-fg);
}

.chat-terminal-action-status--running {
  border-color: var(--chat-tool-running-border);
  background: var(--chat-tool-running-bg);
  color: var(--chat-tool-running-fg);
}

.chat-terminal-action-status--muted {
  border-color: var(--ui-well-border);
  background: var(--ui-well-bg);
  color: color-mix(in srgb, var(--text-muted) 90%, var(--text) 10%);
}
</style>
