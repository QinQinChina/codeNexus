import type { TimelineEventItem } from "../../../domain/types";
import { buildStructuredTextSegments } from "../../../domain/composeFileMentions";
import { basenameFromPath } from "../../../domain/workspaceFiles";
import { useWorkspaceFilesStore } from "../../../stores/workspaceFiles.store";
import { resolveVscodeEntryIcon } from "../workspace/vscodeFileIcons";
import type {
  ChatUserMessageSnapshot,
  ChatUserMessagePart,
  LazyImageSourceKind,
  ChatImageEntry,
  ThumbLoadErrorPayload,
  ImageToolItemWithImages,
  ImageToolImageEntry,
} from "../types/chat.types";

type UserMessageSnapshotBuildState = {
  textParts: string[];
  images: string[];
  localImages: string[];
  textElements: unknown;
};

export function useChatMessageParts(hiddenImageIds: () => Set<string>, onLayoutChange?: () => void) {
  const workspaceFilesStore = useWorkspaceFilesStore();

  const toRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const toStringArray = (value: unknown, opts?: { keepEmpty?: boolean }): string[] =>
    Array.isArray(value)
      ? value.map((item) => String(item ?? "")).filter((item) => (opts?.keepEmpty ? true : !!item.trim()))
      : [];

  const pushText = (parts: string[], value: unknown) => {
    if (typeof value !== "string") return;
    if (!value) return;
    parts.push(value);
  };

  const pushStringArray = (target: string[], value: unknown, opts?: { keepEmpty?: boolean }) => {
    target.push(...toStringArray(value, opts));
  };

  const readUserContent = (content: unknown, target: UserMessageSnapshotBuildState) => {
    if (typeof content === "string") {
      pushText(target.textParts, content);
      return;
    }
    if (!Array.isArray(content)) return;

    for (const part of content) {
      if (typeof part === "string") {
        pushText(target.textParts, part);
        continue;
      }
      const record = toRecord(part);
      if (!record) continue;
      const type = String(record.type ?? "").trim();

      if (type === "text" || type === "input_text" || type === "output_text") {
        pushText(target.textParts, record.text);
        if (target.textElements == null && Array.isArray(record.text_elements)) {
          target.textElements = record.text_elements;
        }
        continue;
      }

      if (type === "image") {
        pushText(target.images, record.url);
        continue;
      }

      if (type === "input_image") {
        pushText(target.images, record.image_url);
        continue;
      }

      if (type === "localImage") {
        pushText(target.localImages, record.path);
        continue;
      }

      if (type === "mention") {
        pushText(target.textParts, record.path);
        continue;
      }

      pushText(target.textParts, record.text);
    }
  };

  const getUserMessageSnapshot = (event: TimelineEventItem): ChatUserMessageSnapshot => {
    const params = toRecord(event?.params);
    const item = toRecord(params?.item);
    const message = toRecord(params?.message) ?? toRecord(params?.payload);
    const state: UserMessageSnapshotBuildState = {
      textParts: [],
      images: [],
      localImages: [],
      textElements: params?.text_elements,
    };

    pushText(state.textParts, params?.text);
    pushText(state.textParts, params?.message);
    pushStringArray(state.images, params?.images, { keepEmpty: true });
    pushStringArray(state.localImages, params?.local_images);
    pushText(state.images, params?.image_url);
    pushText(state.images, params?.url);
    pushText(state.localImages, params?.localImage);
    pushText(state.localImages, params?.local_image);

    if (item) {
      pushText(state.textParts, item.text);
      pushStringArray(state.images, item.images, { keepEmpty: true });
      pushStringArray(state.localImages, item.local_images);
      readUserContent(item.content, state);
    }

    if (message) {
      pushText(state.textParts, message.text);
      if (state.textElements == null && Array.isArray(message.text_elements))
        state.textElements = message.text_elements;
      pushStringArray(state.images, message.images, { keepEmpty: true });
      pushStringArray(state.localImages, message.local_images);
      readUserContent(message.content, state);
    }

    readUserContent(params?.content, state);

    const text =
      state.textParts.length > 0 ? state.textParts.join("\n").replace(/\r\n?/g, "\n") : String(event?.paramsText ?? "");
    return {
      text,
      textElements: state.textElements,
      images: state.images,
      localImages: state.localImages,
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
          icon: resolveVscodeEntryIcon(segment.path, { isDirectory: false }),
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

  return {
    userMessageParts,
    userMessageImageCount,
    visibleUserMessageImageEntries,
    visibleImageToolEntries,
    onThumbLoadError,
    onUserFileTokenClick,
    getUserMessageSnapshot,
  };
}
