<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article class="ssh-tool-activity" :class="sshActivityClass" :aria-busy="isRunning" tabindex="0">
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
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Download, Server, TerminalSquare, Upload } from "lucide-vue-next";
import type { McpToolCallItem, McpToolGroupNode } from "../../features/timeline/renderModel/buildTimelineNodes";
import WaveText from "../ui/WaveText.vue";

const props = defineProps<{
  group: McpToolGroupNode;
}>();

type SshToolKind = "command" | "download" | "upload" | "servers" | "other";
type SshStatus = "running" | "completed" | "failed" | "unknown";

const normalizeToolName = (value: unknown) => String(value ?? "").trim();
const normalizeLower = (value: unknown) => normalizeToolName(value).toLowerCase();

const items = computed(() => props.group.items ?? []);
const primaryItem = computed(() => items.value[0] ?? emptyItem);

const primaryToolKind = computed<SshToolKind>(() => sshToolKind(primaryItem.value.tool));
const aggregateStatus = computed<SshStatus>(() => {
  if (props.group.stats.running > 0) return "running";
  if (props.group.stats.failed > 0) return "failed";
  if (props.group.stats.completed > 0 && props.group.stats.completed >= props.group.stats.total) return "completed";
  return "unknown";
});
const isRunning = computed(() => aggregateStatus.value === "running");

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

const argumentRecord = computed(() => parseJsonRecord(primaryItem.value.argumentsRaw));
const targetText = computed(() => targetTextForItem(primaryItem.value));

const sshActivityClass = computed(() => ({
  "is-running": aggregateStatus.value === "running",
  "is-failed": aggregateStatus.value === "failed",
  "is-completed": aggregateStatus.value === "completed",
}));

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

.ssh-tool-time {
  flex: none;
  color: color-mix(in srgb, var(--text-muted) 72%, transparent);
  font-size: 11px;
  line-height: 1;
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
}
</style>
