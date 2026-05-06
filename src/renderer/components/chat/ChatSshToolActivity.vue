<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article
      class="ssh-tool-activity"
      :class="sshActivityClass"
      :aria-busy="isRunning"
      tabindex="0"
      :ref="setAnchor"
      @pointerenter="openPopover"
      @pointerleave="closePopover"
      @pointermove="updatePopover"
      @focusin="openPopover"
      @focusout="closePopover"
    >
      <div class="ssh-tool-line">
        <span class="ssh-tool-icon-wrap" aria-hidden="true">
          <Download v-if="primaryToolKind === 'download'" class="ssh-tool-icon" />
          <Upload v-else-if="primaryToolKind === 'upload'" class="ssh-tool-icon" />
          <Server v-else-if="primaryToolKind === 'servers'" class="ssh-tool-icon" />
          <TerminalSquare v-else class="ssh-tool-icon" />
        </span>

        <WaveText
          class="ssh-tool-wave"
          :text="activityText"
          :enabled="isRunning"
          color="var(--ssh-tool-wave-color)"
          :char-delay-sec="0.045"
          :char-anim-duration-sec="0.78"
          :pause-sec="0.5"
          :min-opacity="isRunning ? 0.34 : 0.72"
          :max-opacity="1"
        />

        <span v-if="isRunning" class="ssh-tool-running-dot" aria-hidden="true"></span>
      </div>

      <div
        class="ssh-tool-popover"
        :class="{ 'is-open': popoverOpen }"
        role="tooltip"
        :ref="setPopover"
        :style="popoverStyle"
      >
        <div class="ssh-tool-popover-head">
          <span class="ssh-tool-popover-title">{{ popoverTitle }}</span>
          <span class="ssh-tool-status">{{ statusText }}</span>
        </div>

        <div class="ssh-tool-detail">
          <span class="ssh-tool-detail-label">工具</span>
          <span class="ssh-tool-detail-value">{{ primaryItem.tool || "SSH" }}</span>
        </div>

        <div class="ssh-tool-detail">
          <span class="ssh-tool-detail-label">服务器</span>
          <span class="ssh-tool-detail-value">{{ serverText }}</span>
        </div>

        <div v-if="targetText" class="ssh-tool-detail" :title="targetText">
          <span class="ssh-tool-detail-label">{{ targetLabel }}</span>
          <span class="ssh-tool-detail-value">{{ targetText }}</span>
        </div>

        <div v-if="metricText" class="ssh-tool-detail">
          <span class="ssh-tool-detail-label">耗时</span>
          <span class="ssh-tool-detail-value">{{ metricText }}</span>
        </div>

        <div class="ssh-tool-summary-list">
          <div v-for="item in visibleItems" :key="item.id" class="ssh-tool-summary-item">
            <span class="ssh-tool-summary-name mono">{{ item.tool || "ssh" }}</span>
            <span class="ssh-tool-summary-text" :title="itemSummary(item)">{{ itemSummary(item) }}</span>
          </div>
          <div v-if="hiddenItemCount > 0" class="ssh-tool-summary-more">还有 {{ hiddenItemCount }} 个调用未展示</div>
        </div>

        <pre v-if="previewText" class="ssh-tool-preview app-scrollbar mono">{{ previewText }}</pre>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Download, Server, TerminalSquare, Upload } from "lucide-vue-next";
import type { McpToolCallItem, McpToolGroupNode } from "../../features/timeline/renderModel/buildTimelineNodes";
import WaveText from "../ui/WaveText.vue";
import { useAnchoredPopover } from "../ui/useAnchoredPopover";

const props = defineProps<{
  group: McpToolGroupNode;
}>();

type SshToolKind = "command" | "download" | "upload" | "servers" | "other";
type SshStatus = "running" | "completed" | "failed" | "unknown";

const normalizeToolName = (value: unknown) => String(value ?? "").trim();
const normalizeLower = (value: unknown) => normalizeToolName(value).toLowerCase();

const items = computed(() => props.group.items ?? []);
const primaryItem = computed(() => items.value[0] ?? emptyItem);
const visibleItems = computed(() => items.value.slice(0, 4));
const hiddenItemCount = computed(() => Math.max(0, items.value.length - visibleItems.value.length));

const primaryToolKind = computed<SshToolKind>(() => sshToolKind(primaryItem.value.tool));
const aggregateStatus = computed<SshStatus>(() => {
  if (props.group.stats.running > 0) return "running";
  if (props.group.stats.failed > 0) return "failed";
  if (props.group.stats.completed > 0 && props.group.stats.completed >= props.group.stats.total) return "completed";
  return "unknown";
});
const isRunning = computed(() => aggregateStatus.value === "running");

const statusText = computed(() => {
  if (aggregateStatus.value === "running") return `进行中 ${props.group.stats.running}/${props.group.stats.total}`;
  if (aggregateStatus.value === "failed") return `失败 ${props.group.stats.failed}/${props.group.stats.total}`;
  if (aggregateStatus.value === "completed") return `已完成 ${props.group.stats.completed}/${props.group.stats.total}`;
  return `未知 ${props.group.stats.total}`;
});

const actionNoun = computed(() => {
  if (items.value.length > 1) return `${items.value.length} 个 SSH 调用`;
  if (primaryToolKind.value === "command") return "SSH 命令";
  if (primaryToolKind.value === "download") return "远程文件下载";
  if (primaryToolKind.value === "upload") return "远程文件上传";
  if (primaryToolKind.value === "servers") return "SSH 服务器列表";
  return "SSH 工具调用";
});

const activityText = computed(() => {
  const target = targetText.value && items.value.length === 1 ? `：${targetText.value}` : "";
  if (aggregateStatus.value === "running") return `正在处理 ${actionNoun.value}${target}`;
  if (aggregateStatus.value === "failed") return `${actionNoun.value} 失败${target}`;
  return `已完成 ${actionNoun.value}${target}`;
});

const popoverTitle = computed(() => {
  if (items.value.length > 1) return `SSH 工具调用（${items.value.length}）`;
  if (primaryToolKind.value === "command") return "SSH 命令执行";
  if (primaryToolKind.value === "download") return "SSH 下载文件";
  if (primaryToolKind.value === "upload") return "SSH 上传文件";
  if (primaryToolKind.value === "servers") return "SSH 服务器";
  return "SSH 工具调用";
});

const serverText = computed(() => {
  const servers = uniqueStrings(items.value.map((item) => item.server));
  return servers.join(" ｜ ") || "ssh";
});

const argumentRecord = computed(() => parseJsonRecord(primaryItem.value.argumentsRaw));
const targetLabel = computed(() => {
  if (primaryToolKind.value === "command") return "命令";
  if (primaryToolKind.value === "download") return "远程";
  if (primaryToolKind.value === "upload") return "本地";
  return "目标";
});
const targetText = computed(() => targetTextForItem(primaryItem.value));

const metricText = computed(() => {
  const duration = primaryItem.value.durationMs;
  if (duration == null) return "";
  return `${duration}ms`;
});

const previewText = computed(() => {
  const item = primaryItem.value;
  const parts = [
    stripLabel(item.argumentsSummary, "参数"),
    stripLabel(item.resultSummary || item.pageSummary || item.snapshotSummary, "结果"),
    stripLabel(item.errorText, "错误"),
  ].filter(Boolean);
  return parts.join("\n");
});

const sshActivityClass = computed(() => ({
  "is-running": aggregateStatus.value === "running",
  "is-failed": aggregateStatus.value === "failed",
  "is-completed": aggregateStatus.value === "completed",
}));

const {
  open: popoverOpen,
  popoverStyle,
  setAnchor,
  setPopover,
  openPopover,
  closePopover,
  updatePopover,
} = useAnchoredPopover({ prefer: "below", marginPx: 10, gapPx: 6 });

function sshToolKind(toolValue: unknown): SshToolKind {
  const tool = normalizeLower(toolValue);
  if (tool.includes("execute_command") || tool.includes("command")) return "command";
  if (tool.includes("download")) return "download";
  if (tool.includes("upload")) return "upload";
  if (tool.includes("list_servers") || tool.includes("servers")) return "servers";
  return "other";
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  const text = String(value ?? "").trim();
  if (!text || !text.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function targetTextForItem(item: McpToolCallItem): string {
  const record = item.id === primaryItem.value.id ? argumentRecord.value : parseJsonRecord(item.argumentsRaw);
  const toolKind = sshToolKind(item.tool);
  if (toolKind === "command") return normalizeToolName(record.cmdString) || normalizeToolName(record.command);
  if (toolKind === "download") return normalizeToolName(record.remotePath) || normalizeToolName(record.localPath);
  if (toolKind === "upload") return normalizeToolName(record.localPath) || normalizeToolName(record.remotePath);
  if (toolKind === "servers") return normalizeToolName(record.connectionName) || normalizeToolName(item.server);
  return normalizeToolName(record.connectionName) || normalizeToolName(item.tool);
}

function itemSummary(item: McpToolCallItem): string {
  const target = targetTextForItem(item);
  if (item.errorText) return stripLabel(item.errorText, "错误") || "失败";
  if (item.resultSummary) return stripLabel(item.resultSummary, "结果");
  if (target) return target;
  return stripLabel(item.argumentsSummary, "参数") || "—";
}

function stripLabel(value: unknown, label: string): string {
  const text = normalizeToolName(value);
  if (!text) return "";
  return text.replace(new RegExp(`^${label}:\\s*`), "").trim();
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = normalizeToolName(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

const emptyItem: McpToolCallItem = {
  id: "ssh-empty",
  itemId: "ssh-empty",
  createdAt: 0,
  turnId: "",
  server: "ssh",
  tool: "ssh",
  status: "unknown",
  rawStatus: "",
  durationMs: null,
  startedAt: null,
  completedAt: null,
  argumentsSummary: "",
  argumentsRaw: "",
  resultSummary: "",
  pageSummary: "",
  snapshotSummary: "",
  eventsSummary: "",
  resultRaw: "",
  structuredContentRaw: "",
  metaRaw: "",
  outputSchemaRaw: "",
  errorText: "",
  argumentsKey: "",
  resultKey: "",
  structuredContentKey: "",
  metaKey: "",
  outputSchemaKey: "",
  relatedResourceUri: "",
  relatedResourceSourceTab: "resources",
  relatedResourceTemplateKey: "",
  relatedResourceLabel: "",
};
</script>

<style scoped>
:global(.timeline-pane--chat .chat-tool-wrap > .ssh-tool-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

:global(:root[data-theme="light"] .timeline-pane--chat .chat-tool-wrap > .ssh-tool-activity) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ssh-tool-activity {
  --ssh-tool-wave-color: color-mix(in srgb, var(--text-muted) 78%, var(--text) 22%);
  position: relative;
  z-index: 1;
  display: inline-grid;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  padding: 1px 2px;
  color: var(--text-muted);
  outline: none;
}

.ssh-tool-activity.is-running {
  --ssh-tool-wave-color: color-mix(in srgb, var(--fg-accent) 80%, var(--text) 20%);
}

.ssh-tool-activity.is-failed {
  --ssh-tool-wave-color: color-mix(in srgb, var(--fg-danger) 72%, var(--text) 28%);
}

.ssh-tool-line {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  min-height: 24px;
  align-items: center;
  gap: 7px;
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.ssh-tool-activity:focus-visible .ssh-tool-line {
  outline: 1px solid color-mix(in srgb, var(--border-accent) 66%, transparent);
  outline-offset: 3px;
}

.ssh-tool-icon-wrap {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: color-mix(in srgb, var(--text-muted) 78%, var(--text) 22%);
}

.ssh-tool-activity.is-running .ssh-tool-icon-wrap {
  color: var(--fg-accent);
}

.ssh-tool-activity.is-failed .ssh-tool-icon-wrap {
  color: var(--fg-danger);
}

.ssh-tool-icon {
  width: 14px;
  height: 14px;
  stroke-width: 2.1;
}

.ssh-tool-wave {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(72cqw, 680px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.ssh-tool-running-dot {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--fg-accent);
  opacity: 0.78;
  animation: ssh-tool-pulse 900ms ease-in-out infinite;
}

.ssh-tool-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
}

.ssh-tool-popover {
  position: fixed;
  z-index: 1200;
  display: grid;
  width: min(560px, calc(100cqw - 44px));
  max-width: calc(100vw - 48px);
  min-width: min(380px, calc(100cqw - 44px));
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

.ssh-tool-popover.is-open {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.ssh-tool-popover-head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ssh-tool-popover-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-tool-status {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 82%, var(--text) 18%);
  font-size: 11px;
  line-height: 1;
}

.is-failed .ssh-tool-status {
  color: color-mix(in srgb, var(--fg-danger) 76%, var(--text) 24%);
}

.ssh-tool-detail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.ssh-tool-detail-label {
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  white-space: nowrap;
}

.ssh-tool-detail-value {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted) 12%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-tool-summary-list {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.ssh-tool-summary-item {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  align-items: center;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.ssh-tool-summary-name,
.ssh-tool-summary-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-tool-summary-name {
  color: color-mix(in srgb, var(--text-muted) 78%, transparent);
}

.ssh-tool-summary-text {
  color: color-mix(in srgb, var(--text) 82%, var(--text-muted) 18%);
}

.ssh-tool-summary-more {
  color: var(--text-muted);
  font-size: 11px;
}

.ssh-tool-preview {
  max-height: 132px;
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

@keyframes ssh-tool-pulse {
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
  .ssh-tool-running-dot,
  .ssh-tool-popover {
    animation: none;
    transition: none;
  }
}

@container (max-width: 520px) {
  .ssh-tool-line {
    align-items: flex-start;
    gap: 6px;
  }

  .ssh-tool-wave {
    max-width: calc(100cqw - 56px);
  }

  .ssh-tool-time {
    display: none;
  }

  .ssh-tool-popover {
    width: min(560px, calc(100vw - 20px));
    min-width: 0;
  }
}
</style>
