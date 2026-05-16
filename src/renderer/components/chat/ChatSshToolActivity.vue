<template>
  <div class="chat-tool-wrap w-full max-w-full min-w-0">
    <article
      class="chat-inline-activity ssh-tool-activity"
      :class="sshActivityClass"
      :aria-busy="isRunning"
      tabindex="0"
    >
      <div class="chat-inline-activity__line ssh-tool-line">
        <span class="chat-inline-activity__icon ssh-tool-icon-wrap" aria-hidden="true">
          <Download v-if="primaryToolKind === 'download'" class="chat-inline-activity__svg ssh-tool-icon" />
          <Upload v-else-if="primaryToolKind === 'upload'" class="chat-inline-activity__svg ssh-tool-icon" />
          <Server v-else-if="primaryToolKind === 'servers'" class="chat-inline-activity__svg ssh-tool-icon" />
          <TerminalSquare v-else class="chat-inline-activity__svg ssh-tool-icon" />
        </span>

        <ExecutionWaveText
          v-if="isRunning"
          class="chat-inline-activity__text chat-inline-activity__text--wrap ssh-tool-text"
          color="var(--accent)"
          :text="activityText"
          :cycle-max-chars="128"
        />
        <span v-else class="chat-inline-activity__text chat-inline-activity__text--wrap ssh-tool-text">{{
          activityText
        }}</span>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Download, Server, TerminalSquare, Upload } from "lucide-vue-next";
import ExecutionWaveText from "../ui/ExecutionWaveText.vue";
import type { McpToolCallItem, McpToolGroupNode } from "../../features/timeline/renderModel/buildTimelineNodes";

const props = defineProps<{
  group: McpToolGroupNode;
}>();

type SshToolKind = "command" | "download" | "upload" | "servers" | "other";
type SshStatus = "running" | "completed";

const normalizeToolName = (value: unknown) => String(value ?? "").trim();
const normalizeLower = (value: unknown) => normalizeToolName(value).toLowerCase();

const items = computed(() => props.group.items ?? []);
const primaryItem = computed(() => items.value[0] ?? emptyItem);

const primaryToolKind = computed<SshToolKind>(() => sshToolKind(primaryItem.value.tool));
const aggregateStatus = computed<SshStatus>(() => {
  if (props.group.stats.running > 0) return "running";
  return "completed";
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
  return `${actionNoun.value}${target}`;
});

const argumentRecord = computed(() => parseJsonRecord(primaryItem.value.argumentsRaw));
const targetText = computed(() => targetTextForItem(primaryItem.value));

const sshActivityClass = computed(() => ({
  "is-running": aggregateStatus.value === "running",
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
