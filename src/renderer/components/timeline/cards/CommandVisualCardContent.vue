<template>
  <TimelineCardShell
    class="w-full"
    :tagText="tagText"
    :statusText="statusText"
    :statusKind="statusKind"
    :open="open"
    :keepMounted="true"
    @update:open="emit('update:open', $event)"
  >
    <template #icon>
      <FileText
        v-if="kind === 'read'"
        class="h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]"
        aria-hidden="true"
      />
      <ListTree
        v-else-if="kind === 'list'"
        class="h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]"
        aria-hidden="true"
      />
      <Search
        v-else
        class="h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]"
        aria-hidden="true"
      />
    </template>

    <template #titleMeta>
      <span v-if="metricText" class="mono dim text-[11px]">{{ metricText }}</span>
    </template>

    <template #summary>
      <div class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px]">
        {{ summaryText }}
      </div>
    </template>

    <div class="grid gap-2 px-2.5 pb-2.5">
      <div class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">{{ primaryLabel }}</div>
        <div class="mono whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px] text-[var(--text)]">
          {{ primaryValue }}
        </div>
      </div>

      <div v-if="kind === 'read'" class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">内容预览</div>
        <pre class="command-visual-pre app-scrollbar mono">{{ readPreviewText }}</pre>
      </div>

      <div v-else-if="kind === 'list'" class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">文件清单</div>
        <div
          class="command-visual-list app-scrollbar grid max-h-[240px] gap-0.5 overflow-y-auto text-xs text-[var(--text)] mono"
        >
          <div v-for="file in listFiles" :key="`${item.id}:file:${file}`" class="truncate whitespace-nowrap">
            {{ file }}
          </div>
          <div v-if="listRemaining > 0" class="dim mt-1">还有 {{ listRemaining }} 项未展示</div>
          <div v-if="listFiles.length === 0" class="dim">无文件</div>
        </div>
      </div>

      <div v-else class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">匹配结果</div>
        <div
          class="command-visual-list app-scrollbar grid max-h-[260px] gap-1 overflow-y-auto text-xs text-[var(--text)] mono"
        >
          <div
            v-for="match in searchMatches"
            :key="`${item.id}:match:${match.path}:${match.line}:${match.column}:${match.text}`"
            class="grid min-w-0 grid-cols-[minmax(0,220px)_1fr] gap-2 rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-well-bg)] px-2 py-1.5"
          >
            <div class="truncate text-[color:var(--text-muted)]">{{ searchMatchLocation(match) }}</div>
            <div class="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{{ match.text || "—" }}</div>
          </div>
          <div v-if="searchRemaining > 0" class="dim mt-1">还有 {{ searchRemaining }} 条未展示</div>
          <div v-if="searchMatches.length === 0" class="dim">无匹配</div>
        </div>
      </div>

      <div class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">命令</div>
        <div class="mono dim whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[11px]">
          {{ item.commandFull || "—" }}
        </div>
      </div>

      <div v-if="item.outputFull && kind === 'list'" class="grid gap-1">
        <div class="text-[12px] font-medium text-[color:var(--text-muted)]">原始输出</div>
        <pre class="command-visual-pre app-scrollbar mono">{{ item.outputFull }}</pre>
      </div>
    </div>
  </TimelineCardShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { FileText, ListTree, Search } from "lucide-vue-next";
import TimelineCardShell from "../TimelineCardShell.vue";
import type {
  CommandListNode,
  CommandReadNode,
  CommandSearchMatch,
  CommandSearchNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";

const props = defineProps<{
  kind: "read" | "list" | "search";
  item: CommandReadNode | CommandListNode | CommandSearchNode;
  open: boolean;
  renderLimit?: number;
}>();

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();

const limit = computed(() => Math.max(1, props.renderLimit ?? 1000));
const statusKind = computed(() => {
  if (props.item.status === "running") return "running";
  if (props.item.status === "failed") return "failed";
  if (props.item.status === "completed") return "completed";
  return "unknown";
});
const statusText = computed(() => {
  if (props.item.status === "running") return "进行中";
  if (props.item.status === "failed") return "失败";
  if (props.item.status === "completed") return "已完成";
  return "未知";
});
const tagText = computed(() => {
  if (props.kind === "read") return "读取文件";
  if (props.kind === "list") return "列出文件";
  return "搜索";
});
const metricText = computed(() => {
  if (props.kind === "read") return `读取 ${(props.item as CommandReadNode).lineCount} 行`;
  if (props.kind === "list") return `${(props.item as CommandListNode).filesCount} 项`;
  return `${(props.item as CommandSearchNode).matchCount} 条`;
});
const primaryLabel = computed(() => {
  if (props.kind === "read") return "文件";
  if (props.kind === "list") return "范围";
  return "关键词";
});
const primaryValue = computed(() => {
  if (props.kind === "read") {
    const item = props.item as CommandReadNode;
    return item.path || item.name || "—";
  }
  if (props.kind === "list") return (props.item as CommandListNode).path || "当前目录";
  const item = props.item as CommandSearchNode;
  return item.query || "—";
});
const summaryText = computed(() => {
  if (props.kind === "read") {
    const item = props.item as CommandReadNode;
    return `${item.path || item.name || "文件"} ｜ 读取 ${item.lineCount} 行`;
  }
  if (props.kind === "list") {
    const item = props.item as CommandListNode;
    return `${item.path || "当前目录"} ｜ ${item.filesCount} 项`;
  }
  const item = props.item as CommandSearchNode;
  const scope = item.path ? ` ｜ ${item.path}` : "";
  return `${item.query || "搜索"}${scope} ｜ ${item.matchCount} 条`;
});
const readPreviewText = computed(() => {
  const item = props.item as CommandReadNode;
  if (item.previewLines.length === 0) return "—";
  return item.previewLines.join("\n");
});
const listFiles = computed(() => {
  if (props.kind !== "list") return [];
  return (props.item as CommandListNode).files.slice(0, limit.value);
});
const listRemaining = computed(() => {
  if (props.kind !== "list") return 0;
  return Math.max(0, (props.item as CommandListNode).filesCount - listFiles.value.length);
});
const searchMatches = computed(() => {
  if (props.kind !== "search") return [];
  return (props.item as CommandSearchNode).matches.slice(0, limit.value);
});
const searchRemaining = computed(() => {
  if (props.kind !== "search") return 0;
  return Math.max(0, (props.item as CommandSearchNode).matchCount - searchMatches.value.length);
});

const searchMatchLocation = (match: CommandSearchMatch) => {
  const path = match.path || "输出";
  const line = match.line == null ? "" : `:${match.line}`;
  const column = match.column == null ? "" : `:${match.column}`;
  return `${path}${line}${column}`;
};
</script>

<style scoped>
.command-visual-pre {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--ui-code-border);
  border-radius: 4px;
  background: var(--ui-code-bg);
  color: var(--ui-code-text);
  padding: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.45;
}
</style>
