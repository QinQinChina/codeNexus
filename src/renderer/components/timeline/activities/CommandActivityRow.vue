<template>
  <div class="chat-tool-wrap command-activity-wrap w-full max-w-full min-w-0">
    <article
      class="command-activity"
      :class="activityClass"
      :aria-busy="isRunning"
      tabindex="0"
      @pointerenter="openPopover"
      @pointerleave="closePopover"
      @pointermove="updatePopover"
      @focusin="openPopover"
      @focusout="closePopover"
    >
      <div class="command-activity-line" :ref="setAnchor" @pointerenter="openPopover" @pointermove="updatePopover">
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

        <span v-if="isRunning" class="command-activity-running-dot" aria-hidden="true"></span>
        <span v-if="metaText" class="command-activity-meta mono">{{ metaText }}</span>
      </div>

      <div
        class="command-activity-popover"
        :class="{ 'is-open': popoverOpen }"
        role="tooltip"
        :ref="setPopover"
        :style="popoverStyle"
      >
        <div class="command-activity-popover-head">
          <span class="command-activity-popover-title">{{ popoverTitle }}</span>
          <span class="command-activity-status">{{ statusText }}</span>
        </div>

        <div v-for="detail in details" :key="detail.label" class="command-activity-detail" :title="detail.value">
          <span class="command-activity-detail-label">{{ detail.label }}</span>
          <span class="command-activity-detail-value">{{ detail.value }}</span>
        </div>

        <pre v-if="readPreviewText" class="command-activity-preview app-scrollbar mono">{{ readPreviewText }}</pre>

        <div v-if="kind === 'list'" class="command-activity-list app-scrollbar mono">
          <div v-for="file in visibleFiles" :key="`${item.id}:file:${file}`" class="command-activity-list-row">
            {{ file }}
          </div>
          <div v-if="listRemaining > 0" class="command-activity-more">还有 {{ listRemaining }} 项未展示</div>
          <div v-if="visibleFiles.length === 0" class="command-activity-empty">无文件</div>
        </div>

        <div v-if="kind === 'search'" class="command-activity-matches app-scrollbar mono">
          <div
            v-for="match in visibleMatches"
            :key="`${item.id}:match:${match.path}:${match.line}:${match.column}:${match.text}`"
            class="command-activity-match"
          >
            <div class="command-activity-match-location" :title="searchMatchLocation(match)">
              {{ searchMatchLocation(match) }}
            </div>
            <div class="command-activity-match-text">{{ match.text || "-" }}</div>
          </div>
          <div v-if="searchRemaining > 0" class="command-activity-more">还有 {{ searchRemaining }} 条未展示</div>
          <div v-if="visibleMatches.length === 0" class="command-activity-empty">无匹配</div>
        </div>

        <pre v-if="failurePreviewText" class="command-activity-preview app-scrollbar mono">{{ failurePreviewText }}</pre>

        <div v-if="commandText" class="command-activity-command mono" :title="commandText">{{ commandText }}</div>
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
  CommandSearchMatch,
  CommandSearchNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";
import WaveText from "../../ui/WaveText.vue";
import { useAnchoredPopover } from "../../ui/useAnchoredPopover";

type CommandActivityKind = "read" | "list" | "search";
type CommandActivityItem = CommandReadNode | CommandListNode | CommandSearchNode;

const props = withDefaults(
  defineProps<{
    kind: CommandActivityKind;
    item: CommandActivityItem;
  }>(),
  {}
);

const listPreviewLimit = 12;
const searchPreviewLimit = 8;

const readItem = computed(() => props.item as CommandReadNode);
const listItem = computed(() => props.item as CommandListNode);
const searchItem = computed(() => props.item as CommandSearchNode);
const isRunning = computed(() => props.item.status === "running");

const basename = (value: string) =>
  String(value ?? "")
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop() ?? "";

const normalizeLine = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.floor(value));
};

const fileLabel = computed(() => readItem.value.name || basename(readItem.value.path) || readItem.value.path || "读取内容");
const readPathText = computed(() => readItem.value.path || fileLabel.value);
const listScopeText = computed(() => listItem.value.path || "当前目录");
const searchScopeText = computed(() => searchItem.value.path || "");
const queryText = computed(() => searchItem.value.query || "搜索");
const commandText = computed(() => props.item.commandFull || "");

const lineRangeText = computed(() => {
  if (props.kind !== "read") return "";
  const start = normalizeLine(readItem.value.startLine) ?? 1;
  const explicitEnd = normalizeLine(readItem.value.endLine);
  const fallbackEnd = readItem.value.lineCount > 0 ? Math.max(start, start + readItem.value.lineCount - 1) : start;
  const end = explicitEnd ?? fallbackEnd;
  return `L${start}-${end}`;
});

const statusText = computed(() => {
  if (props.item.status === "running") return runningStatusText.value;
  if (props.item.status === "failed") return failedStatusText.value;
  if (props.item.status === "completed") return completedStatusText.value;
  return "未知";
});

const runningStatusText = computed(() => {
  if (props.kind === "read") return "读取中";
  if (props.kind === "list") return "列出中";
  return "搜索中";
});

const completedStatusText = computed(() => {
  if (props.kind === "read") return "已读取";
  if (props.kind === "list") return "已列出";
  return "已搜索";
});

const failedStatusText = computed(() => {
  if (props.kind === "read") return "读取失败";
  if (props.kind === "list") return "列出失败";
  return "搜索失败";
});

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

const popoverTitle = computed(() => {
  if (props.kind === "read") return `${statusText.value} ${fileLabel.value}`;
  if (props.kind === "list") return `${statusText.value}文件`;
  return `${statusText.value} "${queryText.value}"`;
});

const durationText = computed(() => {
  if (props.kind !== "read" || readItem.value.durationMs == null) return "";
  return `${readItem.value.durationMs}ms`;
});

const details = computed(() => {
  if (props.kind === "read") {
    return [
      { label: "文件", value: readPathText.value },
      { label: "范围", value: lineRangeText.value },
      { label: "行数", value: readItem.value.lineCount > 0 ? `${readItem.value.lineCount} 行` : "-" },
      ...(durationText.value ? [{ label: "耗时", value: durationText.value }] : []),
    ];
  }

  if (props.kind === "list") {
    return [
      { label: "范围", value: listScopeText.value },
      { label: "数量", value: `${listItem.value.filesCount} 项` },
    ];
  }

  return [
    { label: "关键词", value: queryText.value },
    { label: "范围", value: searchScopeText.value || "当前目录" },
    { label: "匹配", value: `${searchItem.value.matchCount} 条` },
  ];
});

const readPreviewText = computed(() => {
  if (props.kind !== "read" || readItem.value.previewLines.length === 0) return "";
  return readItem.value.previewLines.join("\n");
});

const visibleFiles = computed(() => {
  if (props.kind !== "list") return [];
  return listItem.value.files.slice(0, listPreviewLimit);
});

const listRemaining = computed(() => {
  if (props.kind !== "list") return 0;
  return Math.max(0, listItem.value.filesCount - visibleFiles.value.length);
});

const visibleMatches = computed(() => {
  if (props.kind !== "search") return [];
  return searchItem.value.matches.slice(0, searchPreviewLimit);
});

const searchRemaining = computed(() => {
  if (props.kind !== "search") return 0;
  return Math.max(0, searchItem.value.matchCount - visibleMatches.value.length);
});

const failurePreviewText = computed(() => {
  if (props.item.status !== "failed" || !props.item.outputFull) return "";
  return props.item.outputFull.split(/\r?\n/).slice(0, 4).join("\n");
});

const activityClass = computed(() => ({
  "is-running": props.item.status === "running",
  "is-failed": props.item.status === "failed",
  "is-completed": props.item.status === "completed",
  "is-read": props.kind === "read",
  "is-list": props.kind === "list",
  "is-search": props.kind === "search",
}));

const searchMatchLocation = (match: CommandSearchMatch) => {
  const path = match.path || "输出";
  const line = match.line == null ? "" : `:${match.line}`;
  const column = match.column == null ? "" : `:${match.column}`;
  return `${path}${line}${column}`;
};

const {
  open: popoverOpen,
  popoverStyle,
  setAnchor,
  setPopover,
  openPopover,
  closePopover,
  updatePopover,
} = useAnchoredPopover({ prefer: "below", marginPx: 10, gapPx: 6 });
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

.command-activity-running-dot {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--fg-accent);
  opacity: 0.78;
  animation: command-activity-pulse 900ms ease-in-out infinite;
}

.command-activity-meta,
.command-activity-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
}

.command-activity-popover {
  position: fixed;
  z-index: 1200;
  display: grid;
  width: min(580px, calc(100vw - 48px));
  max-width: calc(100vw - 48px);
  min-width: min(360px, calc(100vw - 48px));
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface-1) 98%, var(--bg) 2%);
  box-shadow:
    0 10px 26px color-mix(in srgb, var(--theme-seed-canvas-deep) 46%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-3px);
  transition:
    opacity 130ms ease,
    transform 130ms ease;
}

.command-activity-popover.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.command-activity-popover-head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.command-activity-popover-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-activity-status {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 82%, var(--text) 18%);
  font-size: 11px;
  line-height: 1;
}

.is-failed .command-activity-status {
  color: color-mix(in srgb, var(--fg-danger) 76%, var(--text) 24%);
}

.command-activity-detail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.command-activity-detail-label {
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  white-space: nowrap;
}

.command-activity-detail-value {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted) 12%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-activity-preview {
  max-height: 180px;
  overflow: auto;
  margin: 0;
  border: 1px solid var(--ui-code-border);
  border-radius: 5px;
  background: color-mix(in srgb, var(--ui-code-bg) 88%, transparent);
  color: color-mix(in srgb, var(--ui-code-text) 86%, var(--text-muted) 14%);
  padding: 7px 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.42;
}

.command-activity-list,
.command-activity-matches {
  display: grid;
  max-height: 220px;
  min-width: 0;
  gap: 4px;
  overflow: auto;
  color: color-mix(in srgb, var(--text) 86%, var(--text-muted) 14%);
  font-size: 11px;
  line-height: 1.45;
}

.command-activity-list-row {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-activity-match {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 210px) minmax(0, 1fr);
  gap: 8px;
  border: 1px solid var(--ui-well-border);
  border-radius: 5px;
  background: color-mix(in srgb, var(--ui-well-bg) 82%, transparent);
  padding: 5px 7px;
}

.command-activity-match-location {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-activity-match-text {
  min-width: 0;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted) 12%);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.command-activity-more,
.command-activity-empty {
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
}

.command-activity-command {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-muted) 82%, transparent);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes command-activity-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: scale(0.86);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .command-activity-running-dot,
  .command-activity-popover {
    animation: none;
    transition: none;
  }
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

  .command-activity-popover {
    width: min(580px, calc(100vw - 20px));
    max-width: calc(100vw - 20px);
    min-width: 0;
  }

  .command-activity-match {
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
  }
}
</style>
