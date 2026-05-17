<template>
  <div class="chat-pane flex flex-col">
    <div v-if="handoffDiagnosticsBanner" :class="CHAT_ROW_ACTIVITY_CLASS">
      <div class="chat-activity-line inline-flex w-full max-w-full items-center gap-2.5 px-2.5 py-0.5 text-xs dim">
        <span
          v-if="handoffDiagnosticsBanner.tone !== 'running'"
          class="chat-activity-dot h-1.5 w-1.5 flex-none rounded-full bg-[var(--ui-activity-dot-bg)] shadow-[var(--ui-activity-dot-shadow)]"
          :class="activityDotClass(handoffDiagnosticsBanner.tone)"
          aria-hidden="true"
        ></span>
        <span class="mono whitespace-nowrap">交接记录</span>
        <ExecutionWaveText v-if="handoffDiagnosticsBanner.tone === 'running'" :text="handoffDiagnosticsBanner.text" />
        <span v-else>{{ handoffDiagnosticsBanner.text }}</span>
      </div>
    </div>

    <div ref="pinnedPromptLayerRef" class="chat-pinned-prompt-layer">
      <Transition name="chat-pinned-prompt">
        <ChatPinnedUserPromptBox
          v-if="pinnedUserMessage"
          :text="pinnedUserMessage.text"
          :title="pinnedUserMessage.title"
          :fileCount="pinnedUserMessage.fileCount"
          :imageCount="pinnedUserMessage.imageCount"
          :showTimestamp="viewPrefs.showTimestamps"
          :formattedTime="pinnedUserMessage.formattedTime"
          @locate="onPinnedUserClick"
        />
      </Transition>
    </div>

    <ChatTimelineViewport
      :rows="chatRenderedRows"
      :timelineKey="timelineKey"
      :scrollElement="scrollElement"
      :onLayoutChange="onLayoutChange"
      :onViewportAdapterChange="setLocalViewportAdapter"
      :onPinnedUserRowChange="setPinnedUserRowId"
      #default="{ row: renderedRow }"
    >
      <ChatRowRenderer
        :renderedRow="renderedRow"
        :workspaceRoot="workspaceRoot"
        :viewPrefs="viewPrefs"
        :assistantPlanMessageFormat="appShellStore.assistantPlanMessageFormat"
        :planExecStateByEventId="planExecStateByEventId"
        :modelOptions="modelOptions"
        :isTurnRunning="isTurnRunning"
        :reasoningEffortOptions="reasoningEffortOptions"
        :sandboxModeOptions="sandboxModeOptions"
        :turnPlanForPlanDeltaEvent="turnPlanForPlanDeltaEvent"
        :userMessageParts="userMessageParts"
        :userMessageImageCount="userMessageImageCount"
        :visibleUserMessageImageEntries="visibleUserMessageImageEntries"
        :visibleImageToolEntries="visibleImageToolEntries"
        :handleThumbLoadError="onThumbLoadError"
        :handleUserFileTokenClick="onUserFileTokenClick"
        :handleUserBubbleClick="onUserBubbleClick"
        :handlePreviewImage="onPreviewImage"
        :inlineRewriteDraft="inlineRewriteDraft"
        :onInlineRewriteUpdate="updateInlineRewriteDraft"
        :onInlineRewriteCancel="closeInlineRewrite"
        :onInlineRewriteSend="sendInlineRewriteDraft"
        :handleLayoutChange="onLayoutChange"
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
        :executePlanFromPlanDelta="onExecutePlanFromPlanDelta"
        :updatePlanExecModel="updatePlanExecModel"
        :updatePlanExecReasoningEffort="updatePlanExecReasoningEffort"
        :updatePlanExecSandboxMode="updatePlanExecSandboxMode"
      />
    </ChatTimelineViewport>

    <div
      v-if="trailingContextCompactionEvent"
      :class="[CHAT_ROW_BASE_CLASS, 'chat-row--tail', 'chat-row--context-compaction']"
    >
      <div
        class="chat-context-compaction-line flex w-full max-w-full items-center justify-center px-2.5 py-0.5 text-center"
      >
        <WaveText
          v-if="isContextCompactionRunning"
          as="div"
          class="chat-context-compaction-text mono"
          color="var(--text-muted)"
          :text="trailingContextCompactionEvent.paramsText"
        />
        <div v-else class="chat-context-compaction-text is-completed mono">
          {{ trailingContextCompactionEvent.paramsText }}
        </div>
      </div>
    </div>

    <div
      v-if="showTrailingThinkingEvent && trailingThinkingEvent"
      :class="[CHAT_ROW_BASE_CLASS, 'chat-row--tail', 'chat-row--thinking']"
    >
      <div class="chat-thinking-line flex w-full max-w-full items-center justify-start pr-2.5">
        <WaveText class="mono dim" :text="trailingThinkingEvent.paramsText" />
      </div>
    </div>

    <Teleport to="body">
      <Transition name="composer-lightbox">
        <div
          v-if="imageLightboxOpen"
          class="composer-lightbox-overlay composer-lightbox-overlay--image"
          role="dialog"
          aria-modal="true"
          :aria-label="imageLightboxTitle || '图片预览'"
        >
          <div class="composer-lightbox-backdrop" aria-hidden="true" @click="closeImageLightbox"></div>
          <div class="composer-lightbox-stage composer-lightbox-stage--image" @click.self="closeImageLightbox">
            <div
              class="composer-lightbox-viewport"
              :class="{ 'is-dragging': imageLightboxDragging }"
              @wheel="onImageLightboxWheel"
              @pointerdown="onImageLightboxPointerDown"
              @pointermove="onImageLightboxPointerMove"
              @pointerup="finishImageLightboxDrag"
              @pointercancel="finishImageLightboxDrag"
              @lostpointercapture="finishImageLightboxDrag"
            >
              <img
                class="composer-lightbox-image composer-lightbox-image--interactive"
                :src="imageLightboxSrc"
                :alt="imageLightboxTitle || '图片预览'"
                :style="imageLightboxTransformStyle"
                draggable="false"
              />
            </div>
            <div class="composer-lightbox-toolbar app-scrollbar" @pointerdown.stop @click.stop>
              <span class="composer-lightbox-zoom mono">{{ Math.round(imageLightboxZoom * 100) }}%</span>
              <button class="composer-lightbox-action" type="button" @click="zoomImageLightboxOut">
                <ZoomOut aria-hidden="true" />
              </button>
              <button class="composer-lightbox-action" type="button" @click="zoomImageLightboxIn">
                <ZoomIn aria-hidden="true" />
              </button>
              <button
                class="composer-lightbox-action"
                type="button"
                @click="resetImageLightboxView"
              >
                <RotateCcw aria-hidden="true" />
              </button>
              <button
                class="composer-lightbox-action"
                type="button"
                @click="downloadImageLightboxImage"
              >
                <Download aria-hidden="true" />
              </button>
              <button
                ref="imageLightboxCloseButtonRef"
                class="composer-lightbox-action composer-lightbox-action--close"
                type="button"
                @click="closeImageLightbox"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// 聊天视图：将时间线节点重组为对话流卡片，并处理图片预览等交互。
import { computed, ref } from "vue";
import { Download, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-vue-next";
import ChatTimelineViewport from "./ChatTimelineViewport.vue";
import ChatRowRenderer from "./ChatRowRenderer.vue";
import ChatPinnedUserPromptBox from "../../chat/ChatPinnedUserPromptBox.vue";
import { chatActivityToneClass } from "./chatStyle";
import { CHAT_ROW_ACTIVITY_CLASS, CHAT_ROW_BASE_CLASS } from "./chatPresentation";
import ExecutionWaveText from "../../ui/ExecutionWaveText.vue";
import WaveText from "../../ui/WaveText.vue";

import type { TimelineEventItem } from "../../../domain/types";
import type { TimelineViewportAdapter } from "./timelineScrollPolicy";
import { useAppShellStore } from "../../../stores/appShell.store";
import { useMcpResourceStore } from "../../../stores/mcpResource.store";
import { useMcpStore } from "../../../stores/mcp.store";
import { useRuntimeStore } from "../../../stores/runtime.store";
import { useModelCatalogStore } from "../../../stores/modelCatalog.store";
import { useViewPrefsStore } from "../../../stores/viewPrefs.store";
import { useAgentMarkdownRenderer } from "../../../features/timeline/useAgentMarkdownRenderer";
import { buildMcpToolDefinitionIndex } from "../../../features/timeline/renderModel/buildTimelineNodes";
import { formatTime } from "../../../features/timeline/renderModel/formatters";
import { buildModelPickerOptions } from "../../../../shared/modelCatalog";

import { useChatTimeline } from "../composables/useChatTimeline";
import { usePlanExecution } from "../composables/usePlanExecution";
import { useImageLightbox } from "../composables/useImageLightbox";
import { useChatLayout } from "../composables/useChatLayout";
import { useChatMessageParts } from "../composables/useChatMessageParts";
import { useChatRenderModel } from "../composables/useChatRenderModel";
import { useInlineHistoryRewrite } from "../composables/useInlineHistoryRewrite";
import type { McpResourceReadNode } from "../../../features/timeline/renderModel/buildTimelineNodes";
import type { McpToolItem } from "../../timeline/cards/McpToolCardContent.vue";

const props = defineProps<{
  contentEvents: TimelineEventItem[];
  workspaceRoot: string;
  trailingThinkingEvent: TimelineEventItem | null;
  trailingContextCompactionEvent: TimelineEventItem | null;
  timelineKey: string;
  scrollElement: HTMLElement | null;
  onLayoutChange?: () => void;
  onViewportAdapterChange?: (adapter: TimelineViewportAdapter | null) => void;
  inlineRewriteCloseSeq?: number;
}>();

const appShellStore = useAppShellStore();
const mcpStore = useMcpStore();
const mcpResourceStore = useMcpResourceStore();
const runtimeStore = useRuntimeStore();
const viewPrefs = useViewPrefsStore();
const modelCatalogStore = useModelCatalogStore();
const localViewportAdapter = ref<TimelineViewportAdapter | null>(null);
const pinnedUserRowId = ref("");
const pinnedPromptLayerRef = ref<HTMLElement | null>(null);
const PINNED_PROMPT_TOP_GAP_PX = 8;

const { getMarkdownEventHtml } = useAgentMarkdownRenderer({ key: () => runtimeStore.timelineKey });
const mcpToolDefinitions = computed(() => buildMcpToolDefinitionIndex(mcpStore.servers));

// 1. 基础时间线与状态逻辑
const { isTurnRunning, turnPlanForPlanDeltaEvent } = useChatTimeline();

// 2. 布局与 Handoff 诊断逻辑
const { hiddenImageIds, handoffDiagnosticsBanner } = useChatLayout();

// 3. 消息片段与图片处理逻辑
const {
  userMessageParts,
  userMessageImageCount,
  visibleUserMessageImageEntries,
  visibleImageToolEntries,
  onThumbLoadError,
  onUserFileTokenClick,
  getUserMessageSnapshot,
} = useChatMessageParts(() => hiddenImageIds.value, props.onLayoutChange);

const {
  inlineRewriteDraft,
  openInlineRewrite: onUserBubbleClick,
  updateInlineRewriteDraft,
  closeInlineRewrite,
  sendInlineRewriteDraft,
} = useInlineHistoryRewrite({
  closeSeq: () => props.inlineRewriteCloseSeq,
  getUserMessageSnapshot,
});

// 4. 渲染模型计算逻辑
const {
  chatRenderedRows,
  isReasoningOpen,
  setReasoningOpen,
  isMcpToolGroupOpen,
  onMcpToolGroupToggle,
  isMcpToolItemDetailOpen,
  onMcpToolItemDetailToggle,
  isMcpResourceOpen,
  setMcpResourceOpen,
} = useChatRenderModel(
  () => props.contentEvents,
  () => props.workspaceRoot,
  () => mcpToolDefinitions.value,
  props.onLayoutChange
);

// 5. 计划执行逻辑
const {
  planExecStateByEventId,
  onExecutePlanFromPlanDelta,
  updatePlanExecModel,
  updatePlanExecReasoningEffort,
  updatePlanExecSandboxMode,
} = usePlanExecution(
  () => props.contentEvents,
  () => isTurnRunning.value
);

// 6. 图片预览逻辑
const {
  imageLightboxOpen,
  imageLightboxSrc,
  imageLightboxTitle,
  imageLightboxCloseButtonRef,
  imageLightboxZoom,
  imageLightboxDragging,
  imageLightboxTransformStyle,
  closeImageLightbox,
  resetImageLightboxView,
  zoomImageLightboxIn,
  zoomImageLightboxOut,
  onImageLightboxWheel,
  onImageLightboxPointerDown,
  onImageLightboxPointerMove,
  finishImageLightboxDrag,
  downloadImageLightboxImage,
  onPreviewImage,
} = useImageLightbox();

// --- 辅助逻辑 ---
const commandFilesOpenById = ref(new Map<string, boolean>());
const isCommandFilesOpen = (nodeId: string) => commandFilesOpenById.value.get(String(nodeId ?? "")) ?? false;
function toggleCommandFilesOpen(nodeId: string) {
  const id = String(nodeId ?? "").trim();
  if (!id) return;
  commandFilesOpenById.value.set(id, !isCommandFilesOpen(id));
}

const contextCompactionPhase = computed(() => {
  const event = props.trailingContextCompactionEvent;
  const phase = (event?.params as any)?.phase;
  return phase === "started" || phase === "completed" ? phase : "";
});
const isContextCompactionRunning = computed(() => contextCompactionPhase.value === "started");
const showTrailingThinkingEvent = computed(
  () => !!props.trailingThinkingEvent && !props.trailingContextCompactionEvent
);

const openMcpResourceInPanel = (item: Pick<McpResourceReadNode, "server" | "uri" | "sourceTab" | "templateKey">) => {
  const threadId = String(runtimeStore.timelineKey ?? "").trim();
  const serverId = String(item?.server ?? "").trim();
  const uri = String(item?.uri ?? "").trim();
  if (!threadId || !serverId || !uri) return;
  const sourceTab = item?.sourceTab === "templates" ? "templates" : "resources";
  mcpResourceStore.requestOpen(serverId, sourceTab);
  if (sourceTab === "templates" && String(item?.templateKey ?? "").trim()) {
    mcpResourceStore.selectTemplate(serverId, String(item.templateKey).trim());
  } else {
    mcpResourceStore.selectResource(serverId, uri);
  }
  mcpResourceStore.hydrateFromCache(threadId, serverId, uri);
  appShellStore.openSettings("integrations", { integrationsTab: "mcp" });
};

const onOpenRelatedMcpResource = (item: McpToolItem) => {
  if (!item.relatedResourceUri) return;
  openMcpResourceInPanel({
    server: item.server,
    uri: item.relatedResourceUri,
    sourceTab: item.relatedResourceSourceTab,
    templateKey: item.relatedResourceTemplateKey,
  });
};

const activityDotClass = chatActivityToneClass;

function setLocalViewportAdapter(adapter: TimelineViewportAdapter | null) {
  localViewportAdapter.value = adapter;
  props.onViewportAdapterChange?.(adapter);
}

function setPinnedUserRowId(rowId: string) {
  pinnedUserRowId.value = String(rowId ?? "").trim();
}

const pinnedUserRow = computed(() => {
  const rowId = pinnedUserRowId.value;
  if (!rowId) return null;
  const row = chatRenderedRows.value.find((item) => item.id === rowId) ?? null;
  return row?.kind === "user" ? row : null;
});

const pinnedUserMessage = computed(() => {
  const row = pinnedUserRow.value;
  if (!row) return null;
  const parts = userMessageParts(row.event);
  const textParts = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const fileCount = parts.filter((part) => part.type === "file").length;
  const imageCount = userMessageImageCount(row.event);
  const suffix = [
    fileCount > 0 ? `+${fileCount} 文件` : "",
    imageCount > 0 ? `+${imageCount} 图片` : "",
  ].filter(Boolean);
  const summary = textParts.join(" ").trim() || "用户消息";
  const title = [summary, ...suffix].filter(Boolean).join(" · ");
  return {
    rowId: row.id,
    text: summary,
    title,
    fileCount,
    imageCount,
    formattedTime: formatTime(row.event.createdAt),
  };
});

function pinnedPromptLocateOffsetPx() {
  const prompt = pinnedPromptLayerRef.value?.querySelector<HTMLElement>(".chat-pinned-prompt") ?? null;
  const promptHeight = Math.ceil(prompt?.getBoundingClientRect().height ?? 0);
  return Math.max(8, promptHeight + PINNED_PROMPT_TOP_GAP_PX + 5);
}

function scrollDomRowToTop(rowId: string, offsetPx = 0) {
  const element = props.scrollElement;
  if (!element) return false;
  const row = Array.from(element.querySelectorAll<HTMLElement>(".chat-timeline-row")).find(
    (item) => String(item.dataset.rowId ?? "").trim() === rowId
  );
  if (!row) return false;
  const elementRect = element.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const delta = rowRect.top - elementRect.top - Math.max(0, Math.round(offsetPx));
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTo({ top: Math.max(0, Math.min(maxScrollTop, element.scrollTop + delta)), behavior: "smooth" });
  return true;
}

function onPinnedUserClick() {
  const rowId = pinnedUserMessage.value?.rowId ?? "";
  if (!rowId) return;
  const offsetPx = pinnedPromptLocateOffsetPx();
  if (localViewportAdapter.value?.scrollRowToTop(rowId, offsetPx, "smooth")) return;
  scrollDomRowToTop(rowId, offsetPx);
}

// 计划工具条选项
const reasoningEffortOptions = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "极高" },
] as const;
const sandboxModeOptions = [
  { value: "read-only", label: "只读" },
  { value: "workspace-write", label: "可写" },
  { value: "danger-full-access", label: "完全" },
] as const;
const modelOptions = computed(() =>
  buildModelPickerOptions({ customIds: modelCatalogStore.customIds, current: runtimeStore.model })
);

</script>
