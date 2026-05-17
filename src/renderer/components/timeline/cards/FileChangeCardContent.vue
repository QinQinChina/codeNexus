<template>
  <div
    class="event simple-file-change-event file-change-card group min-w-0 max-w-full rounded-[4px] border border-[var(--ui-well-border)] bg-[var(--ui-timeline-card-bg)] p-[var(--file-change-card-padding,var(--timeline-card-padding,10px))] shadow-[var(--ui-timeline-card-shadow)]"
    :class="[fileChangeEventClass, modeClass, { 'is-streaming': isRunning }]"
  >
    <div class="file-change-card-header flex w-full min-w-0 items-start gap-2.5 rounded-[4px] px-1 py-1">
      <FileDiff
        class="mt-[3px] h-[13px] w-[13px] flex-none text-[color:var(--accent)] [stroke-width:2.2]"
        aria-hidden="true"
      />
      <div class="file-change-card-main flex min-w-0 flex-1 items-start gap-2.5">
        <div class="mono min-w-0 flex-1 truncate text-[12.5px] text-[var(--text)]">
          {{ pathText }}
        </div>
        <div
          class="file-change-card-meta mono flex-none whitespace-nowrap pt-[1px] text-[10.5px] text-[var(--text-muted)]"
        >
          <span v-if="diffMeta.kind === 'lines'" class="file-change-line-stats">
            <span
              class="file-change-line-count file-change-line-add"
              :class="{ 'is-zero': diffMeta.add === 0 }"
              :aria-label="`新增 ${diffMeta.add} 行`"
            >
              <span class="file-change-line-count-prefix">+</span>
              <span class="file-change-line-count-value" aria-hidden="true">
                <Transition name="file-change-count-roll">
                  <span :key="diffMeta.add" class="file-change-line-count-number">{{ diffMeta.add }}</span>
                </Transition>
              </span>
            </span>
            <span
              class="file-change-line-count file-change-line-del"
              :class="{ 'is-zero': diffMeta.del === 0 }"
              :aria-label="`删除 ${diffMeta.del} 行`"
            >
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
      class="file-change-stream-strip mono mx-1 mb-1 flex min-w-0 items-center gap-2 rounded-[4px] border px-1.5 py-1 text-[10.5px]"
    >
      <span class="file-change-stream-beacon" aria-hidden="true"></span>
      <div class="min-w-0 flex-1">
        <ExecutionWaveText class="min-w-0 truncate" :text="streamStripText" :cycle-max-chars="96" />
        <span class="file-change-stream-rail" aria-hidden="true">
          <span class="file-change-stream-rail-fill" :style="{ width: streamRailWidth }"></span>
        </span>
      </div>
      <span v-if="diffMeta.kind === 'lines'" class="file-change-stream-deltas" aria-hidden="true">
        <span class="file-change-stream-delta file-change-stream-delta--add">+{{ diffMeta.add }}</span>
        <span class="file-change-stream-delta file-change-stream-delta--del">-{{ diffMeta.del }}</span>
      </span>
      <span class="file-change-stream-count flex-none">{{ streamCountText }}</span>
    </div>

    <div v-if="shouldShowDiffBody" class="px-1 pb-1">
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
import { getDiffLineStats } from "../../../features/timeline/renderModel/diff";

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
    fileChangeDiffMetaText: (diffText: string, fileKind?: string) => string;
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

const pathText = computed(() => {
  if (!props.file) return props.statusText === "进行中" ? "等待文件路径…" : "暂无结构化文件路径";
  const from = String(props.file.pathRel ?? props.file.pathAbs ?? "").trim() || props.file.pathAbs;
  const to = String(props.file.pathRelTo ?? props.file.pathAbsTo ?? "").trim();
  if (props.file.kind === "rename" && to) return `${from} -> ${to}`;
  return from;
});

const diffMeta = computed<DiffMeta>(() => {
  if (!props.file) return { kind: "text", text: "--" };
  const stats = getDiffLineStats(props.file.diffText, props.file.kind);
  if (stats.add > 0 || stats.del > 0) return { kind: "lines", add: stats.add, del: stats.del };
  return { kind: "text", text: props.fileChangeDiffMetaText(props.file.diffText, props.file.kind) };
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
  if (props.streamUpdateCount <= 0) return "实时";
  return `${props.streamUpdateCount} 次`;
});

const streamRailWidth = computed(() => {
  const updates = Math.max(0, Math.min(9, props.streamUpdateCount));
  return `${28 + updates * 7}%`;
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
  gap: 5px;
}

.file-change-line-count {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  min-width: 5.5ch;
  justify-content: flex-end;
  border-radius: 3px;
  padding: 2px 4px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  background: color-mix(in srgb, currentColor 9%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent);
}

.file-change-line-count.is-zero {
  opacity: 0.48;
}

.file-change-line-count-prefix {
  flex: none;
}

.file-change-line-count-value {
  position: relative;
  display: inline-grid;
  min-width: 2.8ch;
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
  --file-change-card-padding: 7px;

  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.file-change-card--chat {
  --file-change-card-padding: 6px;
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
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent) 10%, transparent),
      transparent 42%,
      color-mix(in srgb, var(--success, var(--fg-success)) 8%, transparent)
    ),
    color-mix(in srgb, var(--ui-well-bg) 86%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
}

.file-change-stream-beacon {
  position: relative;
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 72%, transparent);
}

.file-change-stream-beacon::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--accent) 52%, transparent);
  animation: file-change-beacon-ring 1.35s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.file-change-stream-rail {
  position: relative;
  display: block;
  width: min(220px, 100%);
  height: 2px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.file-change-stream-rail-fill {
  position: absolute;
  inset-block: 0;
  left: 0;
  min-width: 42px;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 42%, transparent),
    color-mix(in srgb, var(--success, var(--fg-success)) 64%, var(--accent) 36%),
    color-mix(in srgb, var(--accent) 34%, transparent)
  );
  animation: file-change-stream-flow 1.05s linear infinite;
}

.file-change-stream-deltas {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.file-change-stream-delta,
.file-change-stream-count {
  display: inline-flex;
  align-items: center;
  height: 18px;
  border-radius: 3px;
  padding: 0 5px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  background: color-mix(in srgb, var(--ui-well-bg) 72%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent);
}

.file-change-stream-delta--add {
  color: var(--file-change-add-fg);
}

.file-change-stream-delta--del {
  color: var(--file-change-del-fg);
}

.file-change-stream-count {
  color: color-mix(in srgb, var(--text-muted) 88%, var(--accent) 12%);
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

@keyframes file-change-beacon-ring {
  0% {
    opacity: 0.62;
    transform: scale(0.72);
  }
  100% {
    opacity: 0;
    transform: scale(1.65);
  }
}

@keyframes file-change-stream-flow {
  0% {
    filter: brightness(0.92);
    transform: translateX(-10%);
  }
  50% {
    filter: brightness(1.16);
  }
  100% {
    filter: brightness(0.92);
    transform: translateX(10%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .file-change-card,
  .file-change-status-dot,
  .file-change-stream-pulse,
  .file-change-stream-beacon::after,
  .file-change-stream-rail-fill,
  .file-change-count-roll-enter-active,
  .file-change-count-roll-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
