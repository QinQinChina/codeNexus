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
        <div
          class="file-change-card-meta mono flex-none whitespace-nowrap pt-[1px] text-[10.5px] text-[var(--text-muted)]"
        >
          <span v-if="diffMeta.kind === 'lines'" class="file-change-line-stats">
            <span class="file-change-line-count file-change-line-add" :aria-label="`新增 ${diffMeta.add} 行`">
              <span class="file-change-line-count-prefix">+</span>
              <span class="file-change-line-count-value" aria-hidden="true">
                <Transition name="file-change-count-roll">
                  <span :key="diffMeta.add" class="file-change-line-count-number">{{ diffMeta.add }}</span>
                </Transition>
              </span>
            </span>
            <span class="file-change-line-count file-change-line-del" :aria-label="`删除 ${diffMeta.del} 行`">
              <span class="file-change-line-count-prefix">-</span>
              <span class="file-change-line-count-value" aria-hidden="true">
                <Transition name="file-change-count-roll">
                  <span :key="diffMeta.del" class="file-change-line-count-number">{{ diffMeta.del }}</span>
                </Transition>
              </span>
            </span>
          </span>
          <span v-else>{{ diffMeta.text }}</span>
          <span v-if="streamMetaText" class="dim"> &middot; {{ streamMetaText }}</span>
        </div>
      </div>
      <span class="file-change-card-actions inline-flex flex-none items-center gap-1.5">
        <button
          v-if="hasDiff"
          type="button"
          class="file-change-toggle mono inline-flex h-[20px] flex-none items-center justify-center rounded-[4px] border px-1.5 text-[10px] leading-none"
          :title="isDiffExpanded ? '收起 diff' : '展开 diff'"
          :aria-expanded="isDiffExpanded ? 'true' : 'false'"
          @click="isDiffExpanded = !isDiffExpanded"
        >
          {{ isDiffExpanded ? "收起" : "展开" }}
        </button>
        <span
          v-if="file"
          class="inline-flex flex-none items-center rounded-[4px] border px-1.5 py-0.5 text-[10px]"
          :class="fileChangeKindClass(file.kind)"
          >{{ fileChangeKindText(file.kind) }}</span
        >
      </span>
    </div>

    <div
      v-if="isRunning"
      class="file-change-stream-strip mono mx-1.5 mb-1.5 flex min-w-0 items-center gap-2 rounded-[4px] border px-2 py-1 text-[10.5px]"
    >
      <ExecutionWaveText class="min-w-0 flex-1 truncate" :text="streamStripText" :cycle-max-chars="96" />
      <span class="flex-none text-[var(--text-muted)]">{{ streamCountText }}</span>
    </div>

    <div v-if="shouldShowDiffBody" class="px-1.5 pb-1.5">
      <UnifiedDiffViewer
        v-if="shouldShowDiffViewer && file"
        :diffText="file.diffText"
        :diffKey="file.pathAbs"
        :filePathHint="file.pathRelTo || file.pathRel || file.pathAbsTo || file.pathAbs"
        :fileKind="file.kind"
        maxHeightClass="max-h-[340px]"
        :wrapLines="wrapDiffLines"
        ariaLabel="diff-view"
      />
      <div
        v-else
        class="mono rounded-[4px] border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-1.5 text-[11px] text-[var(--ui-code-text-muted)]"
      >
        <ExecutionWaveText class="mono" text="正在修改文件…" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FileDiff } from "lucide-vue-next";
import UnifiedDiffViewer from "./UnifiedDiffViewer.vue";
import ExecutionWaveText from "../../ui/ExecutionWaveText.vue";
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

const isDiffExpanded = ref(false);

const hasDiff = computed(() => Boolean(props.file?.diffText?.trim()));

const isRunning = computed(() => Boolean(props.isRunning));

const shouldShowDiffViewer = computed(() => hasDiff.value && isDiffExpanded.value);

const shouldShowStreamingPlaceholder = computed(() => !hasDiff.value && isRunning.value);

const shouldShowDiffBody = computed(() => shouldShowDiffViewer.value || shouldShowStreamingPlaceholder.value);

const streamMetaText = computed(() => {
  if (props.isRunning) {
    if (props.streamUpdateCount > 0) return `更新 ${props.streamUpdateCount} 次`;
    return "等待 diff";
  }
  if (props.streamUpdateCount > 0 && props.statusText !== "已完成") return `${props.streamUpdateCount} 次更新`;
  return "";
});

const modeClass = computed(() => (props.mode === "chat" ? "file-change-card--chat" : "file-change-card--timeline"));

const streamStripText = computed(() => {
  if (props.isRunning) {
    if (!props.file) return "正在解析补丁…";
    return props.streamUpdateCount > 0 ? "正在生成变更…" : "等待结构化 diff…";
  }
  return "补丁状态已更新";
});

const streamCountText = computed(() => {
  if (props.streamUpdateCount <= 0) return "live";
  return `${props.streamUpdateCount} updates`;
});

watch(
  () => [props.file?.pathAbs ?? "", props.file?.pathAbsTo ?? ""],
  () => {
    isDiffExpanded.value = false;
  }
);
</script>

<style scoped>
.simple-file-change-event {
  --file-change-add-fg: color-mix(in srgb, var(--success, var(--fg-success)) 86%, var(--text) 14%);
  --file-change-del-fg: color-mix(in srgb, var(--danger, var(--fg-danger)) 86%, var(--text) 14%);
}

.file-change-line-stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.file-change-line-count {
  display: inline-flex;
  align-items: baseline;
  gap: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.file-change-line-count-prefix {
  flex: none;
}

.file-change-line-count-value {
  position: relative;
  display: inline-grid;
  min-width: 2.5ch;
  height: 1em;
  overflow: hidden;
  text-align: right;
}

.file-change-line-count-number {
  grid-area: 1 / 1;
  min-width: 100%;
  text-align: right;
}

.file-change-count-roll-enter-active,
.file-change-count-roll-leave-active {
  transition:
    transform 180ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 140ms ease-out;
}

.file-change-count-roll-leave-active {
  position: absolute;
  inset: 0;
}

.file-change-count-roll-enter-from {
  opacity: 0;
  transform: translateY(72%);
}

.file-change-count-roll-leave-to {
  opacity: 0;
  transform: translateY(-72%);
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

.file-change-toggle {
  color: var(--text-muted);
  border-color: color-mix(in srgb, var(--text-muted) 22%, transparent);
  background: color-mix(in srgb, var(--ui-well-bg) 72%, transparent);
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.file-change-toggle:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--accent) 9%, var(--ui-well-bg));
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
  .file-change-stream-pulse,
  .file-change-count-roll-enter-active,
  .file-change-count-roll-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
