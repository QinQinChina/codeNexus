import { computed } from "vue";
import type { TimelineEventItem } from "../../domain/types";
import { buildComposeDraftFromStructuredText, buildStructuredTextSegments } from "../../domain/composeFileMentions";
import { basenameFromPath } from "../../domain/workspaceFiles";
import { useRuntimeStore } from "../../stores/runtime.store";
import { useWorkspaceFilesStore } from "../../stores/workspaceFiles.store";
import type {
  ChatUserMessageSnapshot,
  ChatUserMessagePart,
  LazyImageSourceKind,
  ChatImageEntry,
  ThumbLoadErrorPayload,
  ImageToolItemWithImages,
  ImageToolImageEntry,
} from "./chat.types";

export function useChatMessageParts(hiddenImageIds: () => Set<string>, onLayoutChange?: () => void) {
  const runtimeStore = useRuntimeStore();
  const workspaceFilesStore = useWorkspaceFilesStore();

  const toRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const toStringArray = (value: unknown, opts?: { keepEmpty?: boolean }): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item ?? "")).filter((item) => (opts?.keepEmpty ? true : !!item.trim()))
      : [];

  const getUserMessageSnapshot = (event: TimelineEventItem): ChatUserMessageSnapshot => {
    const params = toRecord(event?.params);
    return {
      text: typeof params?.text === "string" ? params.text : String(event?.paramsText ?? ""),
      textElements: params?.text_elements,
      images: toStringArray(params?.images, { keepEmpty: true }),
      localImages: toStringArray(params?.local_images),
    };
  };

  const userMessageParts = (event: TimelineEventItem): ChatUserMessagePart[] => {
    const snapshot = getUserMessageSnapshot(event);
    const parts: ChatUserMessagePart[] = [];
    let index = 0;
    for (const segment of buildStructuredTextSegments(snapshot.text, snapshot.textElements, {
      inferAbsolutePaths: true,
    })) {
      if (segment.type === "text") {
        if (segment.text) {
          parts.push({ key: `${event.id}:text:${index}`, type: "text", text: segment.text });
        }
      } else {
        const label = String(segment.placeholder ?? "").trim() || basenameFromPath(segment.path) || segment.path;
        parts.push({
          key: `${event.id}:file:${index}:${segment.path}`,
          type: "file",
          path: segment.path,
          label,
          title: segment.path,
        });
      }
      index += 1;
    }
    if (parts.length > 0) return parts;
    const fallbackText = String(event?.paramsText ?? "");
    return fallbackText ? [{ key: `${event.id}:fallback`, type: "text", text: fallbackText }] : [];
  };

  const inferLazyImageSourceKind = (value: string): LazyImageSourceKind => {
    const text = String(value ?? "").trim();
    if (!text) return "remoteUrl";
    if (text.startsWith("data:image/")) return "dataUrl";
    if (/^https?:\/\//i.test(text)) return "remoteUrl";
    return "localPath";
  };

  const userMessageImageCount = (event: TimelineEventItem): number => {
    const snapshot = getUserMessageSnapshot(event);
    return snapshot.images.length + snapshot.localImages.length;
  };

  const userMessageImageEntries = (event: TimelineEventItem): ChatImageEntry[] => {
    const snapshot = getUserMessageSnapshot(event);
    const entries: ChatImageEntry[] = [];
    snapshot.images.forEach((source, i) => {
      const kind = inferLazyImageSourceKind(source);
      entries.push({
        id: `${event.id}:img:${i + 1}:${source.length}`,
        sourceKind: kind === "localPath" ? "remoteUrl" : kind,
        source,
        title: `图片 ${i + 1}`,
      });
    });
    snapshot.localImages.forEach((source, i) => {
      const name = basenameFromPath(source) || source;
      entries.push({ id: `${event.id}:local:${i + 1}:${name}`, sourceKind: "localPath", source, title: name });
    });
    return entries;
  };

  const visibleUserMessageImageEntries = (event: TimelineEventItem): ChatImageEntry[] => {
    const entries = userMessageImageEntries(event);
    return entries.filter((e) => e?.id && !hiddenImageIds().has(e.id));
  };

  const visibleImageToolEntries = (item: ImageToolItemWithImages): ImageToolImageEntry[] => {
    const entries = Array.isArray(item?.images) ? item.images : [];
    return entries.filter((e) => e?.id && !hiddenImageIds().has(e.id));
  };

  const onThumbLoadError = (payload: ThumbLoadErrorPayload) => {
    const id = String(payload?.imageId ?? "").trim();
    if (id && !hiddenImageIds().has(id)) {
      hiddenImageIds().add(id);
      onLayoutChange?.();
    }
  };

  const onUserFileTokenClick = (pathValue: string) => {
    const path = String(pathValue ?? "").trim();
    if (path) void workspaceFilesStore.openFile(path);
  };

  const historyRewriteAnchorId = computed(() => {
    if (!runtimeStore.historyRewriteActive || runtimeStore.historyRewriteSource !== "history") return "";
    return String(runtimeStore.historyRewriteAnchorEventId ?? "").trim();
  });

  const isHistoryRewriteAnchor = (event: TimelineEventItem) => {
    const id = historyRewriteAnchorId.value;
    return !!id && String(event?.id ?? "").trim() === id;
  };

  const onUserBubbleClick = (event: TimelineEventItem) => {
    if (window.getSelection?.()?.toString().trim()) return;
    const anchorEventId = String(event?.id ?? "").trim();
    const anchorTurnId = String(event?.turnId ?? "").trim();
    if (!anchorEventId) return;
    if (
      runtimeStore.historyRewriteActive &&
      historyRewriteAnchorId.value &&
      anchorEventId === historyRewriteAnchorId.value
    ) {
      runtimeStore.cancelHistoryRewrite({ restoreDraft: true });
      return;
    }
    const snapshot = getUserMessageSnapshot(event);
    const draft = buildComposeDraftFromStructuredText(snapshot.text, snapshot.textElements, {
      inferAbsolutePaths: true,
      idPrefix: "history-file",
    });
    runtimeStore.startHistoryRewrite({
      anchorEventId,
      anchorTurnId,
      prefillText:
        draft.composeInput ||
        snapshot.text ||
        (snapshot.images.length + snapshot.localImages.length > 0 ? "" : String(event?.paramsText ?? "")),
      prefillMentions: draft.composeFileMentions,
    });
  };

  return {
    userMessageParts,
    userMessageImageCount,
    visibleUserMessageImageEntries,
    visibleImageToolEntries,
    onThumbLoadError,
    onUserFileTokenClick,
    onUserBubbleClick,
    isHistoryRewriteAnchor,
    getUserMessageSnapshot,
  };
}
