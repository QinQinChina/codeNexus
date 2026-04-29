<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <div
      class="chat-read-file-card inline-flex max-w-full min-w-0 items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-[13px] shadow-[var(--shadow-soft)]"
      :class="cardClass"
      :title="titleText"
    >
      <span class="chat-read-file-card__verb flex-none font-semibold">Read</span>
      <span class="chat-read-file-card__path min-w-0 truncate">{{ fileLabel }}</span>
      <span class="chat-read-file-card__range flex-none mono">{{ lineRangeText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CommandReadNode } from "../../features/timeline/renderModel/buildTimelineNodes";

const props = defineProps<{
  item: CommandReadNode;
}>();

const basename = (value: string) =>
  String(value ?? "")
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop() ?? "";

const fileLabel = computed(() => props.item.name || basename(props.item.path) || props.item.path || "读取内容");

const normalizeLine = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.max(1, Math.floor(value));
  return rounded;
};

const lineRangeText = computed(() => {
  const start = normalizeLine(props.item.startLine) ?? 1;
  const explicitEnd = normalizeLine(props.item.endLine);
  const fallbackEnd = props.item.lineCount > 0 ? Math.max(start, start + props.item.lineCount - 1) : start;
  const end = explicitEnd ?? fallbackEnd;
  return `L${start}-${end}`;
});

const titleText = computed(() => {
  const path = props.item.path || fileLabel.value;
  const status = props.item.status === "running" ? "读取中" : props.item.status === "failed" ? "读取失败" : "已读取";
  return `${status} ${path} ${lineRangeText.value}`;
});

const cardClass = computed(() => {
  if (props.item.status === "failed") return "chat-read-file-card--failed";
  if (props.item.status === "running") return "chat-read-file-card--running";
  if (props.item.status === "completed") return "chat-read-file-card--completed";
  return "chat-read-file-card--unknown";
});
</script>

<style scoped>
.chat-read-file-card {
  width: fit-content;
  background: color-mix(in srgb, var(--card-bg) 82%, transparent);
  border-color: color-mix(in srgb, var(--card-border) 86%, transparent);
  color: color-mix(in srgb, var(--text) 86%, var(--text-muted) 14%);
  line-height: 1.35;
}

.chat-read-file-card__verb {
  color: color-mix(in srgb, var(--fg-accent) 74%, var(--text) 26%);
}

.chat-read-file-card__path,
.chat-read-file-card__range {
  color: color-mix(in srgb, var(--text-muted) 82%, var(--text) 18%);
}

.chat-read-file-card--running {
  border-color: color-mix(in srgb, var(--border-accent) 48%, var(--card-border) 52%);
  background: color-mix(in srgb, var(--bg-accent-soft) 22%, var(--card-bg) 78%);
}

.chat-read-file-card--completed {
  border-color: color-mix(in srgb, var(--border-success) 28%, var(--card-border) 72%);
}

.chat-read-file-card--failed {
  border-color: color-mix(in srgb, var(--border-danger) 46%, var(--card-border) 54%);
  background: color-mix(in srgb, var(--bg-danger-soft) 18%, var(--card-bg) 82%);
}

.chat-read-file-card--failed .chat-read-file-card__verb {
  color: color-mix(in srgb, var(--fg-danger) 78%, var(--text) 22%);
}

.chat-read-file-card--unknown {
  opacity: 0.86;
}
</style>