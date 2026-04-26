import type { TimelineEventItem } from "../../domain/types";
import type {
  ReasoningBlockNode,
  FileChangeNode,
  CommandActionNode,
  McpResourceReadNode,
  McpToolGroupNode,
} from "../../features/timeline/renderModel/buildTimelineNodes";
import type { NormalizedWebSearchActionType } from "../../features/timeline/webSearch";
import type { SandboxMode } from "../../stores/runtime.store";

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
};

export type ChatRowBase = {
  id: string;
  turnKey: string;
};

export type ChatRow =
  | (ChatRowBase & { kind: "user"; event: TimelineEventItem })
  | (ChatRowBase & { kind: "assistant"; event: TimelineEventItem })
  | (ChatRowBase & { kind: "system"; text: string })
  | (ChatRowBase & { kind: "activity"; text: string; createdAt: number; tone?: ActivityTone })
  | (ChatRowBase & { kind: "imageTool"; createdAt: number; item: ChatImageToolItem })
  | (ChatRowBase & { kind: "webSearch"; createdAt: number; item: ChatWebSearchItem })
  | (ChatRowBase & { kind: "reasoningBlock"; item: ReasoningBlockNode })
  | (ChatRowBase & { kind: "fileChange"; item: FileChangeNode })
  | (ChatRowBase & { kind: "commandAction"; item: CommandActionNode })
  | (ChatRowBase & { kind: "mcpResourceRead"; item: McpResourceReadNode })
  | (ChatRowBase & { kind: "mcpToolGroup"; group: McpToolGroupNode });

export type ChatRenderedRow = ChatRow;

export type PlanDeltaExecUiState = {
  model: string;
  reasoningEffort: string;
  sandboxMode: SandboxMode;
  executing: boolean;
};

export type ChatUserMessageSnapshot = {
  text: string;
  textElements: unknown;
  images: string[];
  localImages: string[];
};

export type ChatUserMessagePart =
  | { key: string; type: "text"; text: string }
  | { key: string; type: "file"; path: string; label: string; title: string };

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
