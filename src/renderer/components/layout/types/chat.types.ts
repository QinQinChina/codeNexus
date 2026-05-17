import type {
  CollaborationModeKind,
  ComposeImageAttachment,
  ComposeWorkspaceFileMention,
  TimelineEventItem,
  TokenUsageState,
} from "../../../domain/types";
import type { IconifyIcon } from "@iconify/vue";
import type { DynamicToolTimelineItem } from "../../../domain/dynamicTools";
import type {
  ReasoningBlockNode,
  FileChangeNode,
  CommandActionNode,
  CommandListNode,
  CommandReadNode,
  CommandSearchNode,
  McpResourceReadNode,
  McpToolGroupNode,
} from "../../../features/timeline/renderModel/buildTimelineNodes";
import type { NormalizedWebSearchActionType } from "../../../features/timeline/webSearch";
import type { SandboxMode } from "../../../stores/runtime.store";

export type LazyImageSourceKind = "dataUrl" | "remoteUrl" | "localPath";

export type ChatImageEntry = {
  id: string;
  sourceKind: LazyImageSourceKind;
  source: string;
  title: string;
};

export type ThumbLoadErrorPayload = {
  imageId: string;
  source: string;
  sourceKind: LazyImageSourceKind;
  errorText: string;
};

export type ActivityTone = "neutral" | "running" | "ok" | "error" | "warn";

export type ImageToolStatus = "running" | "completed" | "failed" | "unknown";
export type WebSearchStatus = "running" | "completed";

export type ChatImageToolItem = {
  itemId: string;
  itemType: "imageView" | "imageGeneration";
  title: string;
  status: ImageToolStatus;
  pendingImageCount?: number;
  detailText: string;
  errorText: string;
  revisedPrompt: string;
  images: ChatImageEntry[];
};

export type ChatWebSearchItem = {
  itemId: string;
  actionType: NormalizedWebSearchActionType;
  status: WebSearchStatus;
  title: string;
  summaryText: string;
  actionLabel: string;
  primaryText: string;
  secondaryText: string;
  queries: string[];
  url: string;
  pattern: string;
  host: string;
};

export type ChatRowBase = {
  id: string;
  turnKey: string;
};

export type ChatAuxActivityStatus = "running" | "completed";

export type ChatAuxActivitySummaryItem = {
  key: string;
  label: string;
  count: number;
};

export type ChatTokenUsageSummaryItem = {
  threadId: string;
  turnId: string;
  completedAt: number | null;
  usage: TokenUsageState;
};

export type ChatAuxiliaryRow =
  | (ChatRowBase & { kind: "activity"; text: string; createdAt: number; tone?: ActivityTone })
  | (ChatRowBase & { kind: "imageTool"; createdAt: number; item: ChatImageToolItem })
  | (ChatRowBase & { kind: "dynamicTool"; createdAt: number; item: DynamicToolTimelineItem })
  | (ChatRowBase & { kind: "webSearch"; createdAt: number; item: ChatWebSearchItem })
  | (ChatRowBase & { kind: "reasoningBlock"; item: ReasoningBlockNode })
  | (ChatRowBase & { kind: "commandAction"; item: CommandActionNode })
  | (ChatRowBase & { kind: "commandRead"; item: CommandReadNode })
  | (ChatRowBase & { kind: "commandList"; item: CommandListNode })
  | (ChatRowBase & { kind: "commandSearch"; item: CommandSearchNode })
  | (ChatRowBase & { kind: "mcpResourceRead"; item: McpResourceReadNode })
  | (ChatRowBase & { kind: "mcpToolGroup"; group: McpToolGroupNode });

export type ChatMainRow =
  | (ChatRowBase & { kind: "user"; event: TimelineEventItem })
  | (ChatRowBase & { kind: "assistant"; event: TimelineEventItem })
  | (ChatRowBase & { kind: "system"; text: string })
  | (ChatRowBase & { kind: "fileChange"; item: FileChangeNode })
  | (ChatRowBase & { kind: "tokenUsageSummary"; item: ChatTokenUsageSummaryItem })
  | ChatAuxiliaryRow;

export type ChatAuxActivityGroupRow = ChatRowBase & {
  kind: "auxActivityGroup";
  items: ChatAuxiliaryRow[];
  summaryItems: ChatAuxActivitySummaryItem[];
  summaryText: string;
  status: ChatAuxActivityStatus;
  defaultCollapsed: boolean;
};

export type ChatRow = ChatMainRow | ChatAuxActivityGroupRow;

export type ChatRenderedRow = ChatRow;

export type PlanDeltaExecUiState = {
  model: string;
  reasoningEffort: string;
  sandboxMode: SandboxMode;
  executing: boolean;
};

export type ChatInlineRewriteDraft = {
  anchorEventId: string;
  anchorTurnId: string;
  composeInput: string;
  composeFileMentions: ComposeWorkspaceFileMention[];
  composeAttachments: ComposeImageAttachment[];
  model: string;
  reasoningEffort: string;
  sandboxMode: SandboxMode;
  composeMode: CollaborationModeKind;
  sending: boolean;
};

export type ChatUserMessageSnapshot = {
  text: string;
  textElements: unknown;
  images: string[];
  localImages: string[];
};

export type ChatUserMessagePart =
  | { key: string; type: "text"; text: string }
  | { key: string; type: "file"; path: string; label: string; title: string; icon: IconifyIcon };

export type ImageToolImageEntry = {
  id: string;
  sourceKind: LazyImageSourceKind;
  source: string;
  title: string;
};

export type ImageToolItemWithImages = {
  images: ImageToolImageEntry[];
};

export type ImagePreviewPayload = {
  src: string;
  title: string;
  source: string;
  sourceKind: LazyImageSourceKind;
};
