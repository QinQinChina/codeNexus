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

  <ChatSystemRow v-else-if="renderedRow.kind === 'system'" :text="renderedRow.text" />

  <ChatAuxActivityGroup
    v-else-if="renderedRow.kind === 'auxActivityGroup'"
    :id="renderedRow.id"
    :items="renderedRow.items"
    :summaryItems="renderedRow.summaryItems"
    :summaryText="renderedRow.summaryText"
    :status="renderedRow.status"
    :defaultCollapsed="renderedRow.defaultCollapsed"
    @layout-change="handleLayoutChange?.()"
  >
    <template #default="{ item }">
      <ChatRowRenderer
        :renderedRow="item"
        :workspaceRoot="workspaceRoot"
        :viewPrefs="viewPrefs"
        :assistantPlanMessageFormat="assistantPlanMessageFormat"
        :planExecStateByEventId="planExecStateByEventId"
        :modelOptions="modelOptions as any"
        :isTurnRunning="isTurnRunning"
        :reasoningEffortOptions="reasoningEffortOptions as any"
        :sandboxModeOptions="sandboxModeOptions as any"
        :turnPlanForPlanDeltaEvent="turnPlanForPlanDeltaEvent"
        :userMessageParts="userMessageParts"
        :userMessageImageCount="userMessageImageCount"
        :visibleUserMessageImageEntries="visibleUserMessageImageEntries"
        :visibleImageToolEntries="visibleImageToolEntries"
        :handleThumbLoadError="handleThumbLoadError"
        :handleUserFileTokenClick="handleUserFileTokenClick"
        :handleUserBubbleClick="handleUserBubbleClick"
        :isHistoryRewriteAnchor="isHistoryRewriteAnchor"
        :handlePreviewImage="handlePreviewImage"
        :handleLayoutChange="handleLayoutChange"
        :getMarkdownEventHtml="getMarkdownEventHtml"
        :isReasoningOpen="isReasoningOpen"
        :setReasoningOpen="setReasoningOpen"
        :isCommandFilesOpen="isCommandFilesOpen"
        :toggleCommandFilesOpen="toggleCommandFilesOpen"
        :isMcpToolGroupOpen="isMcpToolGroupOpen"
        :onMcpToolGroupToggle="onMcpToolGroupToggle"
        :isMcpToolItemDetailOpen="isMcpToolItemDetailOpen"
        :onMcpToolItemDetailToggle="onMcpToolItemDetailToggle"
        :isMcpResourceOpen="isMcpResourceOpen"
        :setMcpResourceOpen="setMcpResourceOpen"
        :openMcpResourceInPanel="openMcpResourceInPanel"
        :onOpenRelatedMcpResource="onOpenRelatedMcpResource"
        :executePlanFromPlanDelta="executePlanFromPlanDelta"
        :updatePlanExecModel="updatePlanExecModel"
        :updatePlanExecReasoningEffort="updatePlanExecReasoningEffort"
        :updatePlanExecSandboxMode="updatePlanExecSandboxMode"
      />
    </template>
  </ChatAuxActivityGroup>

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
    :class="CHAT_ROW_TOOL_CLASS"
  />

  <ChatWebSearchCard
    v-else-if="renderedRow.kind === 'webSearch'"
    :item="(renderedRow as any).item"
    :class="CHAT_ROW_TOOL_CLASS"
  />

  <div v-else-if="renderedRow.kind === 'dynamicTool'" :class="CHAT_ROW_TOOL_CLASS">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <DynamicToolCallCardContent
        class="dynamic-tool-chat-card w-full rounded-xl border border-[var(--ui-code-border)] bg-[var(--ui-code-bg)] p-3"
        :item="(renderedRow as any).item"
      />
    </div>
  </div>

  <ChatReasoningBlock
    v-else-if="renderedRow.kind === 'reasoningBlock'"
    :isOpen="isReasoningOpen((renderedRow as any).item)"
    :title="(renderedRow as any).item.title || '思考'"
    :durationText="reasoningDurationText((renderedRow as any).item.durationMs)"
    :html="toReasoningHtml((renderedRow as any).item.text)"
    @toggle="(next) => setReasoningOpen((renderedRow as any).item, next)"
  />

  <div v-else-if="renderedRow.kind === 'fileChange'" :class="CHAT_ROW_TOOL_CLASS">
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
    :class="CHAT_ROW_ACTIVITY_CLASS"
  />

  <div v-else-if="renderedRow.kind === 'commandRead'" :class="CHAT_ROW_TOOL_CLASS">
    <CommandReadActivityRow :item="(renderedRow as any).item" />
  </div>

  <div v-else-if="renderedRow.kind === 'commandList'" :class="CHAT_ROW_TOOL_CLASS">
    <CommandListActivityRow :item="(renderedRow as any).item" />
  </div>

  <div v-else-if="renderedRow.kind === 'commandSearch'" :class="CHAT_ROW_TOOL_CLASS">
    <CommandSearchActivityRow :item="(renderedRow as any).item" />
  </div>

  <div v-else-if="renderedRow.kind === 'mcpResourceRead'" :class="CHAT_ROW_TOOL_CLASS">
    <div class="chat-tool-wrap w-full max-w-full min-w-0">
      <McpResourceReadCardContent
        :open="isMcpResourceOpen((renderedRow as any).item.id)"
        :item="(renderedRow as any).item"
        :onOpenInPanel="openMcpResourceInPanel"
        @update:open="setMcpResourceOpen((renderedRow as any).item.id, $event)"
      />
    </div>
  </div>

  <div v-else-if="renderedRow.kind === 'mcpToolGroup'" :class="CHAT_ROW_TOOL_CLASS">
    <ChatSshToolActivity v-if="isSshMcpToolGroup((renderedRow as any).group)" :group="(renderedRow as any).group" />
    <div v-else class="chat-tool-wrap w-full max-w-full min-w-0">
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
import { defineAsyncComponent, defineComponent, h } from "vue";
import ChatUserMessage from "../../chat/ChatUserMessage.vue";
import ChatAssistantMessage from "../../chat/ChatAssistantMessage.vue";
import ChatActivityRow from "../../chat/ChatActivityRow.vue";
import ChatAuxActivityGroup from "../../chat/ChatAuxActivityGroup.vue";
import ChatReasoningBlock from "../../chat/ChatReasoningBlock.vue";
import ChatSystemRow from "../../chat/ChatSystemRow.vue";
import { CHAT_ROW_ACTIVITY_CLASS, CHAT_ROW_TOOL_CLASS } from "./chatPresentation";
import { chatActivityToneClass, chatSandboxToneClass } from "./chatStyle";

import type { TimelineEventItem, TurnPlanState } from "../../../domain/types";
import { tryParseStructuredFinalAnswerV1 } from "../../../domain/structuredFinalAnswer";
import { renderMarkdownToSafeHtml } from "../../../features/timeline/markdownRenderer";
import { useMarkdownRendererRefresh } from "../../../features/timeline/useMarkdownRendererRefresh";
import type {
  FileChangeNode,
  McpResourceReadNode,
  McpToolGroupNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";
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
} from "../../../features/timeline/renderModel/formatters";
import type { SandboxMode } from "../../../stores/runtime.store";
import type { McpToolItem } from "../../timeline/cards/McpToolCardContent.vue";
import type {
  ChatImageEntry,
  ChatRenderedRow,
  ChatUserMessagePart,
  ImagePreviewPayload,
  PlanDeltaExecUiState,
  ThumbLoadErrorPayload,
} from "../types/chat.types";

defineOptions({ name: "ChatRowRenderer" });

type OptionInput = string | { value: string; label: string; disabled?: boolean };
type AnyFn = (...args: any[]) => any;

const COMMAND_FILES_RENDER_LIMIT = 1000;
const { markdownRendererTick, refreshWhenReady } = useMarkdownRendererRefresh();

const AsyncTimelineCardLoading = defineComponent({
  name: "AsyncTimelineCardLoading",
  setup() {
    return () =>
      h("div", { class: "chat-async-card-loading", "aria-hidden": "true" }, [
        h("div", { class: "chat-async-card-loading__line chat-async-card-loading__line--wide" }),
        h("div", { class: "chat-async-card-loading__line chat-async-card-loading__line--short" }),
      ]);
  },
});

const ChatImageToolCard = defineAsyncComponent({
  loader: () => import("../../chat/ChatImageToolCard.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const ChatWebSearchCard = defineAsyncComponent({
  loader: () => import("../../chat/ChatWebSearchCard.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const DynamicToolCallCardContent = defineAsyncComponent({
  loader: () => import("../../timeline/cards/DynamicToolCallCardContent.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const ChatSshToolActivity = defineAsyncComponent({
  loader: () => import("../../chat/ChatSshToolActivity.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const ChatFileChangeCard = defineAsyncComponent({
  loader: () => import("../../chat/ChatFileChangeCard.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const ChatCommandActionRow = defineAsyncComponent({
  loader: () => import("../../chat/ChatCommandActionRow.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const CommandReadActivityRow = defineAsyncComponent({
  loader: () => import("../../timeline/activities/CommandReadActivityRow.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const CommandListActivityRow = defineAsyncComponent({
  loader: () => import("../../timeline/activities/CommandListActivityRow.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const CommandSearchActivityRow = defineAsyncComponent({
  loader: () => import("../../timeline/activities/CommandSearchActivityRow.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const McpResourceReadCardContent = defineAsyncComponent({
  loader: () => import("../../timeline/cards/McpResourceReadCardContent.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});
const McpToolCardContent = defineAsyncComponent({
  loader: () => import("../../timeline/cards/McpToolCardContent.vue"),
  loadingComponent: AsyncTimelineCardLoading,
  delay: 120,
});

const isSshMcpToolGroup = (group: McpToolGroupNode | null | undefined): boolean => {
  return (group?.items ?? []).some((item) => {
    const server = String(item?.server ?? "")
      .trim()
      .toLowerCase();
    return server.includes("ssh");
  });
};

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
  handleLayoutChange?: () => void;
  getMarkdownEventHtml: (event: TimelineEventItem) => string;
  isReasoningOpen: AnyFn;
  setReasoningOpen: AnyFn;
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
  if (!source) return "<p>（空）</p>";
  void markdownRendererTick.value;
  const html = renderMarkdownToSafeHtml(source);
  refreshWhenReady();
  return html;
};

const activityDotClass = chatActivityToneClass;
const sandboxSelectClass = chatSandboxToneClass;
</script>

<style scoped>
.chat-async-card-loading {
  display: grid;
  min-height: 44px;
  width: 100%;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  padding: 10px;
}

.chat-async-card-loading__line {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 18%, transparent);
}

.chat-async-card-loading__line--wide {
  width: min(260px, 72%);
}

.chat-async-card-loading__line--short {
  width: min(160px, 46%);
}
</style>
