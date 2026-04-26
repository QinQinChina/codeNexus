<template>
  <div
    class="event simple-file-change-event file-change-card group min-w-0 max-w-full rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-timeline-card-bg)] p-[var(--timeline-card-padding,10px)] shadow-[var(--ui-timeline-card-shadow)]"
    :class="[fileChangeEventClass, modeClass, { 'is-streaming': isRunning }]"
  >
    <div class="file-change-card-header flex w-full min-w-0 items-start gap-2.5 rounded-[4px] px-1.5 pt-1.5 pb-1.5">
      <FileDiff
        class="mt-[3px] h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]"
        aria-hidden="true"
      />
      <div class="file-change-card-main flex min-w-0 flex-1 items-start gap-2.5">
        <div class="mono min-w-0 flex-1 truncate text-[12.5px] text-[var(--text)]" :title="pathTitle">
          {{ pathText }}
        </div>
        <div class="file-change-card-meta mono flex-none whitespace-nowrap pt-[1px] text-[10.5px] text-[var(--text-muted)]">
          <span v-if="diffMeta.kind === 'lines'" class="file-change-line-stats">
            <span class="file-change-line-add">+{{ diffMeta.add }}</span>
            <span class="file-change-line-del">-{{ diffMeta.del }}</span>
          </span>
          <span v-else>{{ diffMeta.text }}</span>
          <span v-if="streamMetaText" class="dim"> &middot; {{ streamMetaText }}</span>
        </div>
      </div>
      <span class="file-change-card-actions inline-flex flex-none items-center gap-1.5">
        <span
          v-if="file"
          class="inline-flex flex-none items-center rounded-[4px] border px-1.5 py-0.5 text-[10px]"
          :class="fileChangeKindClass(file.kind)"
          >{{ fileChangeKindText(file.kind) }}</span
        >
        <span
          class="file-change-status-pill mono inline-flex flex-none items-center rounded-[4px] border px-1.5 py-0.5 text-[10px]"
          :class="statusPillClass"
        >
          <span v-if="isRunning" class="file-change-status-dot" aria-hidden="true"></span>
          {{ statusLabel }}
        </span>
      </span>
    </div>

    <div
      v-if="isRunning || (streamUpdateCount > 0 && statusText !== '已完成')"
      class="file-change-stream-strip mono mx-1.5 mb-1.5 flex min-w-0 items-center gap-2 rounded-[4px] border px-2 py-1 text-[10.5px]"
    >
      <span v-if="isRunning" class="file-change-stream-pulse" aria-hidden="true"></span>
      <WaveText v-if="isRunning" class="min-w-0 flex-1 truncate" :text="streamStripText" />
      <span v-else class="min-w-0 flex-1 truncate">{{ streamStripText }}</span>
      <span class="flex-none text-[var(--text-muted)]">{{ streamCountText }}</span>
    </div>

    <div class="px-1.5 pb-1.5">
      <UnifiedDiffViewer
        v-if="file && file.diffText.trim()"
        :diffText="file.diffText"
        :diffKey="file.pathAbs"
        :filePathHint="file.pathRelTo || file.pathRel || file.pathAbsTo || file.pathAbs"
        :fileKind="file.kind"
        :wrapLines="wrapDiffLines"
        ariaLabel="diff-view"
      />
      <div
        v-else
        class="mono rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-1.5 text-[11px] text-[var(--ui-code-text-muted)]"
      >
        <WaveText v-if="isRunning" class="mono dim" text="正在修改文件…" />
        <template v-else>{{ emptyText }}</template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { FileDiff } from "lucide-vue-next";
import UnifiedDiffViewer from "./UnifiedDiffViewer.vue";
import WaveText from "../../ui/WaveText.vue";
import { getParsedDiffCached } from "../../../features/timeline/renderModel/diff";

export type FileChangeFile = {
  pathAbs: string;
  pathRel: string;
  pathAbsTo?: string | null;
  pathRelTo?: string | null;
  kind: string;
  diffText: string;
  updatedAt: number;
};

const props = withDefaults(
  defineProps<{
    mode?: "timeline" | "chat";
    statusText: string;
    fileChangeEventClass: string;
    file: FileChangeFile | null;
    fileChangeKindClass: (kind: string) => any;
    fileChangeKindText: (kind: string) => string;
    fileChangeDiffMetaText: (diffText: string) => string;
    isRunning?: boolean;
    streamUpdateCount?: number;
    lastPatchUpdatedAt?: number | null;
    settledAt?: number | null;
    wrapDiffLines?: boolean;
  }>(),
  {
    mode: "timeline",
    isRunning: false,
    streamUpdateCount: 0,
    lastPatchUpdatedAt: null,
    settledAt: null,
    wrapDiffLines: true,
  }
);

type DiffMeta = { kind: "lines"; add: number; del: number } | { kind: "text"; text: string };

const countAddedDeletedLines = (diffText: string) => {
  const text = String(diffText ?? "");
  if (!text.trim()) return { add: 0, del: 0 };
  const parsed = getParsedDiffCached(text);
  let add = 0;
  let del = 0;
  for (const line of parsed.lines) {
    if (line.kind === "add") add += 1;
    else if (line.kind === "del") del += 1;
  }
  return { add, del };
};

const pathText = computed(() => {
  if (!props.file) return props.statusText === "进行中" ? "等待文件路径…" : "暂无结构化文件路径";
  const from = String(props.file.pathRel ?? props.file.pathAbs ?? "").trim() || props.file.pathAbs;
  const to = String(props.file.pathRelTo ?? props.file.pathAbsTo ?? "").trim();
  if (props.file.kind === "rename" && to) return `${from} -> ${to}`;
  return from;
});

const pathTitle = computed(() => {
  if (!props.file) return pathText.value;
  const from = String(props.file.pathAbs ?? props.file.pathRel ?? "").trim() || props.file.pathRel;
  const to = String(props.file.pathAbsTo ?? props.file.pathRelTo ?? "").trim();
  if (props.file.kind === "rename" && to) return `${from} -> ${to}`;
  return from;
});

const diffMeta = computed<DiffMeta>(() => {
  if (!props.file) return { kind: "text", text: "--" };
  const stats = countAddedDeletedLines(props.file.diffText);
  if (stats.add > 0 || stats.del > 0) return { kind: "lines", add: stats.add, del: stats.del };
  return { kind: "text", text: props.fileChangeDiffMetaText(props.file.diffText) };
});

const statusLabel = computed(() => {
  const status = String(props.statusText ?? "").trim();
  if (props.isRunning) return props.streamUpdateCount > 0 ? "生成中" : "等待中";
  if (status === "已完成") return "已应用";
  if (status === "失败") return "应用失败";
  if (status === "已拒绝") return "未应用";
  return status || "未知";
});

const streamMetaText = computed(() => {
  if (props.isRunning) {
    if (props.streamUpdateCount > 0) return `更新 ${props.streamUpdateCount} 次`;
    return "等待 diff";
  }
  if (props.streamUpdateCount > 0 && props.statusText !== "已完成") return `${props.streamUpdateCount} 次更新`;
  return "";
});

const emptyText = computed(() => {
  if (!props.file) return props.statusText === "进行中" ? "等待结构化文件变更内容…" : "暂无结构化文件变更内容";
  return "暂无 diff 内容";
});

const isRunning = computed(() => Boolean(props.isRunning));

const modeClass = computed(() => (props.mode === "chat" ? "file-change-card--chat" : "file-change-card--timeline"));

const statusPillClass = computed(() => {
  if (props.isRunning) return "file-change-status-pill--running";
  if (props.statusText === "已完成") return "file-change-status-pill--completed";
  if (props.statusText === "失败") return "file-change-status-pill--failed";
  if (props.statusText === "已拒绝") return "file-change-status-pill--declined";
  return "file-change-status-pill--unknown";
});

const streamStripText = computed(() => {
  if (props.isRunning) {
    if (!props.file) return "正在解析补丁…";
    return props.streamUpdateCount > 0 ? "正在生成变更…" : "等待结构化 diff…";
  }
  if (props.statusText === "已完成") return "补丁已应用";
  if (props.statusText === "失败") return "补丁应用失败";
  if (props.statusText === "已拒绝") return "补丁未应用";
  return "补丁状态已更新";
});

const streamCountText = computed(() => {
  if (props.streamUpdateCount <= 0) return "live";
  return `${props.streamUpdateCount} updates`;
});

</script>

<style scoped>
.simple-file-change-event {
  --file-change-add-fg: color-mix(in srgb, var(--success, var(--fg-success)) 66%, var(--text-muted, var(--text)) 34%);
  --file-change-del-fg: color-mix(in srgb, var(--danger, var(--fg-danger)) 66%, var(--text-muted, var(--text)) 34%);
}

.file-change-line-stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

:global(.timeline-pane--chat) .file-change-line-stats {
  font-weight: 700;
  letter-spacing: 0.01em;
}

.file-change-line-add {
  color: var(--file-change-add-fg);
}

.file-change-line-del {
  color: var(--file-change-del-fg);
}

.file-change-card {
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.file-change-card--chat {
  --timeline-card-padding: 6px;
}

.file-change-card--chat .file-change-card-header {
  align-items: center;
  gap: 8px;
}

.file-change-card--chat .file-change-card-main {
  align-items: center;
  gap: 8px;
}

.file-change-card--chat .file-change-card-actions {
  margin-left: 2px;
}

.file-change-card--chat .file-change-card-meta {
  padding-top: 0;
}

.file-change-card.is-streaming {
  box-shadow:
    var(--ui-timeline-card-shadow),
    inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.file-change-status-pill {
  gap: 5px;
  color: var(--text-muted);
  border-color: color-mix(in srgb, var(--text-muted) 22%, transparent);
  background: color-mix(in srgb, var(--ui-well-bg) 72%, transparent);
}

.file-change-status-pill--running {
  color: color-mix(in srgb, var(--accent) 76%, var(--text) 24%);
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, var(--ui-well-bg));
}

.file-change-status-pill--completed {
  color: var(--file-change-add-fg);
  border-color: color-mix(in srgb, var(--success, var(--fg-success)) 32%, transparent);
}

.file-change-status-pill--failed {
  color: var(--file-change-del-fg);
  border-color: color-mix(in srgb, var(--danger, var(--fg-danger)) 36%, transparent);
}

.file-change-status-pill--declined {
  color: var(--warning, var(--fg-warning));
  border-color: color-mix(in srgb, var(--warning, var(--fg-warning)) 34%, transparent);
}

.file-change-status-dot,
.file-change-stream-pulse {
  display: inline-block;
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 999px;
  background: currentColor;
  animation: file-change-stream-pulse 1.25s ease-in-out infinite;
}

.file-change-stream-strip {
  color: color-mix(in srgb, var(--accent) 76%, var(--text) 24%);
  border-color: color-mix(in srgb, var(--accent) 24%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, var(--ui-well-bg));
}

@keyframes file-change-stream-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: scale(0.88);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .file-change-card,
  .file-change-status-dot,
  .file-change-stream-pulse {
    animation: none;
    transition: none;
  }
}
</style>
