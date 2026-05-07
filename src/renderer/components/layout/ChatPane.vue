<template>
  <div class="chat-pane flex flex-col">
    <div v-if="handoffDiagnosticsBanner" class="chat-row chat-row--activity flex min-w-0 m-0">
      <div class="chat-activity-line inline-flex w-full max-w-full items-center gap-2.5 px-2.5 py-0.5 text-xs dim">
        <span
          class="chat-activity-dot h-1.5 w-1.5 flex-none rounded-full bg-[var(--ui-activity-dot-bg)] shadow-[var(--ui-activity-dot-shadow)]"
          :class="activityDotClass(handoffDiagnosticsBanner.tone)"
          aria-hidden="true"
        ></span>
        <span class="mono whitespace-nowrap">交接记录</span>
        <span>{{ handoffDiagnosticsBanner.text }}</span>
      </div>
    </div>

    <ChatTimelineViewport :rows="chatRenderedRows" :onLayoutChange="onLayoutChange" #default="{ row: renderedRow }">
      <ChatRowRenderer
        :renderedRow="renderedRow"
        :workspaceRoot="workspaceRoot"
        :viewPrefs="viewPrefs"
        :assistantPlanMessageFormat="appShellStore.assistantPlanMessageFormat"
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
        :handleThumbLoadError="onThumbLoadError"
        :handleUserFileTokenClick="onUserFileTokenClick"
        :handleUserBubbleClick="onUserBubbleClick"
        :isHistoryRewriteAnchor="isHistoryRewriteAnchor"
        :handlePreviewImage="onPreviewImage"
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
      class="chat-row chat-row--tail chat-row--context-compaction flex min-w-0 m-0"
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
      class="chat-row chat-row--tail chat-row--thinking flex min-w-0 m-0"
    >
      <div class="chat-thinking-line flex w-full max-w-full items-center justify-start pr-2.5">
        <WaveText class="mono dim" :text="trailingThinkingEvent.paramsText" />
      </div>
    </div>

    <Transition name="composer-lightbox">
      <div
        v-if="imageLightboxOpen"
        class="composer-lightbox-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="imageLightboxTitle || '图片预览'"
        @click.self="closeImageLightbox"
      >
        <div class="composer-lightbox-backdrop" aria-hidden="true"></div>
        <div class="composer-lightbox-stage" @click.self="closeImageLightbox">
          <img class="composer-lightbox-image" :src="imageLightboxSrc" :alt="imageLightboxTitle || '图片预览'" />
          <button
            ref="imageLightboxCloseButtonRef"
            class="composer-lightbox-close"
            type="button"
            @click="closeImageLightbox"
          >
            ×
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// 聊天视图：将时间线节点重组为对话流卡片，并处理图片预览等交互。
import { computed, ref } from "vue";
import ChatTimelineViewport from "./ChatTimelineViewport.vue";
import ChatRowRenderer from "./ChatRowRenderer.vue";
import WaveText from "../ui/WaveText.vue";

import type { TimelineEventItem } from "../../domain/types";
import { useAppShellStore } from "../../stores/appShell.store";
import { useMcpResourceStore } from "../../stores/mcpResource.store";
import { useMcpStore } from "../../stores/mcp.store";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useModelCatalogStore } from "../../stores/modelCatalog.store";
import { useViewPrefsStore } from "../../stores/viewPrefs.store";
import { useAgentMarkdownRenderer } from "../../features/timeline/useAgentMarkdownRenderer";
import { buildMcpToolDefinitionIndex } from "../../features/timeline/renderModel/buildTimelineNodes";
import { buildModelPickerOptions } from "../../../shared/modelCatalog";

import { useChatTimeline } from "./useChatTimeline";
import { usePlanExecution } from "./usePlanExecution";
import { useImageLightbox } from "./useImageLightbox";
import { useChatLayout } from "./useChatLayout";
import { useChatMessageParts } from "./useChatMessageParts";
import { useChatRenderModel } from "./useChatRenderModel";
import type { McpResourceReadNode } from "../../features/timeline/renderModel/buildTimelineNodes";
import type { McpToolItem } from "../timeline/cards/McpToolCardContent.vue";

const props = defineProps<{
  contentEvents: TimelineEventItem[];
  workspaceRoot: string;
  trailingThinkingEvent: TimelineEventItem | null;
  trailingContextCompactionEvent: TimelineEventItem | null;
  onLayoutChange?: () => void;
}>();

const appShellStore = useAppShellStore();
const mcpStore = useMcpStore();
const mcpResourceStore = useMcpResourceStore();
const runtimeStore = useRuntimeStore();
const viewPrefs = useViewPrefsStore();
const modelCatalogStore = useModelCatalogStore();

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
  onUserBubbleClick,
  isHistoryRewriteAnchor,
} = useChatMessageParts(() => hiddenImageIds.value, props.onLayoutChange);

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
  closeImageLightbox,
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

const activityDotClass = (tone?: string) => {
  if (tone === "running") return "is-running";
  if (tone === "ok") return "is-ok";
  if (tone === "error") return "is-error";
  if (tone === "warn") return "is-warn";
  return "";
};

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

<style scoped>
.chat-pane {
  --chat-row-gap-body: 4px;
  --chat-row-gap-command: 2px;
  --chat-row-gap-activity: 2px;
  --chat-row-gap-mixed: 4px;
  --chat-row-gap-tail: 1.5px;
}

.chat-row--tail {
  margin-top: var(--chat-row-gap-tail);
}

.chat-pane :deep(.chat-activity-dot.is-ok) {
  background: var(--success);
}

.chat-pane :deep(.chat-activity-dot.is-error) {
  background: var(--danger);
}

.chat-pane :deep(.chat-activity-dot.is-warn) {
  background: var(--warning);
}

.chat-pane :deep(.chat-activity-dot.is-running) {
  background: var(--accent);
  position: relative;
}

.chat-pane :deep(.chat-activity-dot.is-running::after) {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.75);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
  animation: chatActivityDotPulse 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .chat-pane :deep(.chat-activity-dot.is-running::after) {
    animation: none;
  }
}

@keyframes chatActivityDotPulse {
  0% {
    opacity: 0;
    transform: scale(0.72);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
  }
  55% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--accent) 18%, transparent);
  }
}
</style>
