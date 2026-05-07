<template>
  <div class="chat-tool-wrap command-activity-wrap w-full max-w-full min-w-0">
    <article class="command-activity" :class="activityClass" :aria-busy="isRunning" tabindex="0">
      <div class="command-activity-line">
        <span class="command-activity-icon-wrap" aria-hidden="true">
          <AlertTriangle v-if="item.status === 'failed'" class="command-activity-icon" />
          <FileText v-else-if="kind === 'read'" class="command-activity-icon" />
          <ListTree v-else-if="kind === 'list'" class="command-activity-icon" />
          <Search v-else class="command-activity-icon" />
        </span>

        <WaveText
          class="command-activity-wave"
          :text="activityText"
          :enabled="isRunning"
          color="var(--command-activity-wave-color)"
          :char-delay-sec="0.045"
          :char-anim-duration-sec="0.78"
          :pause-sec="0.5"
          :min-opacity="isRunning ? 0.34 : 0.72"
          :max-opacity="1"
        />
        <span v-if="metaText" class="command-activity-meta mono">{{ metaText }}</span>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, FileText, ListTree, Search } from "lucide-vue-next";
import type {
  CommandListNode,
  CommandReadNode,
  CommandSearchNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";
import WaveText from "../../ui/WaveText.vue";

type CommandActivityKind = "read" | "list" | "search";
type CommandActivityItem = CommandReadNode | CommandListNode | CommandSearchNode;

const props = withDefaults(
  defineProps<{
    kind: CommandActivityKind;
    item: CommandActivityItem;
  }>(),
  {}
);

const readItem = computed(() => props.item as CommandReadNode);
const listItem = computed(() => props.item as CommandListNode);
const searchItem = computed(() => props.item as CommandSearchNode);
const isRunning = computed(() => props.item.status === "running");

const basename = (value: string) =>
  String(value ?? "")
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop() ?? "";

const fileLabel = computed(
  () => readItem.value.name || basename(readItem.value.path) || readItem.value.path || "读取内容"
);
const readPathText = computed(() => readItem.value.path || fileLabel.value);
const listScopeText = computed(() => listItem.value.path || "当前目录");
const searchScopeText = computed(() => searchItem.value.path || "");
const queryText = computed(() => searchItem.value.query || "搜索");

const activityText = computed(() => {
  if (props.kind === "read") {
    const suffix = readPathText.value ? ` ${readPathText.value}` : "";
    if (props.item.status === "running") return `正在读取${suffix}`;
    if (props.item.status === "failed") return `读取失败${suffix}`;
    return `已读取${suffix}`;
  }

  if (props.kind === "list") {
    const scope = listScopeText.value;
    if (props.item.status === "running") return `正在列出文件：${scope}`;
    if (props.item.status === "failed") return `列出文件失败：${scope}`;
    return `已列出 ${listItem.value.filesCount} 项：${scope}`;
  }

  const scope = searchScopeText.value ? `：${searchScopeText.value}` : "";
  if (props.item.status === "running") return `正在搜索 "${queryText.value}"${scope}`;
  if (props.item.status === "failed") return `搜索失败："${queryText.value}"${scope}`;
  return `已找到 ${searchItem.value.matchCount} 条："${queryText.value}"${scope}`;
});

const metaText = computed(() => {
  if (props.kind === "read") return "";
  if (props.kind === "list") return `${listItem.value.filesCount} 项`;
  return "";
});

const activityClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-failed": props.item.status === "failed",
  "is-completed": props.item.status === "completed",
  "is-read": props.kind === "read",
  "is-list": props.kind === "list",
  "is-search": props.kind === "search",
}));
</script>

<style scoped>
:global(.timeline-pane--chat .chat-tool-wrap > .command-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

:global(:root[data-theme="light"] .timeline-pane--chat .chat-tool-wrap > .command-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.command-activity {
  --command-activity-wave-color: color-mix(in srgb, var(--text-muted) 78%, var(--text) 22%);
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 1px 2px;
  color: var(--text-muted);
  outline: none;
}

.command-activity.is-running {
  --command-activity-wave-color: color-mix(in srgb, var(--fg-accent) 80%, var(--text) 20%);
}

.command-activity.is-failed {
  --command-activity-wave-color: color-mix(in srgb, var(--fg-danger) 72%, var(--text) 28%);
}

.command-activity-line {
  display: inline-flex;
  justify-self: start;
  width: auto;
  max-width: 100%;
  min-width: 0;
  min-height: 20px;
  align-items: center;
  gap: 5px;
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.command-activity:focus-visible .command-activity-line {
  outline: 1px solid color-mix(in srgb, var(--border-accent) 66%, transparent);
  outline-offset: 3px;
}

.command-activity-icon-wrap {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: color-mix(in srgb, var(--text-muted) 78%, var(--text) 22%);
}

.command-activity.is-running .command-activity-icon-wrap {
  color: var(--fg-accent);
}

.command-activity.is-failed .command-activity-icon-wrap {
  color: var(--fg-danger);
}

.command-activity-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.1;
}

.command-activity-wave {
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

.command-activity-meta,
.command-activity-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
}

@media (max-width: 640px) {
  .command-activity-line {
    align-items: center;
    gap: 6px;
  }

  .command-activity-wave {
    max-width: 100%;
  }

  .command-activity-meta {
    display: none;
  }
}
</style>
