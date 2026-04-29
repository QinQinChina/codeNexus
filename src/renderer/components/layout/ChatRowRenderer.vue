<template>
  <ChatUserMessage
    v-if="renderedRow.kind === 'user'"
    :event="renderedRow.event"
    :workspaceRoot="workspaceRoot"
    :isHistoryRewriteAnchor="isHistoryRewriteAnchor(renderedRow.event)"
    :messageParts="userMessageParts(renderedRow.event)"
    :imageCount="userMessageImageCount(renderedRow.event)"
    :visibleImages="visibleUserMessageImageEntries(renderedRow.event)"
    :showTimestamps="viewPrefs.showTimestamps"
    :formattedTime="formatTime(renderedRow.event.createdAt)"
    @click="handleUserBubbleClick"
    @file-token-click="handleUserFileTokenClick"
    @thumb-load-error="handleThumbLoadError"
    @preview-image="handlePreviewImage"
  />

  <ChatAssistantMessage
    v-else-if="renderedRow.kind === 'assistant'"
    :event="renderedRow.event"
    :assistantPlanMessageFormat="assistantPlanMessageFormat"
    :turnPlan="turnPlanForPlanDeltaEvent(renderedRow.event)"
    :isStructuredFinalAnswer="Boolean(tryParseStructuredFinalAnswerV1(renderedRow.event.paramsText))"
    :markdownHtml="getMarkdownEventHtml(renderedRow.event)"
    :execState="planExecStateByEventId[renderedRow.event.id] ?? null"
    :modelOptions="modelOptions as any"
    :isTurnRunning="isTurnRunning"
    :reasoningEffortOptions="reasoningEffortOptions as any"
    :sandboxModeOptions="sandboxModeOptions as any"
    :sandboxSelectClass="sandboxSelectClass(planExecStateByEventId[renderedRow.event.id]?.sandboxMode || '')"
    @execute-plan="executePlanFromPlanDelta"
    @update:model="(value) => updatePlanExecModel(renderedRow.event.id, value)"
    @update:reasoning-effort="(value) => updatePlanExecReasoningEffort(renderedRow.event.id, value)"
    @update:sandbox-mode="(value) => updatePlanExecSandboxMode(renderedRow.event.id, value)"
  />

  <div v-else-if="renderedRow.kind === 'system'" class="chat-row chat-row--system flex min-w-0 m-0">
    <div
      class="chat-system-line w-full max-w-full rounded-full border border-[var(--ui-well-border)] bg-[var(--ui-well-bg-strong)] px-3 py-1.5 mono dim"
    >
      {{ renderedRow.text }}
    </div>
  </div>

  <ChatActivityRow
    v-else-if="renderedRow.kind === 'activity'"
    :text="renderedRow.text"
    :activityDotClass="activityDotClass(renderedRow.tone)"
  />

  <ChatImageToolCard
    v-else-if="renderedRow.kind === 'imageTool'"
    :item="(renderedRow as any).item"
    :visibleImages="visibleImageToolEntries((renderedRow as any).item)"
    :showTimestamps="viewPrefs.showTimestamps"
    :formattedTime="formatTime((renderedRow as any).createdAt)"
    :workspaceRoot="workspaceRoot"
    @load-error="handleThumbLoadError"
    @preview="handlePreviewImage($event)"
    class="chat-row chat-row--tool flex min-w-0 m-0"
  />

  <ChatWebSearchCard
    v-else-if="renderedRow.kind === 'webSearch'"
    :item="(renderedRow as any).item"
    :showTimestamps="viewPrefs.showTimestamps"
    :formattedTime="formatTime((renderedRow as any).createdAt)"
    class="chat-row chat-row--tool flex min-w-0 m-0"
  />

  <ChatReasoningBlock
    v-else-if="renderedRow.kind === 'reasoningBlock'"
    :isOpen="isReasoningOpen((renderedRow as any).item)"
    :title="(renderedRow as any).item.title || '思考'"
    :durationText="reasoningDurationText((renderedRow as any).item.durationMs)"
    :html="toReasoningHtml((renderedRow as any).item.text)"
    @toggle="(next) => setReasoningOpen((renderedRow as any).item, next)"
  />

  <div v-else-if="renderedRow.kind === 'fileChange'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <ChatFileChangeCard
      :item="(renderedRow as any).item"
      :renderableFiles="fileChangeRenderableFiles((renderedRow as any).item)"
      :statusText="fileChangeStatusText((renderedRow as any).item.status)"
      :eventClass="fileChangeEventClass((renderedRow as any).item)"
      :fileChangeKindClass="fileChangeKindClass as any"
      :fileChangeKindText="fileChangeKindText as any"
      :fileChangeDiffMetaText="fileChangeDiffMetaText as any"
    />
  </div>

  <ChatCommandActionRow
    v-else-if="renderedRow.kind === 'commandAction'"
    :item="(renderedRow as any).item"
    :isFilesOpen="isCommandFilesOpen((renderedRow as any).item.id)"
    :renderLimit="COMMAND_FILES_RENDER_LIMIT"
    @toggle-files="toggleCommandFilesOpen((renderedRow as any).item.id)"
    class="chat-row chat-row--activity flex min-w-0 m-0"
  />

  <div v-else-if="renderedRow.kind === 'commandRead'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <ChatReadFileCard :item="(renderedRow as any).item" />
  </div>

  <div v-else-if="renderedRow.kind === 'commandList'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <CommandVisualCardContent
        kind="list"
        :item="(renderedRow as any).item"
        :open="isCommandFilesOpen((renderedRow as any).item.id)"
        :renderLimit="COMMAND_FILES_RENDER_LIMIT"
        @update:open="toggleCommandFilesOpen((renderedRow as any).item.id)"
      />
    </div>
  </div>

  <div v-else-if="renderedRow.kind === 'commandSearch'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <CommandVisualCardContent
        kind="search"
        :item="(renderedRow as any).item"
        :open="isCommandFilesOpen((renderedRow as any).item.id)"
        :renderLimit="COMMAND_FILES_RENDER_LIMIT"
        @update:open="toggleCommandFilesOpen((renderedRow as any).item.id)"
      />
    </div>
  </div>

  <div v-else-if="renderedRow.kind === 'mcpResourceRead'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <McpResourceReadCardContent
        :open="isMcpResourceOpen((renderedRow as any).item.id)"
        :item="(renderedRow as any).item"
        :onOpenInPanel="openMcpResourceInPanel"
        @update:open="setMcpResourceOpen((renderedRow as any).item.id, $event)"
      />
    </div>
  </div>

  <div v-else-if="renderedRow.kind === 'mcpToolGroup'" class="chat-row chat-row--tool flex min-w-0 m-0">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <McpToolCardContent
        :open="isMcpToolGroupOpen((renderedRow as any).group.id)"
        :tagText="mcpToolGroupTagText((renderedRow as any).group)"
        :groupClass="`${mcpToolGroupClass((renderedRow as any).group)} opacity-[0.96]`"
        :summaryText="mcpToolGroupSummaryText((renderedRow as any).group)"
        :statsText="mcpToolGroupStatsText((renderedRow as any).group)"
        :items="(renderedRow as any).group.items"
        :itemClass="mcpToolItemClass as any"
        :itemStatusText="mcpToolItemStatusText as any"
        :itemMetricsText="mcpToolItemMetricsText as any"
        :itemTitle="mcpToolItemTitle as any"
        :itemMetaText="mcpToolItemMetaText as any"
        :isDetailOpen="isMcpToolItemDetailOpen"
        :onDetailToggle="onMcpToolItemDetailToggle"
        :onOpenRelatedResource="onOpenRelatedMcpResource"
        @update:open="onMcpToolGroupToggle((renderedRow as any).group.id, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatUserMessage from "../chat/ChatUserMessage.vue";
import ChatAssistantMessage from "../chat/ChatAssistantMessage.vue";
import ChatActivityRow from "../chat/ChatActivityRow.vue";
import ChatReasoningBlock from "../chat/ChatReasoningBlock.vue";
import ChatImageToolCard from "../chat/ChatImageToolCard.vue";
import ChatWebSearchCard from "../chat/ChatWebSearchCard.vue";
import ChatCommandActionRow from "../chat/ChatCommandActionRow.vue";
import ChatFileChangeCard from "../chat/ChatFileChangeCard.vue";
import ChatReadFileCard from "../chat/ChatReadFileCard.vue";
import CommandVisualCardContent from "../timeline/cards/CommandVisualCardContent.vue";
import McpResourceReadCardContent from "../timeline/cards/McpResourceReadCardContent.vue";
import McpToolCardContent from "../timeline/cards/McpToolCardContent.vue";

import type { TimelineEventItem, TurnPlanState } from "../../domain/types";
import { tryParseStructuredFinalAnswerV1 } from "../../domain/structuredFinalAnswer";
import { renderMarkdownToSafeHtml } from "../../features/timeline/markdownRenderer";
import type { FileChangeNode, McpResourceReadNode } from "../../features/timeline/renderModel/buildTimelineNodes";
import {
  fileChangeDiffMetaText,
  fileChangeEventClass,
  fileChangeKindClass,
  fileChangeKindText,
  fileChangeStatusText,
  formatTime,
  mcpToolGroupClass,
  mcpToolGroupStatsText,
  mcpToolGroupSummaryText,
  mcpToolGroupTagText,
  mcpToolItemClass,
  mcpToolItemMetaText,
  mcpToolItemMetricsText,
  mcpToolItemStatusText,
  mcpToolItemTitle,
} from "../../features/timeline/renderModel/formatters";
import type { SandboxMode } from "../../stores/runtime.store";
import type { McpToolItem } from "../timeline/cards/McpToolCardContent.vue";
import type {
  ChatImageEntry,
  ChatRenderedRow,
  ChatUserMessagePart,
  ImagePreviewPayload,
  PlanDeltaExecUiState,
  ThumbLoadErrorPayload,
} from "./chat.types";

type OptionInput = string | { value: string; label: string; disabled?: boolean };
type AnyFn = (...args: any[]) => any;

const COMMAND_FILES_RENDER_LIMIT = 1000;

defineProps<{
  renderedRow: ChatRenderedRow;
  workspaceRoot: string;
  viewPrefs: { showTimestamps: boolean };
  assistantPlanMessageFormat: string;
  planExecStateByEventId: Record<string, PlanDeltaExecUiState | undefined>;
  modelOptions: OptionInput[];
  isTurnRunning: boolean;
  reasoningEffortOptions: OptionInput[];
  sandboxModeOptions: OptionInput[];
  turnPlanForPlanDeltaEvent: (event: TimelineEventItem) => TurnPlanState | null;
  userMessageParts: (event: TimelineEventItem) => ChatUserMessagePart[];
  userMessageImageCount: (event: TimelineEventItem) => number;
  visibleUserMessageImageEntries: (event: TimelineEventItem) => ChatImageEntry[];
  visibleImageToolEntries: AnyFn;
  handleThumbLoadError: (err: ThumbLoadErrorPayload) => void;
  handleUserFileTokenClick: (path: string) => void;
  handleUserBubbleClick: (event: TimelineEventItem) => void;
  isHistoryRewriteAnchor: (event: TimelineEventItem) => boolean;
  handlePreviewImage: (payload: ImagePreviewPayload) => void;
  getMarkdownEventHtml: (event: TimelineEventItem) => string;
  isReasoningOpen: (id: string) => boolean;
  setReasoningOpen: (id: string, open: boolean) => void;
  isCommandFilesOpen: (nodeId: string) => boolean;
  toggleCommandFilesOpen: (nodeId: string) => void;
  isMcpToolGroupOpen: (id: string) => boolean;
  onMcpToolGroupToggle: (id: string, open: boolean) => void;
  isMcpToolItemDetailOpen: AnyFn;
  onMcpToolItemDetailToggle: AnyFn;
  isMcpResourceOpen: (id: string) => boolean;
  setMcpResourceOpen: (id: string, open: boolean) => void;
  openMcpResourceInPanel: (item: Pick<McpResourceReadNode, "server" | "uri" | "sourceTab" | "templateKey">) => void;
  onOpenRelatedMcpResource: (item: McpToolItem) => void;
  executePlanFromPlanDelta: (event: TimelineEventItem) => void;
  updatePlanExecModel: (eventId: string, value: string) => void;
  updatePlanExecReasoningEffort: (eventId: string, value: string) => void;
  updatePlanExecSandboxMode: (eventId: string, value: SandboxMode) => void;
}>();

const fileChangeRenderableFiles = (item: FileChangeNode) =>
  Array.isArray(item.files) && item.files.length > 0 ? item.files : [null];

const reasoningDurationText = (durationMs: number | null | undefined) => {
  if (durationMs == null) return "";
  return `${Math.max(1, Math.round(durationMs / 1000))}s`;
};

const toReasoningHtml = (text: string) => {
  const source = String(text ?? "").trim();
  return source ? renderMarkdownToSafeHtml(source) : "<p>（空）</p>";
};

const activityDotClass = (tone?: string) => {
  if (tone === "running") return "is-running";
  if (tone === "ok") return "is-ok";
  if (tone === "error") return "is-error";
  if (tone === "warn") return "is-warn";
  return "";
};
const sandboxSelectClass = (mode: string) => {
  if (mode === "read-only") return "border-[var(--border-success)] bg-[var(--bg-success-soft)]";
  if (mode === "workspace-write") return "border-[var(--border-warning)] bg-[var(--bg-warning-soft)]";
  return "border-[var(--border-danger)] bg-[var(--bg-danger-soft)]";
};
</script>
