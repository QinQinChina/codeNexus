<template>
  <article
    class="event simple-file-change-event file-change-card group min-w-0 max-w-full"
    :class="[fileChangeEventClass(item), modeClass, stateClass]"
    :aria-busy="isRunning"
  >
    <header class="file-change-card-summary">
      <span class="file-change-card-mark" aria-hidden="true">
        <FileDiff class="file-change-card-icon" />
      </span>

      <div class="file-change-card-copy">
        <div class="file-change-card-title-line">
          <span class="file-change-card-title">文件变更</span>
          <span class="file-change-status mono" :class="statusClass">{{ statusText }}</span>
        </div>
        <div class="file-change-card-meta mono">
          <span>{{ filesSummaryText }}</span>
          <span v-if="streamMetaText" class="file-change-card-separator" aria-hidden="true">/</span>
          <span v-if="streamMetaText">{{ streamMetaText }}</span>
        </div>
      </div>

      <div class="file-change-card-total mono" :aria-label="totalLineStatsAriaLabel">
        <span class="file-change-total-stat file-change-total-stat--add">+{{ totalLineStats.add }}</span>
        <span class="file-change-total-stat file-change-total-stat--del">-{{ totalLineStats.del }}</span>
      </div>
    </header>

    <div class="file-change-file-list">
      <section
        v-for="entry in fileEntries"
        :key="entry.key"
        class="file-change-file-item"
        :class="{
          'is-expanded': entry.isExpanded,
          'is-running': isRunning,
          'is-empty': !entry.file,
        }"
      >
        <header class="file-change-file-header">
          <span class="file-change-file-index mono" aria-hidden="true">{{ entry.indexLabel }}</span>

          <div class="file-change-file-main">
            <div class="file-change-path-line">
              <span class="file-change-path mono" :title="entry.pathTitle">{{ entry.pathText }}</span>
              <span
                v-if="entry.file"
                class="file-change-kind-badge"
                :class="fileChangeKindClass(entry.file.kind)"
              >
                {{ fileChangeKindText(entry.file.kind) }}
              </span>
            </div>
            <div class="file-change-file-subline mono">
              <span>{{ entry.statusLineText }}</span>
              <span v-if="entry.secondaryMetaText" class="file-change-card-separator" aria-hidden="true">/</span>
              <span v-if="entry.secondaryMetaText">{{ entry.secondaryMetaText }}</span>
            </div>
          </div>

          <div class="file-change-stat-cluster mono" :aria-label="entry.lineStatsAriaLabel">
            <template v-if="entry.lineStats.kind === 'lines'">
              <span class="file-change-stat file-change-stat--add" :class="{ 'is-zero': entry.lineStats.add === 0 }">
                +{{ entry.lineStats.add }}
              </span>
              <span class="file-change-stat file-change-stat--del" :class="{ 'is-zero': entry.lineStats.del === 0 }">
                -{{ entry.lineStats.del }}
              </span>
            </template>
            <span v-else class="file-change-stat file-change-stat--plain">{{ entry.lineStats.text }}</span>
          </div>

          <button
            v-if="entry.hasDiff"
            type="button"
            class="file-change-expand-button"
            :aria-label="entry.isExpanded ? '收起 diff' : '展开 diff'"
            :aria-expanded="entry.isExpanded ? 'true' : 'false'"
            @click="toggleEntryExpanded(entry.key)"
          >
            <ChevronDown class="file-change-expand-icon" :class="{ 'is-open': entry.isExpanded }" aria-hidden="true" />
            <span class="file-change-expand-text mono">{{ entry.isExpanded ? "收起" : "展开" }}</span>
          </button>
        </header>

        <section v-if="entry.shouldShowDiffBody" class="file-change-diff-body">
          <UnifiedDiffViewer
            v-if="entry.shouldShowDiffViewer && entry.file"
            :diffText="entry.file.diffText"
            :diffKey="entry.file.pathAbs || entry.key"
            :filePathHint="entry.file.pathRelTo || entry.file.pathRel || entry.file.pathAbsTo || entry.file.pathAbs"
            :fileKind="entry.file.kind"
            maxHeightClass="max-h-[340px]"
            :wrapLines="wrapDiffLines"
            :animateUpdates="isRunning"
            ariaLabel="diff-view"
          />
          <div v-else class="file-change-empty-diff mono">
            <ExecutionWaveText class="mono" text="正在修改文件..." />
          </div>
        </section>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, FileDiff } from "lucide-vue-next";
import UnifiedDiffViewer from "./UnifiedDiffViewer.vue";
import ExecutionWaveText from "../../ui/ExecutionWaveText.vue";
import { getDiffLineStats } from "../../../features/timeline/renderModel/diff";
import type { FileChangeFile, FileChangeNode } from "../../../features/timeline/renderModel/buildTimelineNodes";
import {
  fileChangeDiffMetaText,
  fileChangeEventClass,
  fileChangeKindClass,
  fileChangeKindText,
  fileChangeStatusText,
} from "../../../features/timeline/renderModel/formatters";

const props = withDefaults(
  defineProps<{
    item: FileChangeNode;
    mode?: "timeline" | "chat";
    wrapDiffLines?: boolean;
  }>(),
  {
    mode: "timeline",
    wrapDiffLines: true,
  }
);

type LineStats = { kind: "lines"; add: number; del: number } | { kind: "text"; text: string };
type RenderableFile = FileChangeFile | null;

const userExpandedByKey = ref<Record<string, boolean>>({});

const isRunning = computed(() => Boolean(props.item.isStreaming));
const modeClass = computed(() => (props.mode === "chat" ? "file-change-card--chat" : ""));
const statusText = computed(() => fileChangeStatusText(props.item.status));
const statusClass = computed(() => `file-change-status--${props.item.status}`);
const renderableFiles = computed<RenderableFile[]>(() =>
  Array.isArray(props.item.files) && props.item.files.length > 0 ? props.item.files : [null]
);

const fileIdentity = (file: RenderableFile, index: number) => {
  if (!file) return `${props.item.id}:empty:${index}`;
  return [
    props.item.id,
    file.pathAbs || file.pathRel || "unknown",
    file.pathAbsTo || file.pathRelTo || "",
    file.kind,
    index,
  ].join(":");
};

const hasFileDiff = (file: RenderableFile) => Boolean(file?.diffText?.trim());

const pathTextForFile = (file: RenderableFile) => {
  if (!file) return statusText.value === "进行中" ? "等待文件路径..." : "暂无结构化文件路径";
  const from = String(file.pathRel ?? file.pathAbs ?? "").trim() || file.pathAbs;
  const to = String(file.pathRelTo ?? file.pathAbsTo ?? "").trim();
  if (file.kind === "rename" && to) return `${from} -> ${to}`;
  return from;
};

const pathTitleForFile = (file: RenderableFile) => {
  if (!file) return pathTextForFile(file);
  const from = String(file.pathAbs ?? file.pathRel ?? "").trim() || file.pathRel;
  const to = String(file.pathAbsTo ?? file.pathRelTo ?? "").trim();
  if (file.kind === "rename" && to) return `${from} -> ${to}`;
  return from;
};

const lineStatsForFile = (file: RenderableFile): LineStats => {
  if (!file) return { kind: "text", text: "--" };
  const stats = getDiffLineStats(file.diffText, file.kind);
  if (stats.add > 0 || stats.del > 0) return { kind: "lines", add: stats.add, del: stats.del };
  return { kind: "text", text: fileChangeDiffMetaText(file.diffText, file.kind) };
};

const totalLineStats = computed(() =>
  renderableFiles.value.reduce(
    (total, file) => {
      if (!file) return total;
      const stats = getDiffLineStats(file.diffText, file.kind);
      total.add += stats.add;
      total.del += stats.del;
      return total;
    },
    { add: 0, del: 0 }
  )
);

const totalLineStatsAriaLabel = computed(() => `总新增 ${totalLineStats.value.add} 行，总删除 ${totalLineStats.value.del} 行`);

const filesSummaryText = computed(() => {
  const fileCount = props.item.files.length;
  if (fileCount <= 0) return "等待结构化文件变更";
  const parts: string[] = [];
  if (props.item.counts.add) parts.push(`新增 ${props.item.counts.add}`);
  if (props.item.counts.modify) parts.push(`修改 ${props.item.counts.modify}`);
  if (props.item.counts.delete) parts.push(`删除 ${props.item.counts.delete}`);
  if (props.item.counts.rename) parts.push(`重命名 ${props.item.counts.rename}`);
  return parts.length > 0 ? parts.join(" / ") : `${fileCount} 个文件`;
});

const streamMetaText = computed(() => {
  if (isRunning.value) return props.item.streamUpdateCount > 0 ? `更新 ${props.item.streamUpdateCount} 次` : "实时";
  if (props.item.streamUpdateCount > 0 && props.item.status !== "completed") return `更新 ${props.item.streamUpdateCount} 次`;
  return "";
});

const stateClass = computed(() => ({
  "is-streaming": isRunning.value,
  "has-multiple-files": renderableFiles.value.length > 1,
}));

const fileEntries = computed(() =>
  renderableFiles.value.map((file, index) => {
    const key = fileIdentity(file, index);
    const hasDiff = hasFileDiff(file);
    const autoExpanded = isRunning.value && hasDiff;
    const isExpanded = userExpandedByKey.value[key] ?? autoExpanded;
    const lineStats = lineStatsForFile(file);
    const secondaryMetaText = !isRunning.value && props.item.streamUpdateCount > 0 && props.item.status !== "completed"
      ? `更新 ${props.item.streamUpdateCount} 次`
      : "";
    return {
      file,
      key,
      indexLabel: String(index + 1).padStart(2, "0"),
      pathText: pathTextForFile(file),
      pathTitle: pathTitleForFile(file),
      statusLineText: isRunning.value ? "生成中" : statusText.value || "文件变更",
      secondaryMetaText,
      lineStats,
      lineStatsAriaLabel:
        lineStats.kind === "lines" ? `新增 ${lineStats.add} 行，删除 ${lineStats.del} 行` : `diff 规模 ${lineStats.text}`,
      hasDiff,
      isExpanded,
      shouldShowDiffViewer: hasDiff && isExpanded,
      shouldShowDiffBody: (hasDiff && isExpanded) || (!hasDiff && isRunning.value),
    };
  })
);

const toggleEntryExpanded = (key: string) => {
  const entry = fileEntries.value.find((candidate) => candidate.key === key);
  if (!entry) return;
  userExpandedByKey.value = {
    ...userExpandedByKey.value,
    [key]: !entry.isExpanded,
  };
};

watch(
  () => props.item.id,
  () => {
    userExpandedByKey.value = {};
  }
);
</script>

<style scoped>
.simple-file-change-event {
  --file-change-add-fg: color-mix(in srgb, var(--success, var(--fg-success)) 86%, var(--text) 14%);
  --file-change-del-fg: color-mix(in srgb, var(--danger, var(--fg-danger)) 86%, var(--text) 14%);
  --file-change-card-bg: color-mix(in srgb, var(--ui-timeline-card-bg) 94%, var(--ui-well-bg) 6%);

  position: relative;
  overflow: hidden;
  border: 1px solid var(--ui-well-border);
  border-radius: 7px;
  background: var(--file-change-card-bg);
  box-shadow: var(--ui-timeline-card-shadow);
}

.simple-file-change-event::before {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 2px;
  background: color-mix(in srgb, var(--text-muted) 34%, transparent);
}

.file-change-card--chat {
  border-radius: 6px;
}

.file-change-card.is-streaming {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--ui-well-border));
}

.file-change-card.is-streaming::before {
  background: color-mix(in srgb, var(--accent) 82%, var(--text) 18%);
}

.file-change-card-summary {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 8px 12px;
}

.file-change-card-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.file-change-card-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.2;
}

.file-change-card-copy,
.file-change-file-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.file-change-card-title-line,
.file-change-path-line,
.file-change-card-meta,
.file-change-file-subline {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.file-change-card-title {
  color: var(--text);
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.2;
}

.file-change-status {
  display: inline-flex;
  align-items: center;
  height: 18px;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 20%, transparent);
}

.file-change-status--running {
  color: color-mix(in srgb, var(--accent) 78%, var(--text) 22%);
}

.file-change-status--completed {
  color: var(--file-change-add-fg);
}

.file-change-status--failed {
  color: var(--file-change-del-fg);
}

.file-change-status--declined {
  color: var(--warning, var(--fg-warning));
}

.file-change-status--unknown {
  color: var(--text-muted);
}

.file-change-card-meta,
.file-change-file-subline {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1.2;
  white-space: nowrap;
}

.file-change-card-separator {
  opacity: 0.42;
}

.file-change-card-total,
.file-change-stat-cluster {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.file-change-total-stat,
.file-change-stat {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 5ch;
  height: 20px;
  border-radius: 4px;
  padding: 0 5px;
  background: color-mix(in srgb, currentColor 8%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent);
}

.file-change-total-stat--add,
.file-change-stat--add {
  color: var(--file-change-add-fg);
}

.file-change-total-stat--del,
.file-change-stat--del {
  color: var(--file-change-del-fg);
}

.file-change-stat.is-zero {
  opacity: 0.48;
}

.file-change-stat--plain {
  min-width: 0;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--ui-well-bg) 68%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-muted) 18%, transparent);
}

.file-change-file-list {
  display: grid;
  gap: 1px;
  border-top: 1px solid color-mix(in srgb, var(--ui-well-border) 78%, transparent);
  background: color-mix(in srgb, var(--ui-well-border) 55%, transparent);
}

.file-change-file-item {
  min-width: 0;
  background: color-mix(in srgb, var(--file-change-card-bg) 92%, var(--ui-code-bg) 8%);
}

.file-change-file-item.is-expanded {
  background: color-mix(in srgb, var(--file-change-card-bg) 86%, var(--ui-code-bg) 14%);
}

.file-change-file-header {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px 8px 12px;
}

.file-change-file-index {
  color: color-mix(in srgb, var(--text-muted) 70%, transparent);
  font-size: 10px;
  line-height: 1;
}

.file-change-path {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 620;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-change-kind-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 18px;
  border-radius: 4px;
  border-width: 1px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 1;
}

.file-change-expand-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 24px;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent);
  border-radius: 5px;
  padding: 0 7px 0 5px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--ui-well-bg) 58%, transparent);
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.file-change-expand-button:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--ui-well-bg));
}

.file-change-expand-icon {
  width: 13px;
  height: 13px;
  stroke-width: 2.4;
  transition: transform 160ms ease;
}

.file-change-expand-icon.is-open {
  transform: rotate(180deg);
}

.file-change-expand-text {
  font-size: 10px;
  line-height: 1;
}

.file-change-diff-body {
  padding: 0 10px 10px 12px;
}

.file-change-empty-diff {
  border: 1px solid var(--ui-code-border);
  border-radius: 5px;
  background: var(--ui-code-bg);
  padding: 7px 8px;
  color: var(--ui-code-text-muted);
  font-size: 11px;
}

@media (max-width: 640px) {
  .file-change-card-summary,
  .file-change-file-header {
    grid-template-columns: 24px minmax(0, 1fr) auto;
  }

  .file-change-card-total,
  .file-change-stat-cluster {
    grid-column: 2 / -1;
    justify-self: start;
  }

  .file-change-expand-button {
    grid-column: 3;
    grid-row: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .file-change-expand-icon {
    transition: none;
  }
}
</style>
